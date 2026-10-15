import requests
from bs4 import BeautifulSoup
from typing import Optional
import re
import textwrap
from youtube_transcript_api import YouTubeTranscriptApi

from ..document_tree import DocumentNode, HeadingNode, ParagraphNode, Node

class WebParser:
    """Cào dữ liệu từ URL hoặc YouTube và bóc tách thành Cây Tài Liệu (Document Tree)."""
    
    def __init__(self, headers: Optional[dict] = None):
        self.headers = headers or {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

    def _fetch_youtube_transcript_text(self, video_id: str) -> str:
        """Hỗ trợ cả youtube-transcript-api < 1.0.0 và >= 1.0.0."""
        if hasattr(YouTubeTranscriptApi, "get_transcript"):
            transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['vi', 'en'])
            return " ".join([entry.get('text', '') for entry in transcript])
        else:
            ytt_api = YouTubeTranscriptApi()
            fetched = ytt_api.fetch(video_id, languages=['vi', 'en'])
            texts = []
            for item in fetched:
                txt = item.text if hasattr(item, 'text') else item.get('text', '')
                texts.append(txt)
            return " ".join(texts)

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
                full_text = self._fetch_youtube_transcript_text(video_id)
                paragraphs = textwrap.wrap(full_text, width=1500)
                for p in paragraphs:
                    root.add_child(ParagraphNode(content=p))
                return root
            except Exception:
                try:
                    res = requests.get(url, headers=self.headers, timeout=10)
                    soup = BeautifulSoup(res.text, 'html.parser')
                    title = soup.find("meta", property="og:title")
                    title_text = title.get("content", f"YouTube Video: {video_id}") if title else f"YouTube Video: {video_id}"
                    desc = soup.find("meta", property="og:description")
                    desc_text = desc.get("content", "Không có mô tả.") if desc else "Không có mô tả."
                    
                    meta["title"] = title_text
                    root.metadata["title"] = title_text
                    
                    content = f"Tiêu đề video: {title_text}\n\nMô tả video:\n{desc_text}\n\n(Video này không có phụ đề công khai hoặc tắt CC)."
                    root.add_child(ParagraphNode(content=content))
                    return root
                except Exception as ex:
                    content = f"Không thể lấy dữ liệu từ video YouTube này.\nChi tiết lỗi: {str(ex)}"
                    root.add_child(ParagraphNode(content=content))
                    return root

        # 2. Xử lý trang web thông thường
        try:
            response = requests.get(url, headers=self.headers, timeout=12)
            response.raise_for_status()
        except Exception as e:
            root = DocumentNode(metadata=meta)
            content = f"Không thể lấy dữ liệu từ URL này.\nChi tiết lỗi: {str(e)}"
            root.add_child(ParagraphNode(content=content))
            return root

        soup = BeautifulSoup(response.text, 'html.parser')
        
        for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
            element.decompose()

        title_text = str(soup.title.string).strip() if (soup.title and soup.title.string) else url
        meta["title"] = title_text

        root = DocumentNode(metadata=meta)
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
                current_parent.add_child(ParagraphNode(content=f"- {text}"))
                
        return root
