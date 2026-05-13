# Sprint 6 — Events & Campaigns Engine

Bu doküman, çok kiracılı CMS yönetim platformunda **Etkinlik (Event)** ve **Kampanya (Campaign)** içerik motorlarının veri modeli, izinler, API, denetim (audit) ve admin kullanımını özetler. Genel site (public) bu sprintte **yoktur**; yalnızca servis katmanında `getPublished*ForPublic` hazırlığı vardır.

## Veri modelleri

### ContentStatus

Tüm içerik yaşam döngüsü:

| Değer | Anlam |
|--------|--------|
| `DRAFT` | Taslak |
| `SCHEDULED` | Zamanlanmış (ileride otomasyon için ayrıldı; cron yok) |
| `PUBLISHED` | Yayında |
| `ARCHIVED` | Arşiv (aktif / public listelerinden çıkar) |

### Event

- `tenantId` zorunlu; `mallId` isteğe bağlı (tenant geneli veya AVM’e özel).
- `slug`: kiracı (`tenantId`) içinde **benzersiz** (`@@unique([tenantId, slug])`).
- `coverMediaId`: `MediaAsset` ile ilişki; yayınlama için **zorunlu** (iş kuralı).
- `startAt` / `endAt`: ikisi de doluysa `startAt < endAt` olmalı.
- `linkUrl`: doluysa geçerli **http(s)** URL.
- `dynamicFieldsJson`: JSON nesnesi; gelecekte ek alanlar (sponsor, galeri vb.) için.

### Campaign

- Event ile aynı temel alanlar + `terms`, `couponCode`, `storeId` (isteğe bağlı `MallStore`).
- `storeId` verilmişse: mağaza aynı `tenantId` altında olmalı; kampanyanın `mallId`’si doluysa mağaza **aynı AVM**’de olmalı.
- Slug benzersizliği: `tenantId` + `slug`.

## İzinler

| Kod | Açıklama |
|-----|----------|
| `event:read` | Etkinlik listele / detay |
| `event:create` | Oluştur |
| `event:update` | Güncelle |
| `event:delete` | Soft delete |
| `event:publish` | Yayınla |
| `event:archive` | Arşivle |
| `campaign:read` | Kampanya listele / detay |
| `campaign:create` | Oluştur |
| `campaign:update` | Güncelle |
| `campaign:delete` | Soft delete |
| `campaign:publish` | Yayınla |
| `campaign:archive` | Arşivle |

### Rol ataması (seed)

- **SUPER_ADMIN** / **TENANT_ADMIN**: tüm izinler.
- **MALL_MANAGER**: tüm `event:*` ve `campaign:*` izinleri (mevcut mall / mağaza izinleriyle birlikte).
- **CONTENT_EDITOR**: `read`, `create`, `update` (yayınlama / silme / arşiv yok).
- **REPORT_VIEWER**: yalnızca `event:read`, `campaign:read`.

Seed idempotent: `permission` upsert + rol başına `rolePermission` yeniden yazımı mevcut desenle uyumludur.

## API uç noktaları

Ortak başlıklar:

- `Authorization: Bearer <access_token>`
- `x-tenant-id: <tenantId>`
- `x-mall-id: <mallId>` (isteğe bağlı; gönderildiğinde `MallAccessGuard` ile doğrulanır)

### Events

| Metot | Yol | İzin |
|--------|-----|------|
| GET | `/events` | `event:read` |
| GET | `/events/:id` | `event:read` |
| POST | `/events` | `event:create` |
| PATCH | `/events/:id` | `event:update` |
| DELETE | `/events/:id` | `event:delete` |
| POST | `/events/:id/publish` | `event:publish` |
| POST | `/events/:id/archive` | `event:archive` |

**Liste sorgu parametreleri:** `page`, `limit`, `status`, `search`, `category`, `sortBy` (`sortOrder` \| `startAt` \| `createdAt`), `sortDir` (`asc` \| `desc`), `startFrom`, `startTo`, `endFrom`, `endTo`.

### Campaigns

| Metot | Yol | İzin |
|--------|-----|------|
| GET | `/campaigns` | `campaign:read` |
| GET | `/campaigns/:id` | `campaign:read` |
| POST | `/campaigns` | `campaign:create` |
| PATCH | `/campaigns/:id` | `campaign:update` |
| DELETE | `/campaigns/:id` | `campaign:delete` |
| POST | `/campaigns/:id/publish` | `campaign:publish` |
| POST | `/campaigns/:id/archive` | `campaign:archive` |

**Liste:** ayrıca `storeId` ile filtre.

### Kiracı / AVM davranışı

