# Sprint 15 — Arama altyapısı ve genel arama

Bu sprint, CMS için **ölçeklenebilir arama temeli** ekler: şimdilik **PostgreSQL tam metin araması (FTS)**; Elasticsearch/OpenSearch **yoktur** ancak mimari ileride harici arama motoruna taşınabilir.

## Mimari

- **`SearchModule`**: `SearchService` (admin), `PublicSearchService` (site), `SearchIndexerService`, `SearchQueryBuilder`, `SearchRankingService`, `SearchNormalizerService`, `SearchResultMapperService`.
- **Sorgu yüzeyi**: Uygulama kodu doğrudan her modülde `LIKE` ile dağınık arama yapmaz; arama **`SearchIndexEntry`** tablosundaki birleşik `document` alanı üzerinden `to_tsvector('simple', document) @@ plainto_tsquery(...)` ile çalışır.
- **Harici motor hazırlığı**: Aynı “hit” şekli (`IndexHitRow` → DTO) korunarak ileride `SearchService` / `PublicSearchService` içinde sadece veri kaynağı değiştirilebilir (Prisma `$queryRaw` yerine HTTP/OpenSearch client).

## PostgreSQL stratejisi

- **Dil**: `simple` metin arama şablonu — Türkçe/İngilizce karışık içerik için öngörülebilir tokenizasyon; `turkish`/`english` ayrı ağırlıklandırması şimdilik **bilinçli olarak** tek şablonda birleştirildi (kurulum ve indeks boyutu basit kalsın diye).
- **Sorgu**: `plainto_tsquery` ile güvenli, web araması benzeri ifadeler; `SearchQueryBuilder` merkezi.
- **Skor**: `ts_rank` tabanı + `SearchRankingService` içinde durum (`PUBLISHED` / `ACTIVE` / öne çıkan mağaza) ve başlık ağırlığı için SQL ifadeleri.
- **İndeks**: `SearchIndexEntry.document` üzerinde **GIN** indeksi (`to_tsvector('simple', "document")`) — migration: `20260515120000_sprint15_search_index`.

### Neden ayrı indeks tablosu?

- Modül başına tekrarlanan FTS SQL’i önlenir.
- GIN indeksi tek kolon üzerinde yönetilir; tenant/mall filtreleri sorgu katmanında kalır.
- İleride Elastic’e geçerken bu tablo “shadow index” veya senkronizasyon kuyruğu kaynağı olabilir.

## İndeksleme (güncelleme)

- **Olay güdümlü**: Sayfa, etkinlik, kampanya, slider, global AVM mağazası, mall mağazası, film, sinema ve **sayfa blokları** oluşturma/güncelleme/silme (ve ilgili durumlarda) `SearchIndexerService.sync*` çağrıları ile indeks satırı güncellenir veya silinir.
- **Çeviriler**: `LocalizedContent` upsert/update/delete sonrası `touchByLocalizedEntity` → ilgili varlık için yeniden `sync*` (N+1 çeviri okuması indeks yazımında toplu alan olarak yapılır).
- **Worker**: Ağır toplu reindex şimdilik **yok**; ihtiyaç halinde tek seferlik job eklenebilir (dokümante edildi, kapsam dışı).

## Yerelleştirme

- İndeks `document` metnine `LocalizedContent` alanları (ilgili `LocalizedEntityType` için) dahil edilir.
- **Public arama**: Seçilen `locale` ile `TranslationResolverService.getTranslationsForEntities` ile başlık/ismi tek seferde çözülür (N+1’den kaçınma).

## Admin API

| Metot | Yol | Yetki |
|--------|-----|--------|
| GET | `/search/global?q=...&limit=` | `search:global` |

- JWT + `x-tenant-id` zorunlu; `x-mall-id` isteğe bağlı (mall bağlamı `SearchService` içinde SQL ile daraltılır).
- **RBAC**: Sonuçlar `SEARCH_ENTITY_PERMISSION` eşlemesine göre kullanıcı izinlerine filtrelenir.
- **Global mağazalar**: `tenantId` null indeks satırları tenant admin aramasında dahil edilir (`GLOBAL_STORE`).

## Public API

| Metot | Yol |
|--------|-----|
| GET | `/public/search?q=...&type=&limit=&locale=` |

- `Public` — JWT gerekmez; `x-tenant-id` (ve gerektiğinde `x-mall-id`) ile bağlam.
- Yalnızca **yayında / görünür** içerik: `PublicSearchService.filterPublished` ile sayfa, etkinlik, kampanya, mağaza, film, sinema kuralları doğrulanır.
- Kısa **önbellek** (public controller, TTL ~45 sn).

## Sıralama (özet)

- FTS `ts_rank` tabanı.
- Yayın/aktif durumları ve **öne çıkan mağaza** için ek çarpanlar (`SearchRankingService`).
- Başlık ve gövde/metin ayrımı indeks oluştururken `SearchNormalizerService.buildDocument` sırasına yansır (başlık önce).

## Admin arayüz

- Header’da **debounce**’lu genel arama kutusu, gruplanmış sonuç dropdown’u, yükleme ve boş durum.
- **⌘K / Ctrl+K** ile odağı arama alanına taşıma.
- `/search` sayfası: aynı bileşen `page` varyantı ile genişletilmiş kullanım.

## Performans ve sınırlamalar

- Sonuç limiti (admin gruplar başına `limit`, raw sorguda üst sınır).
- `simple` şablonu dil özeline tam uyum sağlamaz.
- Filmler public tarafta tenant genelinde **ACTIVE** olarak listelenir; “yalnızca seansı olanlar” gibi ek iş kuralları ileride sıkılaştırılabilir.
- Çok büyük JSON blokları indekste `jsonSnippet` ile kısaltılır.

## Elastic/OpenSearch geçiş notları

1. `SearchIndexEntry` yerine veya yanında harici indeks; aynı `entityType` / `entityId` anahtarı.
2. `SearchQueryBuilder.prepareTsQuery` → client query DSL üreticisi ile değiştirilebilir.
3. `SearchIndexerService` kuyruk üreticisi olarak kalır (DB + mesaj kuyruğu çift yazım).

## İzinler

| Kod | Açıklama |
|-----|----------|
| `search:global` | Admin genel arama |

Seed: `SUPER_ADMIN` / `TENANT_ADMIN` tüm izinler; `MALL_MANAGER`, `CONTENT_EDITOR`, `REPORT_VIEWER` için `search:global` eklenir.
