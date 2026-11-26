import asyncio
import copy
import io
import json
import wave
from pathlib import Path
from types import SimpleNamespace

import pytest

from src.db.session_manager import SessionManager
from src.learning.guide_generator import GuideGenerator
from src.utils.config import settings


class MemoryStore:
    def __init__(self):
        self.records = {}

    def get_chunks_by_document(self, notebook_id, filename, limit=100):
        return [record["content"] for record in self.records.get((notebook_id, filename), [])][:limit]

    def get_document_chunk_records(self, notebook_id, filename, limit=1000):
        return copy.deepcopy(self.records.get((notebook_id, filename), [])[:limit])

    def delete_document_chunks(self, notebook_id, filename):
        self.records.pop((notebook_id, filename), None)

    def delete_notebook_chunks(self, notebook_id):
        self.records = {key: records for key, records in self.records.items() if key[0] != notebook_id}

    def index_chunks(self, chunks):
        for chunk in chunks:
            meta = chunk["metadata"]
            self.records.setdefault((meta["notebook_id"], meta["filename"]), []).append(copy.deepcopy(chunk))


class SequenceLLM:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.prompts = []

    def generate(self, prompt=None, **kwargs):
        self.prompts.append(prompt)
        yield next(self.responses)


def guide_responses(answer=0):
    return ["Source summary", "Question and answer", "Term: definition", json.dumps([
        {"question": "Which value?", "options": ["First", "Second"], "answer": answer},
    ]), json.dumps([{"front": "Term", "back": "Definition"}])]


@pytest.fixture
def backend(tmp_path, monkeypatch):
    for name, value in {
        "project_root": tmp_path,
        "database_path": tmp_path / "app.sqlite",
        "storage_dir": tmp_path / "qdrant",
        "bm25_dir": tmp_path / "bm25",
        "upload_dir": tmp_path / "uploads",
    }.items():
        monkeypatch.setattr(settings, name, value)
    from fastapi.testclient import TestClient
    from src.api import deps
    from src.api.api import app
    from src.api.routers import media
    from src.retrieval import bm25_index

    notes_dir = tmp_path / "notes"
    notes_dir.mkdir()
    monkeypatch.setattr(deps, "NOTES_DIR", str(notes_dir))
    monkeypatch.setattr(bm25_index, "_indexes", {})
    monkeypatch.setattr(media, "_PODCAST_STATUS", {})
    manager = SessionManager(str(settings.database_path))
    manager.create_notebook("safe-nb", "Isolated notebook")
    store = MemoryStore()
    monkeypatch.setattr(deps, "session_manager", manager)
    monkeypatch.setattr(deps, "vector_store", store)
    monkeypatch.setattr(deps, "search_engine", SimpleNamespace())
    monkeypatch.setattr(deps, "_NOTEBOOK_CACHE", {})

    def unexpected_call(*args, **kwargs):
        raise AssertionError("Test attempted an unmocked provider/network request")

    monkeypatch.setattr(deps, "llm_engine", SimpleNamespace(generate=unexpected_call))
    import requests
    monkeypatch.setattr(requests.sessions.Session, "request", unexpected_call)
    with TestClient(app) as client:
        yield SimpleNamespace(client=client, sm=manager, store=store, root=tmp_path, deps=deps)


def add_source(backend, filename="a.txt", content="Source knowledge"):
    backend.sm.add_document("safe-nb", filename)
    backend.store.index_chunks([{
        "content": content,
        "metadata": {"notebook_id": "safe-nb", "filename": filename, "page": 3, "breadcrumbs": "Chapter"},
    }])


def save_guide(manager, flashcards=None):
    manager.save_study_guide(
        "safe-nb", "Original summary", "Original FAQ", "Original glossary",
        quiz=[{"question": "Question?", "options": ["Yes", "No"], "answer": 0}],
        flashcards=flashcards or [{"front": "Term", "back": "Definition"}],
        mindmap={"id": "root", "name": "Original"},
        timeline_outline={"timeline": [], "outline": [{"title": "Original"}]},
    )


