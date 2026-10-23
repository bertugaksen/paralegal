"""
Aşama 3: 30 Yıllık Kıdemli Dava Avukatı ve TBB Tescilli Stres Testi
UYAP İstinaf / Yargıtay Bozma İlamı & Gerekçeli Karar Sınır Testi
"""

import pytest
import pymupdf as fitz
from core.kvkk_detector import KVKKDetector
from core.gazetteer import LegalMorphologyEngine, JudicialOfficialParser


SAMPLE_UYAP_COURT_DECISION = """T.C.
İSTANBUL BÖLGE ADLİYE MAHKEMESİ
4. HUKUK DAİRESİ
DOSYA NO : 2024/1425 Esas
KARAR NO : 2024/1892 Karar
TÜRK MİLLETİ ADINA
GEREKÇELİ KARAR

BAŞKAN : Mehmet Akif ÖZTÜRK 123456
ÜYE HÂKİM : Serdar YILMAZ (Sicil: 198765)
ÜYE : Canan KAYA 214532
ZABIT KÂTİBİ : Fatma ÇETİN (Sicil No: 345678)

DAVACI : Ahmet YILMAZ (TCKN: 10000000146)
VEKİLİ : Av. Mustafa DEMİR
ADRES : Caferağa Mah. Moda Cad. No:24/3 Kadıköy / İSTANBUL
DAVALI : Anadolu Endüstriyel Yapı San. ve Tic. A.Ş. (VKN: 1234567890)
VEKİLİ : Av. Zeynep KAYA
İHBAR OLUNAN : Burak Teknoloji Ltd. Şti.
İBAN : TR33 0006 1005 1234 5678 9012 34

DAVA VE İDDİA:
Davacı vekili dava dilekçesinde müvekkili Ahmet YILMAZ'ın haksız fesih nedeniyle kıdem ve ihbar tazminatı alacağının tahsilini talep etmiştir.
Dosya kapsamındaki tanık beyanları ve deliller incelendiğinde; Tanık Selin Arslan duruşmadaki yeminli beyanında, şantiye şefi Burak Bey ile görüşmeler yapıldığını, fesih bildiriminin bizzat Ayşe Hanım'a tebliğ edildiğini, ancak hak edişlerin ödenmediğini doğrulamıştır. Ayrıca olay günü şirket muhasebecisi Merve Şahin ile saha personeli Ali Kaya isimli çalışanların da hazır bulunduğu saptanmıştır. Taşınmazın tapu kaydında 1425 Ada 12 Parsel sayılı parsel üzerinde kurulu bulunduğu görülmüştür.

HÜKÜM : Yukarıda açıklanan gerekçelerle;
1- Davacı vekilinin istinaf başvurusunun kabulü ile İlk Derece Mahkemesi kararının KALDIRILMASINA,
2- DAVANIN KISMEN KABULÜNE, KISMEN REDDİNE,
3- Davacının kıdem tazminatı talebinin KABULÜNE, fazlaya ilişkin talebin REDDİNE,
4- YARGILAMA GİDERLERİNİN DAVALIDAN TAHSİLİNE,
5- Karar tarihinde yürürlükte bulunan AAÜT uyarınca 18.000,00 TL VEKALET ÜCRETİ TAKDİRİNE,
6- Kararın tebliğinden itibaren yasal süresi içinde TEMYİZ YOLU AÇIK OLMAK ÜZERE KESİN OLMAK ÜZERE KARAR VERİLDİ. 23/10/2026
"""

SAMPLE_CRIMINAL_COURT_DECISION = """T.C.
ANKARA 12. AĞIR CEZA MAHKEMESİ
DOSYA NO : 2023/452 Esas
KARAR NO : 2024/118 Karar
C. SAVCISI : Hakan GÜNDÜZ 98765
BAŞKAN : Vedat ALKAN 104523
ÜYE HÂKİM : Nilüfer ÇELİK 128941
ÜYE : Osman DEMİR (Sicil: 156324)
KATİP : Ebru YILDIZ 224466

SANIK : Murat ÖZCAN (TCKN: 10000000146)
MÜDAFİİ : Av. Kenan ERDEM
KATILAN : Yasemin POLAT
VEKİLİ : Av. Melis ARDA

İDDİA VE SAVUNMA:
Cumhuriyet Savcısı 98765 esas hakkındaki mütalaasında sanığın cezalandırılmasını talep etmiştir.
Tanık İbrahim Halil duruşmada dinlenmiş; mağdur Selim Bey ile sanık arasındaki tartışmaya şahit olduğunu, arbede sırasında Fatma Hanım'ın araya girdiğini beyan etmiştir. Suç konusu olay yeri Çankaya Mah. Atatürk Bulvarı No:110/5 Çankaya / ANKARA adresidir.

HÜKÜM :
1- Sanık hakkında açılan kamu davasında HÜKMÜN AÇIKLANMASININ GERİ BIRAKILMASINA,
2- İHTİYATİ TEDBİRİN KALDIRILMASINA,
3- GÖREVSİZLİK NEDENİYLE USULDEN REDDİNE yer olmadığına,
4- YETKİSİZLİK KARARI VERİLMESİNE yer olmadığına,
5- Kararın tefhiminden itibaren 7 gün içinde İTİRAZ YOLU AÇIK OLMAK ÜZERE KARAR VERİLDİ.
"""


