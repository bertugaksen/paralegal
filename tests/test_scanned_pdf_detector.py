"""
Paralegal - Taranmış (OCR'sız) PDF Tespit ve Adli Güvenlik Testleri
"""

import json
import os
from pathlib import Path
import pytest
import pymupdf as fitz
from core.kvkk_detector import KVKKDetector
from core.routes import RouteHandler


class DummyServer:
    def __init__(self):
        self.sent_data = None
        self.status_code = None

    def _send_json(self, data, status=200):
        self.sent_data = data
        self.status_code = status


def create_mock_pdf(tmp_dir, page_texts: list[str], filename: str = None) -> str:
    """Belirtilen metinleri içeren geçici PDF belgesi oluşturur."""
    target_dir = Path(tmp_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    
    fname = filename or f"test_{len(page_texts)}_pages.pdf"
    pdf_path = str(target_dir / fname)

    doc = fitz.open()
    for text in page_texts:
        page = doc.new_page(width=595, height=842)
        if text:
            page.insert_text((50, 50), text)
    doc.save(pdf_path)
    doc.close()
    return pdf_path


def create_mock_image_pdf(tmp_dir, page_count: int = 2, filename: str = None) -> str:
    """Sadece görsel (pixmap/raster) içeren, 0 metinli taranmış PDF belgesi oluşturur."""
    target_dir = Path(tmp_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    fname = filename or f"test_scanned_image_{page_count}_pages.pdf"
    pdf_path = str(target_dir / fname)

    doc = fitz.open()
    for _ in range(page_count):
        page = doc.new_page(width=595, height=842)
        pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 100, 100), 0)
        page.insert_image(page.rect, pixmap=pix)
    doc.save(pdf_path)
    doc.close()
    return pdf_path


def test_detect_pure_scanned_pdf(tmp_path):
    """Metin katmanı hiç olmayan (taranmış görsel) PDF tespiti."""
    # 3 sayfalık boş/görsel PDF
    pdf_path = create_mock_pdf(tmp_path, ["", "", ""])
    res = KVKKDetector.analyze_document_text_layer(pdf_path)

    assert res["is_scanned"] is True
    assert res["has_text_layer"] is False
    assert res["total_chars"] == 0
    assert res["empty_pages"] == 3
    assert res["total_pages"] == 3
    assert res["avg_chars_per_page"] == 0.0


def test_detect_pure_scanned_image_pdf(tmp_path):
    """Sadece raster görsel içeren (taranmış evrak) PDF tespiti."""
    pdf_path = create_mock_image_pdf(tmp_path, page_count=2)
    res = KVKKDetector.analyze_document_text_layer(pdf_path)

    assert res["is_scanned"] is True
    assert res["has_text_layer"] is False
    assert res["total_chars"] == 0
    assert res["empty_pages"] == 2
    assert res["total_pages"] == 2
    assert res["avg_chars_per_page"] == 0.0


def test_detect_pdf_below_15_chars_per_page(tmp_path):
    """Sayfa başına ortalama 15 karakterin altında kalan (OCR hatası/sayfa no) PDF tespiti."""
    # 3 sayfa, her sayfada 5 karakter -> toplam 15 karakter, ortalama 5 < 15
    pdf_path = create_mock_pdf(tmp_path, ["S. 1", "S. 2", "S. 3"])
    res = KVKKDetector.analyze_document_text_layer(pdf_path)

    assert res["is_scanned"] is True
    assert res["has_text_layer"] is False
    assert res["total_chars"] < 45
    assert res["avg_chars_per_page"] < 15.0


def test_detect_pdf_boundary_char_counts(tmp_path):
    """Karakter sınırı (14 vs 15 karakter) sınır testleri."""
    # 14 karakter: avg 14.0 < 15 -> is_scanned: True
    pdf_14 = create_mock_pdf(tmp_path, ["12345678901234"], filename="b14.pdf")
    res_14 = KVKKDetector.analyze_document_text_layer(pdf_14)
    assert res_14["is_scanned"] is True
    assert res_14["has_text_layer"] is False
    assert res_14["total_chars"] == 14
    assert res_14["avg_chars_per_page"] == 14.0

    # 15 karakter: avg 15.0 >= 15 ve boşluk oranı 0 -> is_scanned: False
    pdf_15 = create_mock_pdf(tmp_path, ["123456789012345"], filename="b15.pdf")
    res_15 = KVKKDetector.analyze_document_text_layer(pdf_15)
    assert res_15["is_scanned"] is False
    assert res_15["has_text_layer"] is True
    assert res_15["total_chars"] == 15
    assert res_15["avg_chars_per_page"] == 15.0


