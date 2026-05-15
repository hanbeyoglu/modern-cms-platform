-- DropForeignKey
ALTER TABLE "Popup" DROP CONSTRAINT "Popup_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "Popup" DROP CONSTRAINT "Popup_updatedBy_fkey";

-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_updatedBy_fkey";

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "channels" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "channels" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MallStore" ALTER COLUMN "searchTags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "suggestedHeight" INTEGER,
ADD COLUMN     "suggestedWidth" INTEGER,
ADD COLUMN     "usageContext" TEXT,
ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Popup" ALTER COLUMN "channels" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "searchTags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Slider" ALTER COLUMN "channels" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Popup" ADD CONSTRAINT "Popup_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Popup" ADD CONSTRAINT "Popup_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
