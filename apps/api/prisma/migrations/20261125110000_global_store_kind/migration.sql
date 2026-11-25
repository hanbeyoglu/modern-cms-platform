ALTER TABLE "GlobalStore" ADD COLUMN "kind" "MallStoreKind" NOT NULL DEFAULT 'STORE';
UPDATE "GlobalStore" g SET "kind" = 'RESTAURANT' WHERE EXISTS (
  SELECT 1 FROM "MallStore" s WHERE s."globalStoreId" = g."id" AND s."kind" = 'RESTAURANT' AND s."deletedAt" IS NULL
);
UPDATE "MallStore" s SET "kind" = g."kind" FROM "GlobalStore" g WHERE s."globalStoreId" = g."id" AND s."kind" <> g."kind";
