@echo off
setlocal
set "SCRIPT=%~dp0realtime-monitor.ps1"
for %%I in ("%~dp0..") do set "TQ_REALTIME_REPO=%%~fI"

if not exist "%SCRIPT%" (
  echo Script principal nao encontrado: "%SCRIPT%"
  pause
  endlocal & exit /b 1
)

start "Tabuada Quest 2 - Realtime" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SCRIPT%"
endlocal & exit /b 0
