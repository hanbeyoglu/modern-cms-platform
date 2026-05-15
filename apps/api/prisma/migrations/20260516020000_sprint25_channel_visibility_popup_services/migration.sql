-- Sprint 25: Channel Visibility, Popup & Services

-- ── Channel enum ──────────────────────────────────────────────────────────────
CREATE TYPE "Channel" AS ENUM ('WEB', 'MOBILE', 'KIOSK', 'SIGNAGE');

-- ── LocalizedEntityType additions ────────────────────────────────────────────
ALTER TYPE "LocalizedEntityType" ADD VALUE 'POPUP';
ALTER TYPE "LocalizedEntityType" ADD VALUE 'SERVICE';

-- ── SearchIndexEntityType additions ──────────────────────────────────────────
ALTER TYPE "SearchIndexEntityType" ADD VALUE 'POPUP';
ALTER TYPE "SearchIndexEntityType" ADD VALUE 'SERVICE';

-- ── channels[] on Slider ─────────────────────────────────────────────────────
ALTER TABLE "Slider" ADD COLUMN "channels" "Channel"[] NOT NULL DEFAULT ARRAY['WEB', 'MOBILE']::"Channel"[];

-- ── channels[] on Event ──────────────────────────────────────────────────────
ALTER TABLE "Event" ADD COLUMN "channels" "Channel"[] NOT NULL DEFAULT ARRAY['WEB', 'MOBILE']::"Channel"[];

-- ── channels[] on Campaign ───────────────────────────────────────────────────
ALTER TABLE "Campaign" ADD COLUMN "channels" "Channel"[] NOT NULL DEFAULT ARRAY['WEB', 'MOBILE']::"Channel"[];

-- ── isSoon + searchTags on MallStore ─────────────────────────────────────────
ALTER TABLE "MallStore" ADD COLUMN "isSoon" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MallStore" ADD COLUMN "searchTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ── PopupStatus enum ─────────────────────────────────────────────────────────
CREATE TYPE "PopupStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- ── Popup model ───────────────────────────────────────────────────────────────
CREATE TABLE "Popup" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "mallId"       TEXT,
  "title"        TEXT NOT NULL,
  "description"  TEXT,
  "imageMediaId" TEXT,
  "linkUrl"      TEXT,
  "buttonText"   TEXT,
  "status"       "PopupStatus" NOT NULL DEFAULT 'DRAFT',
  "channels"     "Channel"[] NOT NULL DEFAULT ARRAY['WEB', 'MOBILE']::"Channel"[],
  "startAt"      TIMESTAMP(3),
  "endAt"        TIMESTAMP(3),
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "showOnce"     BOOLEAN NOT NULL DEFAULT false,
  "closable"     BOOLEAN NOT NULL DEFAULT true,
  "metadataJson" JSONB,
  "createdBy"    TEXT NOT NULL,
  "updatedBy"    TEXT,
  "publishedAt"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  "deletedAt"    TIMESTAMP(3),
  CONSTRAINT "Popup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Popup_tenantId_status_idx" ON "Popup"("tenantId", "status");
CREATE INDEX "Popup_tenantId_mallId_idx" ON "Popup"("tenantId", "mallId");
CREATE INDEX "Popup_tenantId_sortOrder_idx" ON "Popup"("tenantId", "sortOrder");
CREATE INDEX "Popup_status_startAt_idx" ON "Popup"("status", "startAt");
CREATE INDEX "Popup_status_endAt_idx" ON "Popup"("status", "endAt");

ALTER TABLE "Popup" ADD CONSTRAINT "Popup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Popup" ADD CONSTRAINT "Popup_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Popup" ADD CONSTRAINT "Popup_imageMediaId_fkey" FOREIGN KEY ("imageMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Popup" ADD CONSTRAINT "Popup_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Popup" ADD CONSTRAINT "Popup_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── ServiceStatus enum ───────────────────────────────────────────────────────
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- ── Service model ─────────────────────────────────────────────────────────────
CREATE TABLE "Service" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "mallId"        TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "iconMediaId"   TEXT,
  "coverMediaId"  TEXT,
  "category"      TEXT,
  "floor"         TEXT,
  "unitNo"        TEXT,
  "phone"         TEXT,
  "email"         TEXT,
  "websiteUrl"    TEXT,
  "locationLabel" TEXT,
  "latitude"      DOUBLE PRECISION,
  "longitude"     DOUBLE PRECISION,
  "searchTags"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isSoon"        BOOLEAN NOT NULL DEFAULT false,
  "status"        "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
  "sortOrder"     INTEGER NOT NULL DEFAULT 0,
  "metadataJson"  JSONB,
  "createdBy"     TEXT NOT NULL,
  "updatedBy"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  "deletedAt"     TIMESTAMP(3),
  CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Service_tenantId_mallId_idx" ON "Service"("tenantId", "mallId");
CREATE INDEX "Service_tenantId_status_idx" ON "Service"("tenantId", "status");
CREATE INDEX "Service_tenantId_mallId_status_idx" ON "Service"("tenantId", "mallId", "status");
CREATE INDEX "Service_tenantId_sortOrder_idx" ON "Service"("tenantId", "sortOrder");

ALTER TABLE "Service" ADD CONSTRAINT "Service_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_iconMediaId_fkey" FOREIGN KEY ("iconMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Align channel/searchTags columns with schema (no DB-level defaults)
ALTER TABLE "Slider" ALTER COLUMN "channels" DROP DEFAULT;
ALTER TABLE "Event" ALTER COLUMN "channels" DROP DEFAULT;
ALTER TABLE "Campaign" ALTER COLUMN "channels" DROP DEFAULT;
ALTER TABLE "MallStore" ALTER COLUMN "searchTags" DROP DEFAULT;
ALTER TABLE "Popup" ALTER COLUMN "channels" DROP DEFAULT;
ALTER TABLE "Service" ALTER COLUMN "searchTags" DROP DEFAULT;
