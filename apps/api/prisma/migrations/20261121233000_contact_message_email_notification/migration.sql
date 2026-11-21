-- CreateEnum
CREATE TYPE "ContactEmailNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "ContactMessage"
ADD COLUMN "emailNotificationStatus" "ContactEmailNotificationStatus" NOT NULL DEFAULT 'SKIPPED',
ADD COLUMN "emailNotificationSentAt" TIMESTAMP(3),
ADD COLUMN "emailNotificationAttempts" INTEGER NOT NULL DEFAULT 0;

-- Drop the temporary default so new rows must set status explicitly from the app.
ALTER TABLE "ContactMessage" ALTER COLUMN "emailNotificationStatus" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "ContactMessage_emailNotificationStatus_createdAt_idx" ON "ContactMessage"("emailNotificationStatus", "createdAt");
