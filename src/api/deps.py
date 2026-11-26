import os
import json
import logging
import tempfile
from typing import Optional, List, Dict, Any
from fastapi import Request, HTTPException
from pydantic import BaseModel, Field

from src.ingestion.embedding import LocalEmbedder
from src.ingestion.indexing import VectorStoreManager
from src.retrieval.search_engine import SearchEngine
from src.llm.llm_client import LLMEngine
from src.db.session_manager import SessionManager
from src.learning.guide_generator import GuideGenerator
from src.learning.podcast_generator import PodcastGenerator
from src.learning.mindmap_generator import MindmapGenerator
from src.learning.timeline_generator import TimelineOutlineGenerator
from src.learning.doc_comparator import DocComparator
from src.learning.critique_generator import CritiqueAndActionGenerator
from src.utils.config import settings

logger = logging.getLogger(__name__)

# --- Global Singletons (Lazy Loaded) ---
embedder = None
vector_store = None
search_engine = None
llm_engine = None
session_manager = None
_NOTEBOOK_CACHE: Dict[str, Dict[str, Any]] = {}

def get_session_manager():
    global session_manager
    if session_manager is None:
        session_manager = SessionManager(str(settings.database_path))
    return session_manager

def get_embedder():
    global embedder
    if embedder is None:
        embedder = LocalEmbedder()
    return embedder

def get_vector_store():
    global vector_store
    if vector_store is None:
        vector_store = VectorStoreManager(embedder=get_embedder())
    return vector_store

def get_search_engine():
    global search_engine
    if search_engine is None:
        search_engine = SearchEngine(vector_store=get_vector_store())
    return search_engine

def get_llm_engine():
    global llm_engine
    if llm_engine is None:
        llm_engine = LLMEngine()
    return llm_engine


def select_notebook_documents(sm, notebook_id: str, selected_documents=None) -> List[Dict[str, Any]]:
    docs = sm.get_documents(notebook_id)
    if selected_documents is not None:
        if not isinstance(selected_documents, list) or any(not isinstance(name, str) for name in selected_documents):
            raise HTTPException(status_code=422, detail="selected_documents phải là danh sách tên tài liệu.")
        known_names = {doc["filename"] for doc in docs}
        if any(name not in known_names for name in selected_documents):
            raise HTTPException(status_code=400, detail="Nguồn đã chọn không còn tồn tại. Vui lòng tải lại danh sách nguồn.")
        docs = [doc for doc in docs if doc["filename"] in selected_documents]
    if not docs:
        raise HTTPException(status_code=400, detail="Chọn ít nhất một nguồn có nội dung để sử dụng tính năng này.")
    return docs


def collect_document_context(store, notebook_id: str, docs: List[Dict[str, Any]], limit: int = 15, max_chars: int = 10000) -> str:
    blocks = []
    for doc in docs:
        chunks = store.get_chunks_by_document(notebook_id, doc["filename"], limit=limit)
        text = "\n".join(chunk for chunk in chunks if isinstance(chunk, str) and chunk.strip())
        if text.strip():
            header = f"--- {doc['filename']} ---\n"
            budget = max(1, max_chars // len(docs) - len(header) - 2)
            blocks.append(header + text[:budget])
    if not blocks:
        raise ValueError("Không tìm thấy nội dung trong nguồn đã chọn. Vui lòng nạp lại tài liệu.")
    return "\n\n".join(blocks)


def _generate_notebook_guide(sm, notebook_id: str, generation_id: str, selected_documents=None, **options):
    try:
        notebook = sm.get_notebook(notebook_id)
        if not notebook:
            return
        if sm.get_study_guide_status(notebook_id)["generation_id"] != generation_id:
            return
        docs = select_notebook_documents(sm, notebook_id, selected_documents)
        context = collect_document_context(get_vector_store(), notebook_id, docs)
        provider, model_name, api_key, base_url, is_private = resolve_llm_config(notebook)
        GuideGenerator(get_llm_engine(), sm).generate(
            notebook_id, context, generation_id=generation_id, provider=provider,
            model_name=model_name, api_key=api_key, base_url=base_url, is_private=is_private, **options,
        )
    except Exception as exc:
        logger.exception("Không thể tạo cẩm nang cho %s", notebook_id)
        sm.fail_study_guide_generation(notebook_id, generation_id, getattr(exc, "detail", str(exc)))


def queue_study_guide(background_tasks, sm, notebook_id: str, selected_documents=None, **options) -> str:
    generation_id = sm.start_study_guide_generation(notebook_id)
    background_tasks.add_task(_generate_notebook_guide, sm, notebook_id, generation_id, selected_documents, **options)
    return generation_id

# --- Pydantic Models ---
class SettingsPayload(BaseModel):
    default_provider: Optional[str] = None
    default_model: Optional[str] = None
    ollama_base_url: Optional[str] = None
    lm_studio_base_url: Optional[str] = None
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    openai_api_key: Optional[str] = None
    openai_model: Optional[str] = None
    groq_api_key: Optional[str] = None
    groq_model: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    openrouter_model: Optional[str] = None
    router9_api_key: Optional[str] = None
    router9_base_url: Optional[str] = None
    router9_model: Optional[str] = None
    custom_base_url: Optional[str] = None
    custom_api_key: Optional[str] = None
    custom_model: Optional[str] = None
    clear_api_keys: Optional[List[str]] = None

class TestConnectionRequest(BaseModel):
    provider: str
    model_name: Optional[str] = ""
    api_key: Optional[str] = ""
    base_url: Optional[str] = ""

class NotebookCreate(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,128}$")
    title: str
    is_private: bool = True
    provider: Optional[str] = "ollama"
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    gemini_api_key: Optional[str] = None

class NotebookUpdate(BaseModel):
    title: Optional[str] = None
    provider: Optional[str] = None
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    is_private: Optional[bool] = None

class ChatRequest(BaseModel):
    query: str
    notebook_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,128}$")
    provider: Optional[str] = None
    model_name: Optional[str] = None
    selected_documents: Optional[List[str]] = None
    persona: Optional[str] = "strict"

