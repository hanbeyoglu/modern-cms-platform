-- Migration: screening_halls_session_refactor
-- Creates ScreeningHall entity for proper hall/salon management
-- Loosens MovieSession constraints: cinemaId and startsAt become optional
-- Adds showTime (required), showDate (optional), hallId (optional) to MovieSession

-- ─── Create ScreeningHall table ────────────────────────────────────────────────
CREATE TABLE "ScreeningHall" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "mallId"    TEXT NOT NULL,
    "cinemaId"  TEXT,
    "name"      TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "capacity"  INTEGER,
    "is3D"      BOOLEAN NOT NULL DEFAULT false,
    "isImax"    BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ScreeningHall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScreeningHall_mallId_slug_key"          ON "ScreeningHall"("mallId", "slug");
CREATE INDEX        "ScreeningHall_tenantId_mallId_idx"       ON "ScreeningHall"("tenantId", "mallId");
CREATE INDEX        "ScreeningHall_tenantId_mallId_deletedAt" ON "ScreeningHall"("tenantId", "mallId", "deletedAt");

ALTER TABLE "ScreeningHall"
    ADD CONSTRAINT "ScreeningHall_tenantId_fkey"  FOREIGN KEY ("tenantId")  REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ScreeningHall_mallId_fkey"    FOREIGN KEY ("mallId")    REFERENCES "Mall"("id")   ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ScreeningHall_cinemaId_fkey"  FOREIGN KEY ("cinemaId")  REFERENCES "Cinema"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ScreeningHall_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id")   ON UPDATE CASCADE,
    ADD CONSTRAINT "ScreeningHall_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id")   ON UPDATE CASCADE;

-- ─── Modify MovieSession ───────────────────────────────────────────────────────

-- Add new columns
ALTER TABLE "MovieSession"
    ADD COLUMN "hallId"   TEXT,
    ADD COLUMN "showTime" TEXT,
    ADD COLUMN "showDate" TEXT;

-- Make cinemaId optional (was NOT NULL)
ALTER TABLE "MovieSession" ALTER COLUMN "cinemaId" DROP NOT NULL;

-- Make startsAt optional (was NOT NULL)
ALTER TABLE "MovieSession" ALTER COLUMN "startsAt" DROP NOT NULL;

-- Add FK for hallId
ALTER TABLE "MovieSession"
    ADD CONSTRAINT "MovieSession_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "ScreeningHall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add new indexes
CREATE INDEX "MovieSession_tenantId_mallId_showDate_idx" ON "MovieSession"("tenantId", "mallId", "showDate");
CREATE INDEX "MovieSession_hallId_idx"                   ON "MovieSession"("hallId");

-- Backfill showTime and showDate from startsAt for existing sessions
UPDATE "MovieSession"
SET
    "showTime" = TO_CHAR("startsAt" AT TIME ZONE 'UTC', 'HH24:MI'),
    "showDate" = TO_CHAR("startsAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "startsAt" IS NOT NULL AND "showTime" IS NULL;
