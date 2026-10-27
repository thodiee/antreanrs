@echo off
title PRINT BRIDGE ANTREAN RS (MODE 1 COPY - 1 LEMBAR)
cd /d "%~dp0"
echo =========================================================
echo   PRINT BRIDGE ANTREAN RS - MODE 1 COPY (1 LEMBAR)
echo   Port : http://localhost:18080/
echo   Setiap antrean akan mencetak 1 lembar standar.
echo =========================================================
echo.
echo Pastikan printer thermal sudah menyala dan tercolok via USB.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0print-bridge.ps1" -Copies 1
pause
