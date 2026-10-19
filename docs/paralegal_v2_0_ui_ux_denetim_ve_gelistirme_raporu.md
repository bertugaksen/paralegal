# Paralegal v2.0 — UI/UX Denetim ve İyileştirme Raporu

**Hedef Kitle:** Hukukçular, Avukatlar, Katip ve Hukuk Bürosu Çalışanları  
**Tasarım Dili:** Neo-Brutalism (Yüksek kontrast, sert gölgeler, kalın çerçeveler)  
**Temel Odak:** İşlem hızı, hata toleransı sıfır olan iş akışları, veri gizliliği algısı ve bilişsel yükün azaltılması.

---

## 1. Genel Değerlendirme & Tasarım Kimliği

Mevcut **Neo-Brutalism** estetiği, klasik hukuk yazılımlarının sıkıcı ve hantal görünümünden sıyrılarak uygulamaya modern, kararlı ve profesyonel bir hava katmaktadır. Ancak arayüzde yer alan bazı aşırı mühendislik/teknik terimleri, çiftlenen butonlar ve hukuk pratiğine özgü kritik görsel araçların eksikliği iş akışını yavaşlatmaktadır.

---

## 2. Ekran Bazlı Tespitler ve Çözüm Önerileri

### 2.1. Dashboard / Ana Modül Seçimi Ekranı

| Alan | Mevcut Durum | Sorun / Risk | Çözüm Önerisi (Aksiyon) |
| :--- | :--- | :--- | :--- |
| **Üst Bilgi Rozeti** | `%100 Çevrimdışı • Sıfır Telemetri` | "Telemetri" avukatlar için yabancı ve teknik bir terimdir. | **`%100 Çevrimdışı • Veriler Cihazınızda Kalır`** olarak güncellenmeli. |
| **Başlık & Yönerge** | "Bugün ne yapmak istiyorsunuz? Lütfen üzerinde çalışmak istediğiniz hukuki işlem modunu seçin." | Aşırı resmi ve gereksiz uzunlukta; bilişsel yük yaratıyor. | Sadece **`Ne yapmak istiyorsunuz?`** veya **`İşlem Seçin`** şeklinde sadeleştirilmeli. |
| **Kart Etiketleri** | `Hafif RAM` etiketi | Avukat için RAM optimizasyonu değil, UYAP limitleri ve büyük evrakları sorunsuz açması önemlidir. | Etiket **`Büyük Dosya Desteği`** veya **`UYAP Uyumlu`** olarak değiştirilmeli. |
| **Kart Tıklama Alanı** | Kartın altındaki küçük `... Aracını Aç →` butonları | Fitts Kanunu gereği tıklama hedefi küçüktür; avukat kartın boş yerine tıklayabilir. | Kartın tüm gövdesi tıklanabilir (`cursor: pointer`, hover animasyonu) yapılmalı. |

---

### 2.2. Belge / Görsel Yükleme Ekranları (Boş Durumlar)

| Alan | Mevcut Durum | Sorun / Risk | Çözüm Önerisi (Aksiyon) |
| :--- | :--- | :--- | :--- |
| **Çift Buton Çıkmazı** | Üst barda `PDF Dosyası Seç` / `Görsel Ekle`, ortada ise devasa `Bilgisayarımdan Dosya Seç` | Henüz belge seçilmemişken üst barda buton olması kullanıcının gözünü bölmektedir. | Belge yüklenene kadar üst bardaki buton gizlenmeli, sadece ortadaki ana yükleme alanı aktif olmalıdır. |
| **Sürükle-Bırak Göstergesi** | Standart bir kutu ve metin | Avukatlar masaüstünden veya taranmış klasörden sürüklemeye çok alışıktır. | Ortadaki kutunun çerçevesi kesikli çizgi (`border-dashed`) yapılmalı, açıkça **"Dosyaları buraya sürükleyip bırakın veya tıklayın"** yazılmalıdır. |
| **Alt Bilgi Metni** | `Dosyalar yerel hafızada akış halinde işlenir, RAM şişmesi önlenir.` | Aşırı teknik ve güvensizlik hissi yaratabilecek bir açıklama. | **`Tüm işlemler yerel olarak çalışır; hiçbir veri internete aktarılmaz.`** şeklinde güven veren bir dile dönüştürülmeli. |

---

### 2.3. Görsel Dönüştürücü Liste Ekranı

