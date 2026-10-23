"""
Unit & Integration Tests for Paralegal's 10/10 KVKK & GDPR Engine.
Validates:
1. False Positive Rejection of Court Rulings ("KARARIN KALDIRILMASINA", "DAVANIN REDDİNE", etc.)
2. Dual-Entity Extraction for Judges, Prosecutors, Clerks and Sicil Numbers
3. Inline Person Names with Honorifics ("Burak Bey", "Tanık Ayşe Demir")
4. Hierarchical Free-Text Address Parsing
5. 2-Tier Approval Model (Tier 1: Confidence >= 0.95 -> approved=True; Tier 2: Confidence < 0.95 -> approved=False)
"""

import pytest
import pymupdf as fitz
from core.kvkk_detector import KVKKDetector, KVKKEntity
from core.gazetteer import LegalMorphologyEngine, JudicialOfficialParser


class TestFalsePositiveRejection10Out10:
    """Tests that judicial ruling clauses and legal phrases are NEVER redacted."""

    @pytest.mark.parametrize(
        "phrase",
        [
            "KARARIN KALDIRILMASINA",
            "KARARIN BOZULMASINA",
            "KARARIN ONANMASINA",
            "DAVANIN KABULÜNE",
            "DAVANIN KISMEN KABULÜNE",
            "DAVANIN REDDİNE",
            "DAVANIN USULDEN REDDİNE",
            "DAVANIN ESASTAN REDDİNE",
            "HÜKMÜN BOZULMASINA",
            "HÜKMÜN ONANMASINA",
            "İSTİNAF BAŞVURUSUNUN ESASTAN REDDİNE",
            "GÖREVSİZLİK NEDENİYLE USULDEN REDDİNE",
            "YETKİSİZLİK KARARI VERİLMESİNE",
            "BİRLEŞTİRİLMESİNE",
            "AYRILMASINA",
            "DÜŞMESİNE",
            "İHTİYATİ TEDBİR TALEBİNİN KABULÜNE",
            "İHTİYATİ TEDBİRİN KALDIRILMASINA",
            "YARGILAMA GİDERLERİNİN DAVALIDAN TAHSİLİNE",
            "VEKALET ÜCRETİ TAKDİRİNE",
            "KESİN OLMAK ÜZERE KARAR VERİLDİ",
        ],
    )
    def test_judgment_phrases_not_detected_as_names(self, phrase: str):
        # 1. Direct morphology test
        assert LegalMorphologyEngine.is_judgment_phrase(phrase) is True

        # 2. Text detector test
        text = f"Yukarıda açıklanan nedenlerle {phrase} karar verildi."
        entities = KVKKDetector.find_entities_in_text(text)
        names = [e["value"] for e in entities if e["category"] in ("TARAF_ISMI", "SIRKET_UNVANI")]
        assert phrase not in names
        for word in phrase.split():
            assert word not in names


class TestJudicialOfficialAndSicilDualExtraction:
    """Tests extraction of judges, prosecutors, clerks and their registration (sicil) numbers."""

    def test_judge_name_and_sicil(self):
        text = "HÂKİM : Mehmet Akif ÖZTÜRK 123456 duruşma salonunda hazır bulundu."
        entities = KVKKDetector.find_entities_in_text(text)
        names = [e["value"] for e in entities if e["category"] == "TARAF_ISMI"]
        sicils = [e["value"] for e in entities if e["category"] == "SICIL_NO"]

        assert any("Mehmet Akif" in n for n in names)
        assert "123456" in sicils

    def test_clerk_name_and_sicil_parentheses(self):
        text = "ZABIT KÂTİBİ : Fatma KAYA (Sicil: 654321)"
        entities = KVKKDetector.find_entities_in_text(text)
        names = [e["value"] for e in entities if e["category"] == "TARAF_ISMI"]
        sicils = [e["value"] for e in entities if e["category"] == "SICIL_NO"]

        assert any("Fatma" in n for n in names)
        assert "654321" in sicils

    def test_prosecutor_and_sicil_only(self):
        text = "C. Savcısı 234567 esas hakkındaki mütalaasını sundu."
        entities = KVKKDetector.find_entities_in_text(text)
        sicils = [e["value"] for e in entities if e["category"] == "SICIL_NO"]
        assert "234567" in sicils

    def test_judge_sicil_only(self):
        text = "Hâkim 102456 kararı imzaladı."
        entities = KVKKDetector.find_entities_in_text(text)
        sicils = [e["value"] for e in entities if e["category"] == "SICIL_NO"]
        assert "102456" in sicils


class TestInlineNamesAndHonorifics:
    """Tests detection of natural names inside running text."""

    def test_honorific_bey_hanim(self):
        text = "Olay günü şirket müdürü Burak Bey ile görüşülmüş, teslim tutanağı Ayşe Hanım'a verilmiştir."
        entities = KVKKDetector.find_entities_in_text(text)
        names = [e["value"] for e in entities if e["category"] == "TARAF_ISMI"]

        assert any("Burak" in n for n in names)
        assert any("Ayşe" in n for n in names)

    def test_witness_tanik_prefix(self):
        text = "Tanık Selin Arslan duruşmada yeminli olarak ifade vermiştir."
        entities = KVKKDetector.find_entities_in_text(text)
        names = [e["value"] for e in entities if e["category"] == "TARAF_ISMI"]

        assert any("Selin Arslan" in n for n in names)


class TestFreeTextAddressParsing:
    """Tests free-text hierarchical address parsing."""

    def test_free_text_address(self):
        text = "Tebligat adresi Atatürk Mah. Fevzi Çakmak Cad. No:14/2 Kadıköy / İSTANBUL olarak belirtilmiştir."
        entities = KVKKDetector.find_entities_in_text(text)
        addresses = [e["value"] for e in entities if e["category"] == "ADRES"]

        assert len(addresses) >= 1
        assert any("Fevzi Çakmak" in a for a in addresses)


class TestTwoTierApprovalModel:
    """Tests that high confidence entities are auto-approved while ambiguous ones require lawyer review."""

    def test_scan_pdf_page_confidence_approval(self):
        # Create a small in-memory PDF page with diverse entities
        doc = fitz.open()
        page = doc.new_page(width=600, height=800)
        content = (
            "DAVACI: Ahmet YILMAZ\n"
            "TCKN: 10000000146\n"
            "IBAN: TR33 0006 1005 1234 5678 9012 34\n"
            "HÂKİM: Mehmet Akif ÖZTÜRK 123456\n"
            "Beyanında Burak Bey ile görüştüğünü belirtti.\n"
            "İSTİNAF KARARININ KALDIRILMASINA KARAR VERİLDİ.\n"
        )
        page.insert_text((50, 50), content, fontsize=12)

        entities = KVKKDetector.scan_pdf_page(page, page_index=0)

        # 1. KARARIN KALDIRILMASINA must not be in entities
        values = [e.value for e in entities]
        assert not any("KALDIRILMASINA" in v for v in values)

        # 2. Tier 1 entities (TCKN, IBAN, Judge Sicil) must have approved=True
        tckn_ents = [e for e in entities if e.category == "TCKN"]
        assert len(tckn_ents) >= 1
        assert tckn_ents[0].approved is True

        iban_ents = [e for e in entities if e.category == "IBAN"]
        assert len(iban_ents) >= 1
        assert iban_ents[0].approved is True

        sicil_ents = [e for e in entities if e.category == "SICIL_NO"]
        assert len(sicil_ents) >= 1
        assert sicil_ents[0].approved is True

        # 3. Tier 2 entities (Inline Burak Bey) must have approved=False
        inline_ents = [e for e in entities if "Burak" in e.value]
        if inline_ents:
            assert inline_ents[0].approved is False

        doc.close()
