# API dokümantasyonu

Bu aşamada yalnızca sağlık uç noktası vardır:

- `GET /health` — süreç ve veritabanı bağlantısı için temel durum.

İleride:

- OpenAPI şeması ve sürümlenmiş public/admin uçları burada veya otomatik üretimle belgelenebilir.

## Yerel smoke (özet)

1. `docker compose up -d postgres redis` (proje compose dosyanıza göre)
2. `pnpm --filter @modern-cms/api build`
3. `pnpm --filter @modern-cms/api start`
4. `curl -sS http://localhost:4000/health`

Nest DI doğrulaması (DB gerekli): `pnpm --filter @modern-cms/api smoke:di` (kaynak, `tsx`) veya derleme sonrası `pnpm --filter @modern-cms/api smoke:di:dist` (`node dist/smoke-di.js`, prod imajlarında `tsx` gerekmez).

Detaylı modül incelemesi, curl script ve sınırlamalar: [SPRINT7_5.md](../SPRINT7_5.md).
