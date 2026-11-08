@echo off
:: ==============================================================================
:: Google NotebookLM Mini - 1-Click Launcher (Windows)
:: Tự động tạo môi trường ảo (.venv), cài đặt thư viện và khởi chạy máy chủ.
:: ==============================================================================

title NotebookLM Mini Launcher
chcp 65001 >nul
cd /d "%~dp0"
set "PYTHONPATH=%~dp0"
set "PYTHONUNBUFFERED=1"

echo.
echo ========================================================================
echo          🚀 NOTEBOOKLM MINI - KHỞI ĐỘNG HỆ THỐNG 1-CLICK (WINDOWS)       
echo ========================================================================
echo.

:: -----------------------------------------------------------------------------
:: 1. TÌM KIẾM TRÌNH THÔNG DỊCH PYTHON
:: -----------------------------------------------------------------------------
set "SYSTEM_PY="

:: Kiểm tra lệnh python trong PATH
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>&1
if not errorlevel 1 (
    set "SYSTEM_PY=python"
    goto :PYTHON_FOUND
)

:: Kiểm tra lệnh py launcher
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>&1
if not errorlevel 1 (
    set "SYSTEM_PY=py -3"
    goto :PYTHON_FOUND
)

:: Quét các đường dẫn cài đặt Python thông dụng trên Windows
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "SYSTEM_PY=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    goto :PYTHON_FOUND
)
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "SYSTEM_PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    goto :PYTHON_FOUND
)
if exist "%ProgramFiles%\Python311\python.exe" (
    set "SYSTEM_PY=%ProgramFiles%\Python311\python.exe"
    goto :PYTHON_FOUND
)
if exist "%ProgramFiles%\Python312\python.exe" (
    set "SYSTEM_PY=%ProgramFiles%\Python312\python.exe"
    goto :PYTHON_FOUND
)
if exist "C:\Python311\python.exe" (
    set "SYSTEM_PY=C:\Python311\python.exe"
    goto :PYTHON_FOUND
)
if exist "C:\Python312\python.exe" (
    set "SYSTEM_PY=C:\Python312\python.exe"
    goto :PYTHON_FOUND
)

:PYTHON_NOT_FOUND
echo.
echo ❌ LỖI: Không tìm thấy Python 3.9+ trên máy tính!
echo.
echo 👉 Vui lòng tải và cài đặt Python từ trang chủ:
echo    https://www.python.org/downloads/
echo.
echo ⚠️  LƯU Ý QUAN TRỌNG KHI CÀI ĐẶT:
echo    Hãy nhớ tích chọn ô: [X] "Add python.exe to PATH" ở màn hình đầu tiên!
echo.
pause
exit /b 1

:PYTHON_FOUND
echo [1/4] Đã nhận diện Python: %SYSTEM_PY%

:: -----------------------------------------------------------------------------
:: 2. THIẾT LẬP MÔI TRƯỜNG ẢO PYTHON (.venv)
:: -----------------------------------------------------------------------------
if not exist ".venv\Scripts\python.exe" (
    echo [2/4] Chưa có môi trường ảo (.venv). Đang tự động khởi tạo...
    %SYSTEM_PY% -m venv .venv
    if errorlevel 1 (
        echo [!] Không thể tạo .venv tự động. Sử dụng trực tiếp Python hệ thống...
        set "RUN_PY=%SYSTEM_PY%"
    ) else (
        echo [2/4] Đã tạo thành công môi trường ảo .venv!
        set "RUN_PY=.venv\Scripts\python.exe"
    )
) else (
    echo [2/4] Môi trường ảo (.venv) đã sẵn sàng.
    set "RUN_PY=.venv\Scripts\python.exe"
)

:: Kích hoạt môi trường ảo nếu tồn tại
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
    set "RUN_PY=python"
)

:: -----------------------------------------------------------------------------
:: 3. KIỂM TRA VÀ TỰ ĐỘNG CÀI ĐẶT THƯ VIỆN (FASTAPI, UVICORN, QDRANT...)
:: -----------------------------------------------------------------------------
echo [3/4] Đang kiểm tra các gói thư viện dự án...
%RUN_PY% -c "import fastapi, uvicorn, qdrant_client, sentence_transformers, edge_tts" >nul 2>&1
if errorlevel 1 (
    echo.
    echo ========================================================================
    echo 📦  PHÁT HIỆN THIẾU THƯ VIỆN BACKEND!
    echo ⏳ Đang tự động cài đặt các thư viện cần thiết từ requirements.txt...
    echo 💡 Quá trình này chỉ diễn ra 1 lần duy nhất trong lần khởi động đầu tiên.
    echo ========================================================================
    echo.
    %RUN_PY% -m pip install --upgrade pip
    %RUN_PY% -m pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo [!] Cài đặt dự phòng các gói cốt lõi...
        %RUN_PY% -m pip install fastapi uvicorn[standard] python-multipart pydantic pydantic-settings qdrant-client sentence-transformers rank-bm25 edge-tts pydub gtts jinja2 pypdf requests numpy
    )
    echo [3/4] Cài đặt thư viện hoàn tất!
) else (
    echo [3/4] Toàn bộ thư viện Backend đã đầy đủ và sẵn sàng.
)

:: Đảm bảo các gói âm thanh luôn sẵn sàng
%RUN_PY% -c "import pydub, gtts" >nul 2>&1
if errorlevel 1 (
    %RUN_PY% -m pip install pydub gtts >nul 2>&1
)

:: -----------------------------------------------------------------------------
:: 4. KIỂM TRA BẢN BUILD FRONTEND REACT
:: -----------------------------------------------------------------------------
if not exist "frontend\dist\index.html" (
    echo [4/4] Đang kiểm tra giao diện Frontend...
    where npm >nul 2>&1
    if not errorlevel 1 (
        echo [4/4] Đang biên dịch giao diện React SPA...
        cd frontend
        call npm run build
        cd ..
    ) else (
        echo [!] Không tìm thấy npm để build giao diện. Sử dụng file có sẵn.
    )
) else (
    echo [4/4] Giao diện React SPA đã sẵn sàng.
)

echo.
echo ========================================================================
echo   🎉 KHỞI ĐỘNG HỆ THỐNG THÀNH CÔNG!
echo   🌐 Địa chỉ ứng dụng: http://localhost:8000
echo   💡 Trình duyệt sẽ tự động mở sau 2 giây...
echo   🛑 Để dừng hệ thống, nhấn phím Ctrl + C trong cửa sổ này.
echo ========================================================================
echo.

:: Mở trình duyệt web sau 2 giây
start "" http://localhost:8000

:: -----------------------------------------------------------------------------
:: 5. KHỞI CHẠY MÁY CHỦ UVICORN FASTAPI
:: -----------------------------------------------------------------------------
%RUN_PY% -m uvicorn src.api.api:app --host 0.0.0.0 --port 8000

if errorlevel 1 (
    echo.
    echo ❌ Đã xảy ra lỗi khi khởi chạy máy chủ!
    echo Vui lòng kiểm tra lại thông báo lỗi ở trên.
    echo.
    pause
)
