# Sprint 12C — Admin Localization UI

## Özet

Admin uygulamasına tenant bazlı **dil (locale) yönetimi** sayfası ve içerik
formlarında kullanılan **TranslationPanel** bileşeni eklendi. Public API
yerelleştirme mantığına dokunulmadı; yalnızca mevcut `GET/POST/PATCH/DELETE
/locales` ve `GET/POST/DELETE /translations` uçları tüketilir.

---

## Rotalar

| Rota | Sayfa | Gerekli yetki (giriş) |
|------|--------|----------------------|
| `/locales` | `LocalesPage` | `locale:read` (kenar çubuğu + sayfa) |

---

## API istemci modülleri

| Dosya | İşlevler |
|-------|----------|
| `apps/admin/src/lib/api/locales.ts` | `apiLocalesList`, `apiLocaleCreate`, `apiLocaleUpdate`, `apiLocaleDeactivate` (DELETE), `apiLocaleSetDefault` |
| `apps/admin/src/lib/api/translations.ts` | `apiTranslationsList`, `apiTranslationUpsert`, `apiTranslationDelete` |

Barrel export: `apps/admin/src/lib/api/index.ts` içinde tipler ve fonksiyonlar
dışa aktarılır.

---

## Diller sayfası (`/locales`)

- Tüm dilleri listeler (`GET /locales`).
- **Oluştur:** kod, ad, yerel ad, isteğe bağlı varsayılan / aktif (`locale:create`).
- **Düzenle:** ad, yerel ad, aktif (`locale:update`) — modal.
- **Pasifleştir:** `DELETE /locales/:id` (`locale:delete`) — sunucu varsayılan
  dili güvenli biçimde devreder; satır silinmez.
- **Varsayılan yap:** `POST /locales/:id/default` (`locale:set-default`).
- **Rozetler:** Aktif / Pasif, Varsayılan (`Badge`).

Kenar çubuğunda **Diller** bağlantısı `locale:read` ile görünür.

---

## TranslationPanel

**Dosya:** `apps/admin/src/components/TranslationPanel.tsx`

**Props:**

- `entityType`: `LocalizedEntityType` (ör. `PAGE`, `EVENT`, …)
- `entityId`: string (CMS varlık kimliği)
- `fields`: çevrilecek alan adları
- `title`: bölüm başlığı

**Davranış:**

- `translation:read` yoksa bileşen hiç render edilmez.
- Aktif dilleri ve ilgili varlık için `GET /translations?entityType=&entityId=`
  ile çevirileri yükler.
- Dil sekmeleri: öncelikle **aktif** diller; yoksa tüm diller.
- Her alan için metin kutusu; **Bu dil için kaydet** ile seçili dildeki tüm
  alanlar `POST /translations` (upsert) ile kaydedilir.
- Alan boşaltılırsa ve önceden kayıt varsa: `translation:delete` yetkisiyle
  `DELETE /translations/:id` çağrılır (aksi halde boş değer API’de
  `IsNotEmpty` nedeniyle upsert edilemez; kullanıcıya kısa not gösterilir).

**Yetkiler:** okuma `translation:read`, yazma `translation:create`, silme
`translation:delete`.

---

## Entegrasyonlar

| Yer | entityType | Alanlar |
|-----|------------|---------|
| `PageDetailPage` | `PAGE` | `title`, `seoTitle`, `seoDescription` |
| `EventsPage` (yalnızca düzenleme, `editing` varken) | `EVENT` | `title`, `shortDescription`, `description`, `buttonText` |
| `CampaignsPage` (düzenleme) | `CAMPAIGN` | `title`, `shortDescription`, `description`, `terms`, `buttonText` |
| `SlidersPage` (form açık + `editingSlider`) | `SLIDER` | `title`, `subtitle`, `description`, `buttonText` |

Yeni oluşturma akışında varlık kimliği olmadığı için panel gösterilmez (kabul
edilen sınırlama).

---

## Navigasyon ve geri uyumluluk

- `navigation/config.ts`: `Diller` → `/locales`, `permission: 'locale:read'`,
  grup: İçerik.
- `usePermission`: Eski oturumlarda `permissions` dizisi yokken okuma
  listesine `locale:read` ve `translation:read` eklendi (salt okuma / liste).

---

## Sınırlamalar

- Tam bir “çeviri stüdyosu” veya toplu içe aktarma yok.
- Yapay zeka ile çeviri yok.
- `PAGE_BLOCK` ve şema’daki diğer tipler için panel bu sprintte bağlanmadı.
- Çeviri metni API doğrulaması nedeniyle boş string ile upsert edilemez;
  temizlemek için silme yetkisi gerekir.
- Slider formu kaydedilince panel kapanır (düzenleme yeniden açılmalı).

---

## İlgili sprint dokümanları

- Sprint 12A: şema ve çeviri modeli (`docs/SPRINT12A.md`).
- Sprint 12B: public API `?locale=` (`docs/SPRINT12B.md`).
