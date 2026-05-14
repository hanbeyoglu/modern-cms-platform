-- Sprint 13: Page scheduling fields + worker-friendly indexes

ALTER TABLE "Page" ADD COLUMN "publishAt" TIMESTAMP(3),
ADD COLUMN "unpublishAt" TIMESTAMP(3);

CREATE INDEX "Page_status_publishAt_idx" ON "Page"("status", "publishAt");
CREATE INDEX "Page_status_unpublishAt_idx" ON "Page"("status", "unpublishAt");

CREATE INDEX "Slider_status_startAt_idx" ON "Slider"("status", "startAt");
CREATE INDEX "Slider_status_endAt_idx" ON "Slider"("status", "endAt");

CREATE INDEX "Event_status_startAt_idx" ON "Event"("status", "startAt");
CREATE INDEX "Event_status_endAt_idx" ON "Event"("status", "endAt");

CREATE INDEX "Campaign_status_startAt_idx" ON "Campaign"("status", "startAt");
CREATE INDEX "Campaign_status_endAt_idx" ON "Campaign"("status", "endAt");
