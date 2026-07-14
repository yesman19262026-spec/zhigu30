@echo off
setlocal
set "ROOT=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\build-local.ps1"
if errorlevel 1 (
  echo.
  echo Build failed. Press any key to close.
  pause >nul
  exit /b 1
)

start "ZhiGu30 Local Preview" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\local-preview.ps1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173"
exit /b 0
