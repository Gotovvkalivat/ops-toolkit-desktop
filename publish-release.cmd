@echo off
setlocal
cd /d "%~dp0"

call "%CD%\publish-desktop-app.cmd"
if errorlevel 1 exit /b 1

call "%CD%\publish-localhost-server.cmd"
if errorlevel 1 exit /b 1

echo.
echo Both OPS Toolkit distributions are ready in the release folder.
exit /b 0

