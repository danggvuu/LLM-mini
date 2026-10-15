import logging
from typing import List, Dict, Any, Tuple, Optional
from ..ingestion.indexing import VectorStoreManager
from .hybrid_search import HybridSearcher
from .reranker import CrossEncoderReranker
from ..utils.config import settings

logger = logging.getLogger(__name__)

class SearchEngine:
    """
    Công cụ truy xuất dữ liệu thông minh kết hợp Hybrid Search (Vector + BM25)
    và Cross-Encoder Reranker.
    """
    def __init__(self, vector_store: VectorStoreManager):
        self.vector_store = vector_store
        self.hybrid_searcher = HybridSearcher(vector_store=vector_store)
        self.reranker = CrossEncoderReranker()

    def retrieve(
        self, 
        query: str, 
        notebook_id: str, 
        top_k: int = 5,
        selected_documents: Optional[List[str]] = None
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Tìm kiếm các đoạn văn bản liên quan qua Hybrid Search và định dạng Context cho LLM.
        Nếu selected_documents được truyền vào, chỉ lấy các đoạn thuộc về những tài liệu đó.
        """
        results = []
        try:
            # 1. Thử tìm kiếm kết hợp Hybrid (Qdrant + BM25)
            results = self.hybrid_searcher.search(
                query=query, 
                k=top_k * 3, 
                notebook_id=notebook_id
            )
        except Exception as e:
            logger.warning(f"Hybrid Search gặp sự cố ({e}), fallback sang Qdrant vector search...")

        # Nếu Hybrid không trả về kết quả hoặc lỗi, fallback sang Vector Search thuần
        if not results:
            try:
                results = self.vector_store.search(query, limit=top_k * 2, notebook_id=notebook_id)
            except Exception as e:
                logger.error(f"Lỗi Vector Store Search: {e}")
                results = []

        # Lọc theo danh sách tài liệu được chọn nếu người dùng chỉ định
        if selected_documents and len(selected_documents) > 0:
            sel_set = set(selected_documents)
            def _is_doc_selected(item):
                meta = item.get("metadata", {})
                fn = meta.get("filename") or meta.get("source_file") or meta.get("title") or meta.get("source_url")
                if not fn:
                    return False
                return fn in sel_set or any(s in str(fn) for s in sel_set)
            results = [r for r in results if _is_doc_selected(r)]

        if not results:
            if selected_documents:
                return "Không tìm thấy thông tin liên quan trong các tài liệu đã chọn làm ngữ cảnh.", []
            return "Không tìm thấy thông tin liên quan trong tài liệu.", []

        # 2. Rerank nếu có từ 3 kết quả trở lên
        try:
            if len(results) > top_k:
                results = self.reranker.rerank(query, results, top_k=top_k)
            else:
                results = results[:top_k]
        except Exception as e:
            logger.warning(f"Reranker bỏ qua: {e}")
            results = results[:top_k]

        # 3. Tạo ngữ cảnh định dạng cho LLM
        context_parts = []
        for i, res in enumerate(results):
            content = res.get("content", "")
            metadata = res.get("metadata", {})
            source = (
                metadata.get("filename") 
                or metadata.get("source_file") 
                or metadata.get("title") 
                or metadata.get("source_url") 
                or "Tài liệu"
            )
            heading = metadata.get("heading_level_1", "")
            heading_info = f" | {heading}" if heading else ""
            
            context_parts.append(f"[Source {i+1} - {source}{heading_info}]:\n{content}")
            
        return "\n\n---\n\n".join(context_parts), results
