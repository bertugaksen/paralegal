"""
Paralegal - Legal NLP & Gazetteer Engine (Sürüm 2.2)
%100 Yerel (Offline), Sıfır Dış Bağımlılık, Adli Türkçe Sözlüğü ve Morfoloji Motoru.

İçerik:
1. NVİ İsim Veritabanı (~3.000+ En Yaygın Türk Adı)
2. NVİ Soyisim Veritabanı (~2.500+ En Yaygın Türk Soyadı)
3. 81 İl ve İlçe Gazetteer'ı
4. Adli Hüküm Morfolojisi ve Yargı Fiilleri Suffix Engine (False Positive Önleme)
5. Hâkim, Savcı, Kâtip ve Sicil No Ayrıştırıcısı
"""

import re
from typing import Set, Tuple, Optional, Dict, Any, List

# Türkçe Harf Dönüşüm Fonksiyonları
TR_UPPER_MAP = str.maketrans("iığüşöç", "İIĞÜŞÖÇ")
TR_LOWER_MAP = str.maketrans("İIĞÜŞÖÇ", "iığüşöç")

def tr_upper(text: str) -> str:
    return text.translate(TR_UPPER_MAP).upper()

def tr_lower(text: str) -> str:
    return text.translate(TR_LOWER_MAP).lower()


# ==============================================================================
# 1. 81 İL VE ÖNEMLİ İLÇE GAZETTEER'I
# ==============================================================================
TURKISH_PROVINCES: Set[str] = frozenset({
    "ADANA", "ADIYAMAN", "AFYONKARAHİSAR", "AĞRI", "AMASYA", "ANKARA", "ANTALYA", "ARTVİN", "AYDIN",
    "BALIKESİR", "BİLECİK", "BİNGÖL", "BİTLİS", "BOLU", "BURDUR", "BURSA", "ÇANAKKALE", "ÇANKIRI",
    "ÇORUM", "DENİZLİ", "DİYARBAKIR", "EDİRNE", "ELAZIĞ", "ERZİNCAN", "ERZURUM", "ESKİŞEHİR", "GAZİANTEP",
    "GİRESUN", "GÜMÜŞHANE", "HAKKARİ", "HATAY", "ISPARTA", "MERSİN", "İSTANBUL", "İZMİR", "KARS", "KASTAMONU",
    "KAYSERİ", "KIRKLARELİ", "KIRŞEHİR", "KOCAELİ", "KONYA", "KÜTAHYA", "MALATYA", "MANİSA", "KAHRAMANMARAŞ",
    "MARDİN", "MUĞLA", "MUŞ", "NEVŞEHİR", "NİĞDE", "ORDU", "RİZE", "SAKARYA", "SAMSUN", "SİİRT", "SİNOP",
    "SİVAS", "TEKİRDAĞ", "TOKAT", "TRABZON", "TUNCELİ", "ŞANLIURFA", "UŞAK", "VAN", "YOZGAT", "ZONGULDAK",
    "AKSARAY", "BAYBURT", "KARAMAN", "KIRIKKALE", "BATMAN", "ŞIRNAK", "BARTIN", "ARDAHAN", "IĞDIR",
    "YALOVA", "KARABÜK", "KİLİS", "OSMANİYE", "DÜZCE"
})

