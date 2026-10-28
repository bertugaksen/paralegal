@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   Paralegal - Windows Kurulum Paketi Derleyici
echo   Inno Setup 6 + PyInstaller Onedir + LZMA2
echo ===================================================
echo.

cd /d "%~dp0\.."

echo [1/4] Python gereksinimleri kontrol ediliyor...
pip install -r requirements.txt
if errorlevel 1 (
    echo [HATA] Python paketleri yuklenemedi.
    exit /b 1
)

echo.
echo [2/4] Frontend (React + Tailwind) uretiliyor...
cd frontend
call npm.cmd run build
if errorlevel 1 (
    echo [HATA] Frontend derlemesi basarisiz oldu.
    exit /b 1
)
cd ..

echo.
echo [3/4] PyInstaller ile Paralegal dizini olusturuluyor...
pyinstaller --clean -y Paralegal.spec
if not exist "dist\Paralegal\Paralegal.exe" (
    echo [HATA] PyInstaller derlemesi basarisiz oldu!
    exit /b 1
)

echo.
echo [4/4] Inno Setup ile Kurulum Sihirbazi (Setup.exe) derleniyor...

set "ISCC="
if exist "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" (
    set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
) else if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" (
    set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
) else if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" (
    set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
) else (
    where iscc >nul 2>nul
    if not errorlevel 1 set "ISCC=iscc"
)

if "%ISCC%"=="" (
    echo [HATA] Inno Setup 6 derleyicisi (ISCC.exe) bulunamadi!
    echo Lutfen Inno Setup 6'yi kurun: winget install JRSoftware.InnoSetup
    exit /b 1
)

echo ISCC Bulundu: "%ISCC%"
"%ISCC%" Paralegal_Setup.iss
if errorlevel 1 (
    echo [HATA] Inno Setup derlemesi basarisiz oldu!
    exit /b 1
)

echo.
if exist "dist_installer\Paralegal_Kurulum_v1.0.0.exe" (
    echo ===================================================
    echo   KURULUM DOSYASI BASARIYLA URETILDI!
    echo   Konum: dist_installer\Paralegal_Kurulum_v1.0.0.exe
    echo ===================================================
) else (
    echo [HATA] Kurulum dosyasi olusturulamadi!
)

pause
