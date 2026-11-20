# Mimari

## Uygulamalar ve sınırlar

pnpm workspace ve Turborepo ile yönetilen monorepo:

- `apps/api`: NestJS API; admin ve public tüketicilere hizmet verir.
- `apps/admin`: React ve Vite yönetim paneli.
- `apps/worker`: zamanlanmış yayın işlemleri ve film kuyrukları.
- `packages/shared`, `packages/ui`, `packages/config`: ortak tipler, bileşenler ve yapılandırma.
- `packages/public-sdk`: bağımsız web, mobil ve kiosk projeleri için TypeScript istemci.
- `packages/content-scheduling`, `packages/movie-providers`, `packages/notifications`: ortak iş mantığı.

CMS headless çalışır. Ziyaretçiye açık web sitesi bu depoda bulunmaz; ayrı frontend projeleri public API'yi kullanır.
PostgreSQL kalıcı veriyi, Redis public önbelleği ve kuyruk altyapısını tutar.
Prisma şeması: `apps/api/prisma/schema.prisma`.

## Tenant, AVM ve erişim

`x-tenant-id` ve `x-mall-id` başlıkları istek bağlamını belirler.
Admin erişiminde JWT, tenant üyeliği, AVM erişimi ve izinler kontrol edilir.
Özellikler ayrıca tenant capability ayarlarıyla sınırlandırılır.
Frontend'de route gate ve navigasyon filtreleri bulunur; API yetkilendirmesi ayrıca uygulanır.

İlgili kod: `apps/api/src/access`, `apps/api/src/capabilities`,
`apps/admin/src/router/PermissionGate.tsx`, `apps/admin/src/navigation/config.ts`.
Rol ayrıntıları: [izin matrisi](ROLE_PERMISSION_MATRIX.md).

## İçerik ve yayınlama

Etkinlikler, kampanyalar, slider grupları, sayfalar, popuplar ve hizmetler ayrı modüllerdir.
Mağaza kategorileri AVM bazındadır: [kategori kuralları](BR-401.md).
Sinema modülleri film, salon, seans ve TMDB içe aktarmayı kapsar.

Etkinlik/kampanya tarihleri ile yayın görünürlük tarihleri farklı alanlardır.
Paylaşılan zamanlama paketi ve worker, zamanı gelen içerikleri yayımlar veya arşivler.
Public görünürlük ayrıca içerik durumu, tarih, kanal ve bağlam üzerinden değerlendirilir.
Çok dil desteği için ilgili çeviri tabloları ve locale çözümleyicileri kullanılır.

## Medya

Medya kütüphanesinde klasörler, metadata ve varyant modelleri bulunur.
Depolama geliştirmede yerel disk veya yapılandırıldığında Cloudflare R2 kullanır.
`ContextualMediaPicker`, içerik formlarına kütüphaneden seçim ve doğrudan yükleme sağlar.
Kullanım alanları ve önerilen boyutlar `apps/admin/src/lib/media-contexts.ts` içinde tanımlıdır;
tenant medya yönergeleri ilgili admin ekranından yönetilir.

## Public API

Yanıt sözleşmesi, kanallar, locale davranışı ve SDK için
[Public API rehberine](PUBLIC_API_GUIDE.md) bakın.
OpenAPI controller'lardan otomatik üretilir; üretilmiş dosyalar elle düzenlenmez.
Developer Portal: `/developer`; Swagger UI: `/api/docs`.
Public içerik Redis üzerinden önbelleklenir.

## Arama ve analitik

Arama `SearchIndexEntry` tablosu ve PostgreSQL `simple` tam metin aramasıyla çalışır.
İndeksleme ve sorgu mantığı `apps/api/src/search` altındadır.
Admin sonuçlarında izinler, public sonuçlarında yayın görünürlüğü uygulanır.
Sıralama çarpanlarının kaynağı `search-ranking.service.ts` dosyasıdır.

Analytics görüntülenme ve tıklama kayıtlarını toplar; özet, popüler içerik ve zaman serisi raporları sağlar.
Bu yapı tam bir CDP değildir; müşteri profili ve demografik segmentasyon ayrı geliştirme gerektirir.

## Operasyon

Audit logging `AUDIT_ENABLED` ile kontrol edilir.
Kullanıcı bildirimleri ve ortak tekrar önleme mantığı `packages/notifications` içindedir.
Sağlık, dağıtım, yedekleme ve loglama adımları için
[dağıtım](DEPLOYMENT.md), [operasyon](RUNBOOK.md) ve [loglama](LOGGING.md) rehberlerine bakın.
