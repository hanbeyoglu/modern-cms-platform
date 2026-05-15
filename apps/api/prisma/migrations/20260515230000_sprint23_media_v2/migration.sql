-- Sprint 23: Media Library V2 – asset metadata, folder soft-delete, variants

-- MediaAssetStatus enum
CREATE TYPE "MediaAssetStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- MediaFolder: add sortOrder + soft-delete
ALTER TABLE "MediaFolder"
  ADD COLUMN "sortOrder"  INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN "deletedAt"  TIMESTAMP(3);

-- MediaAsset: add rich metadata columns
ALTER TABLE "MediaAsset"
  ADD COLUMN "caption"         TEXT,
  ADD COLUMN "description"     TEXT,
  ADD COLUMN "tags"            TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN "durationSeconds" DOUBLE PRECISION,
  ADD COLUMN "focalPointX"     DOUBLE PRECISION,
  ADD COLUMN "focalPointY"     DOUBLE PRECISION,
  ADD COLUMN "dominantColor"   TEXT,
  ADD COLUMN "source"          TEXT,
  ADD COLUMN "checksum"        TEXT,
  ADD COLUMN "status"          "MediaAssetStatus" NOT NULL DEFAULT 'ACTIVE';

-- New index for MediaAsset status filter
CREATE INDEX "MediaAsset_tenantId_status_idx" ON "MediaAsset"("tenantId", "status");

-- MediaVariant table
CREATE TABLE "MediaVariant" (
  "id"           TEXT          NOT NULL,
  "mediaAssetId" TEXT          NOT NULL,
  "variantKey"   TEXT          NOT NULL,
  "url"          TEXT          NOT NULL,
  "width"        INTEGER,
  "height"       INTEGER,
  "mimeType"     TEXT          NOT NULL,
  "fileSize"     INTEGER       NOT NULL,
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MediaVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaVariant_mediaAssetId_variantKey_key"
  ON "MediaVariant"("mediaAssetId", "variantKey");

CREATE INDEX "MediaVariant_mediaAssetId_idx"
  ON "MediaVariant"("mediaAssetId");

ALTER TABLE "MediaVariant"
  ADD CONSTRAINT "MediaVariant_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId")
  REFERENCES "MediaAsset"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
