import time
import logging
import re
from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from src.learning.guide_generator import GuideGenerator
from src.learning.evaluator import Evaluator
from src.learning.mindmap_generator import MindmapGenerator
from src.learning.timeline_generator import TimelineOutlineGenerator
from src.api.deps import (
    get_session_manager,
    get_vector_store,
    get_llm_engine,
    get_notebook_engines,
    resolve_llm_config,
    _load_notes,
    _save_notes,
    SrsReviewRequest,
    MindmapRequest,
    TimelineRequest,
    select_notebook_documents,
    collect_document_context,
    queue_study_guide,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Learning & Study Tools"])


def _validate_notebook_id(notebook_id: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", notebook_id or ""):
        raise HTTPException(status_code=400, detail="notebook_id không hợp lệ.")

class NoteItemRequest(BaseModel):
    content: str
    title: Optional[str] = "Ghi chú"
    source: Optional[str] = "manual"


class StudyGuideRequest(BaseModel):
    quiz_count: int = Field(default=5, ge=1, le=30)
    flashcards_count: int = Field(default=5, ge=1, le=50)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    focus_topic: Optional[str] = None
    selected_documents: Optional[List[str]] = None


@router.get("/api/notebooks/{notebook_id}/study-guide/status")
def get_study_guide_status(notebook_id: str):
    _validate_notebook_id(notebook_id)
    sm = get_session_manager()
    if not sm.get_notebook(notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    return sm.get_study_guide_status(notebook_id)

@router.get("/api/notebooks/{notebook_id}/study-guide")
def get_study_guide(notebook_id: str):
    _validate_notebook_id(notebook_id)
    sm = get_session_manager()
    if not sm.get_notebook(notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    guide = sm.get_study_guide(notebook_id)
    if not guide:
        raise HTTPException(status_code=404, detail="Study guide not found")
    return guide

@router.post("/api/notebooks/{notebook_id}/study-guide/regenerate")
async def regenerate_study_guide(
    notebook_id: str, 
    background_tasks: BackgroundTasks,
    payload: StudyGuideRequest = StudyGuideRequest()
):
    """Tạo lại Study Guide theo yêu cầu có tùy biến số câu hỏi, flashcards, mức độ khó và chủ đề."""
    sm = get_session_manager()
    _validate_notebook_id(notebook_id)
    notebook = sm.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    select_notebook_documents(sm, notebook_id, payload.selected_documents)
    if sm.get_study_guide_status(notebook_id)["status"] == "generating":
        raise HTTPException(status_code=409, detail="Cẩm nang đang được tạo. Vui lòng chờ hoàn tất trước khi tạo lại.")
    generation_id = queue_study_guide(background_tasks, sm, notebook_id, **payload.model_dump())
    return {
        "status": "processing",
        "generation_id": generation_id,
        "message": f"Đang tạo cẩm nang học tập ({payload.quiz_count} câu hỏi, {payload.flashcards_count} thẻ, mức {payload.difficulty}) trong nền..."
    }

@router.post("/api/evaluate")
async def evaluate_knowledge(request: Request, notebook_id: Optional[str] = Form(None)):
    """Đánh giá trình độ người dùng qua lịch sử chat."""
    sm = get_session_manager()
    target_id = notebook_id
    if not target_id:
        try:
            body = await request.json()
            target_id = body.get("notebook_id")
        except Exception:
            pass

    if not target_id:
        raise HTTPException(status_code=400, detail="Thiếu notebook_id")
    _validate_notebook_id(target_id)

    notebook = sm.get_notebook(target_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
        
    provider, model_name, api_key, base_url, is_private = resolve_llm_config(notebook)
    llm = get_llm_engine()
    evaluator = Evaluator(llm, sm)
    
    try:
        metrics = await run_in_threadpool(
            evaluator.evaluate_knowledge,
            notebook_id=target_id, 
            is_private=is_private,
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url
        )
        return {"status": "success", "metrics": metrics}
    except Exception as e:
        logger.error(f"Lỗi evaluate: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Chưa thể đánh giá notebook vì dịch vụ AI gặp lỗi: {e}",
        ) from e

@router.get("/api/notebooks/{notebook_id}/srs")
def get_srs_status(notebook_id: str):
    """Lấy dữ liệu tiến độ ghi nhớ lặp lại ngắt quãng của flashcards."""
    _validate_notebook_id(notebook_id)
    sm = get_session_manager()
    if not sm.get_notebook(notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    return sm.get_srs_progress(notebook_id)

@router.post("/api/notebooks/{notebook_id}/srs/review")
def review_srs_card(notebook_id: str, payload: SrsReviewRequest):
    """Cập nhật đánh giá thẻ nhớ theo thuật toán SM-2."""
    _validate_notebook_id(notebook_id)
    if payload.card_index < 0 or payload.rating not in {1, 2, 3, 4}:
        raise HTTPException(status_code=422, detail="card_index phải không âm và rating phải từ 1 đến 4.")
    sm = get_session_manager()
    if not sm.get_notebook(notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    guide = sm.get_study_guide(notebook_id) or {}
    cards = guide.get("flashcards")
    if not isinstance(cards, list) or payload.card_index >= len(cards):
        raise HTTPException(status_code=404, detail="Thẻ nhớ không còn tồn tại. Vui lòng tải lại bộ thẻ.")
    res = sm.update_srs_progress(notebook_id, payload.card_index, payload.rating)
    return {"status": "success", "card": res}

@router.get("/api/notebooks/{notebook_id}/mindmap")
def get_mindmap_endpoint(notebook_id: str):
    """Lấy sơ đồ tư duy đã sinh."""
    _validate_notebook_id(notebook_id)
    sm = get_session_manager()
    sg = sm.get_study_guide(notebook_id)
    return {"mindmap": sg.get("mindmap") if sg else None}

@router.post("/api/notebooks/{notebook_id}/mindmap/generate")
async def generate_mindmap_endpoint(notebook_id: str, payload: MindmapRequest = MindmapRequest()):
    """Tạo mới sơ đồ tư duy từ tài liệu bằng LLM."""
    sm = get_session_manager()
    _validate_notebook_id(notebook_id)
    notebook = sm.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
        
    docs = select_notebook_documents(sm, notebook_id, payload.selected_documents)
    source_revision = sm.get_source_revision(notebook_id)

    try:
        vs = await run_in_threadpool(get_vector_store)
        all_text = await run_in_threadpool(collect_document_context, vs, notebook_id, docs, limit=12)

        provider, model_name, api_key, base_url, is_private = resolve_llm_config(notebook)
        llm = get_llm_engine()
        generator = MindmapGenerator(llm, sm)
        mindmap = await run_in_threadpool(
            generator.generate,
            notebook_id=notebook_id,
            context_text=all_text,
            focus_topic=payload.focus_topic,
            source_revision=source_revision,
            is_private=is_private,
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url
        )
        return {"status": "success", "mindmap": mindmap}
    except Exception as e:
        logger.error(f"Lỗi tạo Mindmap: {e}")
        raise HTTPException(status_code=400, detail=f"Không thể tạo sơ đồ tư duy: {str(e)}")

@router.get("/api/notebooks/{notebook_id}/timeline-outline")
def get_timeline_outline_endpoint(notebook_id: str):
    """Lấy dòng thời gian & dàn ý bài học đã lưu."""
    _validate_notebook_id(notebook_id)
    sm = get_session_manager()
    sg = sm.get_study_guide(notebook_id)
    return {"timeline_outline": sg.get("timeline_outline") if sg else None}

@router.post("/api/notebooks/{notebook_id}/timeline-outline/generate")
async def generate_timeline_outline_endpoint(notebook_id: str, payload: TimelineRequest = TimelineRequest()):
    """Trích xuất niên biểu Timeline & Dàn ý phân cấp bằng LLM."""
    sm = get_session_manager()
    _validate_notebook_id(notebook_id)
    notebook = sm.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    docs = select_notebook_documents(sm, notebook_id, payload.selected_documents)
    source_revision = sm.get_source_revision(notebook_id)

    try:
        vs = await run_in_threadpool(get_vector_store)
        all_text = await run_in_threadpool(collect_document_context, vs, notebook_id, docs, limit=12)

        provider, model_name, api_key, base_url, is_private = resolve_llm_config(notebook)
        llm = get_llm_engine()
        generator = TimelineOutlineGenerator(llm, sm)
        data = await run_in_threadpool(
            generator.generate,
            notebook_id=notebook_id,
            context_text=all_text,
            focus_topic=payload.focus_topic,
            source_revision=source_revision,
            is_private=is_private,
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url
        )
        return {"status": "success", "timeline_outline": data}
    except Exception as e:
        logger.error(f"Lỗi tạo Timeline: {e}")
        raise HTTPException(status_code=400, detail=f"Không thể trích xuất dòng thời gian & dàn ý: {str(e)}")

@router.get("/api/notebooks/{notebook_id}/notes")
def get_notebook_notes(notebook_id: str):
    """Lấy danh sách ghi chú đã ghim của sổ tay."""
    _validate_notebook_id(notebook_id)
    notes = _load_notes(notebook_id)
    return {"notes": notes}

@router.post("/api/notebooks/{notebook_id}/notes")
def create_notebook_note(notebook_id: str, payload: NoteItemRequest):
    """Thêm ghi chú mới vào sổ tay."""
    _validate_notebook_id(notebook_id)
    if not payload.content or not payload.content.strip():
        raise HTTPException(status_code=400, detail="Nội dung ghi chú không được để trống")
    notes = _load_notes(notebook_id)
    new_note = {
        "id": f"note_{int(time.time() * 1000)}",
        "title": payload.title.strip() if payload.title else "Ghi chú",
        "content": payload.content.strip(),
        "source": payload.source or "manual",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    notes.insert(0, new_note)
    _save_notes(notebook_id, notes)
    return {"message": "Đã lưu ghi chú thành công", "note": new_note, "notes": notes}

@router.delete("/api/notebooks/{notebook_id}/notes/{note_id}")
def delete_notebook_note(notebook_id: str, note_id: str):
    """Xóa một ghi chú theo id."""
    _validate_notebook_id(notebook_id)
    notes = _load_notes(notebook_id)
    new_notes = [n for n in notes if n.get("id") != note_id]
    _save_notes(notebook_id, new_notes)
    return {"message": "Đã xóa ghi chú", "notes": new_notes}

@router.post("/api/notebooks/{notebook_id}/notes/synthesize")
def synthesize_notebook_notes(notebook_id: str):
    """Tổng hợp tất cả các ghi chú đã ghim thành Báo cáo chuyên đề (Executive Synthesis Report)."""
    _validate_notebook_id(notebook_id)
    notes = _load_notes(notebook_id)
    if not notes or len(notes) < 2:
        raise HTTPException(status_code=400, detail="Cần ít nhất 2 ghi chú để tiến hành tổng hợp báo cáo.")
    
    engines = get_notebook_engines(notebook_id)
    llm = engines["llm"]
    llm_kwargs = dict(engines.get("llm_kwargs", {}))
    
    notes_context = "\n\n".join([
        f"--- GHI CHÚ #{i+1}: {n.get('title', 'Không đề')} ({n.get('created_at', '')}) ---\n{n.get('content', '')}"
        for i, n in enumerate(notes)
    ])
    
    prompt = f"""Dưới đây là tập hợp các ghi chú nghiên cứu được người dùng chọn lọc và ghim lại trong quá trình làm việc:

{notes_context}

Dựa trên toàn bộ các ghi chú này, hãy đóng vai một Chuyên gia phân tích và Nghiên cứu cao cấp (Senior Research Analyst). Hãy tổng hợp, liên kết và chuyển hóa các mẩu ghi chú rời rạc thành một BÁO CÁO TỔNG HỢP CHUYÊN ĐỀ (Executive Synthesis Report) hoàn chỉnh, sâu sắc và chuyên nghiệp.

Báo cáo cần trình bày bằng Markdown chuẩn với cấu trúc sau:
# 📑 BÁO CÁO TỔNG HỢP TRI THỨC NGHIÊN CỨU

## 1. 🎯 Tóm tắt Điều hành (Executive Summary)
- Tóm lược cô đọng các phát hiện cốt lõi từ các ghi chú.

## 2. 🔗 Phân tích Chủ đề & Liên kết Luận điểm (Key Themes & Connections)
- Tổng hợp các luận điểm chung, chỉ ra mối liên hệ hoặc mâu thuẫn giữa các ghi chú.

## 3. 💡 Phát hiện Chuyên sâu & Insight Mới (Key Insights & Revelations)
- Những đúc kết giá trị nhất rút ra từ sự kết hợp của các ghi chú này.

## 4. 🚀 Khuyến nghị & Kế hoạch Hành động (Next Actions & Recommendations)
- Các bước tiếp theo cần triển khai hoặc nghiên cứu thêm.

Hãy viết bằng tiếng Việt lưu loát, khoa học, định dạng tiêu đề, bullet points và bảng biểu nếu phù hợp."""

    system_prompt = (
        "Bạn là Senior Research Analyst kiêm Giám đốc Tri thức. "
        "Nhiệm vụ của bạn là tổng hợp các mẩu thông tin, ghi chú rời rạc thành báo cáo phân tích chiến lược, logic và sắc bén."
    )
    
    try:
        report = llm.generate_text(
            prompt=prompt,
            system_prompt=system_prompt,
            **llm_kwargs
        )
        return {
            "title": "Báo cáo Tổng hợp Ghi chú Nghiên cứu",
            "markdown": report,
            "notes_count": len(notes)
        }
    except Exception as e:
        logger.error(f"Lỗi khi tổng hợp ghi chú notebook {notebook_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Không thể tổng hợp báo cáo ghi chú: {str(e)}")
