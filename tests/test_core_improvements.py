import asyncio
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import pytest

from fastapi import UploadFile

from src.api.routers.documents import _safe_filename, _save_upload
from src.ingestion.embedding import LocalEmbedder
from src.ingestion.chunking import AdaptiveChunker
from src.ingestion.schema import DocumentNode, HeadingNode, ParagraphNode
from src.retrieval.bm25_index import BM25Document, BM25Index
from src.retrieval.search_engine import _document_matches
from src.retrieval.bm25_index import _notebook_index_dir
from src.api.routers.system import public_notebook, public_settings
from src.utils.url_security import validate_public_http_url


@pytest.fixture
def app_client(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from src.api import deps
    from src.api.api import app
    from src.db.session_manager import SessionManager

    isolated_manager = SessionManager(str(tmp_path / "app.sqlite"))
    monkeypatch.setattr(deps, "session_manager", isolated_manager)
    with TestClient(app) as client:
        yield client


def test_safe_filename_removes_path_and_unsafe_characters():
    assert _safe_filename("../../a/báo-cáo?.pdf") == "báo-cáo_.pdf"
    assert _safe_filename("") == "document"


def test_hash_embedding_is_deterministic_and_distinguishes_text():
    first = LocalEmbedder._hash_embeddings("alpha beta")
    second = LocalEmbedder._hash_embeddings("alpha beta")
    other = LocalEmbedder._hash_embeddings("completely different")

    assert first == second
    assert len(first) == 384
    assert any(value != 0 for value in first)
    assert first != other


def test_chunker_preserves_heading_context():
    root = DocumentNode(metadata={"source": "sample.md", "notebook_id": "nb"})
    heading = HeadingNode(level=1, content="Phần chính")
    heading.add_child(ParagraphNode(content="Nội dung đủ dài để được giữ lại trong một chunk có ngữ cảnh."))
    root.add_child(heading)

    chunks = AdaptiveChunker(chunk_size=200, min_chunk_length=10).process_document(root)

    assert len(chunks) == 1
    assert "Phần chính" in chunks[0].content
    assert chunks[0].metadata["notebook_id"] == "nb"


def test_bm25_add_is_idempotent_and_remove_matches_source_variants(tmp_path):
    index = BM25Index(tmp_path)
    doc = BM25Document("chunk-1", "nội dung tài liệu", {"source_file": "report.pdf"})
    index.add_documents([doc])
    index.add_documents([doc])
    assert index.size == 1

    index.remove_document("report.pdf")
    assert index.is_empty


def test_selected_document_matching_uses_basename_and_all_metadata_keys():
    assert _document_matches({"source_file": "/tmp/report.pdf"}, ["report.pdf"])
    assert _document_matches({"source_url": "https://example.test/article"}, ["https://example.test/article"])
    assert not _document_matches({"filename": "other.pdf"}, ["report.pdf"])


def test_upload_helper_enforces_safe_path_and_writes_to_configured_dir(tmp_path, monkeypatch):
    from src.api.routers import documents

    monkeypatch.setattr(documents.settings, "upload_dir", tmp_path)
    upload = UploadFile(filename="../safe.txt", file=__import__("io").BytesIO(b"hello"))
    name, path = asyncio.run(_save_upload(upload))

    assert name == "safe.txt"
    assert Path(path).parent == tmp_path
    assert Path(path).name.endswith("_safe.txt")
    assert Path(path).read_text() == "hello"


def test_upload_fallback_rejects_path_traversal(tmp_path, monkeypatch):
    from src.ingestion import indexing

    monkeypatch.setattr(indexing.settings, "upload_dir", tmp_path / "uploads")
    outside = tmp_path / "private.txt"
    outside.write_text("must not be exposed")
    store = object.__new__(indexing.VectorStoreManager)
    store.client = type("EmptyClient", (), {"scroll": lambda self, **kwargs: ([], None)})()
    store.collection_name = "unused"

    assert store.get_chunks_by_document("audit-notebook", "../private.txt") == []


def test_notebook_index_path_rejects_traversal():
    with pytest.raises(ValueError):
        _notebook_index_dir("../outside")
    with pytest.raises(ValueError):
        _notebook_index_dir("nested/id")


def test_public_serializers_never_return_api_key_values():
    settings = public_settings({"gemini_api_key": "secret", "default_model": "model"})
    notebook = public_notebook({"id": "nb", "api_key": "secret", "gemini_api_key": "secret"})

    assert settings["gemini_api_key"] == ""
    assert settings["gemini_api_key_configured"] is True
    assert "api_key" not in notebook
    assert "gemini_api_key" not in notebook
    assert notebook["api_key_configured"] is True


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/admin",
    "http://10.0.0.4/metadata",
    "http://localhost:8000/api/settings",
    "file:///etc/passwd",
])
def test_url_validation_rejects_private_or_non_http_destinations(url):
    with pytest.raises(ValueError):
        validate_public_http_url(url)


