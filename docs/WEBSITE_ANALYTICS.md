# Web sitesi tıklanma raporları

CMS panelinde **Raporlar**, seçili AVM ve tarih aralığına göre tıklama/görüntüleme
sayıları, içerik adlarıyla sıralama, yol bazlı sıralama ve UTC günlük dağılım sunar.
`analytics` capability'si ve `analytics:view` yetkisi gerekir. Sayılar olay sayısıdır;
tekil ziyaretçi, dönüşüm veya satış ölçümü değildir. Web entegrasyonu yapılmadan
geçmiş ziyaretler için veri oluşmaz.

## Ön koşullar

- API ve admin sürümünü yayınlayın; `20261124120000_analytics_click_reporting`
  migration'ını `prisma migrate deploy` ile uygulayın. Mevcut kayıtlar korunur.
- Tenant için `analytics` özelliği etkin olmalı.
- Web domaini API Yönetimi → İzinli Domainler listesinde olmalı.
- Web API anahtarı, tenantId ve mallId mevcut public client yapılandırmasından gelir.
  Yönetici JWT'sini veya sunucu gizli anahtarlarını web'e koymayın.
- KVKK/çerez tercihlerinize göre ölçüme izin verilmeden olay göndermeyin.
  Form alanları, e-posta/telefon, arama metni, sorgu parametreleri veya URL tokenları
  göndermeyin. Bu altyapı bildirim/onay ekranını kendisi oluşturmaz.

## Public kayıt endpoint'i

`POST /public/analytics/track` — cache yok. Başarı: HTTP 201,
`{ "success": true, "data": { "accepted": true } }`.

Header'lar: `Content-Type: application/json`, `x-api-key`, `x-tenant-id`, `x-mall-id`.
Tenant/AVM body'den alınmaz. API anahtarı tenantı ve AVM sahipliği doğrulanır;
kimliği verilen içeriğin aynı tenant/AVM kapsamında bulunması gerekir.

```json
{
  "clientEventId": "1aecc5b6-cba8-4995-8270-a1da296cb129",
  "entityType": "STORE",
  "entityId": "CMS public stores yanıtındaki id",
  "eventType": "STORE_CLICK",
  "path": "/stores/adidas",
  "locale": "tr",
  "deviceType": "desktop",
  "metadataJson": { "source": "home-featured-stores" }
}
```

- Her gerçek etkileşim için yeni UUID (`crypto.randomUUID()`) üretin; aynı olay
  ağ hatası nedeniyle tekrar gönderilirse aynı UUID'yi kullanın. Başka bir tıklama
  için önceki UUID'yi kullanmayın. Kimlik verilmezse yeniden denemeler ayrı sayılır.
- `entityId`, CMS public API'nin döndürdüğü gerçek ID'dir; slug, marka havuzu ID'si
  veya kullanıcı üretimi ad gönderilmez. Mağazalarda **MallStore ID** kullanılır.
- `path`, görüntülenen veya tıklanarak gidilen **site içi hedef yol** olmalı;
  query/hash göndermeyin. `LINK_CLICK` ile menü/CTA'nın hedef yolu ölçülür.
- Zaman sunucuda atanır. İstemci timestamp'i kabul edilmez.
- İstek limiti IP+tenant+AVM başına 120/dakika; mevcut API anahtarı tenant limiti de
  geçerlidir. 429 geldiğinde ölçümü bırakın; gezinmeyi durdurmayın ve sık tekrar yapmayın.
- Yalnız `label` (en fazla 120), `source` (64) ve `targetPath` metadata alanları saklanır.
  Sorgu/hash'ler kaldırılır; AnalyticsEvent içinde ham IP, user-agent ve referrer kaydedilmez. IP yalnız
  günlük ve tenant bazlı hash olarak tutulur; kişi profili oluşturulmaz.

## Web'de bağlanacak olaylar

| Kullanıcı eylemi | entityType | eventType | entityId |
|---|---|---|---|
| İstemcide sayfa/rota açılması | PAGE | PAGE_VIEW | Gönderme |
| Mağaza kartına tıklama | STORE | STORE_CLICK | Public mağaza ID |
| Mağaza detayının açılması | STORE | STORE_VIEW | Aynı ID |
| Etkinlik kartına/bağlantısına tıklama | EVENT | EVENT_CLICK | Etkinlik ID |
| Etkinlik detayının açılması | EVENT | EVENT_VIEW | Etkinlik ID |
| Kampanya kartına tıklama | CAMPAIGN | CAMPAIGN_CLICK | Kampanya ID |
| Kampanya detayının açılması | CAMPAIGN | CAMPAIGN_VIEW | Kampanya ID |
| Sinema kartına tıklama | CINEMA | CINEMA_CLICK | Sinema ID |
| Sinema detayının açılması | CINEMA | CINEMA_VIEW | Sinema ID |
| Film kartına tıklama | MOVIE | MOVIE_CLICK | Film ID |
| Film detayının açılması | MOVIE | MOVIE_VIEW | Film ID |
| Seans/bilet bağlantısına tıklama | MOVIE_SESSION | MOVIE_SESSION_CLICK | Seans ID |
| Slayt grubuna tıklama | SLIDER | SLIDER_CLICK | Slider **grup** ID |
| Menü, genel CTA, iç bağlantı | CUSTOM | LINK_CLICK | Gönderme |

