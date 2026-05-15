-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'SECURITY', 'CRITICAL');

-- AlterTable
ALTER TABLE "AuditLog"
  ADD COLUMN "resourceName"  TEXT,
  ADD COLUMN "severity"      "AuditSeverity" NOT NULL DEFAULT 'INFO',
  ADD COLUMN "source"        TEXT,
  ADD COLUMN "success"       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "requestId"     TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_severity_createdAt_idx" ON "AuditLog"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_resource_createdAt_idx" ON "AuditLog"("resource", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_success_createdAt_idx" ON "AuditLog"("success", "createdAt");
