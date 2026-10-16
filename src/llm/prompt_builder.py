from typing import List, Dict, Any, Union


class PromptBuilder:
    """Xây dựng Prompt chuẩn mực có grounding ngữ cảnh cho RAG."""
    
    @staticmethod
    def build_rag_prompt(query: str, retrieved_chunks: List[Any]) -> str:
        context_parts = []
        for i, c in enumerate(retrieved_chunks, start=1):
            if isinstance(c, dict):
                content = c.get("content", "")
                src = c.get("metadata", {}).get("source") or c.get("metadata", {}).get("filename", "Tài liệu")
            else:
                content = getattr(c, "content", str(c))
                meta = getattr(c, "metadata", {})
                src = meta.get("source") or meta.get("filename", "Tài liệu")
            context_parts.append(f"[{i}] ({src}):\n{content}")
            
        context_str = "\n\n".join(context_parts) if context_parts else "Không tìm thấy ngữ cảnh nào."
        
        return f"""Bạn là trợ lý AI thông minh NotebookLM Mini. Nhiệm vụ của bạn là trả lời câu hỏi dựa trên các tài liệu đã được cung cấp.

TÀI LIỆU THAM KHẢO:
{context_str}

CÂU HỎI:
{query}

HƯỚNG DẪN TRẢ LỜI:
- Trả lời bằng tiếng Việt rõ ràng, mạch lạc, chính xác dựa trên tài liệu.
- Trích dẫn số hiệu nguồn như [1], [2] tương ứng với thông tin bạn sử dụng.
- Nếu tài liệu không chứa đủ thông tin, hãy nói rõ bạn không tìm thấy trong tài liệu.
"""
