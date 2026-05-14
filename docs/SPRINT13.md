# Sprint 13 — İçerik Zamanlama ve Yayın Akışı

Bu doküman, üretim tarzı **zamanlanmış yayın** ve **zamanlanmış arşivleme** (yayından kalkma) iş akışını özetler.

## Kapsam

| Varlık | Yayın tetikleyici | Yayından kalkma tetikleyici |
|--------|-------------------|---------------------------|
| Slider | `status=SCHEDULED` ve `startAt ≤ şimdi` | `status=PUBLISHED` ve `endAt ≤ şimdi` |
| Event | aynı (`startAt` / `endAt`) | aynı |
| Campaign | aynı | aynı |
| Page | `status=SCHEDULED` ve `publishAt ≤ şimdi` | `status=PUBLISHED` ve `unpublishAt ≤ şimdi` |

**Not (şema):** Slider, Event ve Campaign modellerinde zaten `startAt` / `endAt` vardı; bunlar sırasıyla **yayın anı** ve **yayından kalkma anı** olarak kullanılır. Ek `publishAt` / `unpublishAt` sütunları yalnızca **Page** modeline eklendi (gereksiz şema tekrarını önlemek için).

## Durum makinesi

Beklenen durumlar: `DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`.

- **DRAFT →** manuel yayın veya `SCHEDULED` + tarih alanları ile zamanlama.
- **SCHEDULED →** worker `startAt` / `publishAt` koşulu sağlanınca otomatik `PUBLISHED`; iptal için API üzerinden `DRAFT`e çekilir.
- **PUBLISHED →** `endAt` / `unpublishAt` doluysa worker ile otomatik `ARCHIVED` veya manuel arşiv.
- **ARCHIVED** geçmiş kayıt; mevcut API davranışı korunur.

## Mimari

```
┌─────────────┐     her 60s (WORKER_POLL_INTERVAL_MS)      ┌──────────────────────┐
│ Worker app  │ ─────────────────────────────────────────►│ runContentScheduling │
│ (Prisma)    │                                            │ Tick (paylaşılan pkg) │
└──────┬──────┘                                            └──────────┬───────────┘
       │                                                              │
       │  geçişler                                                    │ updateMany
       ▼                                                              ▼
┌──────────────┐   metadata: scheduledExecution   ┌─────────────────────────┐
│ audit_logs   │ ◄────────────────────────────────│ PostgreSQL              │
└──────────────┘                                 └─────────────────────────┘
       │
       │  public:{tenant}:{mall|none}:*
       ▼
┌──────────────┐
│ Redis cache  │  (ioredis KEYS + DEL, düşük hacimli namespace)
└──────────────┘
```

Paylaşılan paket: `@modern-cms/content-scheduling` — `runContentSchedulingTick(prisma, { now, batchSize })` hem worker hem (isteğe bağlı) API `ContentPublishService` tarafından kullanılır.

Nest tarafında:

- **`ContentPublishService`**: yalnızca Prisma geçişlerini çalıştırır.
- **`ContentSchedulingService`**: audit + `PublicCacheService.invalidatePublicKey('public:tenant:segment:*')` ile aynı mantığı test/smoke için sunar (üretim tick’i worker’da).

**`SchedulerRegistry`**: `SCHEDULER_REGISTRY` (`packages/content-scheduling`) — varlık türü başına hangi alanların kullanıldığının haritası (gözlemlenebilirlik).

## Worker yaşam döngüsü

1. `DATABASE_URL` ve `REDIS_URL` ile Prisma + Redis bağlanır.
2. İlk tick hemen, sonrakiler `WORKER_POLL_INTERVAL_MS` (varsayılan **60000** ms) ile çalışır.
3. Her tick: `runContentSchedulingTick` → her geçiş için sistem audit kaydı → ilgili `public:{tenantId}:{mallId|none}:*` önbellek anahtarları silinir.

## Otomatik yayın akışı

Örnek (Slider): `SCHEDULED`, `startAt = T0`, `deletedAt IS NULL`.

1. Worker `now ≥ T0` iken adayları `batchSize` (varsayılan 40) ile alır.
2. `updateMany({ where: { id, status: 'SCHEDULED', startAt: { lte: now } }, data: { status: 'PUBLISHED' } })` — **aynı satırda hâlâ SCHEDULED değilse satır sayısı 0** → idempotent, çift yayın yok.

Event/Campaign: ek olarak `publishedAt = now` set edilir.

Page: `publishAt` ile aynı mantık; yayında `publishedAt` set edilir.

## Otomatik arşiv akışı