def test_senior_attorney_full_uyap_decision():
    """30 Yıllık Kıdemli Dava Avukatı Gözüyle UYAP Hukuk Gerekçeli Karar Denetimi."""
    entities = KVKKDetector.find_entities_in_text(SAMPLE_UYAP_COURT_DECISION)

    # 1. HÜKÜM FIKRASI DOKUNULMAZLIK TESTİ (0 False Positive Kuralı)
    judgment_forbidden_tokens = [
        "KALDIRILMASINA",
        "DAVANIN KISMEN KABULÜNE",
        "KISMEN REDDİNE",
        "KABULÜNE",
        "REDDİNE",
        "TAHSİLİNE",
        "TAKDİRİNE",
        "KARAR VERİLDİ",
        "KESİN OLMAK ÜZERE",
        "TÜRK MİLLETİ ADINA",
        "GEREKÇELİ KARAR",
        "HÜKÜM",
    ]
    detected_values = [e["value"] for e in entities]
    detected_names = [e["value"] for e in entities if e["category"] in ("TARAF_ISMI", "SIRKET_UNVANI")]

    for forbidden in judgment_forbidden_tokens:
        assert forbidden not in detected_values, f"Hüküm fıkrası kelimesi sansürlendi! {forbidden}"
        assert not any(forbidden in name for name in detected_names), f"Hüküm fıkrası isim sanıldı! {forbidden}"

    # 2. HÂKİM / KATİP VE SİCİL NUMARALARI SIZINTI DENETİMİ (Sıfır Sızıntı Kuralı)
    sicils = [e["value"] for e in entities if e["category"] == "SICIL_NO"]
    assert "123456" in sicils, "Başkan sicil no yakalanamadı!"
    assert "198765" in sicils, "Üye Hâkim sicil no yakalanamadı!"
    assert "214532" in sicils, "Üye sicil no yakalanamadı!"
    assert "345678" in sicils, "Zabıt Kâtibi sicil no yakalanamadı!"

    # İsimler
    assert any("Mehmet Akif" in n for n in detected_names), "Başkan ismi yakalanamadı!"
    assert any("Serdar YILMAZ" in n or "Serdar" in n for n in detected_names), "Üye Hâkim ismi yakalanamadı!"
    assert any("Canan KAYA" in n or "Canan" in n for n in detected_names), "Üye ismi yakalanamadı!"
    assert any("Fatma ÇETİN" in n or "Fatma" in n for n in detected_names), "Zabıt Kâtibi ismi yakalanamadı!"

    # 3. METİN İÇİ İSİMLER VE HİTAPLAR (Inline NLP Denetimi)
    assert any("Selin Arslan" in n for n in detected_names), "Tanık Selin Arslan yakalanamadı!"
    assert any("Burak" in n for n in detected_names), "Burak Bey yakalanamadı!"
    assert any("Ayşe" in n for n in detected_names), "Ayşe Hanım yakalanamadı!"
    assert any("Merve Şahin" in n or "Merve" in n for n in detected_names), "Merve Şahin yakalanamadı!"
    assert any("Ali Kaya" in n or "Ali" in n for n in detected_names), "Ali Kaya yakalanamadı!"

    # 4. TARAFLAR VE VEKİLLER
    assert any("Ahmet YILMAZ" in n or "Ahmet" in n for n in detected_names), "Davacı yakalanamadı!"
    assert any("Mustafa DEMİR" in n for n in detected_names), "Davacı vekili yakalanamadı!"
    assert any("Zeynep KAYA" in n for n in detected_names), "Davalı vekili yakalanamadı!"

    # 5. TCKN, VKN, IBAN, ADRES, TAŞINMAZ
    tckns = [e["value"] for e in entities if e["category"] == "TCKN"]
    assert any("10000000146" in t for t in tckns), "TCKN yakalanamadı!"

    vkns = [e["value"] for e in entities if e["category"] == "VKN"]
    assert any("1234567890" in v for v in vkns), "VKN yakalanamadı!"

    ibans = [e["value"] for e in entities if e["category"] == "IBAN"]
    assert any("TR330006100512345678901234" in i.replace(" ", "") for i in ibans), "IBAN yakalanamadı!"

    addresses = [e["value"] for e in entities if e["category"] == "ADRES"]
    assert any("Caferağa" in a or "Moda" in a for a in addresses), "Adres yakalanamadı!"

    tasinmazlar = [e["value"] for e in entities if e["category"] == "TASINMAZ"]
    assert any("1425" in t and "12" in t for t in tasinmazlar), "Ada Parsel yakalanamadı!"


