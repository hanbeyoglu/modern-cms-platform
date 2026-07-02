-- Backfill official locale catalog for tenants created without default locales.
INSERT INTO "Locale" ("id", "tenantId", "code", "name", "nativeName", "isDefault", "isActive", "sortOrder", "rtl", "createdAt", "updatedAt")
SELECT
  'loc_' || substr(md5(t."id" || ':' || v.code), 1, 24),
  t."id",
  v.code,
  v.name,
  v."nativeName",
  v."isDefault",
  v."isActive",
  v."sortOrder",
  v.rtl,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Tenant" t
CROSS JOIN (
  VALUES
    ('tr', 'Türkçe', 'Türkçe', true, true, 0, false),
    ('en', 'English', 'English', false, true, 1, false),
    ('ar', 'Arabic', 'العربية', false, false, 2, true),
    ('ru', 'Russian', 'Русский', false, false, 3, false),
    ('de', 'German', 'Deutsch', false, false, 4, false),
    ('nl', 'Dutch', 'Nederlands', false, false, 5, false),
    ('fr', 'French', 'Français', false, false, 6, false),
    ('it', 'Italian', 'Italiano', false, false, 7, false),
    ('pt', 'Portuguese', 'Português', false, false, 8, false),
    ('zh', 'Chinese (Simplified)', '中文', false, false, 9, false)
) AS v(code, name, "nativeName", "isDefault", "isActive", "sortOrder", rtl)
WHERE t."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Locale" l WHERE l."tenantId" = t."id"
  );
