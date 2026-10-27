@echo off
title PRINT BRIDGE ANTREAN RS (MODE COPY 2 - RANGKAP 2)
cd /d "%~dp0"
echo =========================================================
echo   PRINT BRIDGE ANTREAN RS - MODE COPY 2 (RANGKAP 2)
echo   Port : http://localhost:18080/
echo   Setiap antrean akan otomatis langsung keluar 2 lembar!
echo   (Lembar 1 untuk Pasien, Lembar 2 untuk Petugas/Poli)
echo =========================================================
echo.
echo Pastikan printer thermal sudah menyala dan tercolok via USB.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0print-bridge.ps1" -Copies 2
pause