def make_wav(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8000)
        audio.writeframes(b"\x01\x00" * 800)
    return path


def test_guide_status_contract_and_unknown_notebook(backend):
    response = backend.client.get("/api/notebooks/safe-nb/study-guide/status")
    assert response.status_code == 200
    assert response.json() == {
        "status": "not_found", "has_guide": False, "error": None,
        "generation_id": None, "updated_at": None,
    }
    assert backend.client.get("/api/notebooks/missing/study-guide/status").status_code == 404
    backend.sm.save_mindmap("safe-nb", {"name": "Mindmap only"})
    assert backend.client.get("/api/notebooks/safe-nb/study-guide/status").json()["has_guide"] is False


def test_guide_generation_reports_completed_and_integer_answer(backend, monkeypatch):
    add_source(backend)
    llm = SequenceLLM(guide_responses(answer="B"))
    monkeypatch.setattr(backend.deps, "llm_engine", llm)
    response = backend.client.post("/api/notebooks/safe-nb/study-guide/regenerate", json={})
    assert response.status_code == 200
    assert response.json()["status"] == "processing"
    status = backend.client.get("/api/notebooks/safe-nb/study-guide/status").json()
    assert status["status"] == "completed"
    assert status["has_guide"] is True
    assert status["generation_id"] == response.json()["generation_id"]
    guide = backend.client.get("/api/notebooks/safe-nb/study-guide").json()
    assert guide["quiz"][0]["answer"] == 1


def test_guide_status_set_before_scheduling_and_duplicate_rejected(backend):
    from fastapi import BackgroundTasks, HTTPException
    from src.api.routers.learning import regenerate_study_guide, StudyGuideRequest
    add_source(backend)
    tasks = BackgroundTasks()
    result = asyncio.run(regenerate_study_guide("safe-nb", tasks, StudyGuideRequest()))
    assert backend.sm.get_study_guide_status("safe-nb")["status"] == "generating"
    assert len(tasks.tasks) == 1
    assert result["generation_id"]
    with pytest.raises(HTTPException) as exc:
        asyncio.run(regenerate_study_guide("safe-nb", BackgroundTasks(), StudyGuideRequest()))
    assert exc.value.status_code == 409


@pytest.mark.parametrize("failure", ["provider", "quiz", "cards", "empty"])
def test_guide_failures_keep_existing_guide_and_srs(backend, failure):
    add_source(backend)
    save_guide(backend.sm)
    backend.sm.update_srs_progress("safe-nb", 0, 3)
    original = backend.sm.get_study_guide("safe-nb")
    responses = guide_responses()
    if failure == "provider":
        responses[0] = "\u26a0\ufe0f Provider unavailable"
    elif failure == "quiz":
        responses[3] = '[{"question":"Q","options":["A","B"],"answer":true}]'
    elif failure == "cards":
        responses[4] = '[{"front":"Only one side"}]'
    else:
        responses[0] = ""
    GuideGenerator(SequenceLLM(responses), backend.sm).generate("safe-nb", "Source content")
    status = backend.sm.get_study_guide_status("safe-nb")
    assert status["status"] == "error" and status["error"] and status["has_guide"]
    assert backend.sm.get_study_guide("safe-nb") == original
    assert backend.sm.get_srs_progress("safe-nb")[0]["repetitions"] == 1


def test_missing_chunks_exposes_generation_error_without_placeholder(backend):
    backend.sm.add_document("safe-nb", "empty.txt")
    response = backend.client.post("/api/notebooks/safe-nb/study-guide/regenerate", json={})
    assert response.status_code == 200
    status = backend.client.get("/api/notebooks/safe-nb/study-guide/status").json()
    assert status["status"] == "error"
    assert status["has_guide"] is False
    assert backend.client.get("/api/notebooks/safe-nb/study-guide").status_code == 404


