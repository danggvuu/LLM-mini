import os
import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

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

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Notebooks"])

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
    return {"status": "success", "notebook": sm.get_notebook(data.id)}

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
    return sm.list_notebooks()

@router.get("/api/notebooks/{notebook_id}")
def get_notebook(notebook_id: str):
    sm = get_session_manager()
    nb = sm.get_notebook(notebook_id)
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return nb

@router.put("/api/notebooks/{notebook_id}/settings")
def update_notebook_settings(notebook_id: str, data: NotebookUpdate):
    sm = get_session_manager()
    nb = sm.get_notebook(notebook_id)
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    new_base_url = data.base_url
    if data.provider and data.provider != nb.get('provider') and new_base_url is None:
        new_base_url = ""

    sm.update_notebook_settings(
        notebook_id=notebook_id,
        title=data.title,
        provider=data.provider,
        model_name=data.model_name,
        api_key=data.api_key,
        base_url=new_base_url,
        is_private=data.is_private
    )
    return {"status": "success", "notebook": sm.get_notebook(notebook_id)}

@router.delete("/api/notebooks/{notebook_id}")
def delete_notebook(notebook_id: str):
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
    """Xuất trọn vẹn dữ liệu sổ tay kèm các phân đoạn văn bản (chunks) thành file JSON."""
    sm = get_session_manager()
    data = sm.export_notebook_data(notebook_id)
    if not data:
        raise HTTPException(status_code=404, detail="Notebook không tồn tại.")
    
    vs = get_vector_store()
    chunks_export = []
    for doc in data.get("documents", []):
        fname = doc.get("filename")
        if fname:
            doc_chunks = vs.get_chunks_by_document(notebook_id, fname, limit=200)
            for c_text in doc_chunks:
                chunks_export.append({
                    "content": c_text,
                    "metadata": {"filename": fname}
                })
    data["chunks"] = chunks_export
    data["pinned_notes"] = _load_notes(notebook_id)
    return data

@router.post("/api/notebooks/import")
async def import_notebook_endpoint(payload: Dict[str, Any]):
    """Nhập dữ liệu sổ tay từ file JSON và tự động tái lập chỉ mục Qdrant + BM25."""
    sm = get_session_manager()
    new_id = sm.import_notebook_data(payload)
    
    imported_chunks = payload.get("chunks", [])
    if imported_chunks and isinstance(imported_chunks, list):
        formatted_chunks = []
        for ch in imported_chunks:
            content = ch.get("content", "")
            meta = dict(ch.get("metadata", {}))
            meta["notebook_id"] = new_id
            if content:
                formatted_chunks.append({"content": content, "metadata": meta})
        if formatted_chunks:
            vs = get_vector_store()
            vs.index_chunks(formatted_chunks)

    imported_notes = payload.get("pinned_notes", [])
    if imported_notes and isinstance(imported_notes, list):
        _save_notes(new_id, imported_notes)

    return {"status": "success", "notebook_id": new_id}
