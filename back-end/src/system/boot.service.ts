import { Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { StartupCleanupService } from './startup-cleanup.service';

export interface HealthResponse {
  status: string;
  bootId: string;
  startedAt: string;
}

@Injectable()
export class BootService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootService.name);
  public readonly bootId: string = crypto.randomUUID();
  public readonly startedAt: string = new Date().toISOString();

  constructor(
    @Optional() private readonly startupCleanupService?: StartupCleanupService,
  ) {}

  getHealth(): HealthResponse {
    return {
      status: 'ok',
      bootId: this.bootId,
      startedAt: this.startedAt,
    };
  }

  onApplicationBootstrap(): void {
    this.logger.log(`Server boot initialized (bootId=${this.bootId}, startedAt=${this.startedAt})`);
    if (this.startupCleanupService) {
      this.startupCleanupService.cleanOrphanFilesOnStartup();
    }
  }
}
