@echo off
setlocal
cd /d "%~dp0"
dotnet publish "csharp\OpsToolkit.Desktop.Server\OpsToolkit.Desktop.Server.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:DebugType=None -p:DebugSymbols=false -o "release\OPS-Toolkit-Desktop"
if errorlevel 1 (
  pause
  exit /b 1
)
echo.
echo Portable build: %CD%\release\OPS-Toolkit-Desktop
pause
