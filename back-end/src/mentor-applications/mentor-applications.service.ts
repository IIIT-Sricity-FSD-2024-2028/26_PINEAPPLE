import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { BaseService } from '../common/abstracts/base.service';
import { MentorApplicationEntity, MentorApplicationStatus } from './entities/mentor-application.entity';
import { CreateMentorApplicationDto } from './dto/create-mentor-application.dto';
import { UpdateMentorApplicationDto } from './dto/update-mentor-application.dto';
import { UserRole } from '../users/dto/create-user.dto';
import { AuditService } from '../audit/audit.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DigiLockerSandboxProvider } from './digilocker/digilocker-sandbox.provider';
import { DigiLockerRealProvider } from './digilocker/digilocker-real.provider';
import { FirebaseService } from '../firebase/firebase.service';
import * as fs from 'fs';
import * as path from 'path';
import { assertSafeHttpUrl } from '../common/utils/url.util';
import { ClockService } from '../common/services/clock.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { FileCleanupService } from '../common/services/file-cleanup.service';
import { SECURE_CVS_DIR } from '../core/middleware/file-upload.middleware';
import { FeedbackService } from '../feedback/feedback.service';

export interface ApproveOptions {
  overrideVerification?: boolean;
  overrideNote?: string;
}

@Injectable()
export class MentorApplicationsService extends BaseService<MentorApplicationEntity> implements OnModuleInit {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly platformConfigService: PlatformConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly sandboxProvider: DigiLockerSandboxProvider,
    private readonly realProvider: DigiLockerRealProvider,
    @Optional() private readonly firebaseService?: FirebaseService,
    @Optional() private readonly clockService?: ClockService,
    @Optional() private readonly contentFilterService?: ContentFilterService,
    @Optional() private readonly fileCleanupService?: FileCleanupService,
    @Optional() private readonly feedbackService?: FeedbackService,
  ) {
    super();
  }

  onModuleInit() {
    this.repairMentorDataStartup();

    if (this.feedbackService) {
      this.feedbackService.registerEntityResolver('MENTOR_APPLICATION', (appId: string) => {
        const app = this.findOne(appId);
        if (!app) return { exists: false, parties: [] };
        return {
          exists: true,
          parties: [String(app.userId)],
          targetId: String(app.userId),
        };
      });
    }
  }

  repairMentorDataStartup(): void {
    console.log('[Mentor Data Repair] Checking user mentor applications and states on startup...');
    const allUsers = this.usersService.findAll();
    const userAppMap = new Map<string, MentorApplicationEntity[]>();

    for (const app of this.items) {
      const uId = String(app.userId || '');
      if (uId) {
        if (!userAppMap.has(uId)) userAppMap.set(uId, []);
        userAppMap.get(uId)!.push(app);
      }
    }

    for (const [userId, userApps] of userAppMap.entries()) {
      userApps.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.applicationDate || 0).getTime();
        const timeB = new Date(b.createdAt || b.applicationDate || 0).getTime();
        return timeB - timeA;
      });

      // 1. If user has multiple pending applications, keep latest, mark others superseded
      const pendingApps = userApps.filter((a) => a.status === 'pending');
      if (pendingApps.length > 1) {
        for (let i = 1; i < pendingApps.length; i++) {
          pendingApps[i].status = 'superseded';
          pendingApps[i].updatedAt = new Date().toISOString();
          console.log(`[Mentor Data Repair] Marked duplicate pending application ${pendingApps[i].id} as superseded for user ${userId}`);
        }
      }

      // 2. If user has multiple approved applications, keep latest, mark others superseded
      const approvedApps = userApps.filter((a) => a.status === 'approved');
      if (approvedApps.length > 1) {
        for (let i = 1; i < approvedApps.length; i++) {
          approvedApps[i].status = 'superseded';
          approvedApps[i].updatedAt = new Date().toISOString();
          console.log(`[Mentor Data Repair] Marked duplicate approved application ${approvedApps[i].id} as superseded for user ${userId}`);
        }
      }

      // 3. Check latest non-superseded application
      const activeApps = userApps.filter((a) => a.status !== 'superseded');
      const latestApp = activeApps[0];

      let rawUser: any;
      try {
        rawUser = this.usersService.findRawUserById(userId);
      } catch {
        rawUser = allUsers.find((u) => String(u.id) === String(userId));
      }

      for (const app of userApps) {
        if (!app.university && rawUser) {
          const userUni = rawUser.university || rawUser.profile?.university || rawUser.profile?.uni || rawUser.institution;
          if (userUni && typeof userUni === 'string' && userUni.trim()) {
            app.university = userUni.trim();
          }
        }
      }

      if (rawUser) {
        const hasApproval = approvedApps.length > 0 || (latestApp && latestApp.status === 'approved');
        if (hasApproval) {
          let updated = false;
          if (!rawUser.mentorUnlocked || !rawUser.profile?.mentorUnlocked) {
            rawUser.mentorUnlocked = true;
            if (rawUser.profile) rawUser.profile.mentorUnlocked = true;
            if (rawUser.data) (rawUser.data as any).mentorUnlocked = true;
            updated = true;
            console.log(`[Mentor Data Repair] Repaired mentorUnlocked=true for user ${userId} (${rawUser.email})`);
          }
          if (rawUser.rejectionReason || rawUser.profile?.rejectionReason) {
            delete rawUser.rejectionReason;
            if (rawUser.profile) delete rawUser.profile.rejectionReason;
            if (rawUser.data) delete (rawUser.data as any).rejectionReason;
            updated = true;
            console.log(`[Mentor Data Repair] Cleared stale rejection state for approved user ${userId}`);
          }
          if (updated) {
            try {
              this.usersService.update(userId, {
                profile: {
                  ...(rawUser.profile || {}),
                  mentorUnlocked: true,
                },
              });
            } catch (err: any) {
        console.warn('[mentor-applications.service] Suppressed non-critical error:', err?.message || err);
      }
          }
        }
      }
    }
  }

  deriveMentorStatus(userId: string): {
    status: 'none' | 'pending' | 'approved' | 'rejected';
    mentorUnlocked: boolean;
    latestApplication: MentorApplicationEntity | null;
    allApplications: MentorApplicationEntity[];
  } {
    const strUserId = String(userId);
    let user: any;
    try {
      user = this.usersService.findRawUserById(strUserId) || this.usersService.findById(strUserId);
    } catch {
      user = this.usersService.findAll().find(
        (u) => String(u.id) === strUserId || (u.email && u.email.toLowerCase() === strUserId.toLowerCase())
      );
    }

    const userApps = this.items.filter((application: MentorApplicationEntity) => {
      const matchId = String(application.userId) === strUserId;
      const matchEmail = Boolean(user?.email && application.email && application.email.toLowerCase() === user.email.toLowerCase());
      return matchId || matchEmail;
    });

    userApps.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.applicationDate || 0).getTime();
      const timeB = new Date(b.createdAt || b.applicationDate || 0).getTime();
      return timeB - timeA;
    });

    const activeApps = userApps.filter((a) => a.status !== 'superseded');
    const latestApp = activeApps.length > 0 ? activeApps[0] : null;

    const everApproved = userApps.some((a) => a.status === 'approved') ||
      Boolean(user?.mentorUnlocked || user?.profile?.mentorUnlocked || String(user?.role || '').toLowerCase() === 'mentor');

    let status: 'none' | 'pending' | 'approved' | 'rejected' = 'none';
    if (latestApp) {
      if (latestApp.status === 'approved') {
        status = 'approved';
      } else if (latestApp.status === 'pending') {
        status = 'pending';
      } else if (latestApp.status === 'rejected') {
        status = 'rejected';
      }
    } else if (everApproved) {
      status = 'approved';
    }

    const mentorUnlocked = everApproved || status === 'approved';

    return {
      status,
      mentorUnlocked,
      latestApplication: latestApp,
      allApplications: userApps,
    };
  }

  getCooldownInfo(userId: string): {
    inCooldown: boolean;
    availableAt?: string;
    rejectedAt?: string;
    cooldownDays: number;
  } {
    const cooldownDays = Number(
      this.platformConfigService?.getConfig?.()?.mentorReapplyCooldownDays ||
        process.env.MENTOR_REAPPLY_COOLDOWN_DAYS ||
        14,
    );
    const rejectedApps = this.findByUser(userId)
      .filter((a) => a.status === 'rejected')
      .sort((a, b) => {
        const tA = new Date(a.rejectedAt || a.updatedAt || a.createdAt || a.applicationDate || 0).getTime();
        const tB = new Date(b.rejectedAt || b.updatedAt || b.createdAt || b.applicationDate || 0).getTime();
        return tB - tA;
      });

    if (rejectedApps.length === 0) {
      return { inCooldown: false, cooldownDays };
    }

    const latestRejected = rejectedApps[0];
    const rejectedAtIso =
      latestRejected.rejectedAt ||
      latestRejected.updatedAt ||
      latestRejected.createdAt ||
      latestRejected.applicationDate;
    const rejectedMs = rejectedAtIso ? new Date(rejectedAtIso).getTime() : NaN;
    if (Number.isNaN(rejectedMs) || rejectedMs <= 0) {
      return { inCooldown: false, cooldownDays };
    }

    const availableAtMs = rejectedMs + cooldownDays * 24 * 60 * 60 * 1000;
    const availableAt = new Date(availableAtMs).toISOString();
    const nowMs = (this.clockService ? this.clockService.now() : new Date()).getTime();
    return {
      inCooldown: nowMs < availableAtMs,
      availableAt,
      rejectedAt: rejectedAtIso,
      cooldownDays,
    };
  }

  getMyMentorStatus(userId: string) {
    const derived = this.deriveMentorStatus(userId);
    const cooldown = derived.mentorUnlocked ? { inCooldown: false, cooldownDays: 14 } : this.getCooldownInfo(userId);
    return {
      status: derived.status,
      mentorUnlocked: derived.mentorUnlocked,
      application: derived.latestApplication,
      allApplications: derived.allApplications,
      inCooldown: cooldown.inCooldown,
      cooldownAvailableAt: cooldown.availableAt,
      rejectedAt: cooldown.rejectedAt,
      cooldownDays: cooldown.cooldownDays,
    };
  }

  getDigiLockerProvider() {
    const mode = process.env.DIGILOCKER_MODE || 'sandbox';
    return mode === 'real' ? this.realProvider : this.sandboxProvider;
  }

  getDigiLockerStatus() {
    const provider = this.getDigiLockerProvider();
    return {
      mode: provider.mode,
      isSimulated: provider.mode === 'sandbox',
      isAvailable: provider.isAvailable,
    };
  }

  async pullDigiLockerDocuments(applicantName: string) {
    const provider = this.getDigiLockerProvider();
    const docs = await provider.fetchIssuedDocuments('', applicantName);
    return {
      mode: provider.mode,
      isSimulated: provider.mode === 'sandbox',
      documents: docs,
    };
  }

  create(createMentorApplicationDto: CreateMentorApplicationDto): MentorApplicationEntity {
    const applicantUserId = String(createMentorApplicationDto.userId || '');
    if (applicantUserId) {
      const current = this.deriveMentorStatus(applicantUserId);
      if (current.mentorUnlocked || current.status === 'approved') {
        throw new ConflictException('Mentor role is already approved for this account.');
      }
      if (current.status === 'pending') {
        throw new ConflictException('A mentor application is already pending review.');
      }
      const cooldown = this.getCooldownInfo(applicantUserId);
      if (cooldown.inCooldown && cooldown.availableAt) {
        const displayDate = new Date(cooldown.availableAt).toISOString().split('T')[0];
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'REAPPLY_COOLDOWN',
          availableAt: cooldown.availableAt,
          message: `Your previous mentor application was rejected. You may apply again on ${displayDate} (${cooldown.availableAt}).`,
        });
      }
    }

    this.contentFilterService?.assertClean(
      {
        headline: createMentorApplicationDto.headline,
        bio: createMentorApplicationDto.bio,
        experience: createMentorApplicationDto.experience,
        motivation: createMentorApplicationDto.motivation,
        expertise: createMentorApplicationDto.expertise,
        name: createMentorApplicationDto.name,
      },
      ['headline', 'bio', 'experience', 'motivation', 'expertise', 'name'],
      { actorId: applicantUserId || 'applicant', entityType: 'mentor_application' },
    );

    let rawYears =
      createMentorApplicationDto.years !== undefined
        ? createMentorApplicationDto.years
        : createMentorApplicationDto.yearsOfExperience !== undefined
          ? createMentorApplicationDto.yearsOfExperience
          : undefined;

    if (rawYears === undefined && createMentorApplicationDto.experience) {
      const match = String(createMentorApplicationDto.experience).match(/\d+/);
      if (match) rawYears = parseInt(match[0], 10);
    }

    if (rawYears === undefined || rawYears === null || typeof rawYears === 'boolean' || typeof rawYears === 'string') {
      throw new BadRequestException('Years of experience must be a whole number between 5 and 40.');
    }

    const numYears = Number(rawYears);
    if (!Number.isInteger(numYears) || numYears < 5 || numYears > 40) {
      throw new BadRequestException('Years of experience must be a whole number between 5 and 40.');
    }

    const configMinYears = this.platformConfigService.getConfig().mentorMinYearsExperience || 5;
    if (numYears < configMinYears) {
      throw new BadRequestException(
        `Minimum ${configMinYears} years of professional experience required for mentor eligibility.`,
      );
    }

    const years = numYears;

    // 1. Mandatory CV upload (.pdf)
    if (!createMentorApplicationDto.cvFileName) {
      throw new BadRequestException('A CV upload (.pdf, max 5MB) is required for mentor application.');
    }

    // 2. Server-side credential verification: Re-check every credential against applicant's full name
    const rawCertificates = [
      ...(Array.isArray(createMentorApplicationDto.certificates) ? createMentorApplicationDto.certificates : []),
      ...(Array.isArray(createMentorApplicationDto.excludedCertificates) ? createMentorApplicationDto.excludedCertificates : []),
    ];

    const applicantFullName = (createMentorApplicationDto.name || '').trim().toLowerCase();
    const verifiedCertificates: any[] = [];
    const excludedCertificates: any[] = [];

    for (const rawCert of rawCertificates) {
      const holderName = String(rawCert.holderName || '').trim().toLowerCase();
      // Server-side name match against applicant full name (trimmed, case-insensitive)
      const isMatch = Boolean(
        applicantFullName &&
        holderName &&
        (holderName === applicantFullName ||
         holderName.includes(applicantFullName) ||
         applicantFullName.includes(holderName))
      );

      const processedCert = {
        ...rawCert,
        id: rawCert.id || `dl-doc-${verifiedCertificates.length + excludedCertificates.length + 1}`,
        issuer: rawCert.issuer || 'Credential Issuer',
        documentType: rawCert.documentType || rawCert.docType || 'CERTIFICATE',
        docType: rawCert.documentType || rawCert.docType || 'CERTIFICATE',
        documentNumber: rawCert.documentNumber || rawCert.docNumber || 'DOC-000',
        docNumber: rawCert.documentNumber || rawCert.docNumber || 'DOC-000',
        holderName: rawCert.holderName || createMentorApplicationDto.name,
        issueDate: rawCert.issueDate || new Date().toISOString().slice(0, 10),
        status: isMatch ? 'verified' : 'name_mismatch',
        verificationStatus: isMatch ? 'verified' : 'mismatch',
        verifiedAt: isMatch ? (rawCert.verifiedAt || new Date().toISOString()) : undefined,
        verificationId: isMatch ? (rawCert.verificationId || `DL-VRF-${randomUUID().slice(0, 8).toUpperCase()}`) : undefined,
        mismatchReason: isMatch ? undefined : 'Holder name does not match applicant profile name.',
      };

      if (isMatch) {
        verifiedCertificates.push(processedCert);
      } else {
        excludedCertificates.push(processedCert);
      }
    }

    // Must have at least one verified credential
    if (verifiedCertificates.length === 0) {
      if (excludedCertificates.some((c) => c.status === 'name_mismatch')) {
        throw new BadRequestException('Certificate holder name does not match applicant profile name. Verification failed.');
      }
      throw new BadRequestException('At least one verified certificate matching your full name from DigiLocker is required for mentor application.');
    }

    if (createMentorApplicationDto.linkedin) {
      assertSafeHttpUrl(createMentorApplicationDto.linkedin, 'linkedin', createMentorApplicationDto.userId, this.auditService);
    }
    if (createMentorApplicationDto.portfolio) {
      assertSafeHttpUrl(createMentorApplicationDto.portfolio, 'portfolio', createMentorApplicationDto.userId, this.auditService);
    }

    // Phase 10 Part C: Canonical institution / university lookup from user profile
    let userUni: string | undefined = undefined;
    if (applicantUserId) {
      try {
        const user = this.usersService.findUserSafe(applicantUserId);
        if (user) {
          userUni = user.university || (user.profile as any)?.university || (user.profile as any)?.uni || (user as any)?.institution || undefined;
        }
      } catch (err: any) {
        console.warn('[mentor-applications.service] Suppressed non-critical user lookup error:', err?.message || err);
      }
    }

    const finalUniversity =
      (createMentorApplicationDto.university || (createMentorApplicationDto as any)?.institution || userUni || '').trim() || undefined;

    const nowIso = new Date().toISOString();
    const created = super.create({
      ...createMentorApplicationDto,
      university: finalUniversity,
      years,
      yearsOfExperience: years,
      linkedin: createMentorApplicationDto.linkedin || createMentorApplicationDto.portfolio,
      motivation: createMentorApplicationDto.motivation || createMentorApplicationDto.bio,
      cvFileName: createMentorApplicationDto.cvFileName,
      cvOriginalName: createMentorApplicationDto.cvOriginalName,
      cvFileSize: createMentorApplicationDto.cvFileSize,
      cvUrl: createMentorApplicationDto.cvUrl || `/uploads/cv/${createMentorApplicationDto.cvFileName}`,
      certificates: verifiedCertificates,
      excludedCertificates,
      status: 'pending',
      applicationDate: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    try {
      this.auditService.log({
        action: 'mentor-application-sent',
        actor: created.name || `User #${created.userId}`,
        target: 'Mentor Application',
        entityType: 'mentor_application',
        entityId: created.id,
        event: `${created.name || 'User'} submitted mentor application with verified CV, ${verifiedCertificates.length} verified credential(s), and ${excludedCertificates.length} excluded credential(s)`,
        details: {
          years: created.years,
          skills: created.skills,
          cvFileName: created.cvFileName,
          verifiedCount: verifiedCertificates.length,
          excludedCount: excludedCertificates.length,
        },
      });
      this.auditService.log({
        action: 'mentor-status-changed',
        actor: created.name || `User #${created.userId}`,
        target: 'Mentor Status',
        entityType: 'user',
        entityId: String(created.userId),
        event: `Mentor application submitted: status changed to "pending"`,
        details: { status: 'pending', applicationId: created.id },
      });
    } catch (err: any) {
        console.warn('[mentor-applications.service] Suppressed non-critical error:', err?.message || err);
      }

    return created;
  }

  update(id: string, updateMentorApplicationDto: UpdateMentorApplicationDto): MentorApplicationEntity {
    if (updateMentorApplicationDto.status && !['pending', 'approved', 'rejected', 'superseded'].includes(updateMentorApplicationDto.status)) {
      throw new BadRequestException('Invalid status value');
    }

    return super.update(id, {
      ...updateMentorApplicationDto,
      updatedAt: new Date().toISOString(),
    } as any);
  }

  enrichApplication(app: MentorApplicationEntity): MentorApplicationEntity {
    if (!app) return app;
    if (!app.university && app.userId) {
      try {
        const user = this.usersService.findUserSafe(String(app.userId));
        const userUni = user?.university || (user?.profile as any)?.university || (user?.profile as any)?.uni || (user as any)?.institution;
        if (userUni && typeof userUni === 'string' && userUni.trim()) {
          return {
            ...app,
            university: userUni.trim(),
          };
        }
      } catch (err: any) {
        console.warn('[mentor-applications.service] Suppressed non-critical user lookup error:', err?.message || err);
      }
    }
    return app;
  }

  override findAll(): MentorApplicationEntity[] {
    const list = super.findAll();
    return list.map((a) => this.enrichApplication(a));
  }

  override findOne(id: string): MentorApplicationEntity {
    const item = super.findOne(id);
    return this.enrichApplication(item);
  }

  findByUser(userId: string): MentorApplicationEntity[] {
    const strUserId = String(userId);
    const list = this.items.filter((application: MentorApplicationEntity) => String(application.userId) === strUserId);
    return list.map((a) => this.enrichApplication(a)).sort((a, b) => {
      const timeA = new Date(a.createdAt || a.applicationDate || 0).getTime();
      const timeB = new Date(b.createdAt || b.applicationDate || 0).getTime();
      return timeB - timeA;
    });
  }

  findLatestByUser(userId: string): MentorApplicationEntity | null {
    const list = this.findByUser(userId);
    const active = list.filter((a) => a.status !== 'superseded');
    return active.length > 0 ? active[0] : (list[0] || null);
  }

  findByStatus(status: MentorApplicationStatus): MentorApplicationEntity[] {
    return this.items.filter((application: MentorApplicationEntity) => application.status === status);
  }

  approve(id: string, performedBy = 'admin', options?: ApproveOptions): MentorApplicationEntity {
    const application = this.findOne(id);

    // If already approved/rejected, don't allow changing
    if (application.status !== 'pending') {
      throw new BadRequestException(`Application is already ${application.status}`);
    }

    let years = application.years !== undefined
      ? Number(application.years)
      : application.yearsOfExperience !== undefined
        ? Number(application.yearsOfExperience)
        : undefined;
    if (years === undefined && (application as any).experience) {
      const match = String((application as any).experience).match(/\d+/);
      if (match) years = parseInt(match[0], 10);
    }
    const minYears = this.platformConfigService.getConfig().mentorMinYearsExperience;
    if (years !== undefined && years < minYears) {
      throw new BadRequestException(`Cannot approve: Applicant has ${years} year(s) of experience, but minimum required is ${minYears}.`);
    }

    // Verification check: Approving an application with no verified credential is refused (409) unless explicitly overridden with a note
    const verifiedCount = (application.certificates || []).filter(
      (c: any) => c.status === 'verified' || c.verificationStatus === 'verified',
    ).length;

    if (verifiedCount === 0) {
      if (!options?.overrideVerification || !options?.overrideNote?.trim()) {
        throw new ConflictException(
          'Cannot approve application without verified credentials. To bypass, choose "Approve without verification" and provide a mandatory note.',
        );
      }
      application.approvalOverrideNote = options.overrideNote.trim();

      try {
        this.auditService.log({
          action: 'mentor-application-approved-without-verification',
          actor: performedBy || 'Admin',
          target: application.name || `User #${application.userId}`,
          entityType: 'mentor_application',
          entityId: application.id,
          event: `Mentor application #${application.id} for ${application.name || 'User'} approved without verified credentials by ${performedBy || 'Admin'}. Override note: ${options.overrideNote}`,
          details: { overrideNote: options.overrideNote, verifiedCount: 0 },
        });
      } catch (err: any) {
        console.warn('[mentor-applications.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    application.status = 'approved';
    application.updatedAt = new Date().toISOString();

    // Mark any other pending or duplicate applications for this user as superseded
    const otherApps = this.findByUser(String(application.userId));
    for (const other of otherApps) {
      if (other.id !== application.id && (other.status === 'pending' || other.status === 'approved')) {
        other.status = 'superseded';
        other.updatedAt = new Date().toISOString();
      }
    }

    // Auto-update the user's role to Mentor and unlock mentor profile
    let user: any;
    try {
      user = this.usersService.findById(String(application.userId));
    } catch {
      user = this.usersService.findAll().find(
        (u) =>
          String(u.id) === String(application.userId) ||
          (application.email && u.email && u.email.toLowerCase() === application.email.toLowerCase()),
      );
    }

    if (user) {
      // Clear any rejection data and reason
      delete (user as any).rejectionReason;
      if (user.profile) {
        delete (user.profile as any).rejectionReason;
      }
      if (user.data) {
        delete (user.data as any).rejectionReason;
      }

      (user as any).mentorUnlocked = true;
      if (user.profile) {
        user.profile.mentorUnlocked = true;
      }
      if (user.data) {
        (user.data as any).mentorUnlocked = true;
      }

      this.usersService.update(String(user.id), {
        role: UserRole.Mentor,
        profile: {
          ...(user.profile || {}),
          mentorUnlocked: true,
        },
      });

      // Update Firebase custom claims if Firebase service is configured
      if (this.firebaseService?.auth) {
        this.firebaseService.auth.setCustomUserClaims(String(user.id), {
          mentorUnlocked: true,
          role: UserRole.Mentor,
        }).catch(() => {
          /* non-critical: ignore USER_NOT_FOUND for local accounts */
        });
      }
    }

    // Notify applicant upon approval
    try {
      this.notificationsService.create({
        userId: String(application.userId),
        type: 'MENTOR_APPLICATION_APPROVED',
        title: 'Mentor Application Approved',
        message: '🎉 Congratulations! Your mentor application was approved. You can now switch to the Mentor role and access mentor features.',
        readStatus: false,
        referenceId: id,
      });
    } catch (err: any) {
        console.warn('[mentor-applications.service] Suppressed non-critical error:', err?.message || err);
      }

    try {
      this.auditService.log({
        action: 'mentor-application-approved',
        actor: performedBy || 'Admin',
        target: application.name || `User #${application.userId}`,
        entityType: 'mentor_application',
        entityId: application.id,
        event: `Mentor application for ${application.name || 'User'} was approved by ${performedBy || 'Admin'}`,
        details: { status: 'approved' },
      });
      this.auditService.log({
        action: 'mentor-status-changed',
        actor: performedBy || 'Admin',
        target: 'Mentor Status',
        entityType: 'user',
        entityId: String(application.userId),
        event: `Mentor status changed to "approved" (mentorUnlocked: true) for user #${application.userId}`,
        details: { status: 'approved', mentorUnlocked: true, applicationId: application.id },
      });
    } catch (err: any) {
        console.warn('[mentor-applications.service] Suppressed non-critical error:', err?.message || err);
      }

    return application;
  }

  reject(
    id: string,
    reason?: string,
    performedBy = 'Admin',
    feedbackPayload?: any,
  ): MentorApplicationEntity {
    const application = this.findOne(id);
    if (!application) {
      throw new NotFoundException(`Mentor application with ID ${id} not found`);
    }

    // Policy: Rejecting an application that is already decided returns 409 and records nothing.
    if (application.status === 'rejected' || application.status === 'approved' || application.status === 'superseded') {
      throw new ConflictException(`Cannot reject application #${id} because it has already been decided (${application.status}).`);
    }

    const rawReasons = feedbackPayload?.reasons ?? feedbackPayload?.reasonIds;
    let fb: any;
    if (rawReasons !== undefined) {
      fb = {
        reasons: Array.isArray(rawReasons) ? rawReasons : [rawReasons],
        explanation: feedbackPayload?.explanation ?? feedbackPayload?.reason ?? reason,
      };
    } else if (feedbackPayload?.feedback) {
      const subReasons = feedbackPayload.feedback.reasons ?? feedbackPayload.feedback.reasonIds;
      fb = {
        reasons: Array.isArray(subReasons) ? subReasons : (subReasons ? [subReasons] : ['OTHER']),
        explanation: feedbackPayload.feedback.explanation ?? feedbackPayload.reason ?? reason,
      };
    } else if (reason) {
      fb = { reasons: ['OTHER'], explanation: reason };
    } else {
      fb = { reasons: [] };
    }

    let rejectionReason = reason?.trim() || 'Application did not meet requirements.';
    let validatedReasons: string[] = [];

    if (this.feedbackService) {
      const validated = this.feedbackService.validate('ADMIN_REJECT_MENTOR_APP', fb, performedBy, application);
      validatedReasons = validated.reasons;
      rejectionReason = validated.explanation || validated.reasons.join(', ');
      this.feedbackService.record({
        actionType: 'ADMIN_REJECT_MENTOR_APP',
        entityType: 'MENTOR_APPLICATION',
        entityId: id,
        actorUserId: performedBy,
        targetUserId: String(application.userId),
        reasons: validated.reasons,
        explanation: validated.explanation,
      });
    }

    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    const cooldownDays = Number(
      this.platformConfigService?.getConfig?.()?.mentorReapplyCooldownDays ||
        process.env.MENTOR_REAPPLY_COOLDOWN_DAYS ||
        14,
    );
    const cooldownMs = new Date(nowIso).getTime() + cooldownDays * 24 * 60 * 60 * 1000;
    const cooldownUntil = new Date(cooldownMs).toISOString();

    const updated = super.update(id, {
      status: 'rejected',
      rejectionReason,
      rejectedAt: nowIso,
      cooldownUntil,
      reapplyCooldownUntil: cooldownUntil,
      updatedAt: nowIso,
    } as any);

    let user: any;
    try {
      user = this.usersService.findById(String(application.userId));
    } catch {
      user = this.usersService.findAll().find(
        (u) =>
          String(u.id) === String(application.userId) ||
          (application.email && u.email && u.email.toLowerCase() === application.email.toLowerCase()),
      );
    }

    // Rule: Rejection of a later application never revokes an earlier approval!
    const wasAlreadyApproved = Boolean(
      user?.mentorUnlocked ||
      user?.profile?.mentorUnlocked ||
      String(user?.role || '').toLowerCase() === 'mentor' ||
      this.findByUser(String(application.userId)).some((a) => a.id !== id && a.status === 'approved')
    );

    if (user && !wasAlreadyApproved) {
      (user as any).rejectionReason = rejectionReason;
      if (user.profile) {
        (user.profile as any).rejectionReason = rejectionReason;
      }
    }

    // Notify applicant with tags and link
    try {
      const tagsStr = validatedReasons.length > 0 ? validatedReasons.join(', ') : rejectionReason;
      const explanationNote = (fb?.explanation && fb.explanation !== tagsStr) ? ` Note: ${fb.explanation}` : '';
      this.notificationsService.create({
        userId: application.userId,
        type: 'MENTOR_APPLICATION_REJECTED',
        title: 'Mentor Application Update',
        message: `🔴 Your mentor application was reviewed and rejected. Reason tags: [${tagsStr}].${explanationNote} View explanation: /profile`,
        readStatus: false,
        referenceId: id,
        link: '/profile',
      });
    } catch (err: any) {
      console.warn('[mentor-applications.service] Suppressed non-critical error:', err?.message || err);
    }

    try {
      this.auditService.log({
        action: 'mentor-application-rejected',
        actor: performedBy || 'Admin',
        target: application ? application.name : `Application #${id}`,
        entityType: 'mentor_application',
        entityId: id,
        event: `Mentor application for ${application ? application.name : 'User'} was rejected by ${performedBy || 'Admin'}`,
        details: { status: 'rejected', reason: rejectionReason },
      });
      this.auditService.log({
        action: 'mentor-status-changed',
        actor: performedBy || 'Admin',
        target: 'Mentor Status',
        entityType: 'user',
        entityId: String(application.userId),
        event: `Mentor application #${id} rejected${wasAlreadyApproved ? ' (prior approval preserved)' : ''}`,
        details: {
          status: wasAlreadyApproved ? 'approved' : 'rejected',
          mentorUnlocked: wasAlreadyApproved,
          applicationId: id,
        },
      });
    } catch (err: any) {
        console.warn('[mentor-applications.service] Suppressed non-critical error:', err?.message || err);
      }

    return updated;
  }

  cleanupApplicationCvFile(application: MentorApplicationEntity): void {
    if (application?.cvFileName) {
      const cleanup = this.fileCleanupService || new FileCleanupService();
      cleanup.removeNamedFileInDir(SECURE_CVS_DIR, application.cvFileName, false);
      application.cvFileName = undefined;
      application.cvUrl = undefined;
      super.update(application.id, { cvFileName: undefined, cvUrl: undefined } as any);
    }
  }

  resetToSeed(): void {
    this.reset();
    this.repairMentorDataStartup();
  }

  reset(): void {
    this.items.length = 0;
  }
}
