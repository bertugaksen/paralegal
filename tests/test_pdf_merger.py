"""
Tests for Paralegal PDF Merger Module (PDF Birleştirme)
Includes unit tests for PDFMerger, Table of Contents (bookmarks) nesting,
page count verification, error handling, and API route integration.
"""

import os
import shutil
import tempfile
from unittest.mock import MagicMock, patch
import pytest
import pymupdf as fitz
from pathlib import Path

from core.pdf_merger import PDFMerger


def create_dummy_pdf(file_path: str, page_count: int = 1, text_prefix: str = "Sayfa", toc_items=None) -> str:
    """Helper to create genuine test PDF files with specified pages and optional TOC."""
    doc = fitz.open()
    for i in range(1, page_count + 1):
        page = doc.new_page(width=595, height=842) # A4
        page.insert_text((50, 80), f"{text_prefix} - {i}", fontsize=14)

    if toc_items:
        doc.set_toc(toc_items)

    doc.save(file_path)
    doc.close()
    return file_path


class TestPDFMergerUnit:
    """Test suite for PDFMerger core functionality."""

    @pytest.fixture
    def sample_pdfs(self, tmp_path):
        """Creates three sample PDFs representing court documents."""
        pdf1 = str(tmp_path / "1_Dava_Dilekcesi.pdf")
        create_dummy_pdf(
            pdf1,
            page_count=2,
            text_prefix="Dava Dilekcesi",
            toc_items=[[1, "Konu ve Taraflar", 1], [1, "Talep Sonucu", 2]]
        )

        pdf2 = str(tmp_path / "2_Tensip_Zapti.pdf")
        create_dummy_pdf(
            pdf2,
            page_count=1,
            text_prefix="Tensip Zapti"
        )

        pdf3 = str(tmp_path / "3_Bilir kisi_Raporu.pdf")
        create_dummy_pdf(
            pdf3,
            page_count=3,
            text_prefix="Bilir kisi Raporu",
            toc_items=[[1, "Giris", 1], [1, "Hesaplama Tablosu", 2], [1, "Sonuc", 3]]
        )

        return [pdf1, pdf2, pdf3]

    def test_is_supported(self):
        assert PDFMerger.is_supported("dosya.pdf") is True
        assert PDFMerger.is_supported("BELGE.PDF") is True
        assert PDFMerger.is_supported("/path/to/karar.pdf") is True
        assert PDFMerger.is_supported("dilekce.docx") is False
        assert PDFMerger.is_supported("tablo.xlsx") is False
        assert PDFMerger.is_supported("mesaj.msg") is False
        assert PDFMerger.is_supported("gorsel.jpg") is False

    def test_format_size(self):
        assert PDFMerger.format_size(0) == "0 B"
        assert PDFMerger.format_size(512) == "512 B"
        assert PDFMerger.format_size(1024) == "1.0 KB"
        assert PDFMerger.format_size(1048576) == "1.0 MB"
        assert PDFMerger.format_size(2097152) == "2.0 MB"

    def test_get_pdf_info(self, sample_pdfs):
        pdf1 = sample_pdfs[0]
        info = PDFMerger.get_pdf_info(pdf1)

        assert info["filename"] == "1_Dava_Dilekcesi.pdf"
        assert info["page_count"] == 2
        assert info["size_bytes"] > 0
        assert "KB" in info["size_formatted"] or "B" in info["size_formatted"]
        assert info["has_toc"] is True
        assert info["is_encrypted"] is False

    def test_get_pdf_info_nonexistent(self):
        with pytest.raises(FileNotFoundError):
            PDFMerger.get_pdf_info("olmayan_dosya.pdf")

    def test_get_pdf_info_invalid_extension(self, tmp_path):
        txt_path = str(tmp_path / "test.txt")
        with open(txt_path, "w") as f:
            f.write("test")
        with pytest.raises(ValueError):
            PDFMerger.get_pdf_info(txt_path)

    def test_merge_pdfs_success_with_bookmarks(self, sample_pdfs, tmp_path):
        out_pdf = str(tmp_path / "dava_dosyasi_birlestirilmis.pdf")
        progress_calls = []

        def callback(cur, total, msg):
            progress_calls.append((cur, total, msg))

        result = PDFMerger.merge_pdfs(
            input_paths=sample_pdfs,
            output_path=out_pdf,
            add_bookmarks=True,
            progress_callback=callback
        )

        assert result["success"] is True
        assert result["output_path"] == out_pdf
        assert result["total_pages"] == 6 # 2 + 1 + 3
        assert result["file_count"] == 3
        assert os.path.exists(out_pdf)
        assert len(progress_calls) >= 3

        # Verify merged PDF content & Table of Contents (bookmarks)
        merged = fitz.open(out_pdf)
        assert len(merged) == 6
        toc = merged.get_toc()

        # Check top-level bookmarks for each file
        file_titles = [item[1] for item in toc if item[0] == 1]
        assert any("1. 1 Dava Dilekcesi" in t for t in file_titles)
        assert any("2. 2 Tensip Zapti" in t for t in file_titles)
        assert any("3. 3 Bilir kisi Raporu" in t for t in file_titles)

        # Check nested sub-bookmarks from source PDFs
        sub_titles = [item[1] for item in toc if item[0] == 2]
        assert "Konu ve Taraflar" in sub_titles
        assert "Hesaplama Tablosu" in sub_titles
        merged.close()

    def test_merge_pdfs_without_bookmarks(self, sample_pdfs, tmp_path):
        out_pdf = str(tmp_path / "no_bookmarks.pdf")
        result = PDFMerger.merge_pdfs(
            input_paths=sample_pdfs,
            output_path=out_pdf,
            add_bookmarks=False
        )
        assert result["success"] is True
        merged = fitz.open(out_pdf)
        assert len(merged) == 6
        assert len(merged.get_toc()) == 0
        merged.close()

    def test_merge_pdfs_auto_output_path(self, sample_pdfs):
        first_p = Path(sample_pdfs[0])
        expected_out = str(first_p.parent / f"{first_p.stem}_birlestirilmis.pdf")

        result = PDFMerger.merge_pdfs(input_paths=sample_pdfs)
        assert result["success"] is True
        assert result["output_path"] == expected_out
        assert os.path.exists(expected_out)

        # Cleanup
        if os.path.exists(expected_out):
            os.remove(expected_out)

    def test_merge_pdfs_empty_list_raises(self):
        with pytest.raises(ValueError):
            PDFMerger.merge_pdfs([])

    def test_merge_pdfs_nonexistent_file_raises(self, sample_pdfs):
        with pytest.raises(FileNotFoundError):
            PDFMerger.merge_pdfs([sample_pdfs[0], "bulunmayan_dosya.pdf"])

    def test_merge_pdfs_unsupported_file_raises(self, sample_pdfs, tmp_path):
        txt_file = str(tmp_path / "not_pdf.txt")
        with open(txt_file, "w") as f:
            f.write("plain text")

        with pytest.raises(ValueError):
            PDFMerger.merge_pdfs([sample_pdfs[0], txt_file])


