import re
import json
import logging
from typing import Optional, Dict, Any
from ..llm.llm_client import LLMEngine, validate_generated_text
from ..db.session_manager import SessionManager

logger = logging.getLogger(__name__)

class GuideGenerator:
    """Tự động sinh Study Guide (Cẩm nang học tập, Quiz, Flashcards) từ tài liệu."""
    def __init__(self, llm_engine: LLMEngine, session_manager: SessionManager):
        self.llm = llm_engine
        self.db = session_manager

    def _extract_json_array(self, text: str) -> Optional[list]:
        """Trích xuất mảng JSON an toàn bằng regex và dọn dẹp lỗi cú pháp thường gặp."""
        cleaned = text.strip()
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()

        # Thử parse toàn bộ chuỗi
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict):
                for key in ["items", "questions", "quiz", "flashcards", "data"]:
                    if key in parsed and isinstance(parsed[key], list):
                        return parsed[key]
        except Exception:
            pass

        # Tìm block mảng [ ... ]
        match = re.search(r'\[.*\]', cleaned, re.DOTALL)
        if match:
            raw_array = match.group(0)
            try:
                parsed = json.loads(raw_array)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                # Xử lý trailing commas: e.g. [..., {"a": 1}, ] -> loại bỏ dấu phẩy trước ] hoặc }
                cleaned_commas = re.sub(r',\s*([\]\}])', r'\1', raw_array)
                try:
                    parsed = json.loads(cleaned_commas)
                    if isinstance(parsed, list):
                        return parsed
                except Exception:
                    pass
        return None

    @staticmethod
    def _validate_quiz(items: Any) -> list:
        if not isinstance(items, list) or not items:
            raise ValueError("AI trả về bộ câu hỏi không hợp lệ. Vui lòng tạo lại.")
        validated = []
        for item in items:
            if not isinstance(item, dict) or not isinstance(item.get("question"), str) or not item["question"].strip():
                raise ValueError("Câu hỏi trắc nghiệm bị thiếu nội dung.")
            options = item.get("options")
            if not isinstance(options, list) or not 2 <= len(options) <= 6 or any(not isinstance(v, str) or not v.strip() for v in options):
                raise ValueError("Các lựa chọn trắc nghiệm không hợp lệ.")
            options = [v.strip() for v in options]
            answer = item.get("answer")
            if isinstance(answer, str):
                answer = answer.strip()
                if answer.isdigit():
                    answer = int(answer)
                elif len(answer) == 1 and answer.upper() in "ABCDEF":
                    answer = ord(answer.upper()) - ord("A")
                elif answer in options:
                    answer = options.index(answer)
            if type(answer) is not int or not 0 <= answer < len(options):
                raise ValueError("Đáp án trắc nghiệm phải là chỉ mục hợp lệ bắt đầu từ 0.")
            validated.append({**item, "question": item["question"].strip(), "options": options, "answer": answer})
        return validated

    @staticmethod
    def _validate_flashcards(items: Any) -> list:
        if not isinstance(items, list) or not items:
            raise ValueError("AI trả về bộ thẻ nhớ không hợp lệ. Vui lòng tạo lại.")
        for item in items:
            if not isinstance(item, dict) or any(not isinstance(item.get(key), str) or not item[key].strip() for key in ("front", "back")):
                raise ValueError("Thẻ nhớ phải có nội dung ở cả hai mặt.")
        return [{**item, "front": item["front"].strip(), "back": item["back"].strip()} for item in items]

    def generate(
        self, 
        notebook_id: str, 
        document_text: str, 
        is_private: bool = True, 
        gemini_api_key: Optional[str] = None,
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        quiz_count: int = 5,
        flashcards_count: int = 5,
        difficulty: str = "medium",
        focus_topic: Optional[str] = None,
        generation_id: Optional[str] = None
    ):
        """Hàm chạy ngầm để sinh và lưu Study Guide với các tùy chọn tùy biến."""
        generation_id = generation_id or self.db.start_study_guide_generation(notebook_id)
        quiz_count = max(1, min(int(quiz_count or 5), 30))
        flashcards_count = max(1, min(int(flashcards_count or 5), 50))
        difficulty = difficulty if difficulty in ["easy", "medium", "hard"] else "medium"
        focus_topic_str = focus_topic.strip() if focus_topic and focus_topic.strip() else None

        logger.info(
            f"Bắt đầu sinh Study Guide cho Notebook {notebook_id} "
            f"(Quiz: {quiz_count}, Flashcards: {flashcards_count}, Mức: {difficulty}, Focus: '{focus_topic_str}')..."
        )
        
        # Nếu chưa truyền thông tin provider, lấy từ notebook
        notebook = self.db.get_notebook(notebook_id)
        if notebook:
            provider = provider or notebook.get("provider")
            model_name = model_name or notebook.get("model_name")
            api_key = api_key or notebook.get("api_key") or notebook.get("gemini_api_key")
            base_url = base_url or notebook.get("base_url")
            is_private = notebook.get("is_private", is_private)

        context = document_text[:10000]

        llm_kwargs = {
            "is_private": is_private,
            "gemini_api_key": api_key or gemini_api_key,
            "provider": provider,
            "model_name": model_name,
            "api_key": api_key,
            "base_url": base_url
        }

        diff_map = {
            "easy": "Mức độ Cơ bản: Nhận biết khái niệm, định nghĩa và ý chính rõ ràng, dễ nhớ.",
            "medium": "Mức độ Trung bình: Kết hợp lý thuyết và câu hỏi vận dụng, kiểm tra mức độ hiểu sâu sắc.",
            "hard": "Mức độ Nâng cao: Câu hỏi phân tích, tình huống thực tế chuyên sâu, thử thách tư duy phản biện."
        }
        diff_text = diff_map.get(difficulty, diff_map["medium"])
        focus_prompt_clause = f"YÊU CẦU ĐẶC BIỆT: Hãy tập trung sâu vào nội dung / khía cạnh: '{focus_topic_str}'.\n" if focus_topic_str else ""

        try:
            if not context.strip():
                raise ValueError("Không tìm thấy nội dung tài liệu để tạo cẩm nang.")
            # 1. Sinh Tóm tắt (Summary)
            if focus_topic_str:
                summary_prompt = f"Dựa vào tài liệu sau, hãy viết một bản tóm tắt ngắn gọn (khoảng 3-4 đoạn) bằng tiếng Việt, đặc biệt làm nổi bật phần liên quan đến '{focus_topic_str}':\n\n{context}"
            else:
                summary_prompt = f"Dựa vào tài liệu sau, hãy viết một bản tóm tắt ngắn gọn và súc tích (khoảng 3-4 đoạn) bằng tiếng Việt:\n\n{context}"
            
            summary = "".join(self.llm.generate(
                summary_prompt, 
                system_prompt="Bạn là chuyên gia phân tích tài liệu và sư phạm học tập.",
                **llm_kwargs
            )).strip()
            summary = validate_generated_text(summary)

            # 2. Sinh FAQ
            if focus_topic_str:
                faq_prompt = f"Dựa vào tài liệu sau, hãy tạo ra 3-4 câu hỏi thường gặp (FAQ) và câu trả lời súc tích bằng tiếng Việt liên quan đến '{focus_topic_str}':\n\n{context}"
            else:
                faq_prompt = f"Dựa vào tài liệu sau, hãy tạo ra 3-4 câu hỏi thường gặp (FAQ) và câu trả lời súc tích bằng tiếng Việt:\n\n{context}"
            
            faq = "".join(self.llm.generate(
                faq_prompt, 
                system_prompt="Bạn là giáo viên thiết kế cẩm nang học tập.",
                **llm_kwargs
            )).strip()
            faq = validate_generated_text(faq)

            # 3. Sinh Glossary
            glossary_prompt = f"Dựa vào tài liệu sau, hãy trích xuất 3-5 thuật ngữ hoặc khái niệm chính và giải thích ngắn gọn bằng tiếng Việt:\n\n{context}"
            glossary = "".join(self.llm.generate(
                glossary_prompt, 
                system_prompt="Bạn là chuyên gia từ điển học.",
                **llm_kwargs
            )).strip()
            glossary = validate_generated_text(glossary)

            # 4. Sinh Quiz
            quiz_prompt = (
                f"Dựa vào tài liệu sau, hãy tạo ra CHÍNH XÁC {quiz_count} câu hỏi trắc nghiệm tiếng Việt ôn tập.\n"
                f"{focus_prompt_clause}"
                f"{diff_text}\n"
                f"Định dạng trả về BẮT BUỘC là JSON array gồm đúng {quiz_count} câu hỏi, KHÔNG CÓ BẤT KỲ VĂN BẢN NÀO NGOÀI JSON.\n"
                f"Mỗi phần tử có cấu trúc:\n"
                f"[\n"
                f"  {{\"question\": \"Nội dung câu hỏi...\", \"options\": [\"Đáp án A\", \"Đáp án B\", \"Đáp án C\", \"Đáp án D\"], \"answer\": 0}}\n"
                f"]\n\n"
                f"Lưu ý: 'answer' là số nguyên chỉ mục 0-indexed (0=A, 1=B, 2=C, 3=D) của đáp án đúng.\n\n"
                f"Tài liệu:\n{context}"
            )
            quiz_raw = "".join(self.llm.generate(
                quiz_prompt, 
                system_prompt=f"Bạn là giáo viên ra đề trắc nghiệm chuyên nghiệp. Tạo đúng {quiz_count} câu hỏi. CHỈ TRẢ VỀ JSON array [ ... ]. Tuyệt đối không thêm lời chào hay markdown thừa.",
                **llm_kwargs
            )).strip()
            
            quiz_data = self._validate_quiz(self._extract_json_array(validate_generated_text(quiz_raw)))[:quiz_count]

            # 5. Sinh Flashcards (Quizlet)
            flashcard_prompt = (
                f"Dựa vào tài liệu sau, hãy tạo ra CHÍNH XÁC {flashcards_count} thẻ nhớ (flashcards) tiếng Việt ôn tập theo phong cách Quizlet.\n"
                f"{focus_prompt_clause}"
                f"{diff_text}\n"
                f"Định dạng trả về BẮT BUỘC là JSON array gồm đúng {flashcards_count} thẻ, KHÔNG CÓ BẤT KỲ VĂN BẢN NÀO NGOÀI JSON.\n"
                f"Mỗi phần tử có cấu trúc:\n"
                f"[\n"
                f"  {{\"front\": \"Khái niệm, thuật ngữ hoặc câu hỏi ngắn\", \"back\": \"Định nghĩa, giải thích chi tiết hoặc câu trả lời tóm tắt\"}}\n"
                f"]\n\n"
                f"Tài liệu:\n{context}"
            )
            flashcards_raw = "".join(self.llm.generate(
                flashcard_prompt, 
                system_prompt=f"Bạn là giáo viên tạo thẻ nhớ Quizlet. Tạo đúng {flashcards_count} thẻ. CHỈ TRẢ VỀ JSON array [ ... ]. Tuyệt đối không thêm lời chào.",
                **llm_kwargs
            )).strip()
            
            flashcards_data = self._validate_flashcards(self._extract_json_array(validate_generated_text(flashcards_raw)))[:flashcards_count]

            # Lưu vào Database
            if not self.db.save_study_guide(notebook_id, summary, faq, glossary, quiz=quiz_data, flashcards=flashcards_data, generation_id=generation_id):
                logger.info("Bỏ qua cẩm nang cũ vì nguồn hoặc yêu cầu tạo đã thay đổi: %s", notebook_id)
                return
            logger.info(f"Hoàn thành sinh Study Guide cho {notebook_id} ({len(quiz_data)} quiz, {len(flashcards_data)} thẻ).")

        except Exception as e:
            logger.error(f"Lỗi khi sinh Study Guide: {e}")
            self.db.fail_study_guide_generation(notebook_id, generation_id, str(e))
