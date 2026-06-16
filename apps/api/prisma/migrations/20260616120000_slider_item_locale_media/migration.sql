-- Locale-aware slider item media: shared images + per-locale translations

ALTER TABLE "SliderItem" ADD COLUMN "sameImageForAllLocales" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "SliderItem" RENAME COLUMN "desktopMediaId" TO "sharedImageId";
ALTER TABLE "SliderItem" RENAME COLUMN "mobileMediaId" TO "sharedMobileImageId";

ALTER TABLE "SliderItem" RENAME CONSTRAINT "SliderItem_desktopMediaId_fkey" TO "SliderItem_sharedImageId_fkey";
ALTER TABLE "SliderItem" RENAME CONSTRAINT "SliderItem_mobileMediaId_fkey" TO "SliderItem_sharedMobileImageId_fkey";

CREATE TABLE "SliderItemTranslation" (
    "id" TEXT NOT NULL,
    "sliderItemId" TEXT NOT NULL,
    "localeId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "buttonText" TEXT,
    "imageId" TEXT,
    "mobileImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SliderItemTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SliderItemTranslation_sliderItemId_localeId_key" ON "SliderItemTranslation"("sliderItemId", "localeId");
CREATE INDEX "SliderItemTranslation_sliderItemId_idx" ON "SliderItemTranslation"("sliderItemId");

ALTER TABLE "SliderItemTranslation" ADD CONSTRAINT "SliderItemTranslation_sliderItemId_fkey" FOREIGN KEY ("sliderItemId") REFERENCES "SliderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SliderItemTranslation" ADD CONSTRAINT "SliderItemTranslation_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "Locale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SliderItemTranslation" ADD CONSTRAINT "SliderItemTranslation_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SliderItemTranslation" ADD CONSTRAINT "SliderItemTranslation_mobileImageId_fkey" FOREIGN KEY ("mobileImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing SLIDER_ITEM text translations from LocalizedContent
INSERT INTO "SliderItemTranslation" ("id", "sliderItemId", "localeId", "title", "description", "buttonText", "createdAt", "updatedAt")
SELECT
    'sit_' || substr(md5(si."id" || lc."localeId"), 1, 24),
    si."id",
    lc."localeId",
    MAX(CASE WHEN lc."field" = 'title' THEN lc."value" END),
    MAX(CASE WHEN lc."field" = 'description' THEN lc."value" END),
    MAX(CASE WHEN lc."field" = 'buttonText' THEN lc."value" END),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "SliderItem" si
INNER JOIN "LocalizedContent" lc
    ON lc."entityId" = si."id"
   AND lc."entityType" = 'SLIDER_ITEM'
GROUP BY si."id", lc."localeId"
ON CONFLICT ("sliderItemId", "localeId") DO NOTHING;
