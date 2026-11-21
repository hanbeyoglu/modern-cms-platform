# İletişim mesajları

## Endpoint’ler

| Metot / yol                               | Kapsam ve yetki                                       | Davranış                                                                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------- |
| `POST /public/contact-messages?locale=tr` | Public key, izinli domain, zorunlu tenant/AVM bağlamı | Mesajı CMS’ye kaydeder; `{ success: true, data: { accepted: true }, locale, tenant }` döner. `accepted: true` kayıt başarısını ifade eder; e-posta teslimini beklemez. |
| `GET /contact-messages`                   | JWT + `contact-message:read` + tenant/AVM erişimi     | Yeni tarih önce, sayfalı özet liste.                                                                                                                                   |
| `GET /contact-messages/unread-count`      | Aynı okuma yetkisi ve kapsam                          | `{ count }`, yalnızca NEW kayıtlar.                                                                                                                                    |
| `GET /contact-messages/:id`               | Aynı okuma yetkisi ve kapsam                          | Detay; NEW ise READ yapıp sunucu saatini readAt’a yazar.                                                                                                               |
| `PATCH /contact-messages/:id/status`      | JWT + `contact-message:update` + tenant/AVM erişimi   | `{ status: 'NEW'                                                                                                                                                       | 'READ' | 'ARCHIVED' }`. |

Admin ve public isteklerinde `x-tenant-id`, `x-mall-id` zorunludur. Public isteğinde tenant API anahtarından belirlenir; çelişen tenant header’ı reddedilir. AVM’nin bu tenant’a ait ve public kullanım için aktif olduğu `ctx.resolve` ile doğrulanır. Gövdeye tenantId/mallId eklemek doğrulama hatasıdır. Mesaj okumaları public API’de bulunmaz; mesajlar arama indeksine de eklenmez.

Gövde:

```json
{
  "name": "Ziyaretçi",
  "email": "ziyaretci@example.com",
  "phone": "05550000000",
  "subject": "Öneri",
  "message": "Mesaj metni",
  "kvkkConsent": true,
  "website": ""
}
```

Ad 1–120, e-posta en fazla 254 ve geçerli, telefon en fazla 30, konu en fazla 180, mesaj 1–5000 karakter. Alanlar trim edilir; boş zorunlu alanlar reddedilir. KVKK onayı gerçek boolean true olmalıdır; onay zamanı istemciden alınmaz. `website` honeypot doluysa kayıt oluşturulmaz. Kalıcı silme endpoint’i yoktur.

Liste parametreleri: `page=1`, `limit=20` (azami 100), `status`, `search` (ad/e-posta/konu/mesaj), `from`, `to` (ISO tarih). Tarih-only üst sınır seçilen UTC gününü tamamen kapsar. Yanıt `{ items, pagination: { page, limit, total, totalPages } }`. Özet listede mesaj içeriği gönderilmez; detayda görünür.

NEW → READ sırasında readAt bir kere kaydedilir. NEW seçilirse readAt temizlenir. Arşivleme archivedAt kaydeder; arşivden çıkarma temizler. Panel arşivden çıkarırken eski okunma durumuna göre READ veya NEW seçer. Tüm veri işlemleri tenant + AVM + kayıt id’siyle sınırlandırılır; seçilmemiş AVM için sorgu yapılmaz.

## E-posta bildirimi

Kayıt sonrası bildirim, doğrulanmış `tenantId` + `mallId` kapsamındaki AVM’nin `supportEmail` adresine gider. Alıcı ziyaretçi isteğinden veya body’deki mall alanından alınmaz. Tenant Settings’teki `supportEmail` kullanılmaz.

Durum alanı `emailNotificationStatus`:

| Durum     | Anlam                                                                 |
| --------- | --------------------------------------------------------------------- |
| `PENDING` | Destek e-postası var; BullMQ kuyruğunda veya outbox recovery bekliyor |
| `SENT`    | Worker SMTP ile gönderdi; `emailNotificationSentAt` dolar             |
| `FAILED`  | Yeniden denemeler tükendi; mesaj CMS’de kalır                         |
| `SKIPPED` | AVM’de `supportEmail` yok; mesaj yine kaydedilir                      |

Gönderim senkron değildir. Job id = mesaj id. Geçici hatalarda exponential backoff ile en fazla 5 deneme. Kuyruğa ekleme başarısız olsa bile public yanıt `accepted: true` kalır; worker tick’i `PENDING` kayıtları recovery eder: mevcut BullMQ işinin durumunu kontrol eder (`failed` → `retry`, yoksa yeniden ekler; `waiting`/`active` ise dokunmaz). Konuda AVM adı ve mesaj konusu vardır; gövde düz metindir; `Reply-To` ziyaretçi adresidir; otomatik yanıt yok. Loglara mesaj içeriği, e-posta adresi veya ham SMTP hata metni yazılmaz; yalnızca `messageId` ve güvenli hata kodu (`smtp_network`, `smtp_auth`, …) loglanır.

