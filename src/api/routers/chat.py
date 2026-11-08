import json
import logging
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from src.api.deps import (
    get_session_manager,
    get_search_engine,
    get_llm_engine,
    resolve_llm_config,
    ChatRequest
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Chat & Retrieval"])

@router.get("/api/notebooks/{notebook_id}/messages")
def get_messages(notebook_id: str):
    sm = get_session_manager()
    return sm.get_chat_history(notebook_id)

@router.delete("/api/notebooks/{notebook_id}/messages/{message_id}")
def delete_single_message(notebook_id: str, message_id: int):
    """Xóa một tin nhắn cụ thể trong lịch sử chat."""
    sm = get_session_manager()
    sm.delete_message(notebook_id, message_id)
    return {"status": "success", "message_id": message_id}

@router.delete("/api/notebooks/{notebook_id}/messages")
def clear_all_messages(notebook_id: str):
    """Xóa toàn bộ lịch sử trò chuyện của sổ tay."""
    sm = get_session_manager()
    sm.clear_chat_history(notebook_id)
    return {"status": "success", "notebook_id": notebook_id}

@router.post("/api/chat")
async def chat_endpoint(request: ChatRequest, raw_request: Request):
    """Xử lý câu hỏi của người dùng và stream câu trả lời."""
    sm = get_session_manager()
    notebook = sm.get_notebook(request.notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
        
    provider, model_name, api_key, base_url, is_private = resolve_llm_config(
        notebook,
        override_provider=request.provider,
        override_model=request.model_name
    )

    prior_history = sm.get_chat_history(request.notebook_id)[-6:]
    user_msg_id = sm.save_message(request.notebook_id, "user", request.query)
    
    async def stream_and_save():
        full_response = ""
        citations = []
        
        try:
            yield f"data: {json.dumps({'type': 'status', 'message': 'Đang tìm kiếm thông tin bằng Hybrid Search...'})}\n\n"
            
            engine = get_search_engine()
            context_str, results = engine.retrieve(
                request.query, 
                notebook_id=request.notebook_id,
                selected_documents=request.selected_documents
            )
            
            yield f"data: {json.dumps({'type': 'status', 'message': 'Đang đọc và phân tích ngữ cảnh...'})}\n\n"
            
            for doc in results:
                meta = doc.get('metadata', {})
                fname = meta.get('filename') or meta.get('source_file') or meta.get('title') or meta.get('source_url') or 'Tài liệu'
                snippet = (doc.get('content') or '')[:450]
                citations.append({
                    "marker": f"[{len(citations)+1}]",
                    "filename": fname,
                    "snippet": snippet
                })
            
            if citations:
                yield f"data: {json.dumps({'type': 'citations', 'citations': citations})}\n\n"

            llm = get_llm_engine()
            doc_list = sm.get_documents(request.notebook_id)
            active_doc_names = [d["filename"] for d in doc_list]
            if request.selected_documents and len(request.selected_documents) > 0:
                active_doc_names = [name for name in active_doc_names if name in request.selected_documents]

            rag_prompt = llm.build_rag_prompt(
                request.query, 
                context_str, 
                chat_history=prior_history,
                document_names=active_doc_names
            )
            persona = getattr(request, "persona", "strict") or "strict"
            persona_prompts = {
                "strict": (
                    "Bạn là NotebookLM Mini, một trợ lý học tập và nghiên cứu AI thông minh, chuẩn xác. "
                    "Hãy đọc hiểu sâu sắc tài liệu người dùng và trả lời có cấu trúc mạch lạc, khoa học. "
                    "Trả lời chính xác và chỉ dựa vào tài liệu được cung cấp, không suy diễn ngoài lề."
                ),
                "socratic": (
                    "Bạn là một gia sư Socratic thông thái, tận tâm. "
                    "Thay vì trả lời cụt lủn hay đưa ra đáp án trực tiếp ngay lập tức, hãy hướng dẫn người học tư duy từng bước. "
                    "Đặt câu hỏi gợi mở sâu sắc, phân tích vấn đề và giúp người học tự khám phá tri thức dựa trên tài liệu được cung cấp."
                ),
                "critic": (
                    "Bạn là một chuyên gia phản biện học thuật sắc bén, khách quan. "
                    "Hãy đánh giá đa chiều vấn đề dựa trên tài liệu: chỉ ra các giả định ngầm, phân tích điểm mạnh, "
                    "phát hiện các lỗ hổng lập luận hoặc hạn chế của tài liệu đối với câu hỏi đặt ra, giúp người học có cái nhìn phản tư sâu sắc."
                )
            }
            system_prompt = persona_prompts.get(persona, persona_prompts["strict"])
            
            display_model = model_name or ""
            yield f"data: {json.dumps({'type': 'status', 'message': f'{provider.upper()} ({display_model}) đang suy nghĩ...'})}\n\n"

            for chunk in llm.generate(
                prompt=rag_prompt, 
                system_prompt=system_prompt, 
                is_private=is_private, 
                provider=provider,
                model_name=model_name,
                api_key=api_key,
                base_url=base_url
            ):
                if await raw_request.is_disconnected():
                    logger.info("Client ngắt kết nối (Stop response). Dừng sinh văn bản.")
                    break
                full_response += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"
                
            yield f"data: {json.dumps({'type': 'status', 'message': ''})}\n\n"
            
        except Exception as e:
            err_msg = f"Lỗi hệ thống: {str(e)}"
            logger.error(err_msg)
            full_response += err_msg
            yield f"data: {json.dumps({'type': 'chunk', 'text': err_msg})}\n\n"
        finally:
            asst_msg_id = sm.save_message(request.notebook_id, "assistant", full_response, citations=citations)
            yield f"data: {json.dumps({'type': 'saved', 'user_msg_id': user_msg_id, 'assistant_msg_id': asst_msg_id})}\n\n"

    return StreamingResponse(
        stream_and_save(),
        media_type="text/event-stream"
    )
