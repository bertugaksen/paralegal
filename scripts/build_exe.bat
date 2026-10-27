@echo off
echo ===================================================
echo   Paralegal - Windows Standalone EXE Derleyici
echo   %100 Yerel Hukuk Teknolojisi Masaustu Uygulamasi
echo ===================================================
echo.

cd /d "%~dp0\.."

echo [1/3] Python gereksinimleri kontrol ediliyor...
pip install -r requirements.txt

echo.
echo [2/3] Frontend (React + Tailwind) uretiliyor...
cd frontend
call npm.cmd run build
cd ..

echo.
echo [3/3] PyInstaller ile Paralegal.exe paketleniyor...
pyinstaller --clean Paralegal.spec

echo.
if exist "dist\Paralegal.exe" (
    echo ===================================================
    echo   DERLEME BASARILI!
    echo   Uretilen dosya: dist\Paralegal.exe
    echo ===================================================
) else (
    echo [HATA] Derleme basarisiz oldu!
)
pause
