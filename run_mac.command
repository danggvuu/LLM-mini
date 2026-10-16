#!/bin/bash
# ==============================================================================
# Google NotebookLM Mini - 1-Click Launcher (macOS)
# Double-click this file from Finder to run the application immediately.
# ==============================================================================

cd "$(dirname "$0")"

echo ""
echo "========================================================================"
echo "          🚀 GOOGLE NOTEBOOKLM MINI - KHỞI ĐỘNG 1-CLICK (macOS)         "
echo "========================================================================"
echo ""

# 1. Kích hoạt môi trường Python ảo (.venv)
if [ -d ".venv" ]; then
    echo "📦 Đang kích hoạt môi trường ảo Python (.venv)..."
    source .venv/bin/activate
elif [ -d "venv" ]; then
    echo "📦 Đang kích hoạt môi trường ảo Python (venv)..."
    source venv/bin/activate
else
    echo "⚠️ Không tìm thấy thư mục .venv, dùng Python hệ thống..."
fi

# Đảm bảo các thư viện phát âm thanh Podcast (edge-tts) đã sẵn sàng
if ! python3 -c "import edge_tts" &> /dev/null; then
    echo "📦 Đang nạp thư viện phát âm thanh Podcast (edge-tts)..."
    python3 -m pip install edge-tts pyttsx3 2>/dev/null || ~/.local/bin/uv pip install edge-tts pyttsx3 2>/dev/null || true
fi

# 2. Kiểm tra bản build Frontend React
if [ ! -d "frontend/dist" ] || [ ! -f "frontend/dist/index.html" ]; then
    echo "⚙️ Chưa tìm thấy bản build Frontend. Đang biên dịch React..."
    (cd frontend && npm run build)
fi

echo ""
echo "------------------------------------------------------------------------"
echo "  🌐 Ứng dụng đã sẵn sàng tại: http://localhost:8000"
echo "  💡 Bạn có thể mở trình duyệt và truy cập địa chỉ trên."
echo "  🛑 Nhấn Ctrl + C để tắt máy chủ khi dùng xong."
echo "------------------------------------------------------------------------"
echo ""

# Tự động mở trình duyệt sau 1.5 giây
(sleep 1.5 && open "http://localhost:8000") &

# 3. Khởi chạy máy chủ FastAPI Backend
python3 -m uvicorn src.api.api:app --host 0.0.0.0 --port 8000 --reload
