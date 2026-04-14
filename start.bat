@echo off
echo =============================================
echo PhD Scholar Registration System - Quick Start
echo =============================================
echo.

echo Step 1: Setting up Backend...
cd backend

echo Creating virtual environment...
python -m venv venv

echo Activating virtual environment...
call venv\Scripts\activate

echo Installing Python dependencies...
pip install -r requirements.txt

echo.
echo Backend setup complete!
echo.
echo Starting Backend Server...
start cmd /k "cd /d %CD% && set PORT=8001 && venv\Scripts\activate && python main.py"

cd ..

echo.
echo Step 2: Setting up Frontend...
cd frontend

echo Installing Node dependencies...
call npm install

echo.
echo Frontend setup complete!
echo.
echo Starting Frontend Server...
start cmd /k "cd /d %CD% && npm run dev"

cd ..

echo.
echo =============================================
echo Setup Complete!
echo =============================================
echo.
echo Backend running at: http://localhost:8001
echo Frontend running at: http://localhost:5173
echo.
echo Press any key to exit this window...
pause > nul
