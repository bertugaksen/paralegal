"""
Pytest configuration and reusable synthetic fixtures for Paralegal test suite.
"""

import os
import pytest
from PIL import Image, ImageDraw
import fitz


@pytest.fixture
def sample_jpeg(tmp_path) -> str:
    """Creates a synthetic single-page JPEG image."""
    img_path = str(tmp_path / "sample_document.jpg")
    img = Image.new("RGB", (300, 400), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    draw.rectangle([20, 20, 280, 380], outline=(50, 50, 50), width=2)
    draw.text((40, 50), "SYNTHETIC LEGAL EVIDENCE", fill=(0, 0, 0))
    draw.text((40, 100), "T.C. Mahkeme Evraki", fill=(0, 0, 0))
    img.save(img_path, format="JPEG", quality=90)
    return img_path


@pytest.fixture
def sample_multiframe_tiff(tmp_path) -> str:
    """Creates a synthetic 3-frame TIFF document."""
    tiff_path = str(tmp_path / "multipage_document.tiff")
    frames = []
    colors = [(255, 200, 200), (200, 255, 200), (200, 200, 255)]
    
    for i, color in enumerate(colors):
        frame = Image.new("RGB", (300, 400), color=color)
        draw = ImageDraw.Draw(frame)
        draw.text((30, 40), f"TIFF PAGE {i + 1} OF 3", fill=(0, 0, 0))
        draw.text((30, 80), f"Sayfa No: {i + 1}", fill=(0, 0, 0))
        frames.append(frame)

    frames[0].save(
        tiff_path,
        format="TIFF",
        save_all=True,
        append_images=frames[1:],
        compression="tiff_deflate"
    )
    return tiff_path


@pytest.fixture
def sample_rgba_png(tmp_path) -> str:
    """Creates a synthetic RGBA PNG image with transparency."""
    png_path = str(tmp_path / "transparent_seal.png")
    img = Image.new("RGBA", (200, 200), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([20, 20, 180, 180], fill=(0, 100, 200, 180), outline=(0, 50, 150, 255), width=3)
    draw.text((45, 90), "UYAP SEAL", fill=(255, 255, 255, 255))
    img.save(png_path, format="PNG")
    return png_path


@pytest.fixture
def sample_bmp(tmp_path) -> str:
    """Creates a synthetic BMP image."""
    bmp_path = str(tmp_path / "sample.bmp")
    img = Image.new("RGB", (150, 150), color=(220, 220, 255))
    img.save(bmp_path, format="BMP")
    return bmp_path


@pytest.fixture
def sample_sensitive_pdf_path(tmp_path) -> str:
    """
    Creates a synthetic PDF containing Turkish legal petition text with sensitive KVKK data:
    - TCKN: 10000000146
    - IBAN: TR33 0006 1005 1234 5678 9012 34
    - Party Name: Ahmet Yilmaz
    - Phone: 0532 123 45 67
    - License Plate: 34 ABC 123
    - Email: avukat.ahmet@adalet.gov.tr
    """
    pdf_path = str(tmp_path / "sensitive_petition.pdf")
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # Standard A4
    text_rect = fitz.Rect(50, 50, 545, 750)
    
    petition_text = (
        "T.C. ANKARA 4. ASLIYE HUKUK MAHKEMESI BASKANLIGI'NA\n\n"
        "DOSYA NO: 2024/1102\n\n"
        "DAVACI: Ahmet Yilmaz\n"
        "TCKN: 10000000146\n"
        "ADRES: Cankaya Mah. Ataturk Bulvari No: 15 Ankara\n"
        "TELEFON: 0532 123 45 67\n"
        "E-POSTA: avukat.ahmet@adalet.gov.tr\n\n"
        "DAVALI: Demir Insaat Sanayi Ticaret AS\n"
        "VKN: 1234567890\n\n"
        "TALEP: Davalinin 34 ABC 123 plakali sirket aracina tedbir konulmasi.\n"
        "Borcun odenmesi icin davaci banka hesabi: TR33 0006 1005 1234 5678 9012 34\n\n"
        "Gereginin yapilmasini saygilarimla arz ve talep ederim.\n"
        "Davaci Vekili: Av. Selin Arslan\n"
    )
    
    page.insert_textbox(text_rect, petition_text, fontsize=11, fontname="helv")
    doc.save(pdf_path)
    doc.close()
    return pdf_path
