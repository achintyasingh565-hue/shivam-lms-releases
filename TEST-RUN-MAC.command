#!/bin/bash
cd "$(dirname "$0")"

# One-time macOS unblock (no Terminal needed): clear quarantine + make runnable.
xattr -dr com.apple.quarantine "$(pwd)" 2>/dev/null || true
chmod +x "$(pwd)"/*.command 2>/dev/null || true

echo "Starting the app for a quick test (no installer yet)..."
npm install || { echo "Install Node.js from https://nodejs.org (LTS), then run again."; read -p "Press Enter..."; exit 1; }
npm start
