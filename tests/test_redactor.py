"""
Security and Unit tests for Paralegal's PDFRedactor module.
Verifies permanent physical sanitization of sensitive KVKK data (TCKN, IBAN, Names, Plates).
Ensures forensic unrecoverability against:
1. PyMuPDF (fitz) text extractors
2. PyPDF text extractors
3. Direct raw binary byte inspection of the PDF file
"""

import os
import pytest
import fitz
import pypdf

from core.kvkk_detector import KVKKDetector
from core.redactor import PDFRedactor


class TestPDFRedactor:
    """Security verification and functional test suite for PDF redaction engine."""

    def test_apply_redactions_end_to_end_sanitization(self, sample_sensitive_pdf_path, tmp_path):
        """
        Comprehensive test:
        1. Scan sensitive PDF for KVKK entities (TCKN, IBAN, Party Name, Phone, Plate, Email).
        2. Apply physical redactions with PDFRedactor.
        3. Assert successful redaction and verification report.
        4. FORENSIC SECURITY AUDIT:
           a) fitz.get_text() returns NO sensitive values.
           b) pypdf.extract_text() returns NO sensitive values.
           c) Raw PDF binary byte scan contains NO sensitive substrings.
        """
        output_pdf = str(tmp_path / "sanitized_redacted.pdf")

        # 1. Open original and scan page 0
        doc_orig = fitz.open(sample_sensitive_pdf_path)
        entities = KVKKDetector.scan_pdf_page(doc_orig[0], page_index=0)
        doc_orig.close()

        assert len(entities) >= 4
        sensitive_values = [e.value for e in entities]
        assert "10000000146" in sensitive_values
        assert "Ahmet Yilmaz" in sensitive_values

        redaction_items = [
            {
                "page_number": e.page_number,
                "rect": e.rect,
                "value": e.value,
                "approved": True,
            }
            for e in entities
        ]

        # 2. Apply physical redactions
        result = PDFRedactor.apply_redactions_to_pdf(
            input_pdf_path=sample_sensitive_pdf_path,
            output_pdf_path=output_pdf,
            redaction_items=redaction_items,
            fill_color=(0.0, 0.0, 0.0),  # Blackout
        )

        # 3. Assert report
        assert result["success"] is True
        assert result["verification_passed"] is True
        assert result["leaked_words"] == []
        assert result["total_redactions"] == len(redaction_items)

        # 4. Forensic Security Audit

        # (a) PyMuPDF text layer inspection
        doc_redacted = fitz.open(output_pdf)
        fitz_full_text = ""
        for page in doc_redacted:
            fitz_full_text += page.get_text()
        doc_redacted.close()

        assert "10000000146" not in fitz_full_text
        assert "Ahmet Yilmaz" not in fitz_full_text
        assert "TR33 0006 1005 1234 5678 9012 34" not in fitz_full_text
        assert "34 ABC 123" not in fitz_full_text
        assert "0532 123 45 67" not in fitz_full_text

        # Non-sensitive court heading should remain intact
        assert "T.C. ANKARA 4. ASLIYE HUKUK MAHKEMESI" in fitz_full_text
        # Docket number is sensitive and should be redacted
        assert "2024/1102" not in fitz_full_text

        # (b) PyPDF independent text extraction audit
        pypdf_reader = pypdf.PdfReader(output_pdf)
        pypdf_full_text = ""
        for page in pypdf_reader.pages:
            pypdf_full_text += page.extract_text() or ""

        assert "10000000146" not in pypdf_full_text
        assert "Ahmet Yilmaz" not in pypdf_full_text
        assert "TR33 0006 1005" not in pypdf_full_text
        assert "34 ABC 123" not in pypdf_full_text

        # (c) Raw binary byte stream audit (ensures no ghost text in uncompressed stream or objects)
        with open(output_pdf, "rb") as f:
            raw_pdf_bytes = f.read()

        assert b"10000000146" not in raw_pdf_bytes
        assert b"Ahmet Yilmaz" not in raw_pdf_bytes
        assert b"34 ABC 123" not in raw_pdf_bytes

    def test_redaction_text_overlay(self, sample_sensitive_pdf_path, tmp_path):
        """Tests that text_overlay parameter places marker text onto the redacted region."""
        output_pdf = str(tmp_path / "overlay_redacted.pdf")
        doc_orig = fitz.open(sample_sensitive_pdf_path)
        entities = KVKKDetector.scan_pdf_page(doc_orig[0], page_index=0)
        doc_orig.close()

        tckn_item = next(e for e in entities if e.category == "TCKN")
        redaction_items = [
            {
                "page_number": tckn_item.page_number,
                "rect": tckn_item.rect,
                "value": tckn_item.value,
                "approved": True,
            }
        ]

        result = PDFRedactor.apply_redactions_to_pdf(
            input_pdf_path=sample_sensitive_pdf_path,
            output_pdf_path=output_pdf,
            redaction_items=redaction_items,
            fill_color=(0.1, 0.1, 0.1),
            text_overlay="[GIZLENDI]",
            font_size=7.0,
        )

        assert result["success"] is True
        doc_redacted = fitz.open(output_pdf)
        extracted = doc_redacted[0].get_text()
        doc_redacted.close()

        assert "10000000146" not in extracted
        assert "[GIZLENDI]" in extracted

    def test_unapproved_items_are_not_redacted(self, sample_sensitive_pdf_path, tmp_path):
        """
        Items marked with approved=False must be skipped during redaction,
        remaining extractable in the final PDF.
        """
        output_pdf = str(tmp_path / "selective_redacted.pdf")
        doc_orig = fitz.open(sample_sensitive_pdf_path)
        entities = KVKKDetector.scan_pdf_page(doc_orig[0], page_index=0)
        doc_orig.close()

        tckn_item = next(e for e in entities if e.category == "TCKN")
        name_item = next(e for e in entities if e.category == "TARAF_ISMI")

        redaction_items = [
            {
                "page_number": tckn_item.page_number,
                "rect": tckn_item.rect,
                "value": tckn_item.value,
                "approved": True,  # Will be redacted
            },
            {
                "page_number": name_item.page_number,
                "rect": name_item.rect,
                "value": name_item.value,
                "approved": False,  # Should NOT be redacted
            },
        ]

        result = PDFRedactor.apply_redactions_to_pdf(
            input_pdf_path=sample_sensitive_pdf_path,
            output_pdf_path=output_pdf,
            redaction_items=redaction_items,
        )

        assert result["total_redactions"] == 1
        assert result["verification_passed"] is True

        doc_redacted = fitz.open(output_pdf)
        extracted = doc_redacted[0].get_text()
        doc_redacted.close()

        # TCKN was approved for redaction -> removed
        assert "10000000146" not in extracted
        # Name was NOT approved for redaction -> still present
        assert "Ahmet Yilmaz" in extracted

    def test_verify_redacted_pdf_detects_leaks(self, sample_sensitive_pdf_path):
        """Tests that verify_redacted_pdf accurately detects leaked words in an unredacted PDF."""
        check = PDFRedactor.verify_redacted_pdf(
            sample_sensitive_pdf_path,
            sensitive_words=["Ahmet Yilmaz", "10000000146", "TamamenAlakasizKelime"],
        )
        assert check["all_cleared"] is False
        assert "Ahmet Yilmaz" in check["leaked_words"]
        assert "10000000146" in check["leaked_words"]
        assert "TamamenAlakasizKelime" not in check["leaked_words"]

    def test_verify_redacted_pdf_passes_when_clean(self, tmp_path):
        """Tests verify_redacted_pdf reports all_cleared=True when no target words exist."""
        clean_pdf = str(tmp_path / "clean.pdf")
        doc = fitz.open()
        p = doc.new_page()
        p.insert_text((50, 50), "Genel Kamu Duyurusu ve Genel Bilgiler.")
        doc.save(clean_pdf)
        doc.close()

        check = PDFRedactor.verify_redacted_pdf(
            clean_pdf, sensitive_words=["Ahmet Yilmaz", "10000000146"]
        )
        assert check["all_cleared"] is True
        assert check["leaked_words"] == []

    def test_apply_redactions_nonexistent_pdf_raises(self, tmp_path):
        """Test FileNotFoundError is raised when target PDF does not exist."""
        nonexistent = str(tmp_path / "not_found.pdf")
        out = str(tmp_path / "out.pdf")
        with pytest.raises(FileNotFoundError, match="bulunamadı"):
            PDFRedactor.apply_redactions_to_pdf(nonexistent, out, [])

    def test_apply_redactions_empty_items(self, sample_sensitive_pdf_path, tmp_path):
        """Applying empty redaction list produces a valid clone without error."""
        out = str(tmp_path / "clone.pdf")
        result = PDFRedactor.apply_redactions_to_pdf(
            sample_sensitive_pdf_path, out, redaction_items=[]
        )
        assert result["success"] is True
        assert result["total_redactions"] == 0
        assert os.path.exists(out)

    def test_apply_redactions_out_of_bounds_page(self, sample_sensitive_pdf_path, tmp_path):
        """Redaction items targeting invalid page indices are skipped gracefully."""
        out = str(tmp_path / "out.pdf")
        invalid_item = {
            "page_number": 999,  # Page does not exist
            "rect": (10, 10, 50, 50),
            "value": "Test",
            "approved": True,
        }
        result = PDFRedactor.apply_redactions_to_pdf(
            sample_sensitive_pdf_path, out, [invalid_item]
        )
        assert result["success"] is True
        assert result["total_redactions"] == 0
