import re
from typing import Optional, List, Dict
from youtube_transcript_api import YouTubeTranscriptApi

from ..document_tree import DocumentNode, HeadingNode, ParagraphNode

class YouTubeParser:
    """Parser lấy phụ đề từ YouTube và chuyển thành Document Tree."""

    def __init__(self):
        # Biểu thức chính quy để tìm ID video từ các định dạng URL YouTube khác nhau
        self.yt_pattern = re.compile(
            r'(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})'
        )

    def extract_video_id(self, url: str) -> Optional[str]:
        match = self.yt_pattern.search(url)
        if match:
            return match.group(1)
        return None

    def _group_transcript_into_paragraphs(self, transcript: List[Dict], max_duration: float = 30.0) -> List[Dict]:
        """Gộp các dòng transcript ngắn thành các đoạn văn theo khoảng thời gian."""
        paragraphs = []
        current_text = []
        current_start = 0.0
        current_duration = 0.0

        if not transcript:
            return paragraphs

        current_start = transcript[0]['start']

        for item in transcript:
            text = item['text'].strip()
            # Bỏ qua các chuỗi như [Âm nhạc]
            if text.startswith('[') and text.endswith(']'):
                continue
                
            current_text.append(text)
            current_duration = (item['start'] + item['duration']) - current_start

            if current_duration >= max_duration:
                paragraphs.append({
                    'text': " ".join(current_text).replace('\n', ' '),
                    'start': current_start,
                    'end': current_start + current_duration
                })
                current_text = []
                current_start = item['start'] + item['duration']
                current_duration = 0.0

        # Thêm phần còn lại
        if current_text:
            paragraphs.append({
                'text': " ".join(current_text).replace('\n', ' '),
                'start': current_start,
                'end': current_start + current_duration
            })

        return paragraphs

    def parse(self, url: str, source_metadata: Optional[dict] = None) -> DocumentNode:
        video_id = self.extract_video_id(url)
        if not video_id:
            raise ValueError(f"Không thể trích xuất ID video từ URL: {url}")

        # Lấy transcript ưu tiên Tiếng Việt (vi), sau đó Tiếng Anh (en)
        try:
            if hasattr(YouTubeTranscriptApi, "get_transcript"):
                transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['vi', 'en'])
            else:
                ytt = YouTubeTranscriptApi()
                raw_t = ytt.fetch(video_id, languages=['vi', 'en'])
                transcript = []
                for item in raw_t:
                    t_text = getattr(item, 'text', None) or (item.get('text', '') if isinstance(item, dict) else str(item))
                    t_start = getattr(item, 'start', None) or (item.get('start', 0.0) if isinstance(item, dict) else 0.0)
                    t_dur = getattr(item, 'duration', None) or (item.get('duration', 0.0) if isinstance(item, dict) else 0.0)
                    transcript.append({'text': t_text, 'start': float(t_start), 'duration': float(t_dur)})
        except Exception as e:
            raise RuntimeError(f"Không thể lấy phụ đề cho video {video_id}. Lỗi: {str(e)}")

        # Xây dựng metadata
        meta = source_metadata or {}
        meta["source_url"] = url
        meta["video_id"] = video_id
        meta["parser"] = "YouTubeParser"

        # Khởi tạo Document Tree
        doc_node = DocumentNode(metadata=meta)
        
        # Thêm Title ảo (Vì youtube_transcript_api không lấy được Title)
        doc_node.add_child(HeadingNode(level=1, content=f"YouTube Video: {video_id}"))

        # Gộp các câu thành Paragraphs
        paragraphs = self._group_transcript_into_paragraphs(transcript, max_duration=45.0)

        for p in paragraphs:
            p_meta = {
                "timestamp_start": round(p['start'], 2),
                "timestamp_end": round(p['end'], 2),
                "timestamp_display": f"[{int(p['start']//60):02d}:{int(p['start']%60):02d} - {int(p['end']//60):02d}:{int(p['end']%60):02d}]"
            }
            # Nội dung đi kèm cả hiển thị thời gian để Markdown renderer xuất ra đẹp hơn
            content = f"{p_meta['timestamp_display']} {p['text']}"
            doc_node.add_child(ParagraphNode(content=content, metadata=p_meta))

        return doc_node
