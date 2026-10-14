import os
import re
import uuid
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
        base_url: Optional[str] = None
    ) -> str:
        """Sinh Podcast MP3 dựa trên Study Guide hoặc tài liệu."""
        guide = self.db.get_study_guide(notebook_id)
        summary = guide.get('summary', '') if guide else 'Tài liệu kiến thức tổng hợp.'
        faq = guide.get('faq', '') if guide else ''
        
        # 1. Sinh kịch bản bằng LLM
        prompt = (
            f"Dưới đây là tóm tắt tài liệu:\n{summary[:2500]}\n\n"
            f"Hãy viết một kịch bản trò chuyện Podcast ngắn (khoảng 4-6 lượt thoại) giữa 2 người: "
            f"MC Nam (A) và MC Nữ (B), thảo luận sinh động về nội dung trên.\n"
            f"Định dạng BẮT BUỘC như sau, không thêm lời chào ngoài kịch bản:\n"
            f"A: [Lời thoại của A]\n"
            f"B: [Lời thoại của B]\n"
        )
        
        logger.info(f"Đang sinh kịch bản Podcast cho notebook {notebook_id}...")
        script_raw = "".join(self.llm.generate(
            prompt, 
            system_prompt="Bạn là biên kịch Podcast chuyên nghiệp, hài hước và giàu kiến thức.",
            is_private=is_private,
            gemini_api_key=api_key or gemini_api_key,
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url
        ))
        
        # 2. Parse kịch bản
        dialogues = []
        for line in script_raw.split('\n'):
            line = line.strip()
            if line.startswith(('A:', 'Host A:', 'Nam:')):
                dialogues.append(('A', line.split(':', 1)[1].strip()))
            elif line.startswith(('B:', 'Host B:', 'Nữ:')):
                dialogues.append(('B', line.split(':', 1)[1].strip()))
                
        if not dialogues:
            dialogues = [
                ('A', 'Chào các bạn, chào mừng đến với buổi thảo luận tài liệu hôm nay!'),
                ('B', 'Chào anh! Tài liệu hôm nay có rất nhiều điểm thú vị đáng chú ý.')
            ]
            
        output_file = os.path.join(self.output_dir, f"{notebook_id}.mp3")
        
        # 3. Tạo âm thanh
        try:
            # Thử dùng edge-tts nếu có internet
            self._generate_with_edge_tts(dialogues, output_file)
        except Exception as e:
            logger.warning(f"edge-tts không khả dụng: {e}, chuyển sang phương thức dự phòng...")
            try:
                self._generate_offline(dialogues, output_file)
            except Exception as ex:
                logger.error(f"Tạo audio thất bại: {ex}. Tạo file âm thanh im lặng/mẫu...")
                self._create_dummy_audio(output_file)
                
        return output_file

    def _generate_with_edge_tts(self, dialogues: List[Tuple[str, str]], output_file: str):
        """Sử dụng edge-tts trực tiếp để tạo audio tiếng Việt chất lượng cao."""
        import edge_tts
        
        voice_a = "vi-VN-NamMinhNeural"
        voice_b = "vi-VN-HoaiMyNeural"
        
        combined_text = ""
        for speaker, text in dialogues:
            combined_text += f"{text} ... "

        async def _speak():
            communicate = edge_tts.Communicate(combined_text, voice_a)
            await communicate.save(output_file)

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Chạy trong luồng mới nếu loop đang chạy
                from concurrent.futures import ThreadPoolExecutor
                with ThreadPoolExecutor() as pool:
                    pool.submit(lambda: asyncio.run(_speak())).result()
            else:
                loop.run_until_complete(_speak())
        except Exception:
            asyncio.run(_speak())

    def _generate_offline(self, dialogues: List[Tuple[str, str]], output_file: str):
        """Sử dụng pyttsx3 cho chế độ Offline."""
        import pyttsx3
        engine = pyttsx3.init()
        full_text = " ".join([text for _, text in dialogues])
        engine.save_to_file(full_text, output_file)
        engine.runAndWait()

    def _create_dummy_audio(self, output_file: str):
        """Tạo file wav/mp3 mẫu cơ bản nếu không có thư viện TTS trên máy."""
        import wave
        import struct
        wav_path = output_file.replace(".mp3", ".wav")
        # Sinh 2 giây âm thanh nhẹ 440Hz
        with wave.open(wav_path, 'w') as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(44100)
            for i in range(44100 * 2):
                value = int(32767.0 * 0.1 * (i % 100) / 100)
                data = struct.pack('<h', value)
                f.writeframesraw(data)
        if os.path.exists(wav_path) and not os.path.exists(output_file):
            import shutil
            shutil.copy(wav_path, output_file)
