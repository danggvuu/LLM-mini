"""
RankBM25 Inverted Index â€” Táº§ng Kho Tri thá»©c
In-memory BM25 keyword search with disk persistence.
"""
import json
import logging
import pickle
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from cachetools import LRUCache
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class BM25Document:
    """A document stored in the BM25 index."""
    chunk_id: str
    text: str
    metadata: Dict


class BM25Index:
    """
    RankBM25 inverted index on RAM.
    Builds index from text chunks and supports keyword search.
    Persists/loads from disk via pickle.
    """

    def __init__(self, persist_dir: Optional[Path] = None):
        self._documents: List[BM25Document] = []
        self._bm25 = None
        self._persist_dir = persist_dir
        if persist_dir:
            persist_dir.mkdir(parents=True, exist_ok=True)

    @property
    def is_empty(self) -> bool:
        return len(self._documents) == 0

    @property
    def size(self) -> int:
        return len(self._documents)

    def _tokenize(self, text: str) -> List[str]:
        """Simple whitespace tokenizer with lowercasing."""
        import re
        # Split on non-alphanumeric (keeping Vietnamese characters)
        tokens = re.findall(r'\w+', text.lower())
        return tokens

    def build(self, documents: List[BM25Document]) -> None:
        """Build BM25 index from a list of documents."""
        from rank_bm25 import BM25Okapi

        self._documents = documents
        if not documents:
            self._bm25 = None
            logger.info("BM25 index built with 0 documents (empty).")
            return

        tokenized_corpus = [self._tokenize(doc.text) for doc in documents]
        self._bm25 = BM25Okapi(tokenized_corpus)
        logger.info("BM25 index built with %d documents.", len(documents))

    def add_documents(self, documents: List[BM25Document]) -> None:
        """Add documents to the index and rebuild."""
        if not documents:
            return
        existing_ids = {str(doc.chunk_id) for doc in self._documents}
        self._documents.extend(doc for doc in documents if str(doc.chunk_id) not in existing_ids)
        self.build(self._documents)

    def remove_document(self, filename: str) -> None:
        """Remove a specific document from the index and rebuild."""
        original_count = len(self._documents)
        target = str(filename)
        def belongs_to_file(doc: BM25Document) -> bool:
            meta = doc.metadata or {}
            candidates = (
                meta.get("filename"), meta.get("source_file"),
                meta.get("source"), meta.get("title"), meta.get("source_url")
            )
            return any(value and (str(value) == target or Path(str(value)).name == Path(target).name) for value in candidates)

        self._documents = [doc for doc in self._documents if not belongs_to_file(doc)]
        if len(self._documents) < original_count:
            self.build(self._documents)
            logger.info("Removed %d chunks for %s from BM25 index.", original_count - len(self._documents), filename)

    def search(self, query: str, top_k: int = 15) -> List[Tuple[BM25Document, float]]:
        """Search the BM25 index. Returns list of (document, score) tuples."""
        if self._bm25 is None or not self._documents:
            return []

        tokenized_query = self._tokenize(query)
        scores = self._bm25.get_scores(tokenized_query)

        # Get top-k indices sorted by score descending
        scored_indices = sorted(
            enumerate(scores), key=lambda x: x[1], reverse=True
        )[:top_k]

        return [
            (self._documents[idx], float(score))
            for idx, score in scored_indices
            if score > 0
        ]

    def save(self) -> None:
        """Persist the index to disk."""
        if self._persist_dir is None:
            return

        index_path = self._persist_dir / "bm25_index.pkl"
        docs_path = self._persist_dir / "bm25_docs.json"

        try:
            # Save documents as JSON for portability
            docs_data = [
                {"chunk_id": d.chunk_id, "text": d.text, "metadata": d.metadata}
                for d in self._documents
            ]
            docs_path.write_text(
                json.dumps(docs_data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            # Save BM25 model as pickle (faster to load)
            if self._bm25 is not None:
                with open(index_path, "wb") as f:
                    pickle.dump(self._bm25, f)

            logger.info("BM25 index saved to %s (%d docs).", self._persist_dir, len(self._documents))
        except Exception as exc:
            logger.error("Failed to save BM25 index: %s", exc)

    def load(self) -> bool:
        """Load index from disk. Returns True if successful."""
        if self._persist_dir is None:
            return False

        index_path = self._persist_dir / "bm25_index.pkl"
        docs_path = self._persist_dir / "bm25_docs.json"

        if not docs_path.exists():
            return False

        try:
            docs_data = json.loads(docs_path.read_text(encoding="utf-8"))
            self._documents = [
                BM25Document(
                    chunk_id=d["chunk_id"],
                    text=d["text"],
                    metadata=d["metadata"],
                )
                for d in docs_data
            ]

            if index_path.exists():
                with open(index_path, "rb") as f:
                    self._bm25 = pickle.load(f)
            else:
                # Rebuild from documents
                self.build(self._documents)

            logger.info("BM25 index loaded from %s (%d docs).", self._persist_dir, len(self._documents))
            return True
        except Exception as exc:
            logger.error("Failed to load BM25 index: %s", exc)
            return False

    def clear(self) -> None:
        """Clear the index."""
        self._documents.clear()
        self._bm25 = None
        logger.info("BM25 index cleared.")


# Module-level singletons per notebook
_indexes: LRUCache = LRUCache(maxsize=10)

def get_bm25_index(notebook_id: str) -> BM25Index:
    """Get or create the BM25 index instance for a specific notebook."""
    global _indexes
    if notebook_id not in _indexes:
        from src.utils.config import settings
        notebook_dir = settings.bm25_dir / notebook_id
        index = BM25Index(persist_dir=notebook_dir)
        # Attempt to load persisted index
        index.load()
        _indexes[notebook_id] = index
    return _indexes[notebook_id]

def delete_bm25_folder(notebook_id: str):
    """Delete the BM25 index directory and remove from memory."""
    import shutil
    from src.utils.config import settings
    global _indexes
    
    if notebook_id in _indexes:
        del _indexes[notebook_id]
        
    notebook_dir = settings.bm25_dir / notebook_id
    if notebook_dir.exists():
        try:
            shutil.rmtree(notebook_dir)
            logger.info("Deleted BM25 directory: %s", notebook_dir)
        except Exception as exc:
            logger.error("Failed to delete BM25 directory %s: %s", notebook_dir, exc)