- Liste: `x-mall-id` gönderilirse **tenant geneli** (`mallId` null) kayıtlar da **görünür**; ayrıca seçili AVM’ye özel kayıtlar gelir (`OR: mallId = header OR mallId null`).
- `x-mall-id` ile tek kayıt: yalnızca `mallId` null (tenant geneli) veya **aynı mall** kayıtları okunabilir; diğer AVM’ye ait kayıt `404`.
- Oluşturma: `mallId` isteğe bağlı header’dan yazılır (slider ile aynı desen).

### Yayınlama kuralları

- **Başlık** zorunlu.
- **Kapak medyası** (`coverMediaId`) yayın için zorunlu; medya aynı tenant’ta olmalı; kampanya/etkinlik AVM’ye bağlıysa medya ya tenant geneli ya da **aynı AVM** olmalı.
- Tarih çifti tutarlı olmalı.

### Audit

`AuditLogService` ile metadata `before` / `after` kullanılır:

- `event:create` | `event:update` | `event:delete` | `event:publish` | `event:archive`
- `campaign:create` | `campaign:update` | `campaign:delete` | `campaign:publish` | `campaign:archive`

Kaynak: `resource` = `event` | `campaign`; `resourceId` = kayıt id.

### Public hazırlığı (API dışı tüketim için)

Servis metotları (şu an harici controller yok):

- `EventsService.getPublishedEventsForPublic({ tenantId, mallId?, search?, category? })`
- `CampaignsService.getPublishedCampaignsForPublic({ tenantId, mallId?, storeId?, search? })`

Dönen kayıtlar: `PUBLISHED`, `deletedAt` null, tarih aralığı varsa şu anki zamana uygun (`startAt` / `endAt`).

## cURL örnekleri

Aşağıdaki değişkenleri doldurun: `TOKEN`, `TENANT`, `MALL` (opsiyonel), `API` (örn. `http://localhost:4000`).

### Etkinlik oluştur

```bash
curl -sS -X POST "$API/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "x-mall-id: $MALL" \
  -H "Content-Type: application/json" \
  -d '{"title":"Yaz Konseri","startAt":"2026-07-01T18:00:00.000Z","status":"DRAFT"}'
```

### Etkinlikleri listele

```bash
curl -sS "$API/events?search=konser&status=DRAFT" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "x-mall-id: $MALL"
```

### Etkinliği yayınla

```bash
curl -sS -X POST "$API/events/<EVENT_ID>/publish" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "x-mall-id: $MALL"
```

### Kampanya oluştur

```bash
curl -sS -X POST "$API/campaigns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "x-mall-id: $MALL" \
  -H "Content-Type: application/json" \
  -d '{"title":"%20 İndirim","couponCode":"SUMMER20","status":"DRAFT"}'
```

## Admin kullanımı

- Menü: **Etkinlikler**, **Kampanyalar**.
- Tenant seçimi zorunlu; AVM başlığı slider / medya ile aynı şekilde isteğe bağlıdır.
- Kapak için medya listesi `GET /media` üzerinden doldurulur.
- Kampanyada mağaza seçimi: `GET /mall-stores` için **x-mall-id** gerekir; AVM seçili değilse seçici devre dışıdır.
- `dynamicFieldsJson` alanı basit bir JSON textarea ile düzenlenir (geçerli JSON nesnesi).

## dynamicFieldsJson

- Amaç: İleride blok editörü olmadan ekstra yapı (ör. `sponsor`, `cta`, `videoUrl`) saklamak.
- API: JSON **nesnesi** beklenir; kök düzeyde dizi kabul edilmez (DTO `IsObject`).
- Sınırlamalar: Şema doğrulaması yok; yanlış anahtarlar uygulama hatasına yol açmaz ancak istemci sorumluluğundadır.

## Bilinen sınırlamalar

- `SCHEDULED` durumu için zamanlayıcı / cron yok; yalnızca alan olarak kullanılabilir.
- Slug çakışmasında otomatik `-1`, `-2` … son eki üretilir.
- Public HTTP uçları yok; yalnızca servis içi `getPublished*ForPublic` metotları vardır.
- Etkinlik/kampanya gövdesi için zengin metin editörü yok (düz metin / textarea).

## Veritabanı

Migration klasörü: `apps/api/prisma/migrations/20260513140000_sprint6_events_campaigns/`

Komutlar (API uygulama dizininde):

```bash
cd apps/api
npx prisma migrate deploy
npx prisma db seed
```

Geliştirme ortamında sıfırdan uygulamak için:

```bash
cd apps/api
npx prisma migrate dev
npx prisma db seed
```

## Tip kontrolü

```bash
cd apps/api && npm run typecheck
cd apps/admin && npm run typecheck
```
