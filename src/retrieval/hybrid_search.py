"""
Hybrid Search — Tầng Truy xuất Lai
Chạy song song Semantic (Qdrant) và Keyword (BM25),
sau đó kết hợp kết quả bằng Reciprocal Rank Fusion (RRF).
"""
import logging
import hashlib
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor

from ..utils.config import settings
from ..ingestion.indexing import VectorStoreManager
from .bm25_index import get_bm25_index

logger = logging.getLogger(__name__)

RRF_K = 60

def _semantic_search(
    query: str,
    k: int,
    notebook_id: str,
    vector_store: VectorStoreManager
) -> List[Dict[str, Any]]:
    return vector_store.search(query=query, limit=k, notebook_id=notebook_id)

def _bm25_search(query: str, k: int, notebook_id: str) -> List[Dict[str, Any]]:
    bm25_index = get_bm25_index(notebook_id)

    if bm25_index.is_empty:
        return []

    results = bm25_index.search(query, top_k=k)

    formatted_results = []
    for doc, score in results:
        meta = dict(doc.metadata or {})
        meta["chunk_id"] = doc.chunk_id
        formatted_results.append({
            "score": float(score),
            "content": doc.text,
            "metadata": meta
        })
    return formatted_results

def _reciprocal_rank_fusion(
    semantic_results: List[Dict[str, Any]],
    bm25_results: List[Dict[str, Any]],
    k: int = RRF_K,
) -> List[Dict[str, Any]]:
    """
    Kết hợp kết quả bằng Reciprocal Rank Fusion (RRF).
    RRF_score(d) = Σ 1 / (k + rank_i(d))
    """
    rrf_scores = {}
    chunk_map = {}

    def get_chunk_id(chunk):
        meta_id = chunk.get("metadata", {}).get("chunk_id")
        if meta_id:
            return str(meta_id)
        content_bytes = chunk.get("content", "").encode("utf-8", errors="ignore")
        return hashlib.md5(content_bytes).hexdigest()

    for rank, chunk in enumerate(semantic_results, start=1):
        cid = get_chunk_id(chunk)
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + 1.0 / (k + rank)
        if cid not in chunk_map:
            chunk_map[cid] = chunk

    for rank, chunk in enumerate(bm25_results, start=1):
        cid = get_chunk_id(chunk)
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + 1.0 / (k + rank)
        if cid not in chunk_map:
            chunk_map[cid] = chunk

    sorted_ids = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)

    fused = []
    for cid in sorted_ids:
        chunk = chunk_map[cid].copy()
        chunk["score"] = rrf_scores[cid]
        fused.append(chunk)

    return fused

class HybridSearcher:
    def __init__(self, vector_store: VectorStoreManager):
        self.vector_store = vector_store

    def search(
        self,
        query: str,
        k: int = 15,
        notebook_id: str = "default",
    ) -> List[Dict[str, Any]]:
        search_k = k or settings.hybrid_initial_k

        with ThreadPoolExecutor(max_workers=2) as executor:
            semantic_future = executor.submit(
                _semantic_search, query, search_k, notebook_id, self.vector_store
            )
            bm25_future = executor.submit(
                _bm25_search, query, settings.bm25_top_k, notebook_id
            )

            semantic_results = semantic_future.result()
            bm25_results = bm25_future.result()

        return _reciprocal_rank_fusion(semantic_results, bm25_results)
