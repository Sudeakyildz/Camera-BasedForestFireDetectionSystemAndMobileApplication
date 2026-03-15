@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/5] index.lock kaldiriliyor...
if exist ".git\index.lock" del ".git\index.lock"

echo [2/5] Dosyalar ekleniyor...
git add .

echo [3/5] Commit atiliyor...
git commit -m "Initial commit: Kamera tanili yangin tespit sistemi ve mobil uygulama"

echo [4/5] GitHub remote ekleniyor...
git remote remove origin 2>nul
git remote add origin https://github.com/Sudeakyildz/Camera-BasedForestFireDetectionSystemAndMobileApplication.git

echo [5/5] main branch ve push...
git branch -M main
git push -u origin main

echo.
echo Bitti. Hata gorurseniz GitHub kullanici adi/sifre veya token girin.
pause
