# modern-cms

CMS yönetim platformu için monorepo iskeleti: API (NestJS), Admin (React + Vite), arka plan işçisi ve paylaşılan paketler.

## Mimari özeti

- **apps/api**: CMS HTTP API (ileride kamuya açık siteler de aynı API’yi tüketebilir; CORS kökenleri ortam değişkeni ile yönetilir).
- **apps/admin**: Dahili yönetim arayüzü.
- **apps/worker**: Kuyruk/arka plan işleri için minimal TypeScript süreci.
- **packages/shared**: Ortak tipler ve enumlar.
- **packages/ui**: Paylaşılan React bileşenleri.
- **packages/config**: Ortak TypeScript temel yapılandırmaları.

## Gereksinimler

- Node.js 20+
- pnpm 9 (`corepack enable` önerilir)
- Docker (isteğe bağlı, compose ile)

## Frontend / Public API

Bağımsız web, mobil veya kiosk arayüzü geliştiren ekipler için:

- [docs/PUBLIC_API_GUIDE.md](docs/PUBLIC_API_GUIDE.md) — Public API rehberi (uçlar, envelope, slider, medya, örnekler)
- [docs/FRONTEND_HANDOFF.md](docs/FRONTEND_HANDOFF.md) — Kısa teslim checklist’i
- [`@modern-cms/public-sdk`](packages/public-sdk/) — TypeScript istemci

## Developer Portal

API dokümantasyonu NestJS OpenAPI spesifikasyonundan otomatik üretilir. OpenAPI tek kaynak (single source of truth) — elle düzenleme yapılmaz.

| URL | Açıklama |
|-----|----------|
| `/developer` | Scalar Developer Portal — frontend geliştiriciler için ana dokümantasyon (arama, playground, kod örnekleri) |
| `/api/docs` | Swagger UI — interaktif OpenAPI gezgini |
| `/openapi.json` | Ham OpenAPI 3.1 JSON — **Türkçe** (varsayılan) |
| `/openapi.en.json` | OpenAPI 3.1 — **English** |
| `/openapi.ru.json` | OpenAPI 3.1 — **Русский** |

Yerelde (varsayılan port): http://localhost:4000/developer

Ayrıntılar: [docs/DEVELOPER_PORTAL.md](docs/DEVELOPER_PORTAL.md)

## Dokümantasyon

Güncel geliştirme, mimari, entegrasyon ve operasyon rehberleri için
[dokümantasyon dizinine](docs/README.md) bakın.

## Kurulum

```bash
cd modern-cms
pnpm install
```

## Geliştirme

Önce Postgres ve Redis’i ayağa kaldırın:

```bash
docker compose up -d postgres redis
cp .env.example .env
pnpm db:migrate
pnpm db:seed
```

Ardından:

```bash
pnpm dev
```

Bu komut API, admin ve worker süreçlerini birlikte başlatır. Sadece worker çalıştırmak için:

```bash
pnpm dev:worker
```

