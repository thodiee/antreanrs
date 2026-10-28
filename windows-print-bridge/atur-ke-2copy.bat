@echo off
title ATUR PRINT BRIDGE KE 2 RANGKAP (COPY 2)
cd /d "%~dp0"
echo =========================================================
echo   PENGATURAN KOMPUTER: MODE 2 RANGKAP (PASIEN & POLI)
echo =========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "@{ copies = 2; updatedAt = (Get-Date -Format 's') } | ConvertTo-Json | Set-Content -Path '%~dp0bridge-config.json' -Encoding UTF8; Write-Host '[SUKSES] Komputer ini sekarang diatur mencetak: 2 RANGKAP STRUK.' -ForegroundColor Green"
echo.
echo Jika Print Bridge sedang aktif di latar belakang,
echo pengaturan 2 rangkap ini akan LANGSUNG BERLAKU tanpa perlu restart.
echo.
pause
