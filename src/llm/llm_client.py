import os
import json
import time
import requests
import logging
from typing import Generator, Optional, Dict, Any, List

logger = logging.getLogger(__name__)

class LLMEngine:
    """
    Universal Multi-Provider LLM Engine.
    Hỗ trợ:
    - 9Router AI Gateway (Single endpoint proxy cho 60+ providers)
    - Local AI (Ollama, LM Studio, vLLM, LocalAI)
    - Cloud AI (Gemini, OpenAI, Groq, OpenRouter, Custom Endpoint).
    """

    DEFAULT_MODELS = {
        "9router": "claude-3-5-sonnet",
        "ollama": "qwen2.5:3b",
        "lm_studio": "local-model",
        "gemini": "gemini-2.5-flash",
        "openai": "gpt-4o-mini",
        "groq": "llama-3.3-70b-versatile",
        "openrouter": "deepseek/deepseek-r1",
        "custom": "default"
    }

    CLOUD_BASE_URLS = {
        "openai": "https://api.openai.com/v1",
        "groq": "https://api.groq.com/openai/v1",
        "openrouter": "https://openrouter.ai/api/v1",
        "9router": "http://localhost:20128/v1"
    }

    def __init__(self):
        self.default_ollama_url = "http://localhost:11434"
        self.default_lm_studio_url = "http://localhost:1234/v1"
        self.default_9router_url = "http://localhost:20128/v1"
        self.llm_cpp = None
        self._init_llama_cpp_lazy()

    def _init_llama_cpp_lazy(self):
        """Khởi tạo llama_cpp nếu có model GGUF sẵn trong thư mục models mà không chặn khởi động."""
        models_dir = os.path.join(os.getcwd(), "models")
        if os.path.exists(models_dir):
            gguf_files = [f for f in os.listdir(models_dir) if f.endswith(".gguf")]
            if gguf_files:
                try:
                    from llama_cpp import Llama
                    model_path = os.path.join(models_dir, gguf_files[0])
                    self.llm_cpp = Llama(model_path=model_path, n_ctx=4096, verbose=False)
                    logger.info(f"Loaded Llama.cpp model: {gguf_files[0]}")
                except Exception as e:
                    logger.debug(f"Không thể khởi tạo llama_cpp: {e}")

    @staticmethod
    def get_available_local_models(
        ollama_url: str = "http://localhost:11434", 
        lm_studio_url: str = "http://localhost:1234/v1",
        router9_url: str = "http://localhost:20128/v1"
    ) -> Dict[str, Any]:
        """Tự động quét các mô hình và Gateway đang chạy (9Router, Ollama, LM Studio)."""
        result = {
            "router9": {
                "available": False,
                "models": [],
                "error": None
            },
            "ollama": {
                "available": False,
                "models": [],
                "error": None
            },
            "lm_studio": {
                "available": False,
                "models": [],
                "error": None
            }
        }

        # 1. Quét 9Router
        try:
            r9_base = router9_url.rstrip("/")
            if not r9_base.endswith("/models"):
                r9_endpoint = f"{r9_base}/models"
            else:
                r9_endpoint = r9_base
            res = requests.get(r9_endpoint, timeout=1.2)
            if res.status_code == 200:
                data = res.json()
                models = [m.get("id") for m in data.get("data", [])]
                result["router9"]["available"] = True
                result["router9"]["models"] = models
        except Exception as e:
            result["router9"]["error"] = str(e)

        # 2. Quét Ollama
        try:
            res = requests.get(f"{ollama_url.rstrip('/')}/api/tags", timeout=1.5)
            if res.status_code == 200:
                data = res.json()
                models = []
                for m in data.get("models", []):
                    size_gb = round(m.get("size", 0) / (1024 ** 3), 2)
                    models.append({
                        "name": m.get("name"),
                        "model": m.get("model"),
                        "size_gb": size_gb,
                        "details": m.get("details", {})
                    })
                result["ollama"]["available"] = True
                result["ollama"]["models"] = models
        except Exception as e:
            result["ollama"]["error"] = str(e)

        # 3. Quét LM Studio / OpenAI-compatible local
        try:
            res = requests.get(f"{lm_studio_url.rstrip('/')}/models", timeout=1.2)
            if res.status_code == 200:
                data = res.json()
                models = [m.get("id") for m in data.get("data", [])]
                result["lm_studio"]["available"] = True
                result["lm_studio"]["models"] = models
        except Exception as e:
            result["lm_studio"]["error"] = str(e)

        return result

    @classmethod
    def test_connection(cls, provider: str, model_name: str = "", api_key: str = "", base_url: str = "") -> Dict[str, Any]:
        """Kiểm tra xem kết nối tới Model/Provider có hoạt động tốt không."""
        start_time = time.time()
        provider = (provider or "ollama").lower()
        test_prompt = "Trả lời đúng 1 chữ: OK"

        try:
            engine = cls()
            chunks = list(engine.generate(
                prompt=test_prompt,
                system_prompt="Bạn là bot kiểm tra kết nối.",
                provider=provider,
                model_name=model_name,
                api_key=api_key,
                base_url=base_url
            ))
            response_text = "".join(chunks).strip()
            latency = int((time.time() - start_time) * 1000)

            if response_text.startswith("⚠️") or "lỗi" in response_text.lower():
                return {
                    "success": False,
                    "message": response_text,
                    "latency_ms": latency
                }

            return {
                "success": True,
                "message": f"Kết nối thành công! Phản hồi ({latency}ms): {response_text[:40]}",
                "latency_ms": latency,
                "reply": response_text
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Lỗi kết nối: {str(e)}",
                "latency_ms": int((time.time() - start_time) * 1000)
            }

    def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        is_private: bool = True,
        gemini_api_key: Optional[str] = None,
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> Generator[str, None, None]:
        """
        Tạo phản hồi dạng Stream hỗ trợ đa nền tảng (9Router, Ollama, Gemini, OpenAI, Groq...).
        """
        actual_provider = (provider or "").lower()
        if not actual_provider:
            if not is_private and (api_key or gemini_api_key):
                actual_provider = "gemini"
            else:
                actual_provider = "ollama"

        actual_key = api_key or gemini_api_key or ""
        actual_model = model_name or self.DEFAULT_MODELS.get(actual_provider, "")

        # 1. Xử lý Ollama Local
        if actual_provider == "ollama":
            url = (base_url or self.default_ollama_url).rstrip("/")
            model = actual_model or "qwen2.5:3b"
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "stream": True
            }
            try:
                with requests.post(f"{url}/api/chat", json=payload, stream=True, timeout=60) as resp:
                    if resp.status_code != 200:
                        yield f"⚠️ Ollama trả về lỗi {resp.status_code}: {resp.text}"
                        return
                    for line in resp.iter_lines():
                        if line:
                            data = json.loads(line)
                            msg = data.get("message", {})
                            if "content" in msg:
                                yield msg["content"]
                return
            except requests.exceptions.ConnectionError:
                yield (
                    f"⚠️ **Không thể kết nối tới Ollama tại `{url}`!**\n\n"
                    "1. Hãy chắc chắn bạn đã cài đặt và khởi động Ollama trên máy tính.\n"
                    "2. Kiểm tra lệnh `ollama run qwen2.5:3b` hoặc mở ứng dụng Ollama trong thanh taskbar/menu bar.\n"
                    "3. Bạn có thể chọn mô hình khác trong mục Cài đặt."
                )
                return
            except Exception as e:
                yield f"⚠️ Lỗi Ollama: {str(e)}"
                return

        # 2. Xử lý Google Gemini
        if actual_provider == "gemini":
            if not actual_key:
                yield "⚠️ Vui lòng cung cấp Google Gemini API Key trong phần Cài đặt hoặc khi tạo Sổ tay."
                return
            
            model = actual_model or "gemini-2.5-flash"
            try:
                from google import genai
                from google.genai import types
                client = genai.Client(api_key=actual_key)
                response = client.models.generate_content_stream(
                    model=model,
                    contents=[
                        types.Content(role="user", parts=[types.Part.from_text(text=system_prompt + "\n\n" + prompt)])
                    ]
                )
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
                return
            except ImportError:
                pass
            except Exception as e:
                logger.warning(f"SDK google-genai lỗi, thử REST API: {e}")

            try:
                rest_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?key={actual_key}&alt=sse"
                headers = {"Content-Type": "application/json"}
                body = {
                    "contents": [{"parts": [{"text": (system_prompt + "\n\n" + prompt) if system_prompt else prompt}]}]
                }
                with requests.post(rest_url, headers=headers, json=body, stream=True, timeout=60) as resp:
                    if resp.status_code != 200:
                        yield f"⚠️ Lỗi Gemini API ({resp.status_code}): {resp.text}"
                        return
                    for line in resp.iter_lines():
                        if line:
                            line_str = line.decode('utf-8')
                            if line_str.startswith("data: "):
                                data_str = line_str[6:]
                                try:
                                    data = json.loads(data_str)
                                    candidates = data.get("candidates", [])
                                    if candidates:
                                        parts = candidates[0].get("content", {}).get("parts", [])
                                        for part in parts:
                                            if "text" in part:
                                                yield part["text"]
                                except Exception:
                                    pass
                return
            except Exception as e:
                yield f"⚠️ Lỗi kết nối Google Gemini: {str(e)}"
                return

        # 3. Xử lý các Provider dạng OpenAI-Compatible (9Router, OpenAI, Groq, OpenRouter, LM Studio, vLLM, Custom)
        endpoint_url = base_url
        if not endpoint_url:
            if actual_provider == "9router":
                endpoint_url = self.default_9router_url
            elif actual_provider in self.CLOUD_BASE_URLS:
                endpoint_url = self.CLOUD_BASE_URLS[actual_provider]
            elif actual_provider in ["lm_studio", "local_ai"]:
                endpoint_url = self.default_lm_studio_url
            else:
                endpoint_url = "http://localhost:1234/v1"

        endpoint_url = endpoint_url.rstrip("/")
        if not endpoint_url.endswith("/chat/completions"):
            endpoint_url += "/chat/completions"

        headers = {"Content-Type": "application/json"}
        if actual_key:
            headers["Authorization"] = f"Bearer {actual_key}"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": actual_model or ("claude-3-5-sonnet" if actual_provider == "9router" else "gpt-4o-mini"),
            "messages": messages,
            "stream": True
        }

        try:
            with requests.post(endpoint_url, headers=headers, json=payload, stream=True, timeout=60) as resp:
                if resp.status_code != 200:
                    yield f"⚠️ Lỗi từ {actual_provider.upper()} ({resp.status_code}): {resp.text}"
                    return
                for line in resp.iter_lines():
                    if line:
                        line_str = line.decode('utf-8')
                        if line_str.startswith("data: "):
                            chunk_str = line_str[6:].strip()
                            if chunk_str == "[DONE]":
                                break
                            try:
                                chunk_data = json.loads(chunk_str)
                                choices = chunk_data.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield content
                            except Exception:
                                pass
            return
        except requests.exceptions.ConnectionError:
            provider_display = "9Router" if actual_provider == "9router" else actual_provider.upper()
            yield f"⚠️ Không thể kết nối tới {provider_display} tại `{endpoint_url}`. Vui lòng kiểm tra lại dịch vụ đã bật chưa."
            return
        except Exception as e:
            yield f"⚠️ Đã có lỗi xảy ra khi gọi {actual_provider}: {str(e)}"
            return

    def build_rag_prompt(self, query: str, context: str) -> str:
        """
        Tạo Prompt hoàn chỉnh cho RAG với các ràng buộc chống ảo giác (Anti-Hallucination Guardrails).
        """
        return (
            f"Bạn là NotebookLM Mini, một trợ lý học tập và nghiên cứu trung thực, khoa học.\n"
            f"Dưới đây là các tài liệu thông tin ĐƯỢC CUNG CẤP TỪ SỔ TAY:\n"
            f"==================================================\n"
            f"{context}\n"
            f"==================================================\n\n"
            f"NGUYÊN TẮC BẮT BUỘC ĐỂ TRÁNH ẢO GIÁC (ZERO-HALLUCINATION RULES):\n"
            f"1. CHỈ TRẢ LỜI DỰA TRÊN THÔNG TIN CÓ TRONG CÁC ĐOẠN TRÍCH [Source X] Ở TRÊN.\n"
            f"2. NẾU TÀI LIỆU KHÔNG CHỨA THÔNG TIN ĐỂ TRẢ LỜI CÂU HỎI:\n"
            f"   - Hãy nói thẳng thắn và rõ ràng: 'Tài liệu bạn cung cấp không đề cập đến thông tin này.'\n"
            f"   - TUYỆT ĐỐI KHÔNG TỰ BỊA RA TÊN, SỐ LIỆU, ĐỊA ĐIỂM, HOẶC THỜI GIAN.\n"
            f"3. NẾU TÀI LIỆU CHỈ NÓI MỘT PHẦN, hãy trả lời phần có trong tài liệu và nêu rõ phần còn lại tài liệu không nói.\n"
            f"4. BẮT BUỘC TRÍCH DẪN NGUỒN: Cuối mỗi luận điểm hoặc sự kiện, hãy đặt nhãn trích dẫn tương ứng (ví dụ: [Source 1], [Source 2]).\n"
            f"5. Trả lời bằng Tiếng Việt tự nhiên, súc tích, mạch lạc.\n\n"
            f"Câu hỏi của người dùng: {query}\n"
            f"Trả lời:"
        )