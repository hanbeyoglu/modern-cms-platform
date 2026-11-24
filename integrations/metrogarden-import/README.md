# Metrogarden → CMS içerik import

Web projesindeki örnek TypeScript içeriklerini (`stores`, `campaigns`, `events`, `movies`, `sliders`) CMS’ye **normal admin kayıtları** gibi aktarır.

## 1) JSON export (Unsplash URL’leri çözülmüş)

Kaynak dosyalar kardeş dizinde olmalı: `../metrogarden-mall-react/src/data/*.ts`

```bash
# monorepo kökünden
pnpm exec tsx integrations/metrogarden-import/export-source.ts \
  --web-root ../metrogarden-mall-react \
  --out tmp/metrogarden-content.json
```

Export, `IMG` / `HERO` / `POSTER` / `COVER` / `GALLERY_IMG` yardımcılarını çalıştırarak tam Unsplash URL’lerini üretir; regex ile kod metninden URL toplamaz.

## 2) Dry-run (varsayılan)

Tenant ve mall **tahmin edilmez**; açıkça verin. Komut önce API’yi derler (Nest DI için `tsc` metadata gerekir; `tsx` ile çalıştırmayın).

```bash
pnpm --filter @modern-cms/api metrogarden:import -- \
  --input ../../tmp/metrogarden-content.json \
  --tenant-id <TENANT_ID> \
  --mall-id <MALL_ID>
```

## 3) Apply

Canlıya otomatik apply çalıştırmayın; dry-run raporunu onayladıktan sonra:

```bash
pnpm --filter @modern-cms/api metrogarden:import -- \
  --input ../../tmp/metrogarden-content.json \
  --tenant-id <TENANT_ID> \
  --mall-id <MALL_ID> \
  --apply \
  --actor-user-id <ADMIN_USER_ID>
```

İsteğe bağlı: `--site-base-url https://metrogarden.hanbeyoglu.com`, `--report tmp/report.json`

## Davranış

- Domain servisleri kullanılır (`GlobalStores`, `MallStores`, `Campaigns`, `Events`, `Movies`, `Sliders`, `MediaService`).
- Idempotent: `ContentImportMapping` + medya URL sha256.
- Süresi geçmiş kampanya/etkinlik → `DRAFT` (tarihler değiştirilmez).
- Görseller `MediaService.uploadAsset` ile yüklenir (R2 yapılandırılmışsa R2); Unsplash URL’si medya ID’si gibi kaydedilmez.
- Desteklenmeyen alanlar raporda listelenir.

## Admin panel

Lokasyon detayında (`/locations/:id`) yetkiye göre:

- **Demo İçerik Yükle** (`demo:import`) — önce dry-run önizleme, sonra apply
- **Demo Verilerini Kaldır** (`demo:remove`)
- **AVM İçeriklerini Sıfırla** (`mall:content-reset`, yalnızca Super Admin)

Fixture: `apps/api/src/demo-content/fixtures/metrogarden.json` (export çıktısının kopyası).

## Migration

```bash
pnpm db:migrate
# veya production: pnpm db:migrate:deploy
pnpm db:seed   # demo:import / demo:remove / mall:content-reset izinleri
```

`ContentImportMapping` + `DemoContentBatch` tabloları gerekir.