Bir tıklamayı hem kartta hem üst kapsayıcıda tekrar göndermeyin. Kart tıklaması
ile detay görüntülemesi farklı ölçümlerdir; ikisi ayrı kaydedilebilir. Hover,
render veya API'den içerik çekilmesi tıklama değildir. Sayfa görüntülemesini SSR,
prefetch ve render sırasında göndermeyin; tamamlanmış istemci rota geçişinde bir
kez gönderin. React StrictMode effect tekrarlarında aynı rota ziyaretinin olay
kimliğini koruyun. Rota yeniden gerçekten ziyaret edilirse yeni kimlik üretin.

## SDK ile kullanım

```ts
// Mevcut CmsPublicClient örneğiniz kullanılmalı. Örnek click handler:
function onStoreClick(store: { id: string; slug: string }) {
  if (!analyticsConsentGranted()) return;
  void cms.trackAnalytics({
    clientEventId: crypto.randomUUID(),
    entityType: 'STORE',
    eventType: 'STORE_CLICK',
    entityId: store.id,
    path: `/stores/${store.slug}`,
    locale: currentLocale,
    metadataJson: { source: 'store-list' },
  }).catch(() => { /* Ölçüm hatası gezinmeyi veya ekranı bozmaz. */ });
}
```

SDK `keepalive: true` ile JSON POST gönderir. Gezinme için isteği beklemeyin ve
`preventDefault()` çağırmayın. Eski `consoleAnalyticsAdapter` kayıt göndermez.
Header gerektirdiği için `sendBeacon` yerine `fetch(..., { keepalive: true })`
veya `cms.trackAnalytics` kullanın.

SDK yoksa:

```ts
void fetch(`${CMS_API_URL}/public/analytics/track`, {
  method: 'POST', keepalive: true,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': CMS_PUBLIC_API_KEY,
    'x-tenant-id': CMS_TENANT_ID,
    'x-mall-id': CMS_MALL_ID,
  },
  body: JSON.stringify(event),
}).catch(() => {});
```

İsteklerin public API anahtarını kullandığını unutmayın: bu ölçümler tarayıcı
kaynaklıdır; ad-blocker, izin reddi ve botlar sayıları etkileyebilir. Finansal
veya kesin ziyaretçi raporu olarak yorumlanmamalıdır.

## Admin rapor endpoint'leri

JWT + `x-tenant-id` + `x-mall-id` gerekir. `analytics:view` ve `analytics` kontrolleri
uygulanır. Tüm yanıtlar `no-store` döner.

- `GET /analytics/summary`: toplam olaylar ve tür bazlı tıklama/görüntüleme sayıları.
- `GET /analytics/top-content`: DB'de sıralanmış en çok etkileşim alan içerikler;
  `{ entityType, entityId, eventType, count, name }[]`.
- `GET /analytics/top-paths`: `{ path, eventType, count }[]`.
- `GET /analytics/timeseries`: UTC günlerine göre, boş günler dahil dağılım.

Sorgular: `dateFrom`, `dateTo` ISO tarihler (en fazla 366 günlük aralık),
`entityType`, `eventType`, `metric=clicks|views|all`, `limit=1..100`.
`eventType` verilirse metric yerine açık olay filtresi kullanılır. Özet geriye
uyum için mevcut alanlarını korur. Legacy `POST /analytics/track` artık anahtar
ve AVM gerektirir; yeni web entegrasyonunda `/public/analytics/track` kullanın.

## Doğrulama

Test ortamında bir mağazayı iki, başka bir mağazayı bir kez tıklayın. Rapor
filtrelerinde Mağazalar + Tıklamalar seçilince sıralamanın 2/1 olduğunu doğrulayın.
Aynı clientEventId ile isteği tekrarlayıp sayının artmadığını kontrol edin.
Etkinlik/kampanya/sinema/film ve genel menü bağlantısı için aynı kontrolü yapın.
Başka AVM'nin entityId'si ve sahte tenant header'ı kabul edilmemelidir.

## 403: Raporlama özelliği etkin değil

Bu hata CORS veya admin JWT hatası değildir. Public anahtar ve domain guard'larından
sonra, doğrulanmış tenant'ın `TenantCapability` kaydında `analytics` için
`enabled: true` bulunmadığında üretilir. Eksik kayıt da kapalı kabul edilir.
Aktif public API anahtarı tek başına raporlama özelliğini açmaz.

Süper yönetici **Platform → Lisanslar** ekranında ilgili müşteriyi seçip
**Raporlama (analytics)** özelliğini etkinleştirmelidir. Mevcut yönetim API'siyle
aynı işlem `PATCH /tenants/:tenantId/capabilities` üzerinden yapılabilir:

```json
{ "capabilities": [{ "code": "analytics", "enabled": true }] }
```

Bu işlem süper yönetici JWT'si ve `capability:update` yetkisi gerektirir;
bu JWT web sitesine konulmaz. Diğer özellikler değiştirilmez. Özellik kontrolü
cache kullanmadığından etkinleştirme sonrası track isteği hemen tekrar denenebilir.
Web isteğinde admin rolü/JWT gerekmez; anahtar, domain, tenant/AVM doğrulaması,
oran sınırları ve içerik sahipliği kontrolleri aynen geçerlidir. Özelliği tüm
tenant'lar için otomatik açmak veya veritabanını seed etmek çözüm olarak kullanılmaz.
