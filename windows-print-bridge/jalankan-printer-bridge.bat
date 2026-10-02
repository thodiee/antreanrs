@echo off
title PRINT BRIDGE ANTREAN RS (SILENT PRINTING)
cd /d "%~dp0"
echo =========================================================
echo   MEMULAI PRINT BRIDGE ANTREAN RS UNTUK WINDOWS
echo   Port: http://localhost:18080/
echo =========================================================
echo.
echo Pastikan printer thermal sudah menyala dan tercolok via USB.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0print-bridge.ps1"
pause