def test_source_changes_invalidate_artifacts_and_old_jobs(backend):
    add_source(backend)
    save_guide(backend.sm)
    backend.sm.update_srs_progress("safe-nb", 0, 4)
    audio = make_wav(backend.root / "storage/podcasts/safe-nb.wav")
    old_job = backend.sm.start_study_guide_generation("safe-nb")
    old_revision = backend.sm.get_source_revision("safe-nb")
    add_source(backend, "b.txt", "Additional knowledge")
    assert backend.sm.get_source_revision("safe-nb") > old_revision
    assert backend.sm.get_study_guide("safe-nb") is None
    assert backend.sm.get_srs_progress("safe-nb") == {}
    assert not audio.exists()
    GuideGenerator(SequenceLLM(guide_responses()), backend.sm).generate("safe-nb", "Old content", generation_id=old_job)
    assert backend.sm.get_study_guide("safe-nb") is None
    assert backend.sm.get_study_guide_status("safe-nb")["status"] == "not_found"
    with pytest.raises(ValueError):
        backend.sm.save_mindmap("safe-nb", {"name": "Stale"}, source_revision=old_revision)
    with pytest.raises(ValueError):
        backend.sm.save_timeline_outline("safe-nb", {}, source_revision=old_revision)


def test_delete_source_clears_guide_srs_and_pending_generation(backend):
    add_source(backend)
    save_guide(backend.sm)
    backend.sm.update_srs_progress("safe-nb", 0, 3)
    backend.sm.start_study_guide_generation("safe-nb")
    response = backend.client.delete("/api/notebooks/safe-nb/documents", params={"filename": "a.txt"})
    assert response.status_code == 200
    assert backend.sm.get_study_guide_status("safe-nb")["status"] == "not_found"
    assert backend.sm.get_study_guide("safe-nb") is None
    assert backend.sm.get_srs_progress("safe-nb") == {}


def test_old_generation_cannot_overwrite_new_or_deleted_notebook(backend):
    add_source(backend)
    old_job = backend.sm.start_study_guide_generation("safe-nb")
    new_job = backend.sm.start_study_guide_generation("safe-nb")
    assert backend.sm.save_study_guide("safe-nb", "New", "FAQ", "Terms", generation_id=new_job)
    assert not backend.sm.save_study_guide("safe-nb", "Old", "FAQ", "Terms", generation_id=old_job)
    backend.sm.fail_study_guide_generation("safe-nb", old_job, "Late failure")
    assert backend.sm.get_study_guide_status("safe-nb")["status"] == "completed"
    backend.sm.delete_notebook("safe-nb")
    assert not backend.sm.save_study_guide("safe-nb", "Ghost", "", "", generation_id=new_job)
    assert backend.sm.get_study_guide("safe-nb") is None


def test_interrupted_generation_becomes_retryable_error(backend):
    backend.sm.start_study_guide_generation("safe-nb")
    with backend.sm._get_conn() as conn:
        conn.execute("UPDATE study_guide_jobs SET generation_id = 'previous-process:job'")
    status = backend.sm.get_study_guide_status("safe-nb")
    assert status["status"] == "error"
    assert status["error"]


@pytest.mark.parametrize("suffix", ["study-guide/regenerate", "mindmap/generate", "timeline-outline/generate", "studio/critique", "studio/action-plan"])
def test_explicit_empty_source_selection_never_broadens_generation(backend, suffix):
    add_source(backend)
    response = backend.client.post(f"/api/notebooks/safe-nb/{suffix}", json={"selected_documents": []})
    assert response.status_code == 400
    assert backend.sm.get_study_guide("safe-nb") is None


def test_podcast_rejects_empty_selection_or_notebook_without_sources(backend):
    response = backend.client.post("/api/podcast/generate", json={"notebook_id": "safe-nb"})
    assert response.status_code == 400
    add_source(backend)
    response = backend.client.post("/api/podcast/generate", json={"notebook_id": "safe-nb", "selected_documents": []})
    assert response.status_code == 400


