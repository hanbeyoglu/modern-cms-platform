-- CreateEnum
CREATE TYPE "CapabilityCategory" AS ENUM ('CORE', 'CONTENT', 'OPERATIONS', 'ANALYTICS', 'LOCALIZATION', 'PUBLIC_DELIVERY', 'SEARCH', 'CDP', 'AI', 'INTEGRATION');

-- CreateTable
CREATE TABLE "Capability" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "CapabilityCategory" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Capability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantCapability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantCapability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Capability_code_key" ON "Capability"("code");

-- CreateIndex
CREATE INDEX "TenantCapability_tenantId_idx" ON "TenantCapability"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantCapability_tenantId_capabilityId_key" ON "TenantCapability"("tenantId", "capabilityId");

-- AddForeignKey
ALTER TABLE "TenantCapability" ADD CONSTRAINT "TenantCapability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCapability" ADD CONSTRAINT "TenantCapability_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "Capability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
