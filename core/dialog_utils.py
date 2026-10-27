import tkinter as tk
from tkinter import filedialog
import os
import subprocess
import threading

# Tkinter Tcl yorumlayıcısına eşzamanlı erişimleri ve çoklu iş parçacığı (multi-threading)
# çakışmalarını önlemek için global kilit.
_DIALOG_LOCK = threading.Lock()


def ask_open_filename(file_type: str = "pdf"):
    """
    Kullanıcıya dosya seçme penceresi sunar.
    Thread senkronizasyonu ve Windows odaklanma (topmost, lift, focus_force, update)
    garantisi ile pencerenin arka planda kalması veya donması engellenir.
    """
    with _DIALOG_LOCK:
        root = tk.Tk()
        try:
            root.withdraw()
            root.attributes("-topmost", True)
            root.lift()
            root.focus_force()
            root.update()

            if file_type == "image":
                filetypes = [("Görsel Dosyaları", "*.tiff *.tif *.jpeg *.jpg *.png *.bmp *.webp"), ("Tüm Dosyalar", "*.*")]
            elif file_type == "excel":
                filetypes = [("Excel Tabloları", "*.xlsx *.xls"), ("Tüm Dosyalar", "*.*")]
            elif file_type == "word":
                filetypes = [("Word Belgeleri", "*.docx *.doc"), ("Tüm Dosyalar", "*.*")]
            elif file_type in ("converter", "all_supported"):
                filetypes = [
                    ("Dönüştürülebilir Belgeler (Word, Excel & Görseller)", "*.docx *.doc *.xlsx *.xls *.tiff *.tif *.jpeg *.jpg *.png *.bmp *.webp"),
                    ("Word Belgeleri (*.docx, *.doc)", "*.docx *.doc"),
                    ("Excel Tabloları (*.xlsx, *.xls)", "*.xlsx *.xls"),
                    ("Görsel Dosyaları", "*.tiff *.tif *.jpeg *.jpg *.png *.bmp *.webp"),
                    ("Tüm Dosyalar", "*.*")
                ]
            else:
                filetypes = [("PDF Belgeleri", "*.pdf"), ("Tüm Dosyalar", "*.*")]

            chosen = filedialog.askopenfilename(title="Belge Seçin", filetypes=filetypes)
            return chosen if chosen else None
        finally:
            try:
                root.update()
                root.destroy()
            except Exception:
                pass


def ask_open_filenames():
    """
    Kullanıcıya çoklu dosya seçme penceresi sunar.
    """
    with _DIALOG_LOCK:
        root = tk.Tk()
        try:
            root.withdraw()
            root.attributes("-topmost", True)
            root.lift()
            root.focus_force()
            root.update()

            filetypes = [
                ("Desteklenen Belgeler (Word, Excel & Görseller)", "*.docx *.doc *.xlsx *.xls *.tiff *.tif *.jpeg *.jpg *.png *.bmp *.webp"),
                ("Word Belgeleri (*.docx, *.doc)", "*.docx *.doc"),
                ("Excel Tabloları (*.xlsx, *.xls)", "*.xlsx *.xls"),
                ("Görsel Dosyaları", "*.tiff *.tif *.jpeg *.jpg *.png *.bmp *.webp"),
                ("Tüm Dosyalar", "*.*")
            ]
            chosen = filedialog.askopenfilenames(title="Dönüştürülecek Belgeleri Seçin", filetypes=filetypes)
            return list(chosen) if chosen else []
        finally:
            try:
                root.update()
                root.destroy()
            except Exception:
                pass


def ask_saveas_filename(default_name: str = "anonimlestirildi.pdf"):
    """
    Kullanıcıya dosya kaydetme konumu seçme penceresi sunar.
    """
    with _DIALOG_LOCK:
        root = tk.Tk()
        try:
            root.withdraw()
            root.attributes("-topmost", True)
            root.lift()
            root.focus_force()
            root.update()

            chosen = filedialog.asksaveasfilename(
                title="Kaydedilecek Konumu Seçin",
                initialfile=default_name,
                defaultextension=".pdf",
                filetypes=[("PDF Belgeleri", "*.pdf")]
            )
            return chosen if chosen else None
        finally:
            try:
                root.update()
                root.destroy()
            except Exception:
                pass


def ask_directory():
    """
    Kullanıcıya klasör seçme penceresi sunar.
    """
    with _DIALOG_LOCK:
        root = tk.Tk()
        try:
            root.withdraw()
            root.attributes("-topmost", True)
            root.lift()
            root.focus_force()
            root.update()

            chosen = filedialog.askdirectory(title="PDF'lerin Kaydedileceği Klasörü Seçin")
            return chosen if chosen else None
        finally:
            try:
                root.update()
                root.destroy()
            except Exception:
                pass


def open_directory_in_explorer(dir_path: str):
    if dir_path and os.path.exists(dir_path):
        target = os.path.normpath(dir_path)
        if os.path.isdir(target):
            subprocess.Popen(["explorer.exe", target])
        else:
            subprocess.Popen(["explorer.exe", "/select,", target])
        return True
    return False
