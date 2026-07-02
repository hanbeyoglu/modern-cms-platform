# API dokümantasyonu

OpenAPI 3.1 spesifikasyonu NestJS controller dekoratörlerinden otomatik üretilir.

## Developer Portal

| URL | Açıklama |
|-----|----------|
| `/developer` | Scalar Developer Portal (frontend ekipleri için) |
| `/api/docs` | Swagger UI |
| `/openapi.json` | Ham OpenAPI JSON |

Ayrıntılar: [DEVELOPER_PORTAL.md](../DEVELOPER_PORTAL.md)

## Build artifact

`pnpm build` sonrası `apps/api/openapi/openapi.json` dosyası üretilir.

## Yerel smoke

1. `docker compose up -d postgres redis`
2. `pnpm --filter @modern-cms/api build`
3. `pnpm --filter @modern-cms/api start`
4. `curl -sS http://localhost:4000/health`
5. `curl -sS http://localhost:4000/openapi.json | head`
6. Tarayıcı: http://localhost:4000/developer

Nest DI doğrulaması: `pnpm --filter @modern-cms/api smoke:di:dist`

Public API rehberi: [PUBLIC_API_GUIDE.md](../PUBLIC_API_GUIDE.md)
