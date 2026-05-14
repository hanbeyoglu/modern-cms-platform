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

Nest DI doğrulaması (DB gerekli, derlenmiş çıktı): `pnpm --filter @modern-cms/api build` ardından `pnpm --filter @modern-cms/api smoke:di` veya `smoke:di:dist` (ikisi de `node dist/smoke-di.js`). `tsx` ile `src/smoke-di.ts` çalıştırmayın — decorator metadata güvenilir değildir. Prisma seed için `tsx` kullanımı `package.json` içinde kalır.

Detaylı modül incelemesi, curl script ve sınırlamalar: [SPRINT7_5.md](../SPRINT7_5.md).
