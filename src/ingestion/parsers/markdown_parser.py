import re
from typing import List
from ..document_tree import DocumentNode, HeadingNode, ParagraphNode, CodeBlockNode, TableNode, Node

class MarkdownParser:
    """Phân tích chuỗi Markdown thô thành Cây Tài Liệu (Document Tree) bảo toàn Bảng và Code."""
    
    def parse(self, markdown_text: str, source_metadata: dict = None) -> DocumentNode:
        root = DocumentNode(metadata=source_metadata or {})
        
        blocks = re.split(r'(?m)^(#+ .*)$', markdown_text)
        
        current_parent: Node = root
        heading_stack: List[HeadingNode] = []
        
        for block in blocks:
            block = block.strip()
            if not block:
                continue
                
            heading_match = re.match(r'^(#+)\s+(.*)$', block)
            if heading_match:
                level = len(heading_match.group(1))
                title = heading_match.group(2).strip()
                heading_node = HeadingNode(level=level, content=title)
                
                while heading_stack and heading_stack[-1].level >= level:
                    heading_stack.pop()
                    
                if heading_stack:
                    heading_stack[-1].add_child(heading_node)
                else:
                    root.add_child(heading_node)
                    
                heading_stack.append(heading_node)
                current_parent = heading_node
            else:
                # Tách nhỏ các đoạn theo khối trống (\n\n) để phân biệt Code, Table và Paragraph
                sub_blocks = re.split(r'\n\s*\n', block)
                for sb in sub_blocks:
                    sb = sb.strip()
                    if not sb:
                        continue
                    if sb.startswith("```"):
                        lines = sb.split('\n')
                        lang = lines[0].replace('```', '').strip()
                        code = '\n'.join(lines[1:-1]) if len(lines) > 2 else '\n'.join(lines[1:])
                        current_parent.add_child(CodeBlockNode(language=lang, code=code))
                    elif sb.startswith("|") and "|" in sb[1:]:
                        current_parent.add_child(TableNode(markdown_table=sb))
                    else:
                        current_parent.add_child(ParagraphNode(content=sb))
                    
        return root
