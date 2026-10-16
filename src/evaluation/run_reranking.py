import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from src.retrieval.vector_store import VectorStoreManager
from src.retrieval.search_engine import SearchEngine
from src.llm.llm_client import LLMEngine
from src.llm.prompt_builder import PromptBuilder

TEST_QUERIES = [
    "Kiến trúc của hệ thống gồm những thành phần nào?",
    "Phương pháp đánh giá mô hình được thực hiện ra sao?",
    "Chế độ chạy offline hỗ trợ những mô hình nào?"
]


def evaluate_reranking(notebook_id: str = "default"):
    print(f"=== ĐÁNH GIÁ RERANKING TRÊN SỔ TAY: {notebook_id} ===")
    store = VectorStoreManager(notebook_id=notebook_id)
    engine = SearchEngine(store)
    llm = LLMEngine()

    for q in TEST_QUERIES:
        print(f"\n[Truy vấn]: {q}")
        results = engine.search(query=q, top_k=3)
        if not results:
            print("  Không tìm thấy kết quả phù hợp.")
            continue
        for i, r in enumerate(results, start=1):
            score = r.get("rerank_score", r.get("score", 0.0))
            src = r.get("metadata", {}).get("source", "N/A")
            print(f"  Top-{i} [Score: {score:.4f} | Nguồn: {src}]: {r.get('content', '')[:120]}...")
            
        prompt = PromptBuilder.build_rag_prompt(query=q, retrieved_chunks=results)
        ans = llm.generate(prompt)
        print(f"  [AI Trả lời]: {ans[:200]}...")


if __name__ == "__main__":
    nb = sys.argv[1] if len(sys.argv) > 1 else "default"
    evaluate_reranking(nb)
