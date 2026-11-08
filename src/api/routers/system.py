import os
import json
import logging
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse

from src.llm.llm_client import LLMEngine
from src.api.deps import (
    get_session_manager,
    get_vector_store,
    SettingsPayload,
    TestConnectionRequest
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["System & Settings"])

@router.get("/api/system/health")
def system_health_check():
    """
    Tự động chẩn đoán sức khỏe toàn bộ hệ thống (Self-Diagnostics):
    - Database SQLite & Sessions
    - Vector Store (Qdrant & Embedder)
    - LLM Services (Ollama, Gemini, 9Router, LM Studio)
    - TTS Engine (Edge-TTS / pyttsx3)
    - Frontend build status
    """
    health = {
        "status": "ok",
        "timestamp": os.getenv("CURRENT_TIME", ""),
        "components": {}
    }

    # 1. Database Check
    try:
        sm = get_session_manager()
        notebooks = sm.list_notebooks()
        health["components"]["database"] = {
            "status": "healthy",
            "message": f"SQLite hoạt động bình thường ({len(notebooks)} sổ tay)",
            "notebooks_count": len(notebooks)
        }
    except Exception as e:
        health["status"] = "degraded"
        health["components"]["database"] = {
            "status": "error",
            "message": f"Lỗi truy vấn Database: {str(e)}"
        }

    # 2. Vector DB / Storage Check
    try:
        vs = get_vector_store()
        storage_path = getattr(vs, "storage_path", "storage/qdrant_data")
        health["components"]["vector_store"] = {
            "status": "healthy",
            "message": "Vector store & Embedder sẵn sàng",
            "storage_path": storage_path
        }
    except Exception as e:
        health["status"] = "degraded"
        health["components"]["vector_store"] = {
            "status": "warning",
            "message": f"Vector Store khởi tạo chậm hoặc cảnh báo: {str(e)}"
        }

    # 3. LLM Engine Check (Ollama & Cloud)
    try:
        sm = get_session_manager()
        settings = sm.get_app_settings()
        ollama_url = settings.get("ollama_base_url", "http://127.0.0.1:11434")
        lm_url = settings.get("lm_studio_base_url", "http://localhost:1234/v1")
        r9_url = settings.get("router9_base_url", "http://localhost:20128/v1")

        local_scan = LLMEngine.get_available_local_models(
            ollama_url=ollama_url,
            lm_studio_url=lm_url,
            router9_url=r9_url
        )
        ollama_up = local_scan.get("ollama", {}).get("available", False)
        ollama_models = [m.get("name") for m in local_scan.get("ollama", {}).get("models", [])]
        has_gemini = bool(settings.get("gemini_api_key"))

        llm_status = "healthy" if (ollama_up or has_gemini) else "warning"
        llm_msg = []
        if ollama_up:
            llm_msg.append(f"Ollama khả dụng ({len(ollama_models)} models: {', '.join(ollama_models[:3])})")
        else:
            llm_msg.append("Ollama chưa bật (Offline)")
        if has_gemini:
            llm_msg.append("Gemini Cloud đã cấu hình API Key")

        health["components"]["llm"] = {
            "status": llm_status,
            "message": " | ".join(llm_msg) if llm_msg else "Chưa phát hiện mô hình LLM nào",
            "ollama_available": ollama_up,
            "ollama_models": ollama_models,
            "gemini_configured": has_gemini,
            "active_provider": settings.get("default_provider", "ollama")
        }
    except Exception as e:
        health["components"]["llm"] = {
            "status": "warning",
            "message": f"Không thể quét trạng thái LLM: {str(e)}"
        }

    # 4. Audio & Podcast TTS Check
    try:
        import edge_tts
        health["components"]["audio_tts"] = {
            "status": "healthy",
            "message": "Edge-TTS sẵn sàng cho Podcast tiếng Việt"
        }
    except ImportError:
        health["components"]["audio_tts"] = {
            "status": "warning",
            "message": "Thư viện edge-tts chưa được cài đặt (chạy: pip install edge-tts)"
        }

    # 5. Frontend Build Check
    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "frontend", "dist")
    has_dist = os.path.exists(os.path.join(frontend_dist, "index.html"))
    health["components"]["frontend"] = {
        "status": "healthy" if has_dist else "warning",
        "message": "Giao diện React SPA đã build sẵn sàng" if has_dist else "Chưa build frontend (cần: cd frontend && npm run build)"
    }

    return health