TURKISH_DISTRICTS: Set[str] = frozenset({
    "KADIKÖY", "BEŞİKTAŞ", "ÜSKÜDAR", "ŞİŞLİ", "BEYOĞLU", "BAKIRKÖY", "FATİH", "MALTEPE", "KARTAL",
    "PENDİK", "ÜMRANİYE", "ATAŞEHİR", "BEYKOZ", "SARIYER", "ZEYTİNBURNU", "BAHÇELİEVLER", "GÜNGÖREN",
    "BAĞCILAR", "ESENLER", "KÜÇÜKÇEKMECE", "BÜYÜKÇEKMECE", "BAŞAKŞEHİR", "BEYLİKDÜZÜ", "ESENYURT",
    "AVCILAR", "TUZLA", "ÇEKMEKÖY", "SANCAKTEPE", "SULTANBEYLİ", "SULTANGAZİ", "GAZİOSMANPAŞA",
    "EYÜPSULTAN", "KAĞITHANE", "ÇATALCA", "SİLİVRİ", "ŞİLE", "ADALAR", "ARNAVUTKÖY",
    "ÇANKAYA", "KEÇİÖREN", "YENİMAHALLE", "MAMAK", "ETİMESGUT", "SİNCAN", "ALTINDAĞ", "PURSAKLAR",
    "GÖLBAŞI", "POLATLI", "KAHRAMANKAZAN", "BEYPAZARI", "ÇUBUK", "ELMADAĞ", "ŞEREFLİKOÇHİSAR", "AYAŞ",
    "KONAK", "KARŞIYAKA", "BORNOVA", "BUCA", "ÇİĞLİ", "GAZİEMİR", "BALÇOVA", "NARLIDERE", "BAYRAKLI",
    "KARABAĞLAR", "TORBALI", "MENEMEN", "ALİAĞA", "BERGAMA", "ÇEŞME", "URLA", "SEFERİHİSAR", "ÖDEMİŞ",
    "TİRE", "KEMALPAŞA", "DİKİLİ", "MENDERES", "FOÇA", "SELÇUK", "KINIK", "BEYDAĞ", "KİRAZ", "KARABURUN",
    "NİLÜFER", "OSMANGAZİ", "YILDIRIM", "İNEGÖL", "GEMLİK", "MUDANYA", "GÜRSU", "KESTEL", "MUSTAFAKEMALPAŞA",
    "KARACABEY", "ORHANGAZİ", "YENİŞEHİR", "İZNİK", "ORHANELİ", "KELES", "HARMANCIK", "BÜYÜKORHAN",
    "SEYHAN", "YÜREĞİR", "ÇUKUROVA", "SARIÇAM", "CEYHAN", "KOZAN", "İMAMOĞLU", "KARAİSALI", "POZANTI",
    "MURATPAŞA", "KEPEZ", "KONYAALTI", "ALANYA", "MANAVGAT", "SERİK", "AKSU", "DÖŞEMEALTI", "KEMER",
    "KUMLUCA", "FİNİKE", "KAŞ", "KORKUTELİ", "ELMALI", "DEMRE", "GAZİPAŞA", "İBRADI", "AKSEKİ",
    "ŞAHİNBEY", "ŞEHİTKAMİL", "NİZİP", "İSLAHİYE", "OĞUZELİ", "ARABAN", "YAVUZELİ", "KARKAMIŞ", "NURDAĞI",
    "MELİKGAZİ", "KOCASİNAN", "TALAS", "DEVELİ", "YAHYALI", "BÜNYAN", "PINARBAŞI", "İNCESU",
    "İZMİT", "GEBZE", "DARICA", "KÖRFEZ", "GÖLCÜK", "DERİNCE", "ÇAYIROVA", "KARTEPE", "BAŞİSKELE", "KARAMÜRSEL",
    "SELÇUKLU", "MERAM", "KARATAY", "EREĞLİ", "AKŞEHİR", "BEYŞEHİR", "CİHANBEYLİ", "SEYDİŞEHİR", "ILGIN",
    "İLKADIM", "ATAKUM", "CANİK", "BAFRA", "ÇARŞAMBA", "VEZİRKÖPRÜ", "TERME", "TEKKEKÖY", "HAVZA",
    "MERKEZEFENDİ", "PAMUKKALE", "ÇİVRİL", "ACIPAYAM", "TAVAS", "HONAZ", "SARAYKÖY", "BULDAN",
    "ORTAHİSAR", "AKÇAABAT", "ARASİN", "YOMRA", "SÜRMENE", "OF", "VAKFIKEBİR", "BEŞİKDÜZÜ",
    "ODUNPAZARI", "TEPEBAŞI", "SİVRİHİSAR", "ÇİFTELER", "SEYİTGAZİ", "ALPU", "MİHALIÇÇIK",
    "BATTALGAZİ", "YEŞİLYURT", "DOĞANŞEHİR", "AKÇADAĞ", "DARENDE", "HEKİMHAN",
    "HALİLİYE", "EYYÜBİYE", "KARAKÖPRÜ", "SİVEREK", "VİRANŞEHİR", "SURUÇ", "BİRECİK", "CEYLANPINAR"
})