class IngestTextRequest(BaseModel):
    notebook_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,128}$")
    title: str
    text: str

class PodcastRequest(BaseModel):
    notebook_id: str

class SrsReviewRequest(BaseModel):
    card_index: int = Field(ge=0, strict=True)
    rating: int = Field(ge=1, le=4, strict=True)

class CompareDocsRequest(BaseModel):
    filenames: List[str]
    focus_topic: Optional[str] = ""

class MindmapRequest(BaseModel):
    focus_topic: Optional[str] = ""
    selected_documents: Optional[List[str]] = None

class TimelineRequest(BaseModel):
    focus_topic: Optional[str] = ""
    selected_documents: Optional[List[str]] = None

class PullModelRequest(BaseModel):
    model_name: str
    base_url: Optional[str] = None

class StudioFilterRequest(BaseModel):
    notebook_id: Optional[str] = None
    source_filter: Optional[str] = None
    selected_documents: Optional[List[str]] = None

# --- Helpers ---
def resolve_llm_config(notebook: dict, override_provider: str = None, override_model: str = None) -> tuple:
    sm = get_session_manager()
    global_settings = sm.get_app_settings()

    provider = (override_provider or notebook.get('provider') or global_settings.get('default_provider', 'ollama')).lower()
    nb_provider = (notebook.get('provider') or '').lower()
    same_provider = provider == nb_provider
    model_name = override_model or (notebook.get('model_name') if same_provider else None)
    
    if not model_name or str(model_name).strip() == "":
        if provider == "ollama":
            model_name = global_settings.get("default_model", "qwen2.5:3b")
        elif provider == "9router":
            model_name = global_settings.get("router9_model", "kr/claude-sonnet-4.5")
        elif provider == "gemini":
            model_name = global_settings.get("gemini_model", "gemini-2.5-flash")
        elif provider == "openai":
            model_name = global_settings.get("openai_model", "gpt-4o-mini")
        elif provider == "groq":
            model_name = global_settings.get("groq_model", "llama-3.3-70b-versatile")
        elif provider == "openrouter":
            model_name = global_settings.get("openrouter_model", "deepseek/deepseek-r1")
        elif provider in {"custom", "lm_studio", "local_ai", "vllm", "hf_local"}:
            model_name = global_settings.get("custom_model") or "default"
        else:
            model_name = "default"

    nb_url = (notebook.get('base_url') or '') if same_provider else ''

    if provider == "ollama":
        base_url = nb_url or global_settings.get("ollama_base_url") or "http://127.0.0.1:11434"
    elif provider == "9router":
        base_url = nb_url or global_settings.get("router9_base_url") or "http://localhost:20128/v1"
    elif provider in ["lm_studio", "local_ai"]:
        base_url = nb_url or global_settings.get("lm_studio_base_url") or "http://localhost:1234/v1"
    elif provider == "gemini":
        base_url = ""
    elif provider == "openai":
        # A model selected from the model manager may use an OpenAI-compatible
        # gateway (for example Xingqi) while retaining the openai provider ID.
        base_url = nb_url or "https://api.openai.com/v1"
    elif provider == "groq":
        base_url = nb_url or "https://api.groq.com/openai/v1"
    elif provider == "openrouter":
        base_url = nb_url or "https://openrouter.ai/api/v1"
    else:
        base_url = nb_url or global_settings.get("custom_base_url") or ""

    nb_key = notebook.get('api_key') or notebook.get('gemini_api_key') or ''
    if provider == "9router":
        api_key = nb_key if (nb_provider == "9router" and nb_key) else global_settings.get("router9_api_key", "")
    elif provider == "gemini":
        api_key = nb_key if (nb_provider == "gemini" and nb_key) else global_settings.get("gemini_api_key", "")
    elif provider == "openai":
        api_key = nb_key if (nb_provider == "openai" and nb_key) else global_settings.get("openai_api_key", "")
    elif provider == "groq":
        api_key = nb_key if (nb_provider == "groq" and nb_key) else global_settings.get("groq_api_key", "")
    elif provider == "openrouter":
        api_key = nb_key if (nb_provider == "openrouter" and nb_key) else global_settings.get("openrouter_api_key", "")
    elif provider == "custom":
        api_key = nb_key if same_provider and nb_key else global_settings.get("custom_api_key", "")
    else:
        api_key = ""

    is_private = provider in ["ollama", "lm_studio", "local_ai", "vllm", "hf_local"]
    return provider, model_name, api_key, base_url, is_private

