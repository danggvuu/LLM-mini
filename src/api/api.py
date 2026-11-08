import os
import sys
import logging

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

logger = logging.getLogger(__name__)

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

# Shared dependencies and singletons
from src.api.deps import (
    get_session_manager,
    get_embedder,
    get_vector_store,
    get_search_engine,
    get_llm_engine,
    get_notebook_engines,
    resolve_llm_config,
    get_notebook_id,
    _load_notes,
    _save_notes,
    # Re-export models for backward compatibility
    SettingsPayload,
    TestConnectionRequest,
    NotebookCreate,
    NotebookUpdate,
    ChatRequest,
    IngestTextRequest,
    PodcastRequest,
    SrsReviewRequest,
    CompareDocsRequest,
    MindmapRequest,
    TimelineRequest,
    PullModelRequest,
    StudioFilterRequest
)

# Modular Routers
from src.api.routers import system, notebooks, documents, chat, learning, media

app = FastAPI(
    title="NotebookLM Mini API",
    version="2.0.0",
    description="Hệ thống Trợ lý Học tập & Khảo thí Đa phương thức Thông minh"
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    print("[System] Khởi động SessionManager và Hệ thống Cơ sở dữ liệu...")
    get_session_manager()

# Mount Modular Routers
app.include_router(system.router)
app.include_router(notebooks.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(learning.router)
app.include_router(media.router)

# --- Phục vụ Giao Diện React Frontend (SPA) ---
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")

if os.path.exists(FRONTEND_DIR):
    assets_dir = os.path.join(FRONTEND_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    @app.get("/{catchall:path}")
    def serve_react_app(catchall: str):
        """Bắt mọi route không có trong API và trả về index.html của React Router."""
        index_path = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"error": "Frontend chưa được build. Vui lòng chạy npm run build trong thư mục frontend."}
else:
    @app.get("/")
    def no_frontend():
        return {"message": "Hệ thống đang chạy ngầm. Giao diện React chưa được build (thiếu thư mục frontend/dist)."}
