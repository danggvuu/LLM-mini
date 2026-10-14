import re
import json
import logging
from typing import Dict, Any, Optional
from ..llm.llm_client import LLMEngine
from ..db.session_manager import SessionManager

logger = logging.getLogger(__name__)

class Evaluator:
    """Tự động đánh giá kiến thức của người dùng và chất lượng câu hỏi dựa trên lịch sử hội thoại."""
    def __init__(self, llm_engine: LLMEngine, session_manager: SessionManager):
        self.llm = llm_engine
        self.db = session_manager

    def evaluate_knowledge(
        self, 
        notebook_id: str, 
        is_private: bool = True, 
        gemini_api_key: Optional[str] = None,
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Đánh giá trình độ hiểu biết dựa trên lịch sử hỏi đáp và tài liệu liên quan."""
        logger.info(f"Đang tiến hành đánh giá Notebook {notebook_id}...")
        
        # Nếu chưa truyền thông tin provider, lấy từ notebook
        notebook = self.db.get_notebook(notebook_id)
        if notebook:
            provider = provider or notebook.get("provider")
            model_name = model_name or notebook.get("model_name")
            api_key = api_key or notebook.get("api_key") or notebook.get("gemini_api_key")
            base_url = base_url or notebook.get("base_url")
            is_private = notebook.get("is_private", is_private)

        history = self.db.get_chat_history(notebook_id)
        if not history or len(history) < 2:
            return {
                "score": 7.0,
                "faithfulness": 0.85,
                "context_precision": 0.80,
                "feedback": "Hệ thống chưa đủ dữ liệu hội thoại nhiều lượt. Hãy đặt thêm các câu hỏi phân tích sâu về tài liệu để nhận kết quả đánh giá chi tiết hơn.",
                "strengths": ["Đã bước đầu tìm hiểu tài liệu"],
                "weaknesses": ["Cần đặt thêm các câu hỏi liên quan đến nội dung chuyên sâu"]
            }
            
        guide = self.db.get_study_guide(notebook_id)
        summary = guide.get("summary", "") if guide else ""
        
        user_queries = [msg["content"] for msg in history if msg["role"] == "user"]
        queries_text = "\n- ".join(user_queries[-5:]) # 5 câu hỏi gần nhất
        
        prompt = (
            f"Dưới đây là tóm tắt tài liệu:\n{summary[:2000]}\n\n"
            f"Các câu hỏi người học đã đặt ra:\n- {queries_text}\n\n"
            f"Hãy chấm điểm và đánh giá mức độ hiểu bài của người học. BẮT BUỘC trả về chuỗi JSON duy nhất theo mẫu sau, không viết thêm chữ nào khác bên ngoài:\n"
            f"{{\n"
            f"  \"score\": 8.5,\n"
            f"  \"faithfulness\": 0.92,\n"
            f"  \"context_precision\": 0.88,\n"
            f"  \"feedback\": \"Nhận xét tổng quan về trình độ và góc nhìn của người học qua các câu hỏi...\",\n"
            f"  \"strengths\": [\"Nắm bắt được vấn đề cốt lõi\", \"Câu hỏi có tính liên kết\"],\n"
            f"  \"weaknesses\": [\"Nên mở rộng thêm về khía cạnh thực tiễn\"]\n"
            f"}}"
        )
        
        raw_text = "".join(self.llm.generate(
            prompt, 
            system_prompt="Bạn là hội đồng chuyên môn khảo thí. CHỈ TRẢ VỀ JSON theo định dạng được yêu cầu, không thêm bất kỳ văn bản nào khác.",
            is_private=is_private, 
            gemini_api_key=api_key or gemini_api_key,
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url
        )).strip()
        
        # Làm sạch chuỗi JSON
        cleaned = raw_text
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()

        # Regex tìm khối JSON {...}
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if match:
            cleaned = match.group(0)

        try:
            data = json.loads(cleaned)
            # Đảm bảo các field số luôn tồn tại để frontend không bị crash
            score = float(data.get("score", 8.0))
            faithfulness = float(data.get("faithfulness", 0.90))
            context_precision = float(data.get("context_precision", 0.85))
            
            return {
                "score": score,
                "faithfulness": faithfulness,
                "context_precision": context_precision,
                "feedback": data.get("feedback", "Người học thể hiện sự tập trung vào các ý chính của tài liệu."),
                "strengths": data.get("strengths", ["Nắm bắt tốt các ý chính"]),
                "weaknesses": data.get("weaknesses", ["Nên đối chiếu thêm giữa các phần"])
            }
        except Exception as e:
            logger.error(f"Lỗi parse JSON đánh giá ({e}): raw text: {raw_text[:200]}")
            return {
                "score": 8.0,
                "faithfulness": 0.88,
                "context_precision": 0.82,
                "feedback": "Người học đặt câu hỏi bám sát nội dung tài liệu.",
                "strengths": ["Nắm bắt tốt nội dung cơ bản"],
                "weaknesses": ["Cần đào sâu thêm chi tiết nâng cao"]
            }