## Diğer komutlar

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format
pnpm clean
pnpm db:migrate
pnpm db:seed
```

## Docker Compose (tüm servisler)

```bash
docker compose up --build
```

## Sağlık kontrolü

API ayaktayken:

```bash
curl -sS http://localhost:4000/health
```

## Sunucuda güncelleme

```bash
git pull --ff-only
bash infra/scripts/deploy-prod.sh
```

Komut API, worker ve admin imajlarını sırayla derler; bekleyen migration’ları
uygular ve yalnızca başarıdan sonra uygulama container’larını günceller.
Derleme sırasında mevcut uygulamalar çalışmaya devam eder. Güncelleme sonrası
sağlık kontrolleri beklenir; otomatik geri alma yapılmaz.

Sadece panel veya API değiştiyse ilgili servisi seçebilirsiniz:

```bash
bash infra/scripts/deploy-prod.sh admin
bash infra/scripts/deploy-prod.sh api
```

API/worker güncellemelerinde migration hedefi otomatik çalışır. Bu hedef uygulamayı
derlemez; yalnızca Prisma ve migration dosyalarını içerir. İlk kurulumda PostgreSQL
ve Redis yapılandırması hazır olmalıdır. Farklı ortam dosyası için `CMS_ENV_FILE`
kullanılabilir; varsayılan `.env.production` değeridir.

Bağımlılıklar kaynak koddan önce kurulur. BuildKit, pnpm paket deposunu ve Turbo
çıktılarını sonraki build’ler için saklar; ortak paketler değişmediyse tekrar
derlenmez. Prisma üretiminin bağımlılık hesabı şema ve paket tanımıyla sınırlıdır;
API kaynak değişiklikleri ortak paketlerin önbelleğini gereksiz yere bozmaz. İlk build ve bağımlılık değişiklikleri daha uzun sürebilir.
`docker builder prune` / `docker buildx prune` önbellekleri silebilir; rutin
güncellemenin parçası olarak kullanmayın. Bu düzenleme ilk kez uygulandığında
önbellekler yeniden oluşur. İmajlar hâlâ sunucuda derlenir; tam build süresi
sunucunun CPU, bellek ve disk durumuna bağlıdır.

## GitHub Actions ile otomatik yayın

`.github/workflows/cd.yml`, `main` dalındaki **Build and test** başarılı olduktan
sonra çalışır. Docker imajları GitHub Actions’ta üretilip GHCR’ye commit SHA etiketiyle
gönderilir. Sunucu imajları indirir; uygulama build’i yapmaz.

| Değişiklik | Üretilen imajlar |
|---|---|
| Admin / UI | Admin |
| API kaynakları | API + migration aracı |
| Worker kaynakları | Worker + migration aracı |
| Prisma şeması / migration | API, worker, migration aracı |
| Paylaşılan paket | Paketi kullanan uygulamalar |
| Lockfile, ortak config, Docker/deploy altyapısı | Tümü |
| Yalnızca doküman | İmaj üretilmez |

Karşılaştırma önceki push’a göre değil, son başarılı yayının artifact’ine göre
yapılır. Böylece atlanan/başarısız commit’lerin değişiklikleri kaybolmaz. Değişmeyen
servisler önceki SHA etiketli imajlarını korur. İlk yayında veya state artifact’i
bulunamazsa bütün imajlar üretilir. Birden fazla yayın aynı anda çalışmaz.

### Bir defalık yapılandırma

1. Repository **Settings → Secrets and variables → Actions** altında secrets ekleyin
   (alternatif: `production` environment secrets):

   | Secret | Değer |
   |---|---|
   | `CMS_SSH_HOST` | `46.224.155.63` |
   | `CMS_SSH_USER` | `ubuntu` |
   | `CMS_SSH_PRIVATE_KEY` | Bu yayın için oluşturulmuş ayrı SSH anahtarının private kısmı |
   | `CMS_SSH_KNOWN_HOSTS` | Sunucunun güvenilir kaynaktan doğrulanmış SSH host key kaydı |

   Public anahtarı sunucuda `ubuntu` kullanıcısının `~/.ssh/authorized_keys`
   dosyasına ekleyin. `CMS_SSH_KNOWN_HOSTS` satırı örneği:
   `46.224.155.63 ssh-ed25519 AAAA...` — gerçek sunucu host key’ini kullanın.
   Host key denetimi kapatılmaz.

2. Sunucuda deploy kullanıcısının Docker erişimi, `python3`, `flock`, GitHub’dan
   repo fetch yetkisi, mevcut checkout ve `.env.production` dosyası bulunmalıdır.
   Ortam dosyası ve SMTP/R2/database şifreleri GitHub’a taşınmaz.

3. GHCR imajları private ise sunucuda `read:packages` yetkili token ile bir defa
   oturum açın. API token’ı veya SSH private key’ini sohbete/repo dosyalarına yazmayın:

   ```bash
   read -rsp 'GHCR read:packages token: ' GHCR_TOKEN
   printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u hanbeyoglu --password-stdin
   unset GHCR_TOKEN
   ```

   İmajlar GitHub `GITHUB_TOKEN` ile yayınlanır; registry’ye yazma yetkili ayrı
   uzun ömürlü token gerekmez. Sunucudaki token yalnızca okumalıdır.

4. Repository **Variables** altında:

   | Variable | Değer |
   |---|---|
   | `CMS_DEPLOY_ENABLED` | Kurulum bitince `true` |
   | `CMS_PUBLIC_API_URL` | `https://cms-api.hanbeyoglu.com` |
   | `CMS_DEPLOY_PATH` | `/home/ubuntu/apps/modern-cms-platform` (varsayılan) |
   | `CMS_SSH_PORT` | `22` (varsayılan) |

   `production` environment approval kuralı açıksa otomatik yayın o onayı bekler.
   İlk çalıştırma için değişiklikleri `main` dalına push edin; CI geçince CD başlar.
   Actions → **Production deployment → Run workflow** da kullanılabilir; seçilen
   commit’in CI’ı geçmiş olmalıdır. Build değişkeni değiştiğinde bu ekrandaki
   `force_all` seçeneğiyle bütün imajları yeniden üretin.

