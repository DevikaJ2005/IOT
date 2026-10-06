@echo off
setlocal

taskkill /F /IM uvicorn.exe >nul 2>&1
for /f "tokens=1" %%p in ('wmic process where "name like 'node.exe'" get processid 2^>nul ^| findstr /r /v "^$"') do (
    taskkill /F /PID %%p >nul 2>&1
)

echo IoT Face Security system stopped.
exit /b 0
