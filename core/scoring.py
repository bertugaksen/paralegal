"""
Paralegal - KVKK / GDPR Personal Data Classification & Scoring Engine (v3.0)
%100 Yerel, Puanlama Tabanlı Kişisel Veri Sınıflandırma ve Doğrulama Motoru.

İçerik:
1. NegativeFilterEngine (Öncelikli Negatif Filtreler - Mahkemeler, Kurumlar, Usul, Fiilimsi)
2. PersonScoringEngine (Ağırlıklı Puanlama Tabanlı Gerçek Kişi Sınıflandırıcı)
3. AddressScoringEngine (Bileşen Puanlamalı Adres ve Taşınmaz Ayrıştırıcı)
"""

import re
from typing import Dict, Any, List, Optional, Tuple, Set

from core.gazetteer import (
    NVI_FIRST_NAMES,
    NVI_SURNAMES,
    TURKISH_PROVINCES,
    TURKISH_DISTRICTS,
    COURT_TERMS,
    INSTITUTION_TERMS,
    PROCEDURAL_TERMS,
    LEGAL_ARGUMENT_STOPWORDS,
    PARTICIPLE_REGEX,
    LegalMorphologyEngine,
    tr_upper,
    tr_lower
)


class NegativeFilterEngine:
    """
    Aşama 2: Öncelikli Negatif Filtreler.
    Temel Prensip: 'Önce kişi olmadığını ispatla. Sonra kişi olabileceğini araştır.'
    """

    INSTITUTION_SUFFIXES = (
        "MAHKEMESİ", "MAHKEMESİNE", "MAHKEMESİDİR", "MAHKEMESİ BAŞKANLIĞINA",
        "HÂKİMLİĞİ", "HAKİMLİĞİ", "HÂKİMLİĞİNE", "HAKİMLİĞİNE",
        "SAVCILIĞI", "SAVCILIĞINA", "BAŞSAVCILIĞI", "BAŞSAVCILIĞINA",
        "DAİRESİ", "DAİRESİNE", "DAİRESİNİN", "DAİRE BAŞKANLIĞI",
        "BAKANLIĞI", "BAKANLIĞINA", "MÜDÜRLÜĞÜ", "MÜDÜRLÜĞÜNE", "GENEL MÜDÜRLÜĞÜ",
        "BAŞKANLIĞI", "BAŞKANLIĞINA", "VALİLİĞİ", "VALİLİĞİNE", "KAYMAKAMLIĞI", "KAYMAKAMLIĞINA",
        "BELEDİYESİ", "BELEDİYESİNE", "BELEDİYE BAŞKANLIĞI",
        "KOMUTANLIĞI", "EMNİYETİ", "DEFTERDARLIĞI", "BÜROSU", "MEMURLUĞU",
        "ODASI", "BİRLİĞİ", "BAROSU", "BAROSUNA", "ŞİRKETİ", "ORTAKLIĞI"
    )

    @classmethod
    def is_court_or_chamber(cls, text: str) -> bool:
        norm = tr_upper(text.strip())
        if any(term in norm for term in COURT_TERMS):
            return True
        if any(norm.endswith(sfx) for sfx in ("MAHKEMESİ", "MAHKEMESİNE", "DAİRESİ", "DAİRESİNE", "HÂKİMLİĞİ", "SAVCILIĞI")):
            return True
        return False

    @classmethod
    def is_institution(cls, text: str) -> bool:
        norm = tr_upper(text.strip())
        if any(term in norm for term in INSTITUTION_TERMS):
            return True
        if any(norm.endswith(sfx) for sfx in cls.INSTITUTION_SUFFIXES):
            return True
        return False

    @classmethod
    def is_procedural_or_header(cls, text: str) -> bool:
        norm = tr_upper(text.strip())
        if norm in PROCEDURAL_TERMS:
            return True
        for term in PROCEDURAL_TERMS:
            if term in norm:
                return True
        return False

    @classmethod
    def is_legal_argument_or_judgment(cls, text: str) -> bool:
        norm = tr_upper(text.strip())
        if LegalMorphologyEngine.is_judgment_phrase(norm):
            return True
        if any(term in norm for term in LEGAL_ARGUMENT_STOPWORDS):
            return True
        return False

    @classmethod
    def has_participle_or_verb_suffix(cls, word: str) -> bool:
        norm = tr_upper(word.strip())
        return bool(PARTICIPLE_REGEX.search(norm))

    @classmethod
    def should_suppress_person(cls, text: str) -> bool:
        if not text or len(text.strip()) < 3:
            return True

        norm = tr_upper(text.strip())
        words = norm.split()
        if not words:
            return True

        # 1. Mahkeme veya daire adı ise kesinlikle reddet
        if cls.is_court_or_chamber(norm):
            return True

        # 2. Kurum veya idari makam adı ise kesinlikle reddet
        if cls.is_institution(norm):
            return True

        # 3. "GÖNDERİLMEK ÜZERE" vb. usul/dilekçe şablonu ise kesinlikle reddet
        if cls.is_procedural_or_header(norm):
            return True

        # 4. Hüküm fıkrası veya hukuki argüman ise kesinlikle reddet
        if cls.is_legal_argument_or_judgment(norm):
            return True

        # 5. Kelimelerden herhangi biri açık bir adli kurum veya usul eki taşıyorsa reddet
        for w in words:
            if w in PROCEDURAL_TERMS or w in LEGAL_ARGUMENT_STOPWORDS or w in COURT_TERMS:
                return True

        return False


