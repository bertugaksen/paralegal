"""
Paralegal - KVKK Sensitive Entity Detector Module (Gelişmiş Adli Hukuk Sürümü v2.1)
UYAP dava, duruşma, karar, tensip zaptı ve icra evraklarındaki:
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
from typing import List, Dict, Optional, Tuple, Set, Any


@dataclass
class KVKKEntity:
    """Tespit edilen hassas veri nesnesi."""
    category: str           # 'TCKN', 'VKN', 'TARAF_ISMI', 'SIRKET_UNVANI', 'DOSYA_NO', 'IBAN', 'TELEFON', 'PLAKA', 'EPOSTA', 'ADRES', 'KIMLIK_BILGISI', 'TASINMAZ', 'OZEL_KELIME'
    value: str              # Bulunan metin
    page_number: int        # Sayfa numarası (0-tabanlı)
    rect: Tuple[float, float, float, float]  # (x0, y0, x1, y1) PDF koordinatları
    confidence: float       # 0.0 - 1.0 güven skoru
    approved: bool = True   # Kullanıcı tarafından sansürlenmesi onaylandı mı?


# Türkçe Büyük Harf Karakter Dönüşüm Tablosu
TR_UPPER_MAP = str.maketrans("iığüşöç", "IİĞÜŞÖÇ")

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
        r"MÜDAFİ(?:LER)?|MUDAFI(?:LER)?|VEKİLİ|VEKİLLERİ|VEKILI|VEKILLERI|"
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
        rf"(?:{PARTY_ROLES_STRING})\s*[:/]\s*([^\n\r]+)",
        re.IGNORECASE
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
        "MAHKEMESI", "MAHKEMESİ", "BASKANLIGI", "BAŞKANLIĞI", "HAKIMLIGI", "HAKİMLİĞİ",
        "SAVCILIGI", "SAVCILIĞI", "MUDURLUGU", "MÜDÜRLÜĞÜ", "DAIRESI", "DAİRESİ",
        "BAROSU", "BAKANLIGI", "BAKANLIĞI", "KOMISYONU", "KOMİSYONU", "GENEL", "KURULU",
        "CUMHURIYET", "CUMHURİYET", "ADLIYE", "ADLİYE", "YARGITAY", "DANIŞTAY", "DANISTAY",
        "DILEKCESI", "DİLEKÇESİ", "ZAPTI", "TUTANAGI", "TUTANAĞI", "KARAR", "HUKUK", "CEZA",
        "TICARET", "TİCARET", "IS", "İŞ", "ICRA", "İCRA", "TÜRK", "TURK", "MILLETİ", "MILLET",
        "ESAS", "TALEP", "NETICE", "NETİCE", "IHBAR", "İHBAR", "OLUNAN", "KONU", "KONUSU", "HUKUM",
        "HÜKÜM", "DELIL", "DELİL", "SEBEP", "SEBEPLER", "ACIKLAMA", "AÇIKLAMA", "ACIKLAMALAR",
        "AÇIKLAMALAR", "VEKILI", "VEKİLİ", "VEKILININ", "VEKİLİNİN", "MUSTERI", "MÜŞTERİ", "DAVA",
        "DAVANIN", "DAVA TARIHI", "DAVA TARİHİ", "KARAR TARIHI", "KARAR TARİHİ",
        "BABA ADI", "ANNE ADI", "DOGUM TARIHI", "DOĞUM TARİHİ", "BABA", "ANNE", "DOGUM", "DOĞUM",
        "VERGI", "VERGİ", "ADRES", "TARIH", "TARİH", "TARIHI", "TARİHİ", "DOGUM YERI", "DOĞUM YERİ",
        "VERGI NO", "VERGİ NO", "TC KIMLIK", "TC KİMLİK", "TCKN", "VKN", "ADRES", "IKAMETGAH",
        "İKAMETGAH", "SONUC", "SONUÇ", "TALEP SONUCU", "DAVA KONUSU", "DAVANIN KONUSU",
        "ASLIYE", "ASLİYE", "SULH", "AGIR CEZA", "AĞIR CEZA", "ISTINAF", "İSTİNAF", "TEMYIZ", "TEMYİZ",
        "ITIRAZ", "İTİRAZ", "ITIRAZIN IPTALI", "İTİRAZIN İPTALİ", "ALACAK", "TAHLIYE", "TAHLİYE",
        "TESPIT", "TESPİT", "TENZIL", "TENZİL", "KIDEM", "İHBAR TAZMINATI", "İHBAR TAZMİNATI",
        "FAIZ", "FAİZ", "MASRAF", "VEKALET UCRETI", "VEKÂLET ÜCRETİ", "VEKALET ÜCRETİ",
        "HARC", "HARÇ", "TEBLIGAT", "TEBLİGAT", "BILIRKISI RAPORU", "BİLİRKİŞİ RAPORU",
        "GEREGI DUSUNULDU", "GEREĞİ DÜŞÜNÜLDÜ", "GEREKCELI KARAR", "GEREKÇELİ KARAR",
        "TENSIP ZAPTI", "TENSİP ZAPTI", "DURUSMA GUNU", "DURUŞMA GÜNÜ", "ARABULUCULUK",
        "SON TUTANAK", "VE TIC", "VE TİC", "SAN VE", "SAN. VE", "SAYGILARIMLA", "ARZ EDERIM",
        "ARZ EDERİM", "HUKUKU", "KANUNU", "MADDESI", "MADDESİ", "KABULÜNE", "KABULUNE",
        "REDDİNE", "REDDINE", "GEÇERSİZLİĞİNE", "GECERSIZLIGINE", "İADESİNE", "IADESINE",
        "TESPİTİNE", "TESPITINE", "ÖDENMESİNE", "ODENMESINE", "ONANMASINA", "BOZULMASINA",
        "DÜŞMESİNE", "DUSMESINE", "İŞE", "ISE", "FESHİN", "FESHIN", "FESİH", "FESIH",
        "BÖLGE", "BOLGE", "HÜKÜM ÖZETİ", "HUKUM OZETI", "BİLGİLERİ", "BILGILERI", "DİLEKÇESİNDE",
        "DILEKCESINDE", "BAŞVURUSU", "BASVURUSU", "TALEP ETMİŞTİR", "GÖRÜŞÜLDÜ", "HÜKMOLUNMASINA"
    }

    # Kelime sınırlarına tam uyan şirket ekleri regexi (kelime içindeki 'aş' veya 'sti' ile karışmaz)
    COMPANY_RE = re.compile(
        r"\b(?:A\.?Ş\.?|LTD\.?\s*ŞT[İI]\.?|ŞT[İI]\.?|LTD\.?|AŞ|ANON[İI]M\s+Ş[İI]RKET[İI]|"
        r"L[İI]M[İI]TED\s+Ş[İI]RKET[İI]|HOLD[İI]NG|BANKAS[İI]|KOOPERAT[İI]F[İI]|"
        r"S[İI]GORTA|FABR[İI]KA|LOJ[İI]ST[İI]K|İNŞAAT|INSAAT|OTOMOT[İI]V)\b",
        re.IGNORECASE
    )

    @classmethod
    def is_judgment_word(cls, word: str) -> bool:
        """Kelimenin hüküm fıkrası eylemi (-ine, -üne, -sine, -masına, vb.) olup olmadığını doğrular."""
        w = tr_upper(word)
        suffixes = (
            "İNE", "INE", "ÜNE", "UNE", "INA", "UNA",
            "SINE", "SİNE", "SINA", "SUNA",
            "MASINA", "MESİNE", "MESINE",
            "ĞİNE", "GINE", "LİĞİNE", "LIGINE",
            "MİŞTİR", "MISTIR", "MIŞTIR", "MÜŞTÜR"
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
        Dönüş: (temiz_isim, sirket_mi)
        """
        # 1. Başındaki '1-', '1.', 'a)', '1 )' gibi liste işaretlerini temizle
        s = re.sub(r"^\s*(?:\d+|[a-zA-Z])[\s.-]+", "", raw_str).strip()

        # 2. Parantez içi bilgileri ayıkla (TCKN: ...), (VKN: ...) vb.
        s = re.sub(r"\s*\([^)]*\)", "", s).strip()

        # 3. Tire veya çizgiyle ayrılan TCKN/VKN/Sicil eklerini kes
        parts = re.split(r"\s+[-–—]\s+", s)
        if len(parts) > 1:
            s = parts[0].strip()

        # 4. Satır sonundaki sicil veya numara kalıntılarını temizle (örn: 'Mehmet Akif ÖZTÜRK 123456')
        s = re.sub(r"\s+\d{4,11}$", "", s).strip()

        # 5. Başta ve sonda kalan noktalama işaretlerini kaldır
        s = s.strip(",;:-/ ")

        # Şirket mi kontrolü (kelime sınırları ile hassas kontrol)
        norm = tr_upper(s)
        is_company = bool(cls.COMPANY_RE.search(norm))

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
        cleaned, is_comp = cls.clean_party_entry(candidate_text)
        if not cleaned or len(cleaned) < 3:
            return

        norm = tr_upper(cleaned)
        words = norm.split()
        words_set = set(words)

        if is_comp:
            if len(cleaned) >= 4 and not (words_set & cls.INSTITUTION_KEYWORDS):
                found_companies.add(cleaned)
                results.append({
                    "category": "SIRKET_UNVANI",
                    "value": cleaned,
                    "confidence": confidence
                })
        else:
            # Mahkeme kararı terimleri, hüküm fiilleri ve kurum başlıkları isim sayılamaz
            if words_set & cls.INSTITUTION_KEYWORDS or norm in cls.INSTITUTION_KEYWORDS:
                return
            if any(cls.is_judgment_word(w) for w in words):
                return
            if len(words) >= 2 or (len(words) == 1 and len(cleaned) >= 4):
                found_names.add(cleaned)
                results.append({
                    "category": "TARAF_ISMI",
                    "value": cleaned,
                    "confidence": confidence
                })

    @classmethod
    def find_entities_in_text(cls, text: str, custom_keywords: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        found_names: Set[str] = set()
        found_companies: Set[str] = set()
        found_tckn_digits: Set[str] = set()
        found_vkn_digits: Set[str] = set()

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

        # 9. Adres Bilgileri
        for match in cls.ADDRESS_HEADER_PATTERN.finditer(text):
            raw_addr = match.group(1).strip()
            clean_addr = " ".join(raw_addr.split())
            if len(clean_addr) >= 10:
                results.append({
                    "category": "ADRES",
                    "value": clean_addr,
                    "confidence": 0.95
                })

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
            raw_entry = match.group(1).strip()
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
            cand_words = set(norm.split())
            if cand_words & cls.INSTITUTION_KEYWORDS:
                continue
            if any(cls.is_judgment_word(w) for w in cand_words):
                continue
            if any(term in norm for term in ("A.Ş", "LTD", "STI", "ŞTİ", "SANAYI", "SANAYİ")):
                continue
            if name_cand and len(name_cand) >= 4:
                found_names.add(name_cand)
                results.append({
                    "category": "TARAF_ISMI",
                    "value": name_cand,
                    "confidence": 0.90
                })

        # 14. Tamamı Büyük Harfli İsimler (Dilekçe sonundaki vekil/taraf imzaları)
        for match in cls.ALL_CAPS_NAME_PATTERN.finditer(text):
            cand = match.group(1).strip()
            norm = tr_upper(cand)
            cand_words = set(norm.split())
            # Resmi mahkeme ve dilekçe bölüm başlıkları KİŞİ ADI DEĞİLDİR
            if cand_words & cls.INSTITUTION_KEYWORDS or norm in cls.INSTITUTION_KEYWORDS:
                continue
            if any(cls.is_judgment_word(w) for w in cand_words):
                continue
            words = cand.split()
            if len(words) in (2, 3) and len(cand) >= 6 and all(len(w) >= 2 for w in words):
                found_names.add(cand)
                results.append({
                    "category": "TARAF_ISMI",
                    "value": cand,
                    "confidence": 0.85
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
            if cat == "TARAF_ISMI" and not detect_names:
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

                page_entities.append(
                    KVKKEntity(
                        category=ent["category"],
                        value=val,
                        page_number=page_index,
                        rect=(r.x0, r.y0, r.x1, r.y1),
                        confidence=ent["confidence"],
                        approved=True,
                    )
                )

        return page_entities
