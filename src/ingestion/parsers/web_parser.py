import requests
from bs4 import BeautifulSoup
from typing import Optional
import re
import textwrap
from youtube_transcript_api import YouTubeTranscriptApi

from src.ingestion.schema import (
    DocumentNode, HeadingNode, ParagraphNode, CodeBlockNode, NodeType, Node
)
from src.utils.logger import logger


class WebParser:
    """Cào dữ liệu từ URL hoặc YouTube và bóc tách thành Cây Tài Liệu (Document Tree)."""
    
    def __init__(self, headers: Optional[dict] = None):
        self.headers = headers or {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
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

    def _parse_website(self, url: str) -> DocumentNode:
        logger.info(f"Đang cào dữ liệu từ Website: {url}")
        headers = self.headers
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        response.encoding = response.apparent_encoding

        soup = BeautifulSoup(response.text, "html.parser")

        # Xóa các thẻ rác và các hộp điều hướng Wikipedia/Web
        for junk in soup(["script", "style", "nav", "footer", "header", "aside", "form", "iframe", "noscript"]):
            junk.decompose()
        for junk_class in soup.select(".mw-editsection, .navbox, .vertical-navbox, .sidebar, .reflist, .hatnote, .mbox-small, .toc"):
            junk_class.decompose()

        title = soup.title.string.strip() if soup.title and soup.title.string else url
        doc_root = DocumentNode(
            node_type=NodeType.DOCUMENT,
            title=title,
            metadata={"source": url, "type": "website", "title": title}
        )

        main_content = soup.find("main") or soup.find("article") or soup.find("div", {"id": "mw-content-text"}) or soup.body
        if not main_content:
            return doc_root

        node_stack = [doc_root]

        for element in main_content.find_all(["h1", "h2", "h3", "h4", "p", "ul", "ol", "pre"]):
            # Bỏ qua thẻ p/li nằm lồng bên trong ul/ol đã được xử lý ở cấp ul/ol
            if element.name == "p" and element.find_parent(["ul", "ol", "table"]):
                continue

            if element.name in ["ul", "ol"]:
                if element.find_parent(["ul", "ol"]):
                    continue
                items = [
                    f"- {li.get_text(separator=' ', strip=True)}"
                    for li in element.find_all("li", recursive=False)
                    if len(li.get_text(strip=True)) > 3
                ]
                if items:
                    node_stack[-1].add_child(ParagraphNode(content="\n".join(items)))
                continue

            text = element.get_text(separator=" ", strip=True)
            if not text or len(text) <= 2:
                continue

            if element.name.startswith("h"):
                level = int(element.name[1])
                heading_node = HeadingNode(level=level, content=text)
                while (
                    len(node_stack) > 1
                    and isinstance(node_stack[-1], HeadingNode)
                    and node_stack[-1].level >= level
                ):
                    node_stack.pop()
                node_stack[-1].add_child(heading_node)
                node_stack.append(heading_node)

            elif element.name == "pre":
                node_stack[-1].add_child(CodeBlockNode(content=text, language="text"))
            else:
                node_stack[-1].add_child(ParagraphNode(content=text))

        return doc_root

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
            root = DocumentNode(metadata=meta, title=meta["title"])
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
                    root.title = title_text
                    
                    content = f"Tiêu đề video: {title_text}\n\nMô tả video:\n{desc_text}\n\n(Video này không có phụ đề công khai hoặc tắt CC)."
                    root.add_child(ParagraphNode(content=content))
                    return root
                except Exception as ex:
                    content = f"Không thể lấy dữ liệu từ video YouTube này.\nChi tiết lỗi: {str(ex)}"
                    root.add_child(ParagraphNode(content=content))
                    return root

        # 2. Xử lý website thông thường
        try:
            doc_root = self._parse_website(url)
            if source_metadata:
                doc_root.metadata.update(source_metadata)
            return doc_root
        except Exception as e:
            root = DocumentNode(metadata=meta, title=url)
            content = f"Không thể lấy dữ liệu từ URL này.\nChi tiết lỗi: {str(e)}"
            root.add_child(ParagraphNode(content=content))
            return root
