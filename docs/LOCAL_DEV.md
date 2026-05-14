# Yerel geliştirme

Bu depoda API üretimde `nest build` + `node dist/main.js` ile çalışır. Yerelde API **`nest start --watch`** ile çalışır: TypeScript derleyicisi `emitDecoratorMetadata` üretir; Nest’in constructor tabanlı DI’sı güvenilir kalır. `tsx` ile doğrudan `src/main.ts` çalıştırmayın — tsx/esbuild bu metadata’yı üretmediği için `ConfigService` vb. enjeksiyonlar sıklıkla `undefined` olur.

**API geliştirme komutu:**

```bash
pnpm --filter @modern-cms/api dev
```

Arka planda şunu yapar: `prisma generate`, eski `tsconfig*.tsbuildinfo` dosyalarını siler (ilk watch turunda eksik `dist` ve `MODULE_NOT_FOUND` riskini azaltır), ardından `nest start --watch`. İlk açılışta `dist/` otomatik oluşur; üretim `build` / `start` akışı değişmez.

## Önkoşullar

- Node.js 20+
- [pnpm](https://pnpm.io/) 9
- Docker (Postgres ve Redis için)

## Hızlı başlangıç

Veritabanı ve Redis’i arka planda başlatın:

```bash
pnpm dev:services
```

API, admin paneli ve worker’ı birlikte izleme modunda çalıştırın:

```bash
pnpm dev
```

## Komutlar

| Komut | Açıklama |
|--------|------------|
| `pnpm dev:services` | `docker compose` ile yalnızca `postgres` ve `redis` servislerini detached modda ayağa kaldırır. |
| `pnpm dev` | Turbo ile eşzamanlı: API (`nest start --watch`), admin (`vite`), worker (`tsx watch`). |
| `pnpm dev:full` | Önce `dev:services`, ardından `pnpm dev`. |
| `pnpm dev:api` | Yalnızca Nest API. |
| `pnpm dev:admin` | Yalnızca Vite admin (varsayılan: http://localhost:5173). |
| `pnpm dev:worker` | Yalnızca Redis worker. |

Üretim benzeri çalıştırma (tüm stack imajlarla) için kök dizinde argümansız `docker compose up` kullanın; günlük geliştirmede yalnızca `postgres` ve `redis` hedefleyin (`pnpm dev:services`).

## Veritabanı

İlk kurulum veya şema değişikliğinde:

```bash
pnpm db:migrate
pnpm db:seed
```

`pnpm dev:api` her başlangıçta `prisma generate` çalıştırır; client şemanızla uyumlu kalır.

## Ortam değişkenleri

API ve worker için `apps/api/.env`, `apps/worker/.env` gibi dosyalar kullanılabilir. Örnek değerler için repodaki `.env.example` dosyalarına bakın (varsa).

Postgres (compose varsayılanı):

- `DATABASE_URL=postgresql://cms:cms@localhost:5432/cms?schema=public`

Redis:

- `REDIS_URL=redis://localhost:6379`

## Sorun giderme

- **Port çakışması:** Postgres 5432, Redis 6379, API 4000, Vite 5173 kullanır; bu portların boş olduğundan emin olun.
- **Docker servisleri:** `docker compose ps` ile durumu kontrol edin; durdurmak için `docker compose stop postgres redis` kullanabilirsiniz.
- **`Cannot find module` / eksik `dist`:** `pnpm dev` zaten `tsconfig*.tsbuildinfo` siliyor; hâlâ sorun varsa `apps/api` içinde `rm -rf dist` deyip `pnpm --filter @modern-cms/api dev` ile yeniden deneyin.
- **Constructor’da `undefined` (ör. `ConfigService`):** API’yi `tsx` ile `src/main.ts` üzerinden çalıştırmayın; yerel için yalnızca `nest start --watch` kullanın (yukarıdaki komut).
