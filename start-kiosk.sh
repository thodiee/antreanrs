#!/bin/bash
# ==========================================================
# LAUNCHER KIOSK ANTREAN RS - SILENT PRINTING (TANPA POPUP)
# ==========================================================

IP=$(ip -4 addr show enp6s0f3u1u1c2 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1)
if [ -z "$IP" ]; then
  IP="192.168.1.87"
fi

URL="http://${IP}:3000/?view=kiosk"

echo "=========================================================="
echo "  MEMBUKA KIOSK PASIEN DENGAN MODE SILENT PRINTING"
echo "  URL: $URL"
echo "=========================================================="

PROFILE_DIR="/tmp/kiosk_browser_profile"
mkdir -p "$PROFILE_DIR"

FLAGS="--kiosk --kiosk-printing --disable-print-preview --user-data-dir=$PROFILE_DIR --no-first-run --no-default-browser-check --disable-infobars --disable-session-crashed-bubble"

if command -v google-chrome >/dev/null 2>&1; then
  echo "Menggunakan Google Chrome..."
  exec google-chrome $FLAGS "$URL"
elif command -v google-chrome-stable >/dev/null 2>&1; then
  echo "Menggunakan Google Chrome Stable..."
  exec google-chrome-stable $FLAGS "$URL"
elif command -v brave-browser >/dev/null 2>&1; then
  echo "Menggunakan Brave Browser..."
  exec brave-browser $FLAGS "$URL"
elif command -v chromium >/dev/null 2>&1; then
  echo "Menggunakan Chromium..."
  exec chromium $FLAGS "$URL"
elif command -v chromium-browser >/dev/null 2>&1; then
  echo "Menggunakan Chromium Browser..."
  exec chromium-browser $FLAGS "$URL"
else
  xdg-open "$URL"
fi
