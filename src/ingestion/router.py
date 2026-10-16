import os
from .parsers.web_parser import WebParser
from .parsers.markitdown_parser import MarkItDownParser
from .parsers.text_parser import TextParser
from .parsers.audio_parser import AudioParser
from .parsers.image_parser import ImageParser


class DocumentRouter:
    """Tự động điều hướng và chọn Parser phù hợp với định dạng tài liệu hoặc URL."""
    
    @staticmethod
    def get_parser(source: str):
        if source.startswith("http://") or source.startswith("https://"):
            return WebParser()
        
        ext = os.path.splitext(source)[1].lower()
        if ext in [".mp3", ".wav", ".m4a"]:
            return AudioParser()
        elif ext in [".png", ".jpg", ".jpeg", ".webp"]:
            return ImageParser()
        elif ext in [".txt"]:
            return TextParser()
        else:
            return MarkItDownParser()
