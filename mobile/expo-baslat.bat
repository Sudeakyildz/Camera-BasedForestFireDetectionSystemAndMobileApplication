@echo off
cd /d "%~dp0"
echo Bagimliliklari kontrol ediyoruz...
call npm install
echo.
echo Expo baslatiliyor - QR kodu terminalde gorunecek.
echo Telefonda Expo Go ile QR kodu tarayin.
echo.
call npx expo start --port 8083
pause
