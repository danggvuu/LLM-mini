import time
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from src.ingestion.router import DocumentRouter
from src.ingestion.chunking import AdaptiveChunker
from src.retrieval.vector_store import VectorStoreManager
from src.retrieval.search_engine import SearchEngine

TEST_Queries = [
    "Kiến trúc của hệ thống gồm những thành phần nào?",
    "Phương pháp đánh giá mô hình được thực hiện ra sao?",
]


def evaluate_chunking(file_path: str):
    configs = [
        {"chunk_size": 500, "chunk_overlap": 50},
        {"chunk_size": 1000, "chunk_overlap": 200},
        {"chunk_size": 1500, "chunk_overlap": 300},
    ]
    parser = DocumentRouter.get_parser(file_path)
    doc_tree = parser.parse(file_path)

    print(f"=== ĐÁNH GIÁ CHUNKING TRÊN: {file_path} ===")
    for cfg in configs:
        nb_id = f"eval_chunk_{cfg['chunk_size']}"
        chunker = AdaptiveChunker(**cfg)
        t0 = time.time()
        chunks = chunker.process_document(doc_tree)
        store = VectorStoreManager(notebook_id=nb_id)
        store.clear_all()
        store.index_chunks(chunks)
        search_engine = SearchEngine(store)

        avg_len = sum(len(c.content) for c in chunks) / max(1, len(chunks))
        print(f"\n[Config {cfg}] -> Số chunks: {len(chunks)} | Độ dài TB: {avg_len:.0f} ký tự | Index time: {time.time() - t0:.2f}s")
        for q in TEST_Queries:
            res = search_engine.search(q, top_k=3)
            top_score = res[0].get("rerank_score", 0.0) if res else 0.0
            print(f"  - Query: '{q}' | Top-1 Rerank Score: {top_score:.4f}")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "README.md"
    evaluate_chunking(target)
