-- Sprint 24: static/legal/document page metadata and attachments

ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'ABOUT';
ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'KVKK';
ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'PRIVACY_POLICY';
ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'COOKIE_POLICY';
ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'TERMS_OF_USE';
ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'CONTACT_INFO';
ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'FAQ';
ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'TRANSPORTATION';
ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'CERTIFICATES';
ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'DOCUMENTS';
ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'AWARDS';

ALTER TABLE "Page"
ADD COLUMN "customTypeLabel" TEXT,
ADD COLUMN "contentHtml" TEXT;

CREATE TABLE "PageAttachment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "mallId" TEXT,
  "pageId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "downloadable" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "PageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PageAttachment_pageId_sortOrder_idx" ON "PageAttachment"("pageId", "sortOrder");
CREATE INDEX "PageAttachment_tenantId_pageId_idx" ON "PageAttachment"("tenantId", "pageId");
CREATE INDEX "PageAttachment_mediaId_idx" ON "PageAttachment"("mediaId");

ALTER TABLE "PageAttachment" ADD CONSTRAINT "PageAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageAttachment" ADD CONSTRAINT "PageAttachment_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PageAttachment" ADD CONSTRAINT "PageAttachment_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageAttachment" ADD CONSTRAINT "PageAttachment_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PageAttachment" ADD CONSTRAINT "PageAttachment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PageAttachment" ADD CONSTRAINT "PageAttachment_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
