CREATE TYPE "MallStoreKind" AS ENUM ('STORE', 'RESTAURANT');
ALTER TABLE "MallStore" ADD COLUMN "kind" "MallStoreKind" NOT NULL DEFAULT 'STORE';
CREATE INDEX "MallStore_tenantId_mallId_kind_idx" ON "MallStore"("tenantId", "mallId", "kind");
