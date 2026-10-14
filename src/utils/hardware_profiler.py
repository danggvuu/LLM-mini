import platform
import psutil
import subprocess
import sys
import os

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

MODEL_ZOO = {
    # Tier 1: VRAM > 16GB
    1: {
        "tier_name": "Tier 1 (High-End)",
        "model_tag": "qwen2.5:14b",
        "repo_id": "bartowski/Llama-3.2-3B-Instruct-GGUF",
        "filename": "Llama-3.2-3B-Instruct-Q4_K_M.gguf"
    },
    # Tier 2: VRAM 8GB - 16GB
    2: {
        "tier_name": "Tier 2 (Mid-Range)",
        "model_tag": "qwen2.5:7b",
        "repo_id": "bartowski/Llama-3.2-3B-Instruct-GGUF",
        "filename": "Llama-3.2-3B-Instruct-Q4_K_M.gguf"
    },
    # Tier 3: VRAM 4GB - 8GB
    3: {
        "tier_name": "Tier 3 (Entry-Level)",
        "model_tag": "qwen2.5:3b",
        "repo_id": "bartowski/Llama-3.2-1B-Instruct-GGUF",
        "filename": "Llama-3.2-1B-Instruct-Q4_K_M.gguf"
    },
    # Tier 4: VRAM < 4GB
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
            # 1. Thử dùng nvidia-smi để lấy VRAM chính xác nhất của NVIDIA GPU
            import subprocess
            result = subprocess.run(["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"], capture_output=True, text=True)
            if result.returncode == 0:
                vram_mb = int(result.stdout.strip().split('\n')[0])
                self.vram_gb = vram_mb / 1024
                self.has_cuda = True
                return
        except Exception:
            pass
            
        if platform.system() == "Darwin":
            # Apple Silicon dùng unified memory — ~75% khả dụng cho GPU
            self.vram_gb = self.total_ram_gb * 0.75
            try:
                import torch
                if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    self.has_mps = True
            except ImportError:
                # Nếu chưa cài torch, ta vẫn ngầm định Mac M-series có MPS
                self.has_mps = True
            return
            
        try:
            # 2. Thử dùng wmic trên Windows để lấy RAM của các Card khác (AMD, Intel)
            if platform.system() == "Windows":
                result = subprocess.run(["wmic", "path", "win32_VideoController", "get", "AdapterRAM"], capture_output=True, text=True)
                if result.returncode == 0:
                    lines = [line.strip() for line in result.stdout.split('\n') if line.strip() and line.strip().isdigit()]
                    if lines:
                        # Lấy card có VRAM cao nhất
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
        config = MODEL_ZOO[tier].copy()
        return config

    def check_build_tools(self) -> bool:
        """Kiểm tra xem C++ Build Tools có được cài đặt không."""
        if platform.system() != "Windows":
            return True # Linux/Mac thường có sẵn GCC/Clang
        try:
            # Tìm vswhere.exe
            vswhere_path = os.path.join(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"), "Microsoft Visual Studio", "Installer", "vswhere.exe")
            if os.path.exists(vswhere_path):
                result = subprocess.run([vswhere_path, "-latest", "-products", "*", "-requires", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-property", "installationPath"], capture_output=True, text=True)
                if result.stdout.strip():
                    return True
        except Exception:
            pass
        return False

    def setup_layer_1_and_2(self) -> bool:
        """Thử cài đặt thư viện llama-cpp-python. Trả về True nếu thành công."""
        try:
            import huggingface_hub
        except ImportError:
            print("[Auto-Setup] Đang cài đặt thư viện huggingface_hub...")
            subprocess.run(["uv", "pip", "install", "huggingface-hub"], check=True)
            
        has_tools = self.check_build_tools()
        
        try:
            import llama_cpp
            return True
        except ImportError:
            if has_tools:
                print("[Lớp 1] Phát hiện C++ Build Tools! Đang tự biên dịch llama-cpp-python từ mã nguồn để đạt hiệu năng tối đa...")
                try:
                    subprocess.run(["uv", "pip", "install", "llama-cpp-python", "--no-binary", "llama-cpp-python"], check=True)
                    return True
                except Exception as e:
                    print(f"[Lớp 1] Biên dịch thất bại: {e}. Đang chuyển sang Lớp 2...")
            
            print("[Lớp 2] Đang cài đặt llama-cpp-python (Pre-compiled wheels)...")
            try:
                subprocess.run(["uv", "pip", "install", "llama-cpp-python", "--extra-index-url", "https://abetlen.github.io/llama-cpp-python/whl/cpu"], check=True)
                return True
            except Exception as e:
                print(f"[Lớp 2] Cài đặt Pre-compiled thất bại: {e}")
                return False

    def test_llama_cpp(self, model_path: str) -> bool:
        """Kiểm thử khởi tạo mô hình. Trả về True nếu khởi chạy thành công (không bị lỗi AVX2)."""
        print("[Kiểm thử Lớp 2] Đang test khởi tạo mô hình bằng llama_cpp...")
        try:
            import ctypes
            # Thử gọi Llama
            from llama_cpp import Llama
            llm = Llama(model_path=model_path, n_gpu_layers=0, n_ctx=128, verbose=False)
            print("[Kiểm thử Lớp 2] THÀNH CÔNG! Lớp 1/2 chạy hoàn hảo.")
            return True
        except OSError as e:
            if "0xc000001d" in str(e) or "illegal instruction" in str(e).lower():
                print(f"[Kiểm thử Lớp 2] THẤT BẠI! CPU thiếu tập lệnh (Lỗi AVX2): {e}")
            else:
                print(f"[Kiểm thử Lớp 2] THẤT BẠI! Lỗi hệ thống: {e}")
            return False
        except Exception as e:
            print(f"[Kiểm thử Lớp 2] THẤT BẠI! Lỗi không xác định: {e}")
            return False

    def check_and_install_model(self, repo_id: str, filename: str) -> str:
        """Tải model từ HF về thư mục /models và trả về đường dẫn."""
        from huggingface_hub import hf_hub_download
        models_dir = os.path.join(os.getcwd(), "models")
        os.makedirs(models_dir, exist_ok=True)
        print(f"\n[Model Manager] Đang tải mô hình GGUF: \033[92m{filename}\033[0m")
        try:
            model_path = hf_hub_download(repo_id=repo_id, filename=filename, local_dir=models_dir, local_dir_use_symlinks=False)
            return model_path
        except Exception as e:
            print(f"[Lỗi] Quá trình tải {filename} thất bại: {str(e)}")
            return ""

    def setup_ollama_portable(self, model_tag: str):
        """LỚP 3: Tự động tải Ollama Portable, bật server ngầm, và pull model."""
        print("\n[LỚP 3 - Cứu cánh] Kích hoạt chế độ tải Ollama Portable dành cho CPU cũ/Không tương thích...")
        bin_dir = os.path.join(os.getcwd(), "bin")
        os.makedirs(bin_dir, exist_ok=True)
        
        is_windows = platform.system() == "Windows"
        ollama_exe = os.path.join(bin_dir, "ollama.exe" if is_windows else "ollama")
        
        # 1. Tải Ollama Portable nếu chưa có
        if not os.path.exists(ollama_exe):
            print("[Lớp 3] Đang tải Ollama Portable. Vui lòng đợi...")
            import urllib.request
            import zipfile
            import tempfile
            import sys
            
            def download_progress(block_num, block_size, total_size):
                downloaded = block_num * block_size
                if total_size > 0:
                    percent = downloaded * 100 / total_size
                    sys.stdout.write(f"\r[Lớp 3] Tiến độ tải: {percent:.1f}% ({downloaded/(1024*1024):.1f}MB / {total_size/(1024*1024):.1f}MB)")
                    sys.stdout.flush()
                    
            if is_windows:
                url = "https://ollama.com/download/ollama-windows-amd64.zip"
                zip_path = os.path.join(tempfile.gettempdir(), "ollama_portable.zip")
                urllib.request.urlretrieve(url, zip_path, reporthook=download_progress)
                print("\n[Lớp 3] Đang giải nén Ollama...")
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(bin_dir)
                os.remove(zip_path)
            elif platform.system() == "Darwin":
                # Mac M-series ARM64
                url = "https://ollama.com/download/ollama-darwin-arm64"
                urllib.request.urlretrieve(url, ollama_exe, reporthook=download_progress)
                os.chmod(ollama_exe, 0o755) # Cấp quyền thực thi
                print("\n[Lớp 3] Đã tải xong Ollama cho macOS.")
            
        # 2. Khởi động Ollama Serve ngầm nếu chưa chạy
        import urllib.request
        try:
            urllib.request.urlopen("http://localhost:11434", timeout=1)
        except:
            print("[Lớp 3] Đang khởi động AI Engine (Ollama)...")
            creationflags = subprocess.CREATE_NO_WINDOW if is_windows else 0
            env = os.environ.copy()
            # Bật serve ngầm
            subprocess.Popen([ollama_exe, "serve"], creationflags=creationflags, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            import time
            for _ in range(30):
                try:
                    urllib.request.urlopen("http://localhost:11434", timeout=1)
                    break
                except:
                    time.sleep(0.5)
        
        # 3. Kích hoạt Pull Model
        print(f"\n[Lớp 3] Hệ thống đang tải bộ não AI tương thích cho Ollama: \033[92m{model_tag}\033[0m")
        try:
            subprocess.run([ollama_exe, "pull", model_tag], check=True)
            print(f"[Lớp 3] Sẵn sàng phục vụ!")
        except Exception as e:
            print(f"[Lớp 3] Lỗi tải {model_tag}: {str(e)}")

    def auto_setup(self):
        config = self.get_recommended_config()
        print(f"--- Auto Hardware Profiler ---")
        print(f"OS: {self.os_name} | RAM: {self.total_ram_gb:.1f} GB | VRAM: {self.vram_gb:.1f} GB")
        print(f"Đề xuất cấu hình: {config['tier_name']} -> {config['model_tag']}")
        print(f"--------------------------------------------------------------------")
        return config

if __name__ == "__main__":
    manager = ModelZooManager()
    manager.auto_setup()
