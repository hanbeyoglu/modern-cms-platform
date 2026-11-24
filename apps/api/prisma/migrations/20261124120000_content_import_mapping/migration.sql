-- CreateTable
CREATE TABLE "ContentImportMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mallId" TEXT,
    "sourceSystem" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentImportMapping_tenantId_entityType_idx" ON "ContentImportMapping"("tenantId", "entityType");

-- CreateIndex
CREATE INDEX "ContentImportMapping_tenantId_mallId_idx" ON "ContentImportMapping"("tenantId", "mallId");

-- CreateIndex
CREATE INDEX "ContentImportMapping_entityId_idx" ON "ContentImportMapping"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentImportMapping_tenantId_sourceSystem_entityType_sourceKey_key" ON "ContentImportMapping"("tenantId", "sourceSystem", "entityType", "sourceKey");

-- AddForeignKey
ALTER TABLE "ContentImportMapping" ADD CONSTRAINT "ContentImportMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentImportMapping" ADD CONSTRAINT "ContentImportMapping_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE SET NULL ON UPDATE CASCADE;
