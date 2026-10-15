import os
import sys
import types
import logging
import pandas as pd
from typing import List, Dict, Any, Callable

# Tương thích ngược cho ragas khi langchain-community không có vertexai
if 'langchain_community.chat_models.vertexai' not in sys.modules:
    m = types.ModuleType('langchain_community.chat_models.vertexai')
    class ChatVertexAI: pass
    m.ChatVertexAI = ChatVertexAI
    sys.modules['langchain_community.chat_models.vertexai'] = m

from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    context_precision,
    answer_relevancy,
    faithfulness,
)
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_genai import GoogleGenerativeAIEmbeddings

logger = logging.getLogger(__name__)

def summary_metrics(df: pd.DataFrame) -> Dict[str, float]:
    metrics = ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]
    res = {}
    for m in metrics:
        if m in df.columns:
            res[m] = float(df[m].mean())
    return res

def run_evaluation(test_cases: List[Dict[str, str]], answer_fn: Callable, llm_provider: str = "gemini"):
    questions = []
    answers = []
    contexts = []
    ground_truths = []

    for case in test_cases:
        q = case["question"]
        gt = case.get("ground_truth", "")
        rag_ans = answer_fn(q)
        questions.append(q)
        answers.append(getattr(rag_ans, "answer", str(rag_ans)))
        chunk_texts = [getattr(c, "text", str(c)) for c in getattr(rag_ans, "chunks", [])]
        contexts.append(chunk_texts if chunk_texts else [""])
        ground_truths.append(gt)

    evaluator = RagasEvaluator()
    return evaluator.evaluate_batch(questions, answers, contexts, ground_truths)

class RagasEvaluator:
    """Đánh giá RAG sử dụng Ragas."""
    
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning("Không tìm thấy GOOGLE_API_KEY. Ragas có thể không hoạt động.")
            
        self.llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=api_key)
        self.embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=api_key)
        
    def evaluate_batch(self, questions: list[str], answers: list[str], contexts: list[list[str]], ground_truths: list[str] = None):
        data = {
            "question": questions,
            "answer": answers,
            "contexts": contexts,
        }
        
        if ground_truths:
            data["ground_truth"] = ground_truths
            
        dataset = Dataset.from_dict(data)
        
        metrics = [
            context_precision,
            answer_relevancy,
            faithfulness,
        ]
        
        logger.info(f"Đang bắt đầu chấm điểm {len(questions)} câu trả lời bằng Ragas...")
        try:
            result = evaluate(
                dataset,
                metrics=metrics,
                llm=self.llm,
                embeddings=self.embeddings,
                raise_exceptions=False,
            )
            return result
        except Exception as e:
            logger.error(f"Lỗi khi chấm điểm Ragas: {e}")
            return {"error": str(e)}