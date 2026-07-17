@echo off
REM ============================================================================
REM  Self-elevate to Administrator FIRST.
REM  electron-builder unpacks a code-signing helper that contains symbolic links,
REM  and Windows only lets an Administrator (or Developer Mode) create those.
REM  Without this you get: "Cannot create symbolic link : A required privilege
REM  is not held by the client". Running as admin fixes it.
REM ============================================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo This build needs Administrator rights.
  echo A Windows prompt will appear - please click YES.
  echo.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

setlocal
cd /d "%~dp0"
REM We ship an UNSIGNED app - tell electron-builder not to look for a certificate.
set CSC_IDENTITY_AUTO_DISCOVERY=false

echo ============================================================
echo    BUILDING SHIVAM ENTERPRISES LMS  (Windows app)
echo    Running as Administrator
echo ============================================================
echo.

REM --- make sure Node.js is installed -------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed on this PC.
  echo.
  echo   1^) Open a browser and go to:  https://nodejs.org
  echo   2^) Download the LTS version and install it ^(Next / Next / Install^).
  echo   3^) RESTART Windows, then run this file again.
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo Using Node.js %%v
echo.

echo First run downloads components, then builds your app.
echo This may take a few minutes - please leave the window open.
echo.
call npm install || goto :err
echo.
echo Assembling the frontend...
call npm run build || goto :err
echo.
echo Creating the Windows installer...
call npm run dist:win || goto :err
echo.
echo ============================================================
echo    DONE!  Open the "dist" folder and run the installer:
echo    "Shivam Enterprises LMS Setup x.x.x.exe"
echo ============================================================
echo.
if exist "dist" start "" "dist"
pause
exit /b 0

:err
echo.
echo ------------------------------------------------------------
echo Build failed. Most common causes and fixes:
echo   * "Cannot create symbolic link" - you skipped the Administrator
echo     prompt. Close this window and double-click the file again, then
echo     click YES on the Windows prompt.  (Or turn on Developer Mode:
echo     Settings ^> Privacy ^& Security ^> For developers ^> Developer Mode = On.)
echo   * The PC lost internet during the build - reconnect and run again.
echo   * Node.js was just installed - RESTART Windows, then run again.
echo It is always safe to run this file again to retry.
echo ------------------------------------------------------------
echo.
pause
exit /b 1
