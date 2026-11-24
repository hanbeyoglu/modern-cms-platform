# Çoklu katlar ve içerik açıklamaları

- Hizmetler mevcut çoklu kat ilişkisini korur. AVM mağazaları da `floorIds: string[]`
  ile aynı AVM'nin aktif katlarından birden fazlasını seçebilir.
- `floorIds: []` seçimi temizler; alan gönderilmezse güncellemede ilişki korunur.
  Eski `floorId` / özel `floor` girişleri desteklenir; ilk kat eski tek kat alanıyla eşlenir.
- Migration: `20261125090000_mall_store_multiple_floors` mevcut tek kat ilişkilerini taşır.
  API yayınlanmadan önce migration uygulanmalıdır. Veritabanı reseti gerekmez.
- Public mağaza listesi/detayı `floors: { id, name, label }[]` döndürür. Eski `floor`
  korunur, `floorLabel` tüm seçili katların etiketlerini birleştirir. Web tüm katları
  göstermek için `floors` kullanmalıdır; eski istemciler ilk katı görmeye devam eder.
- Açıklama editörleri: hizmet, AVM mağazası, mağaza havuzu, mağaza kategorisi, sinema,
  film, açılır pencere, slayt öğesi ve AVM/lokasyon. Etkinlik/kampanya mevcut editörü korunur.
  Dil bazlı açıklamalar ve çeviri paneli de zengin metin editörü kullanır.
- Açıklamalar biçimlendirilmiş HTML olabilir. API DTO'larında ve ortak çeviri
  mekanizmasında script/tehlikeli URL'ler temizlenir. Mevcut düz metinler geçerlidir.
  Web açıklamaları etkinlik açıklamalarıyla aynı güvenli HTML gösterimiyle işlemelidir.
- Kısa açıklama, SEO, görsel alt metni, JSON ve teknik yapılandırma alanları düz metin
  olarak kalır. Yeni bir editör kütüphanesi eklenmedi.