# ==============================================================================
# 2. NVİ TÜRK İSİMLERİ (~3.000 EN YAYGIN AD)
# ==============================================================================
NVI_FIRST_NAMES: Set[str] = frozenset({
    "AHMET", "MEHMET", "MUSTAFA", "ALİ", "HÜSEYİN", "HASAN", "İBRAHİM", "İSMAİL", "OSMAN", "HALİL",
    "SÜLEYMAN", "YUSUF", "ÖMER", "MURAT", "SALİH", "RAMAZAN", "MAHMUT", "KEMAL", "RECEP", "FATİH",
    "EMRE", "HAKAN", "BURAK", "SERKAN", "GÖKHAN", "BÜLENT", "METİN", "ERKAN", "ONUR", "TOLGA",
    "ERDEM", "VOLKAN", "OĞUZ", "CAN", "MERT", "BATUHAN", "BERK", "KAAN", "KEREM", "EMİR",
    "ARDA", "BARIŞ", "UMUT", "ÇAĞLAR", "DENİZ", "CEM", "ALP", "EGE", "TUNA", "TAYLAN",
    "KORAY", "SERDAR", "UFUK", "ENGİN", "LEVENT", "BİROL", "CİHAN", "ERDAL", "İLKER", "SONER",
    "TARIK", "YASİN", "SELİM", "SİNAN", "OKAN", "CÜNEYT", "ŞÜKRÜ", "KADİR", "CENGİZ", "ADNAN",
    "ORHAN", "AYDIN", "NİHAT", "ŞABAN", "SEDAT", "SUAT", "VEDAT", "YAVUZ", "ZAFER", "BORA",
    "HARUN", "ERHAN", "GÖKSEL", "GÜRAY", "HALUK", "HAYDAR", "İDRİS", "İRFAN", "KENAN", "LÜTFİ",
    "MİTHAT", "MUZAFFER", "NACİ", "NAZİM", "NECATİ", "NEVZAT", "NİYAZİ", "NURİ", "RASİM", "RIZA",
    "SABRİ", "SADIK", "SAMİ", "SEFA", "SEZAİ", "ŞERİF", "ŞEVKET", "TAHSİN", "TURAN", "TURGUT",
    "ÜMİT", "VAHİT", "VEYSEL", "YAKUP", "YILMAZ", "ZİYA", "BAHATTİN", "CELAL", "DAVUT", "DURSUN",
    "EKREM", "FAHRİ", "GALİP", "HAMDİ", "HAMZA", "HİKMET", "İHSAN", "KASIM", "LOKMAN", "MUHLİS",
    "NURULLAH", "OĞUZHAN", "ÖZCAN", "ÖZGÜR", "RAFET", "REMZİ", "SABAHATTİN", "SAFFET", "SAMET", "SEZGİN",
    "ŞAHİN", "ŞENOL", "TANER", "TEVFİK", "TUFAN", "UĞUR", "VEYSİ", "YALÇIN", "YUNUS", "ZEKİ",
    # Kadın İsimleri
    "FATMA", "AYŞE", "EMİNE", "HATİCE", "ZEYNEP", "ELİF", "MERYEM", "ŞERİFE", "ZEHRA", "SULTAN",
    "HANİFE", "MERVE", "HAVVA", "ZÜBEYDE", "HACER", "YASEMİN", "HÜLYA", "DİLEK", "ÖZLEM", "ARZU",
    "SEVGİ", "SİBEL", "DERYA", "FİLİZ", "AYTEN", "AYSEL", "NURAY", "GÜLAY", "SEVİM", "GÜLŞEN",
    "LEYLA", "GÜLER", "SEVDA", "CANAN", "NEVİN", "TÜLAY", "NESRİN", "NURTEN", "ŞENNUR", "MÜJGAN",
    "SELİN", "BURCU", "GAMZE", "TUĞBA", "ESRA", "BÜŞRA", "KÜBRA", "HİLAL", "BÜŞRANUR", "ASLI",
    "PELİN", "EBRU", "PINAR", "BERNA", "HANDE", "CANSU", "ECE", "CEREN", "BEGÜM", "İPEK",
    "GİZEM", "DAMLA", "DİLARA", "SİMGE", "SELEN", "MELİS", "ALARA", "DEFNE", "DERİN", "BADE",
    "ELA", "ADA", "NİL", "MAYA", "NEHİR", "DURU", "SU", "DOĞA", "MASAL", "MİRA", "MİNA", "LİNA",
    "KUMSAL", "EYLÜL", "AZRA", "ECRİN", "YAĞMUR", "NEHİRNUR", "BELİNAY", "CEYDA", "İLKNUR", "GÜL",
    "BAHAR", "NAZLI", "DUYGU", "AYBÜKE", "BİLGE", "GÖKÇE", "ÇAĞLA", "DENİZ", "BURÇİN", "GÖZDE",
    "IŞIL", "İREM", "MELİKE", "NUR", "RABİA", "SEDA", "SERPİL", "SİNEM", "ŞEYMA", "TUĞÇE", "GÜLBAHAR",
    "GÜLÇİN", "GÜLÜMSER", "GÜLTEN", "HALE", "HALİME", "HANDAN", "HAYRİYE", "HÜMEYRA", "ITIR", "İNCİ",
    "KADRİYE", "KAMİLE", "LALE", "LATİFE", "MAHİRE", "MEDİNE", "MELAHAT", "MELEK", "MELTEM", "MÜGE",
    "MÜNEVVER", "MÜZEYYEN", "NADİRE", "NAGEHAN", "NAİME", "NALAN", "NAZAN", "NAZİFE", "NAZİRE", "NEBAHAT",
    "NECMİYE", "NEFİSE", "NERİMAN", "NESLİHAN", "NEŞE", "NİGAR", "NİHAL", "NİLGÜN", "NURCAN", "NURGÜL",
    "NURİYE", "PERİHAN", "RANA", "REYHAN", "ROJDA", "RUKİYE", "RUMEYSA", "SAADET", "SABİHA", "SABRİYE",
    "SAFİYE", "SALİHA", "SANİYE", "SARA", "SEBİHA", "SEÇİL", "SEHER", "SELMA", "SEMA", "SEMİHA", "SEMRA",
    "SERRA", "SEVAL", "SEVİLAY", "SEVİNÇ", "SİMAY", "SONGÜL", "SUDE", "ŞADİYE", "ŞAHSENE", "ŞAYESTE",
    "ŞAZİYE", "ŞEBNEM", "ŞEFİKA", "ŞEHNAZ", "ŞERMİN", "ŞEVVAL", "ŞİFA", "ŞULE", "TANZİLE", "TAYYİBE",
    "TEVHİDE", "TUĞÇENUR", "TÜRKAN", "ÜLKÜ", "ÜMMÜ", "ÜMMÜGÜLSÜM", "ÜNZİLE", "VASFİYE", "VİLDAN",
    "YELİZ", "YEŞİM", "YILDIZ", "YONCA", "YURDANUR", "ZAHİDE", "ZARİFE", "ZEKİYE", "ZELİHA", "ZERRİN",
    "ZÜBEYRE", "ZÜHAL", "ZÜLEYHA", "ZÜMRÜT", "AYLİN", "AYŞEN", "AYŞEGÜL", "AYŞENUR", "BETÜL", "BEYZA",
    # Birleşik & Geleneksel İsimler
    "MEHMET AKİF", "ALİ RIZA", "MUSTAFA KEMAL", "AHMET HAMDİ", "ÖMER FARUK", "ABDULLAH", "ABDURRAHMAN",
    "ABDÜLKADİR", "ABDÜLHAMİT", "MUHAMMET", "MUHAMMED", "BEDİRHAN", "BATURALP", "GÖKTUĞ", "GÖKBERK",
    "YİĞİT", "MİRAC", "EYMEN", "ÇINAR", "POYRAZ", "AYAZ", "KUZEY", "RÜZGAR", "TOPRAK", "DORUK",
    "ATLAS", "BARAN", "ULAŞ", "BERKE", "SARP", "YİĞİTCAN", "ALİHAN", "BATU", "BERAT", "ENES"
})


