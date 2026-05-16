-- Optional usage-level media dimension guidance.
-- These columns intentionally live on the consuming content records, not MediaAsset.

ALTER TABLE "SliderItem"
  ADD COLUMN "desktopMediaWidthOverride" INTEGER,
  ADD COLUMN "desktopMediaHeightOverride" INTEGER,
  ADD COLUMN "mobileMediaWidthOverride" INTEGER,
  ADD COLUMN "mobileMediaHeightOverride" INTEGER;

ALTER TABLE "Event"
  ADD COLUMN "coverMediaWidthOverride" INTEGER,
  ADD COLUMN "coverMediaHeightOverride" INTEGER;

ALTER TABLE "Campaign"
  ADD COLUMN "coverMediaWidthOverride" INTEGER,
  ADD COLUMN "coverMediaHeightOverride" INTEGER;

ALTER TABLE "Popup"
  ADD COLUMN "imageMediaWidthOverride" INTEGER,
  ADD COLUMN "imageMediaHeightOverride" INTEGER;

ALTER TABLE "Service"
  ADD COLUMN "iconMediaWidthOverride" INTEGER,
  ADD COLUMN "iconMediaHeightOverride" INTEGER,
  ADD COLUMN "coverMediaWidthOverride" INTEGER,
  ADD COLUMN "coverMediaHeightOverride" INTEGER;
