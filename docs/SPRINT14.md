# Sprint 14 — Bildirim Merkezi ve Operasyonel Uyarılar

Bu sprint, CMS kullanıcıları için **uygulama içi bildirim merkezi** ekler. E-posta, SMS veya mobil push **kapsam dışıdır**; WebSocket veya gerçek zamanlı kanal **yoktur**. Bildirimler REST API üzerinden okunur ve arayüz periyodik olarak (ör. 60 sn) veya sayfa açılışında yenilenir.

## Mimari

- **Veri**: PostgreSQL’de `Notification` tablosu (Prisma). Okunma `readAt`; silme **yumuşak** (`deletedAt`).
- **API**: NestJS `NotificationsModule`, JWT + tenant (`x-tenant-id`) + isteğe bağlı mall (`x-mall-id`) bağlamı.
- **Görünürlük**: Kullanıcı; kendisine atanan (`userId`), tenant geneli (`mallId` null), erişebildiği mall’lara özel, ve (işçi hatası hariç) **platform geneli** `tenantId/mallId/userId` hepsi null kayıtları görebilir. İşçi hata bildirimleri yalnızca **super admin** için `metadataJson.workerFailure === true` ile işaretlenir.
- **Worker**: İçerik zamanlama tick’i başarılı geçişlerde `SCHEDULING` + `SUCCESS` bildirimi yazar; tick tamamen başarısız olursa `SYSTEM` + `ERROR` + `workerFailure` meta ile yazar.

## Prisma

Modeller ve enum’lar: `Notification`, `NotificationType`, `NotificationSeverity` (`apps/api/prisma/schema.prisma`).

## İzinler

| Kod | Açıklama |
|-----|----------|
| `notification:read` | Listeleme ve okunmamış sayısı |
| `notification:update` | Okundu / tümünü okundu |
| `notification:delete` | Yumuşak silme |

Rol atamaları seed’de: `SUPER_ADMIN` / `TENANT_ADMIN` tamamı; `MALL_MANAGER`, `CONTENT_EDITOR`, `REPORT_VIEWER` için **read + update** (delete yok).

## API uç noktaları

Tümü `Authorization: Bearer`, `x-tenant-id` zorunlu; `x-mall-id` isteğe bağlı.

| Metot | Yol | İzin |
|--------|-----|------|
| GET | `/notifications` | `notification:read` |
| GET | `/notifications/unread-count` | `notification:read` |
| PATCH | `/notifications/:id/read` | `notification:update` |
| PATCH | `/notifications/read-all` | `notification:update` |
| DELETE | `/notifications/:id` | `notification:delete` |

**Sorgu parametreleri** (`GET /notifications`): `unread` (`true` / `false`), `severity`, `type`, `limit` (1–100, varsayılan 30), `skip`.

## Worker davranışı

Her başarılı `ScheduleTransition` sonrası:

- `type`: `SCHEDULING`
- `severity`: `SUCCESS`
- `tenantId` / `mallId`: geçişten
- `entityType` / `entityId`: örn. `page` + sayfa id
- `metadataJson.transition`: ham geçiş nesnesi

Tick `catch` bloğunda: tek satır `SYSTEM` / `ERROR`, `metadataJson: { workerFailure: true }`, mesaj kısaltılmış hata metni.

## Admin arayüzü

- Üst çubukta **zil** (`NotificationBell`): okunmamış sayacı, son 8 bildirim, okundu / tümünü okundu, `/notifications` bağlantısı.
- **`/notifications`**: filtreler (okunma durumu, önem, tür), tablo, okundu ve sil (izin varsa).
- **Gösterge paneli**: “Son operasyonel bildirimler” kartı (en fazla 5).

Varlık bağlantıları: `page` → `/pages/:id`; diğer türler için liste rotalarına kısa yol (ör. `/events`).

## Komutlar

Veritabanı migrasyonu (API paketinden):

```bash
pnpm --filter @modern-cms/api exec prisma migrate deploy
```

Yerel geliştirme için şema uygulama:

```bash
pnpm --filter @modern-cms/api exec prisma migrate dev
```

Seed (izinler ve rol eşlemeleri):

```bash
pnpm --filter @modern-cms/api exec prisma db seed
```

## Örnek API istekleri

```http
GET /notifications?unread=true&limit=20
Authorization: Bearer <token>
x-tenant-id: <tenantId>
x-mall-id: <mallId>
```

```http
PATCH /notifications/read-all
Authorization: Bearer <token>
x-tenant-id: <tenantId>
```

```http
PATCH /notifications/clxxxxxxxx/read
Authorization: Bearer <token>
x-tenant-id: <tenantId>
```

## Sınırlamalar ve varsayımlar

- Gerçek zamanlı itme yok; kullanıcı yenileme veya periyodik istekle güncellenir.
- Çapraz tenant kullanıcı bildirimi yok; kişisel satırlar `userId` ile hedeflenir.
- `NotificationService.createNotification` API içinde yeniden kullanılabilir; worker Prisma ile doğrudan yazar (Nest DI yok).
- Gelecekte e-posta/push eklenirse aynı tablo veya ayrı kuyruk düşünülmelidir; bu sprint bunları tanımlamaz.
