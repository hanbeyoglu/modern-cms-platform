-- System language management permissions (language architecture refactor)
INSERT INTO "Permission" ("id", "code", "description", "createdAt", "updatedAt")
VALUES
  ('perm_system_language_read', 'system-language:read', 'system-language:read', NOW(), NOW()),
  ('perm_system_language_create', 'system-language:create', 'system-language:create', NOW(), NOW()),
  ('perm_system_language_update', 'system-language:update', 'system-language:update', NOW(), NOW()),
  ('perm_system_language_delete', 'system-language:delete', 'system-language:delete', NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", NOW()
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."code" = 'SUPER_ADMIN'
  AND p."code" IN (
    'system-language:read',
    'system-language:create',
    'system-language:update',
    'system-language:delete'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
