import requests
from bs4 import BeautifulSoup
from typing import Optional
import re
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

from ..document_tree import DocumentNode, HeadingNode, ParagraphNode, Node

class WebParser:
    """Cào dữ liệu từ URL và bóc tách thành Cây Tài Liệu (Document Tree)."""
    
    def __init__(self, headers: Optional[dict] = None):
        self.headers = headers or {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

    def parse(self, url: str, source_metadata: Optional[dict] = None) -> DocumentNode:
        meta = source_metadata or {}
        meta["source_url"] = url
        meta["parser"] = "WebParser"

        # 1. Kiểm tra nếu là link YouTube
        youtube_regex = r"(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})"
        match = re.search(youtube_regex, url)
        if match:
            video_id = match.group(1)
            meta["title"] = f"YouTube Video: {video_id}"
            meta["parser"] = "YouTubeTranscript"
            root = DocumentNode(metadata=meta)
            try:
                # Ưu tiên lấy phụ đề tiếng Việt, nếu không có lấy tiếng Anh
                transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['vi', 'en'])
                full_text = " ".join([entry['text'] for entry in transcript])
                
                # Chia thành các đoạn (paragraphs) nhỏ để Chunking dễ dàng
                import textwrap
                paragraphs = textwrap.wrap(full_text, width=1500)
                for p in paragraphs:
                    root.add_child(ParagraphNode(content=p))
                return root
            except Exception as e:
                # Nếu không thể lấy phụ đề, ta fallback sang việc lấy Title và Description của video
                try:
                    res = requests.get(url, headers=self.headers, timeout=10)
                    soup = BeautifulSoup(res.text, 'html.parser')
                    title = soup.find("meta", property="og:title")
                    title_text = title.get("content", f"YouTube Video: {video_id}") if title else f"YouTube Video: {video_id}"
                    desc = soup.find("meta", property="og:description")
                    desc_text = desc.get("content", "Không có mô tả.") if desc else "Không có mô tả."
                    
                    meta["title"] = title_text
                    root.metadata["title"] = title_text
                    
                    content = f"Tiêu đề video: {title_text}\n\nMô tả video:\n{desc_text}\n\n(Video này không hỗ trợ trích xuất phụ đề tự động hoặc bị lỗi mạng)."
                    root.add_child(ParagraphNode(content=content))
                    return root
                except Exception as ex:
                    content = f"Không thể lấy dữ liệu từ video YouTube này.\nChi tiết lỗi: {str(ex)}"
                    root.add_child(ParagraphNode(content=content))
                    return root
        # 2. Xử lý trang web thông thường
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
        except Exception as e:
            root = DocumentNode(metadata=meta)
            content = f"Không thể lấy dữ liệu từ URL này.\nChi tiết lỗi: {str(e)}"
            root.add_child(ParagraphNode(content=content))
            return root

        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Xóa bỏ các tag không cần thiết như script, style, nav, footer
        for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
            element.decompose()

        title_text = str(soup.title.string).strip() if (soup.title and soup.title.string) else "Untitled Webpage"
        meta["title"] = title_text

        root = DocumentNode(metadata=meta)
        
        # Thu thập nội dung chính
        # Tìm thẻ main, article hoặc body
        main_content = soup.find('main') or soup.find('article') or soup.body
        
        if not main_content:
            return root

        current_parent: Node = root
        heading_stack = []

        for tag in main_content.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li']):
            text = tag.get_text(strip=True)
            if not text:
                continue

            if tag.name.startswith('h'):
                level = int(tag.name[1])
                heading_node = HeadingNode(level=level, content=text)
                
                while heading_stack and heading_stack[-1].level >= level:
                    heading_stack.pop()
                    
                if heading_stack:
                    heading_stack[-1].add_child(heading_node)
                else:
                    root.add_child(heading_node)
                    
                heading_stack.append(heading_node)
                current_parent = heading_node
            elif tag.name == 'p':
                current_parent.add_child(ParagraphNode(content=text))
            elif tag.name == 'li':
                current_parent.add_child(ParagraphNode(content=f"- {text}")) # Simple list mapping
                
        return root