class PersonScoringEngine:
    """
    Aşama 4: Puanlama Tabanlı Kişisel Veri Sınıflandırıcı.
    Metindeki ifadeleri tartarak 'Kişi Adı' (PERSON) olup olmadığına karar verir.
    """

    ROLE_ANCHORS = frozenset({
        "AV.", "AVUKAT", "AV", "DAVACI", "DAVALI", "SANIK", "ŞÜPHELİ", "SUPHELI",
        "MAĞDUR", "MAGDUR", "MÜŞTEKİ", "MUSTEKI", "KATILAN", "MÜDAFİ", "MUDAFI",
        "MÜDAFİİ", "MUDAFII", "VEKİLİ", "VEKILI", "VEKİLLERİ", "VEKILLERI",
        "TANIK", "BİLİRKİŞİ", "BILIRKISI", "MİRASÇI", "MIRASCI", "MÜTEVEFFA",
        "MUTEVEFFA", "VASİ", "VASI", "KAYYIM", "MÜVEKKİL", "MUVEKKIL", "TARAF", "VEKIL_MUVEKKIL"
    })

    HONORIFICS = frozenset({"BEY", "HANIM", "EFENDİ", "EFENDI"})

    @classmethod
    def evaluate_candidate(
        cls,
        candidate_text: str,
        role_context: Optional[str] = None,
        has_honorific: bool = False
    ) -> Tuple[bool, float, float]:
        raw = candidate_text.strip()
        if not raw or len(raw) < 2:
            return False, 0.0, -10.0

        # 1. Önce Negatif Filtre Kontrolü
        if NegativeFilterEngine.should_suppress_person(raw):
            return False, 0.0, -10.0

        norm = tr_upper(raw)
        words = norm.split()
        if not words:
            return False, 0.0, -10.0

        score = 0.0

        # --- AV. / AVUKAT ÖN EKİ KONTROLÜ ---
        # Eğer adayın başında 'Av.' veya 'Avukat' varsa, bunu bir unvan çıpası olarak alıp isim analizini kalan kelimelerle yap
        has_attorney_title = False
        if words[0] in ("AV.", "AV", "AVUKAT") and len(words) >= 2:
            has_attorney_title = True
            score += 2.0  # Güçlü avukat unvan çıpası
            words = words[1:]

        num_words = len(words)

        # --- POZİTİF PUANLAR ---

        # Rol bağlamı (+2.0)
        if role_context:
            norm_role = tr_upper(role_context.strip())
            if any(anchor in norm_role for anchor in cls.ROLE_ANCHORS):
                score += 2.0

        # Hitap çıpası ("Burak Bey", "Ayşe Hanım") (+1.5)
        if has_honorific or any(h in words for h in cls.HONORIFICS):
            score += 1.5
            # Hitap kelimesini isim kelimelerinden temizle
            words = [w for w in words if w not in cls.HONORIFICS]
            num_words = len(words)

        # Kelime sayısı ve yapı puanı
        if num_words == 2:
            score += 1.0  # Ad + Soyad yapısı
        elif num_words == 3:
            score += 0.5  # İki ad + Soyad

        # NVİ İsim & Soyisim Eşleşmeleri
        if num_words >= 1:
            w1 = words[0]
            w_last = words[-1] if num_words >= 2 else None

            w1_is_first = w1 in NVI_FIRST_NAMES
            w_last_is_sur = (w_last in NVI_SURNAMES) if w_last else False
            w_last_is_first = (w_last in NVI_FIRST_NAMES) if w_last else False

            if w1_is_first:
                score += 2.0

            if w_last_is_sur:
                score += 2.0
            elif w_last_is_first and num_words >= 2:
                # Türkiye'de pek çok isim hem ad hem soyad olarak kullanılır (Arda, Can, Deniz vb.)
                score += 1.5

            # 3 kelimeli ise ortadaki kelime de ad olabilir (örn: Mehmet Akif Öztürk)
            if num_words == 3 and words[1] in NVI_FIRST_NAMES:
                score += 1.0

        # --- NEGATİF PUANLAR ---

        # Mahkeme kelimesi içeriyorsa (-5.0)
        if any(term in norm for term in ("MAHKEME", "DAİRE", "SAVCILIK", "BAŞKANLIK")):
            score -= 5.0

        # Kurum/şirket kelimesi içeriyorsa (-4.0)
        if any(term in norm for term in ("ŞİRKET", "MÜDÜRLÜK", "BELEDİYE", "BAKANLIK", "A.Ş", "LTD", "HOLDİNG")):
            score -= 4.0

        # Hukuk terimi / Usul kalıbı (-3.0)
        if any(term in norm for term in ("GÖNDERİLMEK", "ÜZERE", "KAMU", "YARARI", "DAVA", "KARAR", "HÜKÜM", "İTİRAZ", "TALEP")):
            score -= 3.0

        # Fiilimsi / Çekimli Eylem (-3.0)
        for w in words:
            if NegativeFilterEngine.has_participle_or_verb_suffix(w):
                score -= 3.0

        # Tekil İsim Kuralı (Single Name Rule):
        # Eğer tek bir kelimeden oluşuyorsa ve rol çıpası / hitap yoksa (-3.0)
        if num_words == 1 and not role_context and not has_honorific and not has_attorney_title:
            score -= 3.0

        # ALL CAPS ama ne ilk kelimesi ne son kelimesi NVİ'de yok (-4.0)
        # Örnek: "DAYALI DÜZENLEME KAMU" veya "YARARI TAŞIMAMAKTADIR"
        if num_words >= 1:
            w1_valid = words[0] in NVI_FIRST_NAMES
            w_last_valid = (words[-1] in NVI_SURNAMES or words[-1] in NVI_FIRST_NAMES) if num_words >= 2 else False
            if not w1_valid and not w_last_valid and not role_context and not has_honorific and not has_attorney_title:
                score -= 4.0

        # --- KARAR EŞİĞİ ---
        # Skor >= 3.5: Kesin Person (Tier 1, confidence: 0.95 - 0.99)
        # 2.0 <= Skor < 3.5: Muhtemel Person (Tier 2, confidence: 0.85 - 0.90)
        # Skor < 2.0: REDDEDİLİR (False positive)

        if score >= 3.5:
            confidence = min(0.99, 0.95 + (score - 3.5) * 0.01)
            return True, confidence, score
        elif score >= 2.0:
            confidence = 0.88
            return True, confidence, score
        else:
            return False, 0.0, score


