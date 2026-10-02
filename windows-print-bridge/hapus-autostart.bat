@echo off
title HAPUS AUTOSTART PRINT BRIDGE
echo ========================================================
echo   MENGHAPUS AUTOSTART PRINT BRIDGE DARI STARTUP
echo ========================================================
echo.
set "SHORTCUT_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PrintBridgeAntreanRS.lnk"

if exist "%SHORTCUT_PATH%" (
    del "%SHORTCUT_PATH%"
    echo [OK] Shortcut autostart berhasil dihapus dari folder Startup Windows.
) else (
    echo [INFO] Shortcut autostart tidak ditemukan di Startup.
)

echo.
echo Menghentikan proses background jika sedang berjalan...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*print-bridge.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host 'Berhasil menghentikan proses ID:' $_.ProcessId -ForegroundColor Green }"

echo.
echo [SELESAI] Autostart telah dinonaktifkan.
pause
