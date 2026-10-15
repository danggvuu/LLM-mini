@echo off
:: ==============================================================================
:: Google NotebookLM Mini - 1-Click Launcher (Windows)
:: Double-click this file to start the application.
:: ==============================================================================

title NotebookLM Mini Launcher
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ========================================================================
echo          🚀 GOOGLE NOTEBOOKLM MINI - KHỞI ĐỘNG 1-CLICK (WINDOWS)         
echo ========================================================================
echo.

:: 1. Kích hoạt môi trường Python ảo (.venv)
if exist ".venv\Scripts\activate.bat" (
    echo [1/3] Đang kích hoạt môi trường ảo Python (.venv)...
    call .venv\Scripts\activate.bat
) else if exist "venv\Scripts\activate.bat" (
    echo [1/3] Đang kích hoạt môi trường ảo Python (venv)...
    call venv\Scripts\activate.bat
) else (
    echo [1/3] Dùng Python hệ thống...
)

:: 2. Kiểm tra bản build Frontend React
if not exist "frontend\dist\index.html" (
    echo [2/3] Chưa tìm thấy bản build Frontend. Đang biên dịch React...
    cd frontend
    call npm run build
    cd ..
) else (
    echo [2/3] Bản build Frontend đã sẵn sàng.
)

echo.
echo ------------------------------------------------------------------------
echo   🌐 Ứng dụng sẵn sàng tại: http://localhost:8000
echo   💡 Đang tự động mở trình duyệt...
echo   🛑 Nhấn Ctrl + C để tắt máy chủ khi dùng xong.
echo ------------------------------------------------------------------------
echo.

:: Mở trình duyệt sau 2 giây
start "" http://localhost:8000

:: 3. Khởi chạy máy chủ FastAPI Backend
python -m uvicorn src.api.api:app --host 0.0.0.0 --port 8000 --reload

pause
