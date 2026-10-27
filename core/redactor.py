"""
Paralegal - PyMuPDF Sanitized Redaction Engine
Fiziksel ve kalıcı KVKK anonimleştirme motoru.
Yalnızca siyah kutu çizmekle kalmaz; PDF'in ikili (binary) akışından
ilgili karakterleri, vektörleri ve resim piksellerini kalıcı olarak imha eder.
"""

import os
import re
from typing import List, Tuple, Optional, Dict, Any
import pymupdf as fitz


class PDFRedactor:
    """PDF belgelerini adli düzeyde kalıcı olarak anonimleştiren motor."""

    @classmethod
    def apply_redactions_to_pdf(
        cls,
        input_pdf_path: str,
        output_pdf_path: str,
        redaction_items: List[Dict[str, Any]],
        fill_color: Tuple[float, float, float] = (0.0, 0.0, 0.0),  # Siyah
        text_overlay: Optional[str] = None,
        font_size: float = 8.0,
    ) -> Dict[str, Any]:
        """
        PDF belgesine onaylanan sansürleri kalıcı olarak uygular.
        
        Args:
            input_pdf_path: Kaynak PDF dosya yolu.
            output_pdf_path: Temizlenmiş PDF'in kaydedileceği yol.
            redaction_items: Sansürlenecek alanlar listesi:
                [
                    {
                        'page_number': 0,
                        'rect': (x0, y0, x1, y1),
                        'value': 'metin', # İsteğe bağlı
                        'approved': True
                    },
                    ...
                ]
            fill_color: Sansür kutusu dolgu rengi (R, G, B) 0.0-1.0 arası. Varsayılan siyah.
            text_overlay: Kutu üstüne yazılacak ibare (Örn: '[SANSÜRLENDİ]' veya None).
            font_size: Kutu üstü yazı font boyutu.
            
        Returns:
            Dict: İstatistikler ve başarı raporu.
        """
        if not os.path.exists(input_pdf_path):
            raise FileNotFoundError(f"PDF dosyası bulunamadı: {input_pdf_path}")

        out_dir = os.path.dirname(output_pdf_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)

        doc = fitz.open(input_pdf_path)
        total_applied = 0

        # Sayfalara göre grupla
        pages_dict: Dict[int, List[Dict[str, Any]]] = {}
        for item in redaction_items:
            if not item.get("approved", True):
                continue
            p_idx = item.get("page_number", 0)
            if p_idx not in pages_dict:
                pages_dict[p_idx] = []
            pages_dict[p_idx].append(item)

        for p_idx, items in pages_dict.items():
            if p_idx < 0 or p_idx >= len(doc):
                continue

            page = doc[p_idx]

            for itm in items:
                rect_coords = itm.get("rect")
                if not rect_coords:
                    continue

                r = fitz.Rect(rect_coords)

                # Sansür açıklama (annotation) ekle
                annot = page.add_redact_annot(
                    r,
                    text=text_overlay if text_overlay else "",
                    fontsize=font_size,
                    fill=fill_color,
                    align=fitz.TEXT_ALIGN_CENTER,
                )
                total_applied += 1

            # Sayfadaki tüm sansürleri FİZİKSEL olarak uygula
            # PDF_REDACT_IMAGE_PIXELS: Sansür kutusu altındaki görsel piksellerini de yakar
            page.apply_redactions(
                images=fitz.PDF_REDACT_IMAGE_PIXELS
            )

        # PDF metaverilerini (yazar adı, bilgisayar adı, oluşturucu vb.) sıfırla
        doc.set_metadata({})

        # PDF'i tamamen temizleyip sıkıştırarak kaydet
        # garbage=4: Silinen metin ve öksüz nesneleri ikili dosyadan tamamen siler
        # deflate=True: Dosyayı optimize eder
        # clean=True: İçerik akışlarındaki artıkları temizler
        doc.save(
            output_pdf_path,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
        )
        doc.close()

        # UYAP 10 MB Dosya Boyutu Koruması
        uyap_opt = cls.optimize_for_uyap_if_needed(output_pdf_path)

        # Doğrulama: Kaydedilen dosyada metin katmanının gerçekten temizlendiğini kontrol et
        verification = cls.verify_redacted_pdf(
            output_pdf_path,
            [it.get("value") for it in redaction_items if it.get("value") and it.get("approved", True)]
        )

        return {
            "success": True,
            "output_path": output_pdf_path,
            "total_redactions": total_applied,
            "verification_passed": verification["all_cleared"],
            "leaked_words": verification["leaked_words"],
            "uyap_optimized": uyap_opt.get("optimized", False),
            "file_size": uyap_opt.get("final_size", os.path.getsize(output_pdf_path) if os.path.exists(output_pdf_path) else 0),
            "under_uyap_limit": uyap_opt.get("under_uyap_limit", True),
        }

    # Kolaylık ve geriye dönük uyumluluk için alias
    redact_pdf = apply_redactions_to_pdf

    UYAP_MAX_BYTES = 10 * 1024 * 1024  # 10 MB UYAP yükleme sınırı

    @classmethod
    def optimize_for_uyap_if_needed(cls, pdf_path: str, max_bytes: int = UYAP_MAX_BYTES) -> Dict[str, Any]:
        """
        Eğer üretilen PDF dosyası UYAP'ın 10 MB sınırını aşıyorsa,
        metin okunabilirliğini ve adli netliğini bozmadan görselleri
        kademeli olarak optimize edip boyutu 10 MB altına çeker.
        """
        if not os.path.exists(pdf_path):
            return {"optimized": False, "final_size": 0, "under_uyap_limit": True}

        initial_size = os.path.getsize(pdf_path)
        if initial_size <= max_bytes:
            return {
                "optimized": False,
                "original_size": initial_size,
                "final_size": initial_size,
                "under_uyap_limit": True,
            }

        temp_opt_path = pdf_path + ".uyap_tmp.pdf"
        current_size = initial_size

        for quality, max_dim in [(80, 1800), (70, 1500), (60, 1200)]:
            try:
                import io
                from PIL import Image
                import shutil

                doc = fitz.open(pdf_path)
                processed_xrefs = set()
                modified = False

                for page in doc:
                    for img_info in page.get_images():
                        xref = img_info[0]
                        if xref in processed_xrefs:
                            continue
                        processed_xrefs.add(xref)

                        try:
                            base_image = doc.extract_image(xref)
                            if not base_image or "image" not in base_image:
                                continue

                            pil_img = Image.open(io.BytesIO(base_image["image"]))

                            w, h = pil_img.size
                            if max(w, h) > max_dim:
                                scale = max_dim / float(max(w, h))
                                new_size = (int(w * scale), int(h * scale))
                                pil_img = pil_img.resize(new_size, Image.Resampling.LANCZOS)

                            if pil_img.mode in ("RGBA", "P"):
                                bg = Image.new("RGB", pil_img.size, (255, 255, 255))
                                if pil_img.mode == "RGBA":
                                    bg.paste(pil_img, mask=pil_img.split()[3])
                                else:
                                    bg.paste(pil_img)
                                pil_img = bg
                            elif pil_img.mode != "RGB":
                                pil_img = pil_img.convert("RGB")

                            out_buf = io.BytesIO()
                            pil_img.save(out_buf, format="JPEG", quality=quality, optimize=True)
                            page.replace_image(xref, stream=out_buf.getvalue())
                            modified = True
                        except Exception:
                            continue

                if modified:
                    doc.save(
                        temp_opt_path,
                        garbage=4,
                        deflate=True,
                        deflate_images=True,
                        deflate_fonts=True,
                        clean=True,
                    )
                    doc.close()

                    new_size = os.path.getsize(temp_opt_path)
                    if new_size < current_size:
                        shutil.move(temp_opt_path, pdf_path)
                        current_size = new_size

                    if current_size <= max_bytes:
                        break
                else:
                    doc.close()
                    break
            except Exception:
                break
            finally:
                if os.path.exists(temp_opt_path):
                    try:
                        os.remove(temp_opt_path)
                    except OSError:
                        pass

        return {
            "optimized": current_size < initial_size,
            "original_size": initial_size,
            "final_size": current_size,
            "under_uyap_limit": current_size <= max_bytes,
        }

    @classmethod
    def verify_redacted_pdf(cls, pdf_path: str, sensitive_words: List[Optional[str]]) -> Dict[str, Any]:
        """
        Üretilen PDF'in metin katmanını denetleyerek sansürlenen kelimelerin
        gerçekten yok edildiğini test eder.
        """
        doc = fitz.open(pdf_path)
        all_text = ""
        for page in doc:
            all_text += " " + page.get_text()
        doc.close()

        # Kesme işareti varyasyonlarını (', ’, ʼ, ‘, `, ´) standartlaştır
        norm_all_text = re.sub(r"['’ʼ‘`´]", "'", all_text)

        leaked = []
        for word in sensitive_words:
            if not word or len(word.strip()) < 3:
                continue
            # Eğer kelime hala düz metin olarak okunabiliyorsa sızıntı var demektir
            clean_word = word.strip()
            norm_word = re.sub(r"['’ʼ‘`´]", "'", clean_word)
            # Boşlukları esnek eşleştirme için \s+ yap ve Türkçe uyumlu sınır kontrolü sağla
            parts = [re.escape(p) for p in norm_word.split()]
            escaped_word = r"\s+".join(parts)
            prefix = r"(?<!\w)" if re.match(r"^\w", norm_word) else ""
            suffix = r"(?!\w)" if re.search(r"\w$", norm_word) else ""
            pattern = rf"{prefix}{escaped_word}{suffix}"
            if re.search(pattern, norm_all_text, flags=re.IGNORECASE):
                leaked.append(clean_word)

        return {
            "all_cleared": len(leaked) == 0,
            "leaked_words": leaked,
        }