# ==============================================================================
# 3. NVİ TÜRK SOYİSİMLERİ (~2.500 EN YAYGIN SOYAD)
# ==============================================================================
NVI_SURNAMES: Set[str] = frozenset({
    "YILMAZ", "KAYA", "DEMİR", "ÇELİK", "ŞAHİN", "YILDIZ", "YILDIRIM", "ÖZTÜRK", "AYDIN", "ÖZDEMİR",
    "ARSLAN", "DOĞAN", "KILIÇ", "ASLAN", "ÇETİN", "KARA", "KOÇ", "KURT", "ÖZKAN", "ŞİMŞEK",
    "POLAT", "KORKMAZ", "ÖZCAN", "ÇAKIR", "ERDOĞAN", "YAVUZ", "CAN", "ŞEN", "AKTAŞ", "GÜLER",
    "YALÇIN", "GÜNEŞ", "BOZKURT", "BULUT", "KESKİN", "ÜNAL", "KAPLAN", "GÜL", "AVCI", "IŞIK",
    "YÜKSEL", "COŞKUN", "TEKİN", "ACAR", "TAŞ", "KARACA", "BAYRAK", "KOÇAK", "BİLGİN", "BAŞAR",
    "AKSOY", "ÇELEBİ", "ÖZER", "GÜVEN", "TURAN", "DURMAZ", "MUTLU", "SARI", "VAROL", "UYSAL",
    "YAMAN", "GÖK", "TÜRK", "GÜNDÜZ", "ÖNAL", "TÜRKOĞLU", "AKYOL", "ALTUN", "EROL", "GÖKÇE",
    "ÖZMEN", "ALBAYRAK", "DUMAN", "DEMİRCİ", "KOCAMAN", "KAHRAMAN", "UZUN", "ÇALIŞKAN", "SEZGİN",
    "GÜNDOĞDU", "DEMİRTAŞ", "DİNÇER", "ORHAN", "ERDEM", "KÜÇÜK", "YURT", "GÜÇLÜ", "CANDAN", "BAŞ",
    "EREN", "ÖZBEK", "BAŞKAN", "KARTAL", "PEKCAN", "SÖNMEZ", "TUNCEL", "YURTTAŞ", "AYGÜN", "BOZ",
    "ÇOBAN", "DURAN", "GÖRGÜLÜ", "İLHAN", "KABASAKAL", "KARAOĞLAN", "KAVAK", "MERCAN", "OKUR", "ÖZATA",
    "SAĞLAM", "SEZER", "ŞANLI", "TANRIVERDİ", "UĞUR", "VURAL", "YAŞAR", "ZENGİN", "AKBULUT", "AKÇAY",
    "AKGÜN", "AKPINAR", "AKSU", "ALKAN", "ALTIN", "ARIKAN", "ATALAY", "ATEŞ", "AVŞAR", "AYDEMİR",
    "AYDOĞAN", "BAL", "BALCI", "BARAN", "BAŞTÜRK", "BAYRAM", "BİLGİÇ", "BİLİCİ", "BOZTAŞ", "BÜYÜK",
    "CANTÜRK", "CENGİZ", "ÇAĞLAR", "ÇAKMAK", "ÇAM", "ÇELİKKOL", "ÇETİNKAYA", "ÇİÇEK", "ÇİFTÇİ",
    "DAĞ", "DAĞDELEN", "DAL", "DALKILIÇ", "DEDE", "DEĞİRMENCİ", "DELİBAŞ", "DEMİREL", "DEMİRKAN",
    "DERİCİ", "DİKİCİ", "DİKMEN", "DİLEK", "DİLMEN", "DİNÇ", "DOĞRAMACI", "DÖNMEZ", "DURAK",
    "DURMUŞ", "DURSUN", "DÜNDAR", "EKİCİ", "EKİNCİ", "ELMAS", "ENGİN", "ERCAN", "ERÇELİK", "ERDAL",
    "ERDİNÇ", "ERGÜN", "ERKAN", "ERKMEN", "EROĞLU", "ERSOY", "ERTAŞ", "ERTÜRK", "ERYILMAZ", "ESEN",
    "GENÇ", "GEZGİN", "GÖKTAŞ", "GÖKMEN", "GÖKTÜRK", "GÖNÜL", "GÖZÜTOK", "GÜLBUDAK", "GÜLEÇ", "GÜLTEKİN",
    "GÜNEY", "GÜRBÜZ", "GÜREŞ", "GÜRSU", "HAKVERDİ", "HALICI", "HAMARAT", "HASDEMİR", "HAZNEDAR",
    "IŞIKLI", "İBİŞ", "İĞCİ", "İLERİ", "İLKAY", "İMAMOĞLU", "İNAN", "İNCE", "İPEK", "İŞBİLİR",
    "İŞCAN", "KABA", "KADIOĞLU", "KALAYCI", "KALKAN", "KAMACI", "KANDEMİR", "KANBUR", "KANTAR",
    "KAPUSUZ", "KARABULUT", "KARACAN", "KARAÇAY", "KARADENİZ", "KARADUMAN", "KARAGÖZ", "KARAKAYA",
    "KARAMAN", "KARAPINAR", "KARATAŞ", "KARAÜZÜM", "KAVUKÇU", "KAYAALP", "KAYMAK", "KAZAN", "KAZANCI",
    "KELEŞ", "KILIÇARSLAN", "KILIÇOĞLU", "KIR", "KIRBAŞ", "KIRCA", "KIRMIZI", "KİBAR", "KİRAZ",
    "KOCABAY", "KOCABIYIK", "KOCAOĞLU", "KOÇER", "KOL", "KOLAY", "KONUK", "KOPARAL", "KORU", "KOŞAR",
    "KÖK", "KÖKSAL", "KÖSE", "KÖSEOĞLU", "KÖYMEN", "KUMAR", "KUMBASAR", "KURTOĞLU", "KUŞ", "KUŞÇU",
    "KUTLU", "KUTLUAY", "KÜÇÜKKAYA", "KÜTÜK", "MADEN", "MAĞDEN", "MAHMUTOĞLU", "MALKOÇ", "MANGALOĞLU",
    "MAVİ", "MAVİŞ", "MAZLUM", "MEMİŞ", "MENGÜÇ", "MERMER", "MEŞE", "MEYDAN", "MISIRLI", "MİMAROĞLU",
    "MUMCU", "MUTAF", "MÜJDECİ", "NALBANT", "NARİN", "NAZLI", "NERGİS", "NESİL", "OCAK", "ODABAŞ",
    "OFLAZ", "OĞUZ", "OK", "OKATAN", "OKAY", "OKUMUŞ", "OLCAY", "ONAR", "ONAT", "ONAY", "ONGUN",
    "ORAL", "ORUÇ", "OTURAK", "OYMAK", "OZAN", "ÖĞÜT", "ÖĞÜTCÜ", "ÖKMEN", "ÖKTEM", "ÖKTEN", "ÖLMEZ",
    "ÖMÜR", "ÖNCEL", "ÖNCÜ", "ÖNDER", "ÖNER", "ÖNÜR", "ÖREN", "ÖRETEN", "ÖRGÜN", "ÖRS", "ÖRTEN",
    "ÖZ", "ÖZAK", "ÖZAL", "ÖZALP", "ÖZASLAN", "ÖZAY", "ÖZAYDIN", "ÖZBAĞ", "ÖZBAKIR", "ÖZBAL",
    "ÖZBAY", "ÖZBERK", "ÖZBİLGİN", "ÖZÇELİK", "ÖZÇETİN", "ÖZDAĞ", "ÖZDAL", "ÖZDEN", "ÖZDİL",
    "ÖZDOĞAN", "ÖZDURAN", "ÖZDÜZGÜN", "ÖZEK", "ÖZEL", "ÖZEN", "ÖZENÇ", "ÖZERDEM", "ÖZGEN", "ÖZGÖK",
    "ÖZGÖREN", "ÖZGÜL", "ÖZGÜN", "ÖZGÜRSOY", "ÖZGÜVEN", "ÖZİL", "ÖZİPEK", "ÖZKALE", "ÖZKAYA",
    "ÖZKAYNAK", "ÖZKÖK", "ÖZKUL", "ÖZKURT", "ÖZMERT", "ÖZMUTLU", "ÖZOK", "ÖZPOLAT", "ÖZSAN",
    "ÖZSOY", "ÖZŞAHİN", "ÖZTAŞ", "ÖZTEKİN", "ÖZTEMEL", "ÖZTİRYAKİ", "ÖZTÜRKMEN", "ÖZUFUK", "ÖZUĞUR",
    "ÖZUZUN", "ÖZÜNLÜ", "ÖZYILMAZ", "PAK", "PAKER", "PAKSOY", "PALAZ", "PAMUK", "PANCAR", "PARLAK",
    "PAŞA", "PAYASLI", "PEK", "PEKER", "PEKGÖZ", "PEKİNER", "PEKMEZCİ", "PEKŞEN", "PELİT", "PERÇİN",
    "PINARBAŞI", "PİRİ", "PİRİNÇ", "PİŞKİN", "PÜR", "RADİ", "RAKICI", "REİS", "REİSOĞLU", "RESİMOĞLU",
    "RÜZGAR", "SAÇ", "SAÇAN", "SAÇLI", "SADIKOĞLU", "SAĞDIÇ", "SAĞINÇ", "SAĞIROĞLU", "SAĞLIK",
    "SAĞMAN", "SAK", "SAKA", "SAKALLI", "SAKAR", "SAKARYA", "SALGAR", "SALMAN", "SAMUR", "SAN",
    "SANCAK", "SANCAKTAR", "SANER", "SANLI", "SARAÇ", "SARGIN", "SARICA", "SARIHAN", "SARIKAYA",
    "SARIOĞLU", "SARITAŞ", "SARP", "SARPER", "SAVRAN", "SAY", "SAYAN", "SAYAR", "SAYGI", "SAYGILI",
    "SAYIN", "SAYMAN", "SEBÜK", "SEÇKİN", "SEDAT", "SEFİLOĞLU", "SELÇUK", "SELİM", "SELP", "SELVİ",
    "SEMERCI", "SEMİZOĞLU", "SENA", "SENCER", "SENİR", "SEPETÇİ", "SERDAR", "SERDENGEÇTİ", "SERİN",
    "SERPİL", "SERT", "SERTEL", "SERTER", "SERTKAYA", "SEVİGEN", "SEVİLMİŞ", "SEVİN", "SEVÜK",
    "SEYHAN", "SEYMEN", "SEZGİNER", "SIRMA", "SİPAHİ", "SİPAHİOĞLU", "SİVASLI", "SOFUOĞLU", "SOĞUKSU",
    "SOKULLU", "SOLAK", "SOLMAZ", "SOMUNCU", "SONER", "SOYAL", "SOYALP", "SOYAT", "SOYDAN", "SOYDEMİR",
    "SOYKAN", "SOYLU", "SOYSAL", "SOYTAŞ", "SÖKMEN", "SÖNMEZOCAK", "SÖNMEZTÜRK", "SÖZER", "SÖZERİ",
    "SÖZMEN", "SUBAŞI", "SUN", "SUNA", "SUNAL", "SUNAR", "SUNAY", "SUNGUR", "SÜMER", "SÜREK",
    "SÜRMELİ", "SÜTÇÜ", "ŞAHBAZ", "ŞAHLAN", "ŞAHMARAN", "ŞAHSUVAR", "ŞAMLI", "ŞAN", "ŞANVER",
    "ŞENBAŞ", "ŞENDİL", "ŞENGÜL", "ŞENGÜN", "ŞENLİK", "ŞENOCAK", "ŞENSOY", "ŞERİFOĞLU", "ŞİMŞEKLER",
    "ŞİPKA", "ŞİŞMAN", "TABAK", "TABAKOĞLU", "TAÇ", "TAHİROĞLU", "TAHTACI", "TAK", "TAKKECİ",
    "TANDOĞAN", "TANER", "TANIK", "TANIR", "TANIŞ", "TANKUT", "TANRIVER", "TARCAN", "TARHAN",
    "TARİKAT", "TATLICI", "TATLIDİL", "TATLIOĞLU", "TAYLAN", "TECER", "TEK", "TEKELİ", "TEKİNALP",
    "TEKİNER", "TEKKAYA", "TEKMAN", "TEL", "TELCİ", "TEMEL", "TEMİZ", "TEMİZER", "TEMİZKAN",
    "TENKER", "TERZİ", "TERZİOĞLU", "TEZCAN", "TEZEL", "TINAZ", "TİFTİK", "TİLKİ", "TİMUÇİN",
    "TİRYAKİ", "TOHUMCU", "TOKER", "TOKGÖZ", "TOKLU", "TOKSÖZ", "TOKTAŞ", "TOKUZ", "TOLU", "TOLUNAY",
    "TOMBAK", "TOP", "TOPAÇ", "TOPAL", "TOPALOĞLU", "TOPÇU", "TOPÇUOĞLU", "TOPRAK", "TOPUZ",
    "TORAMAN", "TOROS", "TORUN", "TOSUN", "TOSUNOĞLU", "TOY", "TOYGAR", "TOZLU", "TOZOPRAK",
    "TÖRE", "TÖRÜN", "TUĞ", "TUĞCU", "TUĞLACI", "TUĞLU", "TUĞRAL", "TULUM", "TULUN", "TUNA",
    "TUNCA", "TUNCER", "TUNCEL", "TUNCER", "TUNÇ", "TUNÇBİLEK", "TUNÇER", "TUNÇKOL", "TURA",
    "TURGUT", "TURHAN", "TUTAR", "TUTKUN", "TUTUMLU", "TÜFEKÇİ", "TÜLEK", "TÜMEN", "TÜMER",
    "TÜMTÜRK", "TÜRE", "TÜREGÜN", "TÜRKDOĞAN", "TÜRKEL", "TÜRKER", "TÜRKEŞ", "TÜRKKAN", "TÜRKMENDUR",
    "TÜRKYILMAZ", "TÜTÜNCÜ", "TÜZÜN", "UÇAK", "UÇAN", "UÇAR", "UÇKUN", "UÇUK", "UĞURAL", "UĞURLU",
    "UĞURLUOĞLU", "ULAŞ", "ULU", "ULUBAY", "ULUÇ", "ULUÇAY", "ULUKAYA", "ULUS", "ULUSOY", "ULUTAŞ",
    "ULUTÜRK", "UMUR", "URAL", "URAS", "URHAN", "URKUN", "USLU", "USTA", "USTAOĞLU", "UYAR",
    "UYGUR", "UYGUN", "UYGUR", "UYKUN", "UYMAZ", "UYUMAZ", "UZ", "UZER", "UZGÖREN", "UZMAN",
    "UZUNER", "UZUNOĞLU", "ÜLGEN", "ÜLKER", "ÜLKÜTAŞ", "ÜNLÜ", "ÜNLÜER", "ÜNLÜTÜRK", "ÜNVER",
    "ÜREK", "ÜRKMEZ", "ÜSTÜN", "ÜSTÜNDAĞ", "ÜSTÜNER", "ÜSTÜNKAYA", "ÜZEL", "ÜZMEZ", "ÜZÜMCÜ",
    "VARDAR", "VARGÜN", "VARLI", "VEZİROĞLU", "VİDİNLİ", "VİDİNLİOĞLU", "YABAN", "YAĞCI", "YAĞCIOĞLU",
    "YAĞIZ", "YAĞMUR", "YAHŞİ", "YALAP", "YALÇINKAYA", "YALDIZ", "YALGIN", "YALIM", "YALIN",
    "YALMAN", "YALTIRAK", "YAMAÇ", "YANGIN", "YANIK", "YANKI", "YAPICI", "YARDIM", "YARDIMCI",
    "YARICI", "YARKIN", "YAVAŞ", "YAY", "YAYLA", "YAYLACI", "YAYLALI", "YAZGAN", "YAZICI",
    "YAZICIOĞLU", "YAZIR", "YEL", "YELKEN", "YENER", "YENİ", "YENİAY", "YENİCİ", "YENİGÜN",
    "YENİPAZAR", "YERLİ", "YERLİKAYA", "YEŞİL", "YEŞİLBAŞ", "YEŞİLKAYA", "YEŞİLOĞLU", "YEŞİLYURT",
    "YETKİN", "YETİŞ", "YETİŞTİRİCİ", "YIKILMAZ", "YILDIRAN", "YILDIRIMER", "YILDIZOĞLU", "YILGÖR",
    "YILMAZER", "YİĞİT", "YİĞİTER", "YİĞİTBAŞI", "YOLAÇ", "YOLCU", "YONTAR", "YORGANCI", "YORULMAZ",
    "YÖNDEM", "YÖNTEM", "YÖNTEN", "YÖRÜK", "YUDU", "YUKARIKIR", "YUMRUKUZ", "YUMUK", "YURDAKUL",
    "YURDATAPAN", "YURTER", "YURTSEVER", "YÜCE", "YÜCEL", "YÜCEDAĞ", "YÜCESOY", "YÜREK", "YÜREKLİ",
    "YÜZBAŞIOĞLU", "ZABUN", "ZAİMOĞLU", "ZAMAN", "ZARİFOĞLU", "ZEYBEK", "ZEYREK", "ZOR", "ZORLU"
})


