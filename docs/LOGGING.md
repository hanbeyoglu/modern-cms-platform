# Loglama kuralları (Modern CMS)

Bu belge Sprint 18 ile eklendi. Amaç: üretimde aranabilir, tutarlı ve **gizlilik dostu** log satırları; Pino/Winston geçişi yapılmadan önce ortak dil oluşturmak.

## Alanlar (önerilen sıra)

Üretim loglarında mümkün olduğunca şu alanlar bulunsun:

| Alan | Örnek | Not |
|------|--------|-----|
| `service` | `api`, `worker` | Zorunlu benzeri önek: `[service=api]` |
| `version` / `gitSha` | `1.2.3`, `abc123f` | `APP_VERSION`, `APP_GIT_SHA` (Docker build args veya CI) |
| `op` | `GET /health`, `health.redis` | HTTP için `method path`; arka plan için kısa işlem adı |
| `tenantId` | UUID veya `n/a` | İstek bağlamında `x-tenant-id` / `req.tenantId` |
| `mallId` | UUID veya `n/a` | `x-mall-id` / `req.mallId` |
| `message` | Kısa, eyleme yönelik hata metni | Stack trace ayrı; şifre/token asla |

Metin formatı (şimdilik Nest `Logger` ve `console` ile uyumlu):

```text
[service=api] [version=…] [gitSha=…] [op=GET /pages] [tenantId=…] [mallId=…] …
```

## API (NestJS)

- Başlangıç: `main.ts` içinde `[service=api]` önekli özet (port, `NODE_ENV`, sürüm, git SHA).
- HTTP 5xx: `HttpExceptionFilter` sunucu tarafı hatalarında `[service=api]` + sürüm + `op` + tenant/mall + mesaj loglar (JWT veya gövde loglanmaz).
- Sağlık / Redis: `HealthService` ve `PublicCacheService` uyarıları `[service=api]` ve `op=…` ile ayrıştırılır.

## Worker

- Tüm satırlar `[service=worker]` ile başlar; hazır olduğunda `version` ve `gitSha` env üzerinden yazılır.

## Asla loglama

- JWT, oturum çerezleri, `Authorization` başlığı
- Parolalar, `DATABASE_URL` / `REDIS_URL` tam metin (maskeli özet kullanın)
- Ham IP (GDPR / gizlilik politikasına göre maskeleme veya hash; varsayılan: audit dışında loglamayın)
- Gizli anahtarlar, API anahtarları
- Kullanıcıların kişisel verileri (e-posta, telefon vb.) — yalnızca destek için açıkça gerekliyse ve politika uygunsa, aksi halde ID kullanın

## Hata izleme (Sentry) — ileride

Sentry entegrasyonu bu sprintte **zorunlu değil**; önerilen kurulum:

1. **SDK**: `@sentry/node` (API) ve isteğe bağlı worker için ayrı proje veya aynı proje + `tags.service`.
2. **Yakalamak iyi olanlar**: işlenmemiş exception’lar, 5xx kök nedeni, release (`APP_VERSION` + `APP_GIT_SHA`), ortam (`NODE_ENV`).
3. **Hariç tutulması zorunlu olanlar**: yukarıdaki “Asla loglama” listesi; istek gövdesi ham hali; `Cookie` / `Authorization`; tam SQL parametreleri şifre içeriyorsa.
4. **PII**: Sentry’de scrubbing kuralları; `beforeSend` ile hassas alanları kaldırın.

## Sınırlamalar

- Yapılandırılmış JSON log yok; log toplayıcı (Loki, CloudWatch vb.) entegrasyonu sonraki sprintlere bırakılabilir.
- İstek başına otomatik `requestId` middleware’i bu belgede tanımlanmıştır ancak kodda zorunlu kılınmamıştır; ihtiyaç halinde eklenebilir.
