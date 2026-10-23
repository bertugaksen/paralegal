"""
Tests for Paralegal Word Converter Module (.docx and .doc to PDF)
"""

import os
import shutil
import tempfile
import pytest
import pymupdf as fitz
from pathlib import Path

from core.word_converter import WordConverter, HAS_PYTHON_DOCX, HAS_REPORTLAB
from core.converter import ImageConverter
from core.excel_converter import ExcelConverter


class TestWordConverter:
    """Test suite for Word (.docx, .doc) conversion engine."""

    @pytest.fixture
    def sample_docx_file(self, tmp_path):
        """Creates a genuine legal petition .docx file with title, body, and table."""
        import docx

        doc_path = str(tmp_path / "dava_dilekcesi.docx")
        doc = docx.Document()
        doc.add_heading("İSTANBUL ANADOLU 4. ASLİYE TİCARET MAHKEMESİ'NE", level=1)
        doc.add_paragraph("DAVACI: Anadolu Lojistik A.Ş.")
        doc.add_paragraph("VEKİLİ: Av. Mehmet Demir")
        doc.add_paragraph("DAVALI: Marmara İnşaat San. Tic. Ltd. Şti.")
        doc.add_paragraph("KONU: 150.000,00 TL ticari alacağın tahsili talebidir.")

        # Add a table
        table = doc.add_table(rows=3, cols=3)
        headers = ["Fatura No", "Fatura Tarihi", "Tutar (TL)"]
        for i, h in enumerate(headers):
            table.cell(0, i).text = h

        row1 = ["FT-2024-001", "12.01.2024", "75.000,00"]
        for i, val in enumerate(row1):
            table.cell(1, i).text = val

        row2 = ["FT-2024-002", "18.02.2024", "75.000,00"]
        for i, val in enumerate(row2):
            table.cell(2, i).text = val

        doc.save(doc_path)
        return doc_path

    @pytest.fixture
    def sample_doc_file(self, tmp_path):
        """Creates a legacy Word (.doc) compatible file."""
        doc_path = str(tmp_path / "eski_vekaletname.doc")
        with open(doc_path, "w", encoding="utf-8") as f:
            f.write(r"{\rtf1\ansi\deff0 {\fonttbl {\f0 Times New Roman;}} \f0\fs24 GENEL VEKALETNAME \par Ahzu kabz, sulh ve ibraya mezunum.}")
        return doc_path

    @pytest.mark.parametrize(
        "filename, expected",
        [
            ("dilekce.docx", True),
            ("DILEKCE.DOCX", True),
            ("vekaletname.doc", True),
            ("ESKI_EVRAK.DOC", True),
            ("rapor.pdf", False),
            ("hesap.xlsx", False),
            ("resim.png", False),
            ("notlar.txt", False),
            ("isimsiz", False),
        ],
    )
    def test_is_supported(self, filename, expected):
        assert WordConverter.is_supported(filename) == expected

    def test_find_libreoffice(self):
        soffice = WordConverter.find_libreoffice()
        assert soffice is not None
        assert os.path.exists(soffice)

    def test_convert_docx_to_pdf_libreoffice(self, sample_docx_file, tmp_path):
        out_pdf = str(tmp_path / "dava_dilekcesi.pdf")
        callbacks = []

        def on_prog(curr, tot, msg):
            callbacks.append((curr, tot, msg))

        res_path = WordConverter.convert_word_to_pdf(
            sample_docx_file, output_path=out_pdf, progress_callback=on_prog
        )

        assert os.path.exists(res_path)
        assert res_path == out_pdf
        assert len(callbacks) > 0

        # Verify PDF structure using PyMuPDF
        doc = fitz.open(res_path)
        assert len(doc) >= 1
        page_text = doc[0].get_text()
        assert "TİCARET MAHKEMESİ" in page_text or "DAVACI" in page_text or "Anadolu" in page_text
        doc.close()

    def test_convert_doc_to_pdf(self, sample_doc_file, tmp_path):
        out_pdf = str(tmp_path / "eski_vekaletname.pdf")
        res_path = WordConverter.convert_word_to_pdf(sample_doc_file, output_path=out_pdf)

        assert os.path.exists(res_path)
        doc = fitz.open(res_path)
        assert len(doc) >= 1
        page_text = doc[0].get_text()
        assert "VEKALETNAME" in page_text or "sulh" in page_text
        doc.close()

    def test_reportlab_fallback_direct(self, sample_docx_file, tmp_path):
        if not (HAS_PYTHON_DOCX and HAS_REPORTLAB):
            pytest.skip("python-docx veya reportlab yüklü değil")

        fallback_pdf = str(tmp_path / "fallback_out.pdf")
        res_path = WordConverter._convert_via_reportlab(sample_docx_file, fallback_pdf)

        assert os.path.exists(res_path)
        doc = fitz.open(res_path)
        assert len(doc) >= 1
        page_text = doc[0].get_text()
        assert "DAVACI" in page_text or "TİCARET" in page_text
        doc.close()

    def test_convert_nonexistent_file_raises(self, tmp_path):
        nonexistent = str(tmp_path / "yok.docx")
        with pytest.raises(FileNotFoundError, match="Word dosyası bulunamadı"):
            WordConverter.convert_word_to_pdf(nonexistent)

    def test_convert_unsupported_format_raises(self, tmp_path):
        dummy_txt = str(tmp_path / "test.xyz")
        Path(dummy_txt).write_text("dummy")
        with pytest.raises(ValueError, match="Desteklenmeyen dosya formatı"):
            WordConverter.convert_word_to_pdf(dummy_txt)

    def test_uyap_10mb_protection_applied(self, sample_docx_file, tmp_path):
        out_pdf = str(tmp_path / "uyap_guvenli.pdf")
        res_path = WordConverter.convert_word_to_pdf(sample_docx_file, output_path=out_pdf)
        assert os.path.exists(res_path)
        assert os.path.getsize(res_path) <= 10 * 1024 * 1024