SMTP kesin “bir kez teslim” garanti etmez. Gönderim takibi için `emailNotificationDispatchId` (gönderim öncesi) ve `emailNotificationProviderId` (SMTP kabulünden hemen sonra) tutulur; provider id varsa yeniden SMTP çağrısı yapılmaz, yalnızca `SENT` tamamlanır. Deterministik `Message-ID` başlığı sağlayıcı tarafında mümkün olduğunca dedupe eder.

SMTP (yalnızca sunucu ortam değişkenleri; **worker** container’ına `docker-compose.prod.yml` ile aktarılmalıdır): `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

Admin mesaj detayında bildirim durumu ve gönderim zamanı görünür. Panelden yanıtlama/düzenleme yoktur.

## İzinler ve yayınlama

Migration: `20261121230000_contact_messages` (tablo/izinler), `20261121233000_contact_message_email_notification` (e-posta durum alanları), `20261121234500_contact_email_delivery_tracking` (dispatch/provider id). SUPER_ADMIN, TENANT_ADMIN, MALL_MANAGER sistem rollerine okuma/güncelleme yetkileri atanır; özel roller için roller sayfasından ayrıca atayın. Güncel oturumun yetkilerini yenilemek için yeniden giriş gerekebilir. Üretim seed’i çalıştırmaya gerek yoktur.

API/admin imajlarını derledikten sonra, yeni API başlamadan migration’ı uygulayın:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile tools run --build --rm migrate
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-build api admin
```

IP limiti tenant + AVM + güvenilir istemci IP’si başına 10 dakikada 5 gönderimdir; 429 yanıtında Retry-After gelir. Redis mevcut limit altyapısı kullanılır; Redis yoksa gönderim 503 ile durur, başarı dönülmez. Mesaj içeriği loglanmaz; kayıt hataları kişisel veri içermeyen bir 503’e çevrilir.

Express `req.ip` kullanılır, ham X-Forwarded-For başlığı okunmaz. Production Compose Caddy/Docker kurulumunda varsayılan `TRUST_PROXY=loopback,uniquelocal` kullanır. Başka altyapıda bu ayarı yalnızca gerçek reverse proxy adres/ağlarına daraltın. Proxy kullanmayan ortamda boş bırakılabilir; bu durumda TCP bağlantısının IP’si kullanılır. Uygun proxy yapılandırması olmadan tüm ziyaretçiler proxy’nin ortak IP limitini paylaşabilir.

## Web / SDK

SDK: `client.submitContactMessage({ name, email, message, kvkkConsent: true, website: '' })`. Mevcut tenant, AVM, public key, varsayılan locale ve hata sınıfı kullanılır; mesaj kayıtları cache’lenmez.

Metrogarden web formu ayrı depodadır. Hazırlanan ve uygulanabilirliği kontrol edilen yama ile kullanım adımları: [entegrasyon](../integrations/metrogarden-contact/README.md). Web deposuna yazma izni olmadığından asıl form bu oturumda değiştirilmemiştir; yama uygulanana kadar eski mailto davranışı devam eder. Yamanın uygulanmış kopyası tip kontrolü ve Vite build ile doğrulanmıştır.

## Dosya özeti

- `apps/api/prisma/schema.prisma`, `migrations/20261121230000_contact_messages/`, `migrations/20261121233000_contact_message_email_notification/`: model, ilişkiler, e-posta durum alanları.
- `apps/api/src/contact-messages/`: admin controller, scoped service, contact email queue, DTO ve Nest modülü.
- `apps/api/src/public/public-contact-messages.controller.ts`, `guards/contact-rate-limit.guard.ts`, `public.module.ts`: key/domain guard, public context, gönderim ve IP limiti.
- `packages/mail/`: kuyruk sabitleri, düz metin e-posta gövdesi, SMTP yardımcıları.
- `apps/worker/src/contact-email.ts`, `apps/worker/src/index.ts`: BullMQ processor ve PENDING outbox recovery.
- `apps/admin/src/pages/ContactMessagesPage.tsx`, `lib/api/contact-messages.ts`: liste, detay (e-posta bildirim durumu), durum işlemleri.
- `packages/public-sdk/src/client.ts`, `types.ts`, `test/contact-messages.test.cjs`: JSON POST istemcisi.
- `apps/api/test/contact-messages.test.cjs`, `packages/mail/test/message.test.cjs`: kayıt, kuyruk, SKIPPED/PENDING ve gövde testleri.
- `integrations/metrogarden-contact/contact-messages.patch`: ayrı web projesindeki form yaması.
