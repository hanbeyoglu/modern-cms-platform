# Sprint 7.5 — Backend stabilite ve çalışma zamanı doğrulama

Bu sprintte yeni CMS ürün özelliği eklenmedi; NestJS modül kablolaması, DI doğrulaması ve yerel smoke akışı netleştirildi.

## Ne incelendi?

| Modül | Access guard kullanımı | `AccessModule` | `AuditLogService` | `AuditModule` | `PrismaService` |
|--------|-------------------------|----------------|-------------------|---------------|-----------------|
| `AuthModule` | `AccessController`: `PermissionsGuard` | import | `AuthService` | import | Global `PrismaModule` |
| `AccessModule` | Kendi controller + guard sağlayıcıları | — | — | — | Global |
| `AuditModule` | — | — | — | — | Global |
| `TenantsModule` | — (JWT ile korunur); `TenantsService` → `AccessService` | import | — | — | Global |
| `MallsModule` | `TenantAccessGuard`, `MallAccessGuard`, `PermissionsGuard` | import | — | — | Global |
| `MediaModule` | Üç guard | import | `MediaService` | import | Global |
| `SlidersModule` | Üç guard | import | `SlidersService` | import | Global |
| `StoreCategoriesModule` | `TenantAccessGuard`, `PermissionsGuard` | import | `StoreCategoriesService` | import | Global |
| `GlobalStoresModule` | `TenantAccessGuard`, `PermissionsGuard` | import | `GlobalStoresService` | import | Global |
| `MallStoresModule` | Üç guard | import | `MallStoresService` | import | Global |
| `EventsModule` | Üç guard | import | `EventsService` | import | Global |
| `CampaignsModule` | Üç guard | import | `CampaignsService` | import | Global |
| `HealthModule` | Yok | — | — | — | Global |

### Modül import bulguları

- **`PrismaModule` global** (`@Global()`). Alt modüllerde `PrismaService` için ayrıca `PrismaModule` import etmeye gerek yok; `EventsModule` ve `CampaignsModule` içindeki yinelenen importlar kaldırıldı (davranış aynı, grafik sade).
- **Guard kullanan her feature modülü** zaten `AccessModule` import ediyor; `Events` / `Campaigns` için eksik `AccessModule` kaynaklı DI hatası bu sprint öncesi giderilmişti; kontrol doğrulandı.
- **`AuditLogService` enjekte eden servisler** bulunduğu modülde `AuditModule` import ediyor (`Auth`, `Media`, `Sliders`, `StoreCategories`, `GlobalStores`, `MallStores`, `Events`, `Campaigns`).
- **Yinelenen provider**: Guard’lar yalnızca `AccessModule` içinde tanımlı ve export ediliyor; feature modülleri guard’ları yeniden `providers` listesine eklemedi.

## Hata cevap şekli (401 / 403 / 400)

`HttpExceptionFilter` (`apps/api/src/common/filters/http-exception.filter.ts`) tüm `HttpException` yanıtlarını şu gövdeye çevirir:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED | FORBIDDEN | BAD_REQUEST | ...",
    "message": "tek satır metin"
  }
}
```

Validation ve diğer Nest `HttpException` kullanımları bu filtreden geçmeye devam eder; ek tasarım yapılmadı.

## Yerel smoke kontrol listesi

1. Servisler: `docker compose up -d postgres redis`  
   (Redis bu API sürümünde zorunlu olmayabilir; proje `docker-compose` dosyanıza göre uyarlayın.)
2. Migrasyon + seed (ilk kurulum):  
   `pnpm --filter @modern-cms/api exec prisma migrate deploy`  
   `pnpm db:seed`
3. Derleme: `pnpm --filter @modern-cms/api build`
4. API: `pnpm --filter @modern-cms/api start`
5. Sağlık: `curl -sS http://localhost:4000/health | jq .`

Opsiyonel tam uç nokta smoke (curl + jq, seed’deki süper admin ile):

```bash
API_BASE_URL=http://localhost:4000 ./infra/scripts/api-smoke.sh
```

Ortam değişkenleri: `API_BASE_URL`, `SMOKE_EMAIL`, `SMOKE_PASSWORD`.

## DI smoke komutu (`smoke:di`)

Veritabanına bağlanır (`PrismaService.$connect`); **çalışan Postgres** ve geçerli `DATABASE_URL` gerekir.

```bash
# apps/api içinden
pnpm smoke:di
pnpm run build && pnpm smoke:di:dist

# monorepo kökünden
pnpm --filter @modern-cms/api smoke:di
pnpm --filter @modern-cms/api build && pnpm --filter @modern-cms/api smoke:di:dist
```

Nest `createApplicationContext` ile HTTP dinlemeden tüm modül grafiği oluşturulur; eksik provider / import hataları burada patlar.

## `package.json` scriptleri (`@modern-cms/api`)

| Script | Açıklama |
|--------|----------|
| `smoke:di` | `tsx src/smoke-di.ts` — kaynaktan DI + modül bootstrap |
| `smoke:di:dist` | `node dist/smoke-di.js` — `build` sonrası; `tsx` gerekmez |
| `smoke:start` | `node dist/main.js` — derleme sonrası gerçek süreç (Ctrl+C ile durdurun) |

## Bilinen sınırlamalar

- `smoke:di` **veritabanı olmadan** başarısız olur (Prisma bağlantısı).
- `api-smoke.sh` **jq** ve **seed edilmiş** süper admin hesabına ihtiyaç duyar (varsayılan: `superadmin@example.com` / `SuperAdmin123!`).
- Jest / e2e çerçevesi bu sprint kapsamı dışındadır.

## Doğrulama komutları (geliştirici)

```bash
pnpm typecheck
pnpm --filter @modern-cms/api build
pnpm --filter @modern-cms/api smoke:di:dist
```

CI’da `smoke:di` için Postgres servis adımı eklenmelidir.