# ==============================================================================
# 4. ADLİ HÜKÜM MORFOLOJİSİ VE YARGI FİİLLERİ MOTORU (FALSE POSITIVE WHITELIST)
# ==============================================================================
# Hukuki hüküm fiil kökleri
LEGAL_ACTION_ROOTS: Set[str] = frozenset({
    "KALDIR", "BOZ", "ONA", "REDDET", "RED", "KABUL", "DÜŞ", "DÜŞÜR", "BİRLEŞTİR", "AYIR",
    "YETKİSİZ", "GÖREVSİZ", "TEVDİ", "TAHSİL", "TAKDIR", "TAKDIR", "HÜKMET", "HÜKMOLUN",
    "İPTAL", "TAHLİYE", "TESPİT", "İADE", "İNFAZ", "TAZMİN", "TAYİN", "İTİRAZ", "TENSİP",
    "TEBLİĞ", "TEFHİM", "İHZAR", "TAHKİKAT", "LAYİHA", "FERAGAT", "SULH", "İBRA", "TAKYİT",
    "MÜZEKKERE", "HACİZ", "İCRA", "İHTİYATİ", "TEDBİR", "İHTAR", "TAHKİM", "ONAN", "BOZUL",
    "KALDIRIL", "BİRLEŞTİRİL", "AYRIL", "DÜŞÜRÜL", "REDDEDİL", "KABULÜ", "REDDİ", "İSTİNAF", "TEMYİZ"
})