@router.get("/api/settings")
def get_settings_endpoint():
    """Lấy cài đặt toàn cục."""
    sm = get_session_manager()
    return sm.get_app_settings()

@router.post("/api/settings")
def save_settings_endpoint(payload: SettingsPayload):
    """Lưu cài đặt toàn cục."""
    sm = get_session_manager()
    data = payload.dict(exclude_unset=True)
    sm.save_app_settings(data)
    return {"status": "success", "settings": sm.get_app_settings()}

@router.get("/api/llm/local-models")
def get_local_models():
    """Tự động quét danh sách mô hình Local đang chạy trên máy (Ollama, LM Studio, 9Router)."""
    sm = get_session_manager()
    settings = sm.get_app_settings()
    ollama_url = settings.get("ollama_base_url", "http://127.0.0.1:11434")
    lm_studio_url = settings.get("lm_studio_base_url", "http://localhost:1234/v1")
    router9_url = settings.get("router9_base_url", "http://localhost:20128/v1")
    return LLMEngine.get_available_local_models(
        ollama_url=ollama_url, 
        lm_studio_url=lm_studio_url,
        router9_url=router9_url
    )

@router.get("/api/llm/recommendations")
def get_model_recommendations():
    """Gợi ý danh sách các mô hình tối ưu cho máy tính cá nhân."""
    sm = get_session_manager()
    settings = sm.get_app_settings()
    ollama_url = settings.get("ollama_base_url", "http://127.0.0.1:11434")
    local_data = LLMEngine.get_available_local_models(ollama_url=ollama_url)
    installed_names = [m.get("name") for m in local_data.get("ollama", {}).get("models", [])]
    installed_set = set(installed_names)
    for n in installed_names:
        if ":" in n:
            installed_set.add(n.split(":")[0])
        else:
            installed_set.add(f"{n}:latest")

    recommendations = [
        {
            "name": "qwen2.5:3b",
            "displayName": "Qwen 2.5 (3B)",
            "provider": "ollama",
            "size": "1.9 GB",
            "min_ram": "8 GB",
            "rating": "★★★★★",
            "badge": "Khuyên dùng - Tiếng Việt tốt nhất",
            "badge_color": "emerald",
            "description": "Mô hình 3B xuất sắc nhất cho tiếng Việt. Tốc độ cực nhanh trên Apple Silicon, dịch và phân tích tài liệu ngữ cảnh cao.",
            "installed": "qwen2.5:3b" in installed_set or "qwen2.5" in installed_set
        },
        {
            "name": "llama3.2:3b",
            "displayName": "Llama 3.2 (3B)",
            "provider": "ollama",
            "size": "2.0 GB",
            "min_ram": "8 GB",
            "rating": "★★★★☆",
            "badge": "Meta AI - Siêu nhanh",
            "badge_color": "blue",
            "description": "Mô hình gọn nhẹ của Meta, tối ưu tuyệt vời cho máy cá nhân. Đa năng, hỏi đáp và tóm tắt rất mượt.",
            "installed": "llama3.2:3b" in installed_set or "llama3.2:latest" in installed_set or "llama3.2" in installed_set
        },
        {
            "name": "deepseek-r1:1.5b",
            "displayName": "DeepSeek R1 (1.5B)",
            "provider": "ollama",
            "size": "1.1 GB",
            "min_ram": "8 GB",
            "rating": "★★★★☆",
            "badge": "Reasoning - Suy luận logic",
            "badge_color": "purple",
            "description": "Mô hình suy luận sâu từng bước (Chain-of-Thought) siêu nhẹ. Thích hợp cho toán học, lập trình và suy luận logic.",
            "installed": "deepseek-r1:1.5b" in installed_set or "deepseek-r1" in installed_set
        },
        {
            "name": "deepseek-r1:7b",
            "displayName": "DeepSeek R1 (7B)",
            "provider": "ollama",
            "size": "4.7 GB",
            "min_ram": "16 GB",
            "rating": "★★★★★",
            "badge": "Chuyên gia suy luận (16GB RAM+)",
            "badge_color": "violet",
            "description": "Bản suy luận 7B đầy đủ sức mạnh của DeepSeek. Khả năng giải quyết tài liệu khó và câu hỏi phức tạp (cần máy 16GB RAM trở lên).",
            "installed": "deepseek-r1:7b" in installed_set
        },
        {
            "name": "gemma2:2b",
            "displayName": "Gemma 2 (2B)",
            "provider": "ollama",
            "size": "1.6 GB",
            "min_ram": "8 GB",
            "rating": "★★★★☆",
            "badge": "Google AI - Siêu nhẹ",
            "badge_color": "amber",
            "description": "Mô hình nhỏ gọn của Google. Tốn cực ít RAM, chạy mượt mà ngay cả khi máy tính đang mở nhiều ứng dụng.",
            "installed": "gemma2:2b" in installed_set or "gemma2:latest" in installed_set or "gemma2" in installed_set
        }
    ]

    return {
        "status": "success",
        "ollama_available": local_data.get("ollama", {}).get("available", False),
        "installed_count": len(installed_names),
        "recommendations": recommendations
    }

