"""
Paralegal - High-Fidelity Excel to UYAP PDF Converter Module
%100 Yerel, Sıfır İnternet, Sıfır Telemetri.

Desteklenen formatlar: .xlsx, .xls (İşçilik hesapları, faiz tabloları, banka ekstreleri, icra hesap föyleri).
Adli Hukuk İhtiyaçları:
1. Akıllı Yönlendirme (Smart Orientation): 6'dan fazla sütun içeren tablolarda otomatik Yatay (Landscape - A4-Y).
2. Sütun Bölünmesini Önleme (Fit All Columns to One Page): Sütunlar sağ sayfaya bölünmez, tek yatay sayfaya sığdırılır.
3. Yinelenen Başlık Satırları (Repeat Header Row): Çok sayfalı dökümlerde sütun başlıkları her sayfa başında tekrarlanır.
4. Hibrit / Kademeli Mimari (Cascading Pipeline):
   - Öncelik 1: LibreOffice Headless (Tam aslına uygun hücre biçimleri, renkler ve formüller).
   - Öncelik 2: Saf Python ReportLab (Harici ofis programı bulunmadığında sıfır bağımlılıklı kurtarma motoru).
"""

import os
import sys
import shutil
import tempfile
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, List, Callable

try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape as rl_landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False


class ExcelConverter:
    """Excel (.xlsx, .xls) tablolarını aslına uygun ve UYAP uyumlu PDF'e dönüştüren motor."""

    SUPPORTED_EXTENSIONS = {".xlsx", ".xls"}

    @classmethod
    def is_supported(cls, file_path: str) -> bool:
        """Dosyanın desteklenen bir Excel formatı olup olmadığını denetler."""
        return Path(file_path).suffix.lower() in cls.SUPPORTED_EXTENSIONS

    @classmethod
    def find_libreoffice(cls) -> Optional[str]:
        """Sistemde kurulu LibreOffice (soffice) çalıştırılabilir dosyasını bulur."""
        # 1. PATH kontrolü
        for cmd_name in ("soffice", "libreoffice"):
            found = shutil.which(cmd_name)
            if found and os.path.exists(found):
                return found

        # 2. Windows Standart Kurulum Yolları
        windows_paths = [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
            r"C:\Program Files\LibreOffice\program\soffice.com",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\LibreOffice\program\soffice.exe"),
        ]
        for p in windows_paths:
            if os.path.exists(p):
                return p

        return None

    @classmethod
    def analyze_excel(cls, file_path: str) -> Dict[str, Any]:
        """
        Excel dosyasını tarayarak sayfa sayısı, sütun genişliği ve
        önerilen sayfa yönlendirmesi (Yatay vs. Dikey) bilgisini döndürür.
        """
        in_p = Path(file_path)
        if not in_p.exists():
            raise FileNotFoundError(f"Excel dosyası bulunamadı: {file_path}")

        max_cols = 1
        max_rows = 1
        sheet_names = []

        if in_p.suffix.lower() == ".xlsx" and HAS_OPENPYXL:
            try:
                wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
                sheet_names = wb.sheetnames
                for name in sheet_names:
                    ws = wb[name]
                    if ws.max_column and ws.max_column > max_cols:
                        max_cols = ws.max_column
                    if ws.max_row and ws.max_row > max_rows:
                        max_rows = ws.max_row
                wb.close()
            except Exception:
                # Bozuk veya şifreli dosya durumunda varsayılanlar
                pass

        # Hukuki Sezgisellik: 6'dan fazla sütun varsa Yatay (Landscape) önerilir
        recommended = "landscape" if max_cols >= 6 else "portrait"

        return {
            "path": str(in_p),
            "filename": in_p.name,
            "sheets": sheet_names,
            "max_columns": max_cols,
            "max_rows": max_rows,
            "recommended_orientation": recommended,
            "libreoffice_available": cls.find_libreoffice() is not None,
        }

    @classmethod
    def convert_excel_to_pdf(
        cls,
        input_path: str,
        output_path: Optional[str] = None,
        orientation: str = "auto",
        fit_width: bool = True,
        repeat_header: bool = True,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> str:
        """
        Excel dosyasını UYAP standartlarında aslına uygun PDF'e dönüştürür.

        Args:
            input_path: Kaynak Excel dosyası (.xlsx veya .xls).
            output_path: Çıktı PDF dosya yolu (None ise kaynak dosya yanına .pdf olarak yazar).
            orientation: 'auto' (akıllı algılama), 'landscape' (yatay) veya 'portrait' (dikey).
            fit_width: Sütunların tek sayfaya sığdırılması (sütun bölünmesini engeller).
            repeat_header: Çok sayfalı tablolarda başlık satırını her sayfada yineleme.
            progress_callback: İlerleme bildirimi (mevcut, toplam, mesaj).

        Returns:
            Üretilen geçerli PDF dosyasının mutlak yolu.
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
            progress_callback(1, 4, "Excel yapısı inceleniyor ve sayfa ayarları optimize ediliyor...")

        # Yönlendirme belirle
        chosen_orientation = orientation.lower()
        if chosen_orientation == "auto":
            analysis = cls.analyze_excel(input_path)
            chosen_orientation = analysis.get("recommended_orientation", "landscape")

        soffice_bin = cls.find_libreoffice()

        # 1. YÖNTEM: LibreOffice Headless (En Yüksek Aslına Uygunluk)
        if soffice_bin:
            try:
                if progress_callback:
                    progress_callback(2, 4, "LibreOffice motoru ile sayfa yerleşimi yapılandırılıyor...")

                temp_to_convert = str(in_p)
                temp_dir = tempfile.mkdtemp(prefix="paralegal_excel_")

                # Eğer .xlsx ise openpyxl ile baskı parametrelerini (Landscape + Fit to Width) göm
                if in_p.suffix.lower() == ".xlsx" and HAS_OPENPYXL:
                    try:
                        wb = openpyxl.load_workbook(str(in_p))
                        for ws in wb.worksheets:
                            # A4 Kağıt Standardı
                            ws.page_setup.paperSize = ws.PAPERSIZE_A4

                            # Yönlendirme
                            if chosen_orientation == "landscape":
                                ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
                            else:
                                ws.page_setup.orientation = ws.ORIENTATION_PORTRAIT

                            # Sütunları Tek Sayfaya Sığdırma (Fit All Columns to Page Width)
                            if fit_width:
                                ws.sheet_properties.pageSetUpPr.fitToPage = True
                                ws.page_setup.fitToWidth = 1
                                ws.page_setup.fitToHeight = 0  # Dikeyde serbest aksın

                            # Başlık Satırını Yineleme
                            if repeat_header and ws.max_row > 1:
                                ws.print_title_rows = "1:1"

                        tuned_xlsx = os.path.join(temp_dir, in_p.name)
                        wb.save(tuned_xlsx)
                        wb.close()
                        temp_to_convert = tuned_xlsx
                    except Exception:
                        temp_to_convert = str(in_p)

                if progress_callback:
                    progress_callback(3, 4, "PDF çıktısı oluşturuluyor ve yazı tipleri gömülüyor...")

                cmd = [
                    soffice_bin,
                    "--headless",
                    "--convert-to",
                    "pdf",
                    temp_to_convert,
                    "--outdir",
                    temp_dir,
                ]

                # Windows'ta konsol penceresi açılmasını engelle
                creationflags = 0
                if sys.platform == "win32":
                    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)

                proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=60,
                    creationflags=creationflags,
                )

                gen_pdf = os.path.join(temp_dir, Path(temp_to_convert).stem + ".pdf")
                if os.path.exists(gen_pdf):
                    shutil.move(gen_pdf, output_path)
                    try:
                        shutil.rmtree(temp_dir, ignore_errors=True)
                    except Exception:
                        pass

                    if progress_callback:
                        progress_callback(4, 4, "Dönüştürme başarıyla tamamlandı.")

                    # UYAP 10 MB Dosya Boyutu Koruması
                    try:
                        from core.redactor import PDFRedactor
                        PDFRedactor.optimize_for_uyap_if_needed(output_path)
                    except Exception:
                        pass

                    return output_path

            except Exception as e:
                # LibreOffice başarısız olursa Python fallback'e geç
                pass

        # 2. YÖNTEM: Saf Python ReportLab & OpenPyXL Kurtarma Motoru (Fallback)
        if HAS_OPENPYXL and HAS_REPORTLAB and in_p.suffix.lower() == ".xlsx":
            if progress_callback:
                progress_callback(3, 4, "Yerel Python kurtarma motoru ile PDF çiziliyor...")
            return cls._convert_via_reportlab(
                input_path=str(in_p),
                output_path=output_path,
                orientation=chosen_orientation,
                fit_width=fit_width,
                repeat_header=repeat_header,
            )

        raise RuntimeError(
            "Excel dönüştürme gerçekleştirilemedi. "
            "Lütfen sisteminizde LibreOffice'in veya gerekli Python paketlerinin (openpyxl, reportlab) kurulu olduğunu doğrulayın."
        )

    @classmethod
    def _convert_via_reportlab(
        cls,
        input_path: str,
        output_path: str,
        orientation: str,
        fit_width: bool,
        repeat_header: bool,
    ) -> str:
        """Harici ofis programı olmadan saf Python ile çalışan A4 tablo PDF üreticisi."""
        wb = openpyxl.load_workbook(input_path, data_only=True)
        ws = wb.active

        raw_data: List[List[str]] = []
        for row in ws.iter_rows(values_only=True):
            if any(cell is not None and str(cell).strip() != "" for cell in row):
                raw_data.append([str(c) if c is not None else "" for c in row])
        wb.close()

        if not raw_data:
            raise RuntimeError("Excel çalışma sayfasında görüntülenecek veri bulunamadı.")

        page_size = rl_landscape(A4) if orientation == "landscape" else A4
        margin = 24.0
        usable_width = page_size[0] - (margin * 2)

        # Sütun genişliklerini hesapla
        col_count = max(len(r) for r in raw_data)
        col_widths = [usable_width / col_count] * col_count if fit_width else None

        styles = getSampleStyleSheet()
        normal_style = ParagraphStyle(
            "CellNormal",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9,
            textColor=colors.HexColor("#121316"),
        )
        header_style = ParagraphStyle(
            "CellHeader",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#F4EFEA"),
        )

        formatted_data = []
        for row_idx, row in enumerate(raw_data):
            row_cells = []
            for cell_val in row:
                st = header_style if row_idx == 0 else normal_style
                row_cells.append(Paragraph(cell_val or " ", st))
            formatted_data.append(row_cells)

        doc = SimpleDocTemplate(
            output_path,
            pagesize=page_size,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin,
        )

        table = Table(
            formatted_data,
            colWidths=col_widths,
            repeatRows=1 if repeat_header else 0,
        )

        table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#121316")),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#121316")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FFFFFF"), colors.HexColor("#F4EFEA")]),
            ])
        )

        doc.build([table])

        # UYAP 10 MB Dosya Boyutu Koruması
        try:
            from core.redactor import PDFRedactor
            PDFRedactor.optimize_for_uyap_if_needed(output_path)
        except Exception:
            pass

        return output_path
