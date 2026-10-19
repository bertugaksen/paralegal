"""
Paralegal - PyMuPDF Sanitized Redaction Engine
Fiziksel ve kalıcı KVKK anonimleştirme motoru.
Yalnızca siyah kutu çizmekle kalmaz; PDF'in ikili (binary) akışından
ilgili karakterleri, vektörleri ve resim piksellerini kalıcı olarak imha eder.
"""

import os
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
            clean=True,
        )
        doc.close()

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

        leaked = []
        for word in sensitive_words:
            if not word or len(word.strip()) < 3:
                continue
            # Eğer kelime hala düz metin olarak okunabiliyorsa sızıntı var demektir
            clean_word = word.strip()
            if clean_word in all_text:
                leaked.append(clean_word)

        return {
            "all_cleared": len(leaked) == 0,
            "leaked_words": leaked,
        }
