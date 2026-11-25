import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ClockService } from '../common/services/clock.service';
import { StartupCleanupService } from './startup-cleanup.service';
import { UsersRepository } from '../users/users.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { GamificationRepository } from '../gamification/gamification.repository';
import { CommunicationRepository } from '../communication/communication.repository';
import { MentorshipRepository } from '../mentorship/mentorship.repository';
import { GovernanceRepository } from '../governance/governance.repository';
import { ReputationService } from '../moderation/reputation.service';
import { ModerationService } from '../moderation/moderation.service';
import { ReportsService } from '../moderation/reports.service';
import { AppealsService } from '../moderation/appeals.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { AuditService } from '../audit/audit.service';
import { ProjectInvitesService } from '../projects/invites.service';
import { SupportService } from '../support/support.service';
import { DigestService } from '../notifications/digest.service';
import { EscrowService } from '../escrow/escrow.service';
import { PayoutsService } from '../payouts/payouts.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { PortalAdminsService } from '../portal-admins/portal-admins.service';
import { MentorApplicationsService } from '../mentor-applications/mentor-applications.service';
import { MentorRequestsService } from '../mentor-requests/mentor-requests.service';
import { DemoUpiProvider } from '../mentor-marketplace/payments/demo-upi.provider';
import { JobRunsService } from '../jobs/job-runs.service';
import { JobsService } from '../jobs/jobs.service';
import { DataExportService } from '../users/data-export.service';
import { AccountDeletionService } from '../users/account-deletion.service';
import { AuthService } from '../auth/auth.service';
import { LoginThrottleService } from '../auth/login-throttle.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { FirebaseStrategy } from '../auth/strategies/firebase.strategy';

export const DEMO_RESET_MAX_PER_HOUR = 3;
export const DEMO_RESET_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function isDemoResetEnabled(): boolean {
  const raw = process.env.ALLOW_DEMO_RESET;
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    return String(raw).trim().toLowerCase() === 'true';
  }
  return process.env.NODE_ENV !== 'production';
}

export interface DemoResetResult {
  resetAt: string;
  counts: {
    users: number;
    projects: number;
    tasks: number;
  };
}

export interface DemoResetStatusResult {
  enabled: boolean;
  lastResetAt: string | null;
}

@Injectable()
export class DemoResetService {
  private static maintenanceActive = false;

  private readonly logger = new Logger(DemoResetService.name);
  private resetting = false;
  private lastResetAt: string | null = null;
  private resetTimestamps: number[] = [];

  constructor(
    private readonly moduleRef: ModuleRef,
    @Optional() private readonly clockService?: ClockService,
    @Optional() private readonly startupCleanupService?: StartupCleanupService,
  ) {}

  static isMaintenanceMode(): boolean {
    return DemoResetService.maintenanceActive;
  }

  private getService<T>(token: any): T | undefined {
    try {
      return this.moduleRef.get<T>(token, { strict: false });
    } catch {
      return undefined;
    }
  }

  private nowDate(): Date {
    return this.clockService ? this.clockService.now() : new Date();
  }

  private nowMs(): number {
    return this.nowDate().getTime();
  }

  isResetInProgress(): boolean {
    return this.resetting;
  }

  getLastResetAt(): string | null {
    return this.lastResetAt;
  }

  getStatus(): DemoResetStatusResult {
    return {
      enabled: isDemoResetEnabled(),
      lastResetAt: this.lastResetAt,
    };
  }

  resetRateLimitForTesting(): void {
    this.resetTimestamps = [];
    this.lastResetAt = null;
    this.resetting = false;
    DemoResetService.maintenanceActive = false;
  }

  private enforceRateLimit(): void {
    const nowMs = this.nowMs();
    this.resetTimestamps = this.resetTimestamps.filter(
      (ts) => nowMs - ts < DEMO_RESET_RATE_WINDOW_MS,
    );
    if (this.resetTimestamps.length >= DEMO_RESET_MAX_PER_HOUR) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          code: 'DEMO_RESET_RATE_LIMIT',
          message: 'Maximum of 3 demo data resets per hour reached. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.resetTimestamps.push(nowMs);
  }

