import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { MentorApplicationsService } from '../mentor-applications/mentor-applications.service';
import { PortalAdminsService } from '../portal-admins/portal-admins.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { UpdatePlatformConfigDto } from '../platform-config/dto/update-platform-config.dto';
import { ModerateUserDto } from './dto/moderate-user.dto';
import { WarnUserDto } from './dto/warn-user.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { ReactivateUserDto } from './dto/reactivate-user.dto';
import { AdminStatsEntity } from './entities/admin-stats.entity';
import { AuditLogEntry } from './entities/audit-log-entry.entity';
import { UserStatus } from '../users/dto/create-user.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { FirebaseService } from '../firebase/firebase.service';
import { MailService } from '../mail/mail.service';
import { GamificationService } from '../gamification/gamification.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { ClockService } from '../common/services/clock.service';
import { normalizeRole } from '../common/utils/role.util';
import { DuplicateDetectionService } from '../users/duplicate-detection.service';
import { ModerationService } from '../moderation/moderation.service';
import { ReputationService } from '../moderation/reputation.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { LoginThrottleService } from '../auth/login-throttle.service';
import { stripUserSecrets } from '../users/user-serializer';
import { BootService } from '../system/boot.service';
import { buildSuspendedResponse } from '../common/utils/suspended-response.util';

@Injectable()
export class AdminService {
  private cachedStats: { data: AdminStatsEntity; timestamp: number } | null = null;
  private statsDirty = true;

  public invalidateStatsCache(): void {
    this.statsDirty = true;
    this.cachedStats = null;
  }

  constructor(
    private readonly usersService: UsersService,
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
    private readonly auditService: AuditService,
    private readonly mentorApplicationsService: MentorApplicationsService,
    private readonly portalAdminsService: PortalAdminsService,
    private readonly platformConfigService: PlatformConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
    private readonly firebaseService: FirebaseService,
    private readonly mailService: MailService,
    private readonly gamificationService: GamificationService,
    @Inject(forwardRef(() => MentorMarketplaceService))
    private readonly mentorMarketplaceService: any,
    @Optional()
    private readonly clockService?: ClockService,
    @Optional()
    private readonly duplicateDetectionService?: DuplicateDetectionService,
    @Optional()
    @Inject(forwardRef(() => ModerationService))
    private readonly moderationService?: ModerationService,
    @Optional()
    private readonly loginThrottleService?: LoginThrottleService,
    @Optional()
    @Inject(forwardRef(() => ReputationService))
    private readonly reputationService?: ReputationService,
    @Optional()
    @Inject(forwardRef(() => LeaderboardService))
    private readonly leaderboardService?: LeaderboardService,
    @Optional()
    private readonly bootService?: BootService,
  ) {}

  getDuplicateUsers() {
    if (!this.duplicateDetectionService) {
      return { groups: [], totalGroups: 0, totalFlaggedUsers: 0 };
    }
    return this.duplicateDetectionService.getDuplicateGroups();
  }

  exportAuditLog(options: {
    format?: string;
    from?: string;
    to?: string;
    actor?: string;
    action?: string;
    userId?: string;
    reportId?: string;
    requesterId?: string;
  }) {
    return this.auditService.exportAuditLog(options);
  }

  async suspendWithModerationCheck(
    actorId: string,
    targetUserId: string,
    reason: string,
    actorRole = 'admin',
  ) {
    if (this.moderationService) {
      return this.moderationService.suspend(actorId, targetUserId, reason, actorRole);
    }
    return this.suspendUser(targetUserId, { reason }, actorId);
  }

  getConfig() {
    return this.platformConfigService.getConfig();
  }

  updateConfig(dto: UpdatePlatformConfigDto) {
    const updated = this.platformConfigService.updateConfig(dto);
    try {
      this.auditService.log({
        action: 'config-saved',
        actor: 'Super User',
        target: 'Platform Configuration',
        entityType: 'platform_config',
        entityId: 'global',
        event: 'Super User committed platform configuration updates',
        details: dto,
      });
    } catch (err: any) {
        console.warn('[admin.service] Suppressed non-critical error:', err?.message || err);
      }
    return updated;
  }

