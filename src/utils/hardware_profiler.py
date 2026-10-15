import platform
import psutil
import subprocess
import sys
import os

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

MODEL_ZOO = {
    1: {
        "tier_name": "Tier 1 (High-End)",
        "model_tag": "qwen2.5:14b",
        "repo_id": "bartowski/Llama-3.2-3B-Instruct-GGUF",
        "filename": "Llama-3.2-3B-Instruct-Q4_K_M.gguf"
    },
    2: {
        "tier_name": "Tier 2 (Mid-Range)",
        "model_tag": "qwen2.5:7b",
        "repo_id": "bartowski/Llama-3.2-3B-Instruct-GGUF",
        "filename": "Llama-3.2-3B-Instruct-Q4_K_M.gguf"
    },
    3: {
        "tier_name": "Tier 3 (Entry-Level)",
        "model_tag": "qwen2.5:3b",
        "repo_id": "bartowski/Llama-3.2-1B-Instruct-GGUF",
        "filename": "Llama-3.2-1B-Instruct-Q4_K_M.gguf"
    },
    4: {
        "tier_name": "Tier 4 (CPU/Low VRAM)",
        "model_tag": "qwen2.5:0.5b",
        "repo_id": "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
        "filename": "qwen2.5-0.5b-instruct-q4_k_m.gguf"
    }
}

class ModelZooManager:
    def __init__(self):
        self.os_name = platform.system()
        self.total_ram_gb = psutil.virtual_memory().total / (1024 ** 3)
        self.vram_gb = 0
        self.has_cuda = False
        self.has_mps = False
        self._detect_gpu()

    def _detect_gpu(self):
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                vram_mb = int(result.stdout.strip().split('\n')[0])
                self.vram_gb = vram_mb / 1024
                self.has_cuda = True
                return
        except Exception:
            pass
            
        if platform.system() == "Darwin":
            self.vram_gb = self.total_ram_gb * 0.75
            try:
                import torch
                if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    self.has_mps = True
            except ImportError:
                self.has_mps = True
            return
            
        try:
            if platform.system() == "Windows":
                result = subprocess.run(
                    ["wmic", "path", "win32_VideoController", "get", "AdapterRAM"],
                    capture_output=True, text=True
                )
                if result.returncode == 0:
                    lines = [line.strip() for line in result.stdout.split('\n') if line.strip() and line.strip().isdigit()]
                    if lines:
                        max_ram_bytes = max(int(ram) for ram in lines)
                        self.vram_gb = max_ram_bytes / (1024**3)
                        return
        except Exception:
            pass

    def get_tier(self):
        if self.vram_gb > 16:
            return 1
        elif self.vram_gb > 8:
            return 2
        elif self.vram_gb >= 4:
            return 3
        else:
            return 4

    def get_recommended_config(self):
        tier = self.get_tier()
        return MODEL_ZOO[tier].copy()

    def auto_setup(self):
        config = self.get_recommended_config()
        print("--- Auto Hardware Profiler ---")
        print(f"OS: {self.os_name} | RAM: {self.total_ram_gb:.1f} GB | VRAM: {self.vram_gb:.1f} GB")
        print(f"Đề xuất cấu hình: {config['tier_name']} -> {config['model_tag']}")
        print("--------------------------------------------------------------------")
        return config

if __name__ == "__main__":
    manager = ModelZooManager()
    manager.auto_setup()