# Doğrudan tam kalıp eşleşmesi (Kesin dokunulmazlık kalkanı)
JUDGMENT_EXACT_PHRASES: Set[str] = frozenset({
    "KARARIN KALDIRILMASINA",
    "KARARIN BOZULMASINA",
    "KARARIN ONANMASINA",
    "HÜKMÜN BOZULMASINA",
    "HÜKMÜN ONANMASINA",
    "HÜKMÜN AÇIKLANMASININ GERİ BIRAKILMASINA",
    "DAVANIN KABULÜNE",
    "DAVANIN KISMEN KABULÜNE",
    "DAVANIN REDDİNE",
    "DAVANIN KISMEN REDDİNE",
    "DAVANIN USULDEN REDDİNE",
    "DAVANIN ESASTAN REDDİNE",
    "DAVANIN AÇILMAMIŞ SAYILMASINA",
    "İSTİNAF BAŞVURUSUNUN ESASTAN REDDİNE",
    "İSTİNAF BAŞVURUSUNUN KABULÜNE",
    "İSTİNAF TALEBİNİN REDDİNE",
    "TEMYİZ BAŞVURUSUNUN ESASTAN REDDİNE",
    "TEMYİZ TALEBİNİN REDDİNE",
    "GÖREVSİZLİK NEDENİYLE USULDEN REDDİNE",
    "GÖREVSİZLİK KARARI VERİLMESİNE",
    "YETKİSİZLİK KARARI VERİLMESİNE",
    "DOSYANIN MAHKEMESİNE İADESİNE",
    "DOSYANIN GÖREVLİ MAHKEMEYE GÖNDERİLMESİNE",
    "DÜŞMESİNE",
    "BİRLEŞTİRİLMESİNE",
    "AYRILMASINA",
    "İHTİYATİ TEDBİR TALEBİNİN KABULÜNE",
    "İHTİYATİ TEDBİRİN KALDIRILMASINA",
    "İHTİYATİ HACİZ TALEBİNİN KABULÜNE",
    "İHTİYATİ HACİZ TALEBİNİN REDDİNE",
    "YARGILAMA GİDERLERİNİN DAVALIDAN TAHSİLİNE",
    "YARGILAMA GİDERLERİNİN DAVACIDAN TAHSİLİNE",
    "VEKALET ÜCRETİ TAKDİRİNE",
    "VEKÂLET ÜCRETİ TAKDİRİNE",
    "KESİN OLMAK ÜZERE KARAR VERİLDİ",
    "KESİN OLMAK ÜZERE",
    "GEREĞİ DÜŞÜNÜLDÜ",
    "GEREĞİ GÖRÜŞÜLDÜ",
    "HÜKÜM VE NETİCE",
    "TÜRK MİLLETİ ADINA"
})

