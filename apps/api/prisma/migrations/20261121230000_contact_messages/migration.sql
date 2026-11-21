-- CreateEnum
CREATE TYPE "ContactMessageStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mallId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(30),
    "subject" VARCHAR(180),
    "message" VARCHAR(5000) NOT NULL,
    "status" "ContactMessageStatus" NOT NULL DEFAULT 'NEW',
    "kvkkConsent" BOOLEAN NOT NULL,
    "kvkkConsentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactMessage_tenantId_mallId_createdAt_id_idx" ON "ContactMessage"("tenantId", "mallId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ContactMessage_tenantId_mallId_status_createdAt_idx" ON "ContactMessage"("tenantId", "mallId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_tenantId_status_createdAt_idx" ON "ContactMessage"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Mall_id_tenantId_key" ON "Mall"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_mallId_tenantId_fkey" FOREIGN KEY ("mallId", "tenantId") REFERENCES "Mall"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Provision permissions without running the demo seed against production.
INSERT INTO "Permission" ("id", "code", "description", "updatedAt") VALUES
('perm_contact_message_read', 'contact-message:read', 'İletişim mesajlarını oku', CURRENT_TIMESTAMP),
('perm_contact_message_update', 'contact-message:update', 'İletişim mesajı durumunu güncelle', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."isSystem" = true AND r."code" IN ('SUPER_ADMIN', 'TENANT_ADMIN', 'MALL_MANAGER')
AND p."code" IN ('contact-message:read', 'contact-message:update')
ON CONFLICT DO NOTHING;
