@echo off
cd /d "%~dp0"

rem Android build icin JDK 17 kullan (Gradle Java 25 desteklemez)
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot"

echo ==========================================
echo  Gradle ile Release APK olusturma
echo ==========================================
echo  JAVA_HOME = %JAVA_HOME%
echo.

if not exist "android" (
    echo [1/2] android/ klasoru yok. expo prebuild ile olusturuluyor...
    call npx expo prebuild --platform android --no-install
    if errorlevel 1 (
        echo HATA: prebuild basarisiz. JDK ve Node kurulu mu kontrol edin.
        pause
        exit /b 1
    )
    echo android/ olusturuldu.
    echo.
) else (
    echo [1/2] android/ zaten mevcut.
    echo.
)

echo [2/2] Release APK derleniyor (Gradle)...
echo Ilk calistirmada Gradle indirilir (1-2 dk), sonra derleme baslar...
echo.
cd android
call gradlew.bat assembleRelease
set GRADLE_EXIT=%ERRORLEVEL%
cd ..

if not exist "android\app\build\outputs\apk\release\app-release.apk" (
    echo.
    echo ==========================================
    echo  UYARI: APK dosyasi olusturulmadi.
    echo ==========================================
    echo  Build hata verebilir. Lutfen CMD acip su komutu calistirin:
    echo  cd /d "%~dp0android"
    echo  gradlew.bat assembleRelease
    echo.
    echo  Cikan hata mesajini kontrol edin. ANDROID_HOME, JAVA_HOME
    echo  ve internet baglantisi gerekli.
    echo ==========================================
    pause
    exit /b 1
)

echo.
echo ==========================================
echo  APK hazir.
echo  Konum: android\app\build\outputs\apk\release\app-release.apk
echo ==========================================
explorer "android\app\build\outputs\apk\release"
pause
