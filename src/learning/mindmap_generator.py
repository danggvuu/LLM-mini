import re
import json
import logging
from typing import Optional, Dict, Any
from ..llm.llm_client import LLMEngine
from ..db.session_manager import SessionManager

logger = logging.getLogger(__name__)

class MindmapGenerator:
    """Tự động sinh cấu trúc Mindmap / Sơ đồ tri thức (Knowledge Graph) từ tài liệu."""
    def __init__(self, llm_engine: LLMEngine, session_manager: SessionManager):
        self.llm = llm_engine
        self.db = session_manager

    def generate(
        self,
        notebook_id: str,
        context_text: str,
        focus_topic: Optional[str] = "",
        is_private: bool = True,
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Sinh cây sơ đồ tư duy dạng JSON phân cấp."""
        topic_instruction = f"\nTẬP TRUNG ĐẶC BIỆT VÀO CHỦ ĐỀ: '{focus_topic}'." if focus_topic else ""

        prompt = f"""Dựa vào nội dung tài liệu dưới đây, hãy xây dựng một Sơ đồ tư duy (Mindmap / Knowledge Graph) phân cấp chi tiết.{topic_instruction}

TÀI LIỆU:
{context_text[:12000]}

YÊU CẦU ĐẦU RA BẮT BUỘC:
Trả về DUY NHẤT một đối tượng JSON hợp lệ (không kèm lời dẫn) theo cấu trúc cây phân cấp sau:
{{
  "id": "root",
  "name": "Tên chủ đề chính (Ngắn gọn, súc tích)",
  "desc": "Mô tả cốt lõi trong 1-2 câu",
  "children": [
    {{
      "id": "branch-1",
      "name": "Nhánh chính 1",
      "desc": "Giải thích tóm tắt nhánh này",
      "children": [
        {{
          "id": "sub-1-1",
          "name": "Khái niệm con 1.1",
          "desc": "Ý nghĩa, công thức hoặc định nghĩa ngắn gọn"
        }},
        {{
          "id": "sub-1-2",
          "name": "Khái niệm con 1.2",
          "desc": "Ý nghĩa hoặc chi tiết ngắn gọn"
        }}
      ]
    }},
    {{
      "id": "branch-2",
      "name": "Nhánh chính 2",
      "desc": "Giải thích tóm tắt nhánh này",
      "children": [
        {{
          "id": "sub-2-1",
          "name": "Khái niệm con 2.1",
          "desc": "Chi tiết ngắn gọn"
        }}
      ]
    }}
  ]
}}
Hãy tạo từ 3 đến 6 nhánh chính, mỗi nhánh có từ 2 đến 5 mục con. Sử dụng hoàn toàn tiếng Việt.
"""
        chunks = list(self.llm.generate(
            prompt=prompt,
            system_prompt="Bạn là chuyên gia sư phạm và trực quan hóa tư duy sơ đồ (Mind Mapping). Trả về JSON chuẩn xác.",
            is_private=is_private,
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url
        ))
        full_text = "".join(chunks).strip()
        
        # Clean json
        cleaned = full_text
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()
            
        try:
            parsed = json.loads(cleaned)
            self.db.save_mindmap(notebook_id, parsed)
            return parsed
        except Exception as e:
            # Fallback regex extraction
            match = re.search(r'\{.*\}', cleaned, re.DOTALL)
            if match:
                try:
                    fixed = re.sub(r',\s*([\]\}])', r'\1', match.group(0))
                    parsed = json.loads(fixed)
                    self.db.save_mindmap(notebook_id, parsed)
                    return parsed
                except Exception:
                    pass
            
            # Default fallback mindmap
            fallback = {
                "id": "root",
                "name": "Chủ đề Tài liệu",
                "desc": "Sơ đồ tự động tổng hợp từ tài liệu nghiên cứu",
                "children": [
                    {
                        "id": "b1",
                        "name": "Nội dung trọng tâm",
                        "desc": "Các luận điểm và khái niệm mấu chốt",
                        "children": [
                            {"id": "b1-1", "name": "Định nghĩa & Bản chất", "desc": "Cơ sở nền tảng"},
                            {"id": "b1-2", "name": "Đặc trưng nổi bật", "desc": "Điểm quan trọng cần ghi nhớ"}
                        ]
                    },
                    {
                        "id": "b2",
                        "name": "Ứng dụng & Thực tiễn",
                        "desc": "Cách áp dụng vào bài tập và thực tế",
                        "children": [
                            {"id": "b2-1", "name": "Ví dụ minh họa", "desc": "Tình huống áp dụng"},
                            {"id": "b2-2", "name": "Lưu ý thường gặp", "desc": "Các bẫy kiến thức cần tránh"}
                        ]
                    }
                ]
            }
            self.db.save_mindmap(notebook_id, fallback)
            return fallback