def test_url_validation_accepts_public_ip_literal():
    assert validate_public_http_url("https://8.8.8.8/dns-query") == "https://8.8.8.8/dns-query"


def test_whisper_model_does_not_download_without_opt_in(tmp_path, monkeypatch):
    from src.ingestion.parsers import audio_parser

    model_url = "https://example.test/models/fake-checkpoint.pt"
    fake_whisper = SimpleNamespace(_MODELS={"base": model_url}, load_model=lambda *a, **k: object())
    monkeypatch.setitem(sys.modules, "whisper", fake_whisper)
    monkeypatch.setattr(audio_parser.settings, "project_root", tmp_path)
    monkeypatch.setattr(audio_parser.settings, "allow_model_download", False)
    audio_parser._WHISPER_MODELS.clear()

    with pytest.raises(RuntimeError, match="RAG_ALLOW_MODEL_DOWNLOAD=true"):
        audio_parser.load_whisper_model("base")


def test_notebook_create_rejects_path_like_identifier():
    from src.api.deps import NotebookCreate
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        NotebookCreate(id="../outside", title="unsafe")


def test_evaluator_refuses_to_invent_scores_without_conversation():
    from src.learning.evaluator import Evaluator

    class EmptyHistory:
        def get_notebook(self, notebook_id):
            return {"id": notebook_id}

        def get_chat_history(self, notebook_id):
            return [{"role": "user", "content": "question"}]

    with pytest.raises(ValueError, match="ít nhất hai lượt"):
        Evaluator(None, EmptyHistory()).evaluate_knowledge("safe-nb")


def test_podcast_paths_reject_notebook_path_traversal():
    from fastapi import HTTPException
    from src.api.routers.media import _podcast_file

    with pytest.raises(HTTPException) as exc:
        _podcast_file("../private", ".mp3")
    assert exc.value.status_code == 400


def test_deleting_document_removes_only_its_managed_upload(tmp_path, monkeypatch):
    from src.utils.config import settings

    upload_root = tmp_path / "uploads"
    monkeypatch.setattr(settings, "upload_dir", upload_root)
    owned_file = upload_root / "owned.txt"
    other_file = tmp_path / "outside.txt"
    upload_root.mkdir()
    owned_file.write_text("managed")
    other_file.write_text("keep")

    from src.db.session_manager import SessionManager
    SessionManager._delete_managed_upload(str(owned_file))

    assert not owned_file.exists()
    assert other_file.read_text() == "keep"


def test_cross_origin_api_mutations_are_rejected(app_client):
    response = app_client.post(
        "/api/settings",
        headers={"Origin": "https://untrusted.example"},
        json={"default_model": "must-not-be-written"},
    )
    assert response.status_code == 403


def test_document_chunks_reject_unknown_notebook_before_file_fallback(app_client):
    response = app_client.get(
        "/api/notebooks/unknown-notebook/documents/chunks",
        params={"source": "../../README.md"},
    )
    assert response.status_code == 404


