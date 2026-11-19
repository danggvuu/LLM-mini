#!/bin/bash
# ==============================================================================
# Google NotebookLM Mini - 1-Click Launcher (macOS)
# Tự động tạo môi trường ảo (.venv), cài đặt thư viện và khởi chạy máy chủ.
# ==============================================================================

cd "$(dirname "$0")"
export PYTHONPATH="$(pwd)"
export PYTHONUNBUFFERED=1

echo ""
echo "========================================================================"
echo "          🚀 NOTEBOOKLM MINI - KHỞI ĐỘNG HỆ THỐNG 1-CLICK (macOS)       "
echo "========================================================================"
echo ""

# 1. Tìm trình thông dịch Python phù hợp
PY_CMD=""
if command -v python3 &>/dev/null; then
    PY_CMD="python3"
elif command -v python &>/dev/null; then
    PY_CMD="python"
fi

if [ -z "$PY_CMD" ]; then
    echo "❌ LỖI: Không tìm thấy Python trên máy tính!"
    echo "👉 Vui lòng cài đặt Python từ https://www.python.org/downloads/ hoặc dùng Homebrew: brew install python"
    read -p "Nhấn Enter để thoát..."
    exit 1
fi

if ! "$PY_CMD" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)'; then
    echo "❌ Cần Python 3.11 trở lên. Đang có: $($PY_CMD --version)"
    read -p "Nhấn Enter để thoát..."
    exit 1
fi

echo "[1/4] Đã nhận diện Python: $($PY_CMD --version)"

# 2. Thiết lập môi trường ảo Python (.venv)
if [ ! -f ".venv/bin/python" ]; then
    echo "[2/4] Chưa có môi trường ảo (.venv). Đang tự động khởi tạo..."
    if ! "$PY_CMD" -m venv .venv; then
        echo "❌ Không tạo được môi trường .venv. Cài module venv cho Python rồi thử lại."
        read -p "Nhấn Enter để thoát..."
        exit 1
    fi
    source .venv/bin/activate
else
    echo "[2/4] Đang kích hoạt môi trường ảo (.venv)..."
    source .venv/bin/activate
fi

if ! python -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)'; then
    echo "❌ .venv hiện có dùng Python cũ hơn 3.11. Đổi tên/xóa .venv rồi chạy lại launcher."
    read -p "Nhấn Enter để thoát..."
    exit 1
fi

# 3. Kiểm tra và tự động cài đặt thư viện
echo "[3/4] Đang kiểm tra các gói thư viện dự án..."
if ! python -c "import fastapi, uvicorn, qdrant_client, sentence_transformers, edge_tts, markitdown, pytesseract" &>/dev/null; then
    echo ""
    echo "========================================================================"
    echo "📦 PHÁT HIỆN THIẾU THƯ VIỆN BACKEND!"
    echo "⏳ Đang tự động cài đặt các thư viện từ requirements.txt..."
    echo "💡 Quá trình này chỉ diễn ra 1 lần duy nhất trong lần khởi động đầu tiên."
    echo "========================================================================"
    echo ""
    python -m pip install --upgrade pip || exit 1
    if ! python -m pip install -r requirements.txt; then
        echo "❌ Cài dependency thất bại. Kiểm tra log và kết nối mạng rồi chạy lại."
        read -p "Nhấn Enter để thoát..."
        exit 1
    fi
    echo "[3/4] Cài đặt thư viện hoàn tất!"
else
    echo "[3/4] Toàn bộ thư viện Backend đã đầy đủ và sẵn sàng."
fi

if curl -fsS "http://127.0.0.1:8000/api/system/ready" >/dev/null 2>&1; then
    echo "❌ Ứng dụng đã chạy ở cổng 8000. Đóng phiên bản đó trước khi mở launcher mới."
    read -p "Nhấn Enter để thoát..."
    exit 1
fi

# 4. Kiểm tra giao diện Frontend
if [ ! -f "frontend/dist/index.html" ]; then
    echo "[4/4] Đang kiểm tra giao diện Frontend..."
    if command -v npm &>/dev/null; then
        echo "[4/4] Đang biên dịch giao diện React SPA..."
        (cd frontend && npm run build) || exit 1
    elif [ ! -f "frontend/dist/index.html" ]; then
        echo "❌ Thiếu frontend/dist và không có npm để build. Cài Node.js LTS rồi thử lại."
        read -p "Nhấn Enter để thoát..."
        exit 1
    fi
else
    echo "[4/4] Giao diện React SPA đã sẵn sàng."
fi

echo ""
echo "========================================================================"
echo "  🎉 KHỞI ĐỘNG HỆ THỐNG THÀNH CÔNG!"
echo "  🌐 Địa chỉ ứng dụng: http://localhost:8000"
echo "  💡 Trình duyệt sẽ tự động mở sau 1.5 giây..."
echo "  🛑 Để dừng hệ thống, nhấn phím Ctrl + C trong cửa sổ Terminal này."
echo "========================================================================"
echo ""

# Mở trình duyệt chỉ sau khi backend báo ready.
(
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:8000/api/system/ready" 2>/dev/null | python -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("ready") else 1)' 2>/dev/null; then
      open "http://localhost:8000"
      exit 0
    fi
    sleep 0.5
  done
  echo "⚠️ Backend chưa ready sau 30 giây; không tự mở trình duyệt."
) &

# 5. Khởi chạy máy chủ FastAPI Backend
python -m uvicorn src.api.api:app --host 127.0.0.1 --port 8000
