@echo off
title Kids Code 3D
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required to run the server.
  echo Install it from https://nodejs.org and try again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing packages. This can take a minute...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting Kids Code 3D...
echo The browser should open index.html. Leave this window open.
echo Close this window to stop the server.
echo.
call npm start
pause
