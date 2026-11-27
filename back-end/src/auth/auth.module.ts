import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformConfigModule } from '../platform-config/platform-config.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { MailModule } from '../mail/mail.module';
import { PortalAdminsModule } from '../portal-admins/portal-admins.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { FirebaseStrategy } from './strategies/firebase.strategy';
import { LegacyHeaderStrategy } from './strategies/legacy-header.strategy';
import { AuthStrategyResolver } from './strategies/auth-strategy.resolver';
import { AuthGuard } from './guards/auth.guard';
import { SeedingService } from './seeding.service';
import { LoginThrottleService } from './login-throttle.service';
import { AdminRefreshService } from '../admin/admin-refresh.service';
import { ADMIN_REFRESH_SERVICE } from '../common/utils/refresh-cookie.util';

@Global()
@Module({
  imports: [
    UsersModule,
    AuditModule,
    NotificationsModule,
    PlatformConfigModule,
    FirebaseModule,
    MailModule,
    PortalAdminsModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: 'AUTH_SERVICE', useExisting: AuthService },
    LoginThrottleService,
    JwtStrategy,
    FirebaseStrategy,
    LegacyHeaderStrategy,
    AuthStrategyResolver,
    AuthGuard,
    SeedingService,
    AdminRefreshService,
    { provide: ADMIN_REFRESH_SERVICE, useExisting: AdminRefreshService },
  ],
  exports: [
    AuthService,
    'AUTH_SERVICE',
    LoginThrottleService,
    JwtStrategy,
    FirebaseStrategy,
    LegacyHeaderStrategy,
    AuthStrategyResolver,
    AuthGuard,
    JwtModule,
    AdminRefreshService,
    ADMIN_REFRESH_SERVICE,
  ],
})
export class AuthModule {}
