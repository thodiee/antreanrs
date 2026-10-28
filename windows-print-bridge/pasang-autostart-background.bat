@echo off
title PASANG AUTOSTART PRINT BRIDGE (BACKGROUND)
cd /d "%~dp0"
echo ========================================================
echo   MEMASANG AUTOSTART PRINT BRIDGE DI LATAR BELAKANG
echo ========================================================
echo.
echo Pilih mode jumlah lembar cetak untuk komputer ini:
echo   [1] 1 Lembar Cetak (Hanya Pasien)
echo   [2] 2 Rangkap Cetak (Pasien & Petugas / Poli)
echo.
set /p PILIHAN="Ketik 1 atau 2 [Tekan Enter untuk default: 2]: "
if "%PILIHAN%"=="1" (
    set TARGET_COPIES=1
) else (
    set TARGET_COPIES=2
)
echo.
echo Mode terpilih: %TARGET_COPIES% Lembar.
powershell -NoProfile -ExecutionPolicy Bypass -Command "@{ copies = %TARGET_COPIES%; updatedAt = (Get-Date -Format 's') } | ConvertTo-Json | Set-Content -Path '%~dp0bridge-config.json' -Encoding UTF8"

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_PATH=%~dp0jalankan-background.vbs"
set "SHORTCUT_PATH=%STARTUP_DIR%\PrintBridgeAntreanRS.lnk"

echo.
echo 1. Mendaftarkan ke Windows Startup...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%VBS_PATH%\"'; $s.WorkingDirectory = '%~dp0'; $s.WindowStyle = 7; $s.Description = 'Print Bridge Antrean RS Background Service'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo    [OK] Sukses didaftarkan ke Windows Startup!
) else (
    echo    [PERINGATAN] Gagal membuat shortcut di folder Startup.
)

echo.
echo 2. Menghentikan proses lama jika ada...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*print-bridge.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

echo.
echo 3. Menjalankan Print Bridge sekarang di latar belakang (background)...
start "" wscript.exe "%VBS_PATH%"

timeout /t 2 /nobreak >nul

echo.
echo ========================================================
echo [SELESAI] Print Bridge (%TARGET_COPIES% Lembar) sudah AKTIF!
echo Setiap kali komputer ini dinyalakan atau direstart,
echo Print Bridge akan OTOMATIS berjalan di latar belakang.
echo ========================================================
echo.
pause
