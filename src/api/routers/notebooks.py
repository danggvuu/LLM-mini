import os
import logging
import re
from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from src.api.deps import (
    get_session_manager,
    get_vector_store,
    get_embedder,
    _get_notes_path,
    _load_notes,
    _save_notes,
    NotebookCreate,
    NotebookUpdate,
)
from src.api.routers.system import public_notebook

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Notebooks"])


def _validate_notebook_id(notebook_id: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", notebook_id or ""):
        raise HTTPException(status_code=400, detail="notebook_id không hợp lệ.")

@router.post("/api/notebooks")
def create_notebook(data: NotebookCreate):
    sm = get_session_manager()
    global_settings = sm.get_app_settings()
    
    provider = data.provider or ("ollama" if data.is_private else "gemini")
    model_name = data.model_name
    if not model_name:
        if provider == "ollama":
            model_name = global_settings.get("default_model", "qwen2.5:3b")
        elif provider == "gemini":
            model_name = global_settings.get("gemini_model", "gemini-2.5-flash")
        elif provider == "openai":
            model_name = global_settings.get("openai_model", "gpt-4o-mini")
        elif provider == "groq":
            model_name = global_settings.get("groq_model", "llama-3.3-70b-versatile")
        elif provider == "openrouter":
            model_name = global_settings.get("openrouter_model", "deepseek/deepseek-r1")

    api_key = data.api_key or data.gemini_api_key
    if not api_key:
        if provider == "gemini":
            api_key = global_settings.get("gemini_api_key")
        elif provider == "openai":
            api_key = global_settings.get("openai_api_key")
        elif provider == "groq":
            api_key = global_settings.get("groq_api_key")
        elif provider == "openrouter":
            api_key = global_settings.get("openrouter_api_key")
        elif provider == "9router":
            api_key = global_settings.get("router9_api_key")
        elif provider == "custom":
            api_key = global_settings.get("custom_api_key")

    base_url = data.base_url
    if not base_url:
        if provider == "ollama":
            base_url = global_settings.get("ollama_base_url")
        elif provider in ["lm_studio", "local_ai"]:
            base_url = global_settings.get("lm_studio_base_url")

    sm.create_notebook(
        notebook_id=data.id,
        title=data.title,
        is_private=data.is_private,
        gemini_api_key=api_key if provider == "gemini" else None,
        provider=provider,
        model_name=model_name,
        api_key=api_key,
        base_url=base_url
    )
    return {"status": "success", "notebook": public_notebook(sm.get_notebook(data.id))}

@router.post("/api/notebooks/seed/lao-cai")
def seed_lao_cai_notebook_endpoint():
    """Khởi tạo 1-click Sổ tay mẫu chuẩn Giáo Dục Địa Phương Tỉnh Lào Cai (phục vụ NCKH / Demo)."""
    try:
        from src.learning.lao_cai_seeder import seed_lao_cai_preset
        sm = get_session_manager()
        store = get_vector_store()
        embed = get_embedder()
        nb_id = seed_lao_cai_preset(sm, store, embed)
        return {
            "status": "success", 
            "notebook_id": nb_id,
            "message": "Đã khởi tạo thành công Sổ tay Giáo dục Địa phương Lào Cai!"
        }
    except Exception as e:
        logger.error(f"Lỗi khởi tạo Sổ tay Lào Cai: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi nạp dữ liệu Lào Cai: {str(e)}")

@router.get("/api/notebooks")
def list_notebooks():
    sm = get_session_manager()
    return [public_notebook(notebook) for notebook in sm.list_notebooks()]

@router.get("/api/notebooks/{notebook_id}")
def get_notebook(notebook_id: str):
    _validate_notebook_id(notebook_id)
    sm = get_session_manager()
    nb = sm.get_notebook(notebook_id)
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return public_notebook(nb)

@router.put("/api/notebooks/{notebook_id}/settings")
def update_notebook_settings(notebook_id: str, data: NotebookUpdate):
    _validate_notebook_id(notebook_id)
    sm = get_session_manager()
    nb = sm.get_notebook(notebook_id)
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    new_provider = data.provider.lower() if data.provider else None
    provider_changed = new_provider is not None and new_provider != (nb.get("provider") or "").lower()
    new_base_url = data.base_url
    if provider_changed and new_base_url is None:
        new_base_url = ""
    new_api_key = data.api_key
    if new_api_key is None or not new_api_key.strip() or set(new_api_key.strip()) <= {"*", "\u2022"}:
        new_api_key = "" if provider_changed else None

    sm.update_notebook_settings(
        notebook_id=notebook_id,
        title=data.title,
        provider=new_provider,
        model_name="" if provider_changed and data.model_name is None else data.model_name,
        api_key=new_api_key,
        base_url=new_base_url,
        is_private=data.is_private
    )
    return {"status": "success", "notebook": public_notebook(sm.get_notebook(notebook_id))}

@router.delete("/api/notebooks/{notebook_id}")
def delete_notebook(notebook_id: str):
    _validate_notebook_id(notebook_id)
    sm = get_session_manager()
    sm.delete_notebook(notebook_id)
    store = get_vector_store()
    store.delete_notebook_chunks(notebook_id)
    notes_file = _get_notes_path(notebook_id)
    if os.path.exists(notes_file):
        try:
            os.remove(notes_file)
        except Exception as e:
            logger.warning(f"Không thể xóa file ghi chú {notes_file}: {e}")
    return {"status": "success"}

@router.get("/api/notebooks/{notebook_id}/export")
def export_notebook_endpoint(notebook_id: str):
    _validate_notebook_id(notebook_id)
    """Xuất trọn vẹn dữ liệu sổ tay kèm các phân đoạn văn bản (chunks) thành file JSON."""
    sm = get_session_manager()
    data = sm.export_notebook_data(notebook_id)
    if not data:
        raise HTTPException(status_code=404, detail="Notebook không tồn tại.")
    data["notebook"] = public_notebook(data["notebook"])
    
    vs = get_vector_store()
    chunks_export = []
    for doc in data.get("documents", []):
        fname = doc.get("filename")
        if fname:
            doc_chunks = vs.get_document_chunk_records(notebook_id, fname, limit=10000)
            for chunk in doc_chunks:
                chunks_export.append({
                    "content": chunk["content"],
                    "metadata": {**chunk.get("metadata", {}), "filename": fname}
                })
    data["chunks"] = chunks_export
    data["pinned_notes"] = _load_notes(notebook_id)
    return data

@router.post("/api/notebooks/import")
async def import_notebook_endpoint(payload: Dict[str, Any]):
    """Nhập dữ liệu sổ tay từ file JSON và tự động tái lập chỉ mục Qdrant + BM25."""
    sm = get_session_manager()
    imported_notes = payload.get("pinned_notes", [])
    imported_chunks = payload.get("chunks", [])
    if not isinstance(imported_notes, list) or any(
        not isinstance(note, dict) or not isinstance(note.get("content"), str) or not isinstance(note.get("id"), str)
        for note in imported_notes
    ):
        raise HTTPException(status_code=422, detail="Danh sách ghi chú trong tệp nhập không hợp lệ.")
    if not isinstance(imported_chunks, list) or any(
        not isinstance(chunk, dict) or not isinstance(chunk.get("content"), str) or not isinstance(chunk.get("metadata", {}), dict)
        for chunk in imported_chunks
    ):
        raise HTTPException(status_code=422, detail="Các đoạn nội dung trong tệp nhập không hợp lệ.")
    try:
        new_id = await run_in_threadpool(sm.import_notebook_data, payload)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"Tệp sổ tay không hợp lệ: {exc}") from exc
    
    try:
        formatted_chunks = []
        for ch in imported_chunks:
            content = ch.get("content", "")
            meta = dict(ch.get("metadata", {}))
            meta["notebook_id"] = new_id
            if content:
                formatted_chunks.append({"content": content, "metadata": meta})
        if formatted_chunks:
            vs = await run_in_threadpool(get_vector_store)
            await run_in_threadpool(vs.index_chunks, formatted_chunks)
        if imported_notes:
            _save_notes(new_id, imported_notes)
    except Exception as exc:
        logger.exception("Nhập sổ tay thất bại, dọn dẹp bản sao %s", new_id)
        if imported_chunks:
            try:
                vs = await run_in_threadpool(get_vector_store)
                await run_in_threadpool(vs.delete_notebook_chunks, new_id)
            except Exception:
                logger.exception("Không thể dọn dẹp index của bản sao %s", new_id)
        sm.delete_notebook(new_id)
        raise HTTPException(status_code=500, detail="Không thể nhập nội dung sổ tay. Bản sao chưa hoàn chỉnh đã được hủy; vui lòng thử lại.") from exc

    return {"status": "success", "notebook_id": new_id}
