from typing import List, Dict, Any, Optional
from enum import Enum


class NodeType(str, Enum):
    DOCUMENT = "Document"
    HEADING = "Heading"
    PARAGRAPH = "Paragraph"
    TABLE = "Table"
    CODE_BLOCK = "CodeBlock"
    LIST = "List"
    LIST_ITEM = "ListItem"
    IMAGE = "Image"


class Node:
    """Lớp cơ sở cho tất cả các nút trong Cây Tài Liệu."""
    def __init__(
        self, 
        node_type: str = "Node", 
        content: str = "", 
        metadata: Optional[Dict[str, Any]] = None,
        page_number: int = 1
    ):
        self.node_type = str(node_type.value if hasattr(node_type, "value") else node_type)
        self.content = content
        self.metadata = metadata.copy() if metadata else {}
        self.page_number = self.metadata.get("page", page_number)
        self.children: List['Node'] = []
        self.parent: Optional['Node'] = None

    def add_child(self, child: 'Node'):
        child.parent = self
        merged_meta = self.metadata.copy()
        merged_meta.update(child.metadata)
        child.metadata = merged_meta
        if not getattr(child, "page_number", None):
            child.page_number = self.page_number
        self.children.append(child)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.node_type,
            "content": self.content,
            "metadata": self.metadata,
            "children": [child.to_dict() for child in self.children]
        }


class DocumentNode(Node):
    def __init__(
        self, 
        node_type: NodeType = NodeType.DOCUMENT, 
        title: str = "", 
        content: str = "", 
        metadata: Optional[Dict[str, Any]] = None
    ):
        meta = metadata.copy() if metadata else {}
        if title and "title" not in meta:
            meta["title"] = title
        super().__init__(node_type=node_type, content=content or title, metadata=meta)
        self.title = title or self.metadata.get("title") or self.metadata.get("source", "Tài liệu")


class HeadingNode(Node):
    def __init__(self, level: int = 1, content: str = "", metadata: Optional[Dict[str, Any]] = None):
        super().__init__(NodeType.HEADING, content, metadata)
        self.level = level
        self.metadata["heading_level"] = level


class ParagraphNode(Node):
    def __init__(
        self, 
        content: str = "", 
        metadata: Optional[Dict[str, Any]] = None, 
        page_number: int = 1
    ):
        super().__init__(NodeType.PARAGRAPH, content, metadata, page_number=page_number)


class TableNode(Node):
    def __init__(
        self, 
        markdown_table: str = "", 
        content: str = "", 
        markdown: str = "", 
        metadata: Optional[Dict[str, Any]] = None,
        page_number: int = 1
    ):
        tbl = markdown or markdown_table or content
        super().__init__(NodeType.TABLE, tbl, metadata, page_number=page_number)
        self.markdown = tbl


class ImageNode(Node):
    def __init__(
        self, 
        alt_text: str = "", 
        url: str = "", 
        description: str = "", 
        metadata: Optional[Dict[str, Any]] = None
    ):
        super().__init__(NodeType.IMAGE, description, metadata)
        self.alt_text = alt_text
        self.url = url
        self.metadata["image_url"] = url


class CodeBlockNode(Node):
    def __init__(
        self, 
        language: str = "text", 
        code: str = "", 
        content: str = "", 
        metadata: Optional[Dict[str, Any]] = None,
        page_number: int = 1
    ):
        c = code or content
        super().__init__(NodeType.CODE_BLOCK, c, metadata, page_number=page_number)
        self.language = language
        self.metadata["code_language"] = language


class ListNode(Node):
    def __init__(self, is_ordered: bool = False, metadata: Optional[Dict[str, Any]] = None):
        super().__init__(NodeType.LIST, metadata=metadata)
        self.is_ordered = is_ordered


class ListItemNode(Node):
    def __init__(self, content: str = "", metadata: Optional[Dict[str, Any]] = None):
        super().__init__(NodeType.LIST_ITEM, content, metadata)