class TestPDFMergerRouteIntegration:
    """Test suite for server route handling of PDF merging."""

    def test_routes_post_contains_merge_endpoints(self):
        from core.routes import RouteHandler
        mock_server = MagicMock()
        handler = RouteHandler(mock_server)
        post_routes = handler.get_post_routes()

        assert "/api/merge-pdfs" in post_routes
        assert "/api/pdf-info" in post_routes

    def test_pdf_info_route_success(self, tmp_path):
        from core.routes import RouteHandler
        pdf_path = str(tmp_path / "info_test.pdf")
        create_dummy_pdf(pdf_path, page_count=4)

        mock_server = MagicMock()
        handler = RouteHandler(mock_server)

        handler.pdf_info("/api/pdf-info", {"path": pdf_path})
        mock_server._send_json.assert_called_once()
        args, _ = mock_server._send_json.call_args
        assert args[0]["page_count"] == 4
        assert args[0]["filename"] == "info_test.pdf"

    def test_pdf_info_route_not_found(self):
        from core.routes import RouteHandler
        mock_server = MagicMock()
        handler = RouteHandler(mock_server)

        handler.pdf_info("/api/pdf-info", {"path": "olmayan.pdf"})
        mock_server._send_json.assert_called_once()
        args = mock_server._send_json.call_args[0]
        assert args[1] == 404

    def test_merge_pdfs_route_empty_list(self):
        from core.routes import RouteHandler
        mock_server = MagicMock()
        handler = RouteHandler(mock_server)

        handler.merge_pdfs("/api/merge-pdfs", {"input_paths": []})
        mock_server._send_json.assert_called_once()
        args = mock_server._send_json.call_args[0]
        assert args[1] == 400

    def test_merge_pdfs_route_success(self, tmp_path):
        from core.routes import RouteHandler
        pdf1 = str(tmp_path / "doc1.pdf")
        pdf2 = str(tmp_path / "doc2.pdf")
        create_dummy_pdf(pdf1, page_count=2)
        create_dummy_pdf(pdf2, page_count=3)

        out_pdf = str(tmp_path / "merged_route.pdf")

        mock_server = MagicMock()
        handler = RouteHandler(mock_server)

        handler.merge_pdfs("/api/merge-pdfs", {
            "input_paths": [pdf1, pdf2],
            "output_path": out_pdf,
            "add_bookmarks": True
        })

        mock_server._send_json.assert_called_once()
        args, _ = mock_server._send_json.call_args
        assert args[0]["success"] is True
        assert args[0]["total_pages"] == 5
        assert os.path.exists(out_pdf)
