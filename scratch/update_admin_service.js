const fs = require('fs');
const file = 'back-end/src/admin/admin.service.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Update imports
const importRepl = `import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject, forwardRef, Optional } from '@nestjs/common';
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
import { normalizeRole } from '../common/utils/role.util';`;

const oldImportHeader = "import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';";
const oldImportEnd = "import { normalizeRole } from '../common/utils/role.util';";
const startIdx = content.indexOf(oldImportHeader);
const endIdx = content.indexOf(oldImportEnd) + oldImportEnd.length;
content = content.slice(0, startIdx) + importRepl + content.slice(endIdx);

// 2. Update constructor
const oldCtor = `  constructor(
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
  ) {}`;

const newCtor = `  constructor(
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
    private readonly mentorMarketplaceService: MentorMarketplaceService,
    @Optional()
    private readonly clockService?: ClockService,
  ) {}`;

if (content.includes(oldCtor)) {
  content = content.replace(oldCtor, newCtor);
} else {
  // Try CRLF
  const oldCtorCRLF = oldCtor.replace(/\n/g, '\r\n');
  const newCtorCRLF = newCtor.replace(/\n/g, '\r\n');
  content = content.replace(oldCtorCRLF, newCtorCRLF);
}

// 3. Update getUserDetails to include activeWarningsCount, warningHistory, suspensionReason, etc.
const detailsTarget = `      warnings: typeof safeUser.warnings === 'number'
        ? safeUser.warnings
        : Array.isArray(safeUser.data?.warnings)
        ? safeUser.data.warnings.length
        : 0,`;

const detailsRepl = `      warnings: typeof safeUser.warnings === 'number'
        ? safeUser.warnings
        : Array.isArray(safeUser.data?.warnings)
        ? safeUser.data.warnings.length
        : 0,
      activeWarningsCount: safeUser.activeWarningsCount !== undefined
        ? safeUser.activeWarningsCount
        : (Array.isArray(safeUser.data?.warnings) ? safeUser.data.warnings.length : 0),
      warningHistory: Array.isArray(safeUser.warnings)
        ? safeUser.warnings
        : (Array.isArray(safeUser.data?.warnings) ? safeUser.data.warnings : []),
      suspensionReason: safeUser.suspensionReason || null,
      suspendedAt: safeUser.suspendedAt || null,
      reactivationReason: safeUser.reactivationReason || null,
      reactivatedAt: safeUser.reactivatedAt || null,`;

if (content.includes(detailsTarget)) {
  content = content.replace(detailsTarget, detailsRepl);
} else {
  const detailsTargetCRLF = detailsTarget.replace(/\n/g, '\r\n');
  const detailsReplCRLF = detailsRepl.replace(/\n/g, '\r\n');
  content = content.replace(detailsTargetCRLF, detailsReplCRLF);
}

// 4. Replace updateUserStatus, flagUser, suspendUser, warnUser
const moderationBlockTarget = `  updateUserStatus(id: string, payload: ModerateUserDto, performedBy = 'admin') {
    if (payload.status === UserStatus.Suspended) {
      return this.suspendUser(id, performedBy);
    }
    const allowedStatuses = [UserStatus.Active, UserStatus.Suspended, UserStatus.Flagged, UserStatus.Banned];
    if (!allowedStatuses.includes(payload.status as any)) {
      throw new BadRequestException(\`Invalid status: \${payload.status}\`);
    }

    const isActivating = payload.status === UserStatus.Active;
    const updatedUser = this.usersService.update(id, {
      status: payload.status,
      ...(isActivating ? { flags: false, flagged: false } : {}),
    });
    const targetName = updatedUser ? updatedUser.name : \`User #\${id}\`;

    // Account status sync: re-enable Firebase user if activating
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
      event: \`Admin updated status for \${targetName} to \${payload.status}\`,
      details: { status: payload.status },
    });

    this.invalidateStatsCache();
    return updatedUser;
  }

  flagUser(id: string, performedBy = 'admin') {
    const updatedUser = this.usersService.update(id, { status: UserStatus.Flagged, flags: true });
    const targetName = updatedUser ? updatedUser.name : \`User #\${id}\`;

    this.auditService.log({
      action: 'flag-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      actor: performedBy,
      target: targetName,
      event: \`Admin flagged account for \${targetName}\`,
      details: { status: UserStatus.Flagged, flagged: true },
    });
    this.invalidateStatsCache();
    return updatedUser;
  }

  suspendUser(id: string, performedBy = 'admin') {
    const updatedUser = this.usersService.update(id, { status: UserStatus.Suspended });
    const targetName = updatedUser ? updatedUser.name : \`User #\${id}\`;

    // Immediately kill existing JWT access tokens and refresh tokens
    this.usersService.bumpTokenVersion(id);
    this.usersService.revokeAllRefreshTokens(id);

    // Account status sync: disable Firebase account & revoke refresh tokens (Phase 1 Step 7)
    if (process.env.AUTH_MODE === 'firebase') {
      try {
        this.firebaseService.auth.updateUser(id, { disabled: true }).catch(() => {});
        this.firebaseService.auth.revokeRefreshTokens(id).catch(() => {});
      } catch (err: any) {
        console.warn('[admin.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    try {
      this.notificationsService.create({
        userId: String(id),
        type: 'ACCOUNT_SUSPENDED',
        title: 'Account Suspended',
        message: '⚠️ Your account has been suspended by an administrator. Contact support for assistance.',
        readStatus: false,
      });
    } catch (err: any) {
        console.warn('[admin.service] Suppressed non-critical error:', err?.message || err);
      }

    this.auditService.log({
      action: 'suspend-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      actor: performedBy,
      target: targetName,
      event: \`Admin suspended account for \${targetName}\`,
      details: { status: UserStatus.Suspended },
    });
    this.invalidateStatsCache();
    return updatedUser;
  }

  warnUser(id: string, payload: WarnUserDto, performedBy = 'admin') {
    const user = this.usersService.findById(id);
    const warningRecord = {
      reason: payload.reason,
      issuedBy: performedBy,
      issuedAt: new Date().toISOString(),
    };
    const userData = (user as any).data || {};
    const warnings = Array.isArray(userData.warnings) ? userData.warnings : [];
    const updatedData = {
      ...userData,
      warnings: [...warnings, warningRecord],
    };

    const updatedUser = this.usersService.update(id, { 
      data: updatedData,
      status: UserStatus.Warned,
      flags: true 
    } as any);

    const targetName = user ? user.name : \`User #\${id}\`;

    try {
      this.notificationsService.create({
        userId: String(id),
        type: 'ACCOUNT_WARNED',
        title: 'Official Account Warning',
        message: \`⚠️ You have received an official account warning. Reason: \${payload.reason}\`,
        readStatus: false,
      });
    } catch (err: any) {
        console.warn('[admin.service] Suppressed non-critical error:', err?.message || err);
      }

    this.auditService.log({
      action: 'warn-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      actor: performedBy,
      target: targetName,
      event: \`Admin issued warning to \${targetName}: \${payload.reason}\`,
      details: { reason: payload.reason },
    });
    this.invalidateStatsCache();
    return updatedUser;
  }`;

