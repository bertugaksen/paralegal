"""
Paralegal - Local High-Performance API Server
%100 Yerel, sıfır telemetri ve sıfır internet bağımlılığı.
Frontend (React + Tailwind) ile Python motoru (PyMuPDF, KVKK Detector, Converter) arasında köprü kurar.
"""

import os
import io
import json
import urllib.parse
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Dict, Any

import pymupdf as fitz
from core.converter import ImageConverter
from core.excel_converter import ExcelConverter
from core.kvkk_detector import KVKKDetector
from core.redactor import PDFRedactor

DIST_DIR = Path(__file__).parent / "frontend" / "dist"


class ParalegalAPIHandler(SimpleHTTPRequestHandler):
    """Paralegal yerel API ve statik dosya sunucusu."""

    def __init__(self, *args, **kwargs):
        # Statik dosyaları dist klasöründen sun
        super().__init__(*args, directory=str(DIST_DIR) if DIST_DIR.exists() else str(Path(__file__).parent), **kwargs)

    def end_headers(self):
        # CORS ve önbellek politikası (Yerel geliştirme ve üretim için)
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

        # 1. API: Sağlık kontrolü
        if path == "/api/health":
            self._send_json({"status": "ok", "app": "Paralegal", "offline": True})
            return

        # 2. API: PDF Sayfa Görseli Render
        if path == "/api/pdf-page-image":
            pdf_path = params.get("path", [None])[0]
            page_num = int(params.get("page", [0])[0])
            dpi = int(params.get("dpi", [140])[0])

            if not pdf_path or not os.path.exists(pdf_path):
                self._send_json({"error": "Dosya bulunamadı"}, 404)
                return

            try:
                doc = fitz.open(pdf_path)
                if page_num < 0 or page_num >= len(doc):
                    doc.close()
                    self._send_json({"error": "Geçersiz sayfa numarası"}, 400)
                    return

                page = doc[page_num]
                # alpha=False: 24-bit RGB (RAM ve CPU tasarrufu)
                pix = page.get_pixmap(dpi=dpi, alpha=False)
                img_bytes = pix.tobytes("jpeg")
                doc.close()
                del pix

                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Content-Length", str(len(img_bytes)))
                self.end_headers()
                self.wfile.write(img_bytes)
                return
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
                return

        # 3. API: Görsel Küçük Resim (Thumbnail)
        if path == "/api/image-thumbnail":
            img_path = params.get("path", [None])[0]
            rotation = int(params.get("rotation", [0])[0])

            if not img_path or not os.path.exists(img_path):
                self._send_json({"error": "Görsel bulunamadı"}, 404)
                return

            try:
                from PIL import Image, ImageOps
                with Image.open(img_path) as im:
                    transposed = ImageOps.exif_transpose(im)
                    if transposed is None:
                        transposed = im.copy()
                    else:
                        transposed = transposed.copy()

                    if rotation % 360 != 0:
                        transposed = transposed.rotate(-rotation, expand=True)

                    transposed.thumbnail((120, 120), Image.Resampling.LANCZOS)
                    if transposed.mode != "RGB":
                        transposed = transposed.convert("RGB")

                    buf = io.BytesIO()
                    transposed.save(buf, format="JPEG", quality=80)
                    thumb_bytes = buf.getvalue()
                    transposed.close()

                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Content-Length", str(len(thumb_bytes)))
                self.end_headers()
                self.wfile.write(thumb_bytes)
                return
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
                return

        # 4. Statik dosya sunumu (Single Page App fallback: dosya yoksa index.html sun)
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

        # 1. API: Yerel Dosya Seçim İletişim Kutusu (Native Windows Dialog)
        if path == "/api/choose-file":
            data = self._read_json()
            file_type = data.get("type", "pdf")  # 'pdf' or 'image'

            import tkinter as tk
            from tkinter import filedialog
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
            self._send_json({"path": chosen if chosen else None})
            return

        # 2. API: Çoklu Dosya Seçimi
        if path == "/api/choose-files":
            import tkinter as tk
            from tkinter import filedialog
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
            self._send_json({"paths": list(chosen) if chosen else []})
            return

        # 3. API: Kayıt Yeri Seçimi (Save As)
        if path == "/api/choose-save-path":
            data = self._read_json()
            default_name = data.get("default_name", "anonimlestirildi.pdf")

            import tkinter as tk
            from tkinter import filedialog
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
            self._send_json({"path": chosen if chosen else None})
            return

        # 4. API: PDF Bilgilerini Yükle
        if path == "/api/load-pdf":
            data = self._read_json()
            pdf_path = data.get("path")
            if not pdf_path or not os.path.exists(pdf_path):
                self._send_json({"error": "PDF bulunamadı"}, 404)
                return

            try:
                doc = fitz.open(pdf_path)
                total_pages = len(doc)
                pages_meta = []
                for p_idx in range(total_pages):
                    page = doc[p_idx]
                    pages_meta.append({"page": p_idx, "width": page.rect.width, "height": page.rect.height})
                doc.close()

                self._send_json({
                    "path": pdf_path,
                    "filename": Path(pdf_path).name,
                    "total_pages": total_pages,
                    "pages": pages_meta
                })
                return
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
                return

        # 5. API: KVKK Otomatik Taraması
        if path == "/api/scan-pdf":
            data = self._read_json()
            pdf_path = data.get("path")
            filters = data.get("filters", {})
            custom_keywords = data.get("custom_keywords", [])

            if not pdf_path or not os.path.exists(pdf_path):
                self._send_json({"error": "PDF bulunamadı"}, 404)
                return

            try:
                doc = fitz.open(pdf_path)
                all_entities = []

                for page_idx in range(len(doc)):
                    page = doc[page_idx]
                    page_ents = KVKKDetector.scan_pdf_page(
                        page,
                        page_index=page_idx,
                        custom_keywords=custom_keywords,
                        detect_names=filters.get("names", True),
                        detect_companies=filters.get("companies", True),
                        detect_dockets=filters.get("dockets", True),
                        detect_tckn=filters.get("tckn", True),
                        detect_vkn=filters.get("vkn", True),
                        detect_iban=filters.get("iban", True),
                        detect_phone=filters.get("phone", True),
                        detect_plate=filters.get("plate", True),
                        detect_email=filters.get("email", True),
                        detect_address=filters.get("address", True),
                        detect_identity=filters.get("identity", True),
                        detect_property=filters.get("property", True),
                    )
                    for e in page_ents:
                        all_entities.append({
                            "id": f"{page_idx}_{round(e.rect[0])}_{round(e.rect[1])}",
                            "category": e.category,
                            "value": e.value,
                            "page_number": e.page_number,
                            "rect": [e.rect[0], e.rect[1], e.rect[2], e.rect[3]],
                            "confidence": e.confidence,
                            "approved": True
                        })

                doc.close()
                self._send_json({"entities": all_entities, "total": len(all_entities)})
                return
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
                return

        # 6. API: Metin Arama & Sansür Alanı Bulma
        if path == "/api/search-text":
            data = self._read_json()
            pdf_path = data.get("path")
            search_text = data.get("text", "").strip()

            if not pdf_path or not search_text:
                self._send_json({"entities": []})
                return

            try:
                doc = fitz.open(pdf_path)
                found = []
                for p_idx in range(len(doc)):
                    page = doc[p_idx]
                    rects = page.search_for(search_text)
                    for r in rects:
                        found.append({
                            "id": f"{p_idx}_{round(r.x0)}_{round(r.y0)}",
                            "category": "OZEL_KELIME",
                            "value": search_text,
                            "page_number": p_idx,
                            "rect": [r.x0, r.y0, r.x1, r.y1],
                            "confidence": 1.0,
                            "approved": True
                        })
                doc.close()
                self._send_json({"entities": found, "total": len(found)})
                return
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
                return

        # 7. API: Kalıcı ve Güvenli Redaksiyon Uygulama
        if path == "/api/apply-redactions":
            data = self._read_json()
            input_path = data.get("input_path")
            output_path = data.get("output_path")
            redactions = data.get("redactions", [])
            color_choice = data.get("color", "black")  # 'black' or 'white'
            overlay_choice = data.get("overlay", "none")  # 'none' or 'redacted'

            fill_color = (0.0, 0.0, 0.0) if color_choice == "black" else (1.0, 1.0, 1.0)
            overlay_text = "[SANSÜRLENDİ]" if overlay_choice == "redacted" else None

            # rect formatı dict uyarlaması
            formatted_items = []
            for item in redactions:
                formatted_items.append({
                    "page_number": item.get("page_number", 0),
                    "rect": tuple(item.get("rect", [0, 0, 0, 0])),
                    "value": item.get("value", ""),
                    "approved": item.get("approved", True)
                })

            try:
                result = PDFRedactor.apply_redactions_to_pdf(
                    input_pdf_path=input_path,
                    output_pdf_path=output_path,
                    redaction_items=formatted_items,
                    fill_color=fill_color,
                    text_overlay=overlay_text,
                )
                result["redactions_applied"] = result.get("total_redactions", 0)
                self._send_json(result)
                return
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
                return

        # 8. API: Excel Tablo Analizi
        if path == "/api/analyze-excel":
            data = self._read_json()
            excel_path = data.get("path")
            if not excel_path or not os.path.exists(excel_path):
                self._send_json({"error": "Excel dosyası bulunamadı"}, 404)
                return
            try:
                analysis = ExcelConverter.analyze_excel(excel_path)
                self._send_json(analysis)
                return
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
                return

        # 9. API: Tekil Excel Dönüştürme
        if path == "/api/convert-excel":
            data = self._read_json()
            input_path = data.get("input_path")
            output_path = data.get("output_path")
            orientation = data.get("orientation", "auto")
            fit_width = data.get("fit_width", True)
            repeat_header = data.get("repeat_header", True)

            if not input_path or not os.path.exists(input_path):
                self._send_json({"error": "Excel dosyası bulunamadı"}, 404)
                return

            try:
                res = ExcelConverter.convert_excel_to_pdf(
                    input_path=input_path,
                    output_path=output_path,
                    orientation=orientation,
                    fit_width=fit_width,
                    repeat_header=repeat_header,
                )
                self._send_json({"success": True, "output_path": res})
                return
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
                return

        # 10. API: Belgeleri (Görseller & Excel) PDF'e Dönüştürme
        if path == "/api/convert-images":
            data = self._read_json()
            input_paths = data.get("input_paths", [])
            combine = data.get("combine", False)
            output_dir = data.get("output_dir")
            rotations = data.get("rotations", {})
            excel_options = data.get("excel_options", {})

            if not input_paths:
                self._send_json({"error": "Dosya listesi boş"}, 400)
                return

            results = []
            errors = []

            try:
                if combine:
                    first_p = Path(input_paths[0])
                    combined_name = f"{first_p.stem}_birlestirilmis.pdf"
                    out_path = os.path.join(output_dir, combined_name) if output_dir else str(first_p.parent / combined_name)

                    # Eğer tüm dosyalar görsel ise doğrudan ImageConverter kullan
                    all_images = all(ImageConverter.is_supported(p) for p in input_paths)
                    if all_images:
                        res = ImageConverter.combine_multiple_images_to_pdf(input_paths, out_path, rotations=rotations)
                        results.append(res)
                    else:
                        # Hibrit birleştirme (Excel + Görseller)
                        import tempfile
                        import shutil
                        temp_pdfs = []
                        temp_dir = tempfile.mkdtemp(prefix="paralegal_hybrid_")
                        try:
                            for idx, p_str in enumerate(input_paths):
                                tmp_pdf = os.path.join(temp_dir, f"doc_{idx}.pdf")
                                if ExcelConverter.is_supported(p_str):
                                    ExcelConverter.convert_excel_to_pdf(
                                        p_str,
                                        output_path=tmp_pdf,
                                        orientation=excel_options.get("orientation", "auto"),
                                        fit_width=excel_options.get("fit_width", True),
                                        repeat_header=excel_options.get("repeat_header", True),
                                    )
                                    temp_pdfs.append(tmp_pdf)
                                elif ImageConverter.is_supported(p_str):
                                    rot = rotations.get(p_str, 0)
                                    ImageConverter.convert_image_to_pdf(p_str, output_path=tmp_pdf, rotation=rot)
                                    temp_pdfs.append(tmp_pdf)

                            merged_doc = fitz.open()
                            for t_pdf in temp_pdfs:
                                if os.path.exists(t_pdf):
                                    src = fitz.open(t_pdf)
                                    merged_doc.insert_pdf(src)
                                    src.close()
                            merged_doc.save(out_path, garbage=4, deflate=True)
                            merged_doc.close()
                            results.append(out_path)
                        finally:
                            shutil.rmtree(temp_dir, ignore_errors=True)
                else:
                    for p_str in input_paths:
                        p = Path(p_str)
                        out_name = f"{p.stem}.pdf"
                        out_path = os.path.join(output_dir, out_name) if output_dir else str(p.with_suffix(".pdf"))
                        if ExcelConverter.is_supported(p_str):
                            res = ExcelConverter.convert_excel_to_pdf(
                                p_str,
                                output_path=out_path,
                                orientation=excel_options.get("orientation", "auto"),
                                fit_width=excel_options.get("fit_width", True),
                                repeat_header=excel_options.get("repeat_header", True),
                            )
                            results.append(res)
                        else:
                            rot = rotations.get(p_str, 0)
                            res = ImageConverter.convert_image_to_pdf(p_str, out_path, rotation=rot)
                            results.append(res)

                self._send_json({"success": True, "output_paths": results, "errors": errors})
                return
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
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
