"""
Paralegal - Test ve Örnek Dosya Üretici
Avukatın programı hemen test edebilmesi için gerçekçi dava dilekçesi (PDF)
ve çok sayfalı taranmış delil (TIFF) üretir.
"""

import os
from pathlib import Path
from PIL import Image, ImageDraw
import pymupdf as fitz

SAMPLES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ornekler")
os.makedirs(SAMPLES_DIR, exist_ok=True)


def create_sample_pdf():
    """Gerçekçi bir Asliye Hukuk Dava Dilekçesi PDF'i üretir."""
    pdf_path = os.path.join(SAMPLES_DIR, "ornek_dava_dilekcesi.pdf")
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # A4

    text = """İSTANBUL 4. ASLİYE HUKUK MAHKEMESİ HAKİMLİĞİ'NE

ESAS NO         : 2024/1102 Esas

DAVACI          : Ahmet Yılmaz (T.C. Kimlik No: 10000000146)
VEKİLİ          : Av. Mehmet Demir
                 Barbaros Bulvarı No:42 Beşiktaş / İSTANBUL
                 Tel: 0532 555 44 33 - E-posta: av.mehmet@ornekavukatlik.com

DAVALI          : Canan Kaya (T.C. Kimlik No: 20000000062)
                 Bağdat Caddesi No:120 Kadıköy / İSTANBUL
                 Araç Plakası: 34 ABC 789

İHBAR OLUNAN    : Tasfiye Halinde Yıldız Lojistik A.Ş.
                 Levent Mah. Büyükdere Cad. No:88 Beşiktaş / İSTANBUL

KONU            : Alacak ve Maddi Tazminat Talebidir. (Dava Değeri: 150.000,00 TL)

AÇIKLAMALAR     :
1. Müvekkil Ahmet Yılmaz ile davalı Canan Kaya arasında 15.01.2025 tarihinde sözleşme imzalanmıştır.
2. Davalı tarafça yapılması gereken 150.000 TL tutarındaki bakiye ödeme müvekkilin TR33 0006 1005 1978 6451 0000 01 numaralı banka hesabına gönderilmemiştir.
3. Ayrıca ihbar olunan Tasfiye Halinde Yıldız Lojistik A.Ş. bünyesinde bulunan 34 ABC 789 plakalı araç üzerine ihtiyati haciz konulmasını talep etme zorunluluğu doğmuştur.
4. Borçlu Canan Kaya ile yapılan görüşmeler neticesiz kalmıştır.

DELİLLER        : 2024/1102 Esas sayılı dosya evrakları, banka dekontları, sözleşme sureti, tanık beyanları.
HUKUKİ SEBEPLER : HMK, TBK ve ilgili mevzuat.

NETİCE VE TALEP : 
Yukarıda arz ve izah edilen nedenlerle;
1. Davamızın KABULÜ ile 150.000,00 TL alacağın tahsiline,
2. Yargılama giderleri ve vekalet ücretinin davalıya tahmiline karar verilmesini saygıyla talep ederim. 19.10.2026

                                                        Davacı Vekili
                                                     Av. Mehmet Demir
                                                          (e-imzalıdır)
"""
    page.insert_textbox(fitz.Rect(50, 50, 545, 800), text, fontsize=10, fontname="helv")
    doc.save(pdf_path)
    doc.close()
    return pdf_path


def create_sample_tiff():
    """Çok sayfalı taranmış delil TIFF dosyası üretir."""
    tiff_path = os.path.join(SAMPLES_DIR, "ornek_taranmis_delil.tiff")
    
    img1 = Image.new("RGB", (1240, 1754), color=(250, 250, 250))
    d1 = ImageDraw.Draw(img1)
    d1.rectangle([(40, 40), (1200, 1714)], outline=(180, 180, 180), width=3)
    d1.text((80, 100), "DELIL NO 1: BANKA HESAP VE MAKBUZ SURETI", fill=(20, 20, 20))
    d1.text((80, 160), "Gonderen: Ahmet Yilmaz - TC: 10000000146", fill=(40, 40, 40))
    d1.text((80, 220), "Alici IBAN: TR33 0006 1005 1978 6451 0000 01", fill=(40, 40, 40))
    d1.text((80, 280), "Tutar: 75.000 TL - Tarih: 12.02.2025", fill=(40, 40, 40))

    img2 = Image.new("RGB", (1240, 1754), color=(252, 252, 252))
    d2 = ImageDraw.Draw(img2)
    d2.rectangle([(40, 40), (1200, 1714)], outline=(180, 180, 180), width=3)
    d2.text((80, 100), "DELIL NO 2: PROTOKOL VE TESLIM TUTANAGI", fill=(20, 20, 20))
    d2.text((80, 160), "Ilgili Arac: 34 ABC 789 - Muayene Teslim Tutanagi", fill=(40, 40, 40))
    d2.text((80, 220), "Yetkili Iletisim: 0532 555 44 33", fill=(40, 40, 40))

    img1.save(
        tiff_path,
        "TIFF",
        save_all=True,
        append_images=[img2],
        compression="tiff_deflate"
    )
    return tiff_path


if __name__ == "__main__":
    p1 = create_sample_pdf()
    p2 = create_sample_tiff()
    print(f"Örnek dosyalar üretildi:\n1: {p1}\n2: {p2}")
