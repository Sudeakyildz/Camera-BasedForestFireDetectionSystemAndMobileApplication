@echo off
echo Expo ve Node islemleri kapatiliyor...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr "8081" ^| findstr "LISTENING"') do taskkill /F /PID %%p 2>nul
for /f "tokens=5" %%p in ('netstat -ano ^| findstr "8082" ^| findstr "LISTENING"') do taskkill /F /PID %%p 2>nul
for /f "tokens=5" %%p in ('netstat -ano ^| findstr "8083" ^| findstr "LISTENING"') do taskkill /F /PID %%p 2>nul
taskkill /F /IM node.exe 2>nul
echo Bitti. Expo durduruldu.
pause