@pytest.mark.parametrize("selected", [[], ["missing.txt"]])
def test_retrieval_empty_or_unmatched_selection_returns_no_sources(selected):
    from src.retrieval.search_engine import SearchEngine
    engine = object.__new__(SearchEngine)
    def candidates(**kwargs):
        return [{"content": "Private context", "metadata": {"filename": "a.txt"}}]
    engine.hybrid_searcher = SimpleNamespace(search=candidates)
    engine.vector_store = SimpleNamespace(search=candidates)
    engine.reranker = SimpleNamespace(rerank=lambda *args, **kwargs: kwargs.get("documents", []))
    _, results = engine.retrieve("Question", "safe-nb", selected_documents=selected)
    assert results == []
    assert engine.search("Question", notebook_id="safe-nb", selected_documents=selected) == []


def test_chat_empty_selection_passes_no_document_names_or_context(backend, monkeypatch):
    add_source(backend)
    captured = {}
    class ChatLLM:
        def build_rag_prompt(self, query, context, **kwargs):
            captured.update(context=context, **kwargs)
            return "No sources prompt"
        def generate(self, **kwargs):
            yield "Select a source."
    monkeypatch.setattr(backend.deps, "llm_engine", ChatLLM())
    response = backend.client.post("/api/chat", json={"query": "Question", "notebook_id": "safe-nb", "selected_documents": []})
    assert response.status_code == 200
    assert captured["document_names"] == []
    assert "Source knowledge" not in captured["context"]
    assert '"type": "citations"' not in response.text


def test_ingest_regenerates_using_every_current_source(backend, monkeypatch):
    from src.api.routers import documents
    add_source(backend, "a.txt", "ALPHA source knowledge")
    save_guide(backend.sm)
    llm = SequenceLLM(guide_responses())
    monkeypatch.setattr(backend.deps, "llm_engine", llm)
    monkeypatch.setattr(documents, "get_embedder", lambda: object())
    monkeypatch.setattr(documents.AdaptiveChunker, "process_document", lambda self, tree: [
        {"content": "BETA new knowledge", "metadata": {}},
    ])
    response = backend.client.post("/api/ingest/text", json={"notebook_id": "safe-nb", "title": "b", "text": "BETA new knowledge"})
    assert response.status_code == 200
    assert "ALPHA source knowledge" in llm.prompts[0] and "BETA new knowledge" in llm.prompts[0]
    assert backend.sm.get_study_guide_status("safe-nb")["status"] == "completed"


def test_empty_ingest_does_not_replace_existing_source_or_guide(backend, monkeypatch):
    from src.api.routers import documents
    add_source(backend)
    save_guide(backend.sm)
    monkeypatch.setattr(documents, "get_embedder", lambda: object())
    monkeypatch.setattr(documents.AdaptiveChunker, "process_document", lambda *args: [])
    response = backend.client.post("/api/ingest/text", json={"notebook_id": "safe-nb", "title": "a", "text": "No useful parsed text"})
    assert response.status_code == 400
    assert backend.store.get_chunks_by_document("safe-nb", "a.txt") == ["Source knowledge"]
    assert backend.sm.get_study_guide("safe-nb")["summary"] == "Original summary"


@pytest.mark.parametrize("answer,expected", [(0, 0), ("0", 0), ("1", 1), ("B", 1), ("Second", 1)])
def test_quiz_answers_normalized_to_zero_based_integer(answer, expected):
    quiz = GuideGenerator._validate_quiz([{"question": "Q?", "options": ["First", "Second"], "answer": answer}])
    assert type(quiz[0]["answer"]) is int and quiz[0]["answer"] == expected


@pytest.mark.parametrize("answer", [True, 0.2, -1, 2, None, {}, "unknown"])
def test_quiz_rejects_invalid_answers(answer):
    with pytest.raises(ValueError):
        GuideGenerator._validate_quiz([{"question": "Q?", "options": ["First", "Second"], "answer": answer}])


