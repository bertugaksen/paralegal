"""
Unit and Integration Tests for Paralegal's v3.0 Scoring & Classification Engine.
Tests:
1. False Positive Rejection of Directional/Procedural Formulas ("GÖNDERİLMEK ÜZERE")
2. False Positive Rejection of Argument Headings ("DAYALI DÜZENLEME KAMU YARARI TAŞIMAMAKTADIR")
3. False Positive Rejection of Court/Institution Headings ("ADANA 2. İDARE MAHKEMESİ BAŞKANLIĞINA")
4. Hierarchical Administrative Property Address Detection ("Adana ili, Seyhan ilçesi, Yolgeçen mahallesi")
5. Person Scoring Thresholds (NVİ + Anchors + Dual Name vs. Bare Single Word Rejection)
"""

import pytest
from core.scoring import NegativeFilterEngine, PersonScoringEngine, AddressScoringEngine
from core.kvkk_detector import KVKKDetector


class TestNegativeFilters:
    """Tests Stage 2: Negative filters must suppress all courts, procedures, and legal terms."""

    @pytest.mark.parametrize(
        "phrase",
        [
            "GÖNDERİLMEK ÜZERE",
            "ADANA 2. İDARE MAHKEMESİ BAŞKANLIĞINA",
            "ADANA BÖLGE İDARE MAHKEMESİ İDARİ DAVA DAİRESİNE",
            "DAYALI DÜZENLEME KAMU YARARI TAŞIMAMAKTADIR",
            "BİLGİLERİNİZE SUNULUR",
            "DURUŞMA İSTEMLİDİR",
            "HUKUKA AYKIRIDIR",
            "KAMU YARARI",
            "TAŞIMAMAKTADIR",
        ],
    )
    def test_negative_filter_suppresses_person(self, phrase: str):
        assert NegativeFilterEngine.should_suppress_person(phrase) is True
        is_person, _, score = PersonScoringEngine.evaluate_candidate(phrase)
        assert is_person is False
        assert score < 2.0


class TestPersonScoringEngine:
    """Tests Stage 4: Person Scoring Engine."""

    def test_authentic_person_name_with_role(self):
        is_p, conf, score = PersonScoringEngine.evaluate_candidate("Ahmet Yılmaz", role_context="DAVACI")
        assert is_p is True
        assert score >= 4.0
        assert conf >= 0.95

    def test_authentic_attorney_name(self):
        is_p, conf, score = PersonScoringEngine.evaluate_candidate("Selin Arslan", role_context="AVUKAT")
        assert is_p is True
        assert score >= 4.0
        assert conf >= 0.95

    def test_honorific_person_name(self):
        is_p, conf, score = PersonScoringEngine.evaluate_candidate("Burak", has_honorific=True)
        assert is_p is True
        assert score >= 2.0

    def test_bare_single_name_suppression(self):
        """Single words without anchor roles or honorifics must be rejected to prevent vocabulary collisions."""
        for name in ["Kaya", "Demir", "Gül", "Umut", "Barış"]:
            is_p, _, score = PersonScoringEngine.evaluate_candidate(name)
            assert is_p is False, f"Expected {name} to be rejected when bare"
            assert score < 2.0


class TestAddressScoringEngine:
    """Tests Component-Based Address Scoring."""

    def test_administrative_property_address(self):
        text = "davacının maliki olduğu Adana ili, Seyhan ilçesi, Yolgeçen mahallesi, 125 Ada 4 Parsel sayılı taşınmaz"
        addrs = AddressScoringEngine.find_address_entities(text)
        assert len(addrs) >= 1
        addr_vals = [a["value"] for a in addrs]
        assert any("Seyhan" in a and "Yolgeçen" in a for a in addr_vals)

    def test_isolated_city_district_not_address(self):
        """Single 'Adana ili' or 'Seyhan ilçesi' alone without property/door markers is not an address."""
        text = "Olay Adana ili Seyhan ilçesinde gerçekleşmiştir."
        addrs = AddressScoringEngine.find_address_entities(text)
        assert len(addrs) == 0


class TestKVKKDetectorIntegrationV3:
    """Tests end-to-end detection on the real UYAP samples from the user's screenshots."""

    def test_screenshot_1_gonderilmek_uzere_not_detected(self):
        text = (
            "ADANA BÖLGE İDARE MAHKEMESİ İLGİLİ İDARİ DAVA DAİRESİNE\n"
            "GÖNDERİLMEK ÜZERE\n"
            "ADANA 2. İDARE MAHKEMESİ BAŞKANLIĞINA\n"
        )
        entities = KVKKDetector.find_entities_in_text(text)
        names = [e["value"] for e in entities if e["category"] == "TARAF_ISMI"]
        assert "GÖNDERİLMEK ÜZERE" not in names
        assert not any("GÖNDERİLMEK" in n for n in names)
        assert not any("MAHKEMESİ" in n for n in names)

    def test_screenshot_2_property_address_detected(self):
        text = (
            "OLAYIN ÖZETİ:\n"
            "Dava dosyasının incelenmesinden; davacının maliki olduğu Adana ili, Seyhan ilçesi, Yolgeçen mahallesi,"
        )
        entities = KVKKDetector.find_entities_in_text(text)
        addrs = [e["value"] for e in entities if e["category"] == "ADRES"]
        assert len(addrs) >= 1
        assert any("Adana" in a and "Seyhan" in a and "Yolgeçen" in a for a in addrs)

    def test_screenshot_3_heading_not_detected_as_names(self):
        text = "ÖZEL ŞİRKET İHTİYACINA DAYALI DÜZENLEME KAMU YARARI TAŞIMAMAKTADIR"
        entities = KVKKDetector.find_entities_in_text(text)
        names = [e["value"] for e in entities if e["category"] == "TARAF_ISMI"]
        assert len(names) == 0, f"Expected 0 names in heading, got: {names}"