  getUsers() {
    const rawUsers = this.usersService.findAll();
    // Exclude admins, superusers, system accounts, and duplicate/hidden accounts
    const eligibleUsers = rawUsers.filter((u: any) => {
      if (u.isDuplicate || u.isHidden) return false;
      const normRole = normalizeRole(u.role);
      if (normRole === 'admin' || normRole === 'superuser') return false;
      if (u.id === 'u-admin' || u.id === 'u-superuser') return false;
      return true;
    });

    const allProjects = this.projectsService.findAll();
    const projectCountsByOwner = new Map<string, number>();
    for (const p of allProjects) {
      const owner = String(p.ownerId);
      projectCountsByOwner.set(owner, (projectCountsByOwner.get(owner) || 0) + 1);
    }

    const pendingMap = new Map<string, any>();
    if (this.moderationService && typeof this.moderationService.getPendingModerationActions === 'function') {
      for (const act of this.moderationService.getPendingModerationActions('pending')) {
        if (!pendingMap.has(String(act.targetUserId))) {
          pendingMap.set(String(act.targetUserId), act);
        }
      }
    }

    const repTotals = this.reputationService
      ? this.reputationService.getTotals(eligibleUsers.map((u: any) => String(u.id)))
      : {};

    return eligibleUsers.map((u: any) => {
      const cleanName = (u.name || u.profile?.fullName || 'User')
        .replace(/\s*\([^)]*\)$/, '')
        .trim();
      const xp = u.profile?.xp ?? u.xp ?? 0;
      const rep = this.reputationService ? (repTotals[String(u.id)] ?? 0) : 0;
      const university = u.university || u.profile?.university || u.profile?.uni || '';
      const userProjects = (u.data?.projects?.length ?? 0) || projectCountsByOwner.get(String(u.id)) || 0;
      return {
        ...u,
        name: cleanName,
        xp,
        rep,
        university,
        projects: userProjects,
        pendingModerationAction: pendingMap.get(String(u.id)) || null,
      };
    });
  }

  getUserDetails(id: string) {
    const user = this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Never return password, secrets, or internal auth hashes
    const { password, salt, refreshTokens, ...safeUser } = user as any;

    const xp = safeUser.profile?.xp ?? safeUser.xp ?? 0;
    const rep = this.reputationService ? this.reputationService.getTotal(String(id)) : 0;
    const university = safeUser.university || safeUser.profile?.university || safeUser.profile?.uni || '';
    const skills = safeUser.profile?.skills || safeUser.skills || [];

    // Projects: all projects owned by user, where user is member/collaborator, or mentored via shared function
    const allProjects = this.projectsService.findAll('all');
    const userProjectsMap = new Map<string, any>();
    for (const p of allProjects) {
      const isOwner = String(p.ownerId) === String(id);
      const isCollab = Array.isArray(p.collaborators) && p.collaborators.some((c: any) => String(c.id || c.userId) === String(id));
      const isMember = Array.isArray(p.members) && p.members.some((m: any) => String(m.id || m.userId) === String(id));
      const isMentor = String((p as any).mentorId || (p as any).completedMentorUserId || '') === String(id);
      if (isOwner || isCollab || isMember || isMentor) {
        userProjectsMap.set(String(p.id), {
          id: p.id,
          title: p.title || p.name || 'Untitled Project',
          difficulty: p.difficulty || 'Medium',
          status: p.status || 'Active',
          isCompleted: Boolean(p.isCompleted),
          progress: p.progress ?? 0,
          role: isOwner ? 'Owner' : isMentor ? 'Mentor' : 'Collaborator',
          createdAt: p.createdAt,
        });
      }
    }

    let mentoredProjects: any[] = [];
    try {
      const mentoredRes =
        typeof this.mentorMarketplaceService?.getMentoredProjectsForUser === 'function'
          ? this.mentorMarketplaceService.getMentoredProjectsForUser(id)
          : typeof this.mentorMarketplaceService?.getMentoredProjects === 'function'
          ? this.mentorMarketplaceService.getMentoredProjects(id)
          : null;
      mentoredProjects = Array.isArray(mentoredRes?.items) ? mentoredRes.items : [];
      for (const mp of mentoredProjects) {
        const pid = String(mp.projectId || mp.id);
        const existing = userProjectsMap.get(pid);
        if (!existing) {
          userProjectsMap.set(pid, {
            id: pid,
            title: mp.title || 'Untitled Project',
            difficulty: 'Medium',
            status: mp.status || 'Active',
            isCompleted: mp.tab === 'completed' || String(mp.status || '').toLowerCase() === 'completed',
            progress: mp.progress ?? 0,
            role: 'Mentor',
            createdAt: mp.acceptedAt || mp.completedAt || null,
          });
        } else if (existing.role !== 'Owner') {
          existing.role = 'Mentor';
        }
      }
    } catch {
      mentoredProjects = [];
    }

    const userProjects = Array.from(userProjectsMap.values());

    // Tasks / Contributions
    const allTasks = this.tasksService.findAll();
    const userTasks = allTasks.filter((t: any) => String(t.assigneeId) === String(id)).map((t: any) => ({
      id: t.id,
      projectId: t.projectId,
      projectName: t.projectName || allProjects.find((p: any) => String(p.id) === String(t.projectId))?.title || 'Project',
      title: t.title,
      status: t.status,
      priority: t.priority || 'medium',
      xpAwarded: Boolean(t.xpAwarded),
      awardedXp: t.awardedXp ?? (t.xpReward || 50),
      createdAt: t.createdAt,
    }));

    // Mentor Status
    let mentorStatus = 'None';
    const normRole = String(safeUser.role || '').toLowerCase();
    if (normRole === 'mentor' || safeUser.mentorUnlocked || safeUser.profile?.mentorUnlocked) {
      mentorStatus = 'Approved Mentor';
    } else {
      const derived = this.mentorApplicationsService.deriveMentorStatus(id);
      if (derived.status === 'approved' || derived.mentorUnlocked) {
        mentorStatus = 'Approved Mentor';
      } else if (derived.status === 'pending') {
        mentorStatus = 'Application Pending';
      } else if (derived.status === 'rejected') {
        mentorStatus = 'Application Rejected';
      } else {
        mentorStatus = 'None';
      }
    }

    // Recent Activity from Audit Log
    const allAudit = this.auditService.findAll();
    const userAudit = allAudit.filter((entry: any) => {
      return (
        String(entry.entityId) === String(id) ||
        entry.actor === safeUser.name ||
        entry.performedBy === safeUser.email ||
        entry.performedBy === safeUser.name ||
        (entry.target && typeof entry.target === 'string' && entry.target.includes(safeUser.name))
      );
    }).slice(0, 10);

    const liveWarnings =
      this.moderationService && typeof this.moderationService.getAdminUserWarnings === 'function'
        ? this.moderationService.getAdminUserWarnings(id)
        : [];
    const fallbackWarnings = Array.isArray(safeUser.warnings)
      ? safeUser.warnings
      : Array.isArray(safeUser.data?.warnings)
      ? safeUser.data.warnings
      : [];
    const warningHistory = liveWarnings.length > 0 ? liveWarnings : fallbackWarnings;
    const activeWarningsCount =
      this.moderationService && typeof this.moderationService.getActiveWarningsCount === 'function' && liveWarnings.length > 0
        ? this.moderationService.getActiveWarningsCount(id)
        : safeUser.activeWarningsCount !== undefined
        ? safeUser.activeWarningsCount
        : fallbackWarnings.filter((w: any) => (w.status || 'active') === 'active').length;

    const pendingModerationActions =
      this.moderationService && typeof this.moderationService.getPendingModerationActionsForUser === 'function'
        ? this.moderationService.getPendingModerationActionsForUser(id)
        : [];

    return stripUserSecrets({
      id: safeUser.id,
      name: safeUser.name,
      email: safeUser.email,
      username: safeUser.username || safeUser.name,
      role: safeUser.role || 'Collaborator',
      university,
      phone: safeUser.phone || safeUser.profile?.phone || null,
      phoneVerified: Boolean(safeUser.phoneVerified || safeUser.profile?.phoneVerified),
      phoneVerifiedAt: safeUser.phoneVerifiedAt || safeUser.profile?.phoneVerifiedAt || null,
      status: safeUser.status || 'Active',
      flags: Boolean(safeUser.flags || safeUser.flagged),
      flagged: Boolean(safeUser.flags || safeUser.flagged),
      warnings: typeof safeUser.warnings === 'number'
        ? safeUser.warnings
        : warningHistory.length,
      activeWarningsCount,
      warningHistory,
      pendingModerationActions,
      suspensionReason: safeUser.suspensionReason || null,
      suspendedAt: safeUser.suspendedAt || null,
      reactivationReason: safeUser.reactivationReason || null,
      reactivatedAt: safeUser.reactivatedAt || null,
      joinedDate: safeUser.createdAt || safeUser.profile?.createdAt || safeUser.profile?.joined || safeUser.joinedDate || 'Unknown',
      xp,
      rep,
      skills,
      mentorStatus,
      projectsCount: userProjects.length,
      completedTasksCount: userTasks.filter((t: any) => {
        const s = String(t.status).toLowerCase();
        return s === 'completed' || s === 'approved';
      }).length,
      projects: userProjects,
      mentoredProjects,
      contributions: userTasks,
      recentActivity: userAudit,
      mentorRecommendations: safeUser.data?.mentorRecommendations || [],
    });
  }

  private generateAdminToken(uid: string, email: string, role: string, permissions: string[]): string {
    if (process.env.AUTH_MODE === 'legacy') {
      return role === 'superuser' ? 'mock-su-token-456' : 'mock-admin-token-123';
    }
    const secret = process.env.JWT_SECRET || 'teamforge-jwt-secret-key-development-minimum-32-chars';
    return this.jwtService.sign(
      {
        sub: uid,
        email,
        role,
        permissions,
        tv: 1,
        jti: crypto.randomUUID(),
        ...(this.bootService?.bootId ? { bootId: this.bootService.bootId } : {}),
      },
      {
        secret,
        algorithm: 'HS256',
        expiresIn: '8h' as any,
        issuer: 'teamforge',
        audience: 'teamforge-web',
      },
    );
  }

  login(credentials: any, clientIp = 'unknown') {
    const rawEmail = credentials?.email ?? credentials?.identifier ?? '';
    const password = credentials?.password;
    if (typeof password !== 'string' || !password.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'PASSWORD_REQUIRED',
        message: 'Password is required.',
      });
    }

    const normEmail = String(rawEmail || '').trim().toLowerCase();
    const portalAdmin = normEmail ? this.portalAdminsService.findByEmail(normEmail) : undefined;
    const dbUser = normEmail ? this.usersService.findRawUserByEmail(normEmail) : undefined;

    const accountKeys: string[] = [normEmail];
    if (portalAdmin?.id) accountKeys.push(`admin:${portalAdmin.id}`);
    if (dbUser?.id) accountKeys.push(String(dbUser.id));

    this.loginThrottleService?.assertAllowed(accountKeys, clientIp, {
      auditAction: 'ADMIN_LOGIN_THROTTLED',
    });

    const failInvalidCredentials = (): never => {
      this.loginThrottleService?.recordFailure(accountKeys, clientIp);
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    };

    // 1. Superuser hardcoded root credential
    if (normEmail === 'superuser@teamforge.io') {
      if (password !== 'Super@123' && password !== 'password123') {
        failInvalidCredentials();
      }
      this.loginThrottleService?.resetAccount(accountKeys);
      this.auditService.log({
        action: 'login',
        entityType: 'superuser',
        entityId: 'u-superuser',
        performedBy: 'superuser@teamforge.io',
        actor: 'Super User',
        target: 'Super User Portal',
        event: 'Super User (superuser@teamforge.io) logged into Portal',
      });
      return {
        token: this.generateAdminToken('u-superuser', 'superuser@teamforge.io', 'superuser', ['*']),
        role: 'superuser',
        permissions: ['*'],
        name: 'Super User',
        email: 'superuser@teamforge.io',
      };
    }

    // 2. Default Admin hardcoded credential
    if (normEmail === 'admin@teamforge.io') {
      if (password !== 'admin123' && password !== 'password123') {
        failInvalidCredentials();
      }
      this.loginThrottleService?.resetAccount(accountKeys);
      this.auditService.log({
        action: 'login',
        entityType: 'admin',
        entityId: 'u-admin',
        performedBy: 'admin@teamforge.io',
        actor: 'Admin',
        target: 'Admin Portal',
        event: 'Admin (admin@teamforge.io) logged into Admin Portal',
      });
      return {
        token: this.generateAdminToken('u-admin', 'admin@teamforge.io', 'admin', ['*']),
        role: 'admin',
        permissions: ['*'],
        name: 'Default Admin',
        email: 'admin@teamforge.io',
      };
    }

    // 3. Dynamic Portal Admins created by Super User
    if (portalAdmin) {
      let pwdMatch = false;
      if (portalAdmin.password) {
        if (portalAdmin.password.startsWith('$2a$') || portalAdmin.password.startsWith('$2b$')) {
          pwdMatch = bcrypt.compareSync(password, portalAdmin.password);
        } else {
          pwdMatch = portalAdmin.password === password;
        }
      }

      if (!pwdMatch) {
        failInvalidCredentials();
      }

      if (
        (portalAdmin.status || 'active').toLowerCase() === 'suspended' ||
        (portalAdmin.status || 'active').toLowerCase() === 'disabled'
      ) {
        this.loginThrottleService?.resetAccount(accountKeys);
        try {
          this.auditService.log({
            action: 'LOGIN_BLOCKED_SUSPENDED',
            actor: `Portal Admin #${portalAdmin.id}`,
            target: 'Admin Login',
            entityType: 'portal_admin',
            entityId: String(portalAdmin.id),
            event: `Admin login blocked: Portal admin account ${portalAdmin.id} is suspended or disabled.`,
            details: {
              userId: String(portalAdmin.id),
            },
          });
        } catch (err: any) {
          console.warn('[admin.service] Suppressed audit log error:', err?.message || err);
        }
        throw new ForbiddenException(buildSuspendedResponse(portalAdmin));
      }

      this.loginThrottleService?.resetAccount(accountKeys);
      portalAdmin.lastLogin = new Date().toISOString();

      try {
        this.auditService.log({
          action: 'admin-login',
          entityType: 'portal_admin',
          entityId: portalAdmin.id,
          performedBy: portalAdmin.email,
          actor: portalAdmin.name || 'Admin',
          target: 'Portal',
          event: `Portal Admin "${portalAdmin.name}" (${portalAdmin.email}) logged into Portal`,
          details: { permissions: portalAdmin.permissions },
        });
      } catch (err: any) {
        console.warn('[admin.service] Suppressed non-critical error:', err?.message || err);
      }

      const perms = Array.isArray(portalAdmin.permissions) ? portalAdmin.permissions : ['dashboard'];
      const pRole = portalAdmin.portalRole || 'admin';
      return {
        token: this.generateAdminToken(String(portalAdmin.id), portalAdmin.email, pRole, perms),
        role: pRole,
        permissions: perms,
        name: portalAdmin.name,
        email: portalAdmin.email,
      };
    }

    // 4. Admin / Super User accounts created in UsersRepository (e.g., via Super User POST /users)
    if (dbUser && !(dbUser as any).isDeleted && !(dbUser as any).deletedAt) {
      const dbNormRole = normalizeRole(dbUser.role);
      if (dbNormRole === 'admin' || dbNormRole === 'superuser') {
        let pwdMatch = false;
        if (dbUser.password) {
          if (dbUser.password.startsWith('$2a$') || dbUser.password.startsWith('$2b$')) {
            pwdMatch = bcrypt.compareSync(password, dbUser.password);
          } else {
            pwdMatch = dbUser.password === password;
          }
        }
        if (!pwdMatch) {
          failInvalidCredentials();
        }
        const statusLower = String(dbUser.status || 'active').toLowerCase();
        if (statusLower === 'suspended' || statusLower === 'banned') {
          this.loginThrottleService?.resetAccount(accountKeys);
          try {
            this.auditService.log({
              action: 'LOGIN_BLOCKED_SUSPENDED',
              actor: `User #${dbUser.id}`,
              target: 'Admin Login',
              entityType: 'user',
              entityId: String(dbUser.id),
              event: `Admin login blocked: Admin account ${dbUser.id} is suspended.`,
              details: {
                userId: String(dbUser.id),
              },
            });
          } catch (err: any) {
            console.warn('[admin.service] Suppressed audit log error:', err?.message || err);
          }
          throw new ForbiddenException(buildSuspendedResponse(dbUser));
        }

        this.loginThrottleService?.resetAccount(accountKeys);
        const perms = ['*'];
        this.auditService.log({
          action: 'admin-login',
          entityType: 'user',
          entityId: String(dbUser.id),
          performedBy: dbUser.email,
          actor: dbUser.name || 'Admin',
          target: 'Portal',
          event: `Admin user "${dbUser.name}" (${dbUser.email}) logged into Portal`,
        });

        return {
          token: this.generateAdminToken(String(dbUser.id), dbUser.email, dbNormRole, perms),
          role: dbNormRole,
          permissions: perms,
          name: dbUser.name,
          email: dbUser.email,
        };
      }
    }

    failInvalidCredentials();
  }

  updateUserStatus(id: string, payload: ModerateUserDto, performedBy = 'admin') {
    if (payload.status === UserStatus.Suspended) {
      return this.suspendUser(id, { reason: payload.reason || '' }, performedBy);
    }
    if (payload.status === UserStatus.Active) {
      const user = this.usersService.findById(id);
      if ((user?.status || '').toLowerCase() === 'suspended') {
        return this.reactivateUser(id, { reason: payload.reason || '' }, performedBy);
      }
    }
    if (payload.status === UserStatus.Warned) {
      return this.warnUser(id, { reason: payload.reason || '' }, performedBy);
    }

    const allowedStatuses = [UserStatus.Active, UserStatus.Suspended, UserStatus.Flagged, UserStatus.Banned];
    if (!allowedStatuses.includes(payload.status as any)) {
      throw new BadRequestException(`Invalid status: ${payload.status}`);
    }

    const isActivating = payload.status === UserStatus.Active;
    const updatedUser = this.usersService.update(id, {
      status: payload.status,
      ...(isActivating ? { flags: false, flagged: false } : {}),
    });
    const targetName = updatedUser ? updatedUser.name : `User #${id}`;

    if (isActivating && process.env.AUTH_MODE === 'firebase') {
      try {
        this.firebaseService.auth.updateUser(id, { disabled: false }).catch(() => {});
      } catch (err: any) {
        console.warn('[admin.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    this.auditService.log({
      action: payload.status === UserStatus.Active ? 'reactivate-user' : 'update-status',
      entityType: 'user',
      entityId: id,
      performedBy,
      actor: performedBy,
      target: targetName,
      event: `Admin updated status for ${targetName} to ${payload.status}`,
      details: { status: payload.status, reason: payload.reason },
    });

    this.invalidateStatsCache();
    return updatedUser;
  }

  flagUser(id: string, performedBy = 'admin') {
    const updatedUser = this.usersService.update(id, { status: UserStatus.Flagged, flags: true });
    const targetName = updatedUser ? updatedUser.name : `User #${id}`;

    this.auditService.log({
      action: 'flag-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      actor: performedBy,
      target: targetName,
      event: `Admin flagged account for ${targetName}`,
      details: { status: UserStatus.Flagged, flagged: true },
    });
    this.invalidateStatsCache();
    return updatedUser;
  }

  suspendUser(id: string, payload?: SuspendUserDto | { reason?: string }, performedBy = 'admin') {
    const reason = payload?.reason?.trim();
    if (!reason || reason.length < 10) {
      throw new BadRequestException('Explanation must be at least 10 characters.');
    }

    const user = this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();

    const updatedUser = this.usersService.update(id, {
      status: UserStatus.Suspended,
      suspensionReason: reason,
      suspendedAt: nowIso,
    } as any);

    const targetName = user ? user.name : `User #${id}`;

    // Immediately kill existing JWT access tokens and refresh tokens
    this.usersService.bumpTokenVersion(id);
    this.usersService.revokeAllRefreshTokens(id);

    // Disable Firebase account if in firebase mode
    if (process.env.AUTH_MODE === 'firebase') {
      try {
        this.firebaseService.auth.updateUser(id, { disabled: true }).catch(() => {});
        this.firebaseService.auth.revokeRefreshTokens(id).catch(() => {});
      } catch (err: any) {
        console.warn('[admin.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    // Suspension sends a mail ONLY (no notification, because the user can no longer log in)
    try {
      this.mailService.sendSuspensionEmail({
        to: user.email,
        name: user.name,
        reason,
      });
    } catch (err: any) {
      console.warn('[admin.service] Suppressed non-critical mail error:', err?.message || err);
    }

    // Suspension cascades:
    // 1. Collaborator: Tasks that are Open or In Progress return to Unassigned and Open. In-Review stay. Owner notified.
    try {
      this.tasksService.releaseCollaboratorTasks(id);
    } catch (err: any) {
      console.warn('[admin.service] Suppressed error releasing collaborator tasks:', err?.message || err);
    }

    // 2. Project Owner: Every project they own is closed ("Owner suspended"). Active mentor paid out, pending refunded, join requests closed by system.
    try {
      this.projectsService.handleOwnerSuspension(id);
    } catch (err: any) {
      console.warn('[admin.service] Suppressed error handling owner suspension:', err?.message || err);
    }

    // 3. Mentor: Pending sessions refunded. Active sessions refunded in full and mentor slot freed.
    try {
      this.mentorMarketplaceService.handleMentorSuspension(id);
    } catch (err: any) {
      console.warn('[admin.service] Suppressed error handling mentor suspension:', err?.message || err);
    }

    // Audit log
    this.auditService.log({
      action: 'suspend-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      actor: performedBy,
      target: targetName,
      event: `Admin suspended account for ${targetName}: ${reason}`,
      details: {
        reason,
        status: UserStatus.Suspended,
        activeWarningsCount: user.activeWarningsCount || 0,
      },
    });

    this.invalidateStatsCache();
    return updatedUser;
  }

  reactivateUser(id: string, payload?: ReactivateUserDto | { reason?: string }, performedBy = 'admin') {
    const reason = payload?.reason?.trim();
    if (!reason || reason.length < 10) {
      throw new BadRequestException('Explanation must be at least 10 characters.');
    }

    const user = this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();

    // Reactivation clears the active warning count to 0 and keeps the history
    const updatedUser = this.usersService.update(id, {
      status: UserStatus.Active,
      activeWarningsCount: 0,
      reactivationReason: reason,
      reactivatedAt: nowIso,
      flags: false,
      flagged: false,
    } as any);

    const targetName = user ? user.name : `User #${id}`;

    // Enable Firebase account if in firebase mode
    if (process.env.AUTH_MODE === 'firebase') {
      try {
        this.firebaseService.auth.updateUser(id, { disabled: false }).catch(() => {});
      } catch (err: any) {
        console.warn('[admin.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    // Reactivation sends a notification ONLY (no mail sent)
    try {
      this.notificationsService.create({
        userId: String(id),
        type: 'ACCOUNT_REACTIVATED',
        title: 'Account Reactivated',
        message: `Your account has been reactivated. Reason: ${reason}`,
        readStatus: false,
      });
    } catch (err: any) {
      console.warn('[admin.service] Suppressed non-critical notification error:', err?.message || err);
    }

    // Audit log
    this.auditService.log({
      action: 'reactivate-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      actor: performedBy,
      target: targetName,
      event: `Admin reactivated account for ${targetName}: ${reason}`,
      details: {
        reason,
        status: UserStatus.Active,
        activeWarningsCount: 0,
      },
    });

    this.invalidateStatsCache();
    return updatedUser;
  }

  warnUser(id: string, payload: WarnUserDto, performedBy = 'admin') {
    const reason = payload?.reason?.trim();
    if (!reason || reason.length < 10) {
      throw new BadRequestException('Explanation must be at least 10 characters.');
    }

    const user = this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    const currentActiveCount = (user.activeWarningsCount || 0) + 1;

    const warningRecord = {
      id: `warn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      reason,
      issuedBy: performedBy,
      issuedAt: nowIso,
      warningNumber: currentActiveCount,
    };

    const userData = (user as any).data || {};
    const existingWarnings = Array.isArray(userData.warnings)
      ? userData.warnings
      : Array.isArray(user.warnings)
      ? user.warnings
      : [];
    const updatedWarnings = [...existingWarnings, warningRecord];

    // Deduct 10 reputation via canonical reputation ledger
    try {
      this.reputationService?.recordWarning(id, warningRecord.id);
    } catch (err: any) {
      console.warn('[admin.service] Suppressed error recording warning in ledger:', err?.message || err);
    }

    // Update user record
    const updatedUser = this.usersService.update(id, {
      activeWarningsCount: currentActiveCount,
      warnings: updatedWarnings,
      data: {
        ...userData,
        warnings: updatedWarnings,
      },
      status: currentActiveCount >= 4 ? UserStatus.Suspended : UserStatus.Warned,
      flags: true,
    } as any);

    const targetName = user ? user.name : `User #${id}`;

    // Notification titled with the count: Warning 1/4, 2/4, 3/4, 4/4
    try {
      this.notificationsService.create({
        userId: String(id),
        type: 'ACCOUNT_WARNED',
        title: `Warning ${currentActiveCount}/4`,
        message: `⚠️ Official Warning (${currentActiveCount}/4): ${reason}`,
        readStatus: false,
      });
    } catch (err: any) {
      console.warn('[admin.service] Suppressed non-critical notification error:', err?.message || err);
    }

    // Mail sent with explanation
    try {
      this.mailService.sendWarningEmail({
        to: user.email,
        name: user.name,
        warningNumber: currentActiveCount,
        maxWarnings: 4,
        reason,
      });
    } catch (err: any) {
      console.warn('[admin.service] Suppressed non-critical mail error:', err?.message || err);
    }

    // Audit log
    this.auditService.log({
      action: 'warn-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      actor: performedBy,
      target: targetName,
      event: `Admin issued warning ${currentActiveCount}/4 to ${targetName}: ${reason}`,
      details: {
        reason,
        activeWarningsCount: currentActiveCount,
        warningNumber: currentActiveCount,
      },
    });

    this.invalidateStatsCache();

    // 4th active warning triggers automatic suspension!
    if (currentActiveCount >= 4) {
      return this.suspendUser(
        id,
        { reason: 'Automatic suspension after 4 warnings' },
        'System',
      );
    }

    return updatedUser;
  }

  getStats(): AdminStatsEntity {
    if (!this.statsDirty && this.cachedStats && Date.now() - this.cachedStats.timestamp < 10000) {
      return this.cachedStats.data;
    }

    const users = this.usersService.findAll();
    const projects = this.projectsService.findAll();
    const tasks = this.tasksService.findAll();

    const activeUsers = users.filter((user: any) => (user.status || 'Active').toLowerCase() === 'active').length;
    const suspendedUsers = users.filter((user: any) => (user.status || '').toLowerCase() === 'suspended').length;
    const flaggedUsers = users.filter((user: any) => (user.status || '').toLowerCase() === 'flagged').length;
    const warnedUsers = users.filter((user: any) => (user.status || '').toLowerCase() === 'warned' || (user.flags && (user.status || '').toLowerCase() !== 'suspended' && (user.status || '').toLowerCase() !== 'flagged')).length;
    const bannedUsers = users.filter((user: any) => (user.status || '').toLowerCase() === 'banned').length;
    const flaggedWarned = flaggedUsers + warnedUsers;

    let pendingMentorApps = 0;
    try {
      pendingMentorApps = this.mentorApplicationsService.findByStatus('pending' as any).length;
    } catch {
      pendingMentorApps = 0;
    }

    const auditEvents = this.auditService.count();
    const activeAdmins = this.portalAdminsService
      .findAll()
      .filter((a) => (a.status || 'active').toLowerCase() === 'active').length;

    const stats: AdminStatsEntity = {
      totalUsers: users.length,
      activeUsers,
      activeAdmins,
      suspendedUsers,
      flaggedUsers,
      bannedUsers,
      warnedUsers,
      flaggedWarned,
      pendingMentorApps,
      auditEvents,
      totalProjects: projects.length,
      openProjects: projects.filter((project: any) => (project.status || '').toLowerCase() === 'open').length,
      inProgressProjects: projects.filter((project: any) => (project.status || '').toLowerCase() === 'in-progress' || (project.status || '').toLowerCase() === 'inprogress').length,
      completedProjects: projects.filter((project: any) => (project.status || '').toLowerCase() === 'completed' || project.isCompleted === true).length,
      cancelledProjects: projects.filter((project: any) => (project.status || '').toLowerCase() === 'cancelled').length,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((task: any) => (task.status || '').toLowerCase() === 'pending' || (task.status || '').toLowerCase() === 'open').length,
      inProgressTasks: tasks.filter((task: any) => (task.status || '').toLowerCase() === 'in-progress' || (task.status || '').toLowerCase() === 'inprogress').length,
      submittedTasks: tasks.filter((task: any) => (task.status || '').toLowerCase() === 'submitted').length,
      approvedTasks: tasks.filter((task: any) => (task.status || '').toLowerCase() === 'approved' || (task.status || '').toLowerCase() === 'completed').length,
    };

    this.cachedStats = { data: stats, timestamp: Date.now() };
    this.statsDirty = false;
    return stats;
  }

  getAuditLog(
    limit?: number,
    offset?: number,
    userId?: string,
    reportId?: string,
    action?: string,
    actor?: string,
  ): AuditLogEntry[] {
    return this.auditService.findAll(limit, offset, userId, reportId, action, actor);
  }

  logClientAudit(entry: any) {
    return this.auditService.log(entry);
  }

  reconcileReputation(): {
    ok: boolean;
    totalChecked: number;
    mismatches: Array<{
      userId: string;
      name: string;
      ledgerRep: number;
      profileRep: number;
      leaderboardRep: number | null;
      reason: string;
    }>;
  } {
    const users = this.usersService.findAll();
    const lbEntries = this.leaderboardService
      ? this.leaderboardService.getLeaderboard('alltime')
      : [];
    const lbById = new Map<string, any>();
    for (const entry of lbEntries) {
      lbById.set(String(entry.userId), entry);
    }

    const ledgerTotals = this.reputationService
      ? this.reputationService.getTotals(users.map((u: any) => String(u.id)))
      : {};

    const mismatches: Array<{
      userId: string;
      name: string;
      ledgerRep: number;
      profileRep: number;
      leaderboardRep: number | null;
      reason: string;
    }> = [];

    for (const user of users) {
      const uid = String(user.id);
      const ledgerRep = ledgerTotals[uid] ?? 0;
      const profileObj = this.usersService.findById(uid);
      const profileRep = Number(profileObj?.rep ?? profileObj?.profile?.rep ?? 0);
      const lbEntry = lbById.get(uid);
      const leaderboardRep = lbEntry ? Number(lbEntry.rep ?? 0) : null;

      const reasons: string[] = [];
      if (profileRep !== ledgerRep) {
        reasons.push(`profile rep (${profileRep}) != ledger (${ledgerRep})`);
      }
      if (leaderboardRep !== null && leaderboardRep !== ledgerRep) {
        reasons.push(`leaderboard rep (${leaderboardRep}) != ledger (${ledgerRep})`);
      }

      if (reasons.length > 0) {
        mismatches.push({
          userId: uid,
          name: String(user.name || uid),
          ledgerRep,
          profileRep,
          leaderboardRep,
          reason: reasons.join('; '),
        });
      }
    }

    return {
      ok: mismatches.length === 0,
      totalChecked: users.length,
      mismatches,
    };
  }
}
