# Sprint 5 — Store Center & Mall Store Assignment

## Goal

Introduce a **global store pool** (reusable brands) and **mall-specific assignments** with local overrides (floor, unit number, hours, logos, etc.). A single `GlobalStore` (ör. Zara) must not be duplicated per mall; instead, each mall gets a `MallStore` row linking to that global record.

---

## Architecture

### Veri modeli (özet)

```
StoreCategory (sistem geneli, tenant bağımsız)
      │
      ▼
GlobalStore (global havuz, slug benzersiz, yumuşak silme)
      │
      ├──► MediaAsset (logo, opsiyonel)
      │
      └──► MallStore (tenant + mall kapsamı)
                 ├── Tenant, Mall
                 ├── yerel alanlar (localName, floor, storeNo, …)
                 └── MediaAsset (yerel logo, opsiyonel)
```

- **StoreCategory**: Sınıflandırma; AVM’ye özel değil; `deletedAt` ile yumuşak silme.
- **GlobalStore**: Tüm tenant’ların paylaşabileceği marka havuzu; `slug` benzersiz; `status` ile yaşam döngüsü.
- **MallStore**: `tenantId` + `mallId` + `globalStoreId` ile bağlar; aynı global mağaza aynı AVM’de **aktif** olarak yalnızca bir kez atanabilir (uygulama + kısmi benzersiz indeks).

### Kısmi benzersiz indeks

`MallStore` için PostgreSQL:

```sql
CREATE UNIQUE INDEX "MallStore_mallId_globalStoreId_active_key"
  ON "MallStore"("mallId", "globalStoreId") WHERE "deletedAt" IS NULL;
```

Yumuşak silinen atamadan sonra aynı çifti yeniden oluşturmaya izin verir.

### Gelecek (kampanya / etkinlik)

`MallStore` ve `GlobalStore` üzerine ileride kampanya veya etkinlik ilişkileri eklenebilir; şu an bu modüller yoktur. `SliderLinkType.STORE` gibi enum değerleri ileride bu kayıtlara bağlanabilir.

---

## Prisma Modelleri

| Model | Açıklama |
|--------|-----------|
| `StoreCategory` | `name`, `slug` (unique), `icon`, `sortOrder`, `status` (`StoreCategoryStatus`), `deletedAt` |
| `GlobalStore` | `name`, `slug` (unique), `logoMediaId`, `categoryId`, `description`, `websiteUrl`, `socialLinksJson`, `status` (`StoreStatus`), `createdBy` / `updatedBy`, `deletedAt` |
| `MallStore` | `tenantId`, `mallId`, `globalStoreId`, yerel alanlar, `workingHoursJson`, `locationJson`, `isFeatured`, `sortOrder`, `status`, `createdBy` / `updatedBy`, `deletedAt` |

Enumlar: `StoreCategoryStatus` (ACTIVE, PASSIVE), `StoreStatus` (ACTIVE, PASSIVE, ARCHIVED).

---

## Yetkiler

| Kod | Açıklama |
|-----|-----------|
| `store-category:read` / `create` / `update` / `delete` | Kategori CRUD |
| `global-store:read` / `create` / `update` / `delete` | Global mağaza CRUD |
| `mall-store:read` / `assign` / `update` / `delete` / `feature` | AVM ataması; `feature` hem öne çıkarma hem kaldırma için kullanılır |

### Rol dağılımı (seed)

- **SUPER_ADMIN**, **TENANT_ADMIN**: Tüm yeni izinler.
- **MALL_MANAGER**: Kategori + global **read**; mall-store **read, assign, update, feature** (delete yok).
- **CONTENT_EDITOR**: Kategori + global **read**; mall-store **read, update** (assign / delete / feature yok).
- **REPORT_VIEWER**: `store-category:read`, `global-store:read`, `mall-store:read` (+ mevcut okuma izinleri).

---

## API Uçları

Base URL örnek: `http://localhost:4000`. Tüm korumalı isteklerde `Authorization: Bearer <token>` gerekir. Yetki kontrolü için **`x-tenant-id`** zorunludur (super admin hariç guard davranışı mevcut kod ile uyumludur). Mall store uçlarında ayrıca **`x-mall-id`** zorunludur.

### Store categories

| Method | Path |
|--------|------|
| GET | `/store-categories` |
| POST | `/store-categories` |
| PATCH | `/store-categories/:id` |
| DELETE | `/store-categories/:id` |

**Sorgu (GET):** `search`, `status`, `page`, `limit`

### Global stores

