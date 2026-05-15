# Sprint 21 — Çok dilli deneyim temeli

Bu sprint, yerelleştirmeyi tenant düzeyinde birinci sınıf bir CMS yeteneğine taşır: aktif diller, varsayılan dil, sıralama, public site-config, arama ve analitikte dil bilgisi, RTL temeli ve (etkinlikler için) forma gömülü çok dilli düzenleme.

## Mimari özeti

- **Kaynak gerçeği:** Tüm çeviri metinleri `LocalizedContent` tablosunda kalır; içerik varlıklarına ayrı çeviri kolonları eklenmez.
- **Tenant dilleri:** `Locale` modeli tenant başına kayıttır (`tenantId`, `code`, `isActive`, `isDefault`, `sortOrder`, `rtl`). Pasif dil, çevirileri silmez; yalnızca formlar ve public tüketimde gizlenir.
- **Çözümleme:** `TranslationResolverService` istenen locale kodunu normalize eder; geçersiz veya pasif locale için güvenli şekilde varsayılan dile düşer (sunucu hatası üretmez).
- **Resmi dil kataloğu:** `apps/api/src/locales/supported-languages.ts` içindeki `OFFICIAL_SUPPORTED_LANGUAGES` seed ve tutarlılık için kullanılır (Arapça RTL, zh = Basitleştirilmiş Çince).

## Tenant dil stratejisi

- En az bir dil **aktif** kalmalıdır; **varsayılan** dil her zaman aktif olmalıdır.
- Sıralama `sortOrder` ve `PATCH /locales/reorder` ile yönetilir; admin listesi bu sıraya göre gösterilir.
- Süper admin başka tenantın dillerini yönetebilir; tenant admin yalnızca kendi kiracısı için (`X-Tenant-Id` / aktif tenant bağlamı).

## Çeviri yaşam döngüsü

1. İçerik oluşturulur (varlık kimliği ile).
2. Aktif diller için `LocalizedContent` satırları oluşturulur/güncellenir (upsert/delete ile boş alan temizliği, yetkiye bağlı).
3. Pasifleştirilen dildeki satırlar **silinmez**; bir sonraki aktivasyonda tekrar kullanılabilir.
4. Yayın (ör. etkinlik): sunucu `getI18nGapWarnings` ile eksik çeviri uyarıları döndürebilir; yayını engellemez.

## Admin UX

- **Ayarlar → Yerelleştirme** (`/settings/localization`): dil listesi, RTL göstergesi, varsayılan işareti, sıra kontrolleri.
- **Forma gömülü çok dilli alanlar:** `MultilingualContentFields` aktif dillere göre sekmeler, varsayılan dil zorunlu alanı, tamamlanma yüzdesi (yeşil / sarı / gri), varsayılandan kopyalama ve RTL metin yönü sağlar.
- **Adoption durumu:**
  - Events: `title`, `shortDescription`, `description`, `buttonText`.
  - Campaigns: `title`, `shortDescription`, `description`, `terms`, `buttonText`.
  - Sliders: `title`, `subtitle`, `description`, `buttonText`.
  - Pages: `title`, `seoTitle`, `seoDescription`.
  - Locations: `displayName`, `shortDescription`, `description`.
  - Stores: Global Store için `name`, `description`; Mall Store için `localName`, `localDescription`.
- **Storage davranışı:** Varsayılan locale değerleri varlığın core alanlarına yazılır; varsayılan dışı aktif locale değerleri `LocalizedContent` / translations API üzerinden `entityType` bazında saklanır. Çeviri yetkisi olmayan kullanıcıda core kayıt başarılı kalır, çeviri flush adımı atlanır.

## Public API ve fallback

- `GET /public/site-config` (isteğe bağlı `?locale=`): `supportedLocales` (kod, ad, rtl), `defaultLocale`, `activeLocale`, `rtl` (aktif locale için).
- Desteklenmeyen veya pasif `?locale=` değeri sessizce varsayılan / geçerli locale’e düşer.

## RTL

- Arapça (`ar`) için `rtl: true`; admin textarea/input yönü locale’e göre ayarlanabilir.
- Tüm admin arayüzü yeniden tasarlanmaz; yalnızca içerik alanlarında yön temeli.

## Arama

- İndeksleme, yalnızca **aktif** locale’lere ait çeviri blob’larını toplar; böylece pasif diller sonuçlara karışmaz. İleride locale ağırlıklı sıralama için ayrı skor alanları genişletilebilir.

## Analitik

- `AnalyticsEvent` üzerinde isteğe bağlı `locale` alanı (tenant + locale indeksi); istemci/track isteğinde dil gönderilebilir. Paneller bu sprintin kapsamı dışındadır.

## Geriye dönük uyumluluk

- Mevcut `LocalizedContent` ve `?locale=` davranışı korunur; yeni alanlar eklenir, mevcut tenantlar migrate ile `sortOrder` / `rtl` ve analitik kolonunu alır.
- Seed, demo tenantlar için resmi dil listesini upsert eder; `tr` varsayılan, yalnızca `tr` ve `en` başlangıçta **aktif**; diğer kodlar kayıtlıdır fakat `isActive: false` ile gelir (Yerelleştirme ayarlarından açılabilir).

## Gelecek: AI çeviri

- Çeviri kaynağı tek tabloda kaldığı için harici bir çeviri servisiyle toplu öneri → inceleme → upsert akışı eklenebilir; `field` + `entityType` + `entityId` anahtarı değişmez.

## Komutlar

```bash
pnpm --filter @modern-cms/api exec prisma migrate deploy
pnpm db:seed   # veya api içinde prisma db seed
pnpm typecheck
pnpm build
pnpm --filter @modern-cms/api build && pnpm --filter @modern-cms/api smoke:di:dist
```
