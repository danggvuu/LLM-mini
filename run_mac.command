#!/bin/bash

# ==============================================================================
# NotebookLM-Mini 1-Click Run Script for macOS
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Khởi động NotebookLM-Mini cho macOS..."

# Di chuyển đến thư mục chứa script
cd "$(dirname "$0")"

# Hàm kiểm tra command có tồn tại
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Kiểm tra Python
if ! command_exists python3; then
    echo "❌ Lỗi: Không tìm thấy Python3. Vui lòng cài đặt Python (https://www.python.org/downloads/mac-osx/)"
    exit 1
fi

# 1.5 Cài đặt các công cụ hệ thống cần thiết qua Homebrew
if command_exists brew; then
    if ! command_exists ffmpeg; then
        echo "📦 Đang cài đặt ffmpeg (để xử lý âm thanh)..."
        brew install ffmpeg
    fi
    if ! command_exists tesseract; then
        echo "📦 Đang cài đặt Tesseract OCR (để nhận diện chữ trong ảnh)..."
        brew install tesseract tesseract-lang
    fi
else
    echo "⚠️ Cảnh báo: Homebrew chưa được cài đặt, bỏ qua tự động cài ffmpeg và tesseract."
fi

# 2. Kiểm tra và cài đặt uv (Trình quản lý package siêu tốc)
if ! command_exists uv; then
    echo "📦 Đang cài đặt uv (Công cụ quản lý môi trường siêu tốc)..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# 3. Khởi tạo môi trường ảo (nếu chưa có)
if [ ! -d ".venv" ]; then
    echo "🛠 Đang tạo môi trường ảo..."
    uv venv
fi

# 4. Kích hoạt môi trường ảo
source .venv/bin/activate

# 5. Đảm bảo frontend dist đã sẵn sàng và cập nhật mới nhất
if command_exists npm; then
    cd frontend
    if [ ! -d "node_modules" ]; then
        echo "📥 Đang cài đặt thư viện frontend..."
        npm install
    fi
    if [ ! -d "dist" ] || [ "package.json" -nt "dist/index.html" ] || [ "src" -nt "dist/index.html" ]; then
        echo "🏗 Đang biên dịch giao diện Frontend..."
        npm run build
    fi
    cd ..
fi

# 6. Khởi động hệ thống siêu tốc (1-2s)
echo "✨ Khởi động NotebookLM Mini thành công!"
echo "-> Đang mở trình duyệt tại: http://localhost:8000"

# Mở trình duyệt sau 1.5s
(sleep 1.5 && open http://localhost:8000) &

# Chạy Backend FastAPI (auto-reload khi có thay đổi)
uvicorn src.api.api:app --host 127.0.0.1 --port 8000 --reload
