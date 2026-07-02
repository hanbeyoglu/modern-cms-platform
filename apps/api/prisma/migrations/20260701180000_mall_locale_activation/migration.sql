-- Per-location language activation (tenant-global Locale definitions).
CREATE TABLE "MallLocale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mallId" TEXT NOT NULL,
    "localeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MallLocale_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MallLocale_mallId_localeId_key" ON "MallLocale"("mallId", "localeId");
CREATE INDEX "MallLocale_tenantId_mallId_idx" ON "MallLocale"("tenantId", "mallId");
CREATE INDEX "MallLocale_mallId_isActive_idx" ON "MallLocale"("mallId", "isActive");

ALTER TABLE "MallLocale" ADD CONSTRAINT "MallLocale_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MallLocale" ADD CONSTRAINT "MallLocale_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "Locale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MallLocale" ADD CONSTRAINT "MallLocale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: all system-active locales enabled for every existing mall.
INSERT INTO "MallLocale" ("id", "tenantId", "mallId", "localeId", "isActive", "createdAt", "updatedAt")
SELECT
  'ml_' || substr(md5(m."id" || ':' || l."id"), 1, 24),
  m."tenantId",
  m."id",
  l."id",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Mall" m
INNER JOIN "Locale" l ON l."tenantId" = m."tenantId" AND l."isActive" = true
WHERE m."deletedAt" IS NULL;
