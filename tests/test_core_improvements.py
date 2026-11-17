import asyncio
import json
from pathlib import Path

from fastapi import UploadFile

from src.api.routers.documents import _safe_filename, _save_upload
from src.ingestion.embedding import LocalEmbedder
from src.ingestion.chunking import AdaptiveChunker
from src.ingestion.schema import DocumentNode, HeadingNode, ParagraphNode
from src.retrieval.bm25_index import BM25Document, BM25Index
from src.retrieval.search_engine import _document_matches


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
