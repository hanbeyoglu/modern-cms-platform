-- CreateEnum
CREATE TYPE "AnalyticsEntityType" AS ENUM ('PAGE', 'SLIDER', 'EVENT', 'CAMPAIGN', 'STORE', 'CINEMA', 'MOVIE', 'MOVIE_SESSION', 'FORM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('PAGE_VIEW', 'SLIDER_VIEW', 'SLIDER_CLICK', 'EVENT_VIEW', 'EVENT_CLICK', 'CAMPAIGN_VIEW', 'CAMPAIGN_CLICK', 'STORE_VIEW', 'STORE_CLICK', 'CINEMA_VIEW', 'MOVIE_VIEW', 'MOVIE_SESSION_CLICK', 'FORM_SUBMIT', 'CUSTOM');

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mallId" TEXT,
    "entityType" "AnalyticsEntityType" NOT NULL,
    "entityId" TEXT,
    "eventType" "AnalyticsEventType" NOT NULL,
    "path" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "deviceType" TEXT,
    "ipHash" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_tenantId_mallId_createdAt_idx" ON "AnalyticsEvent"("tenantId", "mallId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_entityType_entityId_idx" ON "AnalyticsEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_idx" ON "AnalyticsEvent"("eventType");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE SET NULL ON UPDATE CASCADE;
