import os
import uuid
import logging
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from ..utils.config import settings

logger = logging.getLogger(__name__)

class VectorStoreManager:
    """Quản lý việc lưu trữ Vector vào Qdrant Local và đồng bộ hóa BM25 Index."""
    
    def __init__(self, embedder=None, notebook_id: str = "default"):
        if embedder is None:
            from src.ingestion.embedding import LocalEmbedder
            embedder = LocalEmbedder()
        self.embedder = embedder
        self.notebook_id = notebook_id
        
        # Tạo thư mục chứa database nếu chưa có
        os.makedirs(settings.storage_dir, exist_ok=True)
        
        # Khởi tạo Qdrant Local Mode (Ghi trực tiếp ra ổ cứng, không cần Docker)
        self.client = QdrantClient(path=str(settings.storage_dir))
        self.collection_name = settings.qdrant_collection
        
        # Test 1 embedding để lấy vector size
        dummy_vector = self.embedder.embed_query("test")
        self.vector_size = len(dummy_vector)
        
        self._init_collection()

    def _init_collection(self):
        """Tạo collection nếu chưa tồn tại."""
        collections = self.client.get_collections().collections
        exists = any(c.name == self.collection_name for c in collections)
        
        if not exists:
            print(f"[Qdrant] Đang tạo Collection mới: {self.collection_name} (Size: {self.vector_size})")
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=self.vector_size, distance=Distance.COSINE),
            )
        else:
            print(f"[Qdrant] Đã kết nối tới Collection: {self.collection_name}")

    def clear_all(self):
        """Xóa toàn bộ dữ liệu trong collection hiện tại và khởi tạo lại."""
        try:
            self.client.delete_collection(collection_name=self.collection_name)
            self._init_collection()
            print(f"[Qdrant] Đã dọn dẹp toàn bộ dữ liệu trong collection {self.collection_name}")
        except Exception as e:
            logger.warning(f"Lỗi clear_all collection: {e}")

    def index_chunks(self, chunks: List[Any]):
        """Nhúng và lưu các đoạn văn bản vào Database, đồng thời cập nhật BM25."""
        if not chunks:
            return
            
        print(f"[Qdrant] Đang tính toán Vector cho {len(chunks)} đoạn văn bản...")
        texts = [chunk["content"] if isinstance(chunk, dict) else chunk.content for chunk in chunks]
        embeddings = self.embedder.embed_documents(texts)
        
        def _clean_meta(meta_dict):
            cleaned = {}
            for k, v in (meta_dict or {}).items():
                if isinstance(v, (str, int, float, bool)):
                    cleaned[k] = v
                elif isinstance(v, (list, tuple)):
                    cleaned[k] = [str(item) if not isinstance(item, (int, float, bool)) else item for item in v]
                else:
                    cleaned[k] = str(v)
            return cleaned

        points = []
        for i, chunk in enumerate(chunks):
            c_content = chunk["content"] if isinstance(chunk, dict) else chunk.content
            c_meta = chunk.get("metadata", {}) if isinstance(chunk, dict) else getattr(chunk, "metadata", {})
            c_id = (chunk.get("chunk_id") if isinstance(chunk, dict) else getattr(chunk, "chunk_id", None)) or str(uuid.uuid4())
            cleaned_payload = {
                "chunk_id": c_id,
                "content": str(c_content),
                "notebook_id": c_meta.get("notebook_id", self.notebook_id),
                **_clean_meta(c_meta)
            }
            point = PointStruct(
                id=c_id,
                vector=embeddings[i],
                payload=cleaned_payload
            )
            points.append(point)
            
        print(f"[Qdrant] Đang lưu {len(points)} Vectors vào Database (batching 200/lần)...")
        batch_size = 200
        for b_idx in range(0, len(points), batch_size):
            batch_points = points[b_idx:b_idx + batch_size]
            self.client.upsert(
                collection_name=self.collection_name,
                points=batch_points
            )
        print("[Qdrant] Lưu dữ liệu Vector hoàn tất!")

        # Đồng bộ hóa sang BM25 Index cho Hybrid Search
        try:
            from ..retrieval.bm25_index import get_bm25_index, BM25Document
            first_meta = chunks[0].get("metadata", {}) if isinstance(chunks[0], dict) else getattr(chunks[0], "metadata", {})
            notebook_id = first_meta.get("notebook_id", self.notebook_id)
            bm25 = get_bm25_index(notebook_id)
            bm25_docs = [
                BM25Document(
                    chunk_id=points[i].id,
                    text=chunks[i]["content"] if isinstance(chunks[i], dict) else chunks[i].content,
                    metadata=chunks[i].get("metadata", {}) if isinstance(chunks[i], dict) else getattr(chunks[i], "metadata", {})
                )
                for i in range(len(chunks))
            ]
            bm25.add_documents(bm25_docs)
            bm25.save()
            print(f"[BM25] Đã đồng bộ {len(bm25_docs)} chunks vào chỉ mục từ khóa.")
        except Exception as e:
            logger.warning(f"Lỗi đồng bộ BM25 Index: {e}")

    def delete_notebook_chunks(self, notebook_id: str):
        """Xóa tất cả các chunk thuộc về một notebook."""
        from qdrant_client.http.models import Filter, FieldCondition, MatchValue
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="notebook_id",
                        match=MatchValue(value=notebook_id)
                    )
                ]
            )
        )
        try:
            from ..retrieval.bm25_index import delete_bm25_folder
            delete_bm25_folder(notebook_id)
        except Exception as e:
            logger.warning(f"Lỗi xóa BM25 folder: {e}")

    def delete_document_chunks(self, notebook_id: str, filename: str):
        """Xóa tất cả các chunk thuộc về một tài liệu trong notebook."""
        from qdrant_client.http.models import Filter, FieldCondition, MatchValue
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=Filter(
                must=[
                    FieldCondition(key="notebook_id", match=MatchValue(value=notebook_id))
                ],
                should=[
                    FieldCondition(key="filename", match=MatchValue(value=filename)),
                    FieldCondition(key="source_file", match=MatchValue(value=filename)),
                    FieldCondition(key="title", match=MatchValue(value=filename)),
                    FieldCondition(key="source_url", match=MatchValue(value=filename)),
                    FieldCondition(key="source", match=MatchValue(value=filename))
                ]
            )
        )
        try:
            from ..retrieval.bm25_index import get_bm25_index
            bm25 = get_bm25_index(notebook_id)
            bm25.remove_document(filename)
            bm25.save()
        except Exception as e:
            logger.warning(f"Lỗi cập nhật BM25 khi xóa file {filename}: {e}")

    def search(self, query: str, limit: int = 5, notebook_id: str = None) -> List[Dict[str, Any]]:
        """Tìm kiếm dữ liệu tương tự theo Vector."""
        from qdrant_client.http.models import Filter, FieldCondition, MatchValue
        
        query_vector = self.embedder.embed_query(query)
        
        target_nb = notebook_id or getattr(self, "notebook_id", None)
        query_filter = None
        if target_nb and target_nb != "default":
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="notebook_id",
                        match=MatchValue(value=target_nb)
                    )
                ]
            )
        
        res = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            query_filter=query_filter,
            limit=limit
        )
        hits = res.points
        
        results = []
        for hit in hits:
            results.append({
                "score": hit.score,
                "content": hit.payload.get("content", ""),
                "metadata": {k: v for k, v in hit.payload.items() if k != "content"}
            })
        return results

    def get_all_chunks(self, limit: int = 500, notebook_id: str = None) -> List[Dict[str, Any]]:
        """Lấy tất cả các chunk trong collection hoặc lọc theo notebook_id."""
        from qdrant_client.http.models import Filter, FieldCondition, MatchValue
        target_nb = notebook_id or getattr(self, "notebook_id", None)
        scroll_filter = None
        if target_nb and target_nb != "default":
            scroll_filter = Filter(
                must=[
                    FieldCondition(key="notebook_id", match=MatchValue(value=target_nb))
                ]
            )
        chunks = []
        try:
            records, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=scroll_filter,
                limit=limit,
                with_payload=True,
                with_vectors=False
            )
            for r in records:
                payload = r.payload or {}
                chunks.append({
                    "chunk_id": payload.get("chunk_id", str(r.id)),
                    "content": payload.get("content", ""),
                    "metadata": {k: v for k, v in payload.items() if k != "content"}
                })
        except Exception as e:
            logger.warning(f"Lỗi scroll all chunks từ Qdrant: {e}")

        # Fallback nếu scroll theo notebook_id không ra kết quả (ví dụ dữ liệu cũ chưa có trường notebook_id)
        if not chunks and target_nb and target_nb != "default":
            try:
                records, _ = self.client.scroll(
                    collection_name=self.collection_name,
                    limit=limit,
                    with_payload=True,
                    with_vectors=False
                )
                for r in records:
                    payload = r.payload or {}
                    chunks.append({
                        "chunk_id": payload.get("chunk_id", str(r.id)),
                        "content": payload.get("content", ""),
                        "metadata": {k: v for k, v in payload.items() if k != "content"}
                    })
            except Exception as e:
                logger.warning(f"Lỗi scroll fallback Qdrant: {e}")

        # Fallback từ BM25 index nếu Qdrant hoàn toàn rỗng
        if not chunks and target_nb and target_nb != "default":
            bm25_path = os.path.join("storage", "bm25", str(target_nb), "bm25_docs.json")
            if os.path.exists(bm25_path):
                try:
                    with open(bm25_path, "r", encoding="utf-8") as f:
                        b_docs = json.load(f)
                    for item in b_docs[:limit]:
                        chunks.append({
                            "chunk_id": item.get("chunk_id", ""),
                            "content": item.get("text", ""),
                            "metadata": item.get("metadata", {})
                        })
                except Exception as e:
                    logger.warning(f"Lỗi đọc BM25 docs trong get_all_chunks: {e}")

        return chunks

    def get_chunks_by_document(self, notebook_id: str, filename: str, limit: int = 100) -> List[str]:
        """Lấy danh sách các chunk văn bản thuộc về một tài liệu cụ thể trong notebook."""
        from qdrant_client.http.models import Filter, FieldCondition, MatchValue
        chunks = []
        try:
            scroll_filter = Filter(
                must=[
                    FieldCondition(key="notebook_id", match=MatchValue(value=notebook_id))
                ],
                should=[
                    FieldCondition(key="filename", match=MatchValue(value=filename)),
                    FieldCondition(key="source_file", match=MatchValue(value=filename)),
                    FieldCondition(key="title", match=MatchValue(value=filename)),
                    FieldCondition(key="source_url", match=MatchValue(value=filename)),
                    FieldCondition(key="source", match=MatchValue(value=filename))
                ]
            )
            records, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=scroll_filter,
                limit=limit,
                with_payload=True,
                with_vectors=False
            )
            for r in records:
                content = r.payload.get("content")
                if content and isinstance(content, str):
                    chunks.append(content)
        except Exception as e:
            logger.warning(f"Lỗi scroll Qdrant cho file {filename}: {e}")

        # Fallback 1: Đọc từ BM25 index storage (storage/bm25/{notebook_id}/bm25_docs.json)
        if not chunks:
            bm25_path = os.path.join("storage", "bm25", str(notebook_id), "bm25_docs.json")
            if os.path.exists(bm25_path):
                try:
                    with open(bm25_path, "r", encoding="utf-8") as f:
                        b_docs = json.load(f)
                    for item in b_docs:
                        meta = item.get("metadata", {})
                        src = meta.get("filename") or meta.get("source_file") or meta.get("source") or meta.get("title")
                        if not src or src == filename or os.path.basename(str(src)) == os.path.basename(str(filename)):
                            txt = item.get("text", "")
                            if txt and txt.strip():
                                chunks.append(txt)
                                if len(chunks) >= limit:
                                    break
                except Exception as be:
                    logger.warning(f"Lỗi đọc BM25 fallback cho {filename}: {be}")

        # Fallback 2: nếu vẫn chưa có thì đọc trực tiếp file từ uploads/
        if not chunks:
            upload_path = os.path.join("uploads", filename)
            if os.path.exists(upload_path):
                try:
                    ext = os.path.splitext(filename)[1].lower()
                    if ext in ['.txt', '.md', '.json', '.csv', '.html']:
                        with open(upload_path, "r", encoding="utf-8", errors="ignore") as f:
                            text = f.read()
                            chunks = [text[i:i+800] for i in range(0, min(len(text), 20000), 800) if text[i:i+800].strip()]
                    else:
                        from src.ingestion.parsers.markitdown_parser import MarkItDownParser
                        parser = MarkItDownParser()
                        tree = parser.parse(upload_path)
                        if tree and tree.content:
                            text = tree.content
                            chunks = [text[i:i+800] for i in range(0, min(len(text), 20000), 800) if text[i:i+800].strip()]
                except Exception as e:
                    logger.warning(f"Lỗi đọc fallback file uploads/{filename}: {e}")

        return chunks
