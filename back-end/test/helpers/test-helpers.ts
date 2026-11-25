import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { AppModule } from '../../src/app.module';
import { MailService, SendMailResult } from '../../src/mail/mail.service';
import { ClockService } from '../../src/common/services/clock.service';
import { JobsService } from '../../src/jobs/jobs.service';
import { JobRunsService } from '../../src/jobs/job-runs.service';
import { UsersRepository } from '../../src/users/users.repository';
import { ProjectsRepository } from '../../src/projects/projects.repository';
import { TasksRepository } from '../../src/tasks/tasks.repository';
import { GamificationRepository } from '../../src/gamification/gamification.repository';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { AuditService } from '../../src/audit/audit.service';
import { GamificationService } from '../../src/gamification/gamification.service';
import { AdminService } from '../../src/admin/admin.service';
import { UsersService } from '../../src/users/users.service';
import { ProjectsService } from '../../src/projects/projects.service';
import { TasksService } from '../../src/tasks/tasks.service';
import { ModerationService } from '../../src/moderation/moderation.service';
import { ReputationService } from '../../src/moderation/reputation.service';
import { ReportsService } from '../../src/moderation/reports.service';
import { AppealsService } from '../../src/moderation/appeals.service';
import { JoinRequestsService } from '../../src/join-requests/join-requests.service';
import { SupportService } from '../../src/support/support.service';
import { MentorMarketplaceService } from '../../src/mentor-marketplace/mentor-marketplace.service';
import { PlatformConfigService } from '../../src/platform-config/platform-config.service';
import { ProjectInvitesService } from '../../src/projects/invites.service';
import { CommunicationRepository } from '../../src/communication/communication.repository';
import { AuthService } from '../../src/auth/auth.service';
import { DataExportService } from '../../src/users/data-export.service';
import { AccountDeletionService } from '../../src/users/account-deletion.service';
import { DigestService } from '../../src/notifications/digest.service';
import { LoginThrottleService } from '../../src/auth/login-throttle.service';
import { DemoResetService } from '../../src/system/demo-reset.service';
import { BootService } from '../../src/system/boot.service';
import { PortalAdminsService } from '../../src/portal-admins/portal-admins.service';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { LogManagerService } from '../../src/core/services/log-manager.service';
import { getCorsOptions } from '../../src/common/config/cors.config';

export interface MockEmailRecord {
  type: string;
  to: string;
  subject?: string;
  text?: string;
  reason?: string;
  warningNumber?: number;
  verificationLink?: string;
  resetLink?: string;
  token?: string;
  code?: string;
  sentAt: Date;
}

export class MockMailService {
  public sentMails: MockEmailRecord[] = [];

  async sendMail(options: any): Promise<SendMailResult> {
    this.sentMails.push({
      type: 'general',
      to: options.to,
      subject: options.subject,
      text: options.text,
      sentAt: new Date(),
    });
    return { success: true, mode: 'console', messageId: `mock-${Date.now()}` };
  }

  async sendWarningEmail(options: any): Promise<SendMailResult> {
    this.sentMails.push({
      type: 'warning',
      to: options.to,
      subject: `[TeamForge] Official Account Warning (${options.warningNumber}/${options.maxWarnings || 4})`,
      reason: options.reason,
      warningNumber: options.warningNumber,
      sentAt: new Date(),
    });
    return { success: true, mode: 'console', messageId: `mock-warn-${Date.now()}` };
  }

  async sendSuspensionEmail(options: any): Promise<SendMailResult> {
    this.sentMails.push({
      type: 'suspension',
      to: options.to,
      subject: `[TeamForge] Account Suspended`,
      reason: options.reason,
      sentAt: new Date(),
    });
    return { success: true, mode: 'console', messageId: `mock-susp-${Date.now()}` };
  }

  async sendPasswordResetEmail(options: any): Promise<SendMailResult> {
    const link = String(options.resetLink || '');
    const match = link.match(/[?&]token=([^&]+)/);
    this.sentMails.push({
      type: 'password-reset',
      to: options.to,
      resetLink: link || undefined,
      token: match ? decodeURIComponent(match[1]) : undefined,
      sentAt: new Date(),
    });
    return { success: true, mode: 'console', messageId: `mock-pwd-${Date.now()}` };
  }

  async sendEmailVerificationEmail(options: any): Promise<SendMailResult> {
    const link = String(options.verificationLink || '');
    const match = link.match(/[?&]token=([^&]+)/);
    this.sentMails.push({
      type: 'email-verification',
      to: options.to,
      verificationLink: link,
      token: match ? decodeURIComponent(match[1]) : undefined,
      sentAt: new Date(),
    });
    return { success: true, mode: 'console', messageId: `mock-verify-${Date.now()}` };
  }

  async sendAccountDeletionCodeEmail(options: any): Promise<SendMailResult> {
    this.sentMails.push({
      type: 'account-deletion-code',
      to: options.to,
      code: options.code ? String(options.code) : undefined,
      subject: '[TeamForge] Account Deletion Verification Code',
      text: `Verification code: ${options.code}`,
      sentAt: new Date(),
    });
    return { success: true, mode: 'console', messageId: `mock-delcode-${Date.now()}` };
  }

