@echo off
setlocal
cd /d "%~dp0"
set "VERSION=0.5.1"
set "OUTPUT=%CD%\release\OPS-Toolkit-Localhost-Server"
set "ARCHIVE=%CD%\release\OPS-Toolkit-Localhost-Server-v%VERSION%-win-x64.zip"

if exist "%OUTPUT%" rmdir /s /q "%OUTPUT%"
mkdir "%OUTPUT%"

dotnet publish "csharp\OpsToolkit.Desktop.Server\OpsToolkit.Desktop.Server.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:DebugType=None -p:DebugSymbols=false -p:NuGetAudit=false -o "%OUTPUT%"
if errorlevel 1 goto :error

copy /y "localhost-server\Start OPS Toolkit.cmd" "%OUTPUT%\Start OPS Toolkit.cmd" >nul
copy /y "localhost-server\README.txt" "%OUTPUT%\README.txt" >nul

powershell -NoProfile -Command "$ErrorActionPreference='Stop'; Compress-Archive -Path '%OUTPUT%\*' -DestinationPath '%ARCHIVE%' -Force"
if errorlevel 1 goto :error

echo.
echo Browser build: %OUTPUT%\Start OPS Toolkit.cmd
echo Archive: %ARCHIVE%
exit /b 0

:error
echo.
echo Build failed.
exit /b 1
