"""
Tests for Paralegal E-Posta & Outlook Converter Module (.msg, .eml, .pst, .ost, .mbox, .oft to PDF)
Includes parsing tests for all formats, HTML builder tests, cascading PDF generation tests,
and API route integration tests.
"""

import os
import sys
import shutil
import tempfile
import mailbox
from datetime import datetime
from email.message import EmailMessage
from unittest.mock import MagicMock, patch
import pytest
import pymupdf as fitz
from pathlib import Path

from extract_msg.ole_writer import OleWriter
from core.msg_converter import (
    MsgConverter, EmailConverter, convert_email_to_pdf,
    HAS_EXTRACT_MSG, HAS_PYPFF, HAS_PYSIDE_PDF, HAS_REPORTLAB
)


def create_synthetic_msg(
    file_path: str,
    subject: str = "Dava İhbarı",
    sender: str = "avukat@hukuk.av.tr",
    display_to: str = "muvekkil@firma.com",
    display_cc: str = "stajyer@hukuk.av.tr",
    body: str = "Sayın İlgili,\n\nEkteki tebligatı inceleyiniz.\n\nSaygılarımızla.",
    html_body: str = None
):
    """Creates a genuine OLE compound .msg / .oft file with standard property streams."""
    w = OleWriter()
    w.addEntry("__properties_version1.0", b"\x00" * 32)

    def add_str_prop(tag, val):
        stream_name = f"__substg1.0_{tag}001F"
        data = val.encode("utf-16le")
        w.addEntry(stream_name, data)

    if subject:
        add_str_prop("0037", subject)
    if sender:
        add_str_prop("0C1A", sender)
    if display_to:
        add_str_prop("0E04", display_to)
    if display_cc:
        add_str_prop("0E03", display_cc)
    if body:
        add_str_prop("1000", body)
    if html_body:
        w.addEntry("__substg1.0_10130102", html_body.encode("utf-8"))

    w.write(file_path)
    return file_path


def create_synthetic_eml(
    file_path: str,
    subject: str = "İcra Takip Talebi",
    sender: str = "Av. Ahmet Yılmaz <ahmet@yilmaz.av.tr>",
    to: str = "icra@adalet.gov.tr",
    cc: str = "katip@hukuk.av.tr",
    body_text: str = "Sayın Müdürlük, takip talebimiz ektedir.",
    body_html: str = "<html><body><p>Sayın Müdürlük, <b>takip talebimiz</b> ektedir.</p></body></html>",
    attachments: list = None
):
    """Creates a genuine RFC 822 / MIME .eml file."""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    if cc:
        msg["Cc"] = cc
    msg["Date"] = "Tue, 14 Apr 2026 11:20:00 +0300"

    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")

    if attachments:
        for att_name, att_bytes in attachments:
            msg.add_attachment(att_bytes, maintype="application", subtype="octet-stream", filename=att_name)

    with open(file_path, "wb") as f:
        f.write(msg.as_bytes())

    return file_path


def create_synthetic_mbox(file_path: str, num_messages: int = 2):
    """Creates a genuine Unix mbox file with multiple emails."""
    mb = mailbox.mbox(file_path)
    for i in range(num_messages):
        msg = EmailMessage()
        msg["Subject"] = f"MBOX İleti {i + 1}"
        msg["From"] = f"gonderici_{i + 1}@hukuk.av.tr"
        msg["To"] = "alici@baro.org.tr"
        msg["Date"] = f"Wed, 15 Apr 2026 1{i}:00:00 +0300"
        msg.set_content(f"MBOX içeriği {i + 1} - Delil niteliğinde e-posta.")
        mb.add(msg)
    mb.flush()
    mb.close()
    return file_path


