-- Move item-level translations from slider group to slider item
UPDATE "LocalizedContent" lc
SET
    "entityType" = 'SLIDER_ITEM',
    "entityId" = si."id",
    "field" = CASE WHEN lc."field" = 'subtitle' THEN 'description' ELSE lc."field" END
FROM "SliderItem" si
WHERE si."sliderId" = lc."entityId"
  AND lc."entityType" = 'SLIDER'
  AND lc."field" IN ('subtitle', 'description', 'buttonText');
