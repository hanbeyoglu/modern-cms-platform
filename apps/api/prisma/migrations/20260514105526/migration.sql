-- CreateEnum
CREATE TYPE "LocalizedEntityType" AS ENUM ('PAGE', 'PAGE_BLOCK', 'SLIDER', 'EVENT', 'CAMPAIGN', 'STORE', 'MOVIE', 'CINEMA');

-- CreateTable
CREATE TABLE "Locale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nativeName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Locale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalizedContent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "localeId" TEXT NOT NULL,
    "entityType" "LocalizedEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalizedContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Locale_tenantId_idx" ON "Locale"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Locale_tenantId_code_key" ON "Locale"("tenantId", "code");

-- CreateIndex
CREATE INDEX "LocalizedContent_tenantId_localeId_idx" ON "LocalizedContent"("tenantId", "localeId");

-- CreateIndex
CREATE INDEX "LocalizedContent_entityType_entityId_idx" ON "LocalizedContent"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalizedContent_tenantId_localeId_entityType_entityId_fiel_key" ON "LocalizedContent"("tenantId", "localeId", "entityType", "entityId", "field");

-- AddForeignKey
ALTER TABLE "Locale" ADD CONSTRAINT "Locale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalizedContent" ADD CONSTRAINT "LocalizedContent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalizedContent" ADD CONSTRAINT "LocalizedContent_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "Locale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
