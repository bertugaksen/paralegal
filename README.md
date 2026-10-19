# ⚖️ Paralegal — Avukatlar İçin Yerel KVKK ve Belge Asistanı

**Paralegal**, avukatların UYAP üzerinden indirdikleri dava dilekçeleri, mahkeme kararları, tensip zaptı ve delil evraklarını **%100 yerel (offline)** olarak dönüştürmelerini ve KVKK (Kişisel Verilerin Korunması Kanunu) gereğince adli düzeyde kalıcı olarak anonimleştirmelerini sağlayan masaüstü uygulamasıdır.

**Avukados** tasarım sistemi, Muller yazı tipi ailesi ve sıcak krem/kömür renk paletiyle baştan tasarlanmıştır.

Hiçbir veri internete yüklenmez, sunucuya gönderilmez veya telemetri toplanmaz. Tüm işlemler doğrudan avukatın kendi bilgisayarında gerçekleşir.

---

## 🚀 Hızlı Başlangıç (Windows)

Programı çalıştırmak için **iki yöntem** kullanabilirsiniz:

### 1. Yöntem: Tek Tıkla Başlatma (Önerilen)
Proje klasöründeki [**`Paralegal.bat`**](file:///C:/Users/Hp/Desktop/yaz%C4%B1l%C4%B1m%20falan/Paralegal/Paralegal.bat) dosyasına çift tıklayın. Program otomatik olarak açılacaktır.

### 2. Yöntem: Terminal / Komut Satırından Başlatma
```powershell
cd "C:\Users\Hp\Desktop\yazılım falan\Paralegal"
python run_paralegal.py
```

---

## 🛠️ Temel Modüller ve Özellikler

### 1. 🛡️ KVKK Otomatik Tespiti ve Anonimleştirme (Redactor)
- **Kişi İsimleri:** Dilekçe taraf başlıklarındaki ad-soyadlar (*Davacı:*, *Davalı:*, *Sanık:*, *Vekili:* vb.), metin içi atıflar (*müvekkil Ahmet Yılmaz*, *borçlu Mehmet Ali*, *Av. Selin Arslan*) ve dilekçe sonundaki büyük harfli imzalar otomatik tespit edilir.
- **Şirket / Kurum Unvanları:** *A.Ş.*, *Ltd. Şti.*, *San. ve Tic.*, *Holding*, *Banka*, *Sigorta*, *Tasfiye Halinde ...* gibi tüm ticari unvanlar yakalanır.
- **Dosya Numaraları:** Mahkeme ve icra dairesi esas, karar ve dosya numaraları (*2024/1102 Esas*, *2023/89 Karar*, *2024/15 D.İş* vb.) otomatik işaretlenir.
- **TC Kimlik Numarası (TCKN):** 11 haneli TCKN'leri resmi algoritma sağlama kurallarına göre (düz, noktalı veya boşluklu) %100 doğrulukla tespit eder.
- **Banka IBAN & Telefon & Plaka:** TR IBAN'ları, sabit/cep telefonları ve araç tescil plakalarını bulur.
- **Belge İçi 1 Tıkla Arama & Sansürleme:** Avukat arama kutusuna dilediği bir ismi veya şirketi yazarak tüm sayfalarda saniyeler içinde sansür uygulatabilir.
- **Kalıcı Adli İmha (True Redaction):** `PyMuPDF` motoruyla sansür kutusu altındaki karakterleri, yazı tipi gliflerini ve görsel piksellerini PDF dosya kodundan **fiziksel ve kalıcı olarak siler**.

### 2. 🖼️ Evrak ve Tablo Dönüştürücü (Converter)
- **Görsel Formatları:** `.tiff`, `.tif`, `.jpeg`, `.jpg`, `.png`, `.bmp`, `.webp`
- **Excel Formatları:** `.xlsx`, `.xls` (İşçilik alacak hesapları, kıdem-ihbar tabloları, banka ekstreleri, faiz tabloları, cari hesap dökümleri)
- **Akıllı Sütun Sığdırma (Fit to Width):** Geniş hukuki tablolarda sütunların ikinci sayfaya bölünmesini kesin olarak önler. Tüm sütunları tek bir sayfa genişliğinde tutar.
- **Akıllı Sayfa Yönlendirmesi (Auto-Landscape):** Tablodaki sütun sayısını (≥6 sütun) analiz ederek sayfayı otomatik olarak Yatay (Landscape) A4 formatına ayarlar.
- **Başlık Satırını Yineleme (Repeat Header Rows):** Sayfalarca süren tablolarda sütun başlıklarını her sayfada otomatik yeniler.
- **Çok Sayfalı TIFF Desteği:** Mahkeme taramalarında sıkça karşılaşılan çok sayfalı TIFF dosyalarını tek bir PDF belgesine dönüştürür.
- **Toplu & Hibrit Birleştirme:** Birden fazla görseli ve Excel tablosunu tek bir UYAP uyumlu A4 PDF belgesinde birleştirir veya ayrı ayrı PDF yapar.

---

## 🎨 Avukados Tasarım Standartları

- **Tipografi:** Muller yazı tipi ailesi (Regular, Medium, Bold).
- **Renk Paleti:** Sıcak kağıt krem (`#f6f5f1`), temiz beyaz kartlar (`#ffffff`) ve derin kömür (`#101012`) karanlık modu.
- **Ergonomi:** Gözü yormayan geniş boşluklar, kafa karıştırmayan sade üst navigasyon ve dokunsal (*Neo-Brutalist*) eylem butonları.

---

## 🧪 Testleri Çalıştırma

Tüm birim ve güvenlik testlerini çalıştırmak için:
```powershell
python -m pytest tests -v
```
