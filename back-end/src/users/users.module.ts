import { Global, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { DataExportService } from './data-export.service';
import { AccountDeletionService } from './account-deletion.service';
import { SelfAccountUpdateGuard } from './guards/self-update.guard';
import { TrustService } from './trust.service';

@Global()
@Module({
  imports: [],
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersRepository,
    DuplicateDetectionService,
    DataExportService,
    AccountDeletionService,
    SelfAccountUpdateGuard,
    TrustService,
  ],
  exports: [
    UsersService,
    UsersRepository,
    DuplicateDetectionService,
    DataExportService,
    AccountDeletionService,
    SelfAccountUpdateGuard,
    TrustService,
  ],
})
export class UsersModule {}
