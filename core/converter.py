"""
Paralegal - Image to PDF Converter Module (Yüksek Performans & Düşük Bellek)
Desteklenen formatlar: .tiff, .tif, .jpeg, .jpg, .png, .bmp, .webp
Çok sayfalı TIFF desteği ve çoklu görsel birleştirme yeteneğine sahiptir.
Bellek (RAM) ve CPU tüketimini minimize etmek için çerçeve akışı ve anlık temizleme kullanır.
%100 Yerel çalışır.
"""

import os
import gc
from pathlib import Path
from typing import List, Optional, Callable
from PIL import Image, ImageOps, ImageSequence


class ImageConverter:
    """Görselleri (TIFF, JPEG, PNG vb.) düşük bellek tüketimiyle PDF'e çeviren motor."""

    SUPPORTED_EXTENSIONS = {".tiff", ".tif", ".jpeg", ".jpg", ".png", ".bmp", ".webp"}

    @classmethod
    def is_supported(cls, file_path: str) -> bool:
        """Dosya uzantısının desteklenip desteklenmediğini kontrol eder."""
        return Path(file_path).suffix.lower() in cls.SUPPORTED_EXTENSIONS

    @staticmethod
    def _normalize_frame(frame: Image.Image, rotation: int = 0) -> Image.Image:
        """Kareyi EXIF oryantasyonuna ve rotasyona göre düzeltip temiz RGB formatına dönüştürür."""
        transposed = ImageOps.exif_transpose(frame)
        if transposed is None:
            transposed = frame.copy()
        else:
            transposed = transposed.copy()

        # Kullanıcı rotasyonu (saat yönünde: 90, 180, 270)
        if rotation % 360 != 0:
            transposed = transposed.rotate(-rotation, expand=True)

        if transposed.mode in ("RGBA", "LA"):
            background = Image.new("RGB", transposed.size, (255, 255, 255))
            alpha_mask = transposed.split()[-1]
            background.paste(transposed, mask=alpha_mask)
            transposed.close()
            return background
        elif transposed.mode != "RGB":
            rgb_page = transposed.convert("RGB")
            transposed.close()
            return rgb_page
        else:
            return transposed

    @classmethod
    def convert_image_to_pdf(
        cls,
        input_path: str,
        output_path: Optional[str] = None,
        rotation: int = 0,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> str:
        """
        Tek bir görsel dosyasını (çok sayfalı TIFF dahil) optimize edilmiş bellek kullanımıyla PDF'e dönüştürür.
        """
        in_p = Path(input_path)
        if not in_p.exists():
            raise FileNotFoundError(f"Girdi dosyası bulunamadı: {input_path}")

        if not cls.is_supported(str(in_p)):
            raise ValueError(f"Desteklenmeyen dosya formatı: {in_p.suffix}")

        if output_path is None:
            output_path = str(in_p.with_suffix(".pdf"))
        else:
            output_dir = os.path.dirname(output_path)
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)

        pages: List[Image.Image] = []
        try:
            with Image.open(input_path) as img:
                total_frames = getattr(img, "n_frames", 1)

                for idx, frame in enumerate(ImageSequence.Iterator(img)):
                    if progress_callback:
                        progress_callback(idx + 1, total_frames, f"Sayfa {idx + 1}/{total_frames} işleniyor...")

                    rgb_page = cls._normalize_frame(frame, rotation=rotation)
                    pages.append(rgb_page)

            if not pages:
                raise RuntimeError(f"Görselden hiçbir sayfa okunamadı: {input_path}")

            first_page = pages[0]
            other_pages = pages[1:] if len(pages) > 1 else []

            first_page.save(
                output_path,
                "PDF",
                resolution=100.0,
                save_all=True,
                append_images=other_pages,
                quality=92,
            )

            # UYAP 10 MB Dosya Boyutu Koruması
            try:
                from core.redactor import PDFRedactor
                PDFRedactor.optimize_for_uyap_if_needed(output_path)
            except Exception:
                pass

            return output_path

        finally:
            # Tüm sayfa nesnelerini bellekten derhal serbest bırak
            for p in pages:
                try:
                    p.close()
                except Exception:
                    pass
            pages.clear()
            gc.collect()

    @classmethod
    def combine_multiple_images_to_pdf(
        cls,
        input_paths: List[str],
        output_path: str,
        rotations: Optional[dict] = None,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> str:
        """
        Birden fazla görsel dosyasını tek bir birleşik PDF belgesinde birleştirir.
        Görselleri akış halinde işler ve tamamlandığında belleği serbest bırakır.
        """
        if not input_paths:
            raise ValueError("Birleştirilecek dosya listesi boş olamaz.")

        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        all_pages: List[Image.Image] = []
        total_files = len(input_paths)
        rot_map = rotations or {}

        try:
            for file_idx, file_path in enumerate(input_paths):
                if not cls.is_supported(file_path):
                    continue

                if progress_callback:
                    progress_callback(
                        file_idx + 1, total_files, f"Dosya {file_idx + 1}/{total_files} okunuyor: {Path(file_path).name}"
                    )

                rot = rot_map.get(file_path, 0)
                with Image.open(file_path) as img:
                    for frame in ImageSequence.Iterator(img):
                        rgb_page = cls._normalize_frame(frame, rotation=rot)
                        all_pages.append(rgb_page)

            if not all_pages:
                raise RuntimeError("Verilen dosyalardan geçerli bir görsel sayfası çıkarılamadı.")

            first_page = all_pages[0]
            other_pages = all_pages[1:] if len(all_pages) > 1 else []

            first_page.save(
                output_path,
                "PDF",
                resolution=100.0,
                save_all=True,
                append_images=other_pages,
                quality=92,
            )

            # UYAP 10 MB Dosya Boyutu Koruması
            try:
                from core.redactor import PDFRedactor
                PDFRedactor.optimize_for_uyap_if_needed(output_path)
            except Exception:
                pass

            return output_path

        finally:
            for p in all_pages:
                try:
                    p.close()
                except Exception:
                    pass
            all_pages.clear()
            gc.collect()
