import json
import shutil
import subprocess
import wave
from pathlib import Path


def is_valid_audio_file(path) -> bool:
    path = Path(path)
    if not path.is_file() or path.stat().st_size <= 100:
        return False
    try:
        if path.suffix.lower() == ".wav":
            with wave.open(str(path), "rb") as audio:
                frames = audio.getnframes()
                return frames > 0 and len(audio.readframes(frames)) == frames * audio.getnchannels() * audio.getsampwidth()
        if path.suffix.lower() != ".mp3":
            return False
        probe = shutil.which("ffprobe")
        if probe:
            result = subprocess.run(
                [probe, "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name,duration:format=duration", "-of", "json", str(path)],
                capture_output=True, text=True, timeout=15, check=True,
            )
            data = json.loads(result.stdout)
            streams = data.get("streams", [])
            return bool(streams and streams[0].get("codec_name") == "mp3" and float(data.get("format", {}).get("duration") or streams[0].get("duration") or 0) > 0)

        # Verify two complete MPEG audio frames when ffprobe is unavailable.
        data = path.read_bytes()
        offset = 0
        if data[:3] == b"ID3" and len(data) >= 10:
            offset = 10 + sum((value & 127) << shift for value, shift in zip(data[6:10], (21, 14, 7, 0)))
        bitrate_tables = {
            True: (0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320),
            False: (0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160),
        }
        for start in range(offset, min(offset + 4096, len(data) - 4)):
            position = start
            for frame in range(2):
                header = data[position:position + 4]
                if len(header) != 4 or header[0] != 255 or header[1] & 224 != 224:
                    break
                version, layer = (header[1] >> 3) & 3, (header[1] >> 1) & 3
                bitrate_index, sample_index = header[2] >> 4, (header[2] >> 2) & 3
                if version == 1 or layer != 1 or bitrate_index in (0, 15) or sample_index == 3:
                    break
                bitrate = bitrate_tables[version == 3][bitrate_index] * 1000
                sample_rate = (44100, 48000, 32000)[sample_index] // (1 if version == 3 else 2 if version == 2 else 4)
                position += (144 if version == 3 else 72) * bitrate // sample_rate + ((header[2] >> 1) & 1)
                if position > len(data):
                    break
                if frame == 1:
                    return True
        return False
    except (OSError, ValueError, EOFError, wave.Error, subprocess.SubprocessError):
        return False
