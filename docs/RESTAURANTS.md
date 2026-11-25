# Restoran yönetimi

Restoranlar ayrı bir marka/veri kopyası değildir. Mağaza havuzundaki marka AVM’ye
`MallStore.kind = RESTAURANT` ile atanır. Aynı marka aynı AVM’ye iki kez atanamaz.
Mevcut restoran markası Mağazalar'da kayıtlıysa global havuzdan türünü Restoran
olarak değiştirin; aynı kayıt, katlar, çeviriler ve bağlı içerikler korunur.

- Restoranlar ve AVM Mağazaları ortak form/liste bileşenini kullanır.
- Restoran ekleme: havuzdan marka, kategori, çoklu kat, yerel başlık/açıklama,
  telefon/WhatsApp, çalışma saatleri, sıralama, durum ve görseller/slayt bağlantıları.
- RESTAURANT listesi `GET /mall-stores?kind=RESTAURANT`; mağaza listesi `kind=STORE`.
- Ekleme/güncelleme DTO'larında `kind` kabul edilir. Tenant/AVM kapsamı ve mevcut
  `mall-store:*` yetkileri korunur. Restoran menüsü de `mall-store:read` gerektirir.
- Public: `GET /public/stores?kind=RESTAURANT&locale=tr&page=1&limit=100`.
  Aynı public anahtar/domain/AVM kontrolleri, envelope, locale, cache ve pagination
  geçerlidir. `kind` cache anahtarındadır. Parametre verilmezse mevcut istemciler
  için iki tür de döner. Public detay `GET /public/stores/:slug` ile açılır.
- Public yanıt `kind` içerir; SDK `getStores({ kind: 'RESTAURANT' })` destekler.
- Migration `20261125100000_restaurant_store_kind`: eski kayıtların türü STORE olur.
  Restoran olduğu varsayılarak eski kayıtlara otomatik sınıflandırma yapılmaz.
  API yayını öncesinde migration uygulanmalıdır.

## Global tür kaynağı

Kayıt türü artık yalnızca global havuzda seçilir. Restoran ve mağaza atama
formlarında değiştirilemez. Her bölüm havuzu kendi türüyle filtreler; API de
uyuşmayan türü reddeder ve atama türünü global kayıttan belirler. Restoranların
kategori alanı/kolonu yoktur; restoran kaydı güncellenirken kategori bağlantısı
kaldırılır. Mağazaların kategori seçimi devam eder.

Global tür değişikliği, bağlı AVM kayıtlarının türünü aynı transaction içinde
senkronize eder. Restorana geçişte bağlı kategori seçimleri temizlenir.
`20261125110000_global_store_kind` migration'ı mevcut aktif restoran ataması olan
markaları RESTAURANT olarak taşır, diğer markaları STORE olarak korur; aynı
markanın AVM atamalarının türünü global türle eşitler.
