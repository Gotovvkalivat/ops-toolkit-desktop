@echo off
setlocal
cd /d "%~dp0"
call "%CD%\publish-localhost-server.cmd"
if errorlevel 1 exit /b 1
