import os
import uuid
import logging
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from ..utils.config import settings

logger = logging.getLogger(__name__)

class VectorStoreManager:
    """Quản lý việc lưu trữ Vector vào Qdrant Local và đồng bộ hóa BM25 Index."""
    
    def __init__(self, embedder):
        self.embedder = embedder
        
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

    def index_chunks(self, chunks: List[Dict[str, Any]]):
        """Nhúng và lưu các đoạn văn bản vào Database, đồng thời cập nhật BM25."""
        if not chunks:
            return
            
        print(f"[Qdrant] Đang tính toán Vector cho {len(chunks)} đoạn văn bản...")
        texts = [chunk["content"] for chunk in chunks]
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
            point_id = str(uuid.uuid4())
            cleaned_payload = {
                "content": str(chunk["content"]),
                **_clean_meta(chunk.get("metadata", {}))
            }
            point = PointStruct(
                id=point_id,
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
            notebook_id = chunks[0]["metadata"].get("notebook_id", "default")
            bm25 = get_bm25_index(notebook_id)
            bm25_docs = [
                BM25Document(
                    chunk_id=points[i].id,
                    text=chunks[i]["content"],
                    metadata=chunks[i]["metadata"]
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
                    FieldCondition(key="source_url", match=MatchValue(value=filename))
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
        
        query_filter = None
        if notebook_id:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="notebook_id",
                        match=MatchValue(value=notebook_id)
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
                    FieldCondition(key="source_url", match=MatchValue(value=filename))
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

        # Fallback nếu Qdrant chưa có hoặc trả về rỗng: đọc trực tiếp file từ uploads/
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
