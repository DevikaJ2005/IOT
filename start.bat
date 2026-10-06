@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

if not exist ".venv" (
    echo Creating Python virtual environment...
    py -3.11 -m venv .venv
)

call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip >nul 2>&1
python -m pip install -r requirements.txt >nul 2>&1

if not exist "logs" mkdir logs

if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install --no-fund --no-audit >nul 2>&1
    cd ..
)

echo Starting backend services...
start "IoT Face Security Backend" /B ".venv\Scripts\python.exe" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 > logs\backend.log 2>&1

cd frontend
start "IoT Face Security Frontend" /B npm run dev -- --hostname 0.0.0.0 --port 3000 > ..\logs\frontend.log 2>&1
cd ..

:wait_backend
curl -sS http://localhost:8000/api/health >nul 2>nul
if errorlevel 1 (
    timeout /t 2 >nul
    goto wait_backend
)

:wait_frontend
curl -sS http://localhost:3000 >nul 2>nul
if errorlevel 1 (
    timeout /t 2 >nul
    goto wait_frontend
)

start "" http://localhost:3000
echo System ready. Opened http://localhost:3000
exit /b 0
