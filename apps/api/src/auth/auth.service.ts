import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { AuditLogService } from '../audit/audit.service';
import type { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly access: AccessService,
    private readonly audit: AuditLogService,
  ) {}

  async login(
    email: string,
    password: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'isSuperAdmin'>;
  }> {
    const user = await this.access.findActiveUserByEmail(email);

    if (!user) {
      await this.audit.logAction({
        action: 'login_failed',
        entityType: 'auth',
        ip: meta.ipAddress,
        userAgent: meta.userAgent,
        after: { reason: 'user_not_found' },
      });
      throw new UnauthorizedException('Geçersiz kimlik bilgileri');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.audit.logAction({
        userId: user.id,
        action: 'login_failed',
        entityType: 'auth',
        entityId: user.id,
        ip: meta.ipAddress,
        userAgent: meta.userAgent,
        after: { reason: 'invalid_password' },
      });
      throw new UnauthorizedException('Geçersiz kimlik bilgileri');
    }

    const accessToken = await this.signAccessToken(user);
    const expiresIn = this.getAccessExpiresSeconds();
    const refreshToken = await this.issueRefreshToken(user.id, meta);

    await this.audit.logAction({
      userId: user.id,
      action: 'login_success',
      entityType: 'auth',
      entityId: user.id,
      ip: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
      },
    };
  }

  async refresh(
    refreshToken: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const tokenHash = this.hashToken(refreshToken);
    const existing = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
    });
    if (!existing || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Geçersiz yenileme belirteci');
    }

    const user = await this.access.findActiveUserById(existing.userId);
    if (!user) {
      throw new UnauthorizedException('Geçersiz yenileme belirteci');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const accessToken = await this.signAccessToken(user);
    const newRefresh = await this.issueRefreshToken(user.id, meta);

    return {
      accessToken,
      refreshToken: newRefresh,
      expiresIn: this.getAccessExpiresSeconds(),
    };
  }

  async me(user: User) {
    const tenants = await this.access.listTenantsForUser(user);
    const memberships =
      user.isSuperAdmin === true
        ? []
        : await this.prisma.tenantUser.findMany({
            where: { userId: user.id, deletedAt: null },
            include: {
              tenant: true,
              role: true,
              mallAccess: { include: { mall: true } },
            },
          });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      isSuperAdmin: user.isSuperAdmin,
      tenants: tenants.map((t) => ({ id: t.id, name: t.name, slug: t.slug, status: t.status })),
      memberships: memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        role: { code: m.role.code, name: m.role.name },
        malls: m.mallAccess.map((a) => ({
          id: a.mall.id,
          name: a.mall.name,
          slug: a.mall.slug,
        })),
      })),
    };
  }

  private async signAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwt.signAsync(payload);
  }

  private getAccessExpiresSeconds(): number {
    const raw = this.config.get<string>('JWT_ACCESS_TTL', '900');
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      return 900;
    }
    return Math.floor(n);
  }

  private async issueRefreshToken(userId: string, meta: { userAgent?: string; ipAddress?: string }) {
    const token = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(token);
    const days = Number(this.config.get<string>('JWT_REFRESH_TTL_DAYS', '30'));
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (Number.isFinite(days) && days > 0 ? days : 30));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    return token;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