@router.post("/api/llm/ollama/pull")
async def pull_ollama_endpoint(request: Request):
    """Tải model Ollama và stream tiến trình về frontend qua Server-Sent Events (SSE)."""
    body = await request.json()
    model_name = (body.get("model_name") or body.get("name") or "").strip()
    if not model_name:
        raise HTTPException(status_code=400, detail="Thiếu tên model cần tải.")

    sm = get_session_manager()
    settings = sm.get_app_settings()
    ollama_url = settings.get("ollama_base_url", "http://127.0.0.1:11434")

    def event_stream():
        yield f"data: {json.dumps({'status': 'pulling manifest', 'message': f'Bắt đầu tải {model_name}...' })}\n\n"
        for progress in LLMEngine.pull_ollama_model(model_name, base_url=ollama_url):
            yield f"data: {json.dumps(progress)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@router.post("/api/llm/test-connection")
def test_connection_endpoint(req: TestConnectionRequest):
    """Kiểm tra kết nối tới Model/Provider cụ thể."""
    sm = get_session_manager()
    settings = sm.get_app_settings()

    api_key = req.api_key
    base_url = req.base_url

    if not api_key:
        if req.provider == "gemini":
            api_key = settings.get("gemini_api_key", "")
        elif req.provider == "openai":
            api_key = settings.get("openai_api_key", "")
        elif req.provider == "groq":
            api_key = settings.get("groq_api_key", "")
        elif req.provider == "openrouter":
            api_key = settings.get("openrouter_api_key", "")
        elif req.provider == "9router":
            api_key = settings.get("router9_api_key", "")
        elif req.provider == "custom":
            api_key = settings.get("custom_api_key", "")

    if not base_url:
        if req.provider == "ollama":
            base_url = settings.get("ollama_base_url", "http://localhost:11434")
        elif req.provider in ["lm_studio", "local_ai"]:
            base_url = settings.get("lm_studio_base_url", "http://localhost:1234/v1")
        elif req.provider == "9router":
            base_url = settings.get("router9_base_url", "http://localhost:20128/v1")
        elif req.provider == "custom":
            base_url = settings.get("custom_base_url", "")

    return LLMEngine.test_connection(
        provider=req.provider,
        model_name=req.model_name,
        api_key=api_key,
        base_url=base_url
    )
