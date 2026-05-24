import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { AuditLogService } from '../audit/audit.service';
import { CapabilitiesService } from '../capabilities/capabilities.service';
import type { JwtPayload } from './strategies/jwt.strategy';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly access: AccessService,
    private readonly audit: AuditLogService,
    private readonly capabilities: CapabilitiesService,
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
              role: {
                include: {
                  rolePermissions: { include: { permission: true } },
                },
              },
              mallAccess: {
                include: {
                  mall: {
                    include: {
                      logoMedia: { select: { id: true, publicUrl: true } },
                      coverMedia: { select: { id: true, publicUrl: true } },
                    },
                  },
                },
              },
            },
          });

    const membershipResults = await Promise.all(
      memberships.map(async (m) => {
        const capSet = await this.capabilities.getEnabledCodesForTenant(m.tenantId);

        type MallSummary = {
          id: string;
          name: string;
          slug: string;
          status: string;
          type: string;
          logoMedia: { id: string; publicUrl: string } | null;
          coverMedia: { id: string; publicUrl: string } | null;
        };

        let malls: MallSummary[];

        if (m.role.code === 'TENANT_ADMIN') {
          const tenantMalls = await this.prisma.mall.findMany({
            where: { tenantId: m.tenantId, deletedAt: null },
            include: {
              logoMedia: { select: { id: true, publicUrl: true } },
              coverMedia: { select: { id: true, publicUrl: true } },
            },
            orderBy: { name: 'asc' },
          });
          malls = tenantMalls.map((mall) => ({
            id: mall.id,
            name: mall.name,
            slug: mall.slug,
            status: mall.status as string,
            type: mall.type as string,
            logoMedia: mall.logoMedia,
            coverMedia: mall.coverMedia,
          }));
        } else {
          malls = m.mallAccess.map((a) => ({
            id: a.mall.id,
            name: a.mall.name,
            slug: a.mall.slug,
            status: a.mall.status as string,
            type: a.mall.type as string,
            logoMedia: a.mall.logoMedia,
            coverMedia: a.mall.coverMedia,
          }));
        }

        return {
          tenantId: m.tenantId,
          tenantName: m.tenant.name,
          role: { code: m.role.code, name: m.role.name },
          permissions: m.role.rolePermissions.map((rp) => rp.permission.code),
          capabilities: Array.from(capSet),
          malls,
        };
      }),
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      isSuperAdmin: user.isSuperAdmin,
      tenants: tenants.map((t) => ({ id: t.id, name: t.name, slug: t.slug, status: t.status })),
      memberships: membershipResults,
    };
  }

  async updateProfile(user: User, dto: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { firstName: dto.firstName, lastName: dto.lastName },
    });

    await this.audit.logAction({
      userId: user.id,
      action: 'profile_updated',
      entityType: 'user',
      entityId: user.id,
      before: { firstName: user.firstName, lastName: user.lastName },
      after: { ...dto },
    });

    const updated = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return this.me(updated);
  }

  async changePassword(user: User, dto: ChangePasswordDto) {
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Mevcut şifre yanlış');

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

    // Revoke all refresh tokens so existing sessions are invalidated
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.logAction({
      userId: user.id,
      action: 'password_changed',
      entityType: 'user',
      entityId: user.id,
    });

    return { success: true };
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
