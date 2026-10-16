import os
import json
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
                try:
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
                except Exception as e:
                    logger.warning(f"Lỗi lấy chunks cho file {fname}: {e}")

        # Ưu tiên 2: Fallback trực tiếp vào kho chỉ mục BM25 (storage/bm25/{notebook_id}/bm25_docs.json)
        if not text_parts:
            bm25_path = os.path.join("storage", "bm25", str(self.notebook_id), "bm25_docs.json")
            if os.path.exists(bm25_path):
                try:
                    with open(bm25_path, "r", encoding="utf-8") as f:
                        b_docs = json.load(f)
                    for item in b_docs:
                        meta = item.get("metadata", {})
                        src = meta.get("filename") or meta.get("source_file") or meta.get("source") or meta.get("title") or "Tài liệu"
                        if selected_documents and src not in selected_documents and os.path.basename(str(src)) not in [os.path.basename(s) for s in selected_documents]:
                            continue
                        if source_filter and src != source_filter and os.path.basename(str(src)) != os.path.basename(source_filter):
                            continue
                        txt = item.get("text", "")
                        if txt and txt.strip():
                            block = f"[Nguồn: {src}]\n{txt}\n\n"
                            if total + len(block) > max_chars:
                                break
                            text_parts.append(block)
                            total += len(block)
                except Exception as be:
                    logger.warning(f"Lỗi đọc BM25 docs cache trong CritiqueGenerator: {be}")

        # Ưu tiên 3: Fallback sang get_all_chunks nếu có
        if not text_parts and hasattr(self.store, "get_all_chunks"):
            try:
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
            except Exception as e:
                logger.warning(f"Lỗi get_all_chunks trong CritiqueGenerator: {e}")

        # Ưu tiên 4: Fallback sang bản tóm tắt Study Guide nếu Vector Store & BM25 chưa trả kết quả
        if not text_parts and self.sm is not None:
            try:
                sg = self.sm.get_study_guide(self.notebook_id)
                if sg and (sg.get("summary") or sg.get("faq")):
                    return f"Tóm tắt tài liệu:\n{sg.get('summary', '')}\n\nCâu hỏi trọng tâm:\n{sg.get('faq', '')}"
            except Exception as e:
                logger.warning(f"Lỗi đọc study guide trong CritiqueGenerator: {e}")

        # Ưu tiên 5: Fallback đọc trực tiếp file từ uploads/
        if not text_parts and self.sm is not None:
            try:
                docs = self.sm.get_documents(self.notebook_id) or []
                for d in docs:
                    fn = d.get("filename")
                    up_file = os.path.join("uploads", fn) if fn else None
                    if up_file and os.path.exists(up_file):
                        ext = os.path.splitext(fn)[1].lower()
                        if ext in ['.txt', '.md', '.json', '.csv', '.html']:
                            with open(up_file, "r", encoding="utf-8", errors="ignore") as f:
                                text_parts.append(f"[Nguồn: {fn}]\n{f.read()[:max_chars]}\n\n")
                                break
                        else:
                            from src.ingestion.parsers.markitdown_parser import MarkItDownParser
                            tree = MarkItDownParser().parse(up_file)
                            if tree and tree.content:
                                text_parts.append(f"[Nguồn: {fn}]\n{tree.content[:max_chars]}\n\n")
                                break
            except Exception as e:
                logger.warning(f"Lỗi đọc trực tiếp file uploads trong CritiqueGenerator: {e}")

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
