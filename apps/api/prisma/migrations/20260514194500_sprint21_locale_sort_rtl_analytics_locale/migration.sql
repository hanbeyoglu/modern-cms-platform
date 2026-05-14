-- Sprint 21: tenant locale ordering + RTL + analytics locale

ALTER TABLE "Locale" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Locale" ADD COLUMN "rtl" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Locale" SET "rtl" = true WHERE lower("code") = 'ar';

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId"
      ORDER BY CASE WHEN lower("code") = 'tr' THEN 0 ELSE 1 END, "code"
    ) - 1 AS rn
  FROM "Locale"
)
UPDATE "Locale" l
SET "sortOrder" = ranked.rn
FROM ranked
WHERE l.id = ranked.id;

ALTER TABLE "AnalyticsEvent" ADD COLUMN "locale" TEXT;

CREATE INDEX "AnalyticsEvent_tenantId_locale_idx" ON "AnalyticsEvent"("tenantId", "locale");

CREATE INDEX "Locale_tenantId_sortOrder_idx" ON "Locale"("tenantId", "sortOrder");