def test_chat_stream_works_without_blocking_route_contract(monkeypatch, app_client):
    from src.api.routers import chat

    class FakeSessionManager:
        def get_notebook(self, notebook_id):
            return {"id": notebook_id, "title": "test", "provider": "ollama"}

        def get_chat_history(self, notebook_id):
            return []

        def get_documents(self, notebook_id):
            return [{"filename": "sample.txt"}]

        def save_message(self, *args, **kwargs):
            return 1

    class FakeSearchEngine:
        def retrieve(self, *args, **kwargs):
            return "[Source 1]: sample", [{"content": "sample", "metadata": {"filename": "sample.txt"}}]

    class FakeLLM:
        def build_rag_prompt(self, *args, **kwargs):
            return "prompt"

        def generate(self, **kwargs):
            yield "answer"

    monkeypatch.setattr(chat, "get_session_manager", FakeSessionManager)
    monkeypatch.setattr(chat, "get_search_engine", FakeSearchEngine)
    monkeypatch.setattr(chat, "get_llm_engine", FakeLLM)
    response = app_client.post(
        "/api/chat",
        json={"query": "question", "notebook_id": "safe-nb"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert '"text": "answer"' in response.text


def test_public_settings_and_notebooks_do_not_return_credentials(app_client):
    settings_response = app_client.get("/api/settings")
    notebooks_response = app_client.get("/api/notebooks")
    assert settings_response.status_code == 200
    assert notebooks_response.status_code == 200
    for key in ("gemini_api_key", "openai_api_key", "groq_api_key", "router9_api_key", "custom_api_key"):
        assert settings_response.json().get(key, "") == ""
    for notebook in notebooks_response.json():
        assert "api_key" not in notebook
        assert "gemini_api_key" not in notebook


def test_settings_save_preserves_masked_keys_and_supports_explicit_clear(tmp_path, monkeypatch):
    from src.api.routers import system
    from src.api.deps import SettingsPayload
    from src.db.session_manager import SessionManager

    manager = SessionManager(str(tmp_path / "settings.sqlite"))
    manager.save_app_settings({"gemini_api_key": "test-secret"})
    monkeypatch.setattr(system, "get_session_manager", lambda: manager)

    system.save_settings_endpoint(SettingsPayload(default_model="new-model", gemini_api_key=""))
    assert manager.get_app_settings()["gemini_api_key"] == "test-secret"

    system.save_settings_endpoint(SettingsPayload(clear_api_keys=["gemini_api_key"]))
    assert manager.get_app_settings()["gemini_api_key"] == ""


def test_provider_environment_defaults_are_used_for_fresh_database(tmp_path, monkeypatch):
    from src.db.session_manager import SessionManager

    monkeypatch.setenv("RAG_LLM_PROVIDER", "groq")
    monkeypatch.setenv("RAG_DEFAULT_MODEL", "test-model")
    manager = SessionManager(str(tmp_path / "fresh.sqlite"))
    settings = manager.get_app_settings()

    assert settings["default_provider"] == "groq"
    assert settings["default_model"] == "test-model"


@pytest.mark.parametrize("provider", [
    "ollama", "lm_studio", "local_ai", "9router", "gemini", "openai",
    "groq", "openrouter", "custom", "hf_local", "vllm"
])
def test_settings_accept_each_supported_llm_provider(provider):
    from src.utils.config import Settings

    config = Settings(llm_provider=provider)
    assert config.llm_provider == provider


def test_evaluation_failure_does_not_return_fake_scores(monkeypatch, app_client):
    from src.api.routers import learning

    class FakeSessionManager:
        def get_notebook(self, notebook_id):
            return {"id": notebook_id, "provider": "ollama"}

    monkeypatch.setattr(learning, "get_session_manager", FakeSessionManager)
    monkeypatch.setattr(
        learning,
        "resolve_llm_config",
        lambda notebook: ("ollama", "test-model", "", "http://localhost:11434", True),
    )
    monkeypatch.setattr(
        learning.Evaluator,
        "evaluate_knowledge",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("provider unavailable")),
    )

    response = app_client.post("/api/evaluate", data={"notebook_id": "safe-nb"})
    assert response.status_code == 503
    assert "metrics" not in response.json()
