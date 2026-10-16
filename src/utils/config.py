from pathlib import Path
from typing import Literal, Optional
from functools import lru_cache
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="RAG_", extra="ignore")
    
    # Directory paths
    data_dir: Path = Path("data")
    storage_dir: Path = Path("storage/qdrant")
    bm25_dir: Path = Path("storage/bm25")
    qdrant_collection_base: str = Field(default="rag_chunks", alias="RAG_QDRANT_COLLECTION")

    @property
    def qdrant_collection(self) -> str:
        return self.qdrant_collection_base + "_v2"

    # Chunking & Retrieval Parameters
    chunk_size: int = Field(default=1000, ge=100)
    chunk_overlap: int = Field(default=150, ge=0)
    top_k: int = Field(default=5, ge=1, le=64)

    # Embedding Configuration
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    # LLM Providers Configuration
    llm_provider: Literal["hf_local", "gemini", "vllm"] = "hf_local"
    llm_temperature: float = Field(default=0.1, ge=0.0, le=2.0)

    # Local Hugging Face Model Parameters
    hf_model: str = "Qwen/Qwen2.5-1.5B-Instruct"
    hf_device: str = "auto"  # Supports 'auto', 'cpu', 'cuda', 'mps' etc.
    hf_max_new_tokens: int = Field(default=2048, ge=1)
    
    # --- NEW: GGUF Model Parameters (Llama.cpp) ---
    gguf_model_repo: str = "Qwen/Qwen2.5-3B-Instruct-GGUF"
    gguf_model_file: str = "qwen2.5-3b-instruct-q4_k_m.gguf"

    # Google Gemini API Config
    gemini_model: str = "gemini-2.5-flash"
    google_api_key: str | None = Field(default=None, validation_alias="GOOGLE_API_KEY")

    # OpenAI / vLLM Config
    vllm_api_base: str = "http://localhost:8001/v1"
    vllm_api_key: str = "EMPTY"

    # Learning Parameters
    summarize_batch_size: int = Field(default=10, ge=1)
    summarize_retrieval_k: int = Field(default=12, ge=1, le=128)
    generation_retrieval_k: int = Field(default=16, ge=1, le=128)

    quiz_default_count: int = Field(default=8, ge=1, le=50)
    flashcards_default_count: int = Field(default=15, ge=1, le=100)
    api_url: str = "http://localhost:8000"

    # --- NEW: Redis Semantic Cache ---
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: Optional[str] = None
    cache_ttl: int = Field(default=3600, ge=60, description="Cache TTL in seconds")
    cache_similarity_threshold: float = Field(default=0.92, ge=0.5, le=1.0)

    # --- NEW: Session Memory ---
    session_max_messages: int = Field(default=20, ge=2, le=100)

    # --- NEW: Low VRAM Mode ---
    low_vram_mode: bool = Field(default=False, description="Use lightweight models for retrieval to save VRAM for LLM")

    # --- NEW: Hybrid Search & Reranking ---
    enable_reranker: bool = False
    hybrid_initial_k: int = Field(default=15, ge=1, le=100)
    hybrid_rerank_k: int = Field(default=5, ge=1, le=50)
    reranker_model: str = "BAAI/bge-reranker-v2-m3"
    bm25_top_k: int = Field(default=15, ge=1, le=100)

    # --- NEW: Stream Batching ---
    stream_buffer_ms: int = Field(default=50, ge=10, le=500)

    # --- NEW: Observability ---
    enable_prometheus: bool = True
    enable_langsmith: bool = False
    langsmith_api_key: Optional[str] = None
    langsmith_project: str = "simple-notebooklm"

    @model_validator(mode="after")
    def validate_config(self) -> "Settings":
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size.")
        if self.llm_provider == "gemini" and not self.google_api_key:
            # Note: Langchain will search for GOOGLE_API_KEY environment variable.
            # We don't raise error here to allow system-level env variables to be used.
            pass
        if self.hybrid_rerank_k > self.hybrid_initial_k:
            raise ValueError("hybrid_rerank_k must be <= hybrid_initial_k.")
            
        if self.hf_device == "auto":
            try:
                import torch
                if torch.cuda.is_available():
                    self.hf_device = "cuda"
                elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    self.hf_device = "mps"
                else:
                    self.hf_device = "cpu"
            except ImportError:
                self.hf_device = "cpu"
                
        return self

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