def test_srs_accepts_original_index_and_resets_only_for_changed_cards(backend):
    save_guide(backend.sm, flashcards=[{"front": "A", "back": "1"}, {"front": "B", "back": "2"}])
    response = backend.client.post("/api/notebooks/safe-nb/srs/review", json={"card_index": 1, "rating": 4})
    assert response.status_code == 200 and response.json()["card"]["card_index"] == 1
    assert set(backend.sm.get_srs_progress("safe-nb")) == {1}
    cards = backend.sm.get_study_guide("safe-nb")["flashcards"]
    save_guide(backend.sm, flashcards=cards)
    assert set(backend.sm.get_srs_progress("safe-nb")) == {1}
    save_guide(backend.sm, flashcards=list(reversed(cards)))
    assert backend.sm.get_srs_progress("safe-nb") == {}
    assert backend.client.post("/api/notebooks/safe-nb/srs/review", json={"card_index": 2, "rating": 3}).status_code == 404
    assert backend.client.post("/api/notebooks/safe-nb/srs/review", json={"card_index": True, "rating": 3}).status_code == 422


def test_export_import_roundtrips_notes_cards_srs_and_chunk_metadata(backend):
    from src.api.deps import _save_notes, _load_notes
    add_source(backend)
    backend.store.records[("safe-nb", "a.txt")][0]["metadata"]["chunk_id"] = "original-source-chunk"
    save_guide(backend.sm)
    backend.sm.update_notebook_settings("safe-nb", api_key="Never export")
    backend.sm.update_srs_progress("safe-nb", 0, 4)
    notes = [{"id": "note-one", "content": "Pinned research", "title": "Research", "source": "manual"}]
    _save_notes("safe-nb", notes)
    backend.sm.save_message("safe-nb", "user", "Question", citations=[{"filename": "a.txt"}])
    exported = backend.client.get("/api/notebooks/safe-nb/export").json()
    assert "api_key" not in exported["notebook"] and "gemini_api_key" not in exported["notebook"]
    response = backend.client.post("/api/notebooks/import", json=exported)
    assert response.status_code == 200
    new_id = response.json()["notebook_id"]
    assert new_id != "safe-nb"
    assert backend.sm.get_study_guide(new_id) == backend.sm.get_study_guide("safe-nb")
    assert backend.sm.get_srs_progress(new_id) == backend.sm.get_srs_progress("safe-nb")
    assert _load_notes(new_id) == notes
    assert backend.sm.get_chat_history(new_id)[0]["content"] == "Question"
    records = backend.store.get_document_chunk_records(new_id, "a.txt")
    assert records[0]["metadata"]["notebook_id"] == new_id
    assert records[0]["metadata"]["page"] == 3
    assert "chunk_id" not in records[0]["metadata"]
    assert backend.store.get_document_chunk_records("safe-nb", "a.txt")[0]["metadata"]["notebook_id"] == "safe-nb"
    repeated = backend.client.post("/api/notebooks/import", json=exported).json()["notebook_id"]
    assert repeated not in {new_id, "safe-nb"}


@pytest.mark.parametrize("invalid", [{"srs_progress": {"wrong": {}}}, {"pinned_notes": ["bad"]}, {"study_guide": "bad"}, {"chunks": [None]}])
def test_invalid_import_is_rejected_before_creating_notebook(backend, invalid):
    before = len(backend.sm.list_notebooks())
    response = backend.client.post("/api/notebooks/import", json={"notebook": {"title": "Imported"}, **invalid})
    assert response.status_code == 422
    assert len(backend.sm.list_notebooks()) == before


@pytest.mark.parametrize("key", [None, "", "******"])
def test_provider_switch_clears_previous_key_and_same_provider_preserves_it(backend, key):
    backend.sm.update_notebook_settings("safe-nb", provider="openai", api_key="Original secret", model_name="old-model", base_url="https://old.example")
    payload = {"provider": "openai", "model_name": "new-model"}
    if key is not None:
        payload["api_key"] = key
    assert backend.client.put("/api/notebooks/safe-nb/settings", json=payload).status_code == 200
    assert backend.sm.get_notebook("safe-nb")["api_key"] == "Original secret"
    payload["provider"] = "custom"
    assert backend.client.put("/api/notebooks/safe-nb/settings", json=payload).status_code == 200
    notebook = backend.sm.get_notebook("safe-nb")
    assert notebook["api_key"] == notebook["gemini_api_key"] == notebook["base_url"] == ""


