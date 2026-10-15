import re
import json
import logging
from typing import Optional, Dict, Any, List
from ..llm.llm_client import LLMEngine
from ..db.session_manager import SessionManager

logger = logging.getLogger(__name__)

class TimelineOutlineGenerator:
    """Tự động sinh Dòng thời gian (Timeline) và Dàn ý phân cấp (Hierarchical Outline) từ tài liệu."""
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
        """Sinh cả Timeline và Dàn ý Outline có cấu trúc."""
        topic_instruction = f"\nƯu tiên chủ đề: '{focus_topic}'." if focus_topic else ""

        prompt = f"""Dựa vào nội dung tài liệu dưới đây, hãy trích xuất:
1. Dòng thời gian / Các mốc tiến trình logic (Timeline milestones)
2. Dàn bài phân cấp cấu trúc tài liệu (Detailed Outline){topic_instruction}

TÀI LIỆU:
{context_text[:12000]}

YÊU CẦU ĐẦU RA BẮT BUỘC:
Trả về DUY NHẤT một chuỗi JSON hợp lệ không kèm giải thích ngoài lề, có cấu trúc như sau:
{{
  "timeline": [
    {{
      "period": "Giai đoạn 1 / Mốc thời gian hoặc Bước 1",
      "title": "Tiêu đề mốc",
      "description": "Mô tả sự kiện, quá trình hoặc nội dung chính diễn ra ở bước này.",
      "tag": "Khởi đầu / Cốt lõi / Kết quả"
    }},
    {{
      "period": "Bước 2",
      "title": "Tiêu đề mốc tiếp theo",
      "description": "Chi tiết diễn biến hoặc cơ chế.",
      "tag": "Thực hiện"
    }}
  ],
  "outline": [
    {{
      "id": "1",
      "title": "I. Tên Phần lớn hoặc Chủ đề trọng điểm",
      "summary": "Tóm lược nội dung phần này",
      "subsections": [
        {{
          "id": "1.1",
          "title": "1. Khái niệm / Cơ sở lý thuyết",
          "points": [
            "Điểm then chốt a",
            "Điểm then chốt b"
          ]
        }},
        {{
          "id": "1.2",
          "title": "2. Nguyên lý hoạt động",
          "points": [
            "Cơ chế vận hành"
          ]
        }}
      ]
    }}
  ]
}}
Hãy cung cấp từ 4-8 mốc timeline và dàn ý 3-5 phần rõ ràng. Sử dụng tiếng Việt chuẩn mực.
"""
        chunks = list(self.llm.generate(
            prompt=prompt,
            system_prompt="Bạn là trợ lý học thuật chuyên tóm tắt, xây dựng niên biểu timeline và dàn ý cấu trúc tài liệu.",
            is_private=is_private,
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url
        ))
        full_text = "".join(chunks).strip()
        
        cleaned = full_text
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()
            
        try:
            parsed = json.loads(cleaned)
            self.db.save_timeline_outline(notebook_id, parsed)
            return parsed
        except Exception:
            match = re.search(r'\{.*\}', cleaned, re.DOTALL)
            if match:
                try:
                    fixed = re.sub(r',\s*([\]\}])', r'\1', match.group(0))
                    parsed = json.loads(fixed)
                    self.db.save_timeline_outline(notebook_id, parsed)
                    return parsed
                except Exception:
                    pass
            
            # Fallback data
            fallback = {
                "timeline": [
                    {
                        "period": "Bước 1",
                        "title": "Tiếp cận và Khởi tạo",
                        "description": "Nắm bắt các khái niệm định nghĩa ban đầu của tài liệu.",
                        "tag": "Cơ bản"
                    },
                    {
                        "period": "Bước 2",
                        "title": "Triển khai & Phân tích",
                        "description": "Khám phá các khía cạnh chuyên sâu và kỹ thuật cụ thể.",
                        "tag": "Nâng cao"
                    },
                    {
                        "period": "Bước 3",
                        "title": "Tổng kết & Đánh giá",
                        "description": "Đúc kết kinh nghiệm và ứng dụng vào bài toán thực tiễn.",
                        "tag": "Kết quả"
                    }
                ],
                "outline": [
                    {
                        "id": "1",
                        "title": "Phần I: Tổng quan tài liệu",
                        "summary": "Nền tảng kiến thức và mục tiêu cốt lõi",
                        "subsections": [
                            {"id": "1.1", "title": "Bối cảnh & Giới thiệu", "points": ["Định nghĩa cốt lõi", "Ý nghĩa nghiên cứu"]}
                        ]
                    },
                    {
                        "id": "2",
                        "title": "Phần II: Phân tích chi tiết",
                        "summary": "Các luận điểm và phương pháp",
                        "subsections": [
                            {"id": "2.1", "title": "Quy trình thực hiện", "points": ["Các bước vận hành", "Những điểm cần lưu tâm"]}
                        ]
                    }
                ]
            }
            self.db.save_timeline_outline(notebook_id, fallback)
            return fallback
