import re
import numpy as np
from typing import List, Dict, Any
from .document_tree import DocumentNode, HeadingNode, ParagraphNode, TableNode, CodeBlockNode, ListItemNode, Node
from ..utils.config import settings

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    denom = np.linalg.norm(v1) * np.linalg.norm(v2)
    if denom == 0:
        return 0.0
    return float(np.dot(v1, v2) / denom)

class RecursiveCharacterChunker:
    """Chia văn bản dựa trên số lượng ký tự đệ quy (Nhanh, cho CPU)."""
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_text(self, text: str) -> List[str]:
        words = text.split(' ')
        chunks = []
        current_chunk = []
        current_length = 0
        
        for word in words:
            word_len = len(word) + 1
            if current_length + word_len > self.chunk_size and current_length > 0:
                chunks.append(" ".join(current_chunk))
                overlap_words = []
                overlap_length = 0
                for w in reversed(current_chunk):
                    if overlap_length + len(w) + 1 <= self.chunk_overlap:
                        overlap_words.insert(0, w)
                        overlap_length += len(w) + 1
                    else:
                        break
                current_chunk = overlap_words
                current_length = overlap_length

            current_chunk.append(word)
            current_length += word_len
            
        if current_chunk:
            chunks.append(" ".join(current_chunk))
        return chunks

class SemanticChunker:
    """Chia văn bản dựa trên khoảng cách ngữ nghĩa (Cần GPU/MPS)."""
    def __init__(self, embedder, threshold: float = 0.75):
        self.embedder = embedder
        self.threshold = threshold

    def chunk_text(self, text: str) -> List[str]:
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
        if not sentences:
            return []
        if len(sentences) == 1:
            return sentences
            
        embeddings = self.embedder.embed_documents(sentences)
        
        chunks = []
        current_chunk = [sentences[0]]
        
        for i in range(1, len(sentences)):
            sim = cosine_similarity(embeddings[i-1], embeddings[i])
            if sim >= self.threshold and sum(len(s) for s in current_chunk) < 1500:
                current_chunk.append(sentences[i])
            else:
                chunks.append(" ".join(current_chunk))
                current_chunk = [sentences[i]]
                
        if current_chunk:
            chunks.append(" ".join(current_chunk))
            
        return chunks

class AdaptiveChunker:
    """Tự động lựa chọn phương pháp Chunking phù hợp với phần cứng."""
    
    def __init__(self, embedder=None):
        self.tier = self._get_hardware_tier()
        
        if self.tier in [1, 2] and embedder is not None:
            print("[AdaptiveChunker] Chế độ GPU/MPS: Kích hoạt Semantic Chunking.")
            self.chunker = SemanticChunker(embedder=embedder, threshold=0.75)
        else:
            print("[AdaptiveChunker] Chế độ Tốc độ cao: Kích hoạt Recursive Character Chunking.")
            self.chunker = RecursiveCharacterChunker(
                chunk_size=settings.chunk_size, 
                chunk_overlap=settings.chunk_overlap
            )

    def _get_hardware_tier(self) -> int:
        from ..utils.hardware_profiler import ModelZooManager
        manager = ModelZooManager()
        return manager.get_tier()

    def process_document(self, document_node: DocumentNode) -> List[Dict[str, Any]]:
        """Duyệt Cây Tài liệu (DFS) và chunking mọi Node nội dung (Paragraph, Table, CodeBlock, ListItem)."""
        final_chunks = []
        current_heading = ""
        
        def traverse(node: Node):
            nonlocal current_heading
            if isinstance(node, HeadingNode) and node.content.strip():
                current_heading = node.content.strip()

            elif isinstance(node, (ParagraphNode, TableNode, CodeBlockNode, ListItemNode)) and node.content.strip():
                raw_content = node.content.strip()
                if isinstance(node, CodeBlockNode):
                    lang = getattr(node, "language", "")
                    raw_content = f"```{lang}\n{raw_content}\n```"
                
                text_chunks = self.chunker.chunk_text(raw_content)
                for chunk_text in text_chunks:
                    meta = node.metadata.copy()
                    if current_heading and "heading_level_1" not in meta:
                        meta["heading_level_1"] = current_heading
                    final_chunks.append({
                        "content": chunk_text,
                        "metadata": meta
                    })
            
            for child in node.children:
                traverse(child)

        traverse(document_node)
        return final_chunks
