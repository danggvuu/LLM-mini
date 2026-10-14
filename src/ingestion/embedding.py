from typing import List
from sentence_transformers import SentenceTransformer
from ..utils.config import settings

class LocalEmbedder:
    """Quản lý Embedding Model với khả năng tự động chọn Device và mô hình tối ưu."""
    
    def __init__(self, model_name: str = None):
        self.model_name = model_name or "sentence-transformers/all-MiniLM-L6-v2"
        self.device = settings.hf_device if settings.hf_device != "auto" else None
        
        print(f"[LocalEmbedder] Đang tải mô hình {self.model_name} lên thiết bị: {self.device}")
        self.model = SentenceTransformer(self.model_name, device=self.device)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Nhúng danh sách các đoạn văn bản (Dùng cho Ingestion)."""
        if not texts:
            return []
        embeddings = self.model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return embeddings.tolist()

    def embed_query(self, text: str) -> List[float]:
        """Nhúng một câu truy vấn duy nhất (Dùng cho Retrieval)."""
        embedding = self.model.encode(text, convert_to_numpy=True, show_progress_bar=False)
        return embedding.tolist()
