-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mallId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "coverMediaId" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "category" TEXT,
    "buttonText" TEXT,
    "linkUrl" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dynamicFieldsJson" JSONB,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mallId" TEXT,
    "storeId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "coverMediaId" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "terms" TEXT,
    "couponCode" TEXT,
    "buttonText" TEXT,
    "linkUrl" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dynamicFieldsJson" JSONB,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_tenantId_slug_key" ON "Event"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Event_tenantId_status_idx" ON "Event"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Event_tenantId_mallId_idx" ON "Event"("tenantId", "mallId");

-- CreateIndex
CREATE INDEX "Event_tenantId_sortOrder_idx" ON "Event"("tenantId", "sortOrder");

-- CreateIndex
CREATE INDEX "Event_tenantId_startAt_idx" ON "Event"("tenantId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_tenantId_slug_key" ON "Campaign"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_status_idx" ON "Campaign"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_mallId_idx" ON "Campaign"("tenantId", "mallId");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_storeId_idx" ON "Campaign"("tenantId", "storeId");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_sortOrder_idx" ON "Campaign"("tenantId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "MallStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
