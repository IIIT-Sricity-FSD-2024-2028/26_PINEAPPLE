import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Warning } from './entities/warning.entity';
import { PendingModerationAction } from './entities/pending-moderation-action.entity';
import {
  WARNING_LIMIT,
  MIN_REASON_LENGTH,
  MAX_REASON_LENGTH,
  SECOND_APPROVAL_MIN_AGE_DAYS,
  SECOND_APPROVAL_MIN_REP,
  PENDING_MODERATION_EXPIRY_HOURS,
  WARNING_DECAY_DAYS,
} from './moderation.config';
import { ClockService } from '../common/services/clock.service';
import { ReputationService } from './reputation.service';
import { SuspensionConsequencesService } from './suspension-consequences.service';
import { UsersRepository } from '../users/users.repository';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { normalizeRole } from '../common/utils/role.util';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private warnings: Warning[] = [];
  private pendingActions: PendingModerationAction[] = [];
  private pendingActionSeq = 0;

  constructor(
    private readonly clockService: ClockService,
    private readonly reputationService: ReputationService,
    private readonly suspensionConsequencesService: SuspensionConsequencesService,
    @Inject(forwardRef(() => UsersRepository))
    private readonly usersRepository: UsersRepository,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Clears warnings and pending moderation actions store for tests.
   */
  resetToSeed(): void {
    this.reset();
  }

  reset() {
    this.warnings = [];
    this.pendingActions = [];
    this.pendingActionSeq = 0;
  }

  getActiveWarningsCount(userId: string): number {
    const uid = String(userId);
    return this.warnings.filter((w) => String(w.userId) === uid && w.status === 'active').length;
  }

  getAllWarnings(): Warning[] {
    return [...this.warnings];
  }

  findWarningById(id: string): Warning | undefined {
    return this.warnings.find((w) => String(w.id) === String(id));
  }

  removeWarning(warningId: string, removedAt?: string): Warning | null {
    const warning = this.findWarningById(warningId);
    if (!warning) return null;
    warning.status = 'removed';
    warning.removedAt = removedAt || this.clockService?.nowIso?.() || new Date().toISOString();

    const newActiveCount = this.getActiveWarningsCount(warning.userId);
    this.usersRepository.update(warning.userId, {
      activeWarningsCount: newActiveCount,
      warnings: [...this.warnings.filter((w) => String(w.userId) === String(warning.userId))],
    } as any);

    return warning;
  }

  validateReason(reason: string): string {
    const trimmed = (reason || '').trim();
    if (!trimmed || trimmed.length < MIN_REASON_LENGTH || trimmed.length > MAX_REASON_LENGTH) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'BAD_REQUEST',
        code: 'REASON_REQUIRED',
        message: `Reason is required and must be between ${MIN_REASON_LENGTH} and ${MAX_REASON_LENGTH} characters.`,
      });
    }
    return trimmed;
  }

  private validateTargetAndActor(actorId: string, targetUserId: string) {
    if (String(actorId) === String(targetUserId)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'FORBIDDEN',
        code: 'CANNOT_MODERATE_SELF',
        message: 'You cannot moderate your own account.',
      });
    }

    const targetUser = this.usersRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'NOT_FOUND',
        code: 'USER_NOT_FOUND',
        message: `User with ID ${targetUserId} not found.`,
      });
    }

    const targetRole = normalizeRole(targetUser.role);
    if (
      targetRole === 'admin' ||
      targetRole === 'superuser' ||
      targetUser.id === 'u-admin' ||
      targetUser.id === 'u-superuser'
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'FORBIDDEN',
        code: 'CANNOT_MODERATE_ADMIN',
        message: 'You cannot moderate an administrator or superuser account.',
      });
    }

    return targetUser;
  }

  async warn(
    actorId: string,
    targetUserId: string,
    rawReason: string,
    reportId?: string,
  ): Promise<{
    warning: Warning;
    activeCount: number;
    activeWarningsCount?: number;
    autoSuspended: boolean;
    status?: string;
    suspensionReason?: string;
  }> {
    const reason = this.validateReason(rawReason);
    const targetUser = this.validateTargetAndActor(actorId, targetUserId);

    const activeCount = this.getActiveWarningsCount(targetUserId);
    const nextCount = activeCount + 1;

    const warning: Warning = {
      id: `warn-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      userId: String(targetUserId),
      issuedBy: String(actorId),
      reason,
      status: 'active',
      createdAt: this.clockService?.nowIso?.() || new Date().toISOString(),
    };

    this.warnings.push(warning);

    // Reputation deduction: -10
    this.reputationService.recordWarning(targetUserId, warning.id);

    // Sync activeWarningsCount and warnings array on user entity
    const existingWarnings = Array.isArray((targetUser as any).warnings)
      ? [...(targetUser as any).warnings]
      : [];
    existingWarnings.push(warning);

    this.usersRepository.update(targetUserId, {
      activeWarningsCount: nextCount,
      warnings: existingWarnings,
    } as any);

    // Notification titled "Warning N/4" with reason
    try {
      this.notificationsService.create({
        userId: targetUserId,
        type: 'WARNING',
        title: `Warning ${nextCount}/${WARNING_LIMIT}`,
        message: reason,
        readStatus: false,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to create warning notification: ${err?.message}`);
    }

    // Mail with reason
    try {
      await this.mailService.sendWarningEmail({
        to: targetUser.email,
        name: targetUser.name,
        warningNumber: nextCount,
        maxWarnings: WARNING_LIMIT,
        reason,
      });
    } catch (err: any) {
      this.logger.warn(`Mail delivery failed on warning (non-blocking): ${err?.message}`);
    }

    // Audit log
    try {
      this.auditService.create({
        actor: actorId,
        performedBy: actorId,
        target: targetUserId,
        entityType: 'user',
        entityId: targetUserId,
        action: 'user-warned',
        details: {
          userId: targetUserId,
          targetUserId,
          actorId,
          reportId: reportId || undefined,
          message: `Issued warning ${nextCount}/${WARNING_LIMIT} to user ${targetUserId}. Reason: ${reason}`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message}`);
    }

    let autoSuspended = false;
    const autoReason = 'Automatic suspension after 4 warnings';

    // Automatic suspension on 4th active warning
    if (nextCount >= WARNING_LIMIT) {
      autoSuspended = true;

      await this.suspensionConsequencesService.handleSuspension(targetUserId, autoReason);

      this.usersRepository.update(targetUserId, {
        status: 'Suspended' as any,
        suspendedReason: autoReason,
        tokenVersion: ((targetUser as any).tokenVersion || 0) + 1,
        refreshTokens: [],
      } as any);

      // Mail only for suspension, no notification
      try {
        await this.mailService.sendSuspensionEmail({
          to: targetUser.email,
          name: targetUser.name,
          reason: autoReason,
        });
      } catch (err: any) {
        this.logger.warn(`Auto-suspension mail delivery failed: ${err?.message}`);
      }

      try {
        this.auditService.create({
          userId: 'system',
          actor: 'system',
          performedBy: 'system',
          target: targetUserId,
          entityType: 'user',
          entityId: targetUserId,
          action: 'user-auto-suspended',
          details: {
            userId: targetUserId,
            targetUserId,
            reportId: reportId || undefined,
            message: `User ${targetUserId} suspended automatically after reaching ${WARNING_LIMIT} warnings.`,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Audit log failed: ${err?.message}`);
      }
    }

    return {
      warning,
      activeCount: nextCount,
      activeWarningsCount: nextCount,
      autoSuspended,
      status: autoSuspended ? ('Suspended' as any) : ('Active' as any),
      suspensionReason: autoSuspended ? autoReason : undefined,
    };
  }

  private getNowDate(): Date {
    return this.clockService ? new Date(this.clockService.now()) : new Date();
  }

  private getNowIso(): string {
    return this.clockService?.nowIso?.() || new Date().toISOString();
  }

  private getEffectiveReputation(targetUser: any): number {
    const uid = String(targetUser.id);
    if (this.reputationService) {
      if (typeof (this.reputationService as any).getTotal === 'function') {
        return (this.reputationService as any).getTotal(uid);
      }
      if (typeof this.reputationService.getReputation === 'function') {
        return this.reputationService.getReputation(uid);
      }
    }
    return 0;
  }

  evaluateSecondApprovalRequired(
    targetUser: any,
    actorRole = 'admin',
  ): {
    required: boolean;
    thresholdReasons: string[];
    accountAgeDays: number;
    targetReputation: number;
  } {
    const normRole = normalizeRole(actorRole);
    const nowMs = this.getNowDate().getTime();
    const rawCreatedAt =
      targetUser?.createdAt || targetUser?.joinedDate || targetUser?.profile?.createdAt;
    let accountAgeDays = 0;
    const thresholdReasons: string[] = [];

    if (rawCreatedAt) {
      const createdMs = new Date(rawCreatedAt).getTime();
      if (!Number.isNaN(createdMs)) {
        const ageMs = Math.max(0, nowMs - createdMs);
        accountAgeDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
        if (ageMs > SECOND_APPROVAL_MIN_AGE_DAYS * 24 * 60 * 60 * 1000) {
          thresholdReasons.push('account_age_over_90_days');
        }
      }
    }

    const targetReputation = this.getEffectiveReputation(targetUser);
    if (targetReputation >= SECOND_APPROVAL_MIN_REP) {
      thresholdReasons.push('reputation_150_plus');
    }

    if (normRole === 'superuser' || normRole === 'system') {
      return { required: false, thresholdReasons, accountAgeDays, targetReputation };
    }

    return {
      required: thresholdReasons.length > 0,
      thresholdReasons,
      accountAgeDays,
      targetReputation,
    };
  }

  private async executeImmediateSuspension(
    actorId: string,
    targetUserId: string,
    targetUser: any,
    reason: string,
    reportId?: string,
  ): Promise<{ status: string; suspensionReason: string }> {
    const nowIso = this.getNowIso();
    await this.suspensionConsequencesService.handleSuspension(targetUserId, reason);

    this.usersRepository.update(targetUserId, {
      status: 'Suspended' as any,
      suspendedReason: reason,
      suspensionReason: reason,
      suspendedAt: nowIso,
      tokenVersion: ((targetUser as any).tokenVersion || 0) + 1,
      refreshTokens: [],
    } as any);

    // Send email only, no notification
    try {
      await this.mailService.sendSuspensionEmail({
        to: targetUser.email,
        name: targetUser.name,
        reason,
      });
    } catch (err: any) {
      this.logger.warn(`Manual suspension mail failed: ${err?.message}`);
    }

    try {
      this.auditService.create({
        userId: actorId,
        actor: actorId,
        performedBy: actorId,
        target: targetUserId,
        entityType: 'user',
        entityId: targetUserId,
        action: 'user-suspended',
        details: {
          userId: targetUserId,
          targetUserId,
          actorId,
          reportId: reportId || undefined,
          message: `Admin ${actorId} suspended user ${targetUserId}. Reason: ${reason}`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message}`);
    }

    return { status: 'suspended', suspensionReason: reason };
  }

  async suspend(
    actorId: string,
    targetUserId: string,
    rawReason: string,
    actorRole = 'admin',
    reportId?: string,
  ): Promise<{
    status: string;
    suspensionReason?: string;
    actionId?: string;
    pendingAction?: PendingModerationAction;
    thresholdReasons?: string[];
  }> {
    const reason = this.validateReason(rawReason);
    const targetUser = this.validateTargetAndActor(actorId, targetUserId);

    if (String(targetUser.status || '').toLowerCase() === 'suspended') {
      throw new ConflictException({
        statusCode: 409,
        error: 'CONFLICT',
        code: 'ALREADY_SUSPENDED',
        message: 'User is already suspended.',
      });
    }

    this.expireStalePendingActions();

    const evalResult = this.evaluateSecondApprovalRequired(targetUser, actorRole);
    if (!evalResult.required) {
      return this.executeImmediateSuspension(actorId, targetUserId, targetUser, reason, reportId);
    }

    const existingPending = this.pendingActions.find(
      (a) =>
        a.type === 'suspend' &&
        String(a.targetUserId) === String(targetUserId) &&
        a.status === 'pending',
    );
    if (existingPending) {
      throw new ConflictException({
        statusCode: 409,
        error: 'CONFLICT',
        code: 'MODERATION_ACTION_ALREADY_PENDING',
        message: 'A suspension request for this user is already waiting for second approval.',
        actionId: existingPending.id,
      });
    }

    const nowDate = this.getNowDate();
    const nowIso = nowDate.toISOString();
    const expiresAt = new Date(
      nowDate.getTime() + PENDING_MODERATION_EXPIRY_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const actorUser = this.usersRepository.findById(actorId);

    const pendingAction: PendingModerationAction = {
      id: `pma-${++this.pendingActionSeq}-${nowDate.getTime()}`,
      type: 'suspend',
      targetUserId: String(targetUserId),
      targetUserName: targetUser.name || `User #${targetUserId}`,
      requestedBy: String(actorId),
      requestedByName: actorUser?.name || actorUser?.email || String(actorId),
      reason,
      status: 'pending',
      thresholdReasons: evalResult.thresholdReasons,
      accountAgeDays: evalResult.accountAgeDays,
      targetReputation: evalResult.targetReputation,
      reportId: reportId || undefined,
      createdAt: nowIso,
      expiresAt,
    };

    this.pendingActions.push(pendingAction);

    try {
      this.auditService.create({
        userId: actorId,
        actor: actorId,
        performedBy: actorId,
        target: targetUserId,
        entityType: 'user',
        entityId: targetUserId,
        action: 'pending-moderation-requested',
        details: {
          actionId: pendingAction.id,
          type: 'suspend',
          thresholdReasons: evalResult.thresholdReasons,
          reason,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message}`);
    }

    return {
      status: 'pending_second_approval',
      actionId: pendingAction.id,
      pendingAction,
      thresholdReasons: evalResult.thresholdReasons,
    };
  }

  getPendingModerationActions(status?: string): PendingModerationAction[] {
    this.expireStalePendingActions();
    const normalizedFilter = status ? String(status).toLowerCase() : '';
    return this.pendingActions
      .filter((a) => !normalizedFilter || normalizedFilter === 'all' || a.status === normalizedFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((a) => ({ ...a }));
  }

  getPendingModerationActionsForUser(targetUserId: string): PendingModerationAction[] {
    this.expireStalePendingActions();
    return this.pendingActions
      .filter((a) => String(a.targetUserId) === String(targetUserId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((a) => ({ ...a }));
  }

  async approvePendingAction(
    actionId: string,
    approverId: string,
    rawReason: string,
  ): Promise<{ status: string; suspensionReason: string; action: PendingModerationAction }> {
    const action = this.pendingActions.find((a) => String(a.id) === String(actionId));
    if (!action) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'NOT_FOUND',
        code: 'ACTION_NOT_FOUND',
        message: 'Pending moderation action not found.',
      });
    }

    this.expireStalePendingActions();

    if (action.status === 'expired') {
      throw new ConflictException({
        statusCode: 409,
        error: 'CONFLICT',
        code: 'ACTION_EXPIRED',
        message: 'This moderation action expired after 72 hours.',
      });
    }

    if (action.status !== 'pending') {
      throw new ConflictException({
        statusCode: 409,
        error: 'CONFLICT',
        code: 'ACTION_ALREADY_DECIDED',
        message: 'This moderation action has already been decided.',
      });
    }

    if (String(action.requestedBy) === String(approverId)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'FORBIDDEN',
        code: 'SAME_ADMIN_NOT_ALLOWED',
        message: 'A different admin or Super User must approve this moderation action.',
      });
    }

    const decisionReason = this.validateReason(rawReason);
    const targetUser = this.validateTargetAndActor(approverId, action.targetUserId);

    if (String(targetUser.status || '').toLowerCase() === 'suspended') {
      throw new ConflictException({
        statusCode: 409,
        error: 'CONFLICT',
        code: 'ALREADY_SUSPENDED',
        message: 'User is already suspended.',
      });
    }

    const nowIso = this.getNowIso();
    const approverUser = this.usersRepository.findById(approverId);
    action.status = 'approved';
    action.decidedBy = String(approverId);
    action.decidedByName = approverUser?.name || approverUser?.email || String(approverId);
    action.decidedAt = nowIso;
    action.decisionReason = decisionReason;

    await this.executeImmediateSuspension(approverId, action.targetUserId, targetUser, action.reason, action.reportId);

    try {
      this.auditService.create({
        userId: approverId,
        actor: approverId,
        performedBy: approverId,
        target: action.targetUserId,
        entityType: 'user',
        entityId: action.targetUserId,
        action: 'pending-moderation-approved',
        details: {
          actionId: action.id,
          requestedBy: action.requestedBy,
          targetUserId: action.targetUserId,
          userId: action.targetUserId,
          reportId: action.reportId || undefined,
          decisionReason,
          suspensionReason: action.reason,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message}`);
    }

    return {
      status: 'suspended',
      suspensionReason: action.reason,
      action: { ...action },
    };
  }

  rejectPendingAction(
    actionId: string,
    reviewerId: string,
    rawReason: string,
  ): { status: string; action: PendingModerationAction } {
    const action = this.pendingActions.find((a) => String(a.id) === String(actionId));
    if (!action) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'NOT_FOUND',
        code: 'ACTION_NOT_FOUND',
        message: 'Pending moderation action not found.',
      });
    }

    this.expireStalePendingActions();

    if (action.status === 'expired') {
      throw new ConflictException({
        statusCode: 409,
        error: 'CONFLICT',
        code: 'ACTION_EXPIRED',
        message: 'This moderation action expired after 72 hours.',
      });
    }

    if (action.status !== 'pending') {
      throw new ConflictException({
        statusCode: 409,
        error: 'CONFLICT',
        code: 'ACTION_ALREADY_DECIDED',
        message: 'This moderation action has already been decided.',
      });
    }

    if (String(action.requestedBy) === String(reviewerId)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'FORBIDDEN',
        code: 'SAME_ADMIN_NOT_ALLOWED',
        message: 'A different admin or Super User must reject this moderation action.',
      });
    }

    const decisionReason = this.validateReason(rawReason);
    const nowIso = this.getNowIso();
    const reviewerUser = this.usersRepository.findById(reviewerId);
    action.status = 'rejected';
    action.decidedBy = String(reviewerId);
    action.decidedByName = reviewerUser?.name || reviewerUser?.email || String(reviewerId);
    action.decidedAt = nowIso;
    action.decisionReason = decisionReason;

    try {
      this.auditService.create({
        userId: reviewerId,
        actor: reviewerId,
        performedBy: reviewerId,
        target: action.targetUserId,
        entityType: 'user',
        entityId: action.targetUserId,
        action: 'pending-moderation-rejected',
        details: {
          actionId: action.id,
          requestedBy: action.requestedBy,
          decisionReason,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message}`);
    }

    return {
      status: 'rejected',
      action: { ...action },
    };
  }

  expireStalePendingActions(): string[] {
    const nowMs = this.getNowDate().getTime();
    const expiredIds: string[] = [];
    for (const action of this.pendingActions) {
      if (action.status !== 'pending') continue;
      const expMs = new Date(action.expiresAt).getTime();
      if (!Number.isNaN(expMs) && nowMs >= expMs) {
        action.status = 'expired';
        action.decidedAt = this.getNowIso();
        expiredIds.push(action.id);
      }
    }
    return expiredIds;
  }

  decayExpiredWarnings(): { expiredWarningIds: string[]; affectedUserIds: string[] } {
    const nowDate = this.getNowDate();
    const nowMs = nowDate.getTime();
    const nowIso = nowDate.toISOString();
    const decayThresholdMs = WARNING_DECAY_DAYS * 24 * 60 * 60 * 1000;

    const warningsByUser = new Map<string, Warning[]>();
    for (const w of this.warnings) {
      const uid = String(w.userId);
      const list = warningsByUser.get(uid) || [];
      list.push(w);
      warningsByUser.set(uid, list);
    }

    const expiredWarningIds: string[] = [];
    const affectedUserIds: string[] = [];

    for (const [uid, userWarnings] of warningsByUser.entries()) {
      const user = this.usersRepository.findById(uid);
      if (!user || String(user.status || '').toLowerCase() === 'suspended') {
        continue;
      }

      const hasRecentActiveWarning = userWarnings.some((w) => {
        if (w.status !== 'active') return false;
        const createdMs = new Date(w.createdAt).getTime();
        return Number.isNaN(createdMs) || nowMs - createdMs <= decayThresholdMs;
      });
      if (hasRecentActiveWarning) {
        continue;
      }

      let expiredAnyForUser = false;
      for (const w of userWarnings) {
        if (w.status !== 'active') continue;
        const createdMs = new Date(w.createdAt).getTime();
        if (!Number.isNaN(createdMs) && nowMs - createdMs > decayThresholdMs) {
          w.status = 'expired';
          w.expiredAt = nowIso;
          expiredWarningIds.push(w.id);
          expiredAnyForUser = true;
        }
      }

      if (expiredAnyForUser) {
        affectedUserIds.push(uid);
        this.usersRepository.update(uid, {
          activeWarningsCount: this.getActiveWarningsCount(uid),
          warnings: [...userWarnings],
        } as any);
      }
    }

    return { expiredWarningIds, affectedUserIds };
  }

  async reactivate(
    actorId: string,
    targetUserId: string,
    rawReason: string,
  ): Promise<{ status: string; clearedWarnings: number; activeWarningsCount: number; reactivationReason?: string }> {
    const reason = this.validateReason(rawReason);
    const targetUser = this.validateTargetAndActor(actorId, targetUserId);

    if (String(targetUser.status || '').toLowerCase() !== 'suspended') {
      throw new ConflictException({
        statusCode: 409,
        error: 'CONFLICT',
        code: 'NOT_SUSPENDED',
        message: 'User is not suspended.',
      });
    }

    // Mark active warnings as cleared
    const nowIso = this.clockService?.nowIso?.() || new Date().toISOString();
    let clearedCount = 0;
    for (const w of this.warnings) {
      if (String(w.userId) === String(targetUserId) && w.status === 'active') {
        w.status = 'cleared';
        w.clearedAt = nowIso;
        clearedCount += 1;
      }
    }

    this.usersRepository.update(targetUserId, {
      status: 'Active' as any,
      suspendedReason: undefined,
      activeWarningsCount: 0,
    } as any);

    // Notification only, no mail
    try {
      this.notificationsService.create({
        userId: targetUserId,
        type: 'ACCOUNT_REACTIVATED',
        title: 'Account Reactivated',
        message: `Your account has been reactivated. Reason: ${reason}`,
        readStatus: false,
      });
    } catch (err: any) {
      this.logger.warn(`Reactivation notification failed: ${err?.message}`);
    }

    try {
      this.auditService.create({
        userId: actorId,
        action: 'user-reactivated',
        details: `Admin ${actorId} reactivated user ${targetUserId}. Cleared ${clearedCount} warnings. Reason: ${reason}`,
      });
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message}`);
    }

    return {
      status: 'active',
      clearedWarnings: clearedCount,
      activeWarningsCount: 0,
      reactivationReason: reason,
    };
  }

  getAdminUserWarnings(targetUserId: string): any[] {
    const uid = String(targetUserId);
    const list = this.warnings
      .filter((w) => String(w.userId) === uid)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return list.map((w) => {
      const mod = this.usersRepository.findById(w.issuedBy);
      const moderatorName = mod?.name || (w.issuedBy === 'system' ? 'System' : 'Administrator');
      return {
        ...w,
        moderatorName,
      };
    });
  }

  getUserOwnWarnings(userId: string): any[] {
    const uid = String(userId);
    const list = this.warnings
      .filter((w) => String(w.userId) === uid)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let activeNum = 0;
    return list.map((w) => {
      let label = `Warning (${w.status})`;
      if (w.status === 'active') {
        activeNum += 1;
        label = `Warning ${activeNum}/${WARNING_LIMIT}`;
      } else if (w.status === 'expired') {
        label = 'Expired';
      }
      return {
        id: w.id,
        reason: w.reason,
        createdAt: w.createdAt,
        expiredAt: w.expiredAt,
        status: w.status,
        label,
      };
    });
  }
}
