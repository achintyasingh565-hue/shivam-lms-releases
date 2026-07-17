#!/bin/bash
cd "$(dirname "$0")"

# --- One-time macOS unblock -------------------------------------------------
# Clears the "downloaded from the internet" quarantine on this whole folder and
# makes the .command files runnable, so you never have to type xattr/chmod in
# Terminal again. Runs silently and ignores errors.
xattr -dr com.apple.quarantine "$(pwd)" 2>/dev/null || true
chmod +x "$(pwd)"/*.command 2>/dev/null || true

echo "============================================================"
echo "   BUILDING SHIVAM ENTERPRISES LMS  (macOS app)"
echo "============================================================"
echo ""
echo "First run downloads components, then builds your app."
echo "This may take a few minutes - please wait."
echo ""
npm install || { echo ""; echo "ERROR: Make sure Node.js is installed (https://nodejs.org - LTS), then run again."; read -p "Press Enter to close..."; exit 1; }
echo ""
echo "Assembling the frontend (splitting -> single app)..."
npm run build || { echo ""; echo "Frontend build failed. See messages above."; read -p "Press Enter to close..."; exit 1; }
echo ""
echo "Creating the macOS app..."
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run dist || { echo ""; echo "Build failed. See messages above."; read -p "Press Enter to close..."; exit 1; }

# Clear quarantine on the freshly-built app too, so it opens without a warning.
xattr -dr com.apple.quarantine "$(pwd)/dist" 2>/dev/null || true

echo ""
echo "============================================================"
echo "   DONE!  Open:  dist/mac-arm64  (or dist/mac)"
echo "   Drag  'Shivam Enterprises LMS.app'  into Applications,"
echo "   then DELETE the dist folder so no duplicate remains."
echo "============================================================"
echo ""
read -p "Press Enter to close..."
