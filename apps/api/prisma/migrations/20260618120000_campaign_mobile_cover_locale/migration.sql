-- Campaign locale-aware mobile cover images

ALTER TABLE "Campaign" ADD COLUMN "sharedMobileCoverImageId" TEXT;

ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_sharedMobileCoverImageId_fkey"
  FOREIGN KEY ("sharedMobileCoverImageId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignTranslation" ADD COLUMN "mobileCoverImageId" TEXT;

ALTER TABLE "CampaignTranslation"
  ADD CONSTRAINT "CampaignTranslation_mobileCoverImageId_fkey"
  FOREIGN KEY ("mobileCoverImageId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
