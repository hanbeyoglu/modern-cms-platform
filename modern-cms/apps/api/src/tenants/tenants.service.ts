import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { AccessService } from '../access/access.service';

@Injectable()
export class TenantsService {
  constructor(private readonly access: AccessService) {}

  async my(user: User) {
    const tenants = await this.access.listTenantsForUser(user);
    return {
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
      })),
    };
  }
}