  getSentMails(): MockEmailRecord[] {
    return [...this.sentMails];
  }

  clearSentMails(): void {
    this.sentMails = [];
  }
}

export const JWT_TEST_SECRET = 'teamforge-jwt-secret-key-development-minimum-32-chars';

let latestTestBootId: string | undefined;

export function loginAs(
  roleOrUserId: string,
  customPermissions?: string[],
  extraClaims?: Record<string, any>,
): string {
  const secret = process.env.JWT_SECRET || JWT_TEST_SECRET;
  let payload: any;

  if (roleOrUserId === 'admin') {
    payload = {
      sub: 'u-admin',
      email: 'admin@teamforge.io',
      role: 'admin',
      permissions: customPermissions || ['*'],
      tv: 1,
      jti: crypto.randomUUID(),
    };
  } else if (roleOrUserId === 'admin-reports') {
    payload = {
      sub: 'u-admin-reports',
      email: 'admin-reports@teamforge.io',
      role: 'admin',
      permissions: ['reports'],
      tv: 1,
      jti: crypto.randomUUID(),
    };
  } else if (roleOrUserId === 'admin-no-reports') {
    payload = {
      sub: 'u-admin-restricted',
      email: 'admin-restricted@teamforge.io',
      role: 'admin',
      permissions: ['users', 'projects'],
      tv: 1,
      jti: crypto.randomUUID(),
    };
  } else if (roleOrUserId === 'superuser') {
    payload = {
      sub: 'u-superuser',
      email: 'superuser@teamforge.io',
      role: 'superuser',
      permissions: ['*'],
      tv: 1,
      jti: crypto.randomUUID(),
    };
  } else if (roleOrUserId === 'project-owner' || roleOrUserId === 'owner' || roleOrUserId === '1') {
    payload = {
      sub: '1',
      email: 'priya.patel@teamforge.io',
      role: 'project-owner',
      tv: 1,
      jti: crypto.randomUUID(),
    };
  } else if (roleOrUserId === 'mentor') {
    payload = {
      sub: '7',
      email: 'neha.gupta@teamforge.io',
      role: 'mentor',
      tv: 1,
      jti: crypto.randomUUID(),
    };
  } else if (roleOrUserId === 'collaborator') {
    payload = {
      sub: '2',
      email: 'arjun.sharma@teamforge.io',
      role: 'collaborator',
      tv: 1,
      jti: crypto.randomUUID(),
    };
  } else {
    // Treat as custom user ID or username
    payload = {
      sub: roleOrUserId,
      email: `user-${roleOrUserId}@teamforge.io`,
      role: 'collaborator',
      tv: 1,
      jti: crypto.randomUUID(),
    };
  }

  if (latestTestBootId && !payload.bootId) {
    payload.bootId = latestTestBootId;
  }

  if (extraClaims) {
    payload = { ...payload, ...extraClaims };
  }

  const token = jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: '8h',
    issuer: 'teamforge',
    audience: 'teamforge-web',
  });

  return `Bearer ${token}`;
}

export interface TestAppContext {
  app: INestApplication;
  moduleRef: TestingModule;
  clockService: ClockService;
  jobsService: JobsService;
  jobRunsService: JobRunsService;
  mailServiceMock: MockMailService;
  gamificationService: GamificationService;
  adminService: AdminService;
  usersService: UsersService;
  usersRepository: UsersRepository;
  projectsService: ProjectsService;
  projectsRepository: ProjectsRepository;
  tasksService: TasksService;
  tasksRepository: TasksRepository;
  notificationsService: NotificationsService;
  auditService: AuditService;
  moderationService: ModerationService;
  reputationService: ReputationService;
  reportsService: ReportsService;
  appealsService: AppealsService;
  joinRequestsService: JoinRequestsService;
  supportService: SupportService;
  mentorMarketplaceService: MentorMarketplaceService;
  platformConfigService: PlatformConfigService;
  projectInvitesService: ProjectInvitesService;
  communicationRepository: CommunicationRepository;
  authService: AuthService;
  dataExportService: DataExportService;
  accountDeletionService: AccountDeletionService;
  digestService: DigestService;
  loginThrottleService: LoginThrottleService;
  demoResetService: DemoResetService;
  bootService: BootService;
  resetStores: () => void;
  advanceTime: (options: { days?: number; hours?: number; ms?: number }) => void;
  loginAs: (roleOrUserId: string, customPermissions?: string[], extraClaims?: Record<string, any>) => string;
}

