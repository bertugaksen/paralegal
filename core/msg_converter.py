"""
Paralegal - High-Fidelity E-Posta & Outlook to UYAP PDF Converter Module
%100 Yerel, Sıfır İnternet, Sıfır Telemetri.

Desteklenen formatlar:
- .msg  : Microsoft Outlook E-Posta İletisi
- .eml  : Standart RFC 822 / MIME E-Posta İletisi
- .pst  : Microsoft Outlook Kişisel Klasör Veri Tabanı (PST)
- .ost  : Microsoft Outlook Çevrimdışı Klasör Veri Tabanı (OST)
- .mbox : Unix Posta Kutusu Arşivi (MBOX)
- .oft  : Microsoft Outlook Şablon İletisi

Adli delil standardında mizanpaj:
1. Üstbilgi Zarfı: Konu, Kimden, Kime, Bilgi (CC), Gizli (BCC), Gönderim Tarihi ve Ek Dosyalar Listesi.
2. E-Posta Gövdesi: Zengin HTML veya Düz Metin (Türkçe karakter ve tablo korumalı).
3. Çoklu İleti Desteği: PST, OST ve MBOX arşivlerindeki tüm iletiler sıralı ve sayfa sonları (page-break) ile ayrılmış olarak tek PDF'te toplanır.
4. Kademeli Dönüştürme Mimarisi (Cascading Pipeline):
   - Tier 1: PySide6 QTextDocument + QPdfWriter (300 DPI, yüksek çözünürlüklü vektör PDF, harici ofis yazılımı gerektirmez).
   - Tier 2: Microsoft Office Word (Windows COM - win32com.client).
   - Tier 3: LibreOffice Headless (soffice).
   - Tier 4: ReportLab Saf Python Kurtarma Motoru.
5. UYAP 10 MB Otomatik Koruma: Üretilen PDF 10 MB sınırını aşıyorsa kalite kaybı yaşanmadan optimize edilir.
"""

import os
import sys
import re
import html
import shutil
import tempfile
import subprocess
import email
from email import policy
import mailbox
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable, Dict, Any, List, Union

# extract_msg Kütüphanesi
try:
    import extract_msg
    HAS_EXTRACT_MSG = True
except ImportError:
    HAS_EXTRACT_MSG = False

# libpff-python (pypff) Kütüphanesi (PST & OST desteği)
try:
    import pypff
    HAS_PYPFF = True
except ImportError:
    HAS_PYPFF = False

# Windows COM (win32com)
try:
    import pythoncom
    import win32com.client
    HAS_WIN32COM = True
except ImportError:
    HAS_WIN32COM = False

# PySide6 Qt Yazdırma Altyapısı
try:
    from PySide6.QtGui import QTextDocument, QPdfWriter, QPageSize, QPageLayout
    from PySide6.QtCore import QMarginsF
    from PySide6.QtWidgets import QApplication
    HAS_PYSIDE_PDF = True
except ImportError:
    HAS_PYSIDE_PDF = False

# ReportLab Saf Python Fallback
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False


