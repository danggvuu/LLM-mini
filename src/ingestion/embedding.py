from typing import List, Union
import numpy as np
from src.utils.logger import logger
from src.utils.config import settings


class LocalEmbedder:
    """Wrapper cho SentenceTransformers hoạt động hoàn toàn Offline, đồng bộ với config.py."""
    
    def __init__(self, model_name: str = None):
        self.model_name = model_name or getattr(
            settings, "embedding_model", "sentence-transformers/all-MiniLM-L6-v2"
        )
        self.device = getattr(settings, "hf_device", None) if getattr(settings, "hf_device", "auto") != "auto" else None
        self.model = None
        self._load_model()

    def _load_model(self):
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Đang tải Local Embedding Model: {self.model_name}...")
            try:
                self.model = SentenceTransformer(self.model_name, device=self.device, local_files_only=True)
            except Exception:
                self.model = SentenceTransformer(self.model_name, device=self.device, local_files_only=False)
            logger.info("Tải Local Embedding Model thành công!")
        except Exception as e:
            fallback = "sentence-transformers/all-MiniLM-L6-v2"
            if self.model_name != fallback:
                logger.warning(f"Không thể tải {self.model_name} ({e}). Chuyển sang fallback: {fallback}")
                try:
                    from sentence_transformers import SentenceTransformer
                    self.model_name = fallback
                    try:
                        self.model = SentenceTransformer(fallback, device=self.device, local_files_only=True)
                    except Exception:
                        self.model = SentenceTransformer(fallback, device=self.device, local_files_only=False)
                    return
                except Exception as inner_e:
                    logger.error(f"Lỗi tải fallback model: {inner_e}")
            logger.error(f"Lỗi khi tải sentence-transformers: {e}")
            self.model = None

    def embed_text(self, texts: Union[str, List[str]]) -> Union[List[float], List[List[float]]]:
        if not self.model:
            logger.warning("LocalEmbedder chưa khởi tạo. Trả về vector 0.")
            is_single = isinstance(texts, str)
            return [0.0] * 384 if is_single else [[0.0] * 384 for _ in texts]

        is_single = isinstance(texts, str)
        input_texts = [texts] if is_single else texts

        try:
            embeddings = self.model.encode(
                input_texts,
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True
            )
            result = embeddings.tolist()
            return result[0] if is_single else result
        except Exception as e:
            logger.error(f"Lỗi trong quá trình tạo Embedding: {e}")
            return [0.0] * 384 if is_single else [[0.0] * 384 for _ in input_texts]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Nhúng danh sách các đoạn văn bản (Dùng cho Ingestion)."""
        if not texts:
            return []
        res = self.embed_text(texts)
        if isinstance(res, list) and len(res) > 0 and isinstance(res[0], list):
            return res
        return [res] if isinstance(res, list) else []

    def embed_query(self, text: str) -> List[float]:
        """Nhúng một câu truy vấn duy nhất (Dùng cho Retrieval)."""
        res = self.embed_text(text)
        if isinstance(res, list) and len(res) > 0 and isinstance(res[0], float):
            return res
        if isinstance(res, list) and len(res) > 0 and isinstance(res[0], list):
            return res[0]
        return [0.0] * 384