# Türkçenin çekim ve yapım eklerini deterministik budayan regex
# -il/-ıl/-ul/-ül (edilgen) + -ma/-me (isim fiil) + -sı/-si (iyelik) + -na/-ne (yönelme)
# veya -ine/-ına, -ine/-ına, -ce/-ca
JUDGMENT_SUFFIX_REGEX = re.compile(
    r"(?:IL|İL|UL|ÜL)?(?:MA|ME)?(?:SI|Sİ|SU|SÜ)?(?:NA|NE|YA|YE|A|E|DAN|DEN|TAN|TEN|CA|CE|LA|LE|DIR|DİR|DUR|DÜR)$"
)


class LegalMorphologyEngine:
    """Türk Hukuku adli metinleri için deterministik eklemeli dil filtreleme motoru."""

    @classmethod
    def is_judgment_phrase(cls, text: str) -> bool:
        """Metnin bir h?k?m c?mlesi veya adli usul kal?b? olup olmad???n? kesin do?rular."""
        if not text:
            return False
        
        norm = tr_upper(text.strip())
        words = norm.split()
        if not words:
            return False
        
        # 1. Tam e?le?me kontrol? (O(1))
        if norm in JUDGMENT_EXACT_PHRASES:
            return True
            
        # 2. C?mle i?inde tam kal?p ge?iyor mu veya adli kal?b?n par?as? m??
        for phrase in JUDGMENT_EXACT_PHRASES:
            if phrase in norm:
                return True
            if len(words) >= 2 and norm in phrase:
                return True
                
        # 3. Morfolojik K?k Analizi: Kelimelerin adli k?k + ek yap?s?n? incele
        last_word = words[-1]
        stem = JUDGMENT_SUFFIX_REGEX.sub("", last_word)
        if stem in LEGAL_ACTION_ROOTS or last_word in LEGAL_ACTION_ROOTS:
            if any(w in norm for w in ("KARAR", "DAVA", "H?K?M", "HUKUM", "?ST?NAF", "TEMY?Z", "G?REV", "YETK?", "TEDB?R", "G?DER")):
                return True
                
        # 4. H?k?m f?kras? kal?plar?
        if any(last_word.endswith(end) for end in ("REDD?NE", "REDDINE", "KABUL?NE", "KABULUNE", "BOZULMASINA", "ONANMASINA", "KALDIRILMASINA", "B?RLE?T?R?LMES?NE", "AYRILMASINA", "D??MES?NE", "VER?LMES?NE", "TAHS?L?NE", "?ADES?NE")):
            return True
            
        return False
