from typing import List, Dict, Any, Union
from dataclasses import dataclass, field
import re
import uuid

from src.ingestion.schema import (
    DocumentNode, NodeType, HeadingNode, ParagraphNode, TableNode, CodeBlockNode
)
from src.utils.logger import logger


@dataclass
class Chunk:
    """Đại diện cho 1 đoạn dữ liệu hoàn chỉnh sẵn sàng đem đi Embedding."""
    chunk_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    content: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __getitem__(self, item):
        if item == "content":
            return self.content
        elif item == "metadata":
            return self.metadata
        elif item == "chunk_id":
            return self.chunk_id
        raise KeyError(item)

    def get(self, item, default=None):
        if item == "content":
            return self.content
        elif item == "metadata":
            return self.metadata
        elif item == "chunk_id":
            return self.chunk_id
        return default


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


class AdaptiveChunker:
    """
    Hệ thống phân mảnh thông minh (Context-Aware + Buffer Merging):
    - Gom các Paragraph ngắn / List items liền kề trong cùng 1 Heading lại với nhau.
    - Bảo toàn nguyên vẹn Bảng (Table) và Khối Code (CodeBlock).
    - Tự động đính kèm Breadcrumbs (Ngữ cảnh tiêu đề cha) vào đầu mỗi Chunk.
    """
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200, min_chunk_length: int = 40, embedder=None):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_length = min_chunk_length
        self.embedder = embedder

    def chunk_text(self, text: str) -> List[str]:
        """Chia văn bản dài thành các đoạn nhỏ theo câu hoàn chỉnh."""
        if len(text) <= self.chunk_size:
            return [text]

        sentences = re.split(r'(?<=[.!?])\s+|\n+', text)
        chunks = []
        current_chunk = ""

        for sentence in sentences:
            if not sentence.strip():
                continue
            if len(current_chunk) + len(sentence) + 1 <= self.chunk_size:
                current_chunk += (" " if current_chunk else "") + sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())

                if len(sentence) > self.chunk_size:
                    for i in range(0, len(sentence), max(1, self.chunk_size - self.chunk_overlap)):
                        chunks.append(sentence[i:i + self.chunk_size].strip())
                    current_chunk = ""
                else:
                    overlap_text = current_chunk[-self.chunk_overlap:] if len(current_chunk) > self.chunk_overlap else current_chunk
                    current_chunk = (overlap_text + " " + sentence).strip()

        if current_chunk:
            chunks.append(current_chunk.strip())

        return chunks

    def process_document(self, doc_tree: DocumentNode) -> List[Chunk]:
        logger.info(f"Bắt đầu phân mảnh tài liệu (Adaptive Buffer): {getattr(doc_tree, 'title', 'Tài liệu')}")
        chunks: List[Chunk] = []
        source_name = doc_tree.metadata.get("source", getattr(doc_tree, "title", "Tài liệu"))
        notebook_id = doc_tree.metadata.get("notebook_id", "default")

        def traverse(node: DocumentNode, current_breadcrumbs: List[str]):
            breadcrumbs = list(current_breadcrumbs)
            if isinstance(node, HeadingNode) and node.content:
                breadcrumbs.append(node.content.strip())

            context_prefix = " > ".join(breadcrumbs)
            prefix_str = f"[{context_prefix}]\n" if context_prefix else ""

            # Bộ đệm gom các ParagraphNode liên tiếp trong cùng một cấp node
            paragraph_buffer: List[str] = []
            buffer_pages: List[int] = []

            def flush_paragraph_buffer():
                nonlocal paragraph_buffer, buffer_pages
                if not paragraph_buffer:
                    return
                merged_text = "\n".join(paragraph_buffer).strip()
                paragraph_buffer = []
                first_page = buffer_pages[0] if buffer_pages else getattr(node, "page_number", 1)
                buffer_pages = []

                if len(merged_text) < self.min_chunk_length and chunks:
                    # Nếu đoạn gộp vẫn quá ngắn, nối vào chunk liền trước nếu cùng source
                    chunks[-1].content += f"\n{merged_text}"
                    return

                sub_texts = self.chunk_text(merged_text)
                for st in sub_texts:
                    if not st.strip():
                        continue
                    chunks.append(Chunk(
                        content=f"{prefix_str}{st}",
                        metadata={
                            "source": source_name,
                            "type": "text",
                            "breadcrumbs": context_prefix,
                            "page": first_page,
                            "notebook_id": notebook_id
                        }
                    ))

            # Nếu bản thân node gốc là Paragraph/Table/Code (trường hợp không có Heading bọc ngoài)
            if isinstance(node, ParagraphNode) and node.content.strip():
                paragraph_buffer.append(node.content.strip())
                buffer_pages.append(getattr(node, "page_number", 1))
                flush_paragraph_buffer()

            elif isinstance(node, TableNode):
                table_content = getattr(node, "markdown", None) or node.content
                if table_content and table_content.strip():
                    chunks.append(Chunk(
                        content=f"{prefix_str}Bảng dữ liệu:\n{table_content}",
                        metadata={
                            "source": source_name,
                            "type": "table",
                            "breadcrumbs": context_prefix,
                            "page": getattr(node, "page_number", 1),
                            "notebook_id": notebook_id
                        }
                    ))

            elif isinstance(node, CodeBlockNode) and node.content.strip():
                lang = getattr(node, "language", "text")
                chunks.append(Chunk(
                    content=f"{prefix_str}Đoạn mã ({lang}):\n```{lang}\n{node.content}\n```",
                    metadata={
                        "source": source_name,
                        "type": "code",
                        "language": lang,
                        "breadcrumbs": context_prefix,
                        "page": getattr(node, "page_number", 1),
                        "notebook_id": notebook_id
                    }
                ))

            # Duyệt qua các node con và gộp các ParagraphNode liên tiếp
            for child in getattr(node, "children", []):
                if isinstance(child, ParagraphNode):
                    text = child.content.strip()
                    if not text:
                        continue
                    current_len = sum(len(x) for x in paragraph_buffer)
                    if current_len + len(text) + 1 <= self.chunk_size:
                        paragraph_buffer.append(text)
                        if getattr(child, "page_number", None):
                            buffer_pages.append(child.page_number)
                    else:
                        flush_paragraph_buffer()
                        paragraph_buffer.append(text)
                        if getattr(child, "page_number", None):
                            buffer_pages.append(child.page_number)
                else:
                    # Gặp Heading mới, Table hoặc CodeBlock thì xả buffer hiện tại trước
                    flush_paragraph_buffer()
                    traverse(child, breadcrumbs)

            flush_paragraph_buffer()

        traverse(doc_tree, [])
        logger.info(f"Hoàn tất phân mảnh! Tổng số Chunks tạo ra: {len(chunks)}")
        return chunks