@pytest.mark.parametrize("provider", ["custom", "lm_studio", "local_ai"])
def test_provider_model_defaults_and_override_never_reuse_other_provider_config(backend, provider):
    from src.api.deps import resolve_llm_config
    backend.sm.save_app_settings({"custom_model": "Configured model", "custom_api_key": "Custom secret", "custom_base_url": "https://custom.example/v1"})
    original = {"provider": "openai", "model_name": "old-model", "api_key": "OpenAI secret", "base_url": "https://old.example/v1"}
    config = resolve_llm_config(original, override_provider=provider)
    assert config[1] == "Configured model"
    assert config[2] != "OpenAI secret" and config[3] != "https://old.example/v1"
    if provider == "custom":
        assert config[2:4] == ("Custom secret", "https://custom.example/v1")


def test_same_provider_nonstandard_endpoint_is_respected(backend):
    from src.api.deps import resolve_llm_config
    config = resolve_llm_config({"provider": "ollama", "base_url": "http://127.0.0.1:9011"})
    assert config[3] == "http://127.0.0.1:9011"


@pytest.mark.parametrize("provider, fallback", [
    ("openai", "https://api.openai.com/v1"),
    ("groq", "https://api.groq.com/openai/v1"),
    ("openrouter", "https://openrouter.ai/api/v1"),
])
def test_openai_compatible_provider_keeps_notebook_endpoint(backend, provider, fallback):
    from src.api.deps import resolve_llm_config

    custom_endpoint = "https://api.xingqi.example/v1"
    config = resolve_llm_config({
        "provider": provider,
        "model_name": "xingqi-model",
        "api_key": "xingqi-secret",
        "base_url": custom_endpoint,
    })
    assert config[0] == provider
    assert config[2] == "xingqi-secret"
    assert config[3] == custom_endpoint

    default_config = resolve_llm_config({"provider": provider})
    assert default_config[3] == fallback


def test_podcast_status_ignores_garbage_and_honors_generation_error(backend):
    from src.api.routers import media
    path = backend.root / "storage/podcasts/safe-nb.mp3"
    path.parent.mkdir(parents=True)
    path.write_bytes(b"Not audio" * 1000)
    assert backend.client.get("/api/podcast/status/safe-nb").json()["has_audio"] is False
    assert backend.client.get("/api/podcast/audio/safe-nb").status_code == 404
    make_wav(path.with_suffix(".wav"))
    media._PODCAST_STATUS["safe-nb"] = {"status": "error", "error": "Provider down", "source_revision": 0}
    state = backend.client.get("/api/podcast/status/safe-nb").json()
    assert state == {"status": "error", "has_audio": True, "error": "Provider down"}
    media._PODCAST_STATUS["safe-nb"]["status"] = "generating"
    assert backend.client.get("/api/podcast/status/safe-nb").json()["status"] == "generating"


def test_podcast_tts_failures_raise_and_preserve_previous_audio(backend, monkeypatch):
    from src.learning.podcast_generator import PodcastGenerator
    generator = PodcastGenerator(SequenceLLM(["A: Source explanation\nB: Learning response"]), backend.sm)
    original = make_wav(Path(generator.output_dir) / "safe-nb.wav")
    original_bytes = original.read_bytes()
    def fail(*args, **kwargs):
        raise RuntimeError("TTS unavailable")
    for method in ("_generate_with_edge_tts_native", "_generate_with_gtts", "_generate_offline"):
        monkeypatch.setattr(generator, method, fail)
    with pytest.raises(RuntimeError, match="TTS unavailable"):
        generator.generate_podcast("safe-nb", custom_context="Source content")
    assert original.read_bytes() == original_bytes
    assert not original.with_suffix(".mp3").exists()


