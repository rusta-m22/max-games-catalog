@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 22 LTS or newer from https://nodejs.org/
 pause
 exit /b 1
)
start "" http://127.0.0.1:8080/
node serve.mjs
pause
