import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { ClockService } from '../common/services/clock.service';
import { EscrowService } from '../escrow/escrow.service';
import { MentorApplicationsService } from '../mentor-applications/mentor-applications.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { StorageHygieneService } from './storage-hygiene.service';
import { UsersRepository } from '../users/users.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { DataExportService } from '../users/data-export.service';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '../users/dto/create-user.dto';
import { ProjectStatus } from '../projects/dto/create-project.dto';

describe('StorageHygieneService Unit Tests', () => {
  let appRef: { close: () => Promise<void> };
  let tempRoot: string;
  let origCleanOnStart: string | undefined;
  let origExportDir: string | undefined;
  let clockService: ClockService;
  let escrowService: EscrowService;
  let mentorAppsService: MentorApplicationsService;
  let mentorService: MentorMarketplaceService;
  let storageHygieneService: StorageHygieneService;
  let usersRepo: UsersRepository;
  let projectsRepo: ProjectsRepository;
  let tasksRepo: TasksRepository;
  let dataExportService: DataExportService;
  let auditService: AuditService;

  const mailMock = {
    onModuleInit: async () => {},
    initializeTransport: async () => {},
    sendPasswordResetEmail: async () => ({ success: true, mode: 'console' as const }),
    sendEmailVerificationEmail: async () => ({ success: true, mode: 'console' as const }),
    sendMail: async () => ({ success: true, mode: 'console' as const }),
    sendWarningEmail: async () => ({ success: true, mode: 'console' as const }),
    sendSuspensionEmail: async () => ({ success: true, mode: 'console' as const }),
  };

  beforeAll(async () => {
    origCleanOnStart = process.env.CLEAN_UPLOADS_ON_START;
    origExportDir = process.env.EXPORT_DIR;
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';
    process.env.SCHEDULER_ENABLED = 'false';
    process.env.CLEAN_UPLOADS_ON_START = 'false';
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-storage-hygiene-unit-'));

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailMock)
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    appRef = app;

    clockService = app.get(ClockService);
    escrowService = app.get(EscrowService);
    mentorAppsService = app.get(MentorApplicationsService);
    mentorService = app.get(MentorMarketplaceService);
    storageHygieneService = app.get(StorageHygieneService);
    usersRepo = app.get(UsersRepository);
    projectsRepo = app.get(ProjectsRepository);
    tasksRepo = app.get(TasksRepository);
    dataExportService = app.get(DataExportService);
    auditService = app.get(AuditService);
  });

  afterAll(async () => {
    if (origCleanOnStart === undefined) delete process.env.CLEAN_UPLOADS_ON_START;
    else process.env.CLEAN_UPLOADS_ON_START = origCleanOnStart;
    if (origExportDir === undefined) delete process.env.EXPORT_DIR;
    else process.env.EXPORT_DIR = origExportDir;

    await appRef?.close();
    if (fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    usersRepo.reset();
    projectsRepo.reset();
    tasksRepo.reset();
    escrowService.reset();
    mentorAppsService.reset();
    mentorService.resetLifecycle();
    dataExportService.reset();
    auditService.reset();
    storageHygieneService.resetRunState();
    clockService.reset();
  });

  it('removes >24h orphan uploads, expired & orphan exports, deleted CVs, and >30d unneeded project tombstones while honoring dry-run', () => {
    const uploadsDir = path.join(tempRoot, 'uploads-hygiene');
    const secureCvsDir = path.join(tempRoot, 'cvs-hygiene');
    const exportDir = path.join(tempRoot, 'exports-hygiene');
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.mkdirSync(secureCvsDir, { recursive: true });
    fs.mkdirSync(exportDir, { recursive: true });
    process.env.EXPORT_DIR = exportDir;

    const oldOrphanPath = path.join(uploadsDir, 'orphan-old.png');
    const recentOrphanPath = path.join(uploadsDir, 'orphan-recent.png');
    const referencedPath = path.join(uploadsDir, 'referenced-proof.png');
    fs.writeFileSync(oldOrphanPath, 'old-orphan');
    fs.writeFileSync(recentOrphanPath, 'recent-orphan');
    fs.writeFileSync(referencedPath, 'referenced');

    const nowMs = clockService.now().getTime();
    const thirtyHoursAgoSec = (nowMs - 30 * 60 * 60 * 1000) / 1000;
    const oneHourAgoSec = (nowMs - 1 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(oldOrphanPath, thirtyHoursAgoSec, thirtyHoursAgoSec);
    fs.utimesSync(referencedPath, thirtyHoursAgoSec, thirtyHoursAgoSec);
    fs.utimesSync(recentOrphanPath, oneHourAgoSec, oneHourAgoSec);

    const activeProj = projectsRepo.create(
      '2',
      {
        title: 'Proof Project',
        description: 'Project with referenced upload',
      } as any,
      ProjectStatus.Open,
    );
    tasksRepo.create({
      projectId: activeProj.id,
      title: 'Verified Task',
      description: 'Proof uploaded',
      proofUrl: '/uploads/referenced-proof.png',
    } as any);

    const deletedUser = usersRepo.create({
      name: 'Deleted Mentor Applicant',
      username: 'deletedmentorapp',
      email: 'del-app@teamforge.test',
      password: 'Password123!',
      role: UserRole.Collaborator,
    } as any);
    const activeApplicant = usersRepo.create({
      name: 'Active Mentor Applicant',
      username: 'activementorapp',
      email: 'active-app@teamforge.test',
      password: 'Password123!',
      role: UserRole.Collaborator,
    } as any);
    mentorAppsService.create({
      userId: deletedUser.id,
      name: 'Deleted Applicant',
      email: 'del-app@teamforge.test',
      cvFileName: 'deleted-user-cv.pdf',
      cvUrl: '/uploads/cv/deleted-user-cv.pdf',
      certificates: [
        {
          issuer: 'NPTEL',
          documentType: 'CERTIFICATE',
          documentNumber: 'DOC-DEL-1',
          holderName: 'Deleted Applicant',
        },
      ],
      bio: 'Applying before deleting my account',
      expertise: 'Backend',
      years: 5,
    } as any);
    deletedUser.isDeleted = true;
    deletedUser.deletedAt = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();

    mentorAppsService.create({
      userId: activeApplicant.id,
      name: 'Active Applicant',
      email: 'active-app@teamforge.test',
      cvFileName: 'active-user-cv.pdf',
      cvUrl: '/uploads/cv/active-user-cv.pdf',
      certificates: [
        {
          issuer: 'NPTEL',
          documentType: 'CERTIFICATE',
          documentNumber: 'DOC-ACT-1',
          holderName: 'Active Applicant',
        },
      ],
      bio: 'Active applicant bio text',
      expertise: 'Frontend',
      years: 5,
    } as any);
    const deletedCvPath = path.join(secureCvsDir, 'deleted-user-cv.pdf');
    const activeCvPath = path.join(secureCvsDir, 'active-user-cv.pdf');
    fs.writeFileSync(deletedCvPath, '%PDF-deleted');
    fs.writeFileSync(activeCvPath, '%PDF-active');

    const liveExp = dataExportService.requestExport('2');
    const expiredExp = dataExportService.requestExport('3');
    const orphanExpPath = path.join(exportDir, 'teamforge-export-prerestart.json');
    fs.writeFileSync(orphanExpPath, '{"old":true}');

    const expRec2 = dataExportService.getAllRecords().find((r) => r.exportId === liveExp.exportId)!;
    const expRec3 = dataExportService.getAllRecords().find((r) => r.exportId === expiredExp.exportId)!;
    expRec3.expiresAtMs = nowMs - 60_000;
    expRec3.expiresAt = new Date(expRec3.expiresAtMs).toISOString();

    const thirtyFiveDaysAgoIso = new Date(nowMs - 35 * 24 * 60 * 60 * 1000).toISOString();
    const purgeableProj = projectsRepo.create(
      '2',
      {
        title: 'Old Deleted Project',
        description: 'Purgeable tombstone',
        deletedAt: thirtyFiveDaysAgoIso,
      } as any,
      ProjectStatus.Open,
    );
    const escrowProtectedProj = projectsRepo.create(
      '2',
      {
        title: 'Escrow Protected Tombstone',
        description: 'Must not be purged',
        deletedAt: thirtyFiveDaysAgoIso,
      } as any,
      ProjectStatus.Open,
    );
    auditService.log({
      action: 'project-deleted',
      actor: '2',
      entityType: 'project',
      entityId: purgeableProj.id,
      target: purgeableProj.title,
      event: 'Deleted old project',
    });

    const esc = escrowService.fundForSession('sess-protected-proj', 1000);
    (mentorService as any).sessions.push({
      id: 'sess-protected-proj',
      mentorId: 'mentor-profile-1',
      studentId: '2',
      projectId: escrowProtectedProj.id,
      projectDescription: 'Protected project session',
      agreedPrice: 1000,
      totalAmount: esc.totalFunded,
      escrowId: esc.id,
      status: 'escrow_funded',
      createdAt: thirtyFiveDaysAgoIso,
    });

    const dryRes = storageHygieneService.runHygiene({
      dryRun: true,
      uploadsDir,
      secureCvsDir,
      exportDir,
    });
    expect(dryRes.dryRun).toBe(true);
    expect(dryRes.counts.orphanUploadsRemoved).toBe(1);
    expect(dryRes.counts.expiredExportsRemoved).toBe(1);
    expect(dryRes.counts.orphanExportsRemoved).toBe(1);
    expect(dryRes.counts.deletedAccountCvsRemoved).toBe(1);
    expect(dryRes.counts.projectTombstonesRemoved).toBe(1);
    expect(dryRes.counts.keptProjectsNeededByEscrow).toBe(1);
    expect(fs.existsSync(oldOrphanPath)).toBe(true);
    expect(fs.existsSync(deletedCvPath)).toBe(true);
    expect(projectsRepo.findById(purgeableProj.id)).toBeDefined();

    const liveRes = storageHygieneService.runHygiene({
      dryRun: false,
      uploadsDir,
      secureCvsDir,
      exportDir,
    });
    expect(liveRes.dryRun).toBe(false);
    expect(liveRes.counts.orphanUploadsRemoved).toBe(1);
    expect(liveRes.counts.expiredExportsRemoved).toBe(1);
    expect(liveRes.counts.orphanExportsRemoved).toBe(1);
    expect(liveRes.counts.deletedAccountCvsRemoved).toBe(1);
    expect(liveRes.counts.projectTombstonesRemoved).toBe(1);
    expect(liveRes.counts.keptProjectsNeededByEscrow).toBe(1);

    expect(fs.existsSync(oldOrphanPath)).toBe(false);
    expect(fs.existsSync(recentOrphanPath)).toBe(true);
    expect(fs.existsSync(referencedPath)).toBe(true);
    expect(fs.existsSync(deletedCvPath)).toBe(false);
    expect(fs.existsSync(activeCvPath)).toBe(true);
    expect(fs.existsSync(orphanExpPath)).toBe(false);
    expect(fs.existsSync(expRec3.filePath)).toBe(false);
    expect(fs.existsSync(expRec2.filePath)).toBe(true);

    expect(projectsRepo.findById(purgeableProj.id)).toBeUndefined();
    expect(projectsRepo.findById(escrowProtectedProj.id)).toBeDefined();
    expect(
      auditService.findAll().some((a: any) => a.entityId === purgeableProj.id),
    ).toBe(true);
  });
});
