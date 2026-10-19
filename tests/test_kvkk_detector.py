"""
Unit tests for Paralegal's enhanced KVKKDetector module.
Tests algorithmic TCKN validation, regex patterns (Names, Companies, Docket numbers,
IBAN, Phone, Plate, Email), and PDF page coordinate scanning.
"""

import pytest
import pymupdf as fitz
from core.kvkk_detector import KVKKDetector, KVKKEntity


class TestTCKNValidation:
    """Tests the official Turkish Republic Identification Number (TCKN) checksum algorithm."""

    @pytest.mark.parametrize(
        "tckn",
        [
            "10000000146",
            "12345678950",
            "11111111110",
        ],
    )
    def test_valid_tckn(self, tckn: str):
        assert KVKKDetector.validate_tckn(tckn) is True

    @pytest.mark.parametrize(
        "tckn,reason",
        [
            ("01234567890", "First digit cannot be 0"),
            ("10000000156", "10th digit checksum mismatch"),
            ("10000000147", "11th digit checksum mismatch"),
            ("1234567890", "Too short (10 digits)"),
            ("123456789012", "Too long (12 digits)"),
            ("1000000014A", "Contains alphanumeric characters"),
            ("abcdefghijk", "Non-numeric string"),
            ("", "Empty string"),
            ("   ", "Whitespace string"),
        ],
    )
    def test_invalid_tckn(self, tckn: str, reason: str):
        assert KVKKDetector.validate_tckn(tckn) is False, f"Failed on: {reason}"


