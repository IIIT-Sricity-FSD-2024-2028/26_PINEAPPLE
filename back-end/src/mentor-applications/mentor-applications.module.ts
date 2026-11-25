import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MentorApplicationsService } from './mentor-applications.service';
import { MentorApplicationsController } from './mentor-applications.controller';
import { DigiLockerSandboxProvider } from './digilocker/digilocker-sandbox.provider';
import { DigiLockerRealProvider } from './digilocker/digilocker-real.provider';

@Module({
  imports: [UsersModule, NotificationsModule],
  controllers: [MentorApplicationsController],
  providers: [
    MentorApplicationsService,
    DigiLockerSandboxProvider,
    DigiLockerRealProvider,
    {
      provide: 'DigiLockerProvider',
      useFactory: (sandbox: DigiLockerSandboxProvider, real: DigiLockerRealProvider) => {
        const mode = process.env.DIGILOCKER_MODE || 'sandbox';
        return mode === 'real' ? real : sandbox;
      },
      inject: [DigiLockerSandboxProvider, DigiLockerRealProvider],
    },
  ],
  exports: [MentorApplicationsService, DigiLockerSandboxProvider, DigiLockerRealProvider, 'DigiLockerProvider'],
})
export class MentorApplicationsModule {}
