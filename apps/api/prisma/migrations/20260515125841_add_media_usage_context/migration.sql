-- Media usage context (Sprint 26) — MediaAsset columns only.
-- tags DROP DEFAULT runs in 20260515230000_sprint23 (column created there).
-- Popup/Service/channel defaults run in 20260516020000_sprint25.

ALTER TABLE "MediaAsset"
  ADD COLUMN "suggestedHeight" INTEGER,
  ADD COLUMN "suggestedWidth" INTEGER,
  ADD COLUMN "usageContext" TEXT;