class TestKVKKTextDetection:
    """Tests pattern matching across sensitive legal entity types in text."""

    def test_tckn_formatted_detection(self):
        """Tests standard, spaced, and dotted TCKN detection."""
        text = "TCKN: 10000000146 ve T.C. No: 123 456 789 50 ve 111.111.111.10 mevcuttur."
        entities = KVKKDetector.find_entities_in_text(text)
        tckn_entities = [e for e in entities if e["category"] == "TCKN"]
        assert len(tckn_entities) >= 2

    @pytest.mark.parametrize(
        "raw_iban",
        [
            "TR33 0006 1005 1234 5678 9012 34",
            "TR330006100512345678901234",
            "tr33 0006 1005 1234 5678 9012 34",
            "TR12 3456 7890 1234 5678 9012 34",
        ],
    )
    def test_iban_detection(self, raw_iban: str):
        text = f"Alacakli IBAN numarasi: {raw_iban} olarak belirtilmistir."
        entities = KVKKDetector.find_entities_in_text(text)
        ibans = [e for e in entities if e["category"] == "IBAN"]
        assert len(ibans) == 1
        assert ibans[0]["value"].strip() == raw_iban

    @pytest.mark.parametrize(
        "phone",
        [
            "0532 123 45 67",
            "+90 555 987 65 43",
            "+905421112233",
            "(0212) 444 00 00",
            "0312 234 56 78",
            "0542-123-45-67",
        ],
    )
    def test_phone_detection(self, phone: str):
        text = f"Iletisim icin telefon: {phone} arayiniz."
        entities = KVKKDetector.find_entities_in_text(text)
        phones = [e for e in entities if e["category"] == "TELEFON"]
        assert len(phones) == 1
        assert phones[0]["value"] == phone

    @pytest.mark.parametrize(
        "docket",
        [
            "2024/1102",
            "2024/452 Esas",
            "2023/892 E.",
            "2024/78 Karar",
            "2024/15 D.İş",
        ],
    )
    def test_docket_number_detection(self, docket: str):
        """Tests court and enforcement docket file numbers."""
        text = f"Mahkemenin {docket} sayili dosyasinda gorulen dava."
        entities = KVKKDetector.find_entities_in_text(text)
        dockets = [e for e in entities if e["category"] == "DOSYA_NO"]
        assert len(dockets) >= 1
        assert any(docket in e["value"] for e in dockets)

    @pytest.mark.parametrize(
        "company",
        [
            "Demir Tasimacilik ve Lojistik A.Ş.",
            "Kaya Insaat San. ve Tic. Ltd. Şti.",
            "Yildiz Holding",
            "Turkiye Is Bankasi",
            "Tasfiye Halinde Anadolu Gida Ltd. Şti.",
        ],
    )
    def test_company_detection(self, company: str):
        """Tests Turkish corporate entities (A.Ş., Ltd. Şti., Holding, Banka etc.)."""
        text = f"Davali sirket {company} aleyhine dava ikame edilmistir."
        entities = KVKKDetector.find_entities_in_text(text)
        companies = [e for e in entities if e["category"] == "SIRKET_UNVANI"]
        assert len(companies) >= 1
        assert any(company in e["value"] for e in companies)

    @pytest.mark.parametrize(
        "name_text,expected_name",
        [
            ("DAVACI: Ahmet Yilmaz\nKonu: Alacak", "Ahmet Yilmaz"),
            ("Muvekkil Zeynep Kaya tarafindan imzalanan sozlesme", "Zeynep Kaya"),
            ("Davaci Vekili: Av. Selin Arslan", "Av. Selin Arslan"),
            ("Borclu Mehmet Ali Ozturk aleyhine takip", "Mehmet Ali Ozturk"),
            ("MEHMET CAN OZKAN", "MEHMET CAN OZKAN"),
        ],
    )
    def test_person_name_detection(self, name_text: str, expected_name: str):
        """Tests person name detection in headers, running text, and all-caps."""
        entities = KVKKDetector.find_entities_in_text(name_text)
        names = [e for e in entities if e["category"] in ("TARAF_ISMI", "KISI_ISMI")]
        assert len(names) >= 1
        assert any(expected_name in e["value"] for e in names)

    @pytest.mark.parametrize(
        "plate",
        [
            "34 ABC 123",
            "06 A 9999",
            "35 HUK 45",
            "01 M 1234",
            "34 CS 567",
        ],
    )
    def test_vehicle_plate_detection(self, plate: str):
        text = f"Kazaya karisan {plate} plakali arac haczedilmistir."
        entities = KVKKDetector.find_entities_in_text(text)
        plates = [e for e in entities if e["category"] == "PLAKA"]
        assert len(plates) == 1
        assert plates[0]["value"] == plate

    def test_email_detection(self):
        text = "Resmi tebligat adresi: avukat.ahmet@adalet.gov.tr ve info@baro.org.tr dir."
        entities = KVKKDetector.find_entities_in_text(text)
        emails = [e["value"] for e in entities if e["category"] == "EPOSTA"]
        assert "avukat.ahmet@adalet.gov.tr" in emails
        assert "info@baro.org.tr" in emails

    def test_custom_keywords(self):
        text = "Bu sozlesme Gizli Proje Alpha ve Ticari Sir 2026 kapsamindadir."
        custom_kw = ["Gizli Proje Alpha", "Ticari Sir 2026", ""]
        entities = KVKKDetector.find_entities_in_text(text, custom_keywords=custom_kw)
        custom_ents = [e for e in entities if e["category"] == "OZEL_KELIME"]
        assert len(custom_ents) == 2
        values = [e["value"] for e in custom_ents]
        assert "Gizli Proje Alpha" in values
        assert "Ticari Sir 2026" in values