def get_notebook_id(request: Request, notebook_id: Optional[str] = None) -> str:
    if notebook_id:
        return notebook_id
    header_val = request.headers.get("x-notebook-id")
    if header_val:
        return header_val
    return "default"

NOTES_DIR = str(settings.project_root / "storage" / "notes")
os.makedirs(NOTES_DIR, exist_ok=True)

def _get_notes_path(notebook_id: str) -> str:
    safe_id = "".join([c for c in notebook_id if c.isalnum() or c in ("-", "_")]) or "default"
    return os.path.join(NOTES_DIR, f"{safe_id}_notes.json")

def _load_notes(notebook_id: str) -> List[Dict[str, Any]]:
    path = _get_notes_path(notebook_id)
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Lỗi khi đọc ghi chú notebook {notebook_id}: {e}")
        return []

def _save_notes(notebook_id: str, notes: List[Dict[str, Any]]) -> None:
    path = _get_notes_path(notebook_id)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", dir=NOTES_DIR, encoding="utf-8", delete=False) as f:
            temporary_path = f.name
            json.dump(notes, f, ensure_ascii=False, indent=2)
        os.replace(temporary_path, path)
    except Exception as e:
        logger.error(f"Lỗi khi lưu ghi chú notebook {notebook_id}: {e}")
        raise HTTPException(status_code=500, detail="Không thể lưu ghi chú. Vui lòng kiểm tra quyền ghi thư mục lưu trữ.") from e
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.remove(temporary_path)

def get_notebook_engines(notebook_id: str = "default") -> Dict[str, Any]:
    global _NOTEBOOK_CACHE
    sm = get_session_manager()
    notebook = sm.get_notebook(notebook_id) or {}
    provider, model_name, api_key, base_url, is_private = resolve_llm_config(notebook)
    llm = get_llm_engine()
    store = get_vector_store()
    search = get_search_engine()
    
    _NOTEBOOK_CACHE[notebook_id] = {
        "store": store,
        "search": search,
        "llm": llm,
        "llm_kwargs": {
            "provider": provider,
            "model_name": model_name,
            "api_key": api_key,
            "base_url": base_url,
            "is_private": is_private,
        },
        "guide": GuideGenerator(llm, sm),
        "mindmap": MindmapGenerator(llm, sm),
        "podcast": PodcastGenerator(llm, sm),
        "timeline": TimelineOutlineGenerator(llm, sm),
        "comparator": DocComparator(llm, sm),
        "critique": CritiqueAndActionGenerator(llm, store, sm, notebook_id=notebook_id),
    }
    return _NOTEBOOK_CACHE[notebook_id]
