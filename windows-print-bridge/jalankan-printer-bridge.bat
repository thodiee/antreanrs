@echo off
title PRINT BRIDGE ANTREAN RS (SILENT PRINTING - COPY 2)
cd /d "%~dp0"
echo =========================================================
echo   MEMULAI PRINT BRIDGE ANTREAN RS UNTUK WINDOWS
echo   Port : http://localhost:18080/
echo   Mode : OTOMATIS RANGKAP 2 (COPY 2 - PASIEN & PETUGAS)
echo =========================================================
echo.
echo Pastikan printer thermal sudah menyala dan tercolok via USB.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0print-bridge.ps1" -Copies 2
pause
