import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from './access/access.module';
import { AuthModule } from './auth/auth.module';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { HealthModule } from './health/health.module';
import { MallsModule } from './malls/malls.module';
import { PrismaModule } from './prisma/prisma.module';
import { TenantsModule } from './tenants/tenants.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local', '../../.env', '../../.env.local'],
    }),
    PrismaModule,
    AccessModule,
    AuthModule,
    TenantsModule,
    MallsModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
