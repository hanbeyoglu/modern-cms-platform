import type { PrismaService } from '../../prisma/prisma.service';

export async function uniqueEventSlug(
  prisma: PrismaService,
  tenantId: string,
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  let slug = baseSlug;
  let n = 0;
  for (;;) {
    const found = await prisma.event.findFirst({
      where: {
        tenantId,
        slug,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!found) return slug;
    n += 1;
    slug = `${baseSlug}-${n}`;
  }
}

export async function uniqueCampaignSlug(
  prisma: PrismaService,
  tenantId: string,
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  let slug = baseSlug;
  let n = 0;
  for (;;) {
    const found = await prisma.campaign.findFirst({
      where: {
        tenantId,
        slug,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!found) return slug;
    n += 1;
    slug = `${baseSlug}-${n}`;
  }
}