class TestMsgConverter:
    """Test suite for E-Posta & Outlook (.msg, .eml, .pst, .ost, .mbox, .oft) converter."""

    @pytest.fixture
    def sample_msg_text(self, tmp_path):
        """Creates a sample text-only .msg file."""
        msg_path = str(tmp_path / "ornek_ihtar.msg")
        return create_synthetic_msg(
            msg_path,
            subject="Gecikme İhtarnamesi",
            sender="Av. Selin Kaya <selin@kaya.av.tr>",
            display_to="borclu@sirket.com.tr",
            display_cc="muhasebe@alacakli.com.tr",
            body="Sayın Borçlu,\n\nVadesi geçmiş 150.000 TL borcun 3 gün içinde ödenmesi ihtar olunur."
        )

    @pytest.fixture
    def sample_msg_html(self, tmp_path):
        """Creates a sample HTML-formatted .msg file."""
        msg_path = str(tmp_path / "ornek_html.msg")
        html_content = (
            "<html><body>"
            "<h3>Ön İnceleme Duruşma Tutanağı</h3>"
            "<p>Mahkeme tensip zaptına göre <b>15.04.2026</b> gününe gün verilmiştir.</p>"
            "<table border='1'><tr><th>Dosya No</th><th>Duruşma Günü</th></tr>"
            "<tr><td>2026/104 Esas</td><td>15.04.2026 10:30</td></tr></table>"
            "</body></html>"
        )
        return create_synthetic_msg(
            msg_path,
            subject="Ön İnceleme Duruşması",
            sender="Mahkeme Kalemi <kalem@adalet.gov.tr>",
            display_to="avukat@baro.org.tr",
            body="Ön İnceleme Duruşma Tutanağı...",
            html_body=html_content
        )

    @pytest.fixture
    def sample_eml(self, tmp_path):
        """Creates a sample .eml file."""
        eml_path = str(tmp_path / "ornek_tebligat.eml")
        return create_synthetic_eml(
            eml_path,
            subject="Elektronik Tebligat Bildirimi",
            sender="UETS <bildirim@etebligat.gov.tr>",
            to="avukat@kaya.av.tr",
            attachments=[("tebligat_mazbatasi.pdf", b"%PDF-1.4 sample attachment")]
        )

    @pytest.fixture
    def sample_oft(self, tmp_path):
        """Creates a sample .oft template file."""
        oft_path = str(tmp_path / "ornek_sablon.oft")
        return create_synthetic_msg(
            oft_path,
            subject="Standart İhtarname Şablonu",
            sender="sablon@hukuk.av.tr",
            body="Şablon gövdesi..."
        )

    @pytest.fixture
    def sample_mbox(self, tmp_path):
        """Creates a sample .mbox file with 2 messages."""
        mbox_path = str(tmp_path / "ornek_arsiv.mbox")
        return create_synthetic_mbox(mbox_path, num_messages=2)

    def test_is_supported_all_extensions(self):
        # Desteklenen 6 uzantı
        for ext in [".msg", ".eml", ".pst", ".ost", ".mbox", ".oft"]:
            assert MsgConverter.is_supported(f"belge{ext}") is True
            assert MsgConverter.is_supported(f"DOSYA{ext.upper()}") is True
            assert MsgConverter.is_supported(f"/path/to/mail{ext}") is True
            assert EmailConverter.is_supported(f"dizin/posta{ext}") is True

        # Desteklenmeyen uzantılar
        assert MsgConverter.is_supported("dilekce.docx") is False
        assert MsgConverter.is_supported("tablo.xlsx") is False
        assert MsgConverter.is_supported("delil.tiff") is False
        assert MsgConverter.is_supported("karar.pdf") is False
        assert MsgConverter.is_supported("metin.txt") is False

    def test_format_size(self):
        assert MsgConverter.format_size(0) == "0 B"
        assert MsgConverter.format_size(500) == "500 B"
        assert MsgConverter.format_size(1024) == "1.0 KB"
        assert MsgConverter.format_size(1048576) == "1.0 MB"
        assert MsgConverter.format_size(1572864) == "1.5 MB"

    def test_format_date(self):
        dt = datetime(2026, 3, 15, 14, 30, 0)
        formatted = MsgConverter.format_date(dt)
        assert "15 Mart 2026" in formatted
        assert "14:30:00" in formatted
        assert MsgConverter.format_date(None) == "Belirtilmemiş"

    def test_extract_msg_data(self, sample_msg_text):
        data = MsgConverter.extract_msg_data(sample_msg_text)
        assert data["subject"] == "Gecikme İhtarnamesi"
        assert "Selin Kaya" in data["sender"]
        assert "borclu@sirket.com.tr" in data["to"]
        assert "muhasebe@alacakli.com.tr" in data["cc"]
        assert "150.000 TL borcun" in data["body_text"]

    def test_extract_eml_data(self, sample_eml):
        data = MsgConverter.extract_eml_data(sample_eml)
        assert data["subject"] == "Elektronik Tebligat Bildirimi"
        assert "UETS" in data["sender"]
        assert "avukat@kaya.av.tr" in data["to"]
        assert len(data["attachments"]) == 1
        assert data["attachments"][0]["name"] == "tebligat_mazbatasi.pdf"
        assert "takip talebimiz" in (data["body_html"] or data["body_text"])

    def test_extract_mbox_data(self, sample_mbox):
        msgs = MsgConverter.extract_mbox_data(sample_mbox)
        assert len(msgs) == 2
        assert msgs[0]["subject"] == "MBOX İleti 1"
        assert msgs[1]["subject"] == "MBOX İleti 2"
        assert "gonderici_1" in msgs[0]["sender"]
        assert "gonderici_2" in msgs[1]["sender"]

    def test_extract_oft_data(self, sample_oft):
        data = MsgConverter.extract_msg_data(sample_oft)
        assert data["subject"] == "Standart İhtarname Şablonu"
        assert "Şablon gövdesi" in data["body_text"]

    def test_extract_any_email_data_dispatch(self, sample_msg_text, sample_eml, sample_oft, sample_mbox):
        assert len(MsgConverter.extract_any_email_data(sample_msg_text)) == 1
        assert len(MsgConverter.extract_any_email_data(sample_eml)) == 1
        assert len(MsgConverter.extract_any_email_data(sample_oft)) == 1
        assert len(MsgConverter.extract_any_email_data(sample_mbox)) == 2

    def test_build_email_html_structure(self, sample_msg_text):
        data = MsgConverter.extract_msg_data(sample_msg_text)
        html_out = MsgConverter.build_email_html(data)
        assert "Gecikme İhtarnamesi" in html_out
        assert "Selin Kaya" in html_out
        assert "borclu@sirket.com.tr" in html_out
        assert "E-POSTA İLETİ DELİLİ" in html_out
        assert "150.000 TL" in html_out

    def test_build_emails_html_multiple_page_break(self, sample_mbox):
        msgs = MsgConverter.extract_mbox_data(sample_mbox)
        html_out = MsgConverter.build_emails_html(msgs)
        assert "MBOX İleti 1" in html_out
        assert "MBOX İleti 2" in html_out
        assert "page-break-before: always" in html_out

    def test_convert_msg_to_pdf_text_only(self, sample_msg_text, tmp_path):
        out_pdf = str(tmp_path / "cikis_text.pdf")
        res = MsgConverter.convert_msg_to_pdf(sample_msg_text, out_pdf)
        assert os.path.exists(res)
        assert os.path.getsize(res) > 0

        # Verify with PyMuPDF
        doc = fitz.open(res)
        assert len(doc) >= 1
        page_text = doc[0].get_text()
        assert "Gecikme" in page_text
        assert "Selin Kaya" in page_text
        doc.close()

    def test_convert_msg_to_pdf_html(self, sample_msg_html, tmp_path):
        out_pdf = str(tmp_path / "cikis_html.pdf")
        res = MsgConverter.convert_msg_to_pdf(sample_msg_html, out_pdf)
        assert os.path.exists(res)
        assert os.path.getsize(res) > 0

        doc = fitz.open(res)
        assert len(doc) >= 1
        page_text = doc[0].get_text()
        assert "Ön İnceleme" in page_text
        doc.close()

    def test_convert_eml_to_pdf(self, sample_eml, tmp_path):
        out_pdf = str(tmp_path / "cikis_eml.pdf")
        res = convert_email_to_pdf(sample_eml, out_pdf)
        assert os.path.exists(res)
        assert os.path.getsize(res) > 0

        doc = fitz.open(res)
        assert len(doc) >= 1
        page_text = doc[0].get_text()
        assert "Elektronik Tebligat" in page_text
        assert "UETS" in page_text
        assert "tebligat_mazbatasi.pdf" in page_text
        doc.close()

    def test_convert_oft_to_pdf(self, sample_oft, tmp_path):
        out_pdf = str(tmp_path / "cikis_oft.pdf")
        res = MsgConverter.convert_msg_to_pdf(sample_oft, out_pdf)
        assert os.path.exists(res)
        assert os.path.getsize(res) > 0

        doc = fitz.open(res)
        assert len(doc) >= 1
        page_text = doc[0].get_text()
        assert "Standart İhtarname" in page_text
        doc.close()

    def test_convert_mbox_to_pdf(self, sample_mbox, tmp_path):
        out_pdf = str(tmp_path / "cikis_mbox.pdf")
        res = MsgConverter.convert_msg_to_pdf(sample_mbox, out_pdf)
        assert os.path.exists(res)
        assert os.path.getsize(res) > 0

        doc = fitz.open(res)
        # Birden çok ileti sayfa sonu ile bölündüğünden en az 2 sayfa olmalı
        assert len(doc) >= 2
        full_text = " ".join([p.get_text() for p in doc])
        assert "MBOX İleti 1" in full_text
        assert "MBOX İleti 2" in full_text
        doc.close()

    def test_convert_msg_fallback_reportlab(self, sample_msg_text, tmp_path):
        """Forces ReportLab fallback by bypassing PySide and COM."""
        out_pdf = str(tmp_path / "cikis_reportlab.pdf")
        with patch.object(MsgConverter, "_convert_via_pyside6", return_value=False):
            with patch.object(MsgConverter, "_convert_via_word_com", return_value=False):
                with patch.object(MsgConverter, "_convert_via_libreoffice", return_value=False):
                    res = MsgConverter.convert_msg_to_pdf(sample_msg_text, out_pdf)
                    assert os.path.exists(res)
                    assert os.path.getsize(res) > 0

                    doc = fitz.open(res)
                    assert len(doc) >= 1
                    page_text = doc[0].get_text()
                    assert "Gecikme" in page_text
                    doc.close()

    def test_convert_multi_email_reportlab_fallback(self, sample_mbox, tmp_path):
        """Forces ReportLab fallback on multiple messages in MBOX."""
        out_pdf = str(tmp_path / "cikis_multi_reportlab.pdf")
        with patch.object(MsgConverter, "_convert_via_pyside6", return_value=False):
            with patch.object(MsgConverter, "_convert_via_word_com", return_value=False):
                with patch.object(MsgConverter, "_convert_via_libreoffice", return_value=False):
                    res = MsgConverter.convert_msg_to_pdf(sample_mbox, out_pdf)
                    assert os.path.exists(res)
                    assert os.path.getsize(res) > 0

                    doc = fitz.open(res)
                    assert len(doc) >= 2
                    full_text = " ".join([p.get_text() for p in doc])
                    assert "gonderici_1" in full_text
                    assert "gonderici_2" in full_text
                    assert "MBOX" in full_text
                    doc.close()

    def test_pst_ost_pypff_mock_extraction(self, tmp_path):
        """Tests that PST/OST extractor works with pypff mock structures."""
        mock_file = MagicMock()
        mock_root = MagicMock()
        mock_folder = MagicMock()
        mock_msg = MagicMock()

        mock_msg.get_subject.return_value = "PST Delil İletisi"
        mock_msg.get_sender_name.return_value = "Müvekkil <muvekkil@test.com>"
        mock_msg.get_delivery_time.return_value = datetime(2026, 2, 20, 10, 0, 0)
        mock_msg.get_html_body.return_value = "<p>PST gövde metni</p>"
        mock_msg.get_plain_text_body.return_value = "PST gövde metni"
        mock_msg.get_transport_headers.return_value = "To: avukat@test.com\nCc: bilgi@test.com\n"
        mock_msg.get_number_of_attachments.return_value = 1

        mock_att = MagicMock()
        mock_att.get_long_filename.return_value = "sozlesme.pdf"
        mock_att.get_size.return_value = 20480
        mock_msg.get_attachment.return_value = mock_att

        mock_folder.get_number_of_sub_messages.return_value = 1
        mock_folder.get_sub_message.return_value = mock_msg
        mock_folder.get_number_of_sub_folders.return_value = 0

        mock_root.get_number_of_sub_messages.return_value = 0
        mock_root.get_number_of_sub_folders.return_value = 1
        mock_root.get_sub_folder.return_value = mock_folder

        mock_file.get_root_folder.return_value = mock_root

        dummy_pst = str(tmp_path / "test.pst")
        with open(dummy_pst, "wb") as f:
            f.write(b"DUMMY_PST_DATA")

        with patch("pypff.file", return_value=mock_file):
            results = MsgConverter.extract_pst_ost_data(dummy_pst)
            assert len(results) == 1
            assert results[0]["subject"] == "PST Delil İletisi"
            assert "muvekkil@test.com" in results[0]["sender"]
            assert results[0]["to"] == "avukat@test.com"
            assert results[0]["cc"] == "bilgi@test.com"
            assert len(results[0]["attachments"]) == 1
            assert results[0]["attachments"][0]["name"] == "sozlesme.pdf"

    def test_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            MsgConverter.convert_msg_to_pdf("olmayan_dosya.msg")
        with pytest.raises(FileNotFoundError):
            MsgConverter.convert_msg_to_pdf("olmayan_dosya.eml")

    def test_unsupported_format(self, tmp_path):
        txt_file = str(tmp_path / "not_email.txt")
        with open(txt_file, "w") as f:
            f.write("test")
        with pytest.raises(ValueError):
            MsgConverter.convert_msg_to_pdf(txt_file)


