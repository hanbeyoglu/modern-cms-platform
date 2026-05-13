import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { AccessService } from '../access/access.service';

@Injectable()
export class MallsService {
  constructor(private readonly access: AccessService) {}

  async my(user: User, tenantId?: string) {
    const malls = await this.access.listMallsForUser(user, tenantId);
    return {
      malls: malls.map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        name: m.name,
        slug: m.slug,
        status: m.status,
      })),
    };
  }
}
