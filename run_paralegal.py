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

# Paralegal ana dizinini Python yoluna ekle
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

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

    # Yüksek DPI ekranlar için ölçeklendirme
    if hasattr(Qt, "AA_EnableHighDpiScaling"):
        QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    if hasattr(Qt, "AA_UseHighDpiPixmaps"):
        QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)

    app = QApplication(sys.argv)
    app.setApplicationName("Paralegal")
    app.setOrganizationName("ParalegalTech")

    icon_path = CURRENT_DIR / "assets" / "paralegal_icon.png"
    if icon_path.exists():
        app_icon = QIcon(str(icon_path))
        app.setWindowIcon(app_icon)

    class ParalegalMainWindow(QMainWindow):
        def __init__(self, target_url: str):
            super().__init__()
            self.setWindowTitle("Paralegal - Yerel Hukuk Teknolojisi")
            self.resize(1340, 840)
            self.setMinimumSize(1080, 680)

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

            # Ekranı ortala
            screen = app.primaryScreen()
            if screen:
                geo = screen.geometry()
                x = (geo.width() - self.width()) // 2
                y = (geo.height() - self.height()) // 2
                self.move(max(0, x), max(0, y))

            self.web_view.load(QUrl(target_url))

        def closeEvent(self, event):
            # Kapanırken yerel sunucuyu temiz şekilde sonlandır
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