class TestKVKKPageScanning:
    """Tests PyMuPDF page coordinate extraction and category filtering."""

    def test_scan_pdf_page_coordinates(self, sample_sensitive_pdf_path):
        doc = fitz.open(sample_sensitive_pdf_path)
        page = doc[0]

        entities = KVKKDetector.scan_pdf_page(page, page_index=0)
        doc.close()

        assert len(entities) >= 5
        categories = {e.category for e in entities}
        assert "TCKN" in categories
        assert "IBAN" in categories
        assert "PLAKA" in categories
        assert "KISI_ISMI" in categories or "SIRKET_UNVANI" in categories or "DOSYA_NO" in categories

        for ent in entities:
            assert isinstance(ent, KVKKEntity)
            assert ent.page_number == 0
            x0, y0, x1, y1 = ent.rect
            assert x1 > x0, f"Invalid rect width for {ent.value}"
            assert y1 > y0, f"Invalid rect height for {ent.value}"

    def test_scan_pdf_page_filter_toggles(self, sample_sensitive_pdf_path):
        doc = fitz.open(sample_sensitive_pdf_path)
        page = doc[0]

        # Scan with TCKN and IBAN disabled
        entities = KVKKDetector.scan_pdf_page(
            page,
            page_index=0,
            detect_tckn=False,
            detect_iban=False,
            detect_phone=True,
            detect_plate=True,
            detect_email=True,
        )

        categories = {e.category for e in entities}
        assert "TCKN" not in categories
        assert "IBAN" not in categories
        assert "PLAKA" in categories
        doc.close()

    def test_scan_empty_page(self):
        doc = fitz.open()
        page = doc.new_page()
        entities = KVKKDetector.scan_pdf_page(page, page_index=0)
        doc.close()
        assert entities == []

    def test_multi_party_numbered_detection(self):
        """Tests that plural party headers with numbered items are properly extracted."""
        text = """
        DAVACILAR : 1- AHMET YILMAZ (T.C. Kimlik No: 10000000146)
                    2- MEHMET DEMİR
        DAVALILAR : 1- Kaya İnşaat San. ve Tic. Ltd. Şti.
                    2- Hasan KAYA
        """
        entities = KVKKDetector.find_entities_in_text(text)
        values = [e["value"] for e in entities]
        assert any("AHMET YILMAZ" in v for v in values)
        assert any("MEHMET DEMİR" in v for v in values)
        assert any("Kaya İnşaat" in v for v in values)
        assert any("Hasan KAYA" in v for v in values)

    def test_judicial_officials_detection(self):
        """Tests detection of judges, clerks, and prosecutors with registry numbers."""
        text = """
        HAKİM : Mehmet Akif ÖZTÜRK 123456
        KATİP : Fatma ÇELİK 234567
        """
        entities = KVKKDetector.find_entities_in_text(text)
        values = [e["value"] for e in entities]
        assert any("Mehmet Akif ÖZTÜRK" in v for v in values)
        assert any("Fatma ÇELİK" in v for v in values)

    def test_vkn_detection(self):
        """Tests 10-digit Turkish Tax Identification Number (VKN) detection."""
        text = "Şirketin Vergi Kimlik Numarası VKN: 1234567890 olup Kadıköy Vergi Dairesine kayıtlıdır."
        entities = KVKKDetector.find_entities_in_text(text)
        vkns = [e for e in entities if e["category"] == "VKN"]
        assert len(vkns) >= 1
        assert any("1234567890" in e["value"] for e in vkns)

    def test_address_detection(self):
        """Tests address lines in petitions and contracts."""
        text = "TEBLİGAT ADRESİ : Barbaros Bulvarı No:42 Beşiktaş/İSTANBUL\nKonu: İtirazın İptali"
        entities = KVKKDetector.find_entities_in_text(text)
        addresses = [e for e in entities if e["category"] == "ADRES"]
        assert len(addresses) >= 1
        assert any("Barbaros Bulvarı" in e["value"] for e in addresses)

    def test_family_identity_detection(self):
        """Tests parent names, birth place, and birth date detection in legal records."""
        text = "BABA ADI : ALİ  ANNE ADI : AYŞE  DOĞUM TARİHİ : 15/04/1985  D.YERİ : KADIKÖY"
        entities = KVKKDetector.find_entities_in_text(text)
        identities = [e for e in entities if e["category"] == "KIMLIK_BILGISI"]
        assert len(identities) >= 3
        id_values = [e["value"] for e in identities]
        assert any("ALİ" in v for v in id_values)
        assert any("AYŞE" in v for v in id_values)
        assert any("15/04/1985" in v for v in id_values)

    def test_property_detection(self):
        """Tests cadastre / land registry property patterns (ada, parsel)."""
        text = "Dava konusu taşınmaz 145 Ada, 12 Parsel sayılı gayrimenkuldür."
        entities = KVKKDetector.find_entities_in_text(text)
        properties = [e for e in entities if e["category"] == "TASINMAZ"]
        assert len(properties) >= 1
        prop_values = [e["value"] for e in properties]
        assert any("145 Ada" in v or "12 Parsel" in v for v in prop_values)

