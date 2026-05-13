import { Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { MallAccessGuard } from './guards/mall-access.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { TenantAccessGuard } from './guards/tenant-access.guard';

@Module({
  providers: [AccessService, TenantAccessGuard, MallAccessGuard, PermissionsGuard],
  exports: [AccessService, TenantAccessGuard, MallAccessGuard, PermissionsGuard],
})
export class AccessModule {}
