import os
import io
import urllib.parse
from pathlib import Path
from typing import Callable, Dict, Any

import pymupdf as fitz
from core.converter import ImageConverter
from core.excel_converter import ExcelConverter
from core.kvkk_detector import KVKKDetector
from core.redactor import PDFRedactor
from core.dialog_utils import (
    ask_open_filename, ask_open_filenames, ask_saveas_filename,
    ask_directory, open_directory_in_explorer
)

class RouteHandler:
    """Yönlendirme (Routing) mantığını kapsülleyen sınıf."""

    def __init__(self, server_handler):
        self.server = server_handler

    # --- GET Handlers ---

    def health(self, path: str, params: Dict[str, list]):
        self.server._send_json({"status": "ok", "app": "Paralegal", "offline": True})

    def pdf_page_image(self, path: str, params: Dict[str, list]):
        pdf_path = params.get("path", [None])[0]
        page_num = int(params.get("page", [0])[0])
        dpi = int(params.get("dpi", [140])[0])

        if not pdf_path or not os.path.exists(pdf_path):
            self.server._send_json({"error": "Dosya bulunamadı"}, 404)
            return

        try:
            doc = fitz.open(pdf_path)
            if page_num < 0 or page_num >= len(doc):
                doc.close()
                self.server._send_json({"error": "Geçersiz sayfa numarası"}, 400)
                return

            page = doc[page_num]
            pix = page.get_pixmap(dpi=dpi, alpha=False)
            img_bytes = pix.tobytes("jpeg")
            doc.close()
            del pix

            self.server.send_response(200)
            self.server.send_header("Content-Type", "image/jpeg")
            self.server.send_header("Content-Length", str(len(img_bytes)))
            self.server.end_headers()
            self.server.wfile.write(img_bytes)
        except Exception as e:
            self.server._send_json({"error": str(e)}, 500)

    def image_thumbnail(self, path: str, params: Dict[str, list]):
        img_path = params.get("path", [None])[0]
        rotation = int(params.get("rotation", [0])[0])

        if not img_path or not os.path.exists(img_path):
            self.server._send_json({"error": "Görsel bulunamadı"}, 404)
            return

        try:
            from PIL import Image, ImageOps
            with Image.open(img_path) as im:
                transposed = ImageOps.exif_transpose(im)
                transposed = transposed.copy() if transposed else im.copy()

                if rotation % 360 != 0:
                    transposed = transposed.rotate(-rotation, expand=True)

                transposed.thumbnail((120, 120), Image.Resampling.LANCZOS)
                if transposed.mode != "RGB":
                    transposed = transposed.convert("RGB")

                buf = io.BytesIO()
                transposed.save(buf, format="JPEG", quality=80)
                thumb_bytes = buf.getvalue()

            self.server.send_response(200)
            self.server.send_header("Content-Type", "image/jpeg")
            self.server.send_header("Content-Length", str(len(thumb_bytes)))
            self.server.end_headers()
            self.server.wfile.write(thumb_bytes)
        except Exception as e:
            self.server._send_json({"error": str(e)}, 500)

    # --- POST Handlers ---

    def choose_file(self, path: str, data: Dict[str, Any]):
        file_type = data.get("type", "pdf")
        chosen = ask_open_filename(file_type)
        self.server._send_json({"path": chosen})

    def choose_files(self, path: str, data: Dict[str, Any]):
        chosen = ask_open_filenames()
        self.server._send_json({"paths": chosen})

    def choose_save_path(self, path: str, data: Dict[str, Any]):
        default_name = data.get("default_name", "anonimlestirildi.pdf")
        chosen = ask_saveas_filename(default_name)
        self.server._send_json({"path": chosen})

    def choose_directory(self, path: str, data: Dict[str, Any]):
        chosen = ask_directory()
        self.server._send_json({"path": chosen})

    def open_directory(self, path: str, data: Dict[str, Any]):
        dir_path = data.get("path")
        if open_directory_in_explorer(dir_path):
            self.server._send_json({"success": True})
        else:
            self.server._send_json({"error": "Dizin bulunamadı"}, 404)

    def load_pdf(self, path: str, data: Dict[str, Any]):
        pdf_path = data.get("path")
        if not pdf_path or not os.path.exists(pdf_path):
            self.server._send_json({"error": "PDF bulunamadı"}, 404)
            return

        try:
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            pages_meta = [{"page": p, "width": doc[p].rect.width, "height": doc[p].rect.height} for p in range(total_pages)]
            doc.close()
            self.server._send_json({
                "path": pdf_path,
                "filename": Path(pdf_path).name,
                "total_pages": total_pages,
                "pages": pages_meta
            })
        except Exception as e:
            self.server._send_json({"error": str(e)}, 500)

    def scan_pdf(self, path: str, data: Dict[str, Any]):
        pdf_path = data.get("path")
        filters = data.get("filters", {})
        custom_keywords = data.get("custom_keywords", [])

        if not pdf_path or not os.path.exists(pdf_path):
            self.server._send_json({"error": "PDF bulunamadı"}, 404)
            return

        try:
            doc = fitz.open(pdf_path)
            all_entities = []
            for page_idx in range(len(doc)):
                page_ents = KVKKDetector.scan_pdf_page(
                    doc[page_idx], page_index=page_idx, custom_keywords=custom_keywords,
                    **{f"detect_{k}": filters.get(k, True) for k in ["names", "companies", "dockets", "tckn", "vkn", "iban", "phone", "plate", "email", "address", "identity", "property"]}
                )
                for e in page_ents:
                    all_entities.append({
                        "id": f"{page_idx}_{round(e.rect[0])}_{round(e.rect[1])}",
                        "category": e.category, "value": e.value, "page_number": e.page_number,
                        "rect": [e.rect[0], e.rect[1], e.rect[2], e.rect[3]], "confidence": e.confidence, "approved": e.approved
                    })
            doc.close()
            self.server._send_json({"entities": all_entities, "total": len(all_entities)})
        except Exception as e:
            self.server._send_json({"error": str(e)}, 500)

    def search_text(self, path: str, data: Dict[str, Any]):
        pdf_path = data.get("path")
        search_text = data.get("text", "").strip()

        if not pdf_path or not search_text:
            self.server._send_json({"entities": []})
            return

        try:
            doc = fitz.open(pdf_path)
            found = []
            for p_idx in range(len(doc)):
                for r in doc[p_idx].search_for(search_text):
                    found.append({
                        "id": f"{p_idx}_{round(r.x0)}_{round(r.y0)}",
                        "category": "OZEL_KELIME", "value": search_text, "page_number": p_idx,
                        "rect": [r.x0, r.y0, r.x1, r.y1], "confidence": 1.0, "approved": True
                    })
            doc.close()
            self.server._send_json({"entities": found, "total": len(found)})
        except Exception as e:
            self.server._send_json({"error": str(e)}, 500)

    def apply_redactions(self, path: str, data: Dict[str, Any]):
        input_path = data.get("input_path")
        output_path = data.get("output_path")
        redactions = data.get("redactions", [])
        fill_color = (0.0, 0.0, 0.0) if data.get("color", "black") == "black" else (1.0, 1.0, 1.0)
        overlay_text = "[SANSÜRLENDİ]" if data.get("overlay", "none") == "redacted" else None

        formatted = [{"page_number": i.get("page_number", 0), "rect": tuple(i.get("rect", [0,0,0,0])), "value": i.get("value", ""), "approved": i.get("approved", True)} for i in redactions]

        try:
            res = PDFRedactor.apply_redactions_to_pdf(input_path, output_path, formatted, fill_color, overlay_text)
            res["redactions_applied"] = res.get("total_redactions", 0)
            self.server._send_json(res)
        except Exception as e:
            self.server._send_json({"error": str(e)}, 500)

    def analyze_excel(self, path: str, data: Dict[str, Any]):
        excel_path = data.get("path")
        if not excel_path or not os.path.exists(excel_path):
            self.server._send_json({"error": "Excel dosyası bulunamadı"}, 404)
            return
        try:
            self.server._send_json(ExcelConverter.analyze_excel(excel_path))
        except Exception as e:
            self.server._send_json({"error": str(e)}, 500)

    def convert_excel(self, path: str, data: Dict[str, Any]):
        input_path = data.get("input_path")
        if not input_path or not os.path.exists(input_path):
            self.server._send_json({"error": "Excel dosyası bulunamadı"}, 404)
            return
        try:
            res = ExcelConverter.convert_excel_to_pdf(
                input_path=input_path, output_path=data.get("output_path"),
                orientation=data.get("orientation", "auto"), fit_width=data.get("fit_width", True), repeat_header=data.get("repeat_header", True)
            )
            self.server._send_json({"success": True, "output_path": res})
        except Exception as e:
            self.server._send_json({"error": str(e)}, 500)

    def convert_images(self, path: str, data: Dict[str, Any]):
        input_paths = data.get("input_paths", [])
        combine = data.get("combine", False)
        output_dir = data.get("output_dir")
        rotations = data.get("rotations", {})
        excel_opts = data.get("excel_options", {})

        if not input_paths:
            self.server._send_json({"error": "Dosya listesi boş"}, 400)
            return

        results = []
        try:
            if combine:
                first_p = Path(input_paths[0])
                out_path = os.path.join(output_dir, f"{first_p.stem}_birlestirilmis.pdf") if output_dir else str(first_p.parent / f"{first_p.stem}_birlestirilmis.pdf")

                if all(ImageConverter.is_supported(p) for p in input_paths):
                    results.append(ImageConverter.combine_multiple_images_to_pdf(input_paths, out_path, rotations=rotations))
                else:
                    import tempfile, shutil
                    temp_dir = tempfile.mkdtemp(prefix="paralegal_hybrid_")
                    try:
                        temp_pdfs = []
                        for idx, p_str in enumerate(input_paths):
                            tmp_pdf = os.path.join(temp_dir, f"doc_{idx}.pdf")
                            if ExcelConverter.is_supported(p_str):
                                ExcelConverter.convert_excel_to_pdf(p_str, tmp_pdf, orientation=excel_opts.get("orientation", "auto"), fit_width=excel_opts.get("fit_width", True), repeat_header=excel_opts.get("repeat_header", True))
                            elif ImageConverter.is_supported(p_str):
                                ImageConverter.convert_image_to_pdf(p_str, tmp_pdf, rotation=rotations.get(p_str, 0))
                            temp_pdfs.append(tmp_pdf)

                        merged_doc = fitz.open()
                        for t_pdf in temp_pdfs:
                            if os.path.exists(t_pdf):
                                src = fitz.open(t_pdf)
                                merged_doc.insert_pdf(src)
                                src.close()
                        merged_doc.save(out_path, garbage=4, deflate=True)
                        merged_doc.close()
                        try:
                            from core.redactor import PDFRedactor
                            PDFRedactor.optimize_for_uyap_if_needed(out_path)
                        except Exception:
                            pass
                        results.append(out_path)
                    finally:
                        shutil.rmtree(temp_dir, ignore_errors=True)
            else:
                for p_str in input_paths:
                    p = Path(p_str)
                    out_path = os.path.join(output_dir, f"{p.stem}.pdf") if output_dir else str(p.with_suffix(".pdf"))
                    if ExcelConverter.is_supported(p_str):
                        results.append(ExcelConverter.convert_excel_to_pdf(p_str, out_path, orientation=excel_opts.get("orientation", "auto"), fit_width=excel_opts.get("fit_width", True), repeat_header=excel_opts.get("repeat_header", True)))
                    else:
                        results.append(ImageConverter.convert_image_to_pdf(p_str, out_path, rotation=rotations.get(p_str, 0)))

            self.server._send_json({"success": True, "output_paths": results, "errors": []})
        except Exception as e:
            self.server._send_json({"error": str(e)}, 500)

    def get_get_routes(self):
        return {
            "/api/health": self.health,
            "/api/pdf-page-image": self.pdf_page_image,
            "/api/image-thumbnail": self.image_thumbnail,
        }

    def get_post_routes(self):
        return {
            "/api/choose-file": self.choose_file,
            "/api/choose-files": self.choose_files,
            "/api/choose-save-path": self.choose_save_path,
            "/api/choose-directory": self.choose_directory,
            "/api/open-directory": self.open_directory,
            "/api/load-pdf": self.load_pdf,
            "/api/scan-pdf": self.scan_pdf,
            "/api/search-text": self.search_text,
            "/api/apply-redactions": self.apply_redactions,
            "/api/analyze-excel": self.analyze_excel,
            "/api/convert-excel": self.convert_excel,
            "/api/convert-images": self.convert_images,
        }
