import os
import logging
import asyncio
from typing import Optional, List, Tuple
from ..llm.llm_client import LLMEngine
from ..db.session_manager import SessionManager

logger = logging.getLogger(__name__)

class PodcastGenerator:
    def __init__(self, llm_engine: LLMEngine, session_manager: SessionManager):
        self.llm = llm_engine
        self.db = session_manager
        self.output_dir = "storage/podcasts"
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_podcast(
        self, 
        notebook_id: str, 
        is_private: bool = True, 
        gemini_api_key: Optional[str] = None,
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        focus_topic: Optional[str] = None,
        style: Optional[str] = "fun",
        custom_context: Optional[str] = None
    ) -> str:
        """Sinh Podcast MP3 2 giọng đọc (MC Nam & MC Nữ) dựa trên tài liệu được chọn hoặc Study Guide."""
        guide = self.db.get_study_guide(notebook_id)
        summary = ""
        if custom_context and custom_context.strip():
            summary = custom_context.strip()
        elif guide and guide.get('summary'):
            summary = f"{guide.get('summary', '')}\n\n{guide.get('glossary', '')}"
        else:
            summary = "Tài liệu kiến thức tổng hợp."
        
        style_instructions = {
            "fun": "Phong cách trò chuyện: Hài hước, sôi nổi, dí dỏm, sử dụng ngôn từ đời thường gần gũi, nhiều năng lượng.",
            "academic": "Phong cách trò chuyện: Học thuật, phân tích chuyên sâu, đi thẳng vào bản chất vấn đề và logic chặt chẽ.",
            "debate": "Phong cách trò chuyện: Tranh luận phản biện, một người nêu quan điểm/thắc mắc, người kia bổ sung hoặc phản biện sắc bén."
        }
        chosen_style = style_instructions.get(style, style_instructions["fun"])
        topic_clause = f"\nCHỦ ĐỀ TRỌNG TÂM: Tập trung thảo luận sâu về '{focus_topic.strip()}'.\n" if focus_topic and focus_topic.strip() else ""

        prompt = (
            f"Dưới đây là nội dung tài liệu:\n{summary[:5000]}\n\n"
            f"{topic_clause}"
            f"{chosen_style}\n"
            f"Hãy viết một kịch bản trò chuyện Podcast (khoảng 6-10 lượt thoại) giữa 2 người dẫn chương trình: "
            f"MC Nam (A - Minh) và MC Nữ (B - My), thảo luận sinh động về nội dung trên.\n"
            f"Định dạng BẮT BUỘC trên từng dòng như sau, không dùng markdown đậm/nghiêng ở tên nhân vật:\n"
            f"A: [Lời thoại của A]\n"
            f"B: [Lời thoại của B]\n"
        )
        
        logger.info(f"Đang sinh kịch bản Podcast cho notebook {notebook_id} (Focus: '{focus_topic}', Style: '{style}')...")
        script_raw = "".join(self.llm.generate(
            prompt, 
            system_prompt="Bạn là biên kịch Podcast chuyên nghiệp. Chỉ xuất ra các dòng thoại bắt đầu bằng 'A:' hoặc 'B:'.",
            is_private=is_private,
            gemini_api_key=api_key or gemini_api_key,
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url
        ))
        
        dialogues = []
        for line in script_raw.split('\n'):
            clean_line = line.strip().lstrip('*').lstrip('-').strip()
            if clean_line.startswith(('A:', 'Host A:', 'Nam:', 'Minh:')):
                text_part = clean_line.split(':', 1)[1].strip().strip('*')
                if text_part:
                    dialogues.append(('A', text_part))
            elif clean_line.startswith(('B:', 'Host B:', 'Nữ:', 'My:')):
                text_part = clean_line.split(':', 1)[1].strip().strip('*')
                if text_part:
                    dialogues.append(('B', text_part))
                
        if not dialogues:
            dialogues = [
                ('A', 'Chào các bạn thính giả, chào mừng đến với buổi phân tích tài liệu trên NotebookLM Mini hôm nay!'),
                ('B', 'Chào anh Minh và các bạn! Chủ đề trong sổ tay hôm nay có rất nhiều điểm thú vị đáng chú ý.'),
                ('A', f'Đúng vậy! Điểm cốt lõi đầu tiên mà tài liệu đề cập là: {summary[:250]}'),
                ('B', 'Thật sự rất súc tích và hữu ích. Các bạn có thể xem thêm ở phần Sơ đồ tư duy hoặc Thẻ ghi nhớ để ôn tập kỹ hơn nhé!')
            ]
            
        output_file = os.path.join(self.output_dir, f"{notebook_id}.mp3")
        
        try:
            self._generate_with_edge_tts_multi_voice(dialogues, output_file)
        except Exception as e:
            logger.warning(f"edge-tts không khả dụng: {e}, chuyển sang phương thức dự phòng...")
            try:
                self._generate_offline(dialogues, output_file)
            except Exception as ex:
                logger.error(f"Tạo audio thất bại: {ex}. Tạo file âm thanh mẫu...")
                self._create_dummy_audio(output_file)
                
        return output_file

    def _generate_with_edge_tts_multi_voice(self, dialogues: List[Tuple[str, str]], output_file: str):
        """Sử dụng edge-tts ghép trực tiếp luồng âm thanh 2 giọng Nam & Nữ chuẩn xác."""
        import edge_tts
        
        voice_a = "vi-VN-NamMinhNeural"
        voice_b = "vi-VN-HoaiMyNeural"

        async def _synthesize_all():
            with open(output_file, "wb") as out_f:
                for speaker, text in dialogues:
                    if not text.strip():
                        continue
                    voice = voice_a if speaker == 'A' else voice_b
                    communicate = edge_tts.Communicate(text, voice)
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            out_f.write(chunk["data"])

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                from concurrent.futures import ThreadPoolExecutor
                with ThreadPoolExecutor() as pool:
                    pool.submit(lambda: asyncio.run(_synthesize_all())).result()
            else:
                loop.run_until_complete(_synthesize_all())
        except Exception:
            asyncio.run(_synthesize_all())

    def _generate_offline(self, dialogues: List[Tuple[str, str]], output_file: str):
        import pyttsx3
        engine = pyttsx3.init()
        full_text = " ... ".join([text for _, text in dialogues])
        engine.save_to_file(full_text, output_file)
        engine.runAndWait()

    def _create_dummy_audio(self, output_file: str):
        import wave
        import struct
        import shutil
        wav_path = output_file.replace(".mp3", ".wav")
        with wave.open(wav_path, 'w') as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(44100)
            for i in range(44100 * 2):
                value = int(32767.0 * 0.1 * (i % 100) / 100)
                data = struct.pack('<h', value)
                f.writeframesraw(data)
        if os.path.exists(wav_path) and not os.path.exists(output_file):
            shutil.copy(wav_path, output_file)