Yayın script’i `infra/scripts/deploy-images.sh`; doğrulama/planlama
`infra/scripts/release-plan.py` dosyasındadır. Checkout tam yayın commit’ine
`detached HEAD` olarak geçirilir. Sunucuda elle kaynak düzenlemeyin; gerektiğinde
manuel akışa dönmek için temiz checkout’ta `git switch main && git pull --ff-only`
kullanın. Sağlık kontrolü veya migration hatası başarılı yayın olarak kaydedilmez.
`.deploy/current.json` ve `.deploy/previous.json` son imaj referanslarını tutar;
veritabanı migration’ları otomatik geri alınmaz.

Yerel doğrulama: `pnpm test:infra`. GitHub secrets/variables eklenmeden ve GHCR
sunucu erişimi kurulmadan canlı otomatik yayın başlamaz.

### Canlı CORS origin listesi

Yeni web sitelerini CMS panelindeki **API Yönetimi → İzinli Domainler** bölümünden,
ilgili tenant seçiliyken ekleyin (ör. `metrogarden.hanbeyoglu.com`). Bu kayıtlar
`/public/*` için hem CORS hem tenant API anahtarı domain kontrolünde kullanılır.
Panel değişiklikleri sonraki istekte uygulanır; build/restart gerekmez. Kayıtlı
hostname tam eşleşir; alt domainler otomatik açılmaz. HTTP/HTTPS originleri ve
portlar hostname bazında çalışır. Pasif/silinmiş tenant domainleri CORS izni vermez.
OPTIONS isteği API anahtarı taşımaz; kayıtlı domain kontrolü preflight öncesinde
yapılır, gerçek istekte API anahtarı/tenant kontrolleri ayrıca devam eder.
Yönetim/auth endpoint'leri panelde eklenen domainlerle açılmaz.

`CORS_ORIGINS` admin paneli ve sunucu seviyesindeki sabit izinler için kalır.
Mevcut sabit izinler korunur; panelden domain silmek bunları kaldırmaz. Bir web
sitesini tamamen panelden yönetmek için panel kaydını ekledikten sonra aynı origin'i
sunucu listesinden bir kez çıkarın. Boş env/listeler tüm interneti açmaz.

Sunucu seviyesindeki bir origin değiştirilecekse:

`CORS_ORIGINS` çalışan API container'ına `.env.production` üzerinden aktarılır.
`.env.production.example` değişiklikleri sunucudaki gerçek ayar dosyasını güncellemez.
Web sitesi origin'ini (örneğin `https://metrogarden.hanbeyoglu.com`, son `/` olmadan)
mevcut virgülle ayrılmış listeye ekleyin; diğer izinleri koruyun. Ayar değiştikten
sonra API container'ı yeniden oluşturulmalıdır; `docker restart` yeni ortam
değişkenlerini yüklemez. GHCR dağıtımında yeniden oluştururken çalışan imaj
referansını `CMS_API_IMAGE` ile koruyun veya sonraki başarılı Actions dağıtımını kullanın.
CORS, API anahtarı kontrolünden bağımsızdır: izinli origin için preflight `204`
ve anahtarsız `GET` yanıtı `401` olsa da `Access-Control-Allow-Origin` bulunmalıdır.
