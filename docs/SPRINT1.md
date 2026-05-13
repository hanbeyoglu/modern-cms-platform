# Sprint 1 — Kimlik ve çok kiracı temeli

Bu sprintte API tarafında çok kiracı kimlik modeli, JWT girişi, yenileme belirteci, tenant/mall bağlam başlıkları ve temel yetki guard’ları eklendi.

## Ortam değişkenleri

`modern-cms/.env` içinde en az:

- `DATABASE_URL`
- `JWT_SECRET` (uzun ve rastgele)
- `JWT_ACCESS_TTL` (saniye, varsayılan 900)
- `JWT_REFRESH_TTL_DAYS` (varsayılan 30)

## Veritabanı

```bash
# Postgres + Redis
docker compose up -d postgres redis

# Migrasyon
pnpm db:migrate

# Seed
pnpm db:seed
```

## API uçları

- `POST /auth/login` — `{ "email": "...", "password": "..." }`
- `POST /auth/refresh` — `{ "refreshToken": "..." }`
- `GET /auth/me` — `Authorization: Bearer <access>`
- `GET /tenants/my` — Bearer
- `GET /malls/my` — Bearer, `mall:read` izni, isteğe bağlı `x-tenant-id` (süper admin için opsiyonel)

İsteğe bağlı başlıklar:

- `x-tenant-id` — aktif tenant
- `x-mall-id` — `@RequireMallContext()` ile işaretli uçlarda doğrulanır (şimdilik temel altyapı)

## Seed kullanıcıları

| E-posta | Şifre | Not |
| --- | --- | --- |
| `superadmin@example.com` | `SuperAdmin123!` | `isSuperAdmin` |
| `groupadmin@example.com` | `GroupAdmin123!` | Mall Group tenant admin |
| `mallmanager@example.com` | `MallManager123!` | Yalnızca Mall of İstanbul |

## Örnek testler

```bash
TOKEN="$(curl -sS -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@example.com","password":"SuperAdmin123!"}' | jq -r .accessToken)"

curl -sS http://localhost:4000/auth/me -H "Authorization: Bearer $TOKEN" | jq

curl -sS http://localhost:4000/tenants/my -H "Authorization: Bearer $TOKEN" | jq

curl -sS http://localhost:4000/malls/my -H "Authorization: Bearer $TOKEN" | jq

# Belirli bir tenant için (slug bilgisini seed çıktısından veya /tenants/my yanıtından alın):
curl -sS http://localhost:4000/malls/my \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: <TENANT_UUID>" | jq
```