def test_detect_pdf_whitespace_only(tmp_path):
    """Yalnızca boşluk ve satır sonu içeren sayfaların boş sayılması."""
    pdf_path = create_mock_pdf(tmp_path, ["   \n\t  ", "\n\r\n "])
    res = KVKKDetector.analyze_document_text_layer(pdf_path)

    assert res["is_scanned"] is True
    assert res["has_text_layer"] is False
    assert res["total_chars"] == 0
    assert res["empty_pages"] == 2


def test_detect_pdf_with_over_80_percent_empty_pages(tmp_path):
    """Sayfalarının %80'inden fazlasında metin bulunmayan PDF tespiti."""
    # 10 sayfa: 1 sayfada 200 karakter, 9 sayfada 0 karakter (boşluk oranı %90 > %80)
    pages = ["Bu bir baslik ve dipnot aciklamasidir. Toplam karakter sayisi fazladir ancak diger sayfalar taranmis gorseldir."] + [""] * 9
    pdf_path = create_mock_pdf(tmp_path, pages)
    res = KVKKDetector.analyze_document_text_layer(pdf_path)

    assert res["is_scanned"] is True
    assert res["has_text_layer"] is False
    assert res["empty_pages"] == 9
    assert res["total_pages"] == 10


def test_detect_mixed_document_scanned_vs_digital(tmp_path):
    """Karışık (bazı sayfaları görsel/boş, bazı sayfaları metin) belgelerin doğrulanması."""
    # Durum 1: Dijital ağırlıklı belge (5 sayfa: 4 sayfa zengin metin, 1 sayfa taranmış ek)
    # Boşluk oranı 1/5 = %20 <= %80, Sayfa başına ortalama ~300 karakter > 15
    rich_pages = [
        "T.C. ANKARA 1. ASLİYE HUKUK MAHKEMESİ HAKİMLİĞİ'NE\nDAVACI: Ahmet Yılmaz\nVEKİLİ: Av. Mehmet Demir",
        "DAVA KONUSU: 100.000 TL alacağın tahsili talebidir. Açıklamalar aşağıda sunulmuştur.",
        "HUKUKİ SEBEPLER: HMK, TBK ve ilgili tüm mevzuat hükümleri. Deliller: Sözleşme, banka dekontu.",
        "SONUÇ VE İSTEM: Davamızın kabulü ile yargılama giderlerinin davalıya tahmiline karar verilmesini talep ederiz.",
        ""  # 5. sayfa taranmış ek
    ]
    digital_mixed_pdf = create_mock_pdf(tmp_path, rich_pages, filename="mixed_digital.pdf")
    res_digital = KVKKDetector.analyze_document_text_layer(digital_mixed_pdf)

    assert res_digital["is_scanned"] is False
    assert res_digital["has_text_layer"] is True
    assert res_digital["empty_pages"] == 1
    assert res_digital["total_pages"] == 5
    assert res_digital["avg_chars_per_page"] > 50

    # Durum 2: Taranmış ağırlıklı belge (6 sayfa: 1 sayfa kapak metni, 5 sayfa taranmış görsel)
    # Boşluk oranı 5/6 = %83.33 > %80 -> is_scanned: True
    scanned_mixed_pages = [
        "EKTE SUNULAN 5 SAYFALIK BELGE TARANMIŞ İCRA TUTANAĞIDIR VE DOSYAYA EKLENMİŞTİR."
    ] + [""] * 5
    scanned_mixed_pdf = create_mock_pdf(tmp_path, scanned_mixed_pages, filename="mixed_scanned.pdf")
    res_scanned = KVKKDetector.analyze_document_text_layer(scanned_mixed_pdf)

    assert res_scanned["is_scanned"] is True
    assert res_scanned["has_text_layer"] is False
    assert res_scanned["empty_pages"] == 5
    assert res_scanned["total_pages"] == 6


