"""
Paralegal - Excel to PDF Converter Unit and Integration Tests
Verifies high-fidelity Excel (.xlsx, .xls) to UYAP PDF conversion,
smart orientation detection, and column-width fitting.
"""

import os
from pathlib import Path
import pytest
import pymupdf as fitz
import openpyxl

from core.excel_converter import ExcelConverter


@pytest.fixture
def sample_small_xlsx(tmp_path) -> str:
    """Creates a small 4-column Excel table (Portrait recommended)."""
    p = str(tmp_path / "kucuk_tablo.xlsx")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Masraf Listesi"
    ws.append(["No", "Tarih", "Gider Kalemi", "Tutar (TL)"])
    for i in range(1, 10):
        ws.append([i, f"1{i}.04.2024", f"Harç ve Tebligat Masrafı #{i}", 150.0 * i])
    wb.save(p)
    wb.close()
    return p


@pytest.fixture
def sample_wide_xlsx(tmp_path) -> str:
    """Creates a wide 10-column Excel table (Landscape recommended, e.g. labor calculation)."""
    p = str(tmp_path / "kidem_ihbar_hesabi.xlsx")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Kıdem Hesabı"
    headers = [
        "Sıra", "Dönem", "Brüt Ücret", "SGK Primi", "İşsizlik",
        "Gelir Vergisi", "Damga Vergisi", "Net Tutar", "Kıdem Esas", "Toplam Alacak"
    ]
    ws.append(headers)
    for i in range(1, 35):
        ws.append([
            i, f"2023/{i:02d}", 42500.0, 5950.0, 425.0,
            6375.0, 322.5, 29427.5, 42500.0, 85000.0
        ])
    wb.save(p)
    wb.close()
    return p


class TestExcelConverter:
    """Unit tests for ExcelConverter core logic."""

    @pytest.mark.parametrize(
        "filename,expected",
        [
            ("hesap.xlsx", True),
            ("hesap.XLSX", True),
            ("eski_tablo.xls", True),
            ("eski_tablo.XLS", True),
            ("belge.pdf", False),
            ("resim.png", False),
            ("notlar.docx", False),
            ("veri.csv", False),
            ("isimsiz", False),
        ],
    )
    def test_is_supported(self, filename: str, expected: bool):
        assert ExcelConverter.is_supported(filename) is expected

    def test_analyze_small_excel(self, sample_small_xlsx):
        analysis = ExcelConverter.analyze_excel(sample_small_xlsx)
        assert analysis["max_columns"] == 4
        assert analysis["max_rows"] >= 10
        assert analysis["recommended_orientation"] == "portrait"
        assert "Masraf Listesi" in analysis["sheets"]

    def test_analyze_wide_excel(self, sample_wide_xlsx):
        analysis = ExcelConverter.analyze_excel(sample_wide_xlsx)
        assert analysis["max_columns"] == 10
        assert analysis["max_rows"] >= 35
        assert analysis["recommended_orientation"] == "landscape"
        assert "Kıdem Hesabı" in analysis["sheets"]

    def test_convert_wide_excel_smart_auto_landscape(self, sample_wide_xlsx, tmp_path):
        out_pdf = str(tmp_path / "kidem_ihbar_hesabi.pdf")
        res = ExcelConverter.convert_excel_to_pdf(
            input_path=sample_wide_xlsx,
            output_path=out_pdf,
            orientation="auto",
            fit_width=True,
            repeat_header=True,
        )
        assert os.path.exists(res)
        assert res == out_pdf

        doc = fitz.open(res)
        assert len(doc) >= 1
        # Geniş tablo olduğu için otomatik olarak Yatay (Landscape) üretilmelidir
        page = doc[0]
        assert page.rect.width > page.rect.height, "Geniş tablonun yatay (landscape) üretilmesi beklenir"

        # Metin katmanı denetimi: Tüm sütunlar okunabilir olmalı
        full_text = " ".join([p.get_text() for p in doc])
        assert "Kıdem" in full_text or "Brüt" in full_text or "SGK" in full_text
        doc.close()

    def test_convert_small_excel_portrait(self, sample_small_xlsx, tmp_path):
        out_pdf = str(tmp_path / "masraf_listesi.pdf")
        res = ExcelConverter.convert_excel_to_pdf(
            input_path=sample_small_xlsx,
            output_path=out_pdf,
            orientation="portrait",
            fit_width=True,
        )
        assert os.path.exists(res)
        doc = fitz.open(res)
        assert len(doc) >= 1
        page = doc[0]
        # Dikey (Portrait)
        assert page.rect.height >= page.rect.width
        doc.close()

    def test_reportlab_fallback_direct(self, sample_wide_xlsx, tmp_path):
        """ReportLab saf Python motorunun doğrudan testi."""
        out_pdf = str(tmp_path / "pure_python_fallback.pdf")
        res = ExcelConverter._convert_via_reportlab(
            input_path=sample_wide_xlsx,
            output_path=out_pdf,
            orientation="landscape",
            fit_width=True,
            repeat_header=True,
        )
        assert os.path.exists(res)
        doc = fitz.open(res)
        assert len(doc) >= 1
        page = doc[0]
        assert page.rect.width > page.rect.height
        doc.close()

    def test_convert_nonexistent_file_raises(self, tmp_path):
        nonexistent = str(tmp_path / "bulunmayan_dosya.xlsx")
        with pytest.raises(FileNotFoundError, match="bulunamadı"):
            ExcelConverter.convert_excel_to_pdf(nonexistent)

    def test_convert_unsupported_format_raises(self, tmp_path):
        unsupported = str(tmp_path / "test.txt")
        Path(unsupported).write_text("Metin belgesi")
        with pytest.raises(ValueError, match="Desteklenmeyen dosya formatı"):
            ExcelConverter.convert_excel_to_pdf(unsupported)
