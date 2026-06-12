@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy_prod_custom.ps1" %*
exit /b %ERRORLEVEL%
