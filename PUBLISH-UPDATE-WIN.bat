@echo off
REM ============================================================================
REM  Builds the Windows app AND publishes it as a GitHub release, so every
REM  installed copy auto-updates. Needs Administrator (for the build) and your
REM  GitHub token (to upload). You only paste the token; nothing is stored.
REM ============================================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Asking for Administrator rights - please click YES...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
setlocal
cd /d "%~dp0"
set CSC_IDENTITY_AUTO_DISCOVERY=false

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org,
  echo RESTART Windows, then run this file again.
  pause & exit /b 1
)

echo ============================================================
echo    PUBLISH UPDATE - Shivam Enterprises LMS (Windows)
echo ============================================================
echo.
echo Paste your GitHub token (it looks like ghp_...) and press Enter.
echo (You created this once under GitHub - Developer settings - Tokens.)
echo.
set /p GH_TOKEN=GitHub token:
if "%GH_TOKEN%"=="" ( echo No token entered. & pause & exit /b 1 )
echo.
echo Building and publishing... this can take a few minutes. Leave it running.
call npm install || goto :err
call npm run "publish:win" || goto :err

echo.
echo ============================================================
echo    PUBLISHED!  Version is now live on GitHub Releases.
echo    Installed Windows apps will offer the update within a few
echo    hours (or on their next launch).
echo ============================================================
set GH_TOKEN=
echo.
pause
exit /b 0

:err
set GH_TOKEN=
echo.
echo Publish failed. Common causes: wrong/expired token, no internet, or the
echo version in package.json was not increased. See the messages above.
echo.
pause
exit /b 1
