@echo off
echo Starting PhD Scholar Registration System Backend...
cd backend
call venv\Scripts\activate
set PORT=8001
python main.py
