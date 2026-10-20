import tkinter as tk
from tkinter import filedialog
import os
import subprocess

def ask_open_filename(file_type: str = "pdf"):
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    if file_type == "image":
        filetypes = [("Görsel Dosyaları", "*.tiff *.tif *.jpeg *.jpg *.png *.bmp *.webp"), ("Tüm Dosyalar", "*.*")]
    elif file_type == "excel":
        filetypes = [("Excel Tabloları", "*.xlsx *.xls"), ("Tüm Dosyalar", "*.*")]
    elif file_type in ("converter", "all_supported"):
        filetypes = [
            ("Dönüştürülebilir Belgeler (Excel & Görsel)", "*.xlsx *.xls *.tiff *.tif *.jpeg *.jpg *.png *.bmp *.webp"),
            ("Excel Tabloları", "*.xlsx *.xls"),
            ("Görsel Dosyaları", "*.tiff *.tif *.jpeg *.jpg *.png *.bmp *.webp"),
            ("Tüm Dosyalar", "*.*")
        ]
    else:
        filetypes = [("PDF Belgeleri", "*.pdf"), ("Tüm Dosyalar", "*.*")]

    chosen = filedialog.askopenfilename(title="Belge Seçin", filetypes=filetypes)
    root.destroy()
    return chosen if chosen else None

def ask_open_filenames():
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    filetypes = [
        ("Desteklenen Belgeler (Excel & Görseller)", "*.xlsx *.xls *.tiff *.tif *.jpeg *.jpg *.png *.bmp *.webp"),
        ("Excel Tabloları", "*.xlsx *.xls"),
        ("Görsel Dosyaları", "*.tiff *.tif *.jpeg *.jpg *.png *.bmp *.webp"),
        ("Tüm Dosyalar", "*.*")
    ]
    chosen = filedialog.askopenfilenames(title="Dönüştürülecek Belgeleri Seçin", filetypes=filetypes)
    root.destroy()
    return list(chosen) if chosen else []

def ask_saveas_filename(default_name: str = "anonimlestirildi.pdf"):
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    chosen = filedialog.asksaveasfilename(
        title="Kaydedilecek Konumu Seçin",
        initialfile=default_name,
        defaultextension=".pdf",
        filetypes=[("PDF Belgeleri", "*.pdf")]
    )
    root.destroy()
    return chosen if chosen else None

def ask_directory():
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    chosen = filedialog.askdirectory(title="PDF'lerin Kaydedileceği Klasörü Seçin")
    root.destroy()
    return chosen if chosen else None

def open_directory_in_explorer(dir_path: str):
    if dir_path and os.path.exists(dir_path):
        target = os.path.normpath(dir_path)
        if os.path.isdir(target):
            subprocess.Popen(["explorer.exe", target])
        else:
            subprocess.Popen(["explorer.exe", "/select,", target])
        return True
    return False
