@echo off
title KIOSK ANTREAN RS - SILENT PRINTING (1-KLIK LANGSUNG KELUAR KERTAS)
echo ==========================================================
echo   MEMBUKA KIOSK PASIEN DENGAN MODE SILENT PRINTING
echo   Server IP: 192.168.1.87:3000
echo ==========================================================

set URL=http://192.168.1.87:3000/?view=kiosk
set PROFILE_DIR=%TEMP%\KioskChromeProfile
mkdir "%PROFILE_DIR%" 2>nul

set CHROME_FLAGS=--kiosk --kiosk-printing --disable-print-preview --user-data-dir="%PROFILE_DIR%" --no-first-run --no-default-browser-check --disable-session-crashed-bubble

:: 1. Cek Google Chrome 64-bit
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    echo Menjalankan Google Chrome (64-bit) dengan Silent Printing...
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" %CHROME_FLAGS% "%URL%"
    exit
)

:: 2. Cek Google Chrome 32-bit
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    echo Menjalankan Google Chrome (32-bit) dengan Silent Printing...
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" %CHROME_FLAGS% "%URL%"
    exit
)

:: 3. Cek Microsoft Edge
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    echo Menjalankan Microsoft Edge dengan Silent Printing...
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk --edge-kiosk-type=fullscreen --kiosk-printing --disable-print-preview --user-data-dir="%PROFILE_DIR%" "%URL%"
    exit
)

:: 4. Fallback Default Browser
start "" "%URL%"
