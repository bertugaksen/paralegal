"""
Paralegal - KVKK Sensitive Entity Detector Module (Gelişmiş Adli Hukuk Sürümü v2.1)
UYAP dava, duruşma, karar, tensip zaptı ve icra belgelerindeki:
- Kişi İsimleri (Taraf başlıkları, müdahiller, mirasçılar, hakim/katip, vekiller, metin içi isimler)
- Şirket / Kurum Unvanları (A.Ş., Ltd. Şti., San. ve Tic., Holding, Banka vb.)
- Dosya Numaraları (Esas, Karar, D.İş, Soruşturma, İcra Dosya No vb.)
- TCKN (Algoritma doğrulamalı, boşluklu/noktalı)
- Vergi Kimlik Numarası (VKN - 10 haneli)
- Adres Bilgileri (Mahalle, Cadde, Sokak, No, İl/İlçe)
- Kimlik ve Aile Bilgileri (Baba Adı, Anne Adı, Doğum Tarihi, Doğum Yeri)
- Taşınmaz Bilgileri (Ada / Parsel No)
- IBAN, Telefon, Araç Plakaları, E-posta
otomatik olarak derinlemesine tespit eder ve koordinatlarını bulur.
"""

import re
from dataclasses import dataclass
from pathlib import Path
import pymupdf as fitz
from core.scoring import (
    NegativeFilterEngine,
    PersonScoringEngine,
    AddressScoringEngine,
)
from core.gazetteer import (
    NVI_FIRST_NAMES,
    NVI_SURNAMES,
    TURKISH_PROVINCES,
    TURKISH_DISTRICTS,
    LegalMorphologyEngine,
    JudicialOfficialParser,
)

from typing import List, Dict, Optional, Tuple, Set, Any


@dataclass
class KVKKEntity:
    """Tespit edilen hassas veri nesnesi."""
    category: str           # 'TCKN', 'VKN', 'TARAF_ISMI', 'SIRKET_UNVANI', 'DOSYA_NO', 'IBAN', 'TELEFON', 'PLAKA', 'EPOSTA', 'ADRES', 'KIMLIK_BILGISI', 'TASINMAZ', 'OZEL_KELIME'
    value: str              # Bulunan metin
    page_number: int        # Sayfa numarası (0-tabanlı)
    rect: Tuple[float, float, float, float]  # (x0, y0, x1, y1) PDF koordinatları
    confidence: float       # 0.0 - 1.0 güven skoru
    approved: bool = False  # Avukat onayı (Varsayılan olarak false, avukat tek tek veya topluca onaylar)


# Türkçe Büyük Harf Karakter Dönüşüm Tablosu
TR_UPPER_MAP = str.maketrans("iığüşöç", "İIĞÜŞÖÇ")

def tr_upper(text: str) -> str:
    return text.translate(TR_UPPER_MAP).upper()


