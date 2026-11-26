import os
import re
import time
import uuid
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import APIRouter, File, UploadFile, BackgroundTasks, Form, HTTPException, Request
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from src.learning.podcast_generator import PodcastGenerator
from src.api.deps import (
    get_session_manager,
    get_vector_store,
    get_llm_engine,
    resolve_llm_config,
    select_notebook_documents,
    collect_document_context,
)
from src.utils.config import settings
from src.utils.audio import is_valid_audio_file

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Media & Podcast"])

_PODCAST_STATUS: Dict[str, Dict[str, Any]] = {}


def _podcast_file(notebook_id: str, suffix: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", notebook_id or ""):
        raise HTTPException(status_code=400, detail="notebook_id không hợp lệ.")
    return settings.project_root / "storage" / "podcasts" / f"{notebook_id}{suffix}"

def _run_podcast_generation_task(generator: PodcastGenerator, notebook_id: str, generation_id: str, source_revision: int, **kwargs):
    global _PODCAST_STATUS
    try:
        out = generator.generate_podcast(notebook_id=notebook_id, source_revision=source_revision, **kwargs)
        if not is_valid_audio_file(out):
            raise RuntimeError("TTS không tạo được âm thanh Podcast hợp lệ.")
        if generator.db.get_source_revision(notebook_id) != source_revision:
            generator.db._delete_generated_audio(notebook_id)
            raise RuntimeError("Nguồn tài liệu đã thay đổi. Vui lòng tạo lại Podcast.")
        if _PODCAST_STATUS.get(notebook_id, {}).get("generation_id") != generation_id:
            return
        _PODCAST_STATUS[notebook_id] = {
            "status": "completed",
            "completed_at": time.time(),
            "output_file": out,
            "generation_id": generation_id,
            "source_revision": source_revision,
            "error": None
        }
    except Exception as e:
        logger.error(f"Lỗi background tạo podcast notebook {notebook_id}: {e}")
        _PODCAST_STATUS[notebook_id] = {
            "status": "error",
            "generation_id": generation_id,
            "source_revision": source_revision,
            "error": str(e)
        }

@router.post("/api/podcast/generate")
async def generate_podcast(
    request: Request,
    background_tasks: BackgroundTasks,
    notebook_id: Optional[str] = Form(None)
):
    """Tạo podcast âm thanh hỗ trợ lọc theo tài liệu đã chọn (selected_documents), chủ đề & phong cách."""
    sm = get_session_manager()
    target_id = notebook_id
    focus_topic = None
    style = "fun"
    selected_documents = None
    voice_mode = "duo"

    try:
        body = await request.json()
        if body and isinstance(body, dict):
            target_id = target_id or body.get("notebook_id")
            raw_focus = body.get("focus_topic")
            if raw_focus and isinstance(raw_focus, str):
                focus_topic = raw_focus.strip()
            style = body.get("style") or "fun"
            selected_documents = body.get("selected_documents")
            voice_mode = body.get("voice_mode") or "duo"
    except Exception:
        pass

    if not target_id:
        raise HTTPException(status_code=400, detail="Thiếu notebook_id")
    _podcast_file(target_id, ".mp3")

    notebook = sm.get_notebook(target_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    docs = select_notebook_documents(sm, target_id, selected_documents)
    source_revision = sm.get_source_revision(target_id)
    task = _PODCAST_STATUS.get(target_id, {})
    if task.get("status") == "generating" and task.get("source_revision") == source_revision:
        raise HTTPException(status_code=409, detail="Podcast đang được tạo. Vui lòng chờ hoàn tất.")
    vs = await run_in_threadpool(get_vector_store)
    try:
        custom_context = await run_in_threadpool(collect_document_context, vs, target_id, docs, limit=10)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    provider, model_name, api_key, base_url, is_private = resolve_llm_config(notebook)
    llm = get_llm_engine()
    generator = PodcastGenerator(llm, sm)
    generation_id = uuid.uuid4().hex
    _PODCAST_STATUS[target_id] = {
        "status": "generating", "started_at": time.time(), "error": None,
        "generation_id": generation_id, "source_revision": source_revision,
    }
    
    background_tasks.add_task(
        _run_podcast_generation_task,
        generator=generator,
        notebook_id=target_id,
        generation_id=generation_id,
        source_revision=source_revision,
        is_private=is_private,
        provider=provider,
        model_name=model_name,
        api_key=api_key,
        base_url=base_url,
        focus_topic=focus_topic,
        style=style,
        custom_context=custom_context,
        voice_mode=voice_mode
    )
    return {"status": "processing"}

@router.get("/api/podcast/status/{notebook_id}")
def get_podcast_status(notebook_id: str):
    """Kiểm tra trạng thái tiến trình tạo Podcast."""
    audio_path = _podcast_file(notebook_id, ".mp3")
    wav_path = _podcast_file(notebook_id, ".wav")
    sm = get_session_manager()
    if not sm.get_notebook(notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    has_audio = is_valid_audio_file(audio_path) or is_valid_audio_file(wav_path)

    task_info = _PODCAST_STATUS.get(notebook_id, {})
    if task_info.get("source_revision") != sm.get_source_revision(notebook_id):
        task_info = {}
    status = task_info.get("status")

    if status == "generating":
        return {"status": "generating", "has_audio": has_audio, "error": None}
    if status == "error":
        return {"status": "error", "has_audio": has_audio, "error": task_info.get("error")}
    if has_audio:
        return {"status": "completed", "has_audio": True, "error": None}
    if status == "completed":
        return {"status": "error", "has_audio": False, "error": "Tệp Podcast bị thiếu hoặc không hợp lệ. Vui lòng tạo lại."}
    return {"status": "not_found", "has_audio": False, "error": None}

@router.get("/api/podcast/audio/{notebook_id}")
@router.head("/api/podcast/audio/{notebook_id}")
def get_podcast_audio(notebook_id: str):
    """Phục vụ file âm thanh Podcast đã tạo (Hỗ trợ cả GET và HEAD)."""
    audio_path = _podcast_file(notebook_id, ".mp3")
    if not get_session_manager().get_notebook(notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    if is_valid_audio_file(audio_path):
        return FileResponse(audio_path, media_type="audio/mpeg")
    wav_path = _podcast_file(notebook_id, ".wav")
    if is_valid_audio_file(wav_path):
        return FileResponse(wav_path, media_type="audio/wav")
    raise HTTPException(status_code=404, detail="Chưa có file Podcast cho sổ tay này.")

@router.post("/api/audio/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Chuyển đổi âm thanh ghi âm giọng nói thành văn bản."""
    import tempfile
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".webm", ".wav", ".mp3", ".m4a", ".ogg", ".mp4", ".mpeg"}:
        raise HTTPException(status_code=415, detail="Định dạng audio chưa được hỗ trợ.")
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    content = await file.read(max_bytes + 1)
    await file.close()
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Audio vượt quá giới hạn {settings.max_upload_size_mb} MB.")
    if not content:
        raise HTTPException(status_code=400, detail="Tệp ghi âm rỗng. Vui lòng ghi âm lại.")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        def _transcribe():
            from src.ingestion.parsers.audio_parser import load_whisper_model
            model = load_whisper_model("base")
            return model.transcribe(tmp_path, language="vi")

        result = await run_in_threadpool(_transcribe)
        text = result.get("text", "").strip()
        if not text:
            raise HTTPException(status_code=422, detail="Không nhận diện được lời nói. Vui lòng ghi âm rõ hơn.")
        return {"status": "success", "text": text}
    except HTTPException:
        raise
    except (ImportError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Lỗi Whisper transcribe: {e}")
        raise HTTPException(status_code=500, detail=f"Không thể phiên âm audio bằng Whisper local: {e}") from e
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
