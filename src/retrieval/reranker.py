"""
Cross-Encoder Reranker — Tầng Truy xuất
Sử dụng mô hình Cross-Encoder để chấm điểm lại các chunks.
"""
import logging
from typing import List, Dict, Any, Optional
from functools import lru_cache

from ..utils.config import settings

logger = logging.getLogger(__name__)

@lru_cache(maxsize=1)
def _load_cross_encoder():
    """Lazy-load the Cross-Encoder model only if enabled and cached locally."""
    if not getattr(settings, "enable_reranker", False):
        return None

    try:
        from sentence_transformers import CrossEncoder
        import torch
    except ImportError:
        logger.warning("Không tìm thấy thư viện sentence-transformers hoặc torch. Bỏ qua Reranker.")
        return None

    model_name = settings.reranker_model
    if settings.low_vram_mode:
        model_name = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"
        
    try:
        # local_files_only=True ensures we never block a real-time request to download 2GB from the web
        model = CrossEncoder(
            model_name,
            device=settings.hf_device,
            local_files_only=True,
            model_kwargs={"torch_dtype": torch.float16 if settings.hf_device != "cpu" else torch.float32}
        )
        logger.info("Cross-Encoder loaded successfully from local cache.")
        return model
    except Exception as exc:
        logger.info("Cross-Encoder không có sẵn offline, sử dụng kết quả Reciprocal Rank Fusion (RRF) siêu tốc.")
        return None

class CrossEncoderReranker:
    """
    Cross-Encoder Reranker.
    Nhận N chunks thô → tính điểm tương quan chéo → lọc sạch giữ lại top-K chunks.
    """

    def rerank(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Rerank chunks using Cross-Encoder.
        """
        rerank_k = top_k or settings.hybrid_rerank_k

        if not chunks:
            return []

        # Nếu số lượng chunk ít hơn top_k, không cần rerank
        if len(chunks) <= rerank_k:
            return chunks

        model = _load_cross_encoder()
        if model is None:
            logger.warning("Cross-Encoder unavailable. Trả về top chunks mặc định.")
            # Sort by existing score just in case
            sorted_chunks = sorted(chunks, key=lambda c: c.get("score", 0), reverse=True)
            return sorted_chunks[:rerank_k]

        # Chuẩn bị cặp (query, chunk_text)
        pairs = [[query, chunk["content"]] for chunk in chunks]
        
        # Dự đoán điểm
        scores = model.predict(pairs)

        # Cập nhật điểm mới và sắp xếp
        scored_chunks = []
        for chunk, score in zip(chunks, scores):
            new_chunk = chunk.copy()
            new_chunk["score"] = float(score)
            scored_chunks.append(new_chunk)

        scored_chunks.sort(key=lambda c: c["score"], reverse=True)

        return scored_chunks[:rerank_k]