class AddressScoringEngine:
    """
    Adreslerin Bileşen Puanlamalı Ayrıştırıcısı (Component-Based Address Engine).
    Monolitik tek regex yerine, hiyerarşik bileşenleri (İl, İlçe, Mahalle, Cadde, Ada/Parsel) puanlar.
    """

    NEIGHBORHOOD_REGEX = re.compile(
        r"\b([A-ZÇĞİÖŞÜa-zçğıöşü0-9\s.,/-]{2,30})\s+(Mahallesi|Mah\.|Köyü|Mevkii|Mevkiinde)\b",
        re.IGNORECASE
    )

    STREET_REGEX = re.compile(
        r"\b([A-ZÇĞİÖŞÜa-zçğıöşü0-9\s.,/-]{2,30})\s+(Caddesi|Cad\.|Sokağı|Sok\.|Bulvarı|Bulv\.|Yolu)\b",
        re.IGNORECASE
    )

    CADASTRAL_REGEX = re.compile(
        r"\b(?:(\d+)\s*(?:Ada|ada)[\s,]*(\d+)\s*(?:Parsel|parsel)|(?:Ada\s*No\s*[:.-]?\s*\d+)|(?:Parsel\s*No\s*[:.-]?\s*\d+))\b",
        re.IGNORECASE
    )

    NUMBERING_REGEX = re.compile(
        r"\b(?:No\s*[:.-]?\s*\d+[a-zA-Z]?(?:/\d+)?|Kat\s*[:.-]?\s*\d+|Daire\s*[:.-]?\s*\d+|D\s*[:.-]?\s*\d+)\b",
        re.IGNORECASE
    )

    ADMIN_HIERARCHY_REGEX = re.compile(
        r"\b([A-ZÇĞİÖŞÜa-zçğıöşü]+)\s+ili[,\s]+([A-ZÇĞİÖŞÜa-zçğıöşü]+)\s+ilçesi[,\s]+([A-ZÇĞİÖŞÜa-zçğıöşü\s]+)\s+(?:mahallesi|mah\.|köyü|mevkii)\b",
        re.IGNORECASE
    )

    @classmethod
    def find_address_entities(cls, text: str) -> List[Dict[str, Any]]:
        results = []

        # 1. İdari ve Kadastral Taşınmaz Adres Deseni (Görsel 2 Çözümü)
        for match in cls.ADMIN_HIERARCHY_REGEX.finditer(text):
            full_match = match.group(0).strip()
            il = tr_upper(match.group(1).strip())
            ilce = tr_upper(match.group(2).strip())

            score = 2.5
            if il in TURKISH_PROVINCES:
                score += 2.0
            if ilce in TURKISH_DISTRICTS:
                score += 2.0

            end_idx = match.end()
            trailing = text[end_idx:end_idx + 40]
            cad_m = cls.CADASTRAL_REGEX.search(trailing)
            if cad_m:
                full_match += " " + cad_m.group(0).strip()
                score += 2.5

            if score >= 5.0:
                results.append({
                    "category": "ADRES",
                    "value": full_match,
                    "confidence": 0.95,
                    "approved": True,
                    "score": score
                })

        # 2. Standart Şehir Adresleri (Cadde + Mahalle + No)
        lines = text.splitlines()
        for line in lines:
            trimmed = line.strip()
            if len(trimmed) < 15:
                continue

            # Eğer zaten idari adres tarafından yakalandıysa atla
            if any(r["value"] in trimmed or trimmed in r["value"] for r in results):
                continue

            score = 0.0
            has_neighborhood = bool(cls.NEIGHBORHOOD_REGEX.search(trimmed))
            has_street = bool(cls.STREET_REGEX.search(trimmed))
            has_cadastral = bool(cls.CADASTRAL_REGEX.search(trimmed))
            has_numbering = bool(cls.NUMBERING_REGEX.search(trimmed))

            if has_neighborhood:
                score += 2.5
            if has_street:
                score += 2.5
            if has_cadastral:
                score += 2.5
            if has_numbering:
                score += 2.0

            norm_line = tr_upper(trimmed)
            words = set(re.findall(r"\b[A-ZÇĞİÖŞÜ]+\b", norm_line))
            if words & TURKISH_PROVINCES:
                score += 2.0
            if words & TURKISH_DISTRICTS:
                score += 2.0

            if re.match(r"(?i)^(?:ADRES|İKAMETGÂH|YERLEŞİM YERİ)\s*[:/]", trimmed):
                score += 3.0

            if score >= 5.0:
                clean_val = re.sub(r"(?i)^(?:ADRES|İKAMETGÂH|YERLEŞİM YERİ)\s*[:/]\s*", "", trimmed).strip()
                if len(clean_val) >= 15:
                    results.append({
                        "category": "ADRES",
                        "value": clean_val,
                        "confidence": 0.92,
                        "approved": (score >= 6.0),
                        "score": score
                    })

        unique = []
        seen = set()
        for r in results:
            key = r["value"].strip()
            if key not in seen:
                seen.add(key)
                unique.append(r)

        return unique
