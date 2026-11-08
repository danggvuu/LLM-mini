import os
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, File, UploadFile, BackgroundTasks, Form, HTTPException, Request, Depends

from src.ingestion.parsers.markitdown_parser import MarkItDownParser
from src.ingestion.parsers.web_parser import WebParser
from src.ingestion.chunking import AdaptiveChunker
from src.learning.guide_generator import GuideGenerator
from src.learning.doc_comparator import DocComparator
from src.api.deps import (
    get_session_manager,
    get_embedder,
    get_vector_store,
    get_llm_engine,
    get_notebook_engines,
    resolve_llm_config,
    get_notebook_id,
    IngestTextRequest,
    CompareDocsRequest,
    StudioFilterRequest
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Documents & Ingestion"])

@router.get("/api/notebooks/{notebook_id}/documents")
def get_documents(notebook_id: str):
    sm = get_session_manager()
    return sm.get_documents(notebook_id)

@router.delete("/api/notebooks/{notebook_id}/documents")
def delete_document(notebook_id: str, filename: str):
    sm = get_session_manager()
    sm.delete_document(notebook_id, filename)
    store = get_vector_store()
    store.delete_document_chunks(notebook_id, filename)
    return {"status": "success"}

@router.get("/api/notebooks/{notebook_id}/documents/preview")
def preview_document(notebook_id: str, filename: str):
    """Trích xuất và xem trước nội dung văn bản thô cùng số chunk của tài liệu."""
    sm = get_session_manager()
    notebook = sm.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    store = get_vector_store()
    from qdrant_client.http.models import Filter, FieldCondition, MatchValue
    try:
        res, _ = store.client.scroll(
            collection_name=store.collection_name,
            scroll_filter=Filter(
                must=[
                    FieldCondition(key="notebook_id", match=MatchValue(value=notebook_id))
                ],
                should=[
                    FieldCondition(key="filename", match=MatchValue(value=filename)),
                    FieldCondition(key="source_file", match=MatchValue(value=filename)),
                    FieldCondition(key="title", match=MatchValue(value=filename)),
                    FieldCondition(key="source_url", match=MatchValue(value=filename))
                ]
            ),
            limit=50,
            with_payload=True
        )
        chunks = [p.payload.get("content", "") for p in res if p.payload]
        total_chars = sum(len(c) for c in chunks)
        preview_text = "\n\n--- [Đoạn phân đoạn] ---\n\n".join(chunks[:15])
        return {
            "filename": filename,
            "chunk_count": len(chunks),
            "character_count": total_chars,
            "preview_text": preview_text or "Chưa tìm thấy đoạn trích xuất văn bản."
        }
    except Exception as e:
        logger.error(f"Lỗi preview document: {e}")
        return {
            "filename": filename,
            "chunk_count": 0,
            "character_count": 0,
            "preview_text": f"Không thể tải nội dung xem trước: {e}"
        }

@router.post("/api/ingest/url")
async def ingest_url(background_tasks: BackgroundTasks, notebook_id: str = Form(...), url: str = Form(...)):
    """Nạp dữ liệu từ URL hoặc Video YouTube."""
    sm = get_session_manager()
    parser = WebParser()
    tree = parser.parse(url)
    tree.metadata["notebook_id"] = notebook_id
    
    filename = tree.metadata.get("title", url)
    chunker = AdaptiveChunker(embedder=get_embedder())
    chunks = chunker.process_document(tree)
    
    for chunk in chunks:
        chunk["metadata"]["notebook_id"] = notebook_id
        chunk["metadata"]["filename"] = filename
    
    store = get_vector_store()
    store.index_chunks(chunks)
    sm.add_document(notebook_id, filename)
    
    document_text = "\n\n".join([chunk["content"] for chunk in chunks])
    notebook = sm.get_notebook(notebook_id)

    provider, model_name, api_key, base_url, is_private = resolve_llm_config(notebook)
    llm = get_llm_engine()
    guide_gen = GuideGenerator(llm, sm)
    background_tasks.add_task(
        guide_gen.generate, 
        notebook_id=notebook_id, 
        document_text=document_text, 
        is_private=is_private,
        provider=provider,
        model_name=model_name,
        api_key=api_key,
        base_url=base_url
    )
    
    return {"status": "success", "chunks_indexed": len(chunks)}

@router.post("/api/ingest/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    notebook_id: str = Form(...), 
    file: UploadFile = File(...)
):
    sm = get_session_manager()
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
        
    lower_name = file.filename.lower()
    if lower_name.endswith(('.mp3', '.wav', '.flac', '.ogg', '.m4a')):
        from src.ingestion.parsers.audio_parser import AudioParser
        parser = AudioParser()
    elif lower_name.endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp')):
        from src.ingestion.parsers.image_parser import ImageParser
        settings_data = sm.get_app_settings()
        ollama_url = settings_data.get("ollama_base_url", "http://localhost:11434")
        parser = ImageParser(ollama_url=ollama_url)
    else:
        parser = MarkItDownParser()
        
    tree = parser.parse(file_path)
    tree.metadata["notebook_id"] = notebook_id
    
    chunker = AdaptiveChunker(embedder=get_embedder())
    chunks = chunker.process_document(tree)
    
    for chunk in chunks:
        chunk["metadata"]["notebook_id"] = notebook_id
        chunk["metadata"]["filename"] = file.filename
    
    store = get_vector_store()
    store.index_chunks(chunks)
    sm.add_document(notebook_id, file.filename)
    
    document_text = "\n\n".join([chunk["content"] for chunk in chunks])
    notebook = sm.get_notebook(notebook_id)

    provider, model_name, api_key, base_url, is_private = resolve_llm_config(notebook)
    llm = get_llm_engine()
    guide_gen = GuideGenerator(llm, sm)
    background_tasks.add_task(
        guide_gen.generate, 
        notebook_id=notebook_id, 
        document_text=document_text, 
        is_private=is_private,
        provider=provider,
        model_name=model_name,
        api_key=api_key,
        base_url=base_url
    )
    
    return {"status": "success", "chunks_indexed": len(chunks)}

@router.post("/api/ingest/text")
async def ingest_raw_text(background_tasks: BackgroundTasks, req: IngestTextRequest):
    """Nạp dữ liệu trực tiếp từ văn bản/ghi chú người dùng dán vào (Copy-Paste Text)."""
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Nội dung văn bản không được để trống.")
    
    sm = get_session_manager()
    notebook = sm.get_notebook(req.notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    from src.ingestion.parsers.text_parser import TextParser
    parser = TextParser()
    doc_title = (req.title.strip() if req.title and req.title.strip() else f"Ghi chú văn bản ({len(req.text)} ký tự)")
    if not doc_title.endswith(".txt") and not doc_title.endswith(".md"):
        doc_title += ".txt"

    tree = parser.parse(req.text, source_metadata={"filename": doc_title, "notebook_id": req.notebook_id})
    chunker = AdaptiveChunker(embedder=get_embedder())
    chunks = chunker.process_document(tree)

    for chunk in chunks:
        chunk["metadata"]["notebook_id"] = req.notebook_id
        chunk["metadata"]["filename"] = doc_title

    store = get_vector_store()
    store.index_chunks(chunks)
    sm.add_document(req.notebook_id, doc_title)

    document_text = "\n\n".join([chunk["content"] for chunk in chunks])
    provider, model_name, api_key, base_url, is_private = resolve_llm_config(notebook)
    llm = get_llm_engine()
    guide_gen = GuideGenerator(llm, sm)
    background_tasks.add_task(
        guide_gen.generate,
        notebook_id=req.notebook_id,
        document_text=document_text,
        is_private=is_private,
        provider=provider,
        model_name=model_name,
        api_key=api_key,
        base_url=base_url
    )

    return {"status": "success", "filename": doc_title, "chunks_indexed": len(chunks)}

@router.post("/api/notebooks/{notebook_id}/documents/compare")
async def compare_documents_endpoint(notebook_id: str, req: CompareDocsRequest):
    """So sánh và đối chiếu nội dung giữa 2 hoặc nhiều tài liệu."""
    sm = get_session_manager()
    notebook = sm.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
        
    if len(req.filenames) < 2:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất 2 tài liệu để so sánh.")

    try:
        vs = get_vector_store()
        docs_data = []
        for fname in req.filenames:
            chunks = vs.get_chunks_by_document(notebook_id, fname)
            text = "\n".join(chunks[:20])
            docs_data.append({"filename": fname, "text": text})

        provider, model_name, api_key, base_url, is_private = resolve_llm_config(notebook)
        llm = get_llm_engine()
        comparator = DocComparator(llm, sm)
        comparison_markdown = comparator.compare(
            notebook_id=notebook_id,
            docs_data=docs_data,
            focus_topic=req.focus_topic or "",
            is_private=is_private,
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url
        )
        return {"status": "success", "comparison": comparison_markdown, "filenames": req.filenames}
    except Exception as e:
        logger.error(f"Lỗi so sánh tài liệu: {e}")
        raise HTTPException(status_code=400, detail=f"Không thể so sánh tài liệu: {str(e)}")

@router.get("/api/documents/chunks")
@router.get("/api/notebooks/{notebook_id}/documents/chunks")
async def get_document_chunks(
    source: str,
    notebook_id: str = Depends(get_notebook_id),
    request: Request = None
):
    """Xem toàn bộ các đoạn (chunks) đã bóc tách của 1 tài liệu cụ thể."""
    target_nb = notebook_id
    if (not target_nb or target_nb == "default") and request:
        if request.query_params.get("notebook_id"):
            target_nb = request.query_params.get("notebook_id")
        elif request.headers.get("x-notebook-id"):
            target_nb = request.headers.get("x-notebook-id")
    engines = get_notebook_engines(target_nb)
    all_chunks = engines["store"].get_all_chunks(limit=500, notebook_id=target_nb)
    matched = [
        {
            "chunk_id": c.get("chunk_id", ""),
            "content": c.get("content", ""),
            "page": c.get("metadata", {}).get("page", 1),
            "breadcrumbs": c.get("metadata", {}).get("breadcrumbs", ""),
            "type": c.get("metadata", {}).get("type", "text")
        }
        for c in all_chunks
        if c.get("metadata", {}).get("source") == source
        or c.get("metadata", {}).get("filename") == source
        or c.get("metadata", {}).get("source_file") == source
        or c.get("metadata", {}).get("title") == source
    ]
    if not matched:
        raw_chunks = engines["store"].get_chunks_by_document(target_nb, source, limit=500)
        matched = [
            {
                "chunk_id": f"fb-{i}",
                "content": rc,
                "page": 1,
                "breadcrumbs": "",
                "type": "text"
            }
            for i, rc in enumerate(raw_chunks)
        ]
    return {"source": source, "total_chunks": len(matched), "chunks": matched}

@router.post("/api/studio/critique")
@router.post("/api/notebooks/{notebook_id}/studio/critique")
async def create_critique(
    req: StudioFilterRequest = StudioFilterRequest(),
    notebook_id: str = Depends(get_notebook_id),
    request: Request = None
):
    """Tạo Báo cáo Phản biện & Tìm lỗ hổng (Peer Review)."""
    target_nb = req.notebook_id or notebook_id
    if (not target_nb or target_nb == "default") and request:
        if request.query_params.get("notebook_id"):
            target_nb = request.query_params.get("notebook_id")
        elif request.headers.get("x-notebook-id"):
            target_nb = request.headers.get("x-notebook-id")
    engines = get_notebook_engines(target_nb)
    source_filter = req.source_filter or (req.selected_documents[0] if req.selected_documents and len(req.selected_documents) == 1 else None)
    llm_kwargs = engines.get("llm_kwargs", {})
    return engines["critique"].generate_critique(
        source_filter=source_filter,
        selected_documents=req.selected_documents,
        **llm_kwargs
    )

@router.post("/api/studio/action-plan")
@router.post("/api/notebooks/{notebook_id}/studio/action-plan")
async def create_action_plan(
    req: StudioFilterRequest = StudioFilterRequest(),
    notebook_id: str = Depends(get_notebook_id),
    request: Request = None
):
    """Tạo Kế hoạch hành động (Action Matrix & Checklist)."""
    target_nb = req.notebook_id or notebook_id
    if (not target_nb or target_nb == "default") and request:
        if request.query_params.get("notebook_id"):
            target_nb = request.query_params.get("notebook_id")
        elif request.headers.get("x-notebook-id"):
            target_nb = request.headers.get("x-notebook-id")
    engines = get_notebook_engines(target_nb)
    source_filter = req.source_filter or (req.selected_documents[0] if req.selected_documents and len(req.selected_documents) == 1 else None)
    llm_kwargs = engines.get("llm_kwargs", {})
    return engines["critique"].generate_action_plan(
        source_filter=source_filter,
        selected_documents=req.selected_documents,
        **llm_kwargs
    )
