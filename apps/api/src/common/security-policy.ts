import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

export type SecurityPolicy = {
  sessionTimeoutMinutes: number;
  passwordPolicy: 'default' | 'medium' | 'strong';
};

export async function getSecurityPolicy(
  prisma: PrismaService,
  scope: { userId: string } | { tenantId: string },
): Promise<SecurityPolicy> {
  const rows = await prisma.tenantSetting.findMany({
    where: {
      key: 'security',
      ...('tenantId' in scope ? { tenantId: scope.tenantId } : {
        tenant: { deletedAt: null, status: 'ACTIVE', tenantUsers: { some: {
          userId: scope.userId, deletedAt: null, isActive: true, role: { isActive: true },
        } } },
      }),
    },
  });
  const policy: SecurityPolicy = { sessionTimeoutMinutes: 60, passwordPolicy: 'default' };
  const weights = { default: 0, medium: 1, strong: 2 };
  let timeout: number | undefined;
  for (const row of rows) {
    const value = row.value as Partial<SecurityPolicy> | null;
    if (!value || typeof value !== 'object') continue;
    const minutes = value.sessionTimeoutMinutes;
    if (typeof minutes === 'number' && Number.isInteger(minutes) && minutes >= 5 && minutes <= 1440) {
      timeout = Math.min(timeout ?? minutes, minutes);
    }
    if (value.passwordPolicy && Object.hasOwn(weights, value.passwordPolicy) && weights[value.passwordPolicy] > weights[policy.passwordPolicy]) {
      policy.passwordPolicy = value.passwordPolicy;
    }
  }
  policy.sessionTimeoutMinutes = timeout ?? 60;
  return policy;
}

export function assertPasswordPolicy(password: string, policy: SecurityPolicy['passwordPolicy']): void {
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new BadRequestException('Şifre UTF-8 olarak en fazla 72 bayt olabilir');
  }
  const minimum = policy === 'strong' ? 12 : 8;
  if (password.length < minimum) throw new BadRequestException(`Şifre en az ${minimum} karakter olmalıdır`);
  if (policy !== 'default' && (!/\p{Lu}/u.test(password) || !/\p{Ll}/u.test(password))) {
    throw new BadRequestException('Şifre büyük ve küçük harf içermelidir');
  }
  if (policy === 'strong' && !/[^\p{L}\p{N}\s]/u.test(password)) {
    throw new BadRequestException('Şifre özel karakter içermelidir');
  }
}
