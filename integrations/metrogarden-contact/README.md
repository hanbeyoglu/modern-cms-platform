# Metrogarden iletişim formu entegrasyonu

Mevcut `src/components/contact/ContactForm.tsx` ve `src/api/client.ts` incelenerek hazırlanan yama. Bu oturumda web deposuna yazma izni olmadığı için doğrudan uygulanamadı; CMS deposundaki API/admin/SDK değişiklikleri hazırdır.

Web deposunda, başka bir işlem dosyaları değiştirmediyse:

```bash
cd /Users/hanbeyoglu/Desktop/Apps/metrogarden-mall-react
git apply --check /Users/hanbeyoglu/Desktop/Apps/modern-cms-platform/integrations/metrogarden-contact/contact-messages.patch
git apply /Users/hanbeyoglu/Desktop/Apps/modern-cms-platform/integrations/metrogarden-contact/contact-messages.patch
npm run build
```

Yama mevcut `apiClient.post` ve `getCmsLocale` kullanır. API URL’si, public key, tenant ve AVM bilgileri mevcut `VITE_API_URL`, `VITE_CMS_PUBLIC_API_KEY`, `VITE_CMS_TENANT_ID`, `VITE_CMS_MALL_ID` ayarlarından gelir; iletişim formuna ek anahtar konmaz. API izinli domainlerine web domainini ekleyin.

- JSON alanları `name`, `email`, `phone?`, `subject?`, `message`, `kvkkConsent: true`, gizli `website` honeypot.
- API’nin başarılı HTTP yanıtı ve `{ success: true, data: { accepted: true } }` doğrulanmadan başarı gösterilmez.
- Başarıda form temizlenir; hata durumunda veriler korunur ve tekrar gönderilebilir.
- Teknik sunucu hataları gösterilmez. 429 için bekleme mesajı gösterilir.
- Türkçe/İngilizce metinler güncellenir; `mailto` gönderimi kaldırılır.

Kontrol: geçerli form CMS’te doğru AVM’de NEW olarak görünmeli; KVKK’sız gönderim durmalı; hata/429 durumunda form boşalmamalı; honeypot doluysa sunucu kayıt oluşturmamalı.