def test_detect_digital_pdf_with_rich_text():
    """Gerçek metin katmanlı dijital PDF (Örnek dava dilekçesi)."""
    sample_pdf = Path(__file__).parent.parent / "samples" / "ornekler" / "ornek_dava_dilekcesi.pdf"
    assert sample_pdf.exists()

    res = KVKKDetector.analyze_document_text_layer(str(sample_pdf))
    assert res["is_scanned"] is False
    assert res["has_text_layer"] is True
    assert res["total_chars"] > 100
    assert res["avg_chars_per_page"] > 15.0
    assert res["empty_pages"] == 0
    assert res["total_pages"] >= 1


def test_detect_empty_document():
    """0 sayfalı boş belge durumu."""
    doc = fitz.open()
    res = KVKKDetector.analyze_document_text_layer(doc)
    doc.close()

    assert res["is_scanned"] is True
    assert res["has_text_layer"] is False
    assert res["total_chars"] == 0
    assert res["total_pages"] == 0


def test_detect_single_empty_page(tmp_path):
    """Tek sayfalık tamamen boş belge durumu."""
    pdf_path = create_mock_pdf(tmp_path, [""], filename="single_empty.pdf")
    res = KVKKDetector.analyze_document_text_layer(pdf_path)

    assert res["is_scanned"] is True
    assert res["has_text_layer"] is False
    assert res["total_chars"] == 0
    assert res["empty_pages"] == 1
    assert res["total_pages"] == 1


def test_route_load_pdf_includes_scan_metadata(tmp_path):
    """load_pdf endpoint'inin is_scanned, has_text_layer ve total_chars alanlarını dönmesi."""
    dummy_server = DummyServer()
    handler = RouteHandler(dummy_server)

    # 1. Taranmış sahte dosya
    scanned_path = create_mock_pdf(tmp_path, ["", ""], filename="load_scanned.pdf")
    handler.load_pdf("/api/load-pdf", {"path": scanned_path})
    assert dummy_server.status_code == 200
    res = dummy_server.sent_data
    assert res["is_scanned"] is True
    assert res["has_text_layer"] is False
    assert res["total_chars"] == 0
    assert res["total_pages"] == 2

    # 2. Dijital dosya
    digital_path = Path(__file__).parent.parent / "samples" / "ornekler" / "ornek_dava_dilekcesi.pdf"
    handler.load_pdf("/api/load-pdf", {"path": str(digital_path)})
    assert dummy_server.status_code == 200
    res = dummy_server.sent_data
    assert res["is_scanned"] is False
    assert res["has_text_layer"] is True
    assert res["total_chars"] > 100

    # 3. Az metinli taranmış evrak (<15 char/sayfa)
    low_text_path = create_mock_pdf(tmp_path, ["S. 1", "S. 2"], filename="load_low.pdf")
    handler.load_pdf("/api/load-pdf", {"path": low_text_path})
    assert dummy_server.status_code == 200
    res = dummy_server.sent_data
    assert res["is_scanned"] is True
    assert res["has_text_layer"] is False


def test_route_scan_pdf_includes_scan_metadata(tmp_path):
    """scan_pdf endpoint'inin de is_scanned ve has_text_layer alanlarını dönmesi."""
    dummy_server = DummyServer()
    handler = RouteHandler(dummy_server)

    # 1. Taranmış sahte dosya
    scanned_path = create_mock_pdf(tmp_path, ["", ""], filename="scan_scanned.pdf")
    handler.scan_pdf("/api/scan-pdf", {"path": scanned_path, "filters": {}})
    assert dummy_server.status_code == 200
    res = dummy_server.sent_data
    assert res["is_scanned"] is True
    assert res["has_text_layer"] is False
    assert res["total_chars"] == 0
    assert res["total"] == 0

    # 2. Dijital dosya
    digital_path = Path(__file__).parent.parent / "samples" / "ornekler" / "ornek_dava_dilekcesi.pdf"
    handler.scan_pdf("/api/scan-pdf", {"path": str(digital_path), "filters": {"names": True, "tckn": True}})
    assert dummy_server.status_code == 200
    res = dummy_server.sent_data
    assert res["is_scanned"] is False
    assert res["has_text_layer"] is True
    assert res["total_chars"] > 100
    assert res["total"] > 0
