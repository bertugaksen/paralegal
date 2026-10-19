@echo off
title Paralegal - Yerel Hukuk ve KVKK Asistani
cd /d "%~dp0"

echo Paralegal baslatiliyor, lutfen bekleyin...
python run_paralegal.py

if %errorlevel% neq 0 (
    echo.
    echo Bir hata olustu. Python veya gerekli paketler eksik olabilir.
    pause
)
