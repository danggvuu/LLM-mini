from typing import Dict, Any, Optional
from src.llm.llm_client import LLMEngine
from src.retrieval.vector_store import VectorStoreManager
from src.utils.logger import logger


class CritiqueAndActionGenerator:
    """
    1. Phản biện chuyên sâu (Deep Critique / Peer Review)
    2. Kế hoạch hành động thực tiễn (Actionable Checklist & Roadmap)
    """
    def __init__(self, llm_engine: LLMEngine, vector_store: VectorStoreManager, notebook_id: str = "default"):
        self.llm = llm_engine
        self.store = vector_store
        self.notebook_id = notebook_id

    def _collect_context(self, source_filter: Optional[str] = None, max_chars: int = 16000) -> str:
        chunks = self.store.get_all_chunks(limit=250, notebook_id=self.notebook_id)
        if source_filter:
            chunks = [
                c for c in chunks 
                if c.get("metadata", {}).get("source") == source_filter 
                or c.get("metadata", {}).get("filename") == source_filter
                or c.get("metadata", {}).get("source_file") == source_filter
                or c.get("metadata", {}).get("title") == source_filter
            ]
        if not chunks:
            return ""

        text_parts = []
        total = 0
        for c in chunks:
            src = c.get("metadata", {}).get("source") or c.get("metadata", {}).get("filename", "Tài liệu")
            block = f"[Nguồn: {src}]\n{c.get('content', '')}\n\n"
            if total + len(block) > max_chars:
                break
            text_parts.append(block)
            total += len(block)
        return "".join(text_parts)

    def generate_critique(self, source_filter: Optional[str] = None) -> Dict[str, Any]:
        logger.info(f"Đang tạo Báo cáo Phản biện (Critique) (source={source_filter})")
        context = self._collect_context(source_filter)
        if not context:
            return {"error": "Chưa có tài liệu nào để phân tích phản biện."}

        prompt = f"""Bạn là một Chuyên gia Phản biện Học thuật & Phân tích Chiến lược (Peer Reviewer).
Dựa trên nội dung tài liệu dưới đây, hãy viết một **Báo cáo Phản biện & Đánh giá Chuyên sâu** bằng tiếng Việt (định dạng Markdown):

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
        if hasattr(self.llm, "generate_text"):
            res = self.llm.generate_text(prompt)
        else:
            chunks = self.llm.generate(prompt)
            res = "".join(chunks).strip() if hasattr(chunks, "__iter__") and not isinstance(chunks, str) else str(chunks)
        return {"content": res}

    def generate_action_plan(self, source_filter: Optional[str] = None) -> Dict[str, Any]:
        logger.info(f"Đang tạo Action Plan (source={source_filter})")
        context = self._collect_context(source_filter)
        if not context:
            return {"error": "Chưa có tài liệu nào để lập kế hoạch hành động."}

        prompt = f"""Bạn là Chuyên gia Tư vấn Triển khai Dự án.
Từ nội dung tài liệu dưới đây, hãy chuyển hóa toàn bộ kiến thức lý thuyết thành **Kế hoạch Hành động Thực tiễn (Action Plan)** bằng tiếng Việt (định dạng Markdown):

### 1. Mục tiêu Trọng tâm (Key Objectives)
- Tóm tắt 3 mục tiêu thực tiễn nhất rút ra từ tài liệu.

### 2. Bảng Phân bổ Hành động (Action Matrix)
Trình bày dưới dạng Bảng Markdown gồm các cột: `Giai đoạn` | `Hành động cụ thể` | `Đầu ra kỳ vọng (Deliverable)` | `Mức độ ưu tiên (Cao/TB/Thấp)`.

### 3. Danh sách Kiểm tra (Checklist Thực thi)
- [ ] Các bước chuẩn bị và kiểm chứng cụ thể để áp dụng ngay kiến thức trong tài liệu.

NỘI DUNG TÀI LIỆU:
{context}
"""
        if hasattr(self.llm, "generate_text"):
            res = self.llm.generate_text(prompt)
        else:
            chunks = self.llm.generate(prompt)
            res = "".join(chunks).strip() if hasattr(chunks, "__iter__") and not isinstance(chunks, str) else str(chunks)
        return {"content": res}
