# Paralegal v2.0 — Renk Paleti & Arayüz Sadeleştirme Rehberi

Bu belge, **Paralegal v2.0** masaüstü uygulamasındaki görsel gürültüyü sonlandırmak, bilişsel karmaşayı gidermek ve uygulamayı **3 Renk Disiplinine (60 - 30 - 10 Kuralı)** oturtmak amacıyla hazırlanmıştır.

---

## 1. Yeni Renk Mimarisi (3 Temel Renk)

| Renk Grubu | Renk Adı | HEX Kodu | Arayüz Oranı | Kullanım Alanı ve Görevi |
| :--- | :--- | :--- | :--- | :--- |
| **Zemin (Base)** | **Warm Legal Sand (Sıcak Bej)** | `#F4EFEA` (veya panel içi `#FFFFFF`) | **%60** | Tüm sayfa zemini, ana çalışma alanı, kart zeminleri. Gözü kamaştırmayan kağıt dokusu hissi verir. |
| **Yapı (Structural)** | **Deep Charcoal (Mürekkep Siyahı)** | `#121316` | **%30** | Tipografi, ikonlar, sert kart çerçeveleri (`border-2`), pasif butonlar, gölgeler (`box-shadow: 4px 4px 0px #121316`). |
| **Vurgu (Accent)** | **Legal Cobalt / Navy (Hukuk Laciverti)** | `#1E3A8A` (Hover: `#172554`) | **%10** | **Yalnızca birincil aksiyonlar:** Nihai işlem butonları (`PDF Kaydet`), seçili aktif filtre durumları, ana odak noktaları. |

---

## 2. Tasarım Belirteçleri (Design Tokens / CSS / Tailwind)

Geliştirici ekibin doğrudan entegre edebilmesi için tanımlamalar:

```css
:root {
  /* Zemin Tonları */
  --bg-primary: #F4EFEA;       /* Sıcak Bej Canvas */
  --bg-surface: #FFFFFF;       /* Kart ve Doküman İçi Beyaz */
  --bg-subtle: #EAE3DC;        /* Ayrıcı Çizgiler & Pasif Arka Plan */

  /* Yapı & Tipografi (Siyah / Kömür) */
  --text-main: #121316;        /* Başlıklar ve Gövde Metni */
  --text-muted: #575A65;       /* Açıklama ve Alt Metinler */
  --border-dark: #121316;      /* Neo-Brutalist Kalın Çerçeveler */
  --shadow-dark: #121316;      /* Sert Düşen Gölgeler */

  /* Vurgu (Kurumsal Lacivert / Mavi) */
  --primary-accent: #1E3A8A;   /* Primary Action Butonları */
  --primary-hover: #172554;    /* Buton Hover / Aktif Durum */
  --primary-text: #FFFFFF;     /* Buton İçi Beyaz Yazı */
}
```

---

## 3. Ekranlardaki Mevcut Renklerin Temizlenmesi (Mapping)

### 3.1. Ana Sayfa (Dashboard)
* **Kaldırılacaklar:**
  * Üst bardaki soluk nane yeşili `%100 Çevrimdışı` kutusu.
  * Kart üzerindeki sarı `ÖNERİLEN` rozeti.
  * Kart üzerindeki yeşil `YÜKSEK HIZ` rozeti.
* **Yeni Uygulama:**
  * `%100 Çevrimdışı` rozeti: Şeffaf zemin, `border: 2px solid #121316`, siyah kilit ikonu.
  * `ÖNERİLEN` ve `YÜKSEK HIZ` etiketleri: Siyah çerçeveli, beyaz zeminli veya tamamen nötr bej zeminli minimal etiketler.
  * Kart altındaki aksiyon butonları: Derin Siyah zemin üzerine beyaz metin; hover durumunda Hukuk Laciverti (`#1E3A8A`).

### 3.2. Dosya Seçim & Yükleme Ekranları
* **Kaldırılacaklar:**
  * En alttaki yeşil onay ikonu ve yeşil güvenlik metinleri.
* **Yeni Uygulama:**
  * Güvenlik bildirimi ikonu ve metni doğrudan nötr `text-muted` (`#575A65`) veya `text-main` (`#121316`) tonuna çekilecek.
  * Dosya sürükleme alanı: Bej zemin üzerinde kesikli siyah çerçeve (`border: 2px dashed #121316`).

### 3.3. Belge Anonimleştirme Ekranı
* **Kaldırılacaklar:**
  * Üst bardaki açık mavi `Yeniden Tara` butonu.
  * Üst bardaki parlak zümrüt yeşili `Güvenli PDF Kaydet` butonu.
  * Sağ panelde tespit listesindeki sarı/turuncu `Dosya No` etiket rengi.
* **Yeni Uygulama:**
  * `Yeniden Tara` butonu: İkincil eylem (Secondary Action) olarak beyaz zemin, siyah çerçeve, siyah metin.
  * `Güvenli PDF Kaydet` butonu: **Hukuk Laciverti (`#1E3A8A`)** zemin, beyaz metin, siyah sert gölge. Sayfadaki tek renk odağı burası olmalıdır.
  * Sağ paneldeki tespit kutuları (`Dosya No`, `TARAF_ISMI` vb.): Renkli arkaplanlar yerine siyah ince çerçeveli ve şeffaf/bej etiketler.

### 3.4. Görsel Dönüştürücü Liste Ekranı
* **Kaldırılacaklar:**
  * Sağ ortada tek başına duran yeşil `PDF Olarak Kaydet` butonu.
* **Yeni Uygulama:**
  * `PDF Olarak Kaydet` butonu: **Hukuk Laciverti (`#1E3A8A`)** zemin ile liste altına veya sabit alt bara yerleştirilir.

---

## 4. AntiGravity İçin Hızlı Özet (Özet Direktif)

1. **Görsel Gürültüyü Sıfırla:** Zümrüt yeşili, bebek mavisi ve hardal sarısı arayüzden tamamen çıkartılsın.
2. **Bej Tuval Oluştur:** Uygulama genelinde soğuk dijital beyazlar yerine mat, kağıt hissi veren `#F4EFEA` bej arka plan kullanılsın.
3. **Tek Bir Eylem Rengi Tanımla:** Kullanıcının tıklaması gereken son ve en önemli butonlar (PDF Oluştur, Kaydet) için kurumsal **#1E3A8A** (Hukuk Laciverti) rengi "Primary CTA" olarak atansın.