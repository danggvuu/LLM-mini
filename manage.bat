@echo off
:: ==============================================================================
:: Google NotebookLM Mini - Project CLI Manager (Windows)
:: Usage:
::   manage.bat dev     - Chạy môi trường phát triển (Auto reload)
::   manage.bat health  - Kiểm tra sức khỏe toàn bộ hệ sinh thái
::   manage.bat install - Cài đặt toàn bộ dependencies (Python & Frontend)
::   manage.bat build   - Biên dịch Frontend React SPA vào production
::   manage.bat clean   - Dọn dẹp cache (__pycache__, logs, temporary files)
:: ==============================================================================

chcp 65001 >nul
cd /d "%~dp0"
set "PYTHONPATH=%~dp0"
set "PYTHONUNBUFFERED=1"

:: Kích hoạt môi trường ảo nếu có
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)

set "COMMAND=%~1"
if "%COMMAND%"=="" set "COMMAND=help"

if /i "%COMMAND%"=="dev" goto :CMD_DEV
if /i "%COMMAND%"=="health" goto :CMD_HEALTH
if /i "%COMMAND%"=="install" goto :CMD_INSTALL
if /i "%COMMAND%"=="build" goto :CMD_BUILD
if /i "%COMMAND%"=="clean" goto :CMD_CLEAN
if /i "%COMMAND%"=="help" goto :CMD_HELP

echo ❌ Lệnh không hợp lệ: %COMMAND%
goto :CMD_HELP

:CMD_DEV
echo 🚀 Khởi chạy NotebookLM Mini ở chế độ Development (Reload)...
python -m uvicorn src.api.api:app --host 0.0.0.0 --port 8000 --reload
goto :EOF

:CMD_HEALTH
echo 🔍 Đang chẩn đoán tình trạng hệ thống...
python -c "from src.api.routers.system import diagnose_system; from pprint import pprint; import json; res = diagnose_system(); print('\n=== KẾT QUẢ CHẨN ĐOÁN HỆ THỐNG ==='); print('Trạng thái tổng thể:', res.get('status', '').upper()); [print('✅' if v.get('status') == 'healthy' else '⚠️', f'[{k.upper()}]:', v.get('message')) for k, v in res.get('components', {}).items()]; print('==================================\n')"
goto :EOF

:CMD_INSTALL
echo 📦 Đang cài đặt thư viện Backend từ requirements.txt...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo 🎨 Đang cài đặt thư viện Frontend...
cd frontend
call npm install
cd ..
echo ✅ Đã cài đặt hoàn tất toàn bộ dependencies!
goto :EOF

:CMD_BUILD
echo 🔨 Đang biên dịch Frontend React SPA...
cd frontend
call npm run build
cd ..
echo ✅ Build Frontend hoàn tất tại thư mục frontend/dist!
goto :EOF

:CMD_CLEAN
echo 🧹 Đang dọn dẹp cache và các tệp tạm thời...
for /d /r . %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"
for /d /r . %%d in (.pytest_cache) do @if exist "%%d" rd /s /q "%%d"
if exist "storage\podcasts\temp_*" rd /s /q "storage\podcasts\temp_*"
if exist "storage\podcasts\gtts_*" rd /s /q "storage\podcasts\gtts_*"
echo ✅ Đã dọn dẹp sạch sẽ!
goto :EOF

:CMD_HELP
echo ========================================================================
echo          🛠️  NOTEBOOKLM MINI - CLI MANAGER (WINDOWS)
echo ========================================================================
echo Cách dùng:
echo   manage.bat dev      : Khởi chạy máy chủ ở chế độ reload (Hot-reload)
echo   manage.bat health   : Tự chẩn đoán tình trạng hệ thống và AI models
echo   manage.bat install  : Cài đặt toàn bộ thư viện cần thiết
echo   manage.bat build    : Biên dịch lại giao diện Frontend React
echo   manage.bat clean    : Dọn dẹp bộ nhớ đệm và các tệp rác tạm thời
echo ========================================================================
goto :EOF