def test_podcast_valid_offline_wav_keeps_correct_extension(backend, monkeypatch):
    from src.learning.podcast_generator import PodcastGenerator
    generator = PodcastGenerator(SequenceLLM(["A: Source explanation\nB: Learning response"]), backend.sm)
    monkeypatch.setattr(generator, "_generate_with_edge_tts_native", lambda *args, **kwargs: None)
    monkeypatch.setattr(generator, "_generate_with_gtts", lambda *args, **kwargs: None)
    monkeypatch.setattr(generator, "_generate_offline", lambda dialogues, output_file: make_wav(Path(output_file).with_suffix(".wav")))
    output = generator.generate_podcast("safe-nb", custom_context="Source content")
    assert Path(output).suffix == ".wav"
    response = backend.client.get("/api/podcast/audio/safe-nb")
    assert response.status_code == 200 and response.headers["content-type"].startswith("audio/wav")


def test_podcast_background_rejects_invalid_output(backend):
    from src.api.routers import media
    output = backend.root / "bad.mp3"
    output.write_bytes(b"garbage" * 1000)
    generator = SimpleNamespace(generate_podcast=lambda **kwargs: str(output), db=backend.sm)
    media._PODCAST_STATUS["safe-nb"] = {"generation_id": "job"}
    media._run_podcast_generation_task(generator, "safe-nb", "job", 0)
    assert media._PODCAST_STATUS["safe-nb"]["status"] == "error"


@pytest.mark.parametrize("kind", ["mindmap", "timeline", "critique", "action-plan"])
def test_learning_generation_provider_errors_never_save_placeholder(backend, kind):
    from src.learning.mindmap_generator import MindmapGenerator
    from src.learning.timeline_generator import TimelineOutlineGenerator
    from src.learning.critique_generator import CritiqueAndActionGenerator
    add_source(backend)
    llm = SequenceLLM(["\u26a0\ufe0f Provider unavailable"])
    if kind == "mindmap":
        operation = lambda: MindmapGenerator(llm, backend.sm).generate("safe-nb", "Source")
    elif kind == "timeline":
        operation = lambda: TimelineOutlineGenerator(llm, backend.sm).generate("safe-nb", "Source")
    else:
        generator = CritiqueAndActionGenerator(llm, backend.store, backend.sm, "safe-nb")
        operation = generator.generate_critique if kind == "critique" else generator.generate_action_plan
    with pytest.raises(RuntimeError, match="Provider unavailable"):
        operation()
    assert backend.sm.get_study_guide("safe-nb") is None


def test_transcription_empty_audio_or_silence_not_success(backend, monkeypatch):
    from src.ingestion.parsers import audio_parser
    monkeypatch.setattr(audio_parser, "load_whisper_model", lambda *args: SimpleNamespace(transcribe=lambda *args, **kwargs: {"text": ""}))
    response = backend.client.post("/api/audio/transcribe", files={"file": ("recording.wav", b"", "audio/wav")})
    assert response.status_code == 400
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8000)
        audio.writeframes(b"\x00\x00" * 800)
    response = backend.client.post("/api/audio/transcribe", files={"file": ("recording.wav", buffer.getvalue(), "audio/wav")})
    assert response.status_code == 422


def test_failed_document_replacement_restores_index_and_guide(backend, monkeypatch):
    from src.api.routers.documents import _replace_document_chunks
    add_source(backend)
    save_guide(backend.sm)
    original_index = copy.deepcopy(backend.store.records)
    original_guide = backend.sm.get_study_guide("safe-nb")
    original_index_chunks = backend.store.index_chunks
    calls = 0
    def fail_once(chunks):
        nonlocal calls
        calls += 1
        if calls == 1:
            original_index_chunks(chunks)
            raise RuntimeError("Index temporarily unavailable")
        original_index_chunks(chunks)
    monkeypatch.setattr(backend.store, "index_chunks", fail_once)
    with pytest.raises(RuntimeError, match="Index temporarily unavailable"):
        asyncio.run(_replace_document_chunks(
            backend.store, backend.sm, "safe-nb", "a.txt",
            [{"content": "Replacement", "metadata": {"notebook_id": "safe-nb", "filename": "a.txt"}}],
        ))
    assert backend.store.records == original_index
    assert backend.sm.get_study_guide("safe-nb") == original_guide
    assert backend.sm.get_study_guide_status("safe-nb")["status"] == "completed"


