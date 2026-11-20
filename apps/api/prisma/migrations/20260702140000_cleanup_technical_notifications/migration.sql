-- One-time cleanup: remove technical scheduler/worker failure rows from the user inbox.
-- Operational notifications (SCHEDULING success, CONTENT, SECURITY, etc.) are untouched.

UPDATE "Notification"
SET "deletedAt" = NOW()
WHERE "deletedAt" IS NULL
  AND (
    (
      "type" = 'SYSTEM'
      AND "severity" = 'ERROR'
      AND "title" = 'Zamanlama işi başarısız'
    )
    OR ("metadataJson"->>'workerFailure' = 'true')
  );
