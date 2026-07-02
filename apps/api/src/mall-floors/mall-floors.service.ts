import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { CreateMallFloorDto } from './dto/create-mall-floor.dto';
import type { UpdateMallFloorDto } from './dto/update-mall-floor.dto';

export type MallFloorResponse = Prisma.MallFloorGetPayload<Record<string, never>>;

@Injectable()
export class MallFloorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private resolveScope(req: Request): { tenantId: string; mallId: string } {
    const tenantId = req.tenantId;
    const mallId = req.mallId;
    if (!tenantId) throw new BadRequestException('x-tenant-id başlığı gerekli');
    if (!mallId) throw new BadRequestException('x-mall-id başlığı gerekli');
    return { tenantId, mallId };
  }

  async list(req: Request, user: User): Promise<MallFloorResponse[]> {
    const { tenantId, mallId } = this.resolveScope(req);
    await this.access.assertMallAccess(user, tenantId, mallId);
    return this.prisma.mallFloor.findMany({
      where: { tenantId, mallId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listActive(req: Request, user: User): Promise<MallFloorResponse[]> {
    const rows = await this.list(req, user);
    return rows.filter((r) => r.active);
  }

  async create(req: Request, user: User, dto: CreateMallFloorDto): Promise<MallFloorResponse> {
    const { tenantId, mallId } = this.resolveScope(req);
    await this.access.assertMallAccess(user, tenantId, mallId);

    const name = dto.name.trim();
    const label = dto.label.trim();
    const conflict = await this.prisma.mallFloor.findFirst({
      where: { mallId, name },
    });
    if (conflict) throw new ConflictException('Bu isimde bir kat zaten var');

    return this.prisma.mallFloor.create({
      data: {
        tenantId,
        mallId,
        name,
        label,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async update(
    req: Request,
    user: User,
    id: string,
    dto: UpdateMallFloorDto,
  ): Promise<MallFloorResponse> {
    const { tenantId, mallId } = this.resolveScope(req);
    await this.access.assertMallAccess(user, tenantId, mallId);

    const existing = await this.prisma.mallFloor.findFirst({
      where: { id, tenantId, mallId },
    });
    if (!existing) throw new NotFoundException('Kat bulunamadı');

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const conflict = await this.prisma.mallFloor.findFirst({
        where: { mallId, name, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Bu isimde bir kat zaten var');
    }

    return this.prisma.mallFloor.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.label !== undefined && { label: dto.label.trim() }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }

  async reorder(req: Request, user: User, orderedIds: string[]): Promise<MallFloorResponse[]> {
    const { tenantId, mallId } = this.resolveScope(req);
    await this.access.assertMallAccess(user, tenantId, mallId);

    const rows = await this.prisma.mallFloor.findMany({
      where: { tenantId, mallId },
      select: { id: true },
    });
    if (rows.length !== orderedIds.length) {
      throw new BadRequestException('Sıralama listesi tüm katları içermelidir');
    }
    const known = new Set(rows.map((r) => r.id));
    if (!orderedIds.every((id) => known.has(id))) {
      throw new BadRequestException('Geçersiz kat kimliği');
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.mallFloor.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    return this.list(req, user);
  }

  async remove(req: Request, user: User, id: string): Promise<void> {
    const { tenantId, mallId } = this.resolveScope(req);
    await this.access.assertMallAccess(user, tenantId, mallId);

    const existing = await this.prisma.mallFloor.findFirst({
      where: { id, tenantId, mallId },
    });
    if (!existing) throw new NotFoundException('Kat bulunamadı');

    await this.prisma.$transaction([
      this.prisma.mallStore.updateMany({
        where: { floorId: id },
        data: { floorId: null },
      }),
      this.prisma.mallFloor.delete({ where: { id } }),
    ]);
  }
}
