@echo off
title ATUR PRINT BRIDGE KE 1 LEMBAR (1 COPY)
cd /d "%~dp0"
echo =========================================================
echo   PENGATURAN KOMPUTER: MODE 1 COPY (1 LEMBAR CETAK)
echo =========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "@{ copies = 1; updatedAt = (Get-Date -Format 's') } | ConvertTo-Json | Set-Content -Path '%~dp0bridge-config.json' -Encoding UTF8; Write-Host '[SUKSES] Komputer ini sekarang diatur mencetak: 1 LEMBAR STRUK.' -ForegroundColor Green"
echo.
echo Jika Print Bridge sedang aktif di latar belakang,
echo pengaturan 1 lembar ini akan LANGSUNG BERLAKU tanpa perlu restart.
echo.
pause
