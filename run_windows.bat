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

:: Kiểm tra lệnh python trong PATH. Dự án dùng Python 3.11+.
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1
if not errorlevel 1 (
    set "SYSTEM_PY=python"
    goto :PYTHON_FOUND
)

:: Kiểm tra lệnh py launcher
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1
if not errorlevel 1 (
    set "SYSTEM_PY=py -3"
    goto :PYTHON_FOUND
)

:: Quét các đường dẫn cài đặt Python thông dụng trên Windows
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set SYSTEM_PY="%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    goto :PYTHON_FOUND
)
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set SYSTEM_PY="%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    goto :PYTHON_FOUND
)
if exist "%ProgramFiles%\Python311\python.exe" (
    set SYSTEM_PY="%ProgramFiles%\Python311\python.exe"
    goto :PYTHON_FOUND
)
if exist "%ProgramFiles%\Python312\python.exe" (
    set SYSTEM_PY="%ProgramFiles%\Python312\python.exe"
    goto :PYTHON_FOUND
)
if exist "C:\Python311\python.exe" (
    set SYSTEM_PY="C:\Python311\python.exe"
    goto :PYTHON_FOUND
)
if exist "C:\Python312\python.exe" (
    set SYSTEM_PY="C:\Python312\python.exe"
    goto :PYTHON_FOUND
)
if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" (
    set SYSTEM_PY="%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    goto :PYTHON_FOUND
)
if exist "%ProgramFiles%\Python313\python.exe" (
    set SYSTEM_PY="%ProgramFiles%\Python313\python.exe"
    goto :PYTHON_FOUND
)

:PYTHON_NOT_FOUND
echo.
echo ❌ LỖI: Không tìm thấy Python 3.11+ trên máy tính!
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
        echo ❌ Không thể tạo môi trường .venv. Dừng để tránh cài nhầm vào Python hệ thống.
        pause
        exit /b 1
    ) else (
        echo [2/4] Đã tạo thành công môi trường ảo .venv!
        set "RUN_PY=.venv\Scripts\python.exe"
    )
) else (
    echo [2/4] Môi trường ảo (.venv) đã sẵn sàng.
    set "RUN_PY=.venv\Scripts\python.exe"
)

:: Dùng trực tiếp Python trong .venv để tránh phụ thuộc vào trạng thái activate.
%RUN_PY% -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1
if errorlevel 1 goto :VENV_PYTHON_OLD

:: -----------------------------------------------------------------------------
:: 3. KIỂM TRA VÀ TỰ ĐỘNG CÀI ĐẶT THƯ VIỆN (FASTAPI, UVICORN, QDRANT...)
:: -----------------------------------------------------------------------------
echo [3/4] Đang kiểm tra các gói thư viện dự án...
%RUN_PY% -c "import fastapi, uvicorn, qdrant_client, sentence_transformers, edge_tts, markitdown, pytesseract" >nul 2>&1
if errorlevel 1 (
    echo.
    echo ========================================================================
    echo 📦  PHÁT HIỆN THIẾU THƯ VIỆN BACKEND!
    echo ⏳ Đang tự động cài đặt các thư viện cần thiết từ requirements.txt...
    echo 💡 Quá trình này chỉ diễn ra 1 lần duy nhất trong lần khởi động đầu tiên.
    echo ========================================================================
    echo.
    %RUN_PY% -m pip install --upgrade pip
    if errorlevel 1 goto :INSTALL_FAILED
    %RUN_PY% -m pip install -r requirements.txt
    if errorlevel 1 (
        goto :INSTALL_FAILED
    )
    echo [3/4] Cài đặt thư viện hoàn tất!
) else (
    echo [3/4] Toàn bộ thư viện Backend đã đầy đủ và sẵn sàng.
)

:: Đảm bảo các gói âm thanh luôn sẵn sàng
%RUN_PY% -c "import pydub, gtts" >nul 2>&1
if errorlevel 1 (
    %RUN_PY% -m pip install pydub gtts
    if errorlevel 1 goto :INSTALL_FAILED
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
        if errorlevel 1 (
            cd ..
            goto :BUILD_FAILED
        )
        cd ..
    ) else (
        if not exist "frontend\dist\index.html" goto :NPM_MISSING
        echo [!] Không tìm thấy npm; dùng frontend/dist có sẵn.
    )
) else (
    echo [4/4] Giao diện React SPA đã sẵn sàng.
)

echo [5/5] Đang khởi động Backend...
 powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=New-Object Net.Sockets.TcpClient; try{$c.Connect('127.0.0.1',8000); exit 0}catch{exit 1}finally{$c.Dispose()}" >nul 2>&1
if not errorlevel 1 goto :PORT_IN_USE
echo [5/5] Đang chờ Backend sẵn sàng rồi mới mở trình duyệt...
start "NotebookLM Ready Check" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; 1..60 | %% { try { $r=Invoke-RestMethod http://127.0.0.1:8000/api/system/ready -TimeoutSec 2; if($r.ready){$ok=$true; break} } catch {}; Start-Sleep -Milliseconds 500 }; if($ok){Start-Process http://localhost:8000}"
%RUN_PY% -m uvicorn src.api.api:app --host 127.0.0.1 --port 8000

if errorlevel 1 (
    echo.
    echo ❌ Đã xảy ra lỗi khi khởi chạy máy chủ!
    echo Vui lòng kiểm tra lại thông báo lỗi ở trên.
    echo.
    pause
)
exit /b 0

:INSTALL_FAILED
echo.
echo ❌ Cài đặt dependency thất bại.
echo Kiểm tra Internet, quyền ghi và Python 3.11+. Chạy lại manage.bat install để xem log.
pause
exit /b 1

:VENV_PYTHON_OLD
echo.
echo ❌ Môi trường .venv hiện có dùng Python cũ hơn 3.11.
echo Hãy đổi tên hoặc xóa .venv rồi chạy lại launcher để tạo môi trường mới.
pause
exit /b 1

:BUILD_FAILED
echo.
echo ❌ Build frontend thất bại. Kiểm tra Node.js/npm và log phía trên.
pause
exit /b 1

:NPM_MISSING
echo.
echo ❌ Chưa có frontend/dist và không tìm thấy npm.
echo Cài Node.js LTS rồi chạy lại launcher.
pause
exit /b 1

:SERVER_FAILED
echo.
echo ❌ Backend không sẵn sàng sau 30 giây.
echo Có thể cổng 8000 đang bị chiếm hoặc dependency backend bị lỗi.
pause
exit /b 1

:PORT_IN_USE
echo.
echo ❌ Cổng 8000 đã có dịch vụ khác đang chạy. Hãy dừng dịch vụ đó rồi mở lại.
pause
exit /b 1
