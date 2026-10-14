import re
import json
import logging
from typing import Optional, Dict, Any
from ..llm.llm_client import LLMEngine
from ..db.session_manager import SessionManager

logger = logging.getLogger(__name__)

class GuideGenerator:
    """Tự động sinh Study Guide (Cẩm nang học tập, Quiz, Flashcards) từ tài liệu."""
    def __init__(self, llm_engine: LLMEngine, session_manager: SessionManager):
        self.llm = llm_engine
        self.db = session_manager

    def _extract_json_array(self, text: str) -> Optional[list]:
        """Trích xuất mảng JSON an toàn bằng regex."""
        cleaned = text.strip()
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()

        match = re.search(r'\[.*\]', cleaned, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(0))
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict) and "items" in parsed:
                return parsed["items"]
        except Exception:
            pass
        return None

    def generate(
        self, 
        notebook_id: str, 
        document_text: str, 
        is_private: bool = True, 
        gemini_api_key: Optional[str] = None,
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None
    ):
        """Hàm chạy ngầm để sinh và lưu Study Guide."""
        logger.info(f"Bắt đầu sinh Study Guide cho Notebook {notebook_id}...")
        
        # Nếu chưa truyền thông tin provider, lấy từ notebook
        notebook = self.db.get_notebook(notebook_id)
        if notebook:
            provider = provider or notebook.get("provider")
            model_name = model_name or notebook.get("model_name")
            api_key = api_key or notebook.get("api_key") or notebook.get("gemini_api_key")
            base_url = base_url or notebook.get("base_url")
            is_private = notebook.get("is_private", is_private)

        context = document_text[:8000]

        llm_kwargs = {
            "is_private": is_private,
            "gemini_api_key": api_key or gemini_api_key,
            "provider": provider,
            "model_name": model_name,
            "api_key": api_key,
            "base_url": base_url
        }

        try:
            # 1. Sinh Tóm tắt (Summary)
            summary_prompt = f"Dựa vào tài liệu sau, hãy viết một bản tóm tắt ngắn gọn và súc tích (khoảng 3-5 đoạn) bằng tiếng Việt:\n\n{context}"
            summary = "".join(self.llm.generate(
                summary_prompt, 
                system_prompt="Bạn là chuyên gia phân tích tài liệu và sư phạm học tập.",
                **llm_kwargs
            )).strip()
            if not summary or summary.startswith("⚠️"):
                summary = "Tài liệu đã được nạp thành công vào hệ thống. Bạn có thể bắt đầu đặt câu hỏi trong phòng Chat."

            # 2. Sinh FAQ
            faq_prompt = f"Dựa vào tài liệu sau, hãy tạo ra 3-4 câu hỏi thường gặp (FAQ) và câu trả lời súc tích bằng tiếng Việt:\n\n{context}"
            faq = "".join(self.llm.generate(
                faq_prompt, 
                system_prompt="Bạn là giáo viên thiết kế cẩm nang học tập.",
                **llm_kwargs
            )).strip()
            if not faq or faq.startswith("⚠️"):
                faq = "Q: Tài liệu này nói về điều gì?\nA: Tài liệu chứa các thông tin kiến thức do bạn cung cấp. Hãy hỏi trợ lý để được giải đáp chi tiết."

            # 3. Sinh Glossary
            glossary_prompt = f"Dựa vào tài liệu sau, hãy trích xuất 3-5 thuật ngữ hoặc khái niệm chính và giải thích ngắn gọn bằng tiếng Việt:\n\n{context}"
            glossary = "".join(self.llm.generate(
                glossary_prompt, 
                system_prompt="Bạn là chuyên gia từ điển học.",
                **llm_kwargs
            )).strip()

            # 4. Sinh Quiz
            quiz_prompt = (
                f"Dựa vào tài liệu sau, hãy tạo ra 4-5 câu hỏi trắc nghiệm tiếng Việt ôn tập. "
                f"Định dạng trả về BẮT BUỘC là JSON array các câu hỏi, KHÔNG CÓ BẤT KỲ VĂN BẢN NÀO NGOÀI JSON.\n"
                f"Mỗi phần tử có cấu trúc:\n"
                f"[\n"
                f"  {{\"question\": \"Câu hỏi...\", \"options\": [\"Đáp án A\", \"Đáp án B\", \"Đáp án C\", \"Đáp án D\"], \"answer\": 0}}\n"
                f"]\n\n"
                f"Tài liệu:\n{context}"
            )
            quiz_raw = "".join(self.llm.generate(
                quiz_prompt, 
                system_prompt="Bạn là giáo viên ra đề trắc nghiệm. CHỈ TRẢ VỀ JSON array [ ... ]. Không thêm lời chào.",
                **llm_kwargs
            )).strip()
            
            quiz_data = self._extract_json_array(quiz_raw)
            if not quiz_data:
                # Fallback quiz mẫu nếu parse không thành công để UI vẫn có quiz tương tác
                quiz_data = [
                    {
                        "question": "Nội dung chính được đề cập trong tài liệu này là gì?",
                        "options": ["Kiến thức chuyên môn trong tài liệu", "Lập trình web cơ bản", "Toán học nâng cao", "Lịch sử thế giới"],
                        "answer": 0
                    },
                    {
                        "question": "Trợ lý NotebookLM Mini hỗ trợ những tính năng nào?",
                        "options": ["Chỉ đọc văn bản", "Hỏi đáp, tóm tắt, tạo Quiz và thẻ nhớ", "Chỉ tạo nhạc", "Chỉ gửi email"],
                        "answer": 1
                    }
                ]

            # 5. Sinh Flashcards
            flashcard_prompt = (
                f"Dựa vào tài liệu sau, hãy tạo ra 4-5 thẻ nhớ (flashcard) tiếng Việt. "
                f"Định dạng trả về BẮT BUỘC là JSON array, KHÔNG CÓ BẤT KỲ VĂN BẢN NÀO NGOÀI JSON.\n"
                f"Mỗi phần tử có cấu trúc:\n"
                f"[\n"
                f"  {{\"front\": \"Khái niệm hoặc câu hỏi\", \"back\": \"Định nghĩa hoặc câu trả lời tóm tắt\"}}\n"
                f"]\n\n"
                f"Tài liệu:\n{context}"
            )
            flashcards_raw = "".join(self.llm.generate(
                flashcard_prompt, 
                system_prompt="Bạn là giáo viên tạo flashcards. CHỈ TRẢ VỀ JSON array [ ... ]. Không thêm lời chào.",
                **llm_kwargs
            )).strip()
            
            flashcards_data = self._extract_json_array(flashcards_raw)
            if not flashcards_data:
                # Fallback flashcards mẫu
                flashcards_data = [
                    {
                        "front": "Mục tiêu tài liệu",
                        "back": "Cung cấp các thông tin và kiến thức cốt lõi cho người đọc."
                    },
                    {
                        "front": "NotebookLM Mini",
                        "back": "Hệ thống trợ lý học tập cá nhân hỗ trợ RAG và Local AI."
                    }
                ]

            # Lưu vào Database
            self.db.save_study_guide(notebook_id, summary, faq, glossary, quiz=quiz_data, flashcards=flashcards_data)
            logger.info(f"Hoàn thành sinh Study Guide cho {notebook_id}.")

        except Exception as e:
            logger.error(f"Lỗi khi sinh Study Guide: {e}")
            self.db.save_study_guide(
                notebook_id, 
                f"Tài liệu đã được nạp. Lỗi tạo bản tóm tắt tự động: {str(e)}", 
                "Hãy hỏi trực tiếp trong phòng Chat.", 
                "N/A", 
                quiz=[{"question": "Tài liệu đã được tải lên thành công?", "options": ["Đúng", "Sai"], "answer": 0}], 
                flashcards=[{"front": "Tài liệu", "back": "Đã lưu vào bộ nhớ vector của sổ tay."}]
            )
