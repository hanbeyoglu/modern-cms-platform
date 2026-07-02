-- MallStore: displayTitle -> detailTitle (detail page heading only; list uses global brand name)
ALTER TABLE "MallStore" RENAME COLUMN "displayTitle" TO "detailTitle";

UPDATE "LocalizedContent"
SET field = 'detailTitle'
WHERE "entityType" = 'STORE' AND field = 'displayTitle';
