@echo off
title CEK STATUS PRINT BRIDGE
echo ========================================================
echo   MENGECEK STATUS PRINT BRIDGE
echo ========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $res = Invoke-RestMethod -Uri 'http://localhost:18080/status' -TimeoutSec 2; Write-Host '[STATUS: AKTIF BERJALAN DI LATAR BELAKANG]' -ForegroundColor Green; Write-Host 'Printer Tujuan :' $res.printer -ForegroundColor Cyan; Write-Host 'Port           : 18080' -ForegroundColor Gray } catch { Write-Host '[STATUS: TIDAK AKTIF / MATI]' -ForegroundColor Red; Write-Host 'Silakan jalankan pasang-autostart-background.bat atau jalankan-printer-bridge.bat' -ForegroundColor Yellow }"
echo.
pause
