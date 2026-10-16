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
        "9router": "kr/claude-sonnet-4.5",
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

    def __init__(
        self, 
        provider: Optional[str] = None, 
        model_name: Optional[str] = None, 
        api_key: Optional[str] = None, 
        base_url: Optional[str] = None
    ):
        self.provider = provider
        self.model_name = model_name
        self.api_key = api_key
        self.base_url = base_url
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

        # 2. Quét Ollama (thử cả localhost và 127.0.0.1 để tránh lỗi phân giải trên macOS)
        ollama_candidates = [ollama_url]
        if "localhost" in ollama_url:
            ollama_candidates.append("http://127.0.0.1:11434")
        elif "127.0.0.1" in ollama_url:
            ollama_candidates.append("http://localhost:11434")

        for o_url in ollama_candidates:
            try:
                res = requests.get(f"{o_url.rstrip('/')}/api/tags", timeout=1.5)
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
                    result["ollama"]["active_url"] = o_url
                    result["ollama"]["error"] = None
                    break
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

        # 4. Quét GGUF trong thư mục models/
        models_dir = os.path.join(os.getcwd(), "models")
        if os.path.exists(models_dir):
            ggufs = [f for f in os.listdir(models_dir) if f.endswith(".gguf")]
            if ggufs:
                result["gguf_local"] = {
                    "available": True,
                    "models": ggufs
                }

        return result

    @staticmethod
    def pull_ollama_model(model_name: str, base_url: str = "http://127.0.0.1:11434"):
        """Tải mô hình Ollama và yield từng bước tiến trình JSON."""
        candidate_urls = [base_url, "http://127.0.0.1:11434", "http://localhost:11434"]
        target_url = None
        for cand in candidate_urls:
            try:
                r = requests.get(f"{cand.rstrip('/')}/api/tags", timeout=1.0)
                if r.status_code == 200:
                    target_url = cand.rstrip('/')
                    break
            except Exception:
                continue
        if not target_url:
            target_url = "http://127.0.0.1:11434"

        try:
            with requests.post(f"{target_url}/api/pull", json={"name": model_name, "stream": True}, stream=True, timeout=1800) as resp:
                if resp.status_code != 200:
                    yield {"status": "error", "message": f"Ollama lỗi {resp.status_code}: {resp.text}"}
                    return
                for line in resp.iter_lines(decode_unicode=True):
                    if line:
                        try:
                            data = json.loads(line)
                            yield data
                        except Exception:
                            pass
        except Exception as e:
            yield {"status": "error", "message": str(e)}

    @classmethod
    def test_connection(cls, provider: str, model_name: str = "", api_key: str = "", base_url: str = "") -> Dict[str, Any]:
        """Kiểm tra xem kết nối tới Model/Provider có hoạt động tốt không."""
        start_time = time.time()
        provider = (provider or "ollama").lower()
        test_prompt = "Trả lời đúng 1 chữ: OK"

        # Nếu provider là ollama mà url bị dính port khác
        if provider == "ollama":
            if not base_url or "20128" in base_url or "1234" in base_url or "openai" in base_url:
                base_url = "http://127.0.0.1:11434"

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
        actual_provider = (provider or self.provider or "").lower()
        if not actual_provider:
            if not is_private and (api_key or self.api_key or gemini_api_key):
                actual_provider = "gemini"
            else:
                actual_provider = "ollama"

        actual_key = api_key or self.api_key or gemini_api_key or ""
        actual_model = model_name or self.model_name or self.DEFAULT_MODELS.get(actual_provider, "")
        if actual_provider == "9router" and (not actual_model or actual_model.lower() == "default"):
            actual_model = "kr/claude-sonnet-4.5"

        actual_base_url = base_url or self.base_url

        # 1. Xử lý Ollama Local
        if actual_provider == "ollama":
            url = (actual_base_url or self.default_ollama_url).rstrip("/")
            # Phải đảm bảo url không bị dính port của 9Router (20128) hay LM Studio (1234)
            if "20128" in url or "1234" in url or "openrouter" in url or "api.openai" in url:
                url = "http://127.0.0.1:11434"

            candidate_urls = [url]
            if "localhost" in url:
                candidate_urls.append(url.replace("localhost", "127.0.0.1"))
            elif "127.0.0.1" in url:
                candidate_urls.append(url.replace("127.0.0.1", "localhost"))

            model = actual_model or "qwen2.5:3b"
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "stream": True
            }

            resp = None
            last_err = None
            for cand_url in candidate_urls:
                try:
                    resp = requests.post(f"{cand_url}/api/chat", json=payload, stream=True, timeout=(10, 180))
                    if resp.status_code == 200:
                        url = cand_url
                        break
                    else:
                        last_err = f"Ollama trả về mã lỗi {resp.status_code}: {resp.text}"
                except requests.exceptions.ConnectionError as ce:
                    last_err = ce
                    continue
                except Exception as e:
                    last_err = e
                    break

            if resp is None or resp.status_code != 200:
                if isinstance(last_err, requests.exceptions.ConnectionError) or (resp is None and "Connection refused" in str(last_err)):
                    yield (
                        f"⚠️ **Không thể kết nối tới Ollama tại `{url}`!**\n\n"
                        "1. Hãy chắc chắn ứng dụng **Ollama** đã được bật trên máy tính của bạn.\n"
                        "2. Mở ứng dụng Ollama hoặc chạy lệnh trong terminal: `ollama run " + model + "`.\n"
                        "3. Bạn có thể bấm nút **Gợi ý & Tải Model** hoặc chuyển sang 9Router Gateway ở góc trên."
                    )
                    return
                yield f"⚠️ Lỗi kết nối Ollama: {str(last_err)}"
                return

            try:
                for line in resp.iter_lines(decode_unicode=True):
                    if line:
                        data = json.loads(line)
                        msg = data.get("message", {})
                        if "content" in msg:
                            yield msg["content"]
                return
            except Exception as e:
                yield f"⚠️ Lỗi đọc luồng stream từ Ollama: {str(e)}"
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

    def build_rag_prompt(
        self, 
        query: str, 
        context: str, 
        chat_history: Optional[List[Dict[str, Any]]] = None,
        document_names: Optional[List[str]] = None
    ) -> str:
        """
        Tạo Prompt hoàn chỉnh cho RAG kèm danh sách tài liệu, lịch sử hội thoại và hướng dẫn Grounding thông minh.
        """
        history_block = ""
        if chat_history:
            formatted_turns = []
            for m in chat_history[-6:]:
                role_label = "Người dùng" if m.get("role") == "user" else "Trợ lý"
                content_snip = (m.get("content") or "")[:600]
                if content_snip.strip():
                    formatted_turns.append(f"- {role_label}: {content_snip}")
            if formatted_turns:
                history_block = (
                    "LỊCH SỬ HỘI THOẠI GẦN ĐÂY (Dùng để hiểu ngữ cảnh nếu câu hỏi mang tính nối tiếp):\n"
                    + "\n".join(formatted_turns)
                    + "\n\n"
                )

        docs_header = ""
        if document_names and len(document_names) > 0:
            doc_items = "\n".join([f"  • {name}" for name in document_names])
            docs_header = f"CÁC TÀI LIỆU HIỆN CÓ TRONG SỔ TAY:\n{doc_items}\n\n"

        return (
            f"Bạn là NotebookLM Mini, một trợ lý học tập và nghiên cứu AI thông minh, chuẩn xác, đáng tin cậy.\n\n"
            f"{docs_header}"
            f"CÁC ĐOẠN TRÍCH TỪ TÀI LIỆU NGUỒN CỦA SỔ TAY:\n"
            f"==================================================\n"
            f"{context}\n"
            f"==================================================\n\n"
            f"{history_block}"
            f"QUY TẮC PHÂN TÍCH VÀ TRẢ LỜI (NOTEBOOKLM RAG GROUNDING):\n"
            f"1. HIỂU ĐÚNG ĐẠI TỪ CỦA NGƯỜI DÙNG:\n"
            f"   - Khi người dùng dùng các từ như: 'file', 'tệp', 'tài liệu', 'văn bản', 'trong này', 'sổ tay', 'bài này':\n"
            f"     Người dùng đang ám chỉ CHÍNH CÁC TÀI LIỆU NGUỒN [Source X] được nạp vào sổ tay ở trên!\n"
            f"   - TUYỆT ĐỐI KHÔNG coi 'file' là một từ khóa hay đối tượng riêng biệt cần tìm trong văn bản!\n"
            f"2. ĐỐI VỚI CÂU HỎI TỔNG QUAN / TÓM TẮT (Ví dụ: 'trong file có gì?', 'tài liệu nói về gì?', 'tóm tắt nội dung', 'cho biết nội dung'):\n"
            f"   - Đây là câu hỏi tổng hợp kiến thức cốt lõi của sổ tay. Bạn PHẢI TỔNG HỢP VÀ TRẢ LỜI NGAY LẬP TỨC một cách chi tiết và có cấu trúc rõ ràng.\n"
            f"   - Hãy điểm qua từng tài liệu: Nêu rõ tên tài liệu, chủ đề trọng tâm, các phần nội dung chính, yêu cầu hoặc kết luận nổi bật dựa trên các đoạn trích [Source X].\n"
            f"   - Trình bày dạng danh sách gạch đầu dòng rõ ràng, dễ đọc, và gắn nhãn [Source X] tương ứng.\n"
            f"   - TUYỆT ĐỐI KHÔNG từ chối trả lời hoặc nói rằng tài liệu không đề cập đến 'file'!\n"
            f"3. ĐỐI VỚI CÂU HỎI CHI TIẾT:\n"
            f"   - Bám sát sự thật có trong các đoạn trích [Source X]. Không tự bịa đặt số liệu hay tên riêng.\n"
            f"   - Gắn nhãn trích dẫn [Source 1], [Source 2]... ở cuối mỗi thông tin hoặc luận điểm lấy từ nguồn.\n"
            f"4. KHI NÀO MỚI NÓI 'Tài liệu không đề cập...':\n"
            f"   - CHỈ từ chối khi người dùng hỏi một kiến thức/sự kiện cụ thể HOÀN TOÀN KHÔNG CÓ trong tài liệu và KHÔNG PHẢI là câu hỏi tổng quan về tài liệu (ví dụ: tài liệu là đề thi hay tin tuyển dụng nhưng người dùng hỏi công thức làm bánh pizza, hỏi tỷ số bóng đá hôm nay).\n"
            f"5. NGÔN NGỮ VÀ VĂN PHONG:\n"
            f"   - Bắt buộc trả lời bằng TIẾNG VIỆT tự nhiên, cấu trúc danh sách gạch đầu dòng rõ ràng, mạch lạc (trừ khi người dùng chủ động hỏi bằng ngôn ngữ khác).\n\n"
            f"Câu hỏi của người dùng: {query}\n"
            f"Trả lời:"
        )

    def generate_text(self, prompt: str, **kwargs) -> str:
        """Trả về toàn bộ văn bản phản hồi dạng chuỗi (Non-streaming)."""
        chunks = self.generate(prompt, **kwargs)
        if isinstance(chunks, str):
            return chunks
        return "".join(chunks).strip()