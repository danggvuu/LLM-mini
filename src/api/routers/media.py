import os
import time
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, File, UploadFile, BackgroundTasks, Form, HTTPException, Request
from fastapi.responses import FileResponse

from src.learning.podcast_generator import PodcastGenerator
from src.api.deps import (
    get_session_manager,
    get_vector_store,
    get_llm_engine,
    resolve_llm_config
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Media & Podcast"])

_PODCAST_STATUS: Dict[str, Dict[str, Any]] = {}

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
        old_path = os.path.join("storage", "podcasts", f"{target_id}{ext}")
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception:
                pass

    custom_context = None
    vs = get_vector_store()
    docs = sm.get_documents(target_id)
    if selected_documents and len(selected_documents) > 0:
        docs = [d for d in docs if d["filename"] in selected_documents]

    if docs:
        collected = []
        for d in docs:
            c = vs.get_chunks_by_document(target_id, d["filename"], limit=10)
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
    audio_path = os.path.join("storage", "podcasts", f"{notebook_id}.mp3")
    wav_path = os.path.join("storage", "podcasts", f"{notebook_id}.wav")
    has_audio = (os.path.exists(audio_path) and os.path.getsize(audio_path) > 100) or \
                (os.path.exists(wav_path) and os.path.getsize(wav_path) > 100)

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
    audio_path = os.path.join("storage", "podcasts", f"{notebook_id}.mp3")
    if os.path.exists(audio_path) and os.path.getsize(audio_path) > 100:
        return FileResponse(audio_path, media_type="audio/mpeg")
    wav_path = os.path.join("storage", "podcasts", f"{notebook_id}.wav")
    if os.path.exists(wav_path) and os.path.getsize(wav_path) > 100:
        return FileResponse(wav_path, media_type="audio/wav")
    raise HTTPException(status_code=404, detail="Chưa có file Podcast cho sổ tay này.")

@router.post("/api/audio/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Chuyển đổi âm thanh ghi âm giọng nói thành văn bản."""
    import tempfile
    suffix = os.path.splitext(file.filename)[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        import whisper
        model = whisper.load_model("base")
        result = model.transcribe(tmp_path, language="vi")
        text = result.get("text", "").strip()
        return {"status": "success", "text": text}
    except Exception as e:
        logger.error(f"Lỗi Whisper transcribe: {e}")
        try:
            import speech_recognition as sr
            r = sr.Recognizer()
            with sr.AudioFile(tmp_path) as source:
                audio_data = r.record(source)
                text = r.recognize_google(audio_data, language="vi-VN")
                return {"status": "success", "text": text}
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Không thể phiên âm giọng nói: {str(e)} / {str(e2)}")
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
