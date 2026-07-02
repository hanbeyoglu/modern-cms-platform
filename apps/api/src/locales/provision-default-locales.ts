import type { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { OFFICIAL_SUPPORTED_LANGUAGES } from './supported-languages';

type PrismaLike = PrismaService | PrismaClient;

/** Idempotent locale catalog seeding — tenant create, migrations, and seed only. Never call from GET handlers. */
export async function provisionDefaultLocalesIfMissing(
  prisma: PrismaLike,
  tenantId: string,
): Promise<{ provisioned: boolean; count: number }> {
  const existing = await prisma.locale.count({ where: { tenantId } });
  if (existing > 0) {
    return { provisioned: false, count: existing };
  }

  await prisma.locale.createMany({
    data: OFFICIAL_SUPPORTED_LANGUAGES.map((row, i) => ({
      tenantId,
      code: row.code,
      name: row.name,
      nativeName: row.nativeName,
      isDefault: row.code === 'tr',
      isActive: row.code === 'tr' || row.code === 'en',
      rtl: row.rtl,
      sortOrder: i,
    })),
  });

  return { provisioned: true, count: OFFICIAL_SUPPORTED_LANGUAGES.length };
}
