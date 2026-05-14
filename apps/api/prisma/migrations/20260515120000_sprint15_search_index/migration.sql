-- Sprint 15: denormalized search documents + PostgreSQL FTS (GIN on to_tsvector)

CREATE TYPE "SearchIndexEntityType" AS ENUM (
  'PAGE',
  'EVENT',
  'CAMPAIGN',
  'GLOBAL_STORE',
  'MALL_STORE',
  'MOVIE',
  'CINEMA',
  'SLIDER',
  'LOCATION'
);

CREATE TABLE "SearchIndexEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "mallId" TEXT,
    "entityType" "SearchIndexEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "slug" TEXT,
    "document" TEXT NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchIndexEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SearchIndexEntry_entityType_entityId_key" ON "SearchIndexEntry"("entityType", "entityId");

CREATE INDEX "SearchIndexEntry_tenantId_idx" ON "SearchIndexEntry"("tenantId");

CREATE INDEX "SearchIndexEntry_tenantId_mallId_idx" ON "SearchIndexEntry"("tenantId", "mallId");

CREATE INDEX "SearchIndexEntry_document_tsv_idx" ON "SearchIndexEntry" USING gin (to_tsvector('simple', "document"));

ALTER TABLE "SearchIndexEntry" ADD CONSTRAINT "SearchIndexEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SearchIndexEntry" ADD CONSTRAINT "SearchIndexEntry_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
