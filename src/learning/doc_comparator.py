import logging
from typing import Optional, Dict, Any, List
from ..llm.llm_client import LLMEngine
from ..db.session_manager import SessionManager

logger = logging.getLogger(__name__)

class DocComparator:
    """So sánh và đối chiếu nội dung giữa các tài liệu trong Notebook."""
    def __init__(self, llm_engine: LLMEngine, session_manager: SessionManager):
        self.llm = llm_engine
        self.db = session_manager

    def compare(
        self,
        notebook_id: str,
        docs_data: List[Dict[str, str]], # [{"filename": "...", "text": "..."}]
        focus_topic: Optional[str] = "",
        is_private: bool = True,
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> str:
        """Sinh bài so sánh đối chiếu đa tài liệu dạng Markdown định dạng phong phú."""
        
        doc_sections = []
        for d in docs_data:
            fname = d.get("filename", "Tài liệu")
            # Limit each doc text to ~5000 chars to avoid exceeding context window
            text_snippet = d.get("text", "")[:5000]
            doc_sections.append(f"### [TÀI LIỆU: {fname}]\n{text_snippet}\n")
            
        combined_text = "\n".join(doc_sections)
        focus_str = f"\nƯU TIÊN SO SÁNH XOAY QUANH CHỦ ĐỀ: '{focus_topic}'." if focus_topic else ""

        prompt = f"""Bạn là một chuyên gia nghiên cứu tổng hợp và đối chiếu tài liệu học thuật.
Hãy phân tích, so sánh và đối chiếu các tài liệu sau đây:{focus_str}

{combined_text}

---
YÊU CẦU ĐẦU RA BẰNG MARKDOWN ĐẦY ĐỦ VÀ CHUYÊN NGHIỆP:
1. **Bảng so sánh tổng quan (Markdown Table)**: Các tiêu chí chính (Mục tiêu, Luận điểm chính, Phương pháp tiếp cận, Ưu điểm, Nhược điểm/Hạn chế).
2. **Điểm tương đồng cốt lõi (Similarities)**: Những nội dung, quan điểm hoặc kết luận mà các tài liệu đồng thuận.
3. **Điểm khác biệt & Bất đồng quan điểm (Differences & Contrasts)**: Sự khác nhau về góc nhìn, phạm vi, định nghĩa hoặc số liệu.
4. **Đánh giá phối hợp & Khuyến nghị (Synthesis & Takeaways)**: Cách kết hợp các tài liệu này để có góc nhìn toàn diện nhất.

Viết chi tiết, chuẩn văn phong tiếng Việt, sử dụng Markdown headers, bullet points và bảng rõ ràng.
"""
        chunks = list(self.llm.generate(
            prompt=prompt,
            system_prompt="Bạn là trợ lý so sánh đối chiếu tài liệu học thuật chuẩn xác và sâu sắc.",
            is_private=is_private,
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url
        ))
        
        return "".join(chunks).strip()