def test_senior_attorney_criminal_court_decision():
    """30 Yıllık Kıdemli Ceza Avukatı Gözüyle Ağır Ceza Karar Denetimi."""
    entities = KVKKDetector.find_entities_in_text(SAMPLE_CRIMINAL_COURT_DECISION)
    detected_values = [e["value"] for e in entities]
    detected_names = [e["value"] for e in entities if e["category"] in ("TARAF_ISMI", "SIRKET_UNVANI")]
    sicils = [e["value"] for e in entities if e["category"] == "SICIL_NO"]

    # 1. Hüküm cümleleri asla sansürlenmemeli
    forbidden_criminal = [
        "HÜKMÜN AÇIKLANMASININ GERİ BIRAKILMASINA",
        "İHTİYATİ TEDBİRİN KALDIRILMASINA",
        "GÖREVSİZLİK NEDENİYLE USULDEN REDDİNE",
        "YETKİSİZLİK KARARI VERİLMESİNE",
        "İTİRAZ YOLU AÇIK OLMAK ÜZERE KARAR VERİLDİ",
    ]
    for phrase in forbidden_criminal:
        assert phrase not in detected_values, f"Ceza hüküm fıkrası sansürlendi: {phrase}"
        assert not any(phrase in name for name in detected_names), f"Ceza hüküm fıkrası isim sanıldı: {phrase}"

    # 2. Savcı, Başkan, Üyeler, Kâtip ve Sicilleri
    assert "98765" in sicils, "C. Savcısı sicili yakalanamadı!"
    assert "104523" in sicils, "Başkan sicili yakalanamadı!"
    assert "128941" in sicils, "Üye Hâkim sicili yakalanamadı!"
    assert "156324" in sicils, "Üye sicili yakalanamadı!"
    assert "224466" in sicils, "Katip sicili yakalanamadı!"

    assert any("Hakan GÜNDÜZ" in n or "Hakan" in n for n in detected_names)
    assert any("Vedat ALKAN" in n or "Vedat" in n for n in detected_names)
    assert any("Nilüfer ÇELİK" in n or "Nilüfer" in n for n in detected_names)
    assert any("Osman DEMİR" in n or "Osman" in n for n in detected_names)
    assert any("Ebru YILDIZ" in n or "Ebru" in n for n in detected_names)

    # 3. Sanık, Müdafi, Katılan, Tanık ve Serbest Şahıslar
    assert any("Murat ÖZCAN" in n or "Murat" in n for n in detected_names)
    assert any("Kenan ERDEM" in n or "Kenan" in n for n in detected_names)
    assert any("Yasemin POLAT" in n or "Yasemin" in n for n in detected_names)
    assert any("Melis ARDA" in n or "Melis" in n for n in detected_names)
    assert any("İbrahim Halil" in n or "İbrahim" in n for n in detected_names)
    assert any("Selim" in n for n in detected_names)
    assert any("Fatma" in n for n in detected_names)

    # 4. Serbest adres tespiti
    addresses = [e["value"] for e in entities if e["category"] == "ADRES"]
    assert any("Atatürk Bulvarı" in a or "Çankaya" in a for a in addresses)


def test_senior_attorney_approval_workflow():
    """2 Kademeli Onay Hiyerarşisi (Tier 1 vs Tier 2) Denetimi."""
    doc = fitz.open()
    page = doc.new_page(width=600, height=1000)
    page.insert_text((40, 40), SAMPLE_UYAP_COURT_DECISION, fontsize=10)

    pdf_entities = KVKKDetector.scan_pdf_page(page, page_index=0)
    assert len(pdf_entities) > 0, "PDF sayfasından hiçbir varlık çıkarılamadı!"

    # Tier 1 Doğrulama: TCKN, IBAN, VKN, Sicil Numaraları mutlaka approved=True olmalı
    tier1_categories = {"TCKN", "IBAN", "VKN", "SICIL_NO"}
    for pe in pdf_entities:
        if pe.category in tier1_categories:
            assert pe.approved is True, f"Tier 1 varlığı {pe.category} ({pe.value}) onaylanmamış (approved=False)!"

    # Tier 2 Doğrulama: Serbest metin içi hitaplı isimler (Burak Bey, Ayşe Hanım vb.) approved=False olmalı
    inline_burak = [pe for pe in pdf_entities if "Burak" in pe.value and pe.category == "TARAF_ISMI"]
    if inline_burak:
        assert any(b.approved is False for b in inline_burak), "Hitaplı isim doğrudan yeşil yapılmış, avukat onayı atlanmış!"

    doc.close()
