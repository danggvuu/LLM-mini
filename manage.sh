#!/bin/bash
# ==============================================================================
# NotebookLM Mini - Unified Project Management Script (Quản lý dự án toàn diện)
# Usage:
#   ./manage.sh dev      - Khởi chạy trọn gói Backend + Frontend
#   ./manage.sh health   - Kiểm tra sức khỏe & chẩn đoán hệ thống (Self-Diagnostics)
#   ./manage.sh build    - Biên dịch Frontend React SPA
#   ./manage.sh clean    - Dọn dẹp cache & file tạm
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Kích hoạt virtualenv nếu có
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi

ACTION="${1:-dev}"

case "$ACTION" in
    dev|start|run)
        echo ""
        echo "========================================================================"
        echo "          🚀 NOTEBOOKLM MINI - KHỞI ĐỘNG HỆ THỐNG PHÁT TRIỂN            "
        echo "========================================================================"
        echo ""

        # Kiểm tra port 8000
        if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
            echo "⚠️ Cảnh báo: Port 8000 đang bận bởi tiến trình khác."
        fi

        # Kiểm tra frontend dist
        if [ ! -d "frontend/dist" ] || [ ! -f "frontend/dist/index.html" ]; then
            echo "📦 Chưa phát hiện bản build Frontend. Đang biên dịch..."
            (cd frontend && npm run build)
        fi

        echo "🌐 Đang khởi chạy máy chủ FastAPI tại: http://localhost:8000"
        echo "🛑 Nhấn Ctrl + C để dừng hệ thống."
        echo ""
        exec python3 -m uvicorn src.api.api:app --host 0.0.0.0 --port 8000 --reload
        ;;

    health|check)
        echo "🔍 Đang chẩn đoán tình trạng hệ thống..."
        python3 -c "
import sys
from fastapi.testclient import TestClient
from src.api.api import app

client = TestClient(app)
res = client.get('/api/system/health')
if res.status_code == 200:
    data = res.json()
    status = data.get('status', 'unknown')
    comps = data.get('components', {})
    print('\n=== KẾT QUẢ CHẨN ĐOÁN HỆ THỐNG ===')
    print(f'Trạng thái tổng thể: {status.upper()}')
    for k, v in comps.items():
        st = v.get('status', 'unknown')
        msg = v.get('message', '')
        icon = '✅' if st == 'healthy' else ('⚠️' if st == 'warning' else '❌')
        print(f'{icon} [{k.upper()}]: {msg}')
    print('==================================\n')
else:
    print(f'❌ Lỗi HTTP {res.status_code}')
"
        ;;

    build)
        echo "⚙️ Đang biên dịch Frontend React SPA..."
        (cd frontend && npm run build)
        echo "✅ Biên dịch thành công tại frontend/dist!"
        ;;

    clean)
        echo "🧹 Đang dọn dẹp bộ nhớ đệm và pycache..."
        find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
        find . -type f -name "*.pyc" -delete 2>/dev/null || true
        rm -rf .pytest_cache 2>/dev/null || true
        echo "✅ Dọn dẹp hoàn tất!"
        ;;

    *)
        echo "Cách dùng: $0 {dev|health|build|clean}"
        exit 1
        ;;
esac
