@echo off
setlocal
cd /d "%~dp0"
set "OUTPUT=%CD%\release\OPS-Toolkit-Desktop-App"

if exist "%OUTPUT%" rmdir /s /q "%OUTPUT%"
mkdir "%OUTPUT%\server"

dotnet publish "csharp\OpsToolkit.Desktop.Server\OpsToolkit.Desktop.Server.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:DebugType=None -p:DebugSymbols=false -p:NuGetAudit=false -o "%OUTPUT%\server"
if errorlevel 1 goto :error

dotnet publish "csharp\OpsToolkit.Desktop.App\OpsToolkit.Desktop.App.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:DebugType=None -p:DebugSymbols=false -p:NuGetAudit=false -o "%OUTPUT%"
if errorlevel 1 goto :error

powershell -NoProfile -Command "Compress-Archive -Path '%OUTPUT%\*' -DestinationPath '%CD%\release\OPS-Toolkit-Desktop-App-v0.4.1-win-x64.zip' -Force"
if errorlevel 1 goto :error

echo.
echo Desktop build: %OUTPUT%\OPS Toolkit.exe
echo Archive: %CD%\release\OPS-Toolkit-Desktop-App-v0.4.1-win-x64.zip
exit /b 0

:error
echo.
echo Build failed.
exit /b 1
