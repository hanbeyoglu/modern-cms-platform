-- CreateEnum
CREATE TYPE "SliderStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SliderTargetDevice" AS ENUM ('ALL', 'DESKTOP', 'MOBILE');

-- CreateEnum
CREATE TYPE "SliderLinkType" AS ENUM ('NONE', 'EXTERNAL_URL', 'INTERNAL_PAGE', 'EVENT', 'CAMPAIGN', 'STORE');

-- CreateTable
CREATE TABLE "Slider" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mallId" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "desktopMediaId" TEXT,
    "mobileMediaId" TEXT,
    "videoMediaId" TEXT,
    "linkType" "SliderLinkType" NOT NULL DEFAULT 'NONE',
    "linkValue" TEXT,
    "buttonText" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "SliderStatus" NOT NULL DEFAULT 'DRAFT',
    "targetDevice" "SliderTargetDevice" NOT NULL DEFAULT 'ALL',
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Slider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Slider_tenantId_status_idx" ON "Slider"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Slider_tenantId_mallId_idx" ON "Slider"("tenantId", "mallId");

-- CreateIndex
CREATE INDEX "Slider_tenantId_sortOrder_idx" ON "Slider"("tenantId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Slider" ADD CONSTRAINT "Slider_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slider" ADD CONSTRAINT "Slider_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slider" ADD CONSTRAINT "Slider_desktopMediaId_fkey" FOREIGN KEY ("desktopMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slider" ADD CONSTRAINT "Slider_mobileMediaId_fkey" FOREIGN KEY ("mobileMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slider" ADD CONSTRAINT "Slider_videoMediaId_fkey" FOREIGN KEY ("videoMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slider" ADD CONSTRAINT "Slider_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slider" ADD CONSTRAINT "Slider_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
