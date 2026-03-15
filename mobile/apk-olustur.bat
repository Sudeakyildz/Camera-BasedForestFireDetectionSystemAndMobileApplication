@echo off
cd /d "%~dp0"
echo ============================================
echo  Android Release APK olusturma (EAS Build)
echo ============================================
echo.
echo Ilk seferde Expo hesabinizla giris yapmaniz
echo istenecek. (expo.dev ucretsiz hesap)
echo.
echo Build bulutta yapilir; bittiginde indirme
echo linki verilir. APK'yi telefona atip kurabilirsiniz.
echo.
pause
call npx eas-cli build -p android --profile preview
echo.
pause
