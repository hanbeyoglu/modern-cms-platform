-- Brand-level contact fields on GlobalStore (MallStore keeps optional legacy copies).
ALTER TABLE "GlobalStore" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "GlobalStore" ADD COLUMN IF NOT EXISTS "email" TEXT;