  async reset(
    callerId: string,
    callerLabel?: string,
    options?: {
      onAfterResetBeforeResume?: () => Promise<void> | void;
      uploadsDir?: string;
      secureCvsDir?: string;
      exportDir?: string;
    },
  ): Promise<DemoResetResult> {
    if (!isDemoResetEnabled()) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'DEMO_RESET_DISABLED',
        message: 'Demo data reset is disabled in this environment.',
      });
    }

    if (this.resetting) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'RESET_IN_PROGRESS',
        message: 'A demo data reset is already in progress.',
      });
    }

    this.enforceRateLimit();

    this.resetting = true;
    DemoResetService.maintenanceActive = true;

    const jobsService = this.getService<JobsService>(JobsService);
    jobsService?.pauseScheduler?.();

    let currentStep = 'initializing';

    try {
      const usersRepo = this.getService<UsersRepository>(UsersRepository);
      const projectsRepo = this.getService<ProjectsRepository>(ProjectsRepository);
      const tasksRepo = this.getService<TasksRepository>(TasksRepository);
      const gamificationRepo = this.getService<GamificationRepository>(GamificationRepository);
      const commRepo = this.getService<CommunicationRepository>(CommunicationRepository);
      const mentorshipRepo = this.getService<MentorshipRepository>(MentorshipRepository);
      const governanceRepo = this.getService<GovernanceRepository>(GovernanceRepository);
      const reputationService = this.getService<ReputationService>(ReputationService);
      const moderationService = this.getService<ModerationService>(ModerationService);
      const reportsService = this.getService<ReportsService>(ReportsService);
      const appealsService = this.getService<AppealsService>(AppealsService);
      const mentorMarketplaceService = this.getService<MentorMarketplaceService>(MentorMarketplaceService);
      const notificationsService = this.getService<NotificationsService>(NotificationsService);
      const joinRequestsService = this.getService<JoinRequestsService>(JoinRequestsService);
      const auditService = this.getService<AuditService>(AuditService);
      const projectInvitesService = this.getService<ProjectInvitesService>(ProjectInvitesService);
      const supportService = this.getService<SupportService>(SupportService);
      const digestService = this.getService<DigestService>(DigestService);
      const escrowService = this.getService<EscrowService>(EscrowService);
      const payoutsService = this.getService<PayoutsService>(PayoutsService);
      const platformConfigService = this.getService<PlatformConfigService>(PlatformConfigService);
      const portalAdminsService = this.getService<PortalAdminsService>(PortalAdminsService);
      const mentorApplicationsService = this.getService<MentorApplicationsService>(MentorApplicationsService);
      const mentorRequestsService = this.getService<MentorRequestsService>(MentorRequestsService);
      const demoUpiProvider = this.getService<DemoUpiProvider>(DemoUpiProvider);
      const jobRunsService = this.getService<JobRunsService>(JobRunsService);
      const dataExportService = this.getService<DataExportService>(DataExportService);
      const authService = this.getService<AuthService>(AuthService);
      const loginThrottleService = this.getService<LoginThrottleService>(LoginThrottleService);
      const accountDeletionService = this.getService<AccountDeletionService>(AccountDeletionService);
      const leaderboardService = this.getService<LeaderboardService>(LeaderboardService);
      const firebaseStrategy = this.getService<FirebaseStrategy>(FirebaseStrategy);

      // Capture highest active tokenVersion before resetting users so post-reset bump invalidates every prior JWT
      currentStep = 'capture_token_versions';
      const priorUsers = usersRepo ? usersRepo.findAll(true) : [];
      const priorMaxTokenVersion = priorUsers.reduce(
        (maxTv, u) => Math.max(maxTv, Number((u as any).tokenVersion || 1)),
        1,
      );

      // 1. Platform config & portal admins
      currentStep = 'reset_platform_config_and_admins';
      platformConfigService?.resetToSeed?.();
      portalAdminsService?.resetToSeed?.();

      // 2. Core user & project & task stores
      currentStep = 'reset_users';
      usersRepo?.resetToSeed?.();

      currentStep = 'reset_projects_and_tasks';
      projectsRepo?.resetToSeed?.();
      projectInvitesService?.resetToSeed?.();
      tasksRepo?.resetToSeed?.();

      // 3. Requests & applications
      currentStep = 'reset_requests_and_applications';
      joinRequestsService?.resetToSeed?.();
      mentorApplicationsService?.resetToSeed?.();
      mentorRequestsService?.resetToSeed?.();

      // 4. Financial & mentor marketplace stores
      currentStep = 'reset_escrow_and_marketplace';
      escrowService?.resetToSeed?.();
      payoutsService?.resetToSeed?.();
      demoUpiProvider?.resetToSeed?.();
      mentorMarketplaceService?.resetToSeed?.();

      // 5. Communications, moderation, support, jobs, exports, notifications
      currentStep = 'reset_communications_moderation_and_support';
      commRepo?.resetToSeed?.();
      mentorshipRepo?.resetToSeed?.();
      governanceRepo?.resetToSeed?.();
      moderationService?.resetToSeed?.();
      reportsService?.resetToSeed?.();
      appealsService?.resetToSeed?.();
      supportService?.resetToSeed?.();
      digestService?.resetToSeed?.();
      jobRunsService?.resetToSeed?.();
      dataExportService?.resetToSeed?.();
      notificationsService?.resetToSeed?.();

      // 6. Ledgers & Phase 22 reputation repair
      currentStep = 'reset_ledgers_and_reputation';
      gamificationRepo?.resetToSeed?.();
      reputationService?.resetToSeed?.();

      // 7. Ephemeral auth/throttle/cache stores
      currentStep = 'reset_ephemeral_auth_and_caches';
      authService?.resetToSeed?.();
      loginThrottleService?.resetToSeed?.();
      accountDeletionService?.resetToSeed?.();
      leaderboardService?.resetToSeed?.();
      firebaseStrategy?.resetToSeed?.();

      // 8. Delete non-seed uploaded files, CVs, and data exports from disk
      currentStep = 'clean_non_seed_files';
      if (this.startupCleanupService) {
        this.startupCleanupService.cleanNonSeedFilesOnDisk({
          uploadsDir: options?.uploadsDir,
          secureCvsDir: options?.secureCvsDir,
          exportDir: options?.exportDir,
        });
      }

      // 9. Revoke all prior sessions: bump tokenVersion & clear refreshTokens/jti on every restored user
      currentStep = 'bump_token_versions';
      const bumpedVersion = priorMaxTokenVersion + 1;
      if (usersRepo) {
        const seededUsers = usersRepo.findAll(true);
        for (const u of seededUsers) {
          u.tokenVersion = bumpedVersion;
          u.refreshTokens = [];
          u.allowedLegacyJti = undefined;
        }
        usersRepo.rebuildIndexes();
      }

      // 10. Clear audit log and record DEMO_DATA_RESET as the sole first entry
      currentStep = 'write_audit_entry';
      const resetAt = this.nowDate().toISOString();
      if (auditService) {
        auditService.clearAll();
        auditService.log({
          action: 'DEMO_DATA_RESET',
          actor: callerLabel || callerId || 'Super User',
          performedBy: callerId || 'u-superuser',
          target: 'platform-state',
          entityType: 'system',
          entityId: 'demo-reset',
          event: `Demo data reset executed by ${callerLabel || callerId || 'Super User'} at ${resetAt}`,
          details: {
            callerId,
            resetAt,
          },
        });
      }

      if (options?.onAfterResetBeforeResume) {
        currentStep = 'test_hook';
        await options.onAfterResetBeforeResume();
      }

      this.lastResetAt = resetAt;
      const counts = {
        users: usersRepo ? usersRepo.findAll().length : 0,
        projects: projectsRepo ? projectsRepo.findAll().length : 0,
        tasks: tasksRepo ? tasksRepo.findAll().length : 0,
      };

      this.logger.log(`[DemoResetService] Reset completed cleanly at ${resetAt} (${JSON.stringify(counts)})`);
      return { resetAt, counts };
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`[DemoResetService] Failed at step "${currentStep}": ${err?.message || err}`);
      throw new InternalServerErrorException({
        statusCode: 500,
        error: 'Internal Server Error',
        code: 'RESET_FAILED',
        step: currentStep,
        message: `Demo data reset failed during step "${currentStep}".`,
      });
    } finally {
      DemoResetService.maintenanceActive = false;
      jobsService?.resumeScheduler?.();
      this.resetting = false;
    }
  }
}