class KVKKDetector:
    """Türk Hukuku belgeleri için derinleştirilmiş KVKK hassas veri tespit motoru."""

    # 1. TCKN: Düz (11 hane), boşluklu (123 456 789 50) veya noktalı (111.111.111.10)
    TCKN_PATTERN = re.compile(
        r"(?:T\.?C\.?\s*(?:Kimlik|No|Numarası)?\s*[:.-]?\s*)?\b([1-9](?:[\s.]?[0-9]){10})\b",
        re.IGNORECASE
    )

    # 2. VKN (Vergi Kimlik Numarası - 10 Hane)
    VKN_PATTERN = re.compile(
        r"(?:\bVKN\b|Vergi\s*(?:Kimlik)?\s*No(?:su)?)\s*[:.-]?\s*\b([0-9]{10})\b",
        re.IGNORECASE
    )

    # 3. IBAN: TR ile başlayan 26 karakterlik IBAN formatı
    IBAN_PATTERN = re.compile(r"\b(TR\s*(?:\d\s*){24})\b", re.IGNORECASE)

    # 4. Telefon: 05xx, +905xx, (0212), (05xx), 0542-123-45-67 vb.
    PHONE_PATTERN = re.compile(
        r"(?:\+90\s*|\b)?(?:\(\s*0?\s*[2-5]\d{2}\s*\)|0?\s*[2-5]\d{2})\s*[\s.-]?\s*\d{3}\s*[\s.-]?\s*\d{2}\s*[\s.-]?\s*\d{2}\b"
    )

    # 5. Araç Plakası: 01-81 il kodu + harfler + rakamlar
    PLATE_PATTERN = re.compile(
        r"\b(0[1-9]|[1-7][0-9]|8[0-1])\s*([A-ZÇĞİÖŞÜ]{1,3})\s*(\d{2,4})\b"
    )

    # 6. E-Posta
    EMAIL_PATTERN = re.compile(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    )

    # 7. Dosya Numaraları (Esas, Karar, Soruşturma, İcra Dosyası vb.)
    DOSYA_NO_PATTERN = re.compile(
        r"(?:"
        r"(?:Esas|Karar|Soruşturma|Sor\.|Dosya|İcra\s*Dosya|Hz\.|Talimat)\s*(?:No|Numarası)?\s*[:/.]?\s*\b((?:20[0-2][0-9]|19[8-9][0-9])\s*/\s*\d+)"
        r"|"
        r"\b((?:20[0-2][0-9]|19[8-9][0-9])\s*/\s*\d+(?:\s*(?:Esas|Karar|E\.|K\.|D\.İş|D\.Is|Talimat|İlam|Ilam|Hz\.|CBS|C\.B\.S\.|Bms|Muhabere))?)(?=[\s,;:.?!]|$)"
        r")",
        re.IGNORECASE
    )

    # 8. Şirket / Kurum Unvanları (A.Ş., Ltd. Şti., Holding, Bankası vb.)
    COMPANY_PATTERN = re.compile(
        r"\b("
        r"(?:Tasfiye\s+Halinde\s+)?"
        r"[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü\s&.'-]{2,55}\s+"
        r"(?:"
        r"A\.Ş\.|AŞ|Anonim\s+Şirketi|Anonim\s+Ortaklığı|Anonim\s+Sirketi|"
        r"Ltd\.\s*Şti\.|LTD\.\s*ŞTİ\.|Limited\s+Şirketi|Limited\s+Ortaklığı|Limited\s+Sirketi|"
        r"Tic\.\s*Ltd\.\s*Şti\.|San\.\s*ve\s*Tic\.\s*A\.Ş\.|San\.\s*ve\s*Tic\.\s*Ltd\.|"
        r"Sanayi\s+ve\s+Ticaret|Sanayi\s+Ticaret\s+AS|Sanayi\s+Ticaret\s+A\.Ş\.|"
        r"Holding|Bankası|Bankasi|Katılım\s+Bankası|Katilim\s+Bankasi|Sigorta\s+A\.Ş\.|Sigorta|Varlık\s+Yönetim|Kooperatifi"
        r")"
        r")(?=[\s,;:.?!]|$)",
        re.IGNORECASE
    )

    # 9. Kapsamlı Türk Yargısı Taraf Sıfatları (Tekil ve Çoğul Tüm Roller)
    PARTY_ROLES_STRING = (
        r"DAVACI(?:LAR)?|DAVALI(?:LAR)?|SANIK(?:LAR)?|ŞÜPHELİ(?:LER)?|SUPHELI(?:LER)?|"
        r"MAĞDUR(?:LAR)?|MAGDUR(?:LAR)?|MÜŞTEKİ(?:LER)?|MUSTERI(?:LER)?|KATILAN(?:LAR)?|"
        r"MÜDAFİ(?:İ|LERİ|LER)?|MUDAFI(?:I|LERI|LER)?|VEKİLİ|VEKİLLERİ|VEKILI|VEKILLERI|"
        r"BORÇLU(?:LAR)?|BORCLU(?:LAR)?|ALACAKLI(?:LAR)?|İHBAR\s+OLUNAN(?:LAR)?|IHBAR\s+OLUNAN(?:LAR)?|"
        r"ÜÇÜNCÜ\s+(?:ŞAHIS|KİŞİ)(?:LER)?|UCUNCU\s+(?:SAHIS|KISI)(?:LER)?|"
        r"ASLİ\s+MÜDAHİL|FER'İ\s+MÜDAHİL|MÜDAHİL(?:LER)?|MUDAHIL(?:LER)?|"
        r"MİRASÇI(?:LAR)?|MIRASCI(?:LAR)?|MÜTEVEFFA|MUTEVEFFA|MURİS|MURIS|"
        r"VASİ|VASI|KAYYIM|YASAL\s+DANIŞMAN|YASAL\s+DANISMAN|"
        r"KONKORDATO\s+KOMİSERİ|KONKORDATO\s+KOMISERI|TASFİYE\s+MEMURU|TASFIYE\s+MEMURU|İFLAS\s+İDARESİ|"
        r"İTİRAZ\s+EDEN(?:LER)?|ITIRAZ\s+EDEN(?:LER)?|KARŞI\s+TARAF|KARSI\s+TARAF|"
        r"TALEP\s+EDEN(?:LER)?|ALEYHİNE\s+TALEP\s+OLUNAN(?:LAR)?|"
        r"DAVACI-KARŞI\s+DAVALI|DAVALI-KARŞI\s+DAVACI|"
        r"ARABULUCU|UZLAŞTIRMACI|UZLASTIRMACI|"
        r"HAKİM|HÂKİM|HAKIM|BAŞKAN|BASKAN|ÜYE|UYE|KATİP|KÂTİP|KATIP|"
        r"SAVCI|CUMHURİYET\s+SAVCISI|CUMHURIYET\s+SAVCISI|"
        r"BİLİRKİŞİ(?:LER)?|BILIRKISI(?:LER)?|HÜKÜMLÜ|HUKUMLU|TUTUKLU|YEDİEMİN|YEDIEMIN|"
        r"TANIK(?:LAR)?|MÜŞTEKİ-SANIK|KATILAN-SANIK"
    )

    PARTY_HEADER_PATTERN = re.compile(
        rf"\b({PARTY_ROLES_STRING})\s*[:/]\s*(.+?)(?=(?:\s+(?:{PARTY_ROLES_STRING})\s*[:/])|[\n\r]|$)",
        re.IGNORECASE
    )

    # Taraf satırlarında adayın ardından gelen devam etiketleri ve sınır kesiciler
    PARTY_CUTOFF_RE = re.compile(
        r"(?i)\s+(?:"
        r"T\.?C\.?(?:\s*K[iİ]ml[iİ]k)?(?:\s*No(?:su)?)?|TCKN|VKN|Verg[iİ]\s*(?:K[iİ]ml[iİ]k)?\s*No(?:su)?|"
        r"Adres[iİ]?|[İI]kametg[aâ]h|Yerle[şs][iİ]m\s*Yer[iİ]|"
        r"Vek[iİ]l(?:[iİ]|ler[iİ])?|Vek\.|M[üu]daf[iİ](?:[iİ]|ler[iİ])?|"
        r"Mers[iİ]s\s*No|T[iİ]caret\s*S[iİ]c[iİ]l\s*No|S[iİ]c[iİ]l\s*No|"
        r"Tel(?:efon)?|Gsm|Faks|Fax|E-?posta|Ema[iİ]l|"
        r"ad[ıi]na|tems[iİ]len|vesayeten|velayeten|m[iİ]ras[çc][ıi]lar[ıi]|terekes[iİ]"
        r")\b\s*[:.-]?"
    )

    # 10. Dilekçe Metni İçinde Geçen Kişi İsim Kalıpları (Özel İsim Baş Harfleri Büyük)
    RUNNING_TEXT_NAME_PATTERN = re.compile(
        r"(?:"
        r"\b(?i:müvekkil|muvekkil|sanık|sanik|şüpheli|supheli|mağdur|magdur|tanık|tanik|borçlu|borclu|alacaklı|alacakli)\s+"
        r"([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){1,3})"
        r"|"
        r"\b(?i:Av\.|Avukat|Hakim|Hâkim|Savcı|Savci|Katip|Kâtip|Bilirkişi|BilirKisi|Uzlaştırmacı)\s+"
        r"([A-ZÇĞİÖŞÜ][a-zçğıöşüA-ZÇĞİÖŞÜ]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşüA-ZÇĞİÖŞÜ]+){1,3})"
        r")"
    )

    # 11. Tamamı Büyük Harfli Ad-Soyad Kalıbı
    ALL_CAPS_NAME_PATTERN = re.compile(
        r"\b([A-ZÇĞİÖŞÜ]{2,}[ \t]+[A-ZÇĞİÖŞÜ]{2,}(?:[ \t]+[A-ZÇĞİÖŞÜ]{2,})?)\b"
    )

    # 12. Adres Tespiti (UYAP Başlık ve Metin İçi)
    ADDRESS_HEADER_PATTERN = re.compile(
        r"(?:ADRES(?:İ)?|İKAMETGAH|IKAMETGAH|YERLEŞİM\s+YERİ)\s*[:/]\s*([^\n\r]+(?:\n\s{4,}[^\n\r]+)*)",
        re.IGNORECASE
    )

    # 13. Kimlik / Aile Bilgileri (Baba Adı, Anne Adı, Doğum Tarihi/Yeri)
    FAMILY_IDENTITY_PATTERN = re.compile(
        r"(?:Baba\s+Adı|Anne\s+Adı|Doğum\s+Tarihi|Doğum\s+Yeri|D\.Tarihi|D\.Yeri|Nüfus|Cilt\s+No|Sıra\s+No)\s*[:/]\s*"
        r"([A-ZÇĞİÖŞÜa-zçğıöşü0-9/.-]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü0-9/.-]+)*?)"
        r"(?=\s+(?:Baba|Anne|Doğum|D\.|Cilt|Sıra|Nüfus)|[\n\r,;]|$)",
        re.IGNORECASE
    )

    # 14. Taşınmaz (Tapu) Bilgileri: Ada / Parsel
    PROPERTY_PATTERN = re.compile(
        r"(?:Ada\s*(?:No)?\s*[:.]?\s*\d+\s*(?:,|ve)?\s*Parsel\s*(?:No)?\s*[:.]?\s*\d+|"
        r"\d+\s*Ada\s*,?\s*\d+\s*Parsel)",
        re.IGNORECASE
    )

    # 15. Kesinlikle İsim Sayılmayacak Hukuki Terim, Hüküm Fıkrası ve Başlıklar (Stopwords)
    INSTITUTION_KEYWORDS = {
        # Mahkemeler & Yargı Mercileri
        "MAHKEME", "MAHKEMESİ", "MAHKEMESI", "MAHKEMELERİ", "MAHKEMELERI", "MAHKEMESİNE", "MAHKEMESINE",
        "HAKİMLİK", "HAKİMLİĞİ", "HAKIMLIK", "HAKIMLIGI", "HAKİMLİĞİNE", "HAKIMLIGINE",
        "SAVCILIK", "SAVCILIĞI", "SAVCILIK", "SAVCILIGI", "BAŞSAVCILIK", "BAŞSAVCILIĞI", "BASSAVCILIK", "BASSAVCILIGI",
        "ADLİYE", "ADLİYESİ", "ADLIYE", "ADLIYESI", "ADALET", "SARAYI",
        "YARGITAY", "DANIŞTAY", "DANISTAY", "SAYIŞTAY", "SAYISTAY", "ANAYASA",
        "İSTİNAF", "ISTINAF", "TEMYİZ", "TEMYIZ", "BAM", "BİM", "BIM",
        "BARO", "BAROSU", "BAROLAR", "HEYETİ", "HEYETI",

        # Hukuk Dalları & Mahkeme Türleri
        "HUKUK", "CEZA", "TİCARET", "TICARET", "İŞ", "IS", "İCRA", "ICRA", "İFLAS", "IFLAS",
        "ASLİYE", "ASLIYE", "SULH", "AĞIR", "AGIR", "AİLE", "AILE", "TÜKETİCİ", "TUKETICI",
        "KADASTRO", "İNFAZ", "INFAZ", "FİKRİ", "FIKRI", "SINAİ", "SINAI", "ÇOCUK", "COCUK",
        "VERGİ", "VERGI", "İDARE", "IDARE", "İDARESİ", "IDARESI", "İDARİ", "IDARI",
        "BÖLGE", "BOLGE", "NÖBETÇİ", "NOBETCI",

        # Belge Türleri & Bölümleri
        "DİLEKÇE", "DİLEKÇESİ", "DILEKCE", "DILEKCESI", "DILEKCESINDE", "DİLEKÇESİNDE", "DİLEKÇESİDİR", "DILEKCESIDIR",
        "RAPOR", "RAPORU", "RAPORUDUR", "İNCELEMESİ", "INCELEMESI",
        "TUTANAK", "TUTANAĞI", "TUTANAGI", "ZAPIT", "ZAPTI",
        "TENSİP", "TENSIP", "DURUŞMA", "DURUSMA", "GÜNÜ", "GUNU",
        "KARAR", "KARARI", "GEREKÇELİ", "GEREKCELI", "İLAM", "ILAM", "İLAMI", "ILAMI",
        "MÜZEKKERE", "MUZEKKERE", "TEBLİGAT", "TEBLIGAT", "BEYAN", "BEYANI", "BEYANIDIR",
        "CEVAP", "CEVABI", "CEVABIDIR", "İTİRAZ", "ITIRAZ", "TALEP", "TALEBİ", "TALEBI", "TALEBİDİR", "TALEBIDIR",
        "PROTOKOL", "PROTOKOLÜ", "PROTOKOLU", "SÖZLEŞME", "SOZLESME", "SÖZLEŞMESİ", "SOZLESMESI",
        "VEKÂLETNAME", "VEKALETNAME", "SURET", "SURETİ", "SURETI", "YETKİ", "YETKISI", "YETKİSİ",
        "BELGE", "BELGESİ", "BELGESI", "BİLGİ", "BİLGİLERİ", "BILGI", "BILGILERI", "LİSTE", "LİSTESİ", "LİSTESİDİR", "LISTE", "LISTESI", "LISTESIDIR",

        # Dilekçe & Hüküm Başlıkları ve Terimleri
        "TÜRK", "TURK", "MİLLETİ", "MILLETİ", "MILLET", "ADINA",
        "ESAS", "NO", "NUMARA", "NUMARASI", "KONU", "KONUSU",
        "HÜKÜM", "HUKUM", "FIKRA", "FIKRASI", "NETİCE", "NETICE", "SONUÇ", "SONUC", "SONUCU",
        "GEREĞİ", "GEREGI", "DÜŞÜNÜLDÜ", "DUSUNULDU",
        "DELİL", "DELIL", "DELİLLER", "DELILLER", "DELİLLERİ", "DELILLERI",
        "SEBEP", "SEBEPLER", "SEBEPLERİ", "AÇIKLAMA", "ACIKLAMA", "AÇIKLAMALAR", "ACIKLAMALAR",
        "SAVUNMA", "İDDİA", "IDDIA", "ÖZETİ", "OZETI",

        # Hukuki Talepler & Kavramlar
        "TAZMİNAT", "TAZMINAT", "TAZMİNATI", "TAZMINATI", "KIDEM", "İHBAR", "IHBAR",
        "FAİZ", "FAIZ", "FAİZİ", "FAIZI", "YASAL", "TEMERRÜT", "TEMERRUT",
        "MASRAF", "MASRAFI", "MASRAFLARI", "HARÇ", "HARC", "HARCI",
        "VEKALET", "VEKÂLET", "ÜCRET", "ÜCRETİ", "UCRET", "UCRETI",
        "ALACAK", "BORÇ", "BORC", "TAHLİYE", "TAHLIYE", "TESPİT", "TESPIT", "TESPİTİ", "TESPITINE",
        "İPTAL", "IPTAL", "İPTALİ", "IPTALI", "HACİZ", "HACIZ", "HACZİ", "HACZI", "İHTİYATİ", "IHTIYATI",
        "İPOTEK", "IPOTEK", "REHİN", "REHIN", "İHALE", "IHALE",
        "KONKORDATO", "TASFİYE", "TASFIYE", "MÜTEVEFFA", "MUTEVEFFA", "MURİS", "MURIS", "TEREKE", "TEREKESİ",
        "MİRAS", "MIRAS", "MİRASÇI", "MIRASCI", "MİRASÇILARI", "MIRASCILARI",
        "FESİH", "FESIH", "FESHİ", "FESHI", "FESHİN", "FESHIN",

        # Kurum, Şirket ve Statü Kelimeleri (Tek başına veya unvanda geçen)
        "ŞİRKET", "SIRKET", "ŞİRKETİ", "SIRKETI", "ŞİRKETİN", "SIRKETIN",
        "ANONİM", "ANONIM", "LİMİTED", "LIMITED", "ORTAKLIK", "ORTAKLIĞI", "ORTAKLIGI",
        "HOLDİNG", "HOLDING", "BANKA", "BANKASI", "BANKASİ",
        "SİGORTA", "SIGORTA", "KOOPERATİF", "KOOPERATIFI", "KOOPERATİFİ",
        "FABRİKA", "FABRIKA", "LOJİSTİK", "LOJISTIK", "İNŞAAT", "INSAAT", "OTOMOTİV", "OTOMOTIV",
        "SANAYİ", "SANAYI", "TİCARET", "TICARET",
        "KURUM", "KURUMU", "KURULUŞ", "KURULUS", "KURUL", "KURULU",
        "BAKANLIK", "BAKANLIĞI", "BAKANLIGI", "MÜDÜRLÜK", "MÜDÜRLÜĞÜ", "MUDURLUK", "MUDURLUGU",
        "DAİRE", "DAİRESİ", "DAIRE", "DAIRESI", "BAŞKANLIK", "BAŞKANLIĞI", "BASKANLIK", "BASKANLIGI",
        "KOMİSYON", "KOMİSYONU", "KOMISYON", "KOMISYONU",
        "BELEDİYE", "BELEDİYESİ", "BELEDIYE", "BELEDIYESI",
        "VALİLİK", "VALİLİĞİ", "VALILIK", "VALILIGI", "KAYMAKAMLIK", "KAYMAKAMLIGI",
        "EMNİYET", "EMNIYET", "JANDARMA", "NOTER", "NOTERLİĞİ", "NOTERLIGI", "NOTERİ",
        "ŞUBE", "SUBE", "ŞUBESİ", "SUBESI", "FİRMA", "FIRMA", "FİRMASI", "FIRMASI",
        "ŞAHIS", "SAHIS", "YETKİLİ", "YETKILI", "YETKİLİSİ", "YETKILISI",
        "MÜDÜR", "MUDUR", "MÜDÜRÜ", "MUDURU", "TEMSİLCİ", "TEMSILCI", "TEMSİLCİSİ", "TEMSILCISI",
        "KAŞE", "KAŞESİ", "KASESI", "İMZA", "IMZA",

        # Sıfatlar & Taraf Etiketleri
        "MÜVEKKİL", "MUVEKKIL", "MÜVEKKİLİ", "MUVEKKILI", "MÜVEKKİLİN", "MUVEKKILIN",
        "DAVACI", "DAVACININ", "DAVALI", "DAVALININ",
        "SANIK", "SANIĞIN", "SANIGIN", "ŞÜPHELİ", "SUPHELI", "ŞÜPHELİNİN", "SUPHELININ",
        "MAĞDUR", "MAGDUR", "MAĞDURUN", "MAGDURUN",
        "MÜŞTEKİ", "MUSTEKI", "KATILAN", "KATILANIN",
        "BORÇLU", "BORCLU", "BORÇLUNUN", "BORCLUNUN", "ALACAKLI", "ALACAKLININ",
        "İHBAR", "OLUNAN", "MÜDAFİ", "MUDAFI", "MÜDAFİİ", "MUDAFII",
        "VEKİL", "VEKIL", "VEKİLİ", "VEKILI", "VEKİLLERİ", "VEKILLERI", "VEKİLİNİN", "VEKILININ",
        "HAKİM", "HAKIM", "HÂKİM", "SAVCI", "SAVCISI", "KATİP", "KATIP", "KÂTİP",
        "BİLİRKİŞİ", "BILIRKISI", "UZLAŞTIRMACI", "UZLASTIRMACI", "ARABULUCU", "ARABULUCULUK",

        # Adres & Kimlik Etiketleri
        "ADRES", "ADRESİ", "ADRESI", "İKAMETGÂH", "İKAMETGAH", "IKAMETGAH",
        "TCKN", "VKN", "VERGİ", "VERGI", "KİMLİK", "KIMLIK",
        "BABA", "ANNE", "DOĞUM", "DOGUM", "TARİH", "TARIH", "TARİHİ", "TARIHI", "YERİ", "YERI",

        # Genel Dilbilgisel & Stopword Kelimeler
        "İLE", "ILE", "VE", "VEYA", "İÇİN", "ICIN", "GÖRE", "GORE", "DAİR", "DAIR",
        "HAKKINDA", "ALEYHİNE", "ALEYHINE", "LEHİNE", "LEHINE",
        "UYARINCA", "GEREĞİNCE", "GEREGINCE", "NEDENİYLE", "NEDENIYLE", "DOLAYISIYLA",
        "İLGİLİ", "ILGILI", "İŞBU", "ISBU", "DEFATEN", "BİRLİKTE", "BIRLIKTE",
        "MÜNFERİDEN", "MUNFERIDEN", "MÜŞTEREKEN", "MUSTEREKEN",
        "SAYGILARIMLA", "ARZ", "EDERİM", "EDERIM", "EDERİZ", "EDERIZ",
        "SUNULUR", "BİLGİLERİNİZE", "BILGILERINIZE",
        "KABULÜNE", "REDDİNE", "İADESİNE", "ONANMASINA", "BOZULMASINA", 
        "ÜZERE", "UZERE", "DAYALI", "GÖNDERİLMEK", "GONDERILMEK", 
        "KAMU", "YARARI", "ALINMASINA", "VERİLMESİNE", "EDİLMESİNE"
    }

    # Rol başlıklarından hemen sonra gelen kurumsal/genel niteleyiciler (Kesinlikle kişi adı değildir)
    FALSE_POSITIVE_AFTER_ROLE = {
        # Kurumsal ve Genel Sıfatlar / Terimler
        "ŞİRKET", "ŞİRKETİ", "ŞİRKETLERİ", "ŞİRKETLER", "SIRKET", "SIRKETI", "SIRKETLERI", "SIRKETLER",
        "ANONİM", "ANONIM", "ANONİM ŞİRKETİ", "ANONIM SIRKETI", "ANONİM ŞİRKET", "ANONIM SIRKET",
        "LİMİTED", "LIMITED", "LİMİTED ŞİRKETİ", "LIMITED SIRKETI", "LİMİTED ŞİRKET", "LIMITED SIRKET",
        "AŞ", "A.Ş.", "AS", "A.S.", "LTD", "LTD.", "ŞTİ", "ŞTİ.", "STI", "STI.",
        "KOLLEKTİF", "KOLLEKTIF", "KOMANDİT", "KOMANDIT",
        "KOOPERATİF", "KOOPERATİFİ", "KOOPERATİFLERİ", "KOOPERATIF", "KOOPERATIFI", "KOOPERATIFLERI",
        "HOLDİNG", "HOLDİNGİ", "HOLDİNGİ A.Ş.", "HOLDING", "HOLDINGI",
        "BANKA", "BANKASI", "BANKASİ", "BANKALAR", "BANKALARI",
        "SİGORTA", "SİGORTASI", "SIGORTA", "SIGORTASI", "SİGORTA A.Ş.", "SIGORTA A.S.",
        "FACTORING", "FAKTORİNG", "FAKTORING", "LEASING", "LİSİNG", "LISING",
        "VARLIK YÖNETİM", "VARLIK YONETIM", "VARLIK YÖNETİMİ", "VARLIK YONETIMI",
        "ORTAKLIK", "ORTAKLIĞI", "ORTAKLIGI", "ORTAKLAR", "ORTAKLARI",
        "ADİ ORTAKLIK", "ADI ORTAKLIK", "ADİ ŞİRKET", "ADI SIRKET",
        "ŞERİK", "ŞERİKİ", "ŞERİKLER", "ŞERİKLERİ", "SERIK", "SERIKI", "SERIKLER", "SERIKLERI",
        "İŞLETME", "İŞLETMESİ", "ISLETME", "ISLETMESI", "MÜESSESE", "MÜESSESESİ", "MUESSESE", "MUESSESESI",
        "FİRMA", "FİRMASI", "FIRMA", "FIRMASI", "ŞAHIS FİRMASI", "SAHIS FIRMASI",
        "ŞAHIS İŞLETMESİ", "SAHIS ISLETMESI",

        # Kamu Kurumları, İdareler ve Mülki Teşkilat
        "İDARE", "İDARESİ", "İDARELERİ", "IDARE", "IDARESI", "IDARELERI",
        "KURUM", "KURUMU", "KURUMLARI",
        "KURULUŞ", "KURULUŞU", "KURULUŞLARI", "KURULUS", "KURULUSU", "KURULUSLARI",
        "MÜDÜRLÜK", "MÜDÜRLÜĞÜ", "MUDURLUK", "MUDURLUGU", "MÜDÜRLÜKLERİ", "MUDURLUKLERI",
        "GENEL MÜDÜRLÜK", "GENEL MÜDÜRLÜĞÜ", "GENEL MUDURLUK", "GENEL MUDURLUGU",
        "BÖLGE MÜDÜRLÜK", "BÖLGE MÜDÜRLÜĞÜ", "BOLGE MUDURLUK", "BOLGE MUDURLUGU",
        "İL MÜDÜRLÜĞÜ", "IL MUDURLUGU", "İLÇE MÜDÜRLÜĞÜ", "ILCE MUDURLUGU",
        "ŞUBE MÜDÜRLÜĞÜ", "SUBE MUDURLUGU",
        "BAŞKANLIK", "BAŞKANLIĞI", "BASKANLIK", "BASKANLIGI",
        "DAİRE BAŞKANLIĞI", "DAIRE BASKANLIGI",
        "DAİRE", "DAİRESİ", "DAIRE", "DAIRESI",
        "BAKANLIK", "BAKANLIĞI", "BAKANLIKLARI", "BAKANLIGI", "BAKANLIKLARI",
        "MÜSTEŞARLIK", "MÜSTEŞARLIĞI", "MUSTESARLIK", "MUSTESARLIGI",
        "BELEDİYE", "BELEDİYESİ", "BELEDIYE", "BELEDIYESI", "BELEDİYE BAŞKANLIĞI", "BELEDIYE BASKANLIGI",
        "BÜYÜKŞEHİR BELEDİYESİ", "BUYUKSEHIR BELEDIYESI", "BÜYÜKŞEHİR BELEDİYE BAŞKANLIĞI",
        "VALİLİK", "VALİLİĞİ", "VALILIK", "VALILIGI",
        "KAYMAKAMLIK", "KAYMAKAMLIĞI", "KAYMAKAMLIGI",
        "DEFTERDARLIK", "DEFTERDARLIĞI", "DEFTERDARLIGI",
        "HAZİNE", "HAZİNESİ", "HAZINE", "HAZINESI",
        "MALİYE HAZİNESİ", "MALIYE HAZINESI", "DEVLET HAZİNESİ", "DEVLET HAZINESI",
        "VERGİ DAİRESİ", "VERGI DAIRESI", "VERGİ DAİRESİ MÜDÜRLÜĞÜ", "VERGI DAIRESI MUDURLUGU",
        "SGK", "SOSYAL GÜVENLİK KURUMU", "SOSYAL GUVENLIK KURUMU",
        "SOSYAL GÜVENLİK İL MÜDÜRLÜĞÜ", "SOSYAL GUVENLIK IL MUDURLUGU",
        "EMNİYET", "EMNİYETİ", "EMNİYET MÜDÜRLÜĞÜ", "EMNIYET", "EMNIYET MUDURLUGU",
        "POLİS", "POLIS", "JANDARMA",
        "KAMU", "DEVLET", "MİLLET", "TÜRK MİLLETİ", "TURK MILLETI", "T.C.", "TC",
        "MÜLKİYE", "MULKIYE",
        "REKTÖRLÜK", "REKTÖRLÜĞÜ", "REKTORLUK", "REKTORLUGU",
        "ÜNİVERSİTE", "ÜNİVERSİTESİ", "UNIVERSITE", "UNIVERSITESI",
        "FAKÜLTE", "FAKÜLTESİ", "FAKULTE", "FAKULTESI",
        "DEKANLIK", "DEKANLIĞI", "DEKANLIGI",
        "HASTANE", "HASTANESİ", "HASTANESI", "DEVLET HASTANESİ", "DEVLET HASTANESI",
        "ŞEHİR HASTANESİ", "SEHIR HASTANESI", "SAĞLIK OCAĞI", "SAGLIK OCAGI",

        # Meslek Kuruluşları, Odalar, Birlikler, STK'lar
        "ODA", "ODASI", "ODALARI", "TİCARET ODASI", "TICARET ODASI",
        "SANAYİ ODASI", "SANAYI ODASI", "TABİP ODASI", "TABIP ODASI",
        "MİMARLAR ODASI", "MIMARLAR ODASI", "ECZACI ODASI", "ZİRAAT ODASI", "ZIRAAT ODASI",
        "BİRLİK", "BİRLİĞİ", "BIRLIK", "BIRLIGI",
        "BAROLAR BİRLİĞİ", "TÜRKİYE BAROLAR BİRLİĞİ", "TURKIYE BAROLAR BIRLIGI", "TBB",
        "BARO", "BAROSU", "BAROLARI",
        "DERNEK", "DERNEĞİ", "DERNEGI", "DERNEKLERİ", "DERNEKLERI",
        "VAKIF", "VAKFI", "VAKIFLAR", "VAKIFLARI",
        "SENDİKA", "SENDİKASI", "SENDIKASI",
        "FEDERASYON", "FEDERASYONU", "KONFEDERASYON", "KONFEDERASYONU",
        "KOMİSYON", "KOMİSYONU", "KOMISYON", "KOMISYONU",
        "KURUL", "KURULU", "KURULLARI",
        "ŞUBE", "ŞUBESİ", "SUBE", "SUBESI", "ŞUBELERİ", "SUBELERI",
        "NOTER", "NOTERLİĞİ", "NOTERLIGI", "NOTERİ", "NOTERI",

        # Yargı, İcra, İflas ve Tasfiye Organları / Rolleri
        "MAHKEME", "MAHKEMESİ", "MAHKEMESI", "MAHKEMELERİ", "MAHKEMELERI",
        "HÂKİMLİK", "HÂKİMLİĞİ", "HAKİMLİK", "HAKİMLİĞİ", "HAKIMLIK", "HAKIMLIGI",
        "SAVCILIK", "SAVCILIĞI", "SAVCILIGI",
        "BAŞSAVCILIK", "BAŞSAVCILIĞI", "BASSAVCILIK", "BASSAVCILIGI",
        "CUMHURİYET BAŞSAVCILIĞI", "CUMHURIYET BASSAVCILIGI",
        "İCRA DAİRESİ", "ICRA DAIRESI", "İCRA MÜDÜRLÜĞÜ", "ICRA MUDURLUGU",
        "İCRA MAHKEMESİ", "ICRA MAHKEMESI",
        "İFLAS İDARESİ", "IFLAS IDARESI", "İFLAS DAİRESİ", "IFLAS DAIRESI",
        "İFLAS MASASI", "IFLAS MASASI", "İFLAS MEMURLUĞU", "IFLAS MEMURLUGU",
        "MÜFLİS", "MUFLIS",
        "TASFİYE", "TASFIYE",
        "TASFİYE MEMURLUĞU", "TASFIYE MEMURLUGU", "TASFİYE MEMURU", "TASFIYE MEMURU",
        "TASFİYE HALİNDE", "TASFIYE HALINDE", "TASFİYE KURULU", "TASFIYE KURULU",
        "KONKORDATO", "KONKORDATO KOMİSERLİĞİ", "KONKORDATO KOMISERLIGI",
        "KONKORDATO KOMİSERİ", "KONKORDATO KOMISERI",
        "YEDİEMİN", "YEDIEMIN", "KAYYIM", "KAYYUM", "KAYYIMLIK", "KAYYUMLUK",
        "VASİ", "VASI", "VASİLİK", "VASILIK", "VELİ", "VELI",

        # Rol Tekrarları ve Rol Sonrası Yanlış Gelen Sıfatlar
        "TARAF", "TARAFI", "TARAFLAR", "TARAFLARI", "TARAFLARCA", "TARAFLARIN",
        "DAVACI TARAF", "DAVALI TARAF", "KARŞI TARAF", "KARSI TARAF",
        "DAVACI ŞİRKET", "DAVALI ŞİRKET", "DAVACI SIRKET", "DAVALI SIRKET",
        "DAVALI İDARE", "DAVALI IDARE", "DAVACI İDARE", "DAVACI IDARE",
        "DAVALI KURUM", "DAVACI KURUM",
        "DAVALI İŞVEREN", "DAVALI ISVEREN", "DAVACI İŞÇİ", "DAVACI ISCI",
        "DAVACI", "DAVACILAR", "DAVACININ", "DAVACIYA",
        "DAVALI", "DAVALILAR", "DAVALININ", "DAVALIYA",
        "SANIK", "SANIKLAR", "SANIK TARAF",
        "ŞÜPHELİ", "ŞÜPHELİLER", "SUPHELI", "SUPHELILER", "ŞÜPHELİ ŞAHIS", "SUPHELI SAHIS",
        "MÜŞTEKİ", "MÜŞTEKİLER", "MUSTEKI", "MUSTEKILER", "MÜŞTEKİ SANIK",
        "MAĞDUR", "MAĞDURLAR", "MAGDUR", "MAGDURLAR",
        "KATILAN", "KATILANLAR", "KATILAN SANIK",
        "MÜDAFİ", "MÜDAFİİ", "MÜDAFİLER", "MUDAFI", "MUDAFII",
        "VEKİL", "VEKİLİ", "VEKİLLERİ", "VEKİLİNİN", "VEKILI", "VEKILLERI", "VEKILININ",
        "VEKİLİDİR", "VEKILIDIR",
        "DAVACI VEKİLİ", "DAVALI VEKİLİ", "SANIK MÜDAFİİ", "ŞÜPHELİ MÜDAFİİ",
        "ASİL", "ASİLLER", "ASIL", "ASILLER", "DAVACI ASİL", "DAVALI ASİL",
        "BORÇLU", "BORÇLULAR", "BORCLU", "BORCLULAR", "ASIL BORÇLU", "ASIL BORCLU",
        "BORÇLU ŞİRKET", "BORCLU SIRKET", "BORÇLU ŞAHIS", "BORCLU SAHIS",
        "ALACAKLI", "ALACAKLILAR", "ALACAKLI ŞİRKET", "ALACAKLI SIRKET", "ALACAKLI TARAF",
        "İHBAR OLUNAN", "İHBAR OLUNANLAR", "IHBAR OLUNAN", "IHBAR OLUNANLAR",
        "ÜÇÜNCÜ KİŞİ", "ÜÇÜNCÜ ŞAHIS", "UCUNCU KISI", "UCUNCU SAHIS",
        "3. KİŞİ", "3. ŞAHIS", "3.KİŞİ", "3.ŞAHIS",
        "MÜDAHİL", "MÜDAHİLLER", "MUDAHIL", "MUDAHILLER", "ASLİ MÜDAHİL", "FER'İ MÜDAHİL",
        "MİRASÇI", "MİRASÇILAR", "MİRASÇILARI", "MIRASCI", "MIRASCILAR", "MIRASCILARI",
        "MÜTEVEFFA", "MUTEVEFFA", "MURİS", "MURIS", "MURİSİ", "MURISI",
        "İTİRAZ EDEN", "İTİRAZ EDENLER", "ITIRAZ EDEN", "ITIRAZ EDENLER",
        "TALEP EDEN", "TALEP EDENLER", "ALEYHİNE TALEP OLUNAN",
        "HÜKÜMLÜ", "HUKUMLU", "TUTUKLU", "TUTUKLULAR",
        "BİLİRKİŞİ", "BİLİRKİŞİLER", "BILIRKISI", "BILIRKISILER",
        "TANIK", "TANIKLAR",
        "DAVA DIŞI", "DAVA DISI", "DAVA DIŞI ŞAHIS", "DAVA DIŞI ŞİRKET",
        "GERÇEK KİŞİ", "GERCEK KISI", "TÜZEL KİŞİ", "TUZEL KISI", "TÜZEL KİŞİLİK", "TUZEL KISILIK",
        "İŞVEREN", "İŞVERENLER", "ISVEREN", "ISVERENLER",
        "İŞÇİ", "İŞÇİLER", "ISCI", "ISCILER",
        "MÜVEKKİL", "MÜVEKKİLİ", "MUVEKKIL", "MUVEKKILI",
        "MÜŞTERİ", "MÜŞTERİSİ", "MUSTERI", "MUSTERISI",
        "KİRACI", "KİRACILAR", "KIRACI", "KIRACILAR"
    }

    # Bir kişi adında KESİNLİKLE bulunamayacak kurumsal / idari / rol isim kökleri
    INSTITUTION_NOUNS = {
        "ŞİRKET", "ŞİRKETİ", "ŞİRKETLERİ", "SIRKET", "SIRKETI",
        "İDARE", "İDARESİ", "IDARE", "IDARESI",
        "KURUM", "KURUMU", "KURULUŞ", "KURULUŞU", "KURULUS", "KURULUSU",
        "MÜDÜRLÜK", "MÜDÜRLÜĞÜ", "MUDURLUK", "MUDURLUGU",
        "BAŞKANLIK", "BAŞKANLIĞI", "BASKANLIK", "BASKANLIGI",
        "DAİRE", "DAİRESİ", "DAIRE", "DAIRESI",
        "BANKA", "BANKASI", "BANKASİ",
        "SİGORTA", "SİGORTASI", "SIGORTA", "SIGORTASI",
        "HOLDİNG", "HOLDING", "HOLDİNGİ", "HOLDINGI",
        "BELEDİYE", "BELEDİYESİ", "BELEDIYE", "BELEDIYESI",
        "VALİLİK", "VALİLİĞİ", "VALILIK", "VALILIGI",
        "KAYMAKAMLIK", "KAYMAKAMLIĞI", "KAYMAKAMLIGI",
        "BAKANLIK", "BAKANLIĞI", "BAKANLIGI",
        "ODA", "ODASI", "BİRLİK", "BİRLİĞİ", "BIRLIK", "BIRLIGI",
        "DERNEK", "DERNEĞİ", "DERNEGI", "VAKIF", "VAKFI",
        "AŞ", "A.Ş.", "LTD", "ŞTİ", "STI", "ANONİM", "ANONIM", "LİMİTED", "LIMITED",
        "ORTAKLIK", "ORTAKLIĞI", "ORTAKLIGI",
        "MÜSTEŞARLIK", "MÜSTEŞARLIĞI", "MUSTESARLIK", "MUSTESARLIGI",
        "KOMİSYON", "KOMİSYONU", "KOMISYON", "KOMISYONU",
        "ŞUBE", "ŞUBESİ", "SUBE", "SUBESI",
        "MÜLKİYE", "HAZİNE", "HAZİNESİ", "HAZINE", "HAZINESI",
        "DEFTERDARLIK", "DEFTERDARLIĞI", "DEFTERDARLIGI",
        "BAŞSAVCILIK", "BAŞSAVCILIĞI", "BASSAVCILIK", "BASSAVCILIGI",
        "SAVCILIK", "SAVCILIĞI", "SAVCILIGI",
        "MAHKEME", "MAHKEMESİ", "MAHKEMESI",
        "HÂKİMLİK", "HAKİMLİK", "HAKİMLİĞİ", "HAKIMLIK", "HAKIMLIGI",
        "MEMURLUK", "MEMURLUĞU", "MEMURLUGU", "MEMUR", "MEMURU",
        "MASASI", "KOMİSERİ", "KOMİSERLİĞİ", "KOMISERLIGI",
        "TARAF", "TARAFI", "TARAFLAR", "TARAFLARI",
        "DAVACI", "DAVALI", "SANIK", "ŞÜPHELİ", "MÜŞTEKİ", "MAĞDUR", "KATILAN",
        "VEKİLİ", "VEKİLLERİ", "VEKİLİNİN", "VEKILI", "VEKILLERI",
        "BORÇLU", "ALACAKLI", "İHBAR", "MÜDAFİ", "ASİL",
        "İŞVEREN", "İŞÇİ", "MÜVEKKİL"
    }

    # Kamu kurumu ve adli makam son ekleri (Şirket regex'ine takılsa bile şirket sayılamaz)
    PUBLIC_INSTITUTION_ENDINGS = (
        "MAHKEMESİ", "MAHKEMESI", "HAKİMLİĞİ", "HAKIMLIGI", "SAVCILIĞI", "SAVCILIGI",
        "BAŞKANLIĞI", "BASKANLIGI", "MÜDÜRLÜĞÜ", "MUDURLUGU", "BAKANLIĞI", "BAKANLIGI",
        "VALİLİĞİ", "VALILIGI", "KAYMAKAMLIĞI", "KAYMAKAMLIGI", "BELEDİYESİ", "BELEDIYESI",
        "DAİRESİ", "DAIRESI", "KOMİSYONU", "KOMISYONU", "ODASI", "BİRLİĞİ", "BIRLIGI",
        "DEFTERDARLIĞI", "DEFTERDARLIGI", "MEMURLUĞU", "MEMURLUGU", "BÜROSU", "BUROSU"
    )

    # Kelime sınırlarına tam uyan şirket ekleri regexi (kelime içindeki 'aş' veya 'sti' ile karışmaz)
    COMPANY_RE = re.compile(
        r"\b(?:A\.?Ş\.?|LTD\.?\s*ŞT[İI]\.?|ŞT[İI]\.?|LTD\.?|AŞ|ANON[İI]M\s+Ş[İI]RKET[İI]|"
        r"L[İI]M[İI]TED\s+Ş[İI]RKET[İI]|HOLD[İI]NG|BANKAS[İI]|KOOPERAT[İI]F[İI]|"
        r"S[İI]GORTA|FABR[İI]KA|LOJ[İI]ST[İI]K|İNŞAAT|INSAAT|OTOMOT[İI]V)(?=[\s,;:.?!]|$)",
        re.IGNORECASE
    )

    @classmethod
    def analyze_document_text_layer(cls, doc: Any) -> Dict[str, Any]:
        """
        PDF belgesinin metin katmanını analiz eder ve taranmış (OCR'sız görsel evrak) olup olmadığını tespit eder.

        Kriterler:
        - PDF açıldığında her sayfanın metin uzunluğu len(page.get_text().strip()) kontrol edilir.
        - Eğer toplam karakter sayısı sayfa sayısına bölündüğünde sayfa başına 15 karakterin altındaysa
          veya belgedeki sayfaların %80'inden fazlasında hiç metin yoksa:
          is_scanned: True, has_text_layer: False
        - Aksi halde:
          is_scanned: False, has_text_layer: True
        """
        should_close = False
        if isinstance(doc, (str, Path)):
            doc = fitz.open(str(doc))
            should_close = True

        try:
            total_pages = len(doc)
            if total_pages == 0:
                return {
                    "is_scanned": True,
                    "has_text_layer": False,
                    "total_chars": 0,
                    "empty_pages": 0,
                    "total_pages": 0,
                    "avg_chars_per_page": 0.0,
                }

            total_chars = 0
            empty_pages_count = 0

            for page in doc:
                text_len = len(page.get_text().strip())
                total_chars += text_len
                if text_len == 0:
                    empty_pages_count += 1

            avg_chars = total_chars / total_pages
            empty_ratio = empty_pages_count / total_pages

            is_scanned = bool((avg_chars < 15) or (empty_ratio > 0.8))

            return {
                "is_scanned": is_scanned,
                "has_text_layer": not is_scanned,
                "total_chars": int(total_chars),
                "empty_pages": int(empty_pages_count),
                "total_pages": int(total_pages),
                "avg_chars_per_page": round(float(avg_chars), 2),
            }
        finally:
            if should_close and doc:
                doc.close()

    @classmethod
    def is_judgment_word(cls, word: str) -> bool:
        """Kelimenin hüküm fıkrası eylemi veya adli karar fiili olup olmadığını doğrular."""
        if not word:
            return False
        w = tr_upper(word)
        if LegalMorphologyEngine.is_judgment_phrase(w):
            return True
        suffixes = (
            "İNE", "INE", "ÜNE", "UNE", "INA", "UNA",
            "SINE", "SİNE", "SINA", "SUNA",
            "MASINA", "MESİNE", "MESINE",
            "MASI", "MESİ", "MESI", "ILMASI", "İLMESİ", "ILMASINA", "İLMESİNE",
            "KABULÜ", "KABULU", "REDDİ", "REDDI",
            "BOZULMASI", "ONANMASI", "KALDIRILMASI", "BİRLEŞTİRİLMESİ", "DÜŞÜRÜLMESİ",
            "ĞİNE", "GINE", "LİĞİNE", "LIGINE",
            "MİŞTİR", "MISTIR", "MIŞTIR", "MÜŞTÜR",
            "HÜKMOLUNDU", "HÜKMOLUNMASINA", "VERİLDİ", "VERİLMESİNE", "MAKTADIR", "MEKTEDİR", "MAKTADIRLAR", "MEKTEDİRLER",
            "MAMAKTADIR", "MEMEKTEDİR", "MAZ", "MEZ", "MAMIŞTIR",
            "HÜKMOLUNDU", "HÜKMOLUNMASINA", "VERİLDİ", "VERİLMESİNE"
        )
        return any(w.endswith(s) for s in suffixes)

    @classmethod
    def validate_tckn(cls, tckn_str: str) -> bool:
        clean = re.sub(r"[\s.]", "", tckn_str)
        if len(clean) != 11 or not clean.isdigit() or clean[0] == "0":
            return False

        digits = [int(ch) for ch in clean]
        sum_odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
        sum_even = digits[1] + digits[3] + digits[5] + digits[7]

        digit_10 = (sum_odd * 7 - sum_even) % 10
        if digit_10 != digits[9]:
            return False

        sum_first_10 = sum(digits[:10])
        if sum_first_10 % 10 != digits[10]:
            return False

        return True

    @classmethod
    def clean_party_entry(cls, raw_str: str) -> Tuple[str, bool]:
        """
        Taraf başlığından gelen ham metni temizler.
        Açgözlülüğü önler, satır içi etiketlerde (TCKN, Adres, Vekili vb.) keser
        ve şirket ise şirket unvanı sınırında sonlandırır.
        Dönüş: (temiz_isim, sirket_mi)
        """
        # 1. Başındaki '1-', '1.', 'a)', '1 )' gibi liste işaretlerini temizle
        s = re.sub(r"^\s*(?:\d+|[a-zA-Z])[\s.-]+", "", raw_str).strip()

        # 2. Satır içi devam eden etiketler (TCKN, VKN, Adres, Vekili vb.) başladığı yerden kes
        cutoff_match = cls.PARTY_CUTOFF_RE.search(s)
        if cutoff_match:
            s = s[:cutoff_match.start()].strip()

        # 3. Parantez içi bilgileri ayıkla (TCKN: ...), (VKN: ...) vb.
        s = re.sub(r"\s*\([^)]*\)", "", s).strip()

        # 4. Tire veya çizgiyle ayrılan TCKN/VKN/Sicil eklerini kes
        parts = re.split(r"\s+[-–—|]\s+", s)
        if len(parts) > 1:
            s = parts[0].strip()

        # 5. Satır sonundaki sicil veya numara kalıntılarını ayıkla (örn: 'Mehmet Akif ÖZTÜRK 123456')
        sicil_match = re.search(r"\s+(\d{4,11})$", s)
        s = re.sub(r"\s+\d{4,11}$", "", s).strip()

        # 6. Başta ve sonda kalan noktalama işaretlerini kaldır
        s = s.strip(",;:-/ ")

        # 7. Şirket mi kontrolü (kelime sınırları ile hassas kontrol)
        norm = tr_upper(s)
        is_company = bool(cls.COMPANY_RE.search(norm))

        # 8. Eğer şirket unvanı ise, şirket uzantısından (A.Ş., Ltd. Şti. vb.) sonra gelen adres/artıkları kes
        if is_company:
            comp_matches = list(cls.COMPANY_RE.finditer(s))
            if comp_matches:
                last_end = comp_matches[-1].end()
                s = s[:last_end].strip()

        return s, is_company

    @classmethod
    def _add_party_candidate(
        cls,
        candidate_text: str,
        results: List[Dict[str, Any]],
        found_names: Set[str],
        found_companies: Set[str],
        confidence: float = 0.95
    ):
        # Satır sonundaki olası sicil numarasını yakala (örn: 'HÂKİM : İsim Soyisim 123456')
        sicil_match = re.search(r"(?:sicil(?:\s*no)?[:\s\-]*|\s+)(\d{4,8})(?:\)|$)", candidate_text, re.IGNORECASE)
        if sicil_match:
            sicil_val = sicil_match.group(1).strip()
            if len(sicil_val) >= 4 and sicil_val.isdigit():
                results.append({
                    "category": "SICIL_NO",
                    "value": sicil_val,
                    "confidence": 1.0,
                    "approved": True
                })

        cleaned, is_comp = cls.clean_party_entry(candidate_text)
        if not cleaned or len(cleaned) < 3:
            return

        norm = tr_upper(cleaned)

        # 0. Aday bütünüyle adli bir hüküm/usul kalıbı ise (örn: 'KARARIN KALDIRILMASINA') KESİNLİKLE REDDET
        if LegalMorphologyEngine.is_judgment_phrase(norm):
            return

        words = norm.split()
        words_set = set(words)

        # 1. Aday metin bütünüyle FALSE_POSITIVE_AFTER_ROLE veya INSTITUTION_KEYWORDS içindeyse REDDET
        if norm in cls.FALSE_POSITIVE_AFTER_ROLE or norm in cls.INSTITUTION_KEYWORDS:
            return

        # 2. TEK KELİMELİK ADAYLARI KESİNLİKLE REDDET:
        # Türk hukukunda taraf ismi tek bir kelimeden (örn: 'Şirket', 'İdare', 'Banka', 'Davacı', 'Ahmet') oluşamaz.
        # Kişi adı için en az 2 kelimeli (Ad + Soyad) kuralı şart koşulur.
        if len(words) < 2:
            return

        # 3. Şirket / Kurum Ayrımı
        if is_comp:
            # Şirket gibi görünen ama aslında kamu kurumu/mahkeme olanları ele (örn: 'Kadıköy 1. Asliye Hukuk Mahkemesi')
            if any(norm.endswith(end) for end in cls.PUBLIC_INSTITUTION_ENDINGS):
                return
            # Şirket adayının bütünü false positive listesinde değilse ve en az 4 karakterse kaydet
            if len(cleaned) >= 4 and norm not in cls.FALSE_POSITIVE_AFTER_ROLE:
                found_companies.add(cleaned)
                results.append({
                    "category": "SIRKET_UNVANI",
                    "value": cleaned,
                    "confidence": confidence
                })
        else:
            # 4. Kişi Adı (TARAF_ISMI) - Öncelikli Negatif Filtre ve Scoring Engine
            if NegativeFilterEngine.should_suppress_person(cleaned):
                return

            if words_set & cls.INSTITUTION_NOUNS or words_set & cls.INSTITUTION_KEYWORDS:
                return

            is_p, eval_conf, score = PersonScoringEngine.evaluate_candidate(cleaned, role_context="TARAF")
            if not is_p:
                return

            found_names.add(cleaned)
            results.append({
                "category": "TARAF_ISMI",
                "value": cleaned,
                "confidence": eval_conf
            })

    @classmethod
    def find_entities_in_text(cls, text: str, custom_keywords: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        found_names: Set[str] = set()
        found_companies: Set[str] = set()
        found_tckn_digits: Set[str] = set()
        found_vkn_digits: Set[str] = set()

        # 0. Hâkim, Savcı, Zabıt Kâtibi ve Sicil Numaraları (Çift Çıktılı Doğrulama)
        for off_ent in JudicialOfficialParser.parse_officials(text):
            results.append(off_ent)
            if off_ent["category"] == "TARAF_ISMI":
                found_names.add(off_ent["value"])

        # 1. TCKN Taraması
        for match in cls.TCKN_PATTERN.finditer(text):
            val = match.group(1).strip()
            clean_digits = re.sub(r"[\s.]", "", val)
            is_valid = cls.validate_tckn(clean_digits)
            found_tckn_digits.add(clean_digits)
            results.append({
                "category": "TCKN",
                "value": val,
                "confidence": 1.0 if is_valid else 0.8,
                "is_checksum_valid": is_valid
            })

        # 2. VKN (Vergi Kimlik Numarası - 10 hane)
        for match in cls.VKN_PATTERN.finditer(text):
            val = match.group(1).strip()
            found_vkn_digits.add(val)
            results.append({
                "category": "VKN",
                "value": val,
                "confidence": 0.95
            })

        # 3. IBAN Taraması
        for match in cls.IBAN_PATTERN.finditer(text):
            raw = match.group(1).strip()
            results.append({
                "category": "IBAN",
                "value": raw,
                "confidence": 0.99
            })

        # 4. Telefon Numarası
        for match in cls.PHONE_PATTERN.finditer(text):
            val = match.group(0).strip()
            digits_only = re.sub(r"\D", "", val)
            # TCKN veya VKN ile çakışmayı engelle
            if any(digits_only in tckn for tckn in found_tckn_digits) or any(digits_only in vkn for vkn in found_vkn_digits):
                continue
            if 10 <= len(digits_only) <= 12 and not val.startswith("TR"):
                results.append({
                    "category": "TELEFON",
                    "value": val,
                    "confidence": 0.95
                })

        # 5. Dosya / Esas Numarası (Sadece numara kısmı, 'ESAS NO :' etiketi sansürlenmez)
        for match in cls.DOSYA_NO_PATTERN.finditer(text):
            val = (match.group(1) or match.group(2) or "").strip()
            if val:
                results.append({
                    "category": "DOSYA_NO",
                    "value": val,
                    "confidence": 0.95
                })

        # 6. Şirket / Kurum Unvanları
        for match in cls.COMPANY_PATTERN.finditer(text):
            val = match.group(1).strip()
            found_companies.add(val)
            results.append({
                "category": "SIRKET_UNVANI",
                "value": val,
                "confidence": 0.95
            })

        # 7. Araç Plakası
        for match in cls.PLATE_PATTERN.finditer(text):
            val = match.group(0).strip()
            results.append({
                "category": "PLAKA",
                "value": val,
                "confidence": 0.90
            })

        # 8. E-Posta
        for match in cls.EMAIL_PATTERN.finditer(text):
            val = match.group(0).strip()
            results.append({
                "category": "EPOSTA",
                "value": val,
                "confidence": 0.99
            })

        # 9. Adres Bilgileri (Component-Based Address Scoring Engine)
        for addr_ent in AddressScoringEngine.find_address_entities(text):
            results.append(addr_ent)

        # 10. Kimlik / Aile Bilgileri (Baba Adı, Anne Adı, Doğum Tarihi/Yeri)
        for match in cls.FAMILY_IDENTITY_PATTERN.finditer(text):
            val = match.group(1).strip()
            if len(val) >= 2 and len(val) <= 30:
                results.append({
                    "category": "KIMLIK_BILGISI",
                    "value": val,
                    "confidence": 0.90
                })

        # 11. Taşınmaz (Ada / Parsel)
        for match in cls.PROPERTY_PATTERN.finditer(text):
            val = match.group(0).strip()
            results.append({
                "category": "TASINMAZ",
                "value": val,
                "confidence": 0.90
            })

        # 12. UYAP Taraf Başlıklarındaki İsimler ve Numaralandırılmış Taraf Listeleri
        for match in cls.PARTY_HEADER_PATTERN.finditer(text):
            raw_entry = (match.group(2) if match.lastindex and match.lastindex >= 2 else match.group(1)).strip()
            first_line = re.split(r"[\n\r]", raw_entry)[0].strip()
            cls._add_party_candidate(first_line, results, found_names, found_companies, confidence=0.95)

            # Sadece bu başlığın hemen ardından gelen numaralı alt tarafları tara (örn: '2- MEHMET DEMİR')
            # Asla belgenin geri kalanındaki hüküm fıkralarına veya metne yayılmaz!
            end_pos = match.end()
            trailing = text[end_pos:]
            for line in trailing.splitlines()[:15]:
                trimmed = line.strip()
                if not trimmed:
                    continue
                # Yeni bir hukuki başlık veya bölüm başladıysa numaralı taraf listesi bitmiştir
                if re.match(rf"^(?:{cls.PARTY_ROLES_STRING}|KONU|TALEP|DAVA|AÇIKLAMA|HÜKÜM|DELİL|NETİCE)\s*[:/]", trimmed, re.IGNORECASE):
                    break
                # Numaralı veya harfli liste maddesi kontrolü (örn: '1- ...', '2. ...', 'b) ...')
                num_match = re.match(r"^(?:\d+|[a-zA-Z])[\s.-]+([^\n\r]+)", trimmed)
                if num_match:
                    item_text = num_match.group(1).strip()
                    cls._add_party_candidate(item_text, results, found_names, found_companies, confidence=0.92)
                else:
                    break

        # 13. Metin İçi Kişi İsimleri ('müvekkil X Yılmaz', 'Av. X Yılmaz' vb.)
        for match in cls.RUNNING_TEXT_NAME_PATTERN.finditer(text):
            name_cand = (match.group(1) or match.group(2) or "").strip()
            norm = tr_upper(name_cand)

            if NegativeFilterEngine.should_suppress_person(norm):
                continue

            cand_words = set(norm.split())
            if cand_words & cls.INSTITUTION_KEYWORDS or norm in cls.INSTITUTION_KEYWORDS:
                continue
            if any(cls.is_judgment_word(w) for w in cand_words):
                continue
            if any(term in norm for term in ("A.Ş", "LTD", "STI", "ŞTİ", "SANAYI", "SANAYİ", "HOLDING", "BANKA")):
                continue

            is_p, eval_conf, score = PersonScoringEngine.evaluate_candidate(name_cand, role_context="VEKIL_MUVEKKIL")
            if not is_p:
                continue

            words = name_cand.split()
            if len(words) >= 2 and all(len(w) >= 2 for w in words):
                found_names.add(name_cand)
                results.append({
                    "category": "TARAF_ISMI",
                    "value": name_cand,
                    "confidence": eval_conf
                })

        # 13.b Metin İçi Hitaplı ve Rol Başlıklı İsimler ("Burak Bey", "Ayşe Hanım", "Tanık Mehmet Demir")
        honorific_pattern = re.compile(
            r"\b(?:(Tanık|Sanık|Mağdur|Mirasçı|Müteveffa|Vasi|Kayyım)\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){1,2})|"
            r"([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)\s+(Bey(?:'?[a-zçğıöşü]+)?|Hanım(?:'?[a-zçğıöşü]+)?|Efendi(?:'?[a-zçğıöşü]+)?))\b",
            re.UNICODE
        )
        for match in honorific_pattern.finditer(text):
            role_cand = match.group(2)
            hon_cand = match.group(3)
            name_cand = (role_cand or hon_cand or "").strip()
            if name_cand and len(name_cand) >= 3:
                norm_cand = tr_upper(name_cand)
                if not LegalMorphologyEngine.is_judgment_phrase(norm_cand) and norm_cand not in cls.INSTITUTION_KEYWORDS:
                    found_names.add(name_cand)
                    results.append({
                        "category": "TARAF_ISMI",
                        "value": name_cand,
                        "confidence": 0.92,
                        "approved": False
                    })

        # 13.c NVİ Gazetteer Doğrulamalı Metin İçi İki Kelimeli İsim Tespiti
        inline_nvi_pattern = re.compile(
            r"\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,15})\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,20})\b",
            re.UNICODE
        )
        for match in inline_nvi_pattern.finditer(text):
            w1 = match.group(1).strip()
            w2 = match.group(2).strip()
            norm1 = tr_upper(w1)
            norm2 = tr_upper(w2)
            if norm1 in NVI_FIRST_NAMES and norm2 in NVI_SURNAMES:
                full_norm = f"{norm1} {norm2}"
                if not LegalMorphologyEngine.is_judgment_phrase(full_norm) and full_norm not in cls.INSTITUTION_KEYWORDS:
                    if norm1 not in cls.INSTITUTION_KEYWORDS and norm2 not in cls.INSTITUTION_KEYWORDS:
                        cand_name = f"{w1} {w2}"
                        found_names.add(cand_name)
                        results.append({
                            "category": "TARAF_ISMI",
                            "value": cand_name,
                            "confidence": 0.88,
                            "approved": False
                        })

        # 14. Tamamı Büyük Harfli İsimler (Person Scoring Engine ile Sıkı Filtreleme)
        for match in cls.ALL_CAPS_NAME_PATTERN.finditer(text):
            cand = match.group(1).strip()
            norm = tr_upper(cand)

            # Öncelikli Negatif Filtre: Mahkeme, Kurum, Usul veya Argüman ise derhal atla!
            if NegativeFilterEngine.should_suppress_person(norm):
                continue

            cand_words = set(norm.split())
            if cand_words & cls.INSTITUTION_KEYWORDS or norm in cls.INSTITUTION_KEYWORDS:
                continue
            if any(cls.is_judgment_word(w) for w in cand_words):
                continue
            if any(term in norm for term in ("A.Ş", "LTD", "STI", "ŞTİ", "SANAYI", "SANAYİ", "HOLDING", "BANKA")):
                continue

            # Person Scoring Engine ile puanla
            is_p, eval_conf, score = PersonScoringEngine.evaluate_candidate(cand)
            if not is_p:
                continue

            words = cand.split()
            if len(words) in (2, 3) and len(cand) >= 6 and all(len(w) >= 2 for w in words):
                found_names.add(cand)
                results.append({
                    "category": "TARAF_ISMI",
                    "value": cand,
                    "confidence": eval_conf
                })

        # 15. Belge Genelinde İsim ve Şirket Yayılımı
        for name in list(found_names):
            if len(name) < 4:
                continue
            pattern = re.compile(rf"\b{re.escape(name)}(?:'[a-zçğıöşüA-ZÇĞİÖŞÜ]+)?\b", re.IGNORECASE)
            for m in pattern.finditer(text):
                matched_str = m.group(0).strip()
                results.append({
                    "category": "TARAF_ISMI",
                    "value": matched_str,
                    "confidence": 0.95
                })

        for comp in list(found_companies):
            if len(comp) < 5:
                continue
            pattern = re.compile(rf"\b{re.escape(comp)}\b", re.IGNORECASE)
            for m in pattern.finditer(text):
                matched_str = m.group(0).strip()
                results.append({
                    "category": "SIRKET_UNVANI",
                    "value": matched_str,
                    "confidence": 0.95
                })

        # 16. Özel Anahtar Kelimeler
        if custom_keywords:
            for kw in custom_keywords:
                kw = kw.strip()
                if not kw:
                    continue
                pattern = re.compile(re.escape(kw), re.IGNORECASE)
                for match in pattern.finditer(text):
                    results.append({
                        "category": "OZEL_KELIME",
                        "value": match.group(0).strip(),
                        "confidence": 1.0
                    })

        # Mükerrerleri tekilleştir
        unique_results = []
        seen = set()
        for r in results:
            key = (r["category"], r["value"].strip())
            if key not in seen:
                seen.add(key)
                unique_results.append(r)

        return unique_results

    @classmethod
    def scan_pdf_page(
        cls,
        fitz_page,
        page_index: int,
        custom_keywords: Optional[List[str]] = None,
        detect_names: bool = True,
        detect_companies: bool = True,
        detect_dockets: bool = True,
        detect_tckn: bool = True,
        detect_vkn: bool = True,
        detect_iban: bool = True,
        detect_phone: bool = True,
        detect_plate: bool = True,
        detect_email: bool = True,
        detect_address: bool = True,
        detect_identity: bool = True,
        detect_property: bool = True,
    ) -> List[KVKKEntity]:
        page_entities: List[KVKKEntity] = []
        full_text = fitz_page.get_text()
        if not full_text.strip():
            return page_entities

        raw_entities = cls.find_entities_in_text(full_text, custom_keywords=custom_keywords)

        filtered = []
        for ent in raw_entities:
            cat = ent["category"]
            if cat in ("TARAF_ISMI", "SICIL_NO") and not detect_names:
                continue
            if cat == "SIRKET_UNVANI" and not detect_companies:
                continue
            if cat == "DOSYA_NO" and not detect_dockets:
                continue
            if cat == "TCKN" and not detect_tckn:
                continue
            if cat == "VKN" and not detect_vkn:
                continue
            if cat == "IBAN" and not detect_iban:
                continue
            if cat == "TELEFON" and not detect_phone:
                continue
            if cat == "PLAKA" and not detect_plate:
                continue
            if cat == "EPOSTA" and not detect_email:
                continue
            if cat == "ADRES" and not detect_address:
                continue
            if cat == "KIMLIK_BILGISI" and not detect_identity:
                continue
            if cat == "TASINMAZ" and not detect_property:
                continue
            filtered.append(ent)

        search_cache: Dict[str, list] = {}
        seen_coords: set = set()

        for ent in filtered:
            val = ent["value"].strip()
            if not val:
                continue

            if val not in search_cache:
                rects = fitz_page.search_for(val)
                # Tam eşleşmediyse boşlukları normalize edip tekrar dene
                if not rects:
                    simplified = " ".join(val.split())
                    rects = fitz_page.search_for(simplified)
                # Kesme işaretli ek varsa kök kelimeyi ara
                if not rects and "'" in val:
                    root = val.split("'")[0]
                    rects = fitz_page.search_for(root)
                # Adres gibi uzun metinlerde her satır veya ana parçayı ara
                if not rects and len(val.split()) > 4:
                    chunk = " ".join(val.split()[:4])
                    rects = fitz_page.search_for(chunk)
                search_cache[val] = rects
            else:
                rects = search_cache[val]

            for r in rects:
                coord_key = (round(r.x0, 1), round(r.y0, 1), round(r.x1, 1), round(r.y1, 1))
                if coord_key in seen_coords:
                    continue
                seen_coords.add(coord_key)

                # 2 Kademeli Onay: Tier 1 (>=0.95) -> approved=True, Tier 2 (<0.95) -> approved=False
                is_tier1 = (ent.get("confidence", 0.9) >= 0.95)
                entity_approved = ent.get("approved", is_tier1)

                page_entities.append(
                    KVKKEntity(
                        category=ent["category"],
                        value=val,
                        page_number=page_index,
                        rect=(r.x0, r.y0, r.x1, r.y1),
                        confidence=ent["confidence"],
                        approved=entity_approved,
                    )
                )

        return page_entities
