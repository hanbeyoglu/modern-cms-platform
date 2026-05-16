-- Slider groups + items refactor

-- CreateEnum
CREATE TYPE "SliderPlacementType" AS ENUM ('HOME', 'CAMPAIGN', 'EVENT', 'STORE', 'LOCATION', 'CUSTOM');
CREATE TYPE "SliderLinkedEntityType" AS ENUM ('CAMPAIGN', 'EVENT', 'STORE', 'LOCATION');

-- AlterTable: add group fields
ALTER TABLE "Slider" ADD COLUMN "placementType" "SliderPlacementType" NOT NULL DEFAULT 'HOME';
ALTER TABLE "Slider" ADD COLUMN "linkedEntityType" "SliderLinkedEntityType";
ALTER TABLE "Slider" ADD COLUMN "linkedEntityId" TEXT;

-- CreateTable
CREATE TABLE "SliderItem" (
    "id" TEXT NOT NULL,
    "sliderId" TEXT NOT NULL,
    "desktopMediaId" TEXT,
    "mobileMediaId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "buttonText" TEXT,
    "linkUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "SliderStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SliderItem_pkey" PRIMARY KEY ("id")
);

-- Migrate existing single-image sliders into one item per group
INSERT INTO "SliderItem" (
    "id",
    "sliderId",
    "desktopMediaId",
    "mobileMediaId",
    "title",
    "description",
    "buttonText",
    "linkUrl",
    "sortOrder",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    s."id" || '-legacy-item',
    s."id",
    COALESCE(s."desktopMediaId", s."videoMediaId"),
    s."mobileMediaId",
    s."title",
    CASE
        WHEN s."subtitle" IS NOT NULL AND s."subtitle" <> '' THEN
            CASE
                WHEN s."description" IS NOT NULL AND s."description" <> '' THEN s."subtitle" || E'\n\n' || s."description"
                ELSE s."subtitle"
            END
        ELSE s."description"
    END,
    s."buttonText",
    CASE
        WHEN s."linkType" = 'EXTERNAL_URL' THEN s."linkValue"
        WHEN s."linkValue" IS NOT NULL AND s."linkValue" <> '' THEN s."linkValue"
        ELSE NULL
    END,
    s."sortOrder",
    s."status",
    s."createdAt",
    s."updatedAt"
FROM "Slider" s
WHERE s."deletedAt" IS NULL
  AND (
    s."desktopMediaId" IS NOT NULL
    OR s."mobileMediaId" IS NOT NULL
    OR s."videoMediaId" IS NOT NULL
    OR s."subtitle" IS NOT NULL
    OR s."description" IS NOT NULL
    OR s."buttonText" IS NOT NULL
    OR (s."linkValue" IS NOT NULL AND s."linkValue" <> '')
  );

-- Map campaign-linked legacy sliders
UPDATE "Slider" s
SET
    "placementType" = 'CAMPAIGN',
    "linkedEntityType" = 'CAMPAIGN',
    "linkedEntityId" = s."linkValue"
WHERE s."linkType" = 'CAMPAIGN'
  AND s."linkValue" IS NOT NULL
  AND s."linkValue" <> '';

UPDATE "Slider" s
SET
    "placementType" = 'EVENT',
    "linkedEntityType" = 'EVENT',
    "linkedEntityId" = s."linkValue"
WHERE s."linkType" = 'EVENT'
  AND s."linkValue" IS NOT NULL
  AND s."linkValue" <> '';

UPDATE "Slider" s
SET
    "placementType" = 'STORE',
    "linkedEntityType" = 'STORE',
    "linkedEntityId" = s."linkValue"
WHERE s."linkType" = 'STORE'
  AND s."linkValue" IS NOT NULL
  AND s."linkValue" <> '';

-- Drop legacy slider columns
ALTER TABLE "Slider" DROP CONSTRAINT IF EXISTS "Slider_desktopMediaId_fkey";
ALTER TABLE "Slider" DROP CONSTRAINT IF EXISTS "Slider_mobileMediaId_fkey";
ALTER TABLE "Slider" DROP CONSTRAINT IF EXISTS "Slider_videoMediaId_fkey";

ALTER TABLE "Slider" DROP COLUMN "subtitle",
DROP COLUMN "description",
DROP COLUMN "desktopMediaId",
DROP COLUMN "mobileMediaId",
DROP COLUMN "videoMediaId",
DROP COLUMN "linkType",
DROP COLUMN "linkValue",
DROP COLUMN "buttonText",
DROP COLUMN "targetDevice";

-- CreateIndex
CREATE INDEX "Slider_tenantId_placementType_idx" ON "Slider"("tenantId", "placementType");
CREATE INDEX "Slider_tenantId_linkedEntityType_linkedEntityId_idx" ON "Slider"("tenantId", "linkedEntityType", "linkedEntityId");
CREATE INDEX "SliderItem_sliderId_sortOrder_idx" ON "SliderItem"("sliderId", "sortOrder");
CREATE INDEX "SliderItem_sliderId_status_idx" ON "SliderItem"("sliderId", "status");

-- AddForeignKey
ALTER TABLE "SliderItem" ADD CONSTRAINT "SliderItem_sliderId_fkey" FOREIGN KEY ("sliderId") REFERENCES "Slider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SliderItem" ADD CONSTRAINT "SliderItem_desktopMediaId_fkey" FOREIGN KEY ("desktopMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SliderItem" ADD CONSTRAINT "SliderItem_mobileMediaId_fkey" FOREIGN KEY ("mobileMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropEnum (legacy)
DROP TYPE "SliderTargetDevice";
DROP TYPE "SliderLinkType";