| Method | Path |
|--------|------|
| GET | `/global-stores` |
| GET | `/global-stores/:id` |
| POST | `/global-stores` |
| PATCH | `/global-stores/:id` |
| DELETE | `/global-stores/:id` |

**Sorgu (GET):** `search`, `categoryId`, `status`, `page`, `limit`

### Mall stores

| Method | Path |
|--------|------|
| GET | `/mall-stores` |
| POST | `/mall-stores/assign` |
| GET | `/mall-stores/:id` |
| PATCH | `/mall-stores/:id` |
| DELETE | `/mall-stores/:id` |
| POST | `/mall-stores/:id/feature` |
| POST | `/mall-stores/:id/unfeature` |

**Sorgu (GET):** `search`, `categoryId` (global mağaza kategorisi), `status`, `isFeatured`, `page`, `limit`

---

## cURL Örnekleri

```bash
API=http://localhost:4000
TOKEN="<access_token>"
TENANT="<tenant_id>"
MALL="<mall_id>"

# Kategori listesi
curl -sS "$API/store-categories?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT"

# Global mağaza oluştur
curl -sS -X POST "$API/global-stores" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{"name":"Zara","categoryId":"<cat_id>","websiteUrl":"https://www.zara.com","status":"ACTIVE"}'

# AVM’ye ata
curl -sS -X POST "$API/mall-stores/assign" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "x-mall-id: $MALL" \
  -H "Content-Type: application/json" \
  -d '{"globalStoreId":"<global_store_id>","floor":"2","storeNo":"230","sortOrder":0}'

# AVM mağaza listesi
curl -sS "$API/mall-stores?search=zara" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "x-mall-id: $MALL"
```

---

## Admin Kullanımı

Uygulama içi sayfalar (navigasyon):

- **Mağaza Kategorileri** — liste, oluştur / düzenle, yumuşak sil.
- **Global Mağazalar** — liste, kategori seçimi, logo için medya seçici, web URL, durum.
- **AVM Mağazaları** — aktif tenant + **seçili mall** için atamalar; global mağazadan atama; yerel alanları düzenleme; öne çıkar / kaldır; atamayı kaldır (yumuşak sil).

Mall sayfası **`x-mall-id`** göndermediği sürece API reddeder; önce üstteki tenant/mall seçiciyi kullanın.

---

## Denetim (Audit)

`AuditLogService` ile aşağıdaki `action` değerleri yazılır:

- `store-category:create` | `update` | `delete`
- `global-store:create` | `update` | `delete`
- `mall-store:assign` | `update` | `delete` | `feature` | `unfeature`

Uygun olduğunda `metadata` içinde `before` / `after` özetleri tutulur.

---

## Public hazırlığı

HTTP uç noktası eklenmedi. `MallStoresService.getPublicMallStores({ tenantId, mallId, categoryId?, search?, featuredOnly? })` yalnızca **ACTIVE** `MallStore` ve **ACTIVE** `GlobalStore` döndürür; ileride kiosk / vitrin sitesi bu metodu kullanabilir.

---

## Bilinen sınırlamalar

- `GlobalStore.logoMediaId` herhangi bir tenant’taki `MediaAsset` ile ilişkilenebilir; medya hâlâ tenant scoped — global marka logosu için operasyonel politika (ör. merkez tenant) sonradan netleştirilebilir.
- `MallStore.localLogoMediaId` **aynı tenant** altındaki medya ile doğrulanır.
- Public HTTP ve mağaza vitrin sayfası bu sprint kapsamında değildir.
- İçerik editörü rolü mağaza **atayamaz** (sadece mevcut atamayı güncelleyebilir); bu ürün kararıdır.

---

## Komutlar

```bash
# Migrasyon (geliştirme)
pnpm db:migrate
# veya
pnpm --filter @modern-cms/api exec prisma migrate dev

# Seed
pnpm db:seed
```

---

## Değişen dosyalar (özet)

| Alan | Dosyalar |
|------|-----------|
| Prisma | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260513114535_add_store_center/migration.sql` |
| Seed | `apps/api/prisma/seed.ts` |
| API | `store-categories/*`, `global-stores/*`, `mall-stores/*`, `common/utils/slugify.ts`, `app.module.ts` |
| Admin | `src/lib/api.ts`, `src/App.tsx`, `src/pages/StoreCategoriesPage.tsx`, `GlobalStoresPage.tsx`, `MallStoresPage.tsx` |
| Dokümantasyon | `docs/SPRINT5.md` |
