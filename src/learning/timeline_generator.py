import re
import json
import logging
from typing import Optional, Dict, Any, List
from ..llm.llm_client import LLMEngine, validate_generated_text
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
        base_url: Optional[str] = None,
        source_revision: Optional[int] = None
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
        full_text = validate_generated_text("".join(chunks))
        
        cleaned = full_text
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()
            
        try:
            parsed = json.loads(cleaned)
        except ValueError:
            match = re.search(r'\{.*\}', cleaned, re.DOTALL)
            if not match:
                raise ValueError("AI không trả về JSON dòng thời gian và dàn ý hợp lệ.")
            parsed = json.loads(re.sub(r',\s*([\]\}])', r'\1', match.group(0)))
        if not isinstance(parsed, dict) or any(not isinstance(parsed.get(key), list) for key in ("timeline", "outline")):
            raise ValueError("Dòng thời gian và dàn ý phải là danh sách.")
        if not parsed["timeline"] and not parsed["outline"]:
            raise ValueError("AI trả về dòng thời gian và dàn ý rỗng.")
        for entry in parsed["timeline"]:
            if not isinstance(entry, dict) or any(not isinstance(entry.get(key), str) for key in ("period", "title", "description")):
                raise ValueError("Mốc thời gian không hợp lệ.")
        for section in parsed["outline"]:
            if not isinstance(section, dict) or not isinstance(section.get("title"), str) or not isinstance(section.get("subsections", []), list):
                raise ValueError("Phần dàn ý không hợp lệ.")
            if not isinstance(section.get("summary", ""), str):
                raise ValueError("Tóm tắt dàn ý không hợp lệ.")
            for subsection in section.get("subsections", []):
                if not isinstance(subsection, dict) or not isinstance(subsection.get("title"), str) or not isinstance(subsection.get("points", []), list) or any(not isinstance(point, str) for point in subsection.get("points", [])):
                    raise ValueError("Các ý chi tiết trong dàn ý không hợp lệ.")
        self.db.save_timeline_outline(notebook_id, parsed, source_revision=source_revision)
        return parsed
