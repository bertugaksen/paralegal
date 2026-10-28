"""
Paralegal - Yerel Hukuk Teknolojisi Masaüstü Uygulaması
%100 Yerel, Sıfır İnternet, Sıfır Telemetri.
"""

import sys
import os
import socket
import threading
import time
from pathlib import Path

# PyInstaller --noconsole modunda stdout/stderr None olabilir, çökmeyi engelle
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

def get_base_dir() -> Path:
    """PyInstaller dondurulmuş modu veya geliştirme ortamı temel dizinini döndürür."""
    if getattr(sys, "frozen", False):
        if hasattr(sys, "_MEIPASS"):
            p = Path(sys._MEIPASS)
            if (p / "frontend" / "dist").exists() or (p / "assets").exists():
                return p
            if (p / "_internal" / "frontend" / "dist").exists() or (p / "_internal" / "assets").exists():
                return p / "_internal"
        exe_dir = Path(sys.executable).resolve().parent
        if (exe_dir / "frontend" / "dist").exists() or (exe_dir / "assets").exists():
            return exe_dir
        if (exe_dir / "_internal" / "frontend" / "dist").exists() or (exe_dir / "_internal" / "assets").exists():
            return exe_dir / "_internal"
        if hasattr(sys, "_MEIPASS"):
            return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent

BASE_DIR = get_base_dir()
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# exe dizinini de sys.path'e ekle (gerektiğinde)
if getattr(sys, "frozen", False):
    exe_dir = Path(sys.executable).resolve().parent
    if str(exe_dir) not in sys.path:
        sys.path.insert(0, str(exe_dir))
    internal_dir = exe_dir / "_internal"
    if internal_dir.exists() and str(internal_dir) not in sys.path:
        sys.path.insert(0, str(internal_dir))

CURRENT_DIR = BASE_DIR

from server import start_server


def find_free_port(preferred_port: int = 52410) -> int:
    """Tercih edilen port boş ise onu, değilse rastgele boş bir port döndürür."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", preferred_port))
            return preferred_port
        except OSError:
            pass

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def get_asset_path(filename: str) -> Path:
    """İkon ve varlık dosyalarını her çalışma modunda (onefile, onedir, dev) güvenle bulur."""
    candidates = [
        BASE_DIR / "assets" / filename,
        Path(sys.executable).resolve().parent / "assets" / filename,
        Path(sys.executable).resolve().parent / "_internal" / "assets" / filename,
        Path(__file__).resolve().parent / "assets" / filename,
    ]
    for c in candidates:
        if c.exists():
            return c
    return BASE_DIR / "assets" / filename


def run_desktop_app():
    # PySide6 modüllerini yükle
    from PySide6.QtWidgets import QApplication, QMainWindow
    from PySide6.QtCore import Qt, QUrl
    from PySide6.QtGui import QIcon
    from PySide6.QtWebEngineWidgets import QWebEngineView
    from PySide6.QtWebEngineCore import QWebEngineSettings

    # Port belirle ve yerel HTTP sunucusunu başlat
    port = find_free_port(52410)
    server = start_server(port)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    app = QApplication(sys.argv)
    app.setApplicationName("Paralegal")
    app.setOrganizationName("ParalegalTech")

    ico_path = get_asset_path("paralegal_icon.ico")
    png_path = get_asset_path("paralegal_icon.png")
    icon_path = ico_path if ico_path.exists() else png_path
    if icon_path.exists():
        app_icon = QIcon(str(icon_path))
        app.setWindowIcon(app_icon)

    class ParalegalMainWindow(QMainWindow):
        def __init__(self, target_url: str):
            super().__init__()
            self.setWindowTitle("Paralegal - Yerel Hukuk Teknolojisi")

            if icon_path.exists():
                self.setWindowIcon(app_icon)

            # WebEngine görünümü
            self.web_view = QWebEngineView(self)
            self.setCentralWidget(self.web_view)

            # Ayarlar
            settings = self.web_view.settings()
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.ScrollAnimatorEnabled, True)

            # Farklı ekran çözünürlüklerine ve Windows DPI ölçeklemesine (%100, %125, %150) tam adaptasyon
            screen = app.primaryScreen()
            if screen:
                avail = screen.availableGeometry()
                # Açılışta ferah ve kompakt masaüstü pencere boyutu (Ekranın tamamını kaplamaz)
                target_w = min(1080, max(850, int(avail.width() * 0.72)))
                target_h = min(680, max(560, int(avail.height() * 0.72)))
                self.resize(target_w, target_h)
                self.setMinimumSize(min(850, avail.width()), min(540, avail.height()))

                # Ekranın tam ortasında aç
                x = avail.x() + (avail.width() - self.width()) // 2
                y = avail.y() + (avail.height() - self.height()) // 2
                self.move(max(avail.x(), x), max(avail.y(), y))
            else:
                self.resize(1080, 680)
                self.setMinimumSize(850, 540)

            self.web_view.load(QUrl(target_url))

        def closeEvent(self, event):
            # Kapanırken geçici yüklemeleri temizle ve yerel sunucuyu sonlandır
            try:
                from core.routes import RouteHandler
                RouteHandler.cleanup_temp_uploads(0)
            except Exception:
                pass
            try:
                server.shutdown()
            except Exception:
                pass
            event.accept()

    url = f"http://127.0.0.1:{port}"
    main_window = ParalegalMainWindow(url)
    main_window.show()

    ret = app.exec()
    try:
        from core.routes import RouteHandler
        RouteHandler.cleanup_temp_uploads(0)
    except Exception:
        pass
    try:
        server.shutdown()
    except Exception:
        pass
    sys.exit(ret)


if __name__ == "__main__":
    if "--server-only" in sys.argv:
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 52410
        server = start_server(port)
        print(f"Paralegal Server Only running on http://127.0.0.1:{port}")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            server.shutdown()
    else:
        run_desktop_app()
