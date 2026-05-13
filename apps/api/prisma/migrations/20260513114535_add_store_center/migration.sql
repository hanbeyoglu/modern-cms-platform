-- CreateEnum
CREATE TYPE "StoreCategoryStatus" AS ENUM ('ACTIVE', 'PASSIVE');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('ACTIVE', 'PASSIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "StoreCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "StoreCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StoreCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalStore" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoMediaId" TEXT,
    "categoryId" TEXT,
    "description" TEXT,
    "websiteUrl" TEXT,
    "socialLinksJson" JSONB,
    "status" "StoreStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GlobalStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MallStore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mallId" TEXT NOT NULL,
    "globalStoreId" TEXT NOT NULL,
    "localName" TEXT,
    "localDescription" TEXT,
    "localLogoMediaId" TEXT,
    "floor" TEXT,
    "storeNo" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "workingHoursJson" JSONB,
    "locationJson" JSONB,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "StoreStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MallStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreCategory_slug_key" ON "StoreCategory"("slug");

-- CreateIndex
CREATE INDEX "StoreCategory_status_idx" ON "StoreCategory"("status");

-- CreateIndex
CREATE INDEX "StoreCategory_sortOrder_idx" ON "StoreCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalStore_slug_key" ON "GlobalStore"("slug");

-- CreateIndex
CREATE INDEX "GlobalStore_categoryId_idx" ON "GlobalStore"("categoryId");

-- CreateIndex
CREATE INDEX "GlobalStore_status_idx" ON "GlobalStore"("status");

-- CreateIndex
CREATE INDEX "MallStore_tenantId_mallId_idx" ON "MallStore"("tenantId", "mallId");

-- CreateIndex
CREATE INDEX "MallStore_globalStoreId_idx" ON "MallStore"("globalStoreId");

-- CreateIndex
CREATE INDEX "MallStore_tenantId_mallId_status_idx" ON "MallStore"("tenantId", "mallId", "status");

-- AddForeignKey
ALTER TABLE "GlobalStore" ADD CONSTRAINT "GlobalStore_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StoreCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalStore" ADD CONSTRAINT "GlobalStore_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalStore" ADD CONSTRAINT "GlobalStore_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalStore" ADD CONSTRAINT "GlobalStore_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MallStore" ADD CONSTRAINT "MallStore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MallStore" ADD CONSTRAINT "MallStore_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MallStore" ADD CONSTRAINT "MallStore_globalStoreId_fkey" FOREIGN KEY ("globalStoreId") REFERENCES "GlobalStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MallStore" ADD CONSTRAINT "MallStore_localLogoMediaId_fkey" FOREIGN KEY ("localLogoMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MallStore" ADD CONSTRAINT "MallStore_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MallStore" ADD CONSTRAINT "MallStore_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One active assignment of a global store per mall (soft-deleted rows may be re-created)
CREATE UNIQUE INDEX "MallStore_mallId_globalStoreId_active_key" ON "MallStore"("mallId", "globalStoreId") WHERE "deletedAt" IS NULL;
