-- Add SLIDER_ITEM to LocalizedEntityType (separate migration for PostgreSQL enum safety)
ALTER TYPE "LocalizedEntityType" ADD VALUE IF NOT EXISTS 'SLIDER_ITEM';
