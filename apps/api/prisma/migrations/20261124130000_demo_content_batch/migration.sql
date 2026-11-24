-- CreateEnum
CREATE TYPE "DemoContentBatchAction" AS ENUM ('IMPORT', 'REMOVE', 'RESET');

-- CreateEnum
CREATE TYPE "DemoContentBatchStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "DemoContentBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mallId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL DEFAULT 'metrogarden',
    "action" "DemoContentBatchAction" NOT NULL,
    "status" "DemoContentBatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT NOT NULL,
    "reportJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoContentBatch_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ContentImportMapping" ADD COLUMN "batchId" TEXT;

-- CreateIndex
CREATE INDEX "DemoContentBatch_tenantId_mallId_status_idx" ON "DemoContentBatch"("tenantId", "mallId", "status");

-- CreateIndex
CREATE INDEX "DemoContentBatch_tenantId_mallId_createdAt_idx" ON "DemoContentBatch"("tenantId", "mallId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentImportMapping_batchId_idx" ON "ContentImportMapping"("batchId");

-- AddForeignKey
ALTER TABLE "DemoContentBatch" ADD CONSTRAINT "DemoContentBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoContentBatch" ADD CONSTRAINT "DemoContentBatch_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentImportMapping" ADD CONSTRAINT "ContentImportMapping_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DemoContentBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