def test_failed_import_removes_only_the_incomplete_copy(backend, monkeypatch):
    add_source(backend)
    save_guide(backend.sm)
    exported = backend.client.get("/api/notebooks/safe-nb/export").json()
    original_records = copy.deepcopy(backend.store.records)
    original_index_chunks = backend.store.index_chunks
    def partial_failure(chunks):
        original_index_chunks(chunks)
        raise RuntimeError("Index unavailable")
    monkeypatch.setattr(backend.store, "index_chunks", partial_failure)
    response = backend.client.post("/api/notebooks/import", json=exported)
    assert response.status_code == 500
    assert [notebook["id"] for notebook in backend.sm.list_notebooks()] == ["safe-nb"]
    assert backend.store.records == original_records


def test_note_write_failure_preserves_saved_notes_and_reports_error(backend, monkeypatch):
    from src.api import deps
    original = [{"id": "saved-note", "content": "Keep this research"}]
    deps._save_notes("safe-nb", original)
    def fail_replace(*args):
        raise OSError("Disk unavailable")
    monkeypatch.setattr(deps.os, "replace", fail_replace)
    response = backend.client.post("/api/notebooks/safe-nb/notes", json={"content": "New research"})
    assert response.status_code == 500
    assert deps._load_notes("safe-nb") == original
    assert len(list((backend.root / "notes").iterdir())) == 1


def test_long_first_document_does_not_hide_other_selected_sources(backend):
    from src.api.deps import collect_document_context
    add_source(backend, "a.txt", "First source " * 4000)
    add_source(backend, "b.txt", "Distinct second source")
    context = collect_document_context(backend.store, "safe-nb", backend.sm.get_documents("safe-nb"))
    assert len(context) <= 10000
    assert "First source" in context and "Distinct second source" in context


def test_audio_validation_rejects_renamed_wav_and_truncated_mp3(backend, monkeypatch):
    from src.utils import audio
    monkeypatch.setattr(audio.shutil, "which", lambda *args: None)
    wav = make_wav(backend.root / "sample.wav")
    renamed = backend.root / "sample.mp3"
    renamed.write_bytes(wav.read_bytes())
    assert not audio.is_valid_audio_file(renamed)
    # MPEG-1 Layer III, 128 kbps at 44.1 kHz: a complete frame is 417 bytes.
    frame = b"\xff\xfb\x90\x00" + b"\x00" * 413
    renamed.write_bytes(frame * 2)
    assert audio.is_valid_audio_file(renamed)
    renamed.write_bytes(frame + frame[:100])
    assert not audio.is_valid_audio_file(renamed)


def test_global_masked_key_save_preserves_secret(backend):
    backend.sm.save_app_settings({"openai_api_key": "Original secret"})
    response = backend.client.post("/api/settings", json={"openai_api_key": "******", "openai_model": "new-model"})
    assert response.status_code == 200
    assert backend.sm.get_app_settings()["openai_api_key"] == "Original secret"


def test_source_change_during_podcast_synthesis_cannot_publish_stale_audio(backend, monkeypatch):
    from src.learning.podcast_generator import PodcastGenerator
    add_source(backend)
    revision = backend.sm.get_source_revision("safe-nb")
    generator = PodcastGenerator(SequenceLLM(["A: Source explanation\nB: Learning response"]), backend.sm)
    def synthesize_stale(dialogues, output_file, **kwargs):
        make_wav(Path(output_file).with_suffix(".wav"))
        add_source(backend, "new.txt", "Updated source")
    monkeypatch.setattr(generator, "_generate_with_edge_tts_native", synthesize_stale)
    with pytest.raises(RuntimeError, match="Podcast"):
        generator.generate_podcast("safe-nb", custom_context="Old source", source_revision=revision)
    assert not list(Path(generator.output_dir).glob("safe-nb.*"))
