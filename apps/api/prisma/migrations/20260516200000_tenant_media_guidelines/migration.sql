-- Tenant-level media usage recommendations (dimensions, mime types, helper text).

CREATE TABLE "TenantMediaGuideline" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usageKey" TEXT NOT NULL,
    "recommendedWidth" INTEGER NOT NULL,
    "recommendedHeight" INTEGER NOT NULL,
    "acceptedMimeTypes" TEXT[] NOT NULL,
    "helperText" TEXT,
    "aspectRatioLocked" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMediaGuideline_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantMediaGuideline_tenantId_usageKey_key" ON "TenantMediaGuideline"("tenantId", "usageKey");

CREATE INDEX "TenantMediaGuideline_tenantId_active_idx" ON "TenantMediaGuideline"("tenantId", "active");

ALTER TABLE "TenantMediaGuideline" ADD CONSTRAINT "TenantMediaGuideline_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
