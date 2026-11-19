import os
import re
import time
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
    resolve_llm_config
)
from src.utils.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Media & Podcast"])

_PODCAST_STATUS: Dict[str, Dict[str, Any]] = {}


def _podcast_file(notebook_id: str, suffix: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", notebook_id or ""):
        raise HTTPException(status_code=400, detail="notebook_id không hợp lệ.")
    return settings.project_root / "storage" / "podcasts" / f"{notebook_id}{suffix}"

def _run_podcast_generation_task(generator: PodcastGenerator, notebook_id: str, **kwargs):
    global _PODCAST_STATUS
    _PODCAST_STATUS[notebook_id] = {
        "status": "generating",
        "started_at": time.time(),
        "error": None
    }
    try:
        out = generator.generate_podcast(notebook_id=notebook_id, **kwargs)
        _PODCAST_STATUS[notebook_id] = {
            "status": "completed",
            "completed_at": time.time(),
            "output_file": out,
            "error": None
        }
    except Exception as e:
        logger.error(f"Lỗi background tạo podcast notebook {notebook_id}: {e}")
        _PODCAST_STATUS[notebook_id] = {
            "status": "error",
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

    notebook = sm.get_notebook(target_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    for ext in [".mp3", ".wav"]:
        old_path = _podcast_file(target_id, ext)
        if old_path.exists():
            try:
                old_path.unlink()
            except Exception:
                pass

    custom_context = None
    vs = await run_in_threadpool(get_vector_store)
    docs = sm.get_documents(target_id)
    if selected_documents and len(selected_documents) > 0:
        docs = [d for d in docs if d["filename"] in selected_documents]

    if docs:
        collected = []
        for d in docs:
            c = await run_in_threadpool(vs.get_chunks_by_document, target_id, d["filename"], limit=10)
            if c:
                collected.append(f"--- {d['filename']} ---\n" + "\n".join(c))
        if collected:
            custom_context = "\n\n".join(collected)

    provider, model_name, api_key, base_url, is_private = resolve_llm_config(notebook)
    llm = get_llm_engine()
    generator = PodcastGenerator(llm, sm)
    
    background_tasks.add_task(
        _run_podcast_generation_task,
        generator=generator,
        notebook_id=target_id,
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
    has_audio = (audio_path.is_file() and audio_path.stat().st_size > 100) or \
                (wav_path.is_file() and wav_path.stat().st_size > 100)

    task_info = _PODCAST_STATUS.get(notebook_id, {})
    status = task_info.get("status")

    if has_audio:
        return {"status": "completed", "has_audio": True, "error": None}
    if status == "generating":
        return {"status": "generating", "has_audio": False, "error": None}
    if status == "error":
        return {"status": "error", "has_audio": False, "error": task_info.get("error")}
    return {"status": "not_found", "has_audio": False, "error": None}

@router.get("/api/podcast/audio/{notebook_id}")
@router.head("/api/podcast/audio/{notebook_id}")
def get_podcast_audio(notebook_id: str):
    """Phục vụ file âm thanh Podcast đã tạo (Hỗ trợ cả GET và HEAD)."""
    audio_path = _podcast_file(notebook_id, ".mp3")
    if audio_path.is_file() and audio_path.stat().st_size > 100:
        return FileResponse(audio_path, media_type="audio/mpeg")
    wav_path = _podcast_file(notebook_id, ".wav")
    if wav_path.is_file() and wav_path.stat().st_size > 100:
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
        return {"status": "success", "text": text}
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
