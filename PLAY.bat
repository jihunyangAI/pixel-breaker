@echo off
rem Double-click this file to play. It starts the local server and opens the game in your browser.
title PIXEL BREAKER
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
node server.js --open
pause
