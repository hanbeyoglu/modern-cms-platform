-- Campaign & Event: separate publish window from business dates + locale-aware cover images

-- ── Campaign ──────────────────────────────────────────────────────────────────

ALTER TABLE "Campaign" ADD COLUMN "sameImageForAllLocales" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Campaign" RENAME COLUMN "coverMediaId" TO "sharedCoverImageId";
ALTER TABLE "Campaign" RENAME CONSTRAINT "Campaign_coverMediaId_fkey" TO "Campaign_sharedCoverImageId_fkey";

ALTER TABLE "Campaign" ADD COLUMN "publishStartAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN "publishEndAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN "campaignStartAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN "campaignEndAt" TIMESTAMP(3);

UPDATE "Campaign"
SET
  "campaignStartAt" = "startAt",
  "campaignEndAt" = "endAt",
  "publishStartAt" = COALESCE("publishedAt", "createdAt"),
  "publishEndAt" = NULL;

ALTER TABLE "Campaign" DROP COLUMN "startAt";
ALTER TABLE "Campaign" DROP COLUMN "endAt";

DROP INDEX IF EXISTS "Campaign_status_startAt_idx";
DROP INDEX IF EXISTS "Campaign_status_endAt_idx";
DROP INDEX IF EXISTS "Event_status_startAt_idx";
DROP INDEX IF EXISTS "Event_status_endAt_idx";

CREATE INDEX "Campaign_tenantId_campaignStartAt_idx" ON "Campaign"("tenantId", "campaignStartAt");
CREATE INDEX "Campaign_status_publishStartAt_idx" ON "Campaign"("status", "publishStartAt");
CREATE INDEX "Campaign_status_publishEndAt_idx" ON "Campaign"("status", "publishEndAt");

CREATE TABLE "CampaignTranslation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "localeId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "buttonText" TEXT,
    "coverImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignTranslation_campaignId_localeId_key" ON "CampaignTranslation"("campaignId", "localeId");
CREATE INDEX "CampaignTranslation_campaignId_idx" ON "CampaignTranslation"("campaignId");

ALTER TABLE "CampaignTranslation" ADD CONSTRAINT "CampaignTranslation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignTranslation" ADD CONSTRAINT "CampaignTranslation_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "Locale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignTranslation" ADD CONSTRAINT "CampaignTranslation_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "CampaignTranslation" ("id", "campaignId", "localeId", "title", "description", "buttonText", "createdAt", "updatedAt")
SELECT
    'ct_' || substr(md5(c."id" || lc."localeId"), 1, 24),
    c."id",
    lc."localeId",
    MAX(CASE WHEN lc."field" = 'title' THEN lc."value" END),
    MAX(CASE WHEN lc."field" = 'description' THEN lc."value" END),
    MAX(CASE WHEN lc."field" = 'buttonText' THEN lc."value" END),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Campaign" c
INNER JOIN "LocalizedContent" lc
    ON lc."entityId" = c."id"
   AND lc."entityType" = 'CAMPAIGN'
GROUP BY c."id", lc."localeId"
ON CONFLICT ("campaignId", "localeId") DO NOTHING;

-- ── Event ─────────────────────────────────────────────────────────────────────

ALTER TABLE "Event" ADD COLUMN "sameImageForAllLocales" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Event" RENAME COLUMN "coverMediaId" TO "sharedCoverImageId";
ALTER TABLE "Event" RENAME CONSTRAINT "Event_coverMediaId_fkey" TO "Event_sharedCoverImageId_fkey";

ALTER TABLE "Event" ADD COLUMN "publishStartAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "publishEndAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "eventStartAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "eventEndAt" TIMESTAMP(3);

UPDATE "Event"
SET
  "eventStartAt" = "startAt",
  "eventEndAt" = "endAt",
  "publishStartAt" = COALESCE("publishedAt", "createdAt"),
  "publishEndAt" = NULL;

ALTER TABLE "Event" DROP COLUMN "startAt";
ALTER TABLE "Event" DROP COLUMN "endAt";

DROP INDEX IF EXISTS "Event_tenantId_startAt_idx";

CREATE INDEX "Event_tenantId_eventStartAt_idx" ON "Event"("tenantId", "eventStartAt");
CREATE INDEX "Event_status_publishStartAt_idx" ON "Event"("status", "publishStartAt");
CREATE INDEX "Event_status_publishEndAt_idx" ON "Event"("status", "publishEndAt");

CREATE TABLE "EventTranslation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "localeId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "shortDescription" TEXT,
    "coverImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventTranslation_eventId_localeId_key" ON "EventTranslation"("eventId", "localeId");
CREATE INDEX "EventTranslation_eventId_idx" ON "EventTranslation"("eventId");

ALTER TABLE "EventTranslation" ADD CONSTRAINT "EventTranslation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTranslation" ADD CONSTRAINT "EventTranslation_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "Locale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTranslation" ADD CONSTRAINT "EventTranslation_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "EventTranslation" ("id", "eventId", "localeId", "title", "description", "shortDescription", "createdAt", "updatedAt")
SELECT
    'et_' || substr(md5(e."id" || lc."localeId"), 1, 24),
    e."id",
    lc."localeId",
    MAX(CASE WHEN lc."field" = 'title' THEN lc."value" END),
    MAX(CASE WHEN lc."field" = 'description' THEN lc."value" END),
    MAX(CASE WHEN lc."field" = 'shortDescription' THEN lc."value" END),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Event" e
INNER JOIN "LocalizedContent" lc
    ON lc."entityId" = e."id"
   AND lc."entityType" = 'EVENT'
GROUP BY e."id", lc."localeId"
ON CONFLICT ("eventId", "localeId") DO NOTHING;
