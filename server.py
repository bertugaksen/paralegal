"""
Paralegal - Local High-Performance API Server
%100 Yerel, sıfır telemetri ve sıfır internet bağımlılığı.
Frontend (React + Tailwind) ile Python motoru (PyMuPDF, KVKK Detector, Converter) arasında köprü kurar.
"""

import os
import json
import urllib.parse
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Dict, Any

from core.routes import RouteHandler

DIST_DIR = Path(__file__).parent / "frontend" / "dist"

class ParalegalAPIHandler(SimpleHTTPRequestHandler):
    """Paralegal yerel API ve statik dosya sunucusu."""

    def __init__(self, *args, **kwargs):
        self.router = RouteHandler(self)
        self.get_routes = self.router.get_get_routes()
        self.post_routes = self.router.get_post_routes()
        super().__init__(*args, directory=str(DIST_DIR) if DIST_DIR.exists() else str(Path(__file__).parent), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def _send_json(self, data: Any, status: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> Dict[str, Any]:
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len == 0:
            return {}
        body = self.rfile.read(content_len)
        return json.loads(body.decode("utf-8"))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        # Route Match
        if path in self.get_routes:
            self.get_routes[path](path, params)
            return

        # Statik dosya sunumu (SPA fallback)
        if DIST_DIR.exists():
            target_file = DIST_DIR / path.lstrip("/")
            if not target_file.exists() or target_file.is_dir():
                index_path = DIST_DIR / "index.html"
                if index_path.exists():
                    with open(index_path, "rb") as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                    return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path in self.post_routes:
            data = self._read_json()
            self.post_routes[path](path, data)
            return

        self._send_json({"error": "Geçersiz API uç noktası"}, 404)

def start_server(port: int = 52410) -> ThreadingHTTPServer:
    """Yerel API sunucusunu başlatır."""
    server = ThreadingHTTPServer(("127.0.0.1", port), ParalegalAPIHandler)
    return server

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 52410
    print(f"Paralegal Local API Server dinleniyor: http://127.0.0.1:{port}")
    server = start_server(port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Sunucu kapatılıyor...")
        server.shutdown()
