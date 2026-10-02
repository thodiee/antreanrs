@echo off
title HENTIKAN PRINT BRIDGE
echo ========================================================
echo   MENGHENTIKAN PROSES PRINT BRIDGE DI LATAR BELAKANG
echo ========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*print-bridge.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host 'Berhasil menghentikan proses ID:' $_.ProcessId -ForegroundColor Green }"
echo.
echo Print Bridge berhasil dihentikan.
pause
