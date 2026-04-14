@echo off
echo.
echo ================================================
echo  PhD Scholar Registration System - Stop Servers
echo ================================================
echo.
echo This will stop both Backend and Frontend servers
echo.

echo Stopping Python/Backend servers...
taskkill /F /IM python.exe /T 2>nul
if %errorlevel% equ 0 (
    echo Backend stopped successfully.
) else (
    echo No backend server was running.
)

echo.
echo Stopping Node/Frontend servers...
taskkill /F /IM node.exe /T 2>nul
if %errorlevel% equ 0 (
    echo Frontend stopped successfully.
) else (
    echo No frontend server was running.
)

echo.
echo ================================================
echo  All servers stopped.
echo ================================================
echo.
pause