export async function createTestApp(): Promise<TestAppContext> {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_MODE = 'jwt';
  process.env.ALLOW_STORE_RESET = 'true';
  process.env.SCHEDULER_ENABLED = 'false';
  process.env.JWT_SECRET = JWT_TEST_SECRET;

  const mailServiceMock = new MockMailService();

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailService)
    .useValue(mailServiceMock)
    .compile();

  const app = moduleRef.createNestApplication();

  app.enableCors(getCorsOptions());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const logManager = app.get(LogManagerService);
  app.useGlobalFilters(new HttpExceptionFilter(logManager));

  await app.init();

  const clockService = app.get(ClockService);
  const jobsService = app.get(JobsService);
  const jobRunsService = app.get(JobRunsService);
  const gamificationService = app.get(GamificationService);
  const adminService = app.get(AdminService);
  const usersService = app.get(UsersService);
  const projectsService = app.get(ProjectsService);
  const tasksService = app.get(TasksService);
  const notificationsService = app.get(NotificationsService);
  const auditService = app.get(AuditService);
  const moderationService = app.get(ModerationService);
  const reputationService = app.get(ReputationService);
  const reportsService = app.get(ReportsService);
  const appealsService = app.get(AppealsService);
  const joinRequestsService = app.get(JoinRequestsService);
  const supportService = app.get(SupportService);
  const mentorMarketplaceService = app.get(MentorMarketplaceService);
  const platformConfigService = app.get(PlatformConfigService);
  const projectInvitesService = app.get(ProjectInvitesService);
  const communicationRepository = app.get(CommunicationRepository);
  const authService = app.get(AuthService);
  const dataExportService = app.get(DataExportService);
  const accountDeletionService = app.get(AccountDeletionService);
  const digestService = app.get(DigestService);
  const loginThrottleService = app.get(LoginThrottleService);
  const demoResetService = app.get(DemoResetService);
  const bootService = app.get(BootService);
  const portalAdminsService = app.get(PortalAdminsService);
  latestTestBootId = bootService.bootId;

  const ensureTestPortalAdmin = (roleOrUserId: string) => {
    if (roleOrUserId === 'admin-reports') {
      if (!portalAdminsService.findByEmail('admin-reports@teamforge.io')) {
        (portalAdminsService as any).items.push({
          id: 'u-admin-reports',
          name: 'Reports Admin',
          email: 'admin-reports@teamforge.io',
          portalRole: 'admin',
          permissions: ['reports'],
          status: 'active',
        });
      }
    } else if (roleOrUserId === 'admin-no-reports') {
      if (!portalAdminsService.findByEmail('admin-restricted@teamforge.io')) {
        (portalAdminsService as any).items.push({
          id: 'u-admin-restricted',
          name: 'Restricted Admin',
          email: 'admin-restricted@teamforge.io',
          portalRole: 'admin',
          permissions: ['users', 'projects'],
          status: 'active',
        });
      }
    }
  };

  const ctxLoginAs = (
    roleOrUserId: string,
    customPermissions?: string[],
    extraClaims?: Record<string, any>,
  ): string => {
    ensureTestPortalAdmin(roleOrUserId);
    return loginAs(roleOrUserId, customPermissions, {
      bootId: bootService.bootId,
      ...(extraClaims || {}),
    });
  };

  const usersRepo = app.get(UsersRepository);
  const projectsRepo = app.get(ProjectsRepository);
  const tasksRepo = app.get(TasksRepository);
  const gamificationRepo = app.get(GamificationRepository);

  const resetStores = () => {
    usersRepo.reset();
    projectsRepo.reset();
    tasksRepo.reset();
    gamificationRepo.reset();
    notificationsService.reset();
    auditService.reset();
    moderationService.reset();
    reputationService.reset();
    reputationService.backfillStartupSeedUsers();
    reportsService.reset();
    appealsService.reset();
    joinRequestsService.reset();
    supportService.reset();
    mentorMarketplaceService.resetLifecycle();
    projectInvitesService.reset();
    communicationRepository.reset();
    authService.clearAttemptsForTest();
    usersService.resetPhoneVerifyRateLimitForTesting();
    dataExportService.reset();
    accountDeletionService.reset();
    digestService.reset();
    jobRunsService.reset();
    demoResetService.resetRateLimitForTesting();
    clockService.reset();
    mailServiceMock.clearSentMails();
  };

  const advanceTime = (options: { days?: number; hours?: number; ms?: number }) => {
    if (options.days) clockService.advanceDays(options.days);
    if (options.hours) clockService.advanceHours(options.hours);
    if (options.ms) clockService.advanceTime(options.ms);
  };

  return {
    app,
    moduleRef,
    clockService,
    jobsService,
    jobRunsService,
    mailServiceMock,
    gamificationService,
    adminService,
    usersService,
    usersRepository: usersRepo,
    projectsService,
    projectsRepository: projectsRepo,
    tasksService,
    tasksRepository: tasksRepo,
    notificationsService,
    auditService,
    moderationService,
    reputationService,
    reportsService,
    appealsService,
    joinRequestsService,
    supportService,
    mentorMarketplaceService,
    platformConfigService,
    projectInvitesService,
    communicationRepository,
    authService,
    dataExportService,
    accountDeletionService,
    digestService,
    loginThrottleService,
    demoResetService,
    bootService,
    resetStores,
    advanceTime,
    loginAs: ctxLoginAs,
  };
}
