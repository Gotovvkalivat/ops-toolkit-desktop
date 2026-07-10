@echo off
setlocal
cd /d "%~dp0"
dotnet run --project "csharp\OpsToolkit.Desktop.Server\OpsToolkit.Desktop.Server.csproj" --no-launch-profile -- %*
if errorlevel 1 pause
