# Operasyonel çalışma kitabı (Runbook)

Modern CMS tek host / Docker Compose dağıtımı için günlük operasyon ve arıza adımları. Kubernetes yok. Ayrıntılı yedek stratejisi: `docs/DEPLOYMENT.md`, sprint özeti: `docs/SPRINT18.md`.

## Servisleri başlatma

**Geliştirme**

```bash
pnpm dev:services    # Postgres + Redis
pnpm db:migrate      # ilk kurulumda
pnpm dev             # api + admin + worker
```

**Üretim (Docker)**

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Migrasyonları API konteynerini yenilemeden önce ayrı adımda çalıştırın (`pnpm db:migrate:deploy` veya eşdeğeri). Ayrıntı: `docs/DEPLOYMENT.md`.

## Sağlık kontrolleri

| Uç | Beklenti |
|----|-----------|
| `GET /health` | 200, JSON’da `database: up`, Redis kullanılıyorsa `redis: up` |
| `GET /health/ready` | **200** — trafik almaya hazır (DB + yapılandırılmış Redis) |
| `GET /version` | 200, `version`, `gitSha` |

Örnek:

```bash
curl -fsS https://api.ornek.com/health/ready
```

## Duman testi (deploy sonrası)

```bash
export API_BASE_URL=https://api.ornek.com
export SMOKE_EMAIL=...
export SMOKE_PASSWORD=...
pnpm smoke:prod
```

Başarısızsa: trafiği geri alın (aşağıdaki rollback), API loglarına bakın, `GET /health` gövdesinde `database` / `redis` / `worker` alanlarını kontrol edin.

## Yedek (PostgreSQL)

```bash
export DATABASE_URL="postgresql://..."
export BACKUP_DIR=backups/postgres   # isteğe bağlı
export APP_VERSION=1.0.0 APP_GIT_SHA=$(git rev-parse --short HEAD)   # isteğe bağlı meta
pnpm backup:postgres
```

Çıktı: `*.sql.gz` ve yanında `*.sql.gz.meta.json`. Eski dosyalar:

```bash
BACKUP_RETENTION_DAYS=14 pnpm backup:prune
```

## Geri yükleme (PostgreSQL) — yıkıcı

```bash
export DATABASE_URL="postgresql://..."
export CONFIRM_RESTORE=yes
pnpm restore:postgres -- backups/postgres/cms-2026-05-14-140000.sql.gz
```

Üretimde önce ek bir yedek alın. Uygulamayı durdurup veya salt-okunur moda alıp restore önerilir.

## Başarısız deploy — rollback

1. Önceki imaj sürümlerine dönün (`docker compose ... pull` / `build` ile sabitlediğiniz tag veya digest).
2. `docker compose --env-file .env.production -f docker-compose.prod.yml up -d`
3. Veritabanı şeması yeni migrasyon içeriyorsa: **otomatik down migration yok**; ters migration veya yedekten dönüş planı gerekir (`docs/DEPLOYMENT.md`).

## Worker sağlıksız

- `GET /health` içinde `worker.status`: `unknown` veya `down` benzeri — Redis’te `worker:heartbeat` anahtarını kontrol edin.
- Worker konteyner logları: `[service=worker]` satırları, `connect failed`, `scheduling tick failed`.
- Worker çökmüşse: `docker compose restart worker` (veya servis adınıza göre).
- `DATABASE_URL` / `REDIS_URL` eksik veya ağ kopukluğu sık neden.

## Redis kapalı veya erişilemez

- API `GET /health/ready` **503** (Redis zorunluysa).
- Public uçlar önbelleği atlayabilir; tutarsız içerik riski düşük ama yüksek.
- Redis’i düzeltin, `docker compose restart api worker` ile bağlantı havuzlarını tazeleyin.

## Veritabanı kapalı

- `/health/ready` 503, API loglarında Prisma bağlantı hataları.
- Postgres konteyner / disk / `max_connections` kontrolü.
- Kurtarma sonrası: API ve worker yeniden başlatma.

## Public önbellek eski (stale)

Public yanıtlar Redis anahtarlarıyla önbelleğe alınır (`public:<tenantId>:<mallSegment>:…`).

- İçerik güncellendi ama edge’de eski: worker zamanlama tick’i ilgili tenant için `invalidatePublicBranch` çalıştırır; worker ayakta değilse eski cache kalabilir.
- **Acil temizlik** (dikkatli): Redis’te ilgili tenant için desen silme. Örnek (önce `KEYS` ile doğrulayın; üretimde `SCAN` tercih edin):

```bash
redis-cli --scan --pattern 'public:<TENANT_UUID>:*' | xargs -r redis-cli DEL
```

Tüm public cache’i silmek (`FLUSHDB`) yalnızca yalıtılmış Redis örneğinde düşünülmelidir.

## Migrasyon hatası

- `prisma migrate deploy` CI’da kırılırsa merge bloklanır; üretimde kısmen uygulanmış migrasyon: Prisma dokümantasyonuna göre manuel müdahale veya yedekten dönüş.
- API’yi yeni sürüme yükseltmeden önce migrasyonların yeşil olduğundan emin olun.

## Disk dolu

- Postgres ve `storage/` büyümesi; log rotasyonu (Docker `json-file` driver limitleri).
- `df -h`, Docker volume kullanımı; gereksiz imaj `docker system prune` (dikkatli).
- Yedek dizini (`BACKUP_DIR`) ayrı diskte tutmak iyi uygulamadır.

## Sık kullanılan komutlar

```bash
pnpm typecheck && pnpm build          # yerel doğrulama
pnpm compose:config                   # compose şema kontrolü
pnpm smoke:prod                       # canlı API duman testi
pnpm backup:postgres                  # DB yedeği
pnpm backup:prune                     # eski yedekleri sil
docker compose -f docker-compose.prod.yml logs -f api --tail=200
```

## Olay müdahalesi (kısa)

1. Kullanıcı etkisini not edin (kesinti süresi, etkilenen tenant’lar).
2. `/health` ve `/health/ready` ile durum sınıflandırın.
3. Son deploy / migrasyon / altyapı değişikliği zaman çizelgesi.
4. Gerekirse rollback + yedekten restore kararı (yönetim onayı ile).
5. Olay sonrası: kök neden, aksiyon maddeleri, yedek doğrulama tarihi.

## Hata izleme (Sentry) — ileride

Özet: `docs/LOGGING.md` içindeki “Hata izleme (Sentry)” bölümüne bakın. JWT, parola, ham IP, sırlar ve gereksiz PII gönderilmeyecek şekilde `beforeSend` ve scrubbing yapılandırın.

## Uyarı kontrol listesi (özet)

| Koşul | Önerilen aksiyon |
|--------|-------------------|
| `/health/ready` ≠ 200 | Trafik yönlendirmeyi kesin, API/DB/Redis inceleyin |
| DB down | Postgres ve disk; bağlantı sayısı |
| Redis down | Redis konteyner, ağ, `REDIS_URL` |
| Worker heartbeat yok | Worker logları ve restart |
| Disk % yüksek | Volume temizliği, yedek taşıma, log limiti |
| Son yedek > 24 saat | `pnpm backup:postgres` cron’u doğrulayın |
| Deploy sonrası smoke kırmızı | Rollback + kök neden |

Tam liste: `docs/DEPLOYMENT.md` → “Operasyonel uyarılar”.

## Sınırlamalar

- Prometheus / Grafana yok; metrikler çoğunlukla sağlık uçları ve host metrikleri ile sınırlı.
- Otomatik felaket kurtarma (failover DB) bu runbook kapsamında değildir.