| Alan | Mevcut Durum | Sorun / Risk | Çözüm Önerisi (Aksiyon) |
| :--- | :--- | :--- | :--- |
| **Görsel Önizleme** | Listede sadece metin formatında dosya ismi (`ayla aslantaş biofeedback...`) var. | Avukat hangi sayfanın ters olduğunu veya görselin netliğini okuyamaz. | Her dosya satırının soluna **küçük bir görsel önizleme (thumbnail)** eklenmeli; tıklandığında büyütülebilmelidir. |
| **Sayfa Sıralama** | Sabit liste sırası (`#1`). | Taranan delillerde sayfalar karışık gelebilir; UYAP'a sunulurken kronoloji esastır. | Satırların soluna **sürükle-bırak kulakçığı (drag handle - `⋮⋮`)** eklenerek sayfaların sırası değiştirilebilir yapılmalıdır. |
| **Döndürme Aracı** | Yok. | Yan taranmış senet/vekaletnameler düzeltilemeden PDF yapılmak zorunda kalınıyor. | Liste satırına tek tıkla çalışan **`90° Sağa Döndür`** ikonu eklenmelidir. |
| **Buton Fazlalığı** | Üst barda `Görsel Ekle`, liste üstünde `+ Daha Fazla Ekle` var. | İki buton aynı amaca hizmet ediyor, arayüzü kalabalıklaştırıyor. | Liste üzerindeki `+ Daha Fazla Ekle` tutulmalı, üst bardaki buton kaldırılmalıdır. |
| **Aksiyon Butonu Konumu** | `PDF Olarak Kaydet` butonu sayfanın sağ ortasında boşlukta asılı duruyor. | Çok sayıda dosya eklendiğinde bu buton ekranın altına kayarak kaybolacaktır. | Buton ya liste panelinin hemen altına iliştirilmeli ya da sayfanın sağ alt köşesinde sabit (sticky) tutulmalıdır. |

---

### 2.4. Belge Anonimleştirme / Redaksiyon Ekranı

| Alan | Mevcut Durum | Sorun / Risk | Çözüm Önerisi (Aksiyon) |
| :--- | :--- | :--- | :--- |
| **Manuel Sansür Eksikliği** | Yalnızca regex/AI algılama ve arama kutusu var. | Model el yazısını, antetteki özel bir detayı veya kaşeyi kaçırabilir. Avukat panik yaşar. | Üst araç çubuğuna (Zoom yanına) **`Dikdörtgen Sansür Çiz` (Bant Çekme Aracı)** eklenmeli; avukat fareyle sürükleyip istediği alanı kapatabilmelidir. |
| **İstisna / Beyaz Liste** | Tespit edilen veride sadece silme (`çöp kutusu`) ve onay kutusu var. | Avukat kendi büro adını veya müvekkil unvanını belgenin her yerinde korumak isteyebilir. | Kartlara bir **"Her Yerde Yoksay (Beyaz Listeye Al)"** ikonu eklenmelidir (örneğin büro anteti için). |
| **Toplu İşlem Kapsamı** | `Bu Sayfadaki Veriler (2)` altında `Tümünü Seç • Kaldır` var. | 50 sayfalık bir mahkeme kararında avukat sayfa sayfa gezip onaylamak istemez. | Panelin üstüne **`Tüm Belgedeki Varlıkları Sansürle`** şeklinde global bir toplu onay butonu eklenmelidir. |
| **Başlık Taşması** | Sol üstteki dosya adı kutusu sabit (`ahmet çanga bilgi isteme...`). | Uzun dosya adlarında zoom ve kaydet butonlarını ekran dışına itebilir. | Başlık alanı için `max-width: 240px`, `text-overflow: ellipsis` uygulanmalı; üzerine gelindiğinde (tooltip) tam ad gösterilmelidir. |
| **Görsel Sansür Stili** | `Siyah Kutu`, `Beyaz Kutu`, `[SANSÜRLENDİ] Metni`. | Tıklanan seçeneğin doküman üstünde nasıl durduğu anında anlaşılmalıdır. | Seçilen stil dokümandaki maskelerin üzerinde **canlı önizleme (live preview)** olarak anında güncellenmelidir. |

---

## 3. Öncelikli Eylem Planı (Yol Haritası)

1. **Faz 1 (Hızlı Kazanımlar - 1-2 Gün):**
   * Gereksiz teknik metinlerin (`Telemetri`, `RAM Şişmesi`, `Çalışma Alanı Seçimi`) hukuk terminolojisine ve fayda diline uyarlanması.
   * Çiftlenen butonların (`Görsel Ekle`, `Dosya Seç`) elenmesi ve sürükle-bırak ipuçlarının belirginleştirilmesi.

2. **Faz 2 (Kullanılabilirlik & Güven - 3-5 Gün):**
   * Görsel Dönüştürücü'ye **Thumbnail (küçük resim)**, **Sayfa Döndürme (Rotate)** ve **Sıralama (Reorder)** özelliklerinin eklenmesi.
   * Anonimleştirme ekranına serbest seçim yapmayı sağlayan **Manuel Sansür Çizim Aracı** eklenmesi.

3. **Faz 3 (İleri Seviye Verimlilik):**
   * Çok sayfalı evraklarda tek tıkla tüm sayfaları işleyen global onay mekanizması.
   * UYAP dosya boyutu sınırı (örneğin dosya 10 MB'ı geçiyorsa kullanıcıyı uyaran indikatör) entegrasyonu.