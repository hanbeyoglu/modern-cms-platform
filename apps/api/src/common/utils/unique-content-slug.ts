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

export async function uniqueCinemaSlug(
  prisma: PrismaService,
  mallId: string,
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  let slug = baseSlug;
  let n = 0;
  for (;;) {
    const found = await prisma.cinema.findFirst({
      where: {
        mallId,
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

export async function uniqueMovieSlug(
  prisma: PrismaService,
  tenantId: string,
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  let slug = baseSlug;
  let n = 0;
  for (;;) {
    const found = await prisma.movie.findFirst({
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

export async function uniquePageSlug(
  prisma: PrismaService,
  tenantId: string,
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  let slug = baseSlug;
  let n = 0;
  for (;;) {
    const found = await prisma.page.findFirst({
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
