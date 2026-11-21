ALTER TABLE "Movie" ADD COLUMN "manualStatusOverride" BOOLEAN NOT NULL DEFAULT false;
-- Preserve editorial decisions already made before automatic archiving is enabled.
UPDATE "Movie" SET "manualStatusOverride" = true WHERE "status" IN ('PASSIVE', 'ARCHIVED');
-- Films previously confirmed unavailable by a successful sync belong in the archive.
UPDATE "Movie" SET "status" = 'ARCHIVED'
WHERE "provider" = 'TMDB' AND "notCurrentlyAvailable" = true
  AND "listingStatus" = 'OTHER' AND "status" = 'ACTIVE' AND "deletedAt" IS NULL;
-- Existing manual films stay manageable in the current catalogue.
UPDATE "Movie" SET "listingStatus" = 'NOW_PLAYING'
WHERE "provider" = 'MANUAL' AND "listingStatus" = 'OTHER' AND "status" <> 'ARCHIVED' AND "deletedAt" IS NULL;