class TestMsgConverterRouteIntegration:
    """Test suite for server route handling of MSG / E-Posta conversion."""

    def test_routes_post_contains_convert_msg_and_email(self):
        from core.routes import RouteHandler
        mock_server = MagicMock()
        handler = RouteHandler(mock_server)
        post_routes = handler.get_post_routes()
        assert "/api/convert-msg" in post_routes
        assert "/api/convert-email" in post_routes
        assert "/api/convert-images" in post_routes

    def test_convert_msg_route_success(self, tmp_path):
        from core.routes import RouteHandler
        msg_file = str(tmp_path / "route_test.msg")
        create_synthetic_msg(msg_file, subject="API Testi")

        mock_server = MagicMock()
        handler = RouteHandler(mock_server)

        out_pdf = str(tmp_path / "route_out.pdf")
        handler.convert_msg("/api/convert-msg", {"input_path": msg_file, "output_path": out_pdf})

        mock_server._send_json.assert_called_once()
        args, _ = mock_server._send_json.call_args
        assert args[0].get("success") is True
        assert os.path.exists(out_pdf)

    def test_convert_email_route_with_eml(self, tmp_path):
        from core.routes import RouteHandler
        eml_file = str(tmp_path / "route_test.eml")
        create_synthetic_eml(eml_file, subject="API EML Testi")

        mock_server = MagicMock()
        handler = RouteHandler(mock_server)

        out_pdf = str(tmp_path / "route_eml_out.pdf")
        handler.convert_msg("/api/convert-email", {"input_path": eml_file, "output_path": out_pdf})

        mock_server._send_json.assert_called_once()
        args, _ = mock_server._send_json.call_args
        assert args[0].get("success") is True
        assert os.path.exists(out_pdf)

    def test_convert_images_route_with_all_email_types(self, tmp_path):
        """Tests that convert_images universal endpoint handles .msg, .eml, .oft, .mbox seamlessly."""
        from core.routes import RouteHandler
        msg_file = str(tmp_path / "universal_test.msg")
        create_synthetic_msg(msg_file, subject="Evrensel Dönüştürücü MSG Testi")

        eml_file = str(tmp_path / "universal_test.eml")
        create_synthetic_eml(eml_file, subject="Evrensel Dönüştürücü EML Testi")

        oft_file = str(tmp_path / "universal_test.oft")
        create_synthetic_msg(oft_file, subject="Evrensel Dönüştürücü OFT Testi")

        mbox_file = str(tmp_path / "universal_test.mbox")
        create_synthetic_mbox(mbox_file, num_messages=1)

        mock_server = MagicMock()
        handler = RouteHandler(mock_server)

        out_dir = str(tmp_path / "outputs")
        handler.convert_images("/api/convert-images", {
            "input_paths": [msg_file, eml_file, oft_file, mbox_file],
            "combine": False,
            "output_dir": out_dir
        })

        mock_server._send_json.assert_called_once()
        args, _ = mock_server._send_json.call_args
        assert args[0].get("success") is True
        assert len(args[0].get("output_paths", [])) == 4
        for out_f in args[0]["output_paths"]:
            assert os.path.exists(out_f)
            assert os.path.getsize(out_f) > 0

    def test_convert_images_route_combine_hybrid_emails(self, tmp_path):
        """Tests that convert_images combines different email formats into a single PDF."""
        from core.routes import RouteHandler
        eml_file = str(tmp_path / "hybrid_1.eml")
        create_synthetic_eml(eml_file, subject="Birleşik İleti 1")

        msg_file = str(tmp_path / "hybrid_2.msg")
        create_synthetic_msg(msg_file, subject="Birleşik İleti 2")

        mock_server = MagicMock()
        handler = RouteHandler(mock_server)

        out_dir = str(tmp_path / "outputs_combined")
        handler.convert_images("/api/convert-images", {
            "input_paths": [eml_file, msg_file],
            "combine": True,
            "output_dir": out_dir
        })

        mock_server._send_json.assert_called_once()
        args, _ = mock_server._send_json.call_args
        assert args[0].get("success") is True
        assert len(args[0].get("output_paths", [])) == 1
        combined_pdf = args[0]["output_paths"][0]
        assert os.path.exists(combined_pdf)

        doc = fitz.open(combined_pdf)
        assert len(doc) >= 2
        full_text = " ".join([p.get_text() for p in doc])
        assert "Birleşik İleti 1" in full_text
        assert "Birleşik İleti 2" in full_text
        doc.close()
