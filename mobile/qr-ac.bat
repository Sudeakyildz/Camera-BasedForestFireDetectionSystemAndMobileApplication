@echo off
cd /d "%~dp0"
echo QR kodu aciliyor (Expo port: 8082)...
node qr-ac.js
echo.
echo Tarayicida QR cikti. Telefonda Expo Go ile tarayin.
pause
