@echo off
echo OPDC Chatbot Launcher
echo.
echo Checking files...
if not exist "backend\server.js" (
    echo Error: backend\server.js not found
    echo Please place this file in: D:\notebooklm-automation\opdc-chatbot\
    pause
    exit /b 1
)
echo Killing old process on port 8001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo Starting server...
cd /d backend
start cmd /c node server.js
echo Waiting for server...
set MAX_WAIT=30
:WAIT_LOOP
timeout /t 1 /nobreak >nul
set /a MAX_WAIT-=1
powershell -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost:8001/health' -Method Get -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo Server ready!
    goto SERVER_READY
)
if %MAX_WAIT% gtr 0 goto WAIT_LOOP
echo Server failed to start (timeout 30 seconds)
echo Please check the server window for errors
pause
exit /b 1
:SERVER_READY
echo Opening browser...
start "" "http://localhost:8001"
echo.
echo ========================================
echo  Ready!
echo ========================================
echo.
echo Chat UI will open in browser (http://localhost:8001)
echo Server keeps running in separate window
echo To stop: Press Ctrl+C in the server window
echo.
pause >nul
