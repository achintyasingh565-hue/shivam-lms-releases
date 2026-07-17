#!/bin/bash
cd "$(dirname "$0")"

# One-time macOS unblock (so this runs without the Gatekeeper prompt on re-runs)
xattr -dr com.apple.quarantine "$(pwd)" 2>/dev/null || true
chmod +x "$(pwd)"/*.command 2>/dev/null || true

echo "============================================================"
echo "   PUBLISH UPDATE - Shivam Enterprises LMS (Mac)"
echo "============================================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org,"
  echo "then run this file again."
  read -p "Press Enter to close..."
  exit 1
fi

echo "Paste your GitHub token (it looks like ghp_...) and press Enter."
echo "(Typing is hidden for safety.)"
read -s -p "GitHub token: " GH_TOKEN
echo ""
if [ -z "$GH_TOKEN" ]; then echo "No token entered."; read -p "Press Enter..."; exit 1; fi
export GH_TOKEN
export CSC_IDENTITY_AUTO_DISCOVERY=false

echo ""
echo "Building and publishing... this can take a few minutes. Leave it running."
npm install || { echo "Failed - see messages above."; unset GH_TOKEN; read -p "Press Enter..."; exit 1; }
npm run publish:mac || { echo "Publish failed - wrong token, no internet, or the version was not increased."; unset GH_TOKEN; read -p "Press Enter..."; exit 1; }

unset GH_TOKEN
echo ""
echo "============================================================"
echo "   PUBLISHED!  The new version is live on GitHub Releases."
echo "   Installed Mac apps will show an 'update available' pop-up"
echo "   within a few hours (or on their next launch)."
echo "============================================================"
echo ""
read -p "Press Enter to close..."
