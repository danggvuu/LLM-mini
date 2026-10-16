from typing import Dict, Any, Optional, List
from src.llm.llm_client import LLMEngine
from src.ingestion.indexing import VectorStoreManager
from src.utils.logger import logger


class CritiqueAndActionGenerator:
    """
    1. Phản biện chuyên sâu (Deep Critique / Peer Review)
    2. Kế hoạch hành động thực tiễn (Actionable Checklist & Roadmap)
    """
    def __init__(
        self,
        llm_engine: LLMEngine,
        vector_store: VectorStoreManager,
        session_manager=None,
        notebook_id: str = "default"
    ):
        self.llm = llm_engine
        self.store = vector_store
        self.sm = session_manager
        self.notebook_id = notebook_id

    def _collect_context(
        self,
        source_filter: Optional[str] = None,
        selected_documents: Optional[List[str]] = None,
        max_chars: int = 16000
    ) -> str:
        text_parts = []
        total = 0

        # Ưu tiên 1: Lấy theo danh sách tài liệu của sổ tay thông qua get_chunks_by_document
        target_filenames = []
        if selected_documents and len(selected_documents) > 0:
            target_filenames = list(selected_documents)
        elif source_filter:
            target_filenames = [source_filter]
        elif self.sm is not None:
            docs = self.sm.get_documents(self.notebook_id) or []
            target_filenames = [d.get("filename") for d in docs if d.get("filename")]

        if target_filenames and hasattr(self.store, "get_chunks_by_document"):
            for fname in target_filenames:
                raw_chunks = self.store.get_chunks_by_document(self.notebook_id, fname, limit=20)
                for ch_text in raw_chunks:
                    if not ch_text:
                        continue
                    block = f"[Nguồn: {fname}]\n{ch_text}\n\n"
                    if total + len(block) > max_chars:
                        break
                    text_parts.append(block)
                    total += len(block)
                if total >= max_chars:
                    break

        # Ưu tiên 2: Fallback sang get_all_chunks nếu có
        if not text_parts and hasattr(self.store, "get_all_chunks"):
            chunks = self.store.get_all_chunks(limit=250, notebook_id=self.notebook_id)
            for c in chunks:
                meta = c.get("metadata", {})
                src = meta.get("filename") or meta.get("source") or meta.get("source_file") or "Tài liệu"
                if selected_documents and src not in selected_documents:
                    continue
                if source_filter and src != source_filter:
                    continue
                block = f"[Nguồn: {src}]\n{c.get('content', '')}\n\n"
                if total + len(block) > max_chars:
                    break
                text_parts.append(block)
                total += len(block)

        # Ưu tiên 3: Fallback sang bản tóm tắt Study Guide nếu Vector Store chưa trả kết quả
        if not text_parts and self.sm is not None:
            sg = self.sm.get_study_guide(self.notebook_id)
            if sg and (sg.get("summary") or sg.get("faq")):
                return f"Tóm tắt tài liệu:\n{sg.get('summary', '')}\n\nCâu hỏi trọng tâm:\n{sg.get('faq', '')}"

        return "".join(text_parts)

    def _call_llm(self, prompt: str, system_prompt: str, llm_kwargs: Dict[str, Any]) -> str:
        gen = self.llm.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            **llm_kwargs
        )
        if hasattr(gen, "__iter__") and not isinstance(gen, str):
            return "".join(gen).strip()
        return str(gen).strip()

    def generate_critique(
        self,
        source_filter: Optional[str] = None,
        selected_documents: Optional[List[str]] = None,
        **llm_kwargs
    ) -> Dict[str, Any]:
        logger.info(f"Đang tạo Báo cáo Phản biện (nb={self.notebook_id}, selected={selected_documents})")
        context = self._collect_context(source_filter=source_filter, selected_documents=selected_documents)
        if not context.strip():
            return {"error": "Chưa có tài liệu nào được chọn hoặc nạp vào sổ tay để phân tích phản biện."}

        system_prompt = "Bạn là Chuyên gia Phản biện Học thuật & Phân tích Chiến lược (Peer Reviewer) sắc bén, khách quan."
        prompt = f"""Dựa trên nội dung tài liệu dưới đây, hãy viết một **Báo cáo Phản biện & Đánh giá Chuyên sâu** bằng tiếng Việt (định dạng Markdown):

### 1. Điểm mạnh & Giá trị cốt lõi (Strengths)
- Những luận điểm, dữ liệu hoặc phương pháp nào được trình bày thuyết phục nhất?

### 2. Lỗ hổng Lập luận & Điểm mù (Blind Spots & Limitations)
- Những khía cạnh nào chưa được giải thích rõ, thiếu bằng chứng thực nghiệm hoặc mới chỉ dừng ở giả định?
- Có rủi ro hay trường hợp ngoại lệ (edge cases) nào bị bỏ qua không?

### 3. Góc nhìn Phản biện (Counter-Arguments)
- Nếu đứng ở góc nhìn đối lập hoặc thực tế triển khai, người đọc cần đặt ra 3-5 câu hỏi chất vấn sắc bén nào?

### 4. Đề xuất Nâng cấp / Bổ sung
- Cần bổ sung thêm dữ liệu, dẫn chứng hay bước kiểm chứng nào để tài liệu hoàn chỉnh hơn?

NỘI DUNG TÀI LIỆU:
{context}
"""
        res = self._call_llm(prompt, system_prompt, llm_kwargs)
        return {"content": res}

    def generate_action_plan(
        self,
        source_filter: Optional[str] = None,
        selected_documents: Optional[List[str]] = None,
        **llm_kwargs
    ) -> Dict[str, Any]:
        logger.info(f"Đang tạo Action Plan (nb={self.notebook_id}, selected={selected_documents})")
        context = self._collect_context(source_filter=source_filter, selected_documents=selected_documents)
        if not context.strip():
            return {"error": "Chưa có tài liệu nào được chọn hoặc nạp vào sổ tay để lập kế hoạch hành động."}

        system_prompt = "Bạn là Chuyên gia Tư vấn Quản trị & Triển khai Dự án thực tiễn."
        prompt = f"""Từ nội dung tài liệu dưới đây, hãy chuyển hóa toàn bộ kiến thức lý thuyết thành **Kế hoạch Hành động Thực tiễn (Action Plan)** bằng tiếng Việt (định dạng Markdown):

### 1. Mục tiêu Trọng tâm (Key Objectives)
- Tóm tắt 3 mục tiêu thực tiễn nhất rút ra từ tài liệu.

### 2. Bảng Phân bổ Hành động (Action Matrix)
Trình bày dưới dạng Bảng Markdown gồm các cột: `Giai đoạn` | `Hành động cụ thể` | `Đầu ra kỳ vọng (Deliverable)` | `Mức độ ưu tiên (Cao/TB/Thấp)`.

### 3. Danh sách Kiểm tra (Checklist Thực thi)
- [ ] Các bước chuẩn bị và kiểm chứng cụ thể để áp dụng ngay kiến thức trong tài liệu.

NỘI DUNG TÀI LIỆU:
{context}
"""
        res = self._call_llm(prompt, system_prompt, llm_kwargs)
        return {"content": res}
