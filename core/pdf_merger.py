"""
Paralegal - High-Performance PDF Merger Module
%100 Yerel, Sıfır İnternet, Sıfır Telemetri.

Birden fazla PDF belgesini (taranmış deliller, tensip zabıtları, dava/cevap dilekçeleri,
bilirkişi raporları vb.) tek bir UYAP uyumlu dava dosyası halinde birleştirir.

Özellikler:
1. Akıllı İçindekiler / Yer İmleri (Hierarchical Table of Contents & Bookmarks):
   - Her orijinal belgenin dosya adından otomatik olarak ana yer imi (bookmark) üretir.
   - Kaynak belgelerin kendi iç yer imleri varsa sayfa numaralarını kaydırarak alt başlık olarak korur.
2. Düşük Bellek Tüketimi & Çerçeve Akışı:
   - Bellek tüketimini minimumda tutarak onlarca sayfalık dosyaları anlık işler.
3. UYAP 10 MB Otomatik Koruma:
   - Birleştirilen dosya UYAP'ın 10 MB sınırını aşarsa kalite kaybı olmadan optimize edilir.
"""

import os
from pathlib import Path
from typing import List, Optional, Callable, Dict, Any
import pymupdf as fitz


class PDFMerger:
    """PDF belgelerini yüksek performans ve yer imi korumasıyla birleştiren motor."""

    SUPPORTED_EXTENSIONS = {".pdf"}

    @classmethod
    def is_supported(cls, file_path: str) -> bool:
        """Dosyanın desteklenen bir PDF formatı olup olmadığını denetler."""
        return Path(file_path).suffix.lower() in cls.SUPPORTED_EXTENSIONS

    @staticmethod
    def format_size(size_bytes: int) -> str:
        """Bayt cinsinden dosya boyutunu okunabilir formata dönüştürür."""
        if not size_bytes or size_bytes <= 0:
            return "0 B"
        units = ["B", "KB", "MB", "GB"]
        size = float(size_bytes)
        unit_idx = 0
        while size >= 1024.0 and unit_idx < len(units) - 1:
            size /= 1024.0
            unit_idx += 1
        return f"{size:.1f} {units[unit_idx]}" if unit_idx > 0 else f"{int(size)} B"

    @classmethod
    def get_pdf_info(cls, pdf_path: str) -> Dict[str, Any]:
        """
        PDF belgesinin sayfa sayısı, boyutu ve yer imi gibi temel meta verilerini döndürür.
        """
        p = Path(pdf_path)
        if not p.exists():
            raise FileNotFoundError(f"PDF dosyası bulunamadı: {pdf_path}")

        if not cls.is_supported(pdf_path):
            raise ValueError(f"Desteklenmeyen dosya türü: {p.suffix}")

        size_bytes = os.path.getsize(pdf_path)

        try:
            doc = fitz.open(pdf_path)
            try:
                page_count = len(doc)
                is_encrypted = doc.is_encrypted
                has_toc = bool(doc.get_toc())
                title = doc.metadata.get("title") or ""
            finally:
                doc.close()

            return {
                "path": str(p.resolve()),
                "filename": p.name,
                "page_count": page_count,
                "size_bytes": size_bytes,
                "size_formatted": cls.format_size(size_bytes),
                "is_encrypted": is_encrypted,
                "has_toc": has_toc,
                "title": title
            }
        except Exception as e:
            return {
                "path": str(p.resolve()),
                "filename": p.name,
                "page_count": 0,
                "size_bytes": size_bytes,
                "size_formatted": cls.format_size(size_bytes),
                "is_encrypted": False,
                "has_toc": False,
                "error": str(e)
            }

    @classmethod
    def merge_pdfs(
        cls,
        input_paths: List[str],
        output_path: Optional[str] = None,
        add_bookmarks: bool = True,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> Dict[str, Any]:
        """
        Birden fazla PDF belgesini sıralı olarak tek bir PDF dosyasında birleştirir.
        
        Args:
            input_paths: Birleştirilecek PDF dosyalarının mutlak yolları (sıralı liste).
            output_path: Kaydedilecek hedef PDF yolu. Belirtilmezse ilk dosyanın yanına oluşturulur.
            add_bookmarks: Her dosya için hiyerarşik yer imi (içindekiler) oluşturulsun mu?
            progress_callback: İlerleme durumunu bildiren callback fonksiyonu.

        Returns:
            Dict içeren: success, output_path, total_pages, file_count, size_bytes, size_formatted
        """
        if not input_paths:
            raise ValueError("Birleştirilecek PDF dosya listesi boş olamaz.")

        # Dosyaların varlığını ve formatını doğrula
        valid_paths: List[Path] = []
        for p_str in input_paths:
            p = Path(p_str)
            if not p.exists():
                raise FileNotFoundError(f"PDF dosyası bulunamadı: {p_str}")
            if not cls.is_supported(p_str):
                raise ValueError(f"Desteklenmeyen dosya formatı ({p.suffix}): {p_str}")
            valid_paths.append(p)

        if output_path is None:
            first_p = valid_paths[0]
            output_path = str(first_p.parent / f"{first_p.stem}_birlestirilmis.pdf")
        else:
            out_dir = os.path.dirname(output_path)
            if out_dir:
                os.makedirs(out_dir, exist_ok=True)

        merged_doc = fitz.open()
        combined_toc: List[List[Any]] = []
        current_page_offset = 0
        total_files = len(valid_paths)

        try:
            for idx, p in enumerate(valid_paths):
                if progress_callback:
                    progress_callback(
                        idx + 1,
                        total_files,
                        f"Dosya birleştiriliyor ({idx + 1}/{total_files}): {p.name}"
                    )

                src_doc = fitz.open(str(p))
                try:
                    src_page_count = len(src_doc)
                    if src_page_count == 0:
                        continue

                    # Otomatik hiyerarşik yer imi ekleme
                    if add_bookmarks:
                        # 1. Seviye Yer İmi: Dosya Sırası ve Temiz Adı
                        clean_stem = p.stem.replace("_", " ").strip()
                        file_bookmark_title = f"{idx + 1}. {clean_stem}"
                        combined_toc.append([1, file_bookmark_title, current_page_offset + 1])

                        # Kaynak belgenin kendi yer imleri varsa 2. ve sonraki seviye olarak koru
                        try:
                            src_toc = src_doc.get_toc()
                            if src_toc:
                                for item in src_toc:
                                    lvl, title, pnum = item[0], item[1], item[2]
                                    combined_toc.append([lvl + 1, title, current_page_offset + pnum])
                        except Exception:
                            pass

                    # Sayfaları hedef belgeye ekle
                    merged_doc.insert_pdf(src_doc)
                    current_page_offset += src_page_count
                finally:
                    src_doc.close()

            # Yer imlerini birleştirilmiş belgeye kaydet
            if add_bookmarks and combined_toc:
                try:
                    merged_doc.set_toc(combined_toc)
                except Exception:
                    pass

            if progress_callback:
                progress_callback(total_files, total_files, "Birleştirilmiş PDF kaydediliyor...")

            # Sıkıştırma ve gereksiz nesneleri temizleme (deflate + garbage collection)
            merged_doc.save(
                output_path,
                garbage=4,
                deflate=True,
                clean=True
            )
        finally:
            merged_doc.close()

        # UYAP 10 MB Dosya Boyutu Koruması
        try:
            from core.redactor import PDFRedactor
            PDFRedactor.optimize_for_uyap_if_needed(output_path)
        except Exception:
            pass

        final_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0

        return {
            "success": True,
            "output_path": output_path,
            "total_pages": current_page_offset,
            "file_count": len(valid_paths),
            "size_bytes": final_size,
            "size_formatted": cls.format_size(final_size)
        }
