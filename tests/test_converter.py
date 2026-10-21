"""
Unit tests for Paralegal's ImageConverter module.
Tests single and multi-page conversions (TIFF, JPEG, PNG RGBA), combination,
and error handling.
"""

import os
from pathlib import Path
import pytest
import fitz
from PIL import Image

from core.converter import ImageConverter


class TestImageConverter:
    """Suite of tests covering image format detection, single conversion, and combination."""

    @pytest.mark.parametrize(
        "filename,expected",
        [
            ("doc.tiff", True),
            ("doc.tif", True),
            ("photo.jpeg", True),
            ("photo.jpg", True),
            ("scan.png", True),
            ("image.bmp", True),
            ("pic.webp", True),
            ("PHOTO.JPG", True),
            ("SCAN.TIFF", True),
            ("report.pdf", False),
            ("notes.txt", False),
            ("data.xml", False),
            ("archive.zip", False),
            ("no_extension", False),
        ],
    )
    def test_is_supported_extensions(self, filename: str, expected: bool):
        """Verifies extension validation logic for supported and unsupported formats."""
        assert ImageConverter.is_supported(filename) is expected

    def test_convert_single_jpeg(self, sample_jpeg, tmp_path):
        """Test converting a single JPEG image to a valid PDF document."""
        out_pdf = str(tmp_path / "output_single.pdf")
        callbacks = []

        def on_progress(current, total, msg):
            callbacks.append((current, total, msg))

        result_path = ImageConverter.convert_image_to_pdf(
            sample_jpeg, output_path=out_pdf, progress_callback=on_progress
        )

        assert os.path.exists(result_path)
        assert result_path == out_pdf
        assert len(callbacks) == 1
        assert callbacks[0][0] == 1
        assert callbacks[0][1] == 1

        # Verify PDF validity and structure with PyMuPDF
        doc = fitz.open(result_path)
        assert len(doc) == 1
        page = doc[0]
        assert page.rect.width > 0
        assert page.rect.height > 0
        doc.close()

    def test_convert_multiframe_tiff(self, sample_multiframe_tiff, tmp_path):
        """Test converting a multi-frame TIFF (3 pages) to a 3-page PDF document."""
        out_pdf = str(tmp_path / "output_tiff.pdf")
        callbacks = []

        def on_progress(current, total, msg):
            callbacks.append((current, total, msg))

        result_path = ImageConverter.convert_image_to_pdf(
            sample_multiframe_tiff, output_path=out_pdf, progress_callback=on_progress
        )

        assert os.path.exists(result_path)
        assert len(callbacks) == 3
        assert [c[0] for c in callbacks] == [1, 2, 3]
        assert all(c[1] == 3 for c in callbacks)

        # Verify page count in converted PDF
        doc = fitz.open(result_path)
        assert len(doc) == 3
        for i in range(3):
            assert doc[i].rect.width > 0
            assert doc[i].rect.height > 0
        doc.close()

    def test_convert_rgba_png_handling(self, sample_rgba_png, tmp_path):
        """Test that RGBA images with alpha channels convert cleanly to RGB PDF without errors."""
        out_pdf = str(tmp_path / "output_transparent.pdf")
        result_path = ImageConverter.convert_image_to_pdf(sample_rgba_png, output_path=out_pdf)

        assert os.path.exists(result_path)
        doc = fitz.open(result_path)
        assert len(doc) == 1
        doc.close()

    def test_convert_grayscale_image(self, tmp_path):
        """Test converting grayscale ('L' mode) image to RGB PDF without error."""
        gray_path = str(tmp_path / "gray.png")
        img = Image.new("L", (150, 150), color=128)
        img.save(gray_path)

        out_pdf = str(tmp_path / "output_gray.pdf")
        result_path = ImageConverter.convert_image_to_pdf(gray_path, output_path=out_pdf)
        assert os.path.exists(result_path)
        doc = fitz.open(result_path)
        assert len(doc) == 1
        doc.close()

    def test_convert_image_default_output_path(self, tmp_path):
        """Test that output_path=None defaults to saving .pdf alongside the original image."""
        img_path = str(tmp_path / "standalone.jpg")
        img = Image.new("RGB", (100, 100), color=(100, 150, 200))
        img.save(img_path)

        result_path = ImageConverter.convert_image_to_pdf(img_path)
        expected_pdf = str(tmp_path / "standalone.pdf")

        assert result_path == expected_pdf
        assert os.path.exists(expected_pdf)

        doc = fitz.open(expected_pdf)
        assert len(doc) == 1
        doc.close()

    def test_combine_multiple_images_to_pdf(
        self, sample_jpeg, sample_rgba_png, sample_multiframe_tiff, tmp_path
    ):
        """
        Test combining heterogeneous image formats into a single unified PDF:
        - 1 JPEG (1 page)
        - 1 RGBA PNG (1 page)
        - 1 3-frame TIFF (3 pages)
        Total expected pages = 5.
        """
        combined_pdf = str(tmp_path / "combined_bundle.pdf")
        inputs = [sample_jpeg, sample_rgba_png, sample_multiframe_tiff]
        callbacks = []

        def on_progress(current, total, msg):
            callbacks.append((current, total, msg))

        result_path = ImageConverter.combine_multiple_images_to_pdf(
            inputs, output_path=combined_pdf, progress_callback=on_progress
        )

        assert os.path.exists(result_path)
        assert len(callbacks) == 3

        doc = fitz.open(result_path)
        assert len(doc) == 5, f"Expected 5 combined pages (1 + 1 + 3), but got {len(doc)}"
        doc.close()

    def test_convert_nonexistent_file_raises(self, tmp_path):
        """Test FileNotFoundError is raised when input file does not exist."""
        nonexistent = str(tmp_path / "does_not_exist.jpg")
        with pytest.raises(FileNotFoundError, match="Girdi dosyası bulunamadı"):
            ImageConverter.convert_image_to_pdf(nonexistent)

    def test_convert_unsupported_format_raises(self, tmp_path):
        """Test ValueError is raised when trying to convert an unsupported file type."""
        dummy_txt = str(tmp_path / "test.txt")
        Path(dummy_txt).write_text("Not an image")
        with pytest.raises(ValueError, match="Desteklenmeyen dosya formatı"):
            ImageConverter.convert_image_to_pdf(dummy_txt)

    def test_combine_empty_list_raises(self, tmp_path):
        """Test ValueError is raised when providing an empty input file list."""
        out_pdf = str(tmp_path / "out.pdf")
        with pytest.raises(ValueError, match="boş olamaz"):
            ImageConverter.combine_multiple_images_to_pdf([], out_pdf)

    def test_combine_all_unsupported_raises(self, tmp_path):
        """Test RuntimeError is raised when none of the provided files are supported images."""
        f1 = str(tmp_path / "file1.docx")
        f2 = str(tmp_path / "file2.pdf")
        Path(f1).write_text("doc")
        Path(f2).write_text("pdf")

        out_pdf = str(tmp_path / "out.pdf")
        with pytest.raises(RuntimeError, match="hiçbir sayfa|geçerli bir görsel sayfası çıkarılamadı"):
            ImageConverter.combine_multiple_images_to_pdf([f1, f2], out_pdf)

    def test_converted_pdf_uyap_optimization(self, tmp_path):
        """Converted PDFs are checked under UYAP 10MB limit and compressed if threshold exceeded."""
        from PIL import Image
        from core.redactor import PDFRedactor

        large_img_path = str(tmp_path / "large_scan.png")
        img = Image.new("RGB", (1400, 1800), color=(100, 150, 200))
        img.save(large_img_path, format="PNG")

        out_pdf = str(tmp_path / "converted_scan.pdf")
        ImageConverter.convert_image_to_pdf(large_img_path, out_pdf)
        assert os.path.exists(out_pdf)
        assert os.path.getsize(out_pdf) <= 10 * 1024 * 1024

        current_size = os.path.getsize(out_pdf)
        opt_res = PDFRedactor.optimize_for_uyap_if_needed(out_pdf, max_bytes=current_size // 2)
        assert opt_res["optimized"] is True
        assert opt_res["final_size"] < current_size
