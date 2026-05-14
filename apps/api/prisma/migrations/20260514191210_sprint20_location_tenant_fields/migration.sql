-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('SHOPPING_MALL', 'STORE', 'MARKET', 'HOTEL', 'HOSPITAL', 'CAMPUS', 'OFFICE', 'RESTAURANT', 'MARINA', 'RESIDENCE', 'AIRPORT', 'CUSTOM');

-- AlterEnum
ALTER TYPE "LocalizedEntityType" ADD VALUE 'LOCATION';

-- AlterEnum
ALTER TYPE "SearchIndexEntityType" ADD VALUE 'LOCATION';

-- AlterTable
ALTER TABLE "Mall" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "coverMediaId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "logoMediaId" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "socialLinksJson" JSONB,
ADD COLUMN     "supportEmail" TEXT,
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "type" "LocationType" NOT NULL DEFAULT 'SHOPPING_MALL',
ADD COLUMN     "websiteUrl" TEXT,
ADD COLUMN     "workingHoursJson" JSONB;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "addressJson" JSONB,
ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "websiteUrl" TEXT;

-- AddForeignKey
ALTER TABLE "Mall" ADD CONSTRAINT "Mall_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mall" ADD CONSTRAINT "Mall_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