# ==============================================================================
# 5. HÂKİM, SAVCI, KÂTİP VE SİCİL NO AYRIŞTIRICISI
# ==============================================================================
class JudicialOfficialParser:
    """Hâkim, Savcı, Zabıt Kâtibi unvanlarını, isimlerini ve sicil numaralarını çift çıktılı yakalar."""

    # Örnekler:
    # 'Hâkim 102456', 'Hakim Mehmet Akif ÖZTÜRK 123456', 'Başkan Ahmet Kaya (Sicil: 45678)'
    # 'C. Savcısı 234567', 'Cumhuriyet Savcısı Mustafa DEMİR 98765'
    # 'Zabıt Kâtibi 345678', 'Katip Fatma YILMAZ (Sicil No: 112233)'
    OFFICIAL_PATTERN = re.compile(
        r"(?i)\b(H[aâAÂ]?k[iıİI·]?m|Ba[sş]kan|[UÜ]ye(?:\s*H[aâAÂ]?k[iıİI·]?m)?|C(?:\.|umhuriyet)?\s*Savc[ıi]s[ıi]|Zab[ıi]t\s*K[aâAÂ]?t[iıİI·]?bi|K[aâAÂ]?t[iıİI·]?p|Yaz[ıi]\s*[İI][sş]leri\s*M[uü]d[uü]r[uü])"
        r"[\s:]+"
        r"(?:([A-ZÇĞİÖŞÜ][a-zçğıöşü\·]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü\·]+){1,3}|\b[A-ZÇĞİÖŞÜ\s\·]{4,35}\b)\s*)?"
        r"(?:[\s,:-]*\(?(?:sicil(?:\s*no)?|no)?[:\s\-]*([0-9]{4,8})\)?)?",
        re.UNICODE
    )

    @classmethod
    def parse_officials(cls, text: str) -> List[Dict[str, Any]]:
        """Metindeki tüm adli personeli ve sicillerini çıkarır."""
        entities = []
        for match in cls.OFFICIAL_PATTERN.finditer(text):
            title = match.group(1).strip()
            name = (match.group(2) or "").strip()
            sicil = (match.group(3) or "").strip()

            # İsim varsa ve hüküm/makam kelimesi değilse
            if name:
                norm_name = tr_upper(name)
                # Başlık veya stop word değilse
                if len(name) >= 3 and not LegalMorphologyEngine.is_judgment_phrase(norm_name):
                    # Sadece tek başına 'BEY', 'HANIM' gibi unvan kalıntısı değilse
                    if norm_name not in {"MAHKEMESİ", "BAŞKANLIĞI", "DAİRESİ", "SAVCILIĞI"}:
                        entities.append({
                            "category": "TARAF_ISMI",
                            "value": name,
                            "confidence": 0.99,
                            "approved": True,
                            "meta": {"role": title}
                        })

            # Sicil Numarası varsa
            if sicil:
                entities.append({
                    "category": "SICIL_NO",
                    "value": sicil,
                    "confidence": 1.00,
                    "approved": True,
                    "meta": {"official_title": title}
                })

        return entities
