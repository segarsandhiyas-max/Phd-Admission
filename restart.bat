@echo off
echo.
echo ================================================
echo  PhD Scholar Registration System - Restart
echo ================================================
echo.
echo This will restart both Backend and Frontend servers
echo.
pause

echo.
echo Stopping any running servers...
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul

echo.
echo Waiting 2 seconds...
timeout /t 2 /nobreak >nul

echo.
echo Starting Backend Server...
start "Backend Server" cmd /k "cd /d %~dp0backend && venv\Scripts\activate && python -m uvicorn main:app --reload"

echo.
echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak >nul

echo.
echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ================================================
echo  Both servers are starting...
echo ================================================
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Press any key to close this window...
pause >nul