const newModerationBlock = `  updateUserStatus(id: string, payload: ModerateUserDto, performedBy = 'admin') {
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
      throw new BadRequestException(\`Invalid status: \${payload.status}\`);
    }

    const isActivating = payload.status === UserStatus.Active;
    const updatedUser = this.usersService.update(id, {
      status: payload.status,
      ...(isActivating ? { flags: false, flagged: false } : {}),
    });
    const targetName = updatedUser ? updatedUser.name : \`User #\${id}\`;

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
      event: \`Admin updated status for \${targetName} to \${payload.status}\`,
      details: { status: payload.status, reason: payload.reason },
    });

    this.invalidateStatsCache();
    return updatedUser;
  }

  flagUser(id: string, performedBy = 'admin') {
    const updatedUser = this.usersService.update(id, { status: UserStatus.Flagged, flags: true });
    const targetName = updatedUser ? updatedUser.name : \`User #\${id}\`;

    this.auditService.log({
      action: 'flag-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      actor: performedBy,
      target: targetName,
      event: \`Admin flagged account for \${targetName}\`,
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
      throw new NotFoundException(\`User with ID \${id} not found.\`);
    }

    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();

    const updatedUser = this.usersService.update(id, {
      status: UserStatus.Suspended,
      suspensionReason: reason,
      suspendedAt: nowIso,
    } as any);

    const targetName = user ? user.name : \`User #\${id}\`;

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
      event: \`Admin suspended account for \${targetName}: \${reason}\`,
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
      throw new NotFoundException(\`User with ID \${id} not found.\`);
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

    const targetName = user ? user.name : \`User #\${id}\`;

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
        message: \`Your account has been reactivated. Reason: \${reason}\`,
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
      event: \`Admin reactivated account for \${targetName}: \${reason}\`,
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
      throw new NotFoundException(\`User with ID \${id} not found.\`);
    }

    const nowIso = this.clockService ? this.clockService.nowIso() : new Date().toISOString();
    const currentActiveCount = (user.activeWarningsCount || 0) + 1;

    const warningRecord = {
      id: \`warn-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`,
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

    // Deduct 10 reputation via gamification ledger
    try {
      this.gamificationService.recordWarningIssued(id, reason);
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

    const targetName = user ? user.name : \`User #\${id}\`;

    // Notification titled with the count: Warning 1/4, 2/4, 3/4, 4/4
    try {
      this.notificationsService.create({
        userId: String(id),
        type: 'ACCOUNT_WARNED',
        title: \`Warning \${currentActiveCount}/4\`,
        message: \`⚠️ Official Warning (\${currentActiveCount}/4): \${reason}\`,
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
      event: \`Admin issued warning \${currentActiveCount}/4 to \${targetName}: \${reason}\`,
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
  }`;

if (content.includes(moderationBlockTarget)) {
  content = content.replace(moderationBlockTarget, newModerationBlock);
} else {
  const moderationBlockTargetCRLF = moderationBlockTarget.replace(/\n/g, '\r\n');
  const newModerationBlockCRLF = newModerationBlock.replace(/\n/g, '\r\n');
  content = content.replace(moderationBlockTargetCRLF, newModerationBlockCRLF);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated admin.service.ts');