Örnek: `PUBLISHED` ve `endAt` / `unpublishAt` geçmişte.

- `updateMany` yine durum + zaman koşulu ile korunur.
- `publishedAt` temizlenmez (tarihsel bilgi).

## Genel API görünürlüğü

Yalnızca `PUBLISHED` ve zaman penceresi içindeki içerik döner:

- **Slider / Campaign:** zaten `startAt` / `endAt` ile sınırlıydı.
- **Event liste:** `startAt ≤ now` eklendi; slug detayı da aynı AND ile filtrelenir.
- **Page:** `publishAt` / `unpublishAt` için `lte` / `gte` penceresi (`PublicContentService` + `PagesService` public yardımcıları).

## Önbellek geçersiz kılma

Worker, geçiş olan her kayıt için `public:{tenantId}:{mallId ?? 'none'}:*` desenini siler (API’deki `PublicCacheService` ile aynı isimlendirme). Bu, sliders, home, sayfa slug, kampanya ve etkinlik listelerinin hepsini tek seferde temizler (düşük kartinalite varsayımı).

## Audit örnekleri

| action | resource | metadata özeti |
|--------|----------|-----------------|
| `slider:auto-publish` | `slider` | `before.status`, `after.status`, `scheduledExecution: true` |
| `event:auto-archive` | `event` | aynı |
| `page:auto-publish` | `page` | aynı |

Sistem işlemleri: `actorUserId: null`.

## Hata / idempotency stratejisi

- Aynı tick birden çok worker ile çalışsa bile `updateMany` koşulları yarışları güvenli biçimde çözer.
- Tarama **tam tablo taraması değildir**: durum + zaman indeksleri ve `take: batchSize` ile sınırlı aday seti.
- Audit / Redis hataları worker’ı düşürmez (loglanır).

## Örnek zaman çizelgeleri

**A) Slider:** `DRAFT` → `SCHEDULED` (`startAt = yarın 09:00`) → ertesi gün worker `PUBLISHED` → `endAt = +7 gün` sonrası worker `ARCHIVED`.

**B) Sayfa:** `SCHEDULED` (`publishAt = Pazartesi 08:00`, `unpublishAt = Cuma 18:00`) → Pazartesi otomatik yayın → Cuma otomatik arşiv.

## Migration

```bash
pnpm db:migrate
# veya
pnpm --filter @modern-cms/api exec prisma migrate deploy
```

## Yerel worker

```bash
# .env içinde DATABASE_URL ve REDIS_URL
pnpm dev:worker
```

İsteğe bağlı ortam değişkenleri:

- `WORKER_POLL_INTERVAL_MS` (varsayılan 60000)
- `SCHEDULING_BATCH_SIZE` (varsayılan 40)

## Varsayımlar

- Onay zinciri ve e-posta yok (bilinçli olarak).
- Redis `KEYS` deseni mevcut düşük önbellek hacmine göre kabul edildi; yüksek hacimde `SCAN` ile değiştirilmelidir.

---

## Teslim özeti

### Migration

```bash
pnpm db:migrate
```

(Alternatif: `pnpm --filter @modern-cms/api exec prisma migrate deploy`)

### Worker davranışı

- İlk tick hemen; sonraki tick’ler `WORKER_POLL_INTERVAL_MS` (varsayılan 60s).
- `runContentSchedulingTick` → geçiş başına `audit_logs` (`{kind}:auto-publish` / `auto-archive`, `actorUserId: null`, metadata’da `before`/`after` ve `scheduledExecution: true`).
- Tenant + mall dalı için `public:{tenantId}:{mallId|none}:*` Redis anahtarları silinir.

### Audit metadata örneği

```json
{
  "before": { "status": "SCHEDULED" },
  "after": { "status": "PUBLISHED", "scheduledExecution": true }
}
```

### Zamanlama örnekleri

1. **Kampanya:** `SCHEDULED`, `startAt = 2026-06-01T08:00:00Z` → worker sonrası `PUBLISHED`; `endAt = 2026-06-30T23:00:00Z` → worker `ARCHIVED`.
2. **Sayfa:** `SCHEDULED`, `publishAt` / `unpublishAt` ile aynı akış (Page’de ayrı alanlar).

### Typecheck / build

Monorepo kökünde:

```bash
pnpm turbo typecheck build
```

### Paylaşılan paket derlemesi

`@modern-cms/content-scheduling` paketinde `prebuild` ile `apps/api/prisma/schema.prisma` üzerinden `prisma generate` çalışır; böylece şema ile uyumlu Prisma tipleri garanti edilir.
