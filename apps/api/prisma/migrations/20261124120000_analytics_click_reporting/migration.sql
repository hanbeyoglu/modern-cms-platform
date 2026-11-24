ALTER TYPE "AnalyticsEventType" ADD VALUE IF NOT EXISTS 'CINEMA_CLICK';
ALTER TYPE "AnalyticsEventType" ADD VALUE IF NOT EXISTS 'MOVIE_CLICK';
ALTER TYPE "AnalyticsEventType" ADD VALUE IF NOT EXISTS 'LINK_CLICK';
ALTER TABLE "AnalyticsEvent" ADD COLUMN "clientEventId" TEXT;
CREATE UNIQUE INDEX "AnalyticsEvent_tenantId_mallId_clientEventId_key" ON "AnalyticsEvent"("tenantId", "mallId", "clientEventId");
CREATE INDEX "AnalyticsEvent_tenantId_mallId_eventType_createdAt_idx" ON "AnalyticsEvent"("tenantId", "mallId", "eventType", "createdAt");
