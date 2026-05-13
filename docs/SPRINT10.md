# Sprint 10 — Analitik ve raporlama temeli

## Mimari

- **Depolama**: Tüm olaylar PostgreSQL `AnalyticsEvent` tablosunda append-only tutulur. ClickHouse / BigQuery yok; yüksek hacimde okuma için ileride aynı şemanın kopyası veya event stream (Kafka → CH) düşünülebilir.
- **İzleme**: `POST /analytics/track` JWT gerektirmez; vitrin siteleri için `x-tenant-id` ve isteğe bağlı `x-mall-id` ile tenant/mall doğrulaması yapılır. Ham IP saklanmaz; `ANALYTICS_IP_SALT` (yoksa `JWT_SECRET`) ile SHA-256 hash yazılır.
- **Raporlama**: Admin uçları JWT + `TenantAccessGuard` + `MallAccessGuard` + `analytics:view` ile korunur. Mall başlığı yoksa tenant geneli (rol izin veriyorsa); `MALL_MANAGER` yalnızca erişebildiği malların `mallId` değerlerine göre filtrelenir.

## İzleme uç noktası

| Metot | Yol | Kimlik |
|--------|-----|--------|
| POST | `/analytics/track` | Herkese açık (`@Public`) |

İstek gövdesi örneği Sprint gereksinimleriyle uyumludur. `user-agent` başlığı otomatik kaydedilir. Rate limit bu sprintte yok; yorum olarak controller’da edge throttler önerilir.

## Rapor uç noktaları

| Metot | Yol | Yetki |
|--------|-----|--------|
| GET | `/analytics/summary` | `analytics:view` |
| GET | `/analytics/top-content` | `analytics:view` |
| GET | `/analytics/timeseries` | `analytics:view` |

Sorgu parametreleri: `dateFrom`, `dateTo` (ISO 8601), isteğe bağlı `entityType`, `eventType`, `limit` (top-content için, varsayılan 50).

**Özet alanları**: `totalEvents`, `pageViews`, `sliderClicks`, `eventViews`, `campaignClicks`, `storeViews`, `cinemaViews`.

## İzinler (seed)

| Kod | SUPER_ADMIN | TENANT_ADMIN | MALL_MANAGER | CONTENT_EDITOR | REPORT_VIEWER |
|-----|-------------|--------------|--------------|----------------|----------------|
| `analytics:view` | ✓ | ✓ | ✓ | — | ✓ |
| `analytics:export` | ✓ | ✓ | — | — | ✓ |

Dışa aktarma (CSV) henüz yok; izin ileride audit ile birlikte kullanılacak şekilde tanımlıdır.

## Admin

- **Raporlar** (`/analytics`): özet kartları, tarih/entity/event filtreleri, öne çıkan içerik tablosu, günlük zaman serisi tablosu (harici chart kütüphanesi yok).
- **Gösterge paneli**: `analytics:view` varsa son 7 gün için özetden iki kart gösterilir; yetki yoksa bölüm gösterilmez.

## Sınırlamalar

- Olaylar silinmez / güncellenmez (MVP).
- Her track için audit yok (gürültü).
- Zaman serisi gün kırılımı UTC.
- Büyük veri setlerinde yalnızca indekslere güvenilir; aşırı büyümede partition / dış analitik önerilir.

## Gelecek: ClickHouse / BigQuery

1. `AnalyticsEvent` üretimini değiştirmeden replicate veya CDC.
2. Rapor API’lerini okuma için CH/BQ’ye yönlendirme veya özet tabloları (günlük rollup) PG’de materyalize view.
3. Track uç noktasına queue (ör. Redis) + batch insert ile yazma gecikmesini düşürme.