class MsgConverter:
    """Outlook ve standart E-Posta iletilerini adli delil standardında UYAP uyumlu PDF'e dönüştüren motor."""

    SUPPORTED_EXTENSIONS = {".msg", ".eml", ".pst", ".ost", ".mbox", ".oft"}

    @classmethod
    def is_supported(cls, file_path: str) -> bool:
        """Dosyanın desteklenen bir e-posta formatı olup olmadığını denetler."""
        return Path(file_path).suffix.lower() in cls.SUPPORTED_EXTENSIONS

    @staticmethod
    def format_size(size_bytes: int) -> str:
        """Bayt cinsinden dosya boyutunu okunabilir formata dönüştürür."""
        if not size_bytes or size_bytes <= 0:
            return "0 B"
        units = ["B", "KB", "MB", "GB"]
        size = float(size_bytes)
        unit_idx = 0
        while size >= 1024.0 and unit_idx < len(units) - 1:
            size /= 1024.0
            unit_idx += 1
        return f"{size:.1f} {units[unit_idx]}" if unit_idx > 0 else f"{int(size)} B"

    @classmethod
    def format_date(cls, raw_date: Any) -> str:
        """Tarih nesnesi veya metnini Türkçe tarih ve saat formatına dönüştürür."""
        if not raw_date:
            return "Belirtilmemiş"

        months_tr = {
            1: "Ocak", 2: "Şubat", 3: "Mart", 4: "Nisan", 5: "Mayıs", 6: "Haziran",
            7: "Temmuz", 8: "Ağustos", 9: "Eylül", 10: "Ekim", 11: "Kasım", 12: "Aralık"
        }

        if isinstance(raw_date, datetime):
            m_str = months_tr.get(raw_date.month, str(raw_date.month))
            return f"{raw_date.day} {m_str} {raw_date.year} {raw_date.strftime('%H:%M:%S')}"

        date_str = str(raw_date).strip()
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(date_str)
            m_str = months_tr.get(dt.month, str(dt.month))
            return f"{dt.day} {m_str} {dt.year} {dt.strftime('%H:%M:%S')}"
        except Exception:
            return date_str

    @staticmethod
    def _create_empty_email_data(filename: str) -> Dict[str, Any]:
        """Boş veya okunabilir ileti barındırmayan arşiv dosyaları için bilgi nesnesi."""
        return {
            "subject": f"E-Posta Veri Dosyası: {filename}",
            "sender": "Sistem Bildirimi",
            "to": "-",
            "cc": "",
            "bcc": "",
            "date": datetime.now().strftime("%d.%m.%Y %H:%M:%S"),
            "attachments": [],
            "body_html": "",
            "body_text": f"'{filename}' dosyasında görüntülenebilecek e-posta iletisi bulunamadı veya arşiv boş.",
        }

    # =========================================================================
    # Ayrıştırıcı 1: MSG ve OFT (.msg, .oft)
    # =========================================================================
    @classmethod
    def extract_msg_data(cls, input_path: str) -> Dict[str, Any]:
        """
        .msg veya .oft dosyasından üstbilgi, e-posta gövdesi ve ek bilgilerini ayrıştırır.
        Önce extract_msg kütüphanesini kullanır, başarısız olursa Windows Outlook COM'a başvurur.
        """
        in_p = Path(input_path)
        if not in_p.exists():
            raise FileNotFoundError(f"İleti dosyası bulunamadı: {input_path}")

        data: Dict[str, Any] = {
            "subject": "Konusuz İleti",
            "sender": "Bilinmeyen Gönderici",
            "to": "Bilinmeyen Alıcı",
            "cc": "",
            "bcc": "",
            "date": "Belirtilmemiş",
            "attachments": [],
            "body_html": "",
            "body_text": "",
        }

        extracted = False

        # 1. Yöntem: extract_msg (Saf yerel ve hızlı)
        if HAS_EXTRACT_MSG:
            try:
                # openMsg hem MSG hem OFT dosyalarını OLE CFBF düzeyinde destekler
                try:
                    msg = extract_msg.Message(str(in_p))
                except Exception:
                    if hasattr(extract_msg, "openMsg"):
                        msg = extract_msg.openMsg(str(in_p))
                    else:
                        raise
                try:
                    data["subject"] = getattr(msg, "subject", None) or "Konusuz İleti"
                    data["sender"] = getattr(msg, "sender", None) or getattr(msg, "senderEmail", None) or "Bilinmeyen Gönderici"

                    # Alıcı (To)
                    to_val = getattr(msg, "to", None)
                    if not to_val and hasattr(msg, "exists") and msg.exists("__substg1.0_0E04001F"):
                        try:
                            to_val = msg.getStream("__substg1.0_0E04001F").decode("utf-16le")
                        except Exception:
                            pass
                    data["to"] = to_val or "Bilinmeyen Alıcı"

                    # Bilgi (CC)
                    cc_val = getattr(msg, "cc", None)
                    if not cc_val and hasattr(msg, "exists") and msg.exists("__substg1.0_0E03001F"):
                        try:
                            cc_val = msg.getStream("__substg1.0_0E03001F").decode("utf-16le")
                        except Exception:
                            pass
                    data["cc"] = cc_val or ""

                    # Gizli (BCC)
                    bcc_val = getattr(msg, "bcc", None)
                    if not bcc_val and hasattr(msg, "exists") and msg.exists("__substg1.0_0E02001F"):
                        try:
                            bcc_val = msg.getStream("__substg1.0_0E02001F").decode("utf-16le")
                        except Exception:
                            pass
                    data["bcc"] = bcc_val or ""

                    data["date"] = cls.format_date(getattr(msg, "date", None))

                    # Ekler listesi
                    try:
                        if hasattr(msg, "attachments") and msg.attachments:
                            for att in msg.attachments:
                                att_name = (
                                    getattr(att, "longFilename", None)
                                    or getattr(att, "shortFilename", None)
                                    or getattr(att, "name", None)
                                    or "isimsiz_ek"
                                )
                                att_size = 0
                                try:
                                    att_size = getattr(att, "size", 0) or len(getattr(att, "data", b""))
                                except Exception:
                                    pass
                                data["attachments"].append({
                                    "name": str(att_name),
                                    "size_formatted": cls.format_size(att_size)
                                })
                    except Exception:
                        pass

                    # E-Posta Gövdesi (HTML ve Düz Metin)
                    html_raw = getattr(msg, "htmlBody", None)
                    if isinstance(html_raw, bytes):
                        for enc in ("utf-8", "cp1254", "iso-8859-9", "windows-1252", "latin-1"):
                            try:
                                data["body_html"] = html_raw.decode(enc)
                                break
                            except UnicodeDecodeError:
                                continue
                        if not data["body_html"]:
                            data["body_html"] = html_raw.decode("utf-8", errors="replace")
                    elif isinstance(html_raw, str):
                        data["body_html"] = html_raw

                    data["body_text"] = getattr(msg, "body", "") or ""
                    extracted = True
                finally:
                    if hasattr(msg, "close"):
                        msg.close()
            except Exception:
                pass

        # 2. Yöntem: Windows Outlook COM Fallback
        if not extracted and HAS_WIN32COM and sys.platform == "win32":
            try:
                pythoncom.CoInitialize()
                try:
                    outlook = win32com.client.Dispatch("Outlook.Application")
                    abs_path = os.path.abspath(input_path)
                    if in_p.suffix.lower() == ".oft":
                        item = outlook.CreateItemFromTemplate(abs_path)
                    else:
                        item = outlook.Session.OpenSharedItem(abs_path)

                    data["subject"] = getattr(item, "Subject", "Konusuz İleti") or "Konusuz İleti"
                    data["sender"] = getattr(item, "SenderName", "") or getattr(item, "SenderEmailAddress", "") or "Bilinmeyen Gönderici"
                    data["to"] = getattr(item, "To", "") or "Bilinmeyen Alıcı"
                    data["cc"] = getattr(item, "CC", "") or ""
                    data["bcc"] = getattr(item, "BCC", "") or ""
                    data["date"] = cls.format_date(getattr(item, "SentOn", ""))

                    # Ekler
                    att_count = getattr(getattr(item, "Attachments", None), "Count", 0)
                    for idx in range(1, att_count + 1):
                        att = item.Attachments.Item(idx)
                        att_name = getattr(att, "FileName", f"ek_{idx}")
                        att_size = getattr(att, "Size", 0)
                        data["attachments"].append({
                            "name": att_name,
                            "size_formatted": cls.format_size(att_size)
                        })

                    data["body_html"] = getattr(item, "HTMLBody", "") or ""
                    data["body_text"] = getattr(item, "Body", "") or ""
                    extracted = True
                finally:
                    pythoncom.CoUninitialize()
            except Exception:
                pass

        if not extracted and not data["body_text"] and not data["body_html"]:
            raise RuntimeError(f"İleti dosyası açılamadı veya desteklenmeyen format: {input_path}")

        return data

    # =========================================================================
    # Ayrıştırıcı 2: EML (.eml - RFC 822 / MIME)
    # =========================================================================
    @classmethod
    def _parse_email_message(cls, msg: Any) -> Dict[str, Any]:
        """email.message.EmailMessage veya mailbox.mboxMessage nesnesini standart sözlüğe dönüştürür."""
        subject = str(msg.get("Subject") or "Konusuz İleti")
        sender = str(msg.get("From") or "Bilinmeyen Gönderici")
        to_val = str(msg.get("To") or "Bilinmeyen Alıcı")
        cc_val = str(msg.get("Cc") or "")
        bcc_val = str(msg.get("Bcc") or "")
        date_raw = msg.get("Date")
        date_str = cls.format_date(date_raw)

        attachments: List[Dict[str, str]] = []
        body_html = ""
        body_text = ""

        # Gövdeyi al (HTML tercih edilir)
        try:
            body_part = msg.get_body(preferencelist=("html", "plain"))
            if body_part:
                content_type = body_part.get_content_type()
                try:
                    content = body_part.get_content()
                except Exception:
                    payload = body_part.get_payload(decode=True)
                    charset = body_part.get_content_charset() or "utf-8"
                    content = payload.decode(charset, errors="replace") if payload else ""

                if content_type == "text/html":
                    body_html = str(content)
                else:
                    body_text = str(content)
        except Exception:
            pass

        # Ekler ve alternatif gövde taraması
        try:
            for part in msg.walk():
                ctype = part.get_content_type()
                # Gövde henüz bulunamadıysa
                if not body_html and not body_text:
                    if ctype == "text/html":
                        try:
                            body_html = str(part.get_content())
                        except Exception:
                            p = part.get_payload(decode=True)
                            body_html = p.decode("utf-8", errors="replace") if p else ""
                    elif ctype == "text/plain":
                        try:
                            body_text = str(part.get_content())
                        except Exception:
                            p = part.get_payload(decode=True)
                            body_text = p.decode("utf-8", errors="replace") if p else ""

                disposition = str(part.get_content_disposition() or "").lower()
                fname = part.get_filename()
                if fname or disposition == "attachment":
                    att_name = fname or "ek_dosya"
                    att_size = 0
                    try:
                        content = part.get_content()
                        att_size = len(content) if isinstance(content, (bytes, str)) else 0
                    except Exception:
                        p = part.get_payload(decode=True)
                        att_size = len(p) if p else 0
                    attachments.append({
                        "name": str(att_name),
                        "size_formatted": cls.format_size(att_size)
                    })
        except Exception:
            pass

        return {
            "subject": subject,
            "sender": sender,
            "to": to_val,
            "cc": cc_val,
            "bcc": bcc_val,
            "date": date_str,
            "attachments": attachments,
            "body_html": body_html,
            "body_text": body_text,
        }

    @classmethod
    def extract_eml_data(cls, input_path: str) -> Dict[str, Any]:
        """
        .eml dosyasından üstbilgi, e-posta gövdesi ve ek bilgilerini ayrıştırır.
        Standart Python 'email' kütüphanesini kullanır (%100 yerel, harici bağımlılık yok).
        """
        in_p = Path(input_path)
        if not in_p.exists():
            raise FileNotFoundError(f"EML dosyası bulunamadı: {input_path}")

        with open(str(in_p), "rb") as f:
            msg = email.message_from_binary_file(f, policy=policy.default)

        return cls._parse_email_message(msg)

    # =========================================================================
    # Ayrıştırıcı 3: MBOX (.mbox)
    # =========================================================================
    @classmethod
    def extract_mbox_data(cls, input_path: str) -> List[Dict[str, Any]]:
        """
        .mbox arşiv dosyasından tüm iletileri sırayla ayrıştırır.
        """
        in_p = Path(input_path)
        if not in_p.exists():
            raise FileNotFoundError(f"MBOX dosyası bulunamadı: {input_path}")

        results: List[Dict[str, Any]] = []
        mbox = mailbox.mbox(
            str(in_p),
            factory=lambda f: email.message_from_binary_file(f, policy=policy.default)
        )
        try:
            for msg in mbox:
                try:
                    data = cls._parse_email_message(msg)
                    results.append(data)
                except Exception:
                    pass
        finally:
            mbox.close()

        return results

    # =========================================================================
    # Ayrıştırıcı 4: PST ve OST (.pst, .ost)
    # =========================================================================
    @classmethod
    def _extract_pypff_message(cls, msg: Any) -> Optional[Dict[str, Any]]:
        """pypff.message nesnesinden üstbilgi, e-posta gövdesi ve ekleri ayrıştırır."""
        try:
            subject = getattr(msg, "get_subject", lambda: None)() or getattr(msg, "subject", None) or "Konusuz İleti"
            sender = getattr(msg, "get_sender_name", lambda: None)() or getattr(msg, "sender_name", None) or "Bilinmeyen Gönderici"

            date_str = "Belirtilmemiş"
            try:
                raw_dt = (
                    getattr(msg, "get_delivery_time", lambda: None)()
                    or getattr(msg, "get_client_submit_time", lambda: None)()
                )
                if raw_dt:
                    date_str = cls.format_date(raw_dt)
            except Exception:
                pass

            to_val = ""
            cc_val = ""
            bcc_val = ""

            # Taşıma üstbilgileri varsa To, CC, BCC ve tarih bilgilerini buradan al
            try:
                headers = getattr(msg, "get_transport_headers", lambda: None)()
                if headers:
                    hdr_msg = email.message_from_string(headers, policy=policy.default)
                    to_val = str(hdr_msg.get("To") or "")
                    cc_val = str(hdr_msg.get("Cc") or "")
                    bcc_val = str(hdr_msg.get("Bcc") or "")
                    if date_str == "Belirtilmemiş" and hdr_msg.get("Date"):
                        date_str = cls.format_date(hdr_msg.get("Date"))
                    if (not sender or sender == "Bilinmeyen Gönderici") and hdr_msg.get("From"):
                        sender = str(hdr_msg.get("From"))
            except Exception:
                pass

            # Gövde (Önce HTML, sonra Düz Metin)
            body_html = ""
            body_text = ""
            try:
                raw_html = getattr(msg, "get_html_body", lambda: None)()
                if raw_html:
                    if isinstance(raw_html, bytes):
                        for enc in ("utf-8", "cp1254", "iso-8859-9", "windows-1252", "latin-1"):
                            try:
                                body_html = raw_html.decode(enc)
                                break
                            except UnicodeDecodeError:
                                continue
                        if not body_html:
                            body_html = raw_html.decode("utf-8", errors="replace")
                    else:
                        body_html = str(raw_html)
            except Exception:
                pass

            if not body_html:
                try:
                    raw_text = getattr(msg, "get_plain_text_body", lambda: None)()
                    if raw_text:
                        if isinstance(raw_text, bytes):
                            body_text = raw_text.decode("utf-8", errors="replace")
                        else:
                            body_text = str(raw_text)
                except Exception:
                    pass

            # Ekler
            attachments = []
            try:
                num_atts = getattr(msg, "get_number_of_attachments", lambda: 0)()
                for a_idx in range(num_atts):
                    att = msg.get_attachment(a_idx)
                    att_name = getattr(att, "get_long_filename", lambda: None)() or f"ek_{a_idx + 1}"
                    att_size = getattr(att, "get_size", lambda: 0)() or 0
                    attachments.append({
                        "name": str(att_name),
                        "size_formatted": cls.format_size(att_size)
                    })
            except Exception:
                pass

            return {
                "subject": subject,
                "sender": sender,
                "to": to_val or "Bilinmeyen Alıcı",
                "cc": cc_val,
                "bcc": bcc_val,
                "date": date_str,
                "attachments": attachments,
                "body_html": body_html,
                "body_text": body_text,
            }
        except Exception:
            return None

    @classmethod
    def extract_pst_ost_data(cls, input_path: str) -> List[Dict[str, Any]]:
        """
        .pst ve .ost Outlook veri dosyalarından tüm iletileri ayrıştırır.
        Önce yerel 'pypff' (libpff-python) kütüphanesini kullanır.
        PST için Windows'ta Outlook COM otomasyonuna başvurabilir.
        """
        in_p = Path(input_path)
        if not in_p.exists():
            raise FileNotFoundError(f"Veri dosyası bulunamadı: {input_path}")

        results: List[Dict[str, Any]] = []

        # 1. Yöntem: pypff (PST ve OST için bağımsız yerel C altyapısı)
        if HAS_PYPFF:
            try:
                pst = pypff.file()
                pst.open(str(in_p))
                try:
                    def walk_pypff_folder(folder):
                        num_msgs = getattr(folder, "get_number_of_sub_messages", lambda: 0)()
                        for i in range(num_msgs):
                            try:
                                msg = folder.get_sub_message(i)
                                data = cls._extract_pypff_message(msg)
                                if data:
                                    results.append(data)
                            except Exception:
                                pass

                        num_sub = getattr(folder, "get_number_of_sub_folders", lambda: 0)()
                        for j in range(num_sub):
                            try:
                                sub = folder.get_sub_folder(j)
                                walk_pypff_folder(sub)
                            except Exception:
                                pass

                    root = pst.get_root_folder()
                    if root:
                        walk_pypff_folder(root)
                finally:
                    pst.close()
            except Exception:
                pass

        # 2. Yöntem: Outlook COM Fallback (Özellikle .pst için)
        if not results and in_p.suffix.lower() == ".pst" and HAS_WIN32COM and sys.platform == "win32":
            try:
                pythoncom.CoInitialize()
                try:
                    outlook = win32com.client.Dispatch("Outlook.Application")
                    namespace = outlook.GetNamespace("MAPI")
                    abs_p = os.path.abspath(str(in_p))
                    namespace.AddStore(abs_p)

                    target_store = None
                    for store in namespace.Stores:
                        try:
                            if os.path.abspath(getattr(store, "FilePath", "")) == abs_p:
                                target_store = store
                                break
                        except Exception:
                            pass

                    if target_store:
                        root_f = target_store.GetRootFolder()

                        def walk_com_folder(f):
                            items = getattr(f, "Items", None)
                            count = getattr(items, "Count", 0) if items else 0
                            for idx in range(1, count + 1):
                                try:
                                    item = items.Item(idx)
                                    data = {
                                        "subject": getattr(item, "Subject", "Konusuz İleti") or "Konusuz İleti",
                                        "sender": getattr(item, "SenderName", "") or getattr(item, "SenderEmailAddress", "") or "Bilinmeyen Gönderici",
                                        "to": getattr(item, "To", "") or "Bilinmeyen Alıcı",
                                        "cc": getattr(item, "CC", "") or "",
                                        "bcc": getattr(item, "BCC", "") or "",
                                        "date": cls.format_date(getattr(item, "SentOn", "")),
                                        "attachments": [],
                                        "body_html": getattr(item, "HTMLBody", "") or "",
                                        "body_text": getattr(item, "Body", "") or "",
                                    }
                                    att_count = getattr(getattr(item, "Attachments", None), "Count", 0)
                                    for a_idx in range(1, att_count + 1):
                                        att = item.Attachments.Item(a_idx)
                                        data["attachments"].append({
                                            "name": getattr(att, "FileName", f"ek_{a_idx}"),
                                            "size_formatted": cls.format_size(getattr(att, "Size", 0))
                                        })
                                    results.append(data)
                                except Exception:
                                    pass

                            folders = getattr(f, "Folders", None)
                            f_count = getattr(folders, "Count", 0) if folders else 0
                            for sub_idx in range(1, f_count + 1):
                                try:
                                    walk_com_folder(folders.Item(sub_idx))
                                except Exception:
                                    pass

                        walk_com_folder(root_f)
                        namespace.RemoveStore(root_f)
                finally:
                    pythoncom.CoUninitialize()
            except Exception:
                pass

        return results

    # =========================================================================
    # Genel İleti Ayrıştırma Dağıtıcısı (Dispatcher)
    # =========================================================================
    @classmethod
    def extract_any_email_data(cls, input_path: str) -> List[Dict[str, Any]]:
        """
        Dosya uzantısına göre (.msg, .eml, .pst, .ost, .mbox, .oft)
        doğru ayrıştırıcıyı çağırır ve ileti listesi döndürür.
        """
        in_p = Path(input_path)
        suffix = in_p.suffix.lower()

        if suffix in (".msg", ".oft"):
            return [cls.extract_msg_data(input_path)]
        elif suffix == ".eml":
            return [cls.extract_eml_data(input_path)]
        elif suffix == ".mbox":
            messages = cls.extract_mbox_data(input_path)
            return messages if messages else [cls._create_empty_email_data(in_p.name)]
        elif suffix in (".pst", ".ost"):
            messages = cls.extract_pst_ost_data(input_path)
            return messages if messages else [cls._create_empty_email_data(in_p.name)]
        else:
            raise ValueError(f"Desteklenmeyen e-posta formatı: {suffix}")

    # =========================================================================
    # Adli Delil HTML Üretimi
    # =========================================================================
    @classmethod
    def _build_single_email_section(cls, msg_data: Dict[str, Any], email_index: int = 0) -> str:
        """Tek bir ileti için üstbilgi zarfı ve gövde HTML içeriğini üretir."""
        subject = html.escape(msg_data.get("subject") or "Konusuz İleti")
        sender = html.escape(msg_data.get("sender") or "Bilinmeyen Gönderici")
        to_recipients = html.escape(msg_data.get("to") or "Bilinmeyen Alıcı")
        cc_recipients = html.escape(msg_data.get("cc") or "")
        bcc_recipients = html.escape(msg_data.get("bcc") or "")
        date_str = html.escape(msg_data.get("date") or "Belirtilmemiş")
        attachments = msg_data.get("attachments") or []

        # Ekler satırı
        attach_html = ""
        if attachments:
            attach_items = [
                f"<span style='display:inline-block; margin-right:8px; margin-bottom:4px; padding:2px 6px; background:#E2E8F0; border-radius:3px; font-size:9pt; color:#0F172A; border:1px solid #CBD5E1;'>"
                f"📎 <b>{html.escape(att['name'])}</b> ({html.escape(att['size_formatted'])})</span>"
                for att in attachments
            ]
            attach_html = f"""
            <tr>
              <td style="font-weight: bold; width: 95px; padding: 4px 0; color: #475569; vertical-align: top;">Ekler:</td>
              <td style="padding: 4px 0; color: #0F172A;">{' '.join(attach_items)}</td>
            </tr>
            """

        cc_html = ""
        if cc_recipients:
            cc_html = f"""
            <tr>
              <td style="font-weight: bold; width: 95px; padding: 4px 0; color: #475569;">Bilgi (CC):</td>
              <td style="padding: 4px 0; color: #1E293B;">{cc_recipients}</td>
            </tr>
            """

        bcc_html = ""
        if bcc_recipients:
            bcc_html = f"""
            <tr>
              <td style="font-weight: bold; width: 95px; padding: 4px 0; color: #475569;">Gizli (BCC):</td>
              <td style="padding: 4px 0; color: #1E293B;">{bcc_recipients}</td>
            </tr>
            """

        header_box = f"""
        <div style="border: 2px solid #1E3A8A; background-color: #F8FAFC; padding: 14px 18px; margin-bottom: 20px; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #CBD5E1; padding-bottom: 8px; margin-bottom: 12px;">
            <div style="font-size: 13.5pt; font-weight: bold; color: #1E3A8A;">
              {subject}
            </div>
            <div style="font-size: 8.5pt; font-weight: bold; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">
              E-POSTA İLETİ DELİLİ
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; line-height: 1.4;">
            <tr>
              <td style="font-weight: bold; width: 95px; padding: 4px 0; color: #475569;">Kimden:</td>
              <td style="padding: 4px 0; color: #0F172A; font-weight: 600;">{sender}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; width: 95px; padding: 4px 0; color: #475569;">Kime:</td>
              <td style="padding: 4px 0; color: #1E293B;">{to_recipients}</td>
            </tr>
            {cc_html}
            {bcc_html}
            <tr>
              <td style="font-weight: bold; width: 95px; padding: 4px 0; color: #475569;">Tarih:</td>
              <td style="padding: 4px 0; color: #1E293B;">{date_str}</td>
            </tr>
            {attach_html}
          </table>
        </div>
        """

        body_html = msg_data.get("body_html") or ""
        body_text = msg_data.get("body_text") or ""

        if body_html:
            # HTML gövdesi içindeki body taglarını temizle
            m = re.search(r"<body[^>]*>(.*?)</body>", body_html, re.IGNORECASE | re.DOTALL)
            clean_body = m.group(1) if m else body_html
            content_section = f'<div class="email-body">{clean_body}</div>'
        elif body_text:
            escaped_text = html.escape(body_text)
            content_section = f'<div class="email-text" style="white-space: pre-wrap; word-wrap: break-word; line-height: 1.6; font-family: \'Segoe UI\', Tahoma, Arial, sans-serif; font-size: 10pt; color: #1E293B;">{escaped_text}</div>'
        else:
            content_section = '<p style="font-style: italic; color: #64748B;">(İleti içeriği boş veya metin içermiyor)</p>'

        return f'<div class="email-item">\n{header_box}\n{content_section}\n</div>'

    @classmethod
    def build_emails_html(cls, messages_data: List[Dict[str, Any]]) -> str:
        """
        Bir veya daha fazla iletiden adli delil standartlarına uygun tam bir HTML belgesi üretir.
        Birden çok ileti varsa her biri arasında sayfa sonu (page-break-before) oluşturur.
        """
        if not messages_data:
            messages_data = [cls._create_empty_email_data("bilinmeyen")]

        sections = []
        for idx, m_data in enumerate(messages_data):
            sec = cls._build_single_email_section(m_data, email_index=idx)
            if idx > 0:
                # Sayfa sonu kırma çizgisi
                sections.append(
                    f'<div style="page-break-before: always; height: 1px; margin-top: 24px;"></div>\n{sec}'
                )
            else:
                sections.append(sec)

        joined_content = "\n".join(sections)

        return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page {{
  size: A4;
  margin: 15mm;
}}
body {{
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 10.5pt;
  color: #0F172A;
  margin: 0;
  line-height: 1.5;
}}
.email-body table {{
  max-width: 100%;
  border-collapse: collapse;
}}
img {{
  max-width: 100%;
  height: auto;
}}
</style>
</head>
<body>
{joined_content}
</body>
</html>"""

    @classmethod
    def build_email_html(cls, msg_data: Dict[str, Any]) -> str:
        """Tek bir ileti için geriye uyumlu HTML üretim arayüzü."""
        return cls.build_emails_html([msg_data])

    # =========================================================================
    # Kademeli PDF Dönüştürme Motorları (Tiers 1-4)
    # =========================================================================
    @classmethod
    def _convert_via_pyside6(cls, html_content: str, output_path: str) -> bool:
        """Tier 1: PySide6 QTextDocument + QPdfWriter (300 DPI Vektör)."""
        if not HAS_PYSIDE_PDF:
            return False

        try:
            app = QApplication.instance()
            if not app:
                app = QApplication(sys.argv if sys.argv else ["paralegal"])

            doc = QTextDocument()
            doc.setHtml(html_content)

            writer = QPdfWriter(output_path)
            writer.setPageSize(QPageSize(QPageSize.A4))
            writer.setResolution(300)
            writer.setPageMargins(QMarginsF(15, 15, 15, 15), QPageLayout.Millimeter)

            doc.print_(writer)

            return os.path.exists(output_path) and os.path.getsize(output_path) > 0
        except Exception:
            return False

    @classmethod
    def _convert_via_word_com(cls, html_content: str, output_path: str) -> bool:
        """Tier 2: Microsoft Word COM otomasyonu."""
        if sys.platform != "win32" or not HAS_WIN32COM:
            return False

        temp_html = None
        word_app = None
        doc = None
        try:
            pythoncom.CoInitialize()
            with tempfile.NamedTemporaryFile("w", suffix=".html", encoding="utf-8", delete=False) as f:
                f.write(html_content)
                temp_html = f.name

            word_app = win32com.client.Dispatch("Word.Application")
            word_app.Visible = False
            word_app.DisplayAlerts = 0

            doc = word_app.Documents.Open(
                FileName=os.path.abspath(temp_html),
                ReadOnly=True,
                ConfirmConversions=False,
                Visible=False
            )

            doc.SaveAs(os.path.abspath(output_path), FileFormat=17) # 17 = WD_FORMAT_PDF
            return os.path.exists(output_path) and os.path.getsize(output_path) > 0
        except Exception:
            return False
        finally:
            if doc is not None:
                try:
                    doc.Close(SaveChanges=0)
                except Exception:
                    pass
            if word_app is not None:
                try:
                    word_app.Quit()
                except Exception:
                    pass
            if temp_html and os.path.exists(temp_html):
                try:
                    os.remove(temp_html)
                except Exception:
                    pass
            try:
                pythoncom.CoUninitialize()
            except Exception:
                pass

    @classmethod
    def _convert_via_libreoffice(cls, html_content: str, output_path: str) -> bool:
        """Tier 3: LibreOffice Headless (soffice)."""
        from core.word_converter import WordConverter
        soffice = WordConverter.find_libreoffice()
        if not soffice:
            return False

        temp_dir = tempfile.mkdtemp(prefix="paralegal_msg_lo_")
        temp_html = os.path.join(temp_dir, "email_doc.html")
        try:
            with open(temp_html, "w", encoding="utf-8") as f:
                f.write(html_content)

            cmd = [
                soffice,
                "--headless",
                "--convert-to", "pdf",
                "--outdir", temp_dir,
                temp_html
            ]

            startupinfo = None
            if sys.platform == "win32":
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startupinfo.wShowWindow = subprocess.SW_HIDE

            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=45, startupinfo=startupinfo)
            lo_pdf = os.path.join(temp_dir, "email_doc.pdf")
            if res.returncode == 0 and os.path.exists(lo_pdf) and os.path.getsize(lo_pdf) > 0:
                shutil.copy2(lo_pdf, output_path)
                return True
            return False
        except Exception:
            return False
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    @classmethod
    def _convert_via_reportlab(cls, messages_input: Union[Dict[str, Any], List[Dict[str, Any]]], output_path: str) -> bool:
        """Tier 4: ReportLab Saf Python Kurtarma Motoru (Çoklu İleti ve PageBreak destekli)."""
        if not HAS_REPORTLAB:
            return False

        messages: List[Dict[str, Any]] = [messages_input] if isinstance(messages_input, dict) else messages_input

        try:
            doc = SimpleDocTemplate(
                output_path,
                pagesize=A4,
                leftMargin=36,
                rightMargin=36,
                topMargin=36,
                bottomMargin=36
            )

            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                "MsgTitle",
                parent=styles["Heading2"],
                fontName="Helvetica-Bold",
                fontSize=13,
                leading=17,
                textColor=colors.HexColor("#1E3A8A")
            )
            hdr_style = ParagraphStyle(
                "MsgHeader",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=9.5,
                leading=13,
                textColor=colors.HexColor("#1E293B")
            )
            body_style = ParagraphStyle(
                "MsgBody",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=10,
                leading=14,
                textColor=colors.HexColor("#0F172A")
            )

            elements = []

            for m_idx, msg_data in enumerate(messages):
                if m_idx > 0:
                    elements.append(PageBreak())

                # Konu Başlığı
                subject_text = html.escape(msg_data.get("subject") or "Konusuz İleti")
                elements.append(Paragraph(f"<b>{subject_text}</b>", title_style))
                elements.append(Spacer(1, 8))

                # Üstbilgi Tablosu
                table_rows = [
                    [Paragraph("<b>Kimden:</b>", hdr_style), Paragraph(html.escape(msg_data.get("sender") or "-"), hdr_style)],
                    [Paragraph("<b>Kime:</b>", hdr_style), Paragraph(html.escape(msg_data.get("to") or "-"), hdr_style)],
                ]

                if msg_data.get("cc"):
                    table_rows.append([Paragraph("<b>Bilgi (CC):</b>", hdr_style), Paragraph(html.escape(msg_data.get("cc")), hdr_style)])
                if msg_data.get("bcc"):
                    table_rows.append([Paragraph("<b>Gizli (BCC):</b>", hdr_style), Paragraph(html.escape(msg_data.get("bcc")), hdr_style)])

                table_rows.append([Paragraph("<b>Tarih:</b>", hdr_style), Paragraph(html.escape(msg_data.get("date") or "-"), hdr_style)])

                if msg_data.get("attachments"):
                    att_names = ", ".join([f"{a['name']} ({a['size_formatted']})" for a in msg_data["attachments"]])
                    table_rows.append([Paragraph("<b>Ekler:</b>", hdr_style), Paragraph(html.escape(att_names), hdr_style)])

                t = Table(table_rows, colWidths=[75, 445])
                t.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                    ("BOX", (0, 0), (-1, -1), 1.5, colors.HexColor("#1E3A8A")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                elements.append(t)
                elements.append(Spacer(1, 14))

                # Gövde Metni
                raw_body = msg_data.get("body_text") or ""
                if not raw_body and msg_data.get("body_html"):
                    raw_body = re.sub(r"<[^>]+>", " ", msg_data["body_html"])

                for line in (raw_body or "İçerik bulunamadı.").splitlines():
                    clean_l = line.strip()
                    if clean_l:
                        elements.append(Paragraph(html.escape(clean_l), body_style))
                    else:
                        elements.append(Spacer(1, 6))

            doc.build(elements)
            return os.path.exists(output_path) and os.path.getsize(output_path) > 0
        except Exception:
            return False

    # =========================================================================
    # Ana Dönüştürme Yordamı (convert_msg_to_pdf)
    # =========================================================================
    @classmethod
    def convert_msg_to_pdf(
        cls,
        input_path: str,
        output_path: Optional[str] = None,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> str:
        """
        Desteklenen e-posta dosyalarını (.msg, .eml, .pst, .ost, .mbox, .oft)
        kademeli mimariyle UYAP uyumlu PDF'e dönüştürür.
        """
        in_p = Path(input_path)
        if not in_p.exists():
            raise FileNotFoundError(f"Girdi dosyası bulunamadı: {input_path}")

        if not cls.is_supported(str(in_p)):
            raise ValueError(f"Desteklenmeyen dosya formatı: {in_p.suffix}")

        if output_path is None:
            output_path = str(in_p.with_suffix(".pdf"))
        else:
            out_dir = os.path.dirname(output_path)
            if out_dir:
                os.makedirs(out_dir, exist_ok=True)

        if progress_callback:
            progress_callback(1, 3, "İleti üstbilgileri ve gövdesi ayrıştırılıyor...")

        # 1. Adım: Verileri ayrıştır
        messages_data = cls.extract_any_email_data(str(in_p))

        # 2. Adım: Şık ve standart adli HTML oluştur
        html_doc = cls.build_emails_html(messages_data)

        if progress_callback:
            progress_callback(2, 3, "PDF belgesi üretiliyor...")

        # 3. Adım: Kademeli motor ile PDF'e dönüştür
        success = False

        # Tier 1: PySide6 (En yüksek doğruluk ve bağımsızlık)
        success = cls._convert_via_pyside6(html_doc, output_path)

        # Tier 2: MS Word COM
        if not success:
            success = cls._convert_via_word_com(html_doc, output_path)

        # Tier 3: LibreOffice Headless
        if not success:
            success = cls._convert_via_libreoffice(html_doc, output_path)

        # Tier 4: ReportLab Saf Python
        if not success:
            success = cls._convert_via_reportlab(messages_data, output_path)

        if not success or not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise RuntimeError(f"E-Posta dosyası PDF'e dönüştürülemedi: {input_path}")

        # 4. Adım: UYAP 10 MB Otomatik Koruma
        try:
            from core.redactor import PDFRedactor
            PDFRedactor.optimize_for_uyap_if_needed(output_path)
        except Exception:
            pass

        if progress_callback:
            progress_callback(3, 3, "Dönüştürme başarıyla tamamlandı.")

        return output_path


# Geriye dönük uyumluluk ve genişletilmiş kullanım için takma adlar
convert_email_to_pdf = MsgConverter.convert_msg_to_pdf
EmailConverter = MsgConverter
