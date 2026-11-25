import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Appeal, AppealStatus } from './entities/appeal.entity';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { DecideAppealDto } from './dto/decide-appeal.dto';
import { ClockService } from '../common/services/clock.service';
import { UsersRepository } from '../users/users.repository';
import { ModerationService } from './moderation.service';
import { ReputationService } from './reputation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AppealsService {
  private readonly logger = new Logger(AppealsService.name);
  private appeals: Appeal[] = [];

  constructor(
    private readonly clockService: ClockService,
    @Inject(forwardRef(() => UsersRepository))
    private readonly usersRepository: UsersRepository,
    @Inject(forwardRef(() => ModerationService))
    private readonly moderationService: ModerationService,
    private readonly reputationService: ReputationService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  resetToSeed(): void {
    this.reset();
  }

  reset() {
    this.appeals = [];
  }

  async createAppeal(warningId: string, dto: CreateAppealDto, callerId: string): Promise<Appeal> {
    const caller = this.usersRepository.findById(callerId);
    if (caller && String(caller.status || '').toLowerCase() === 'suspended') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'SUSPENDED',
        message: 'This account is suspended. Suspended users cannot appeal warnings.',
      });
    }

    const warning = this.moderationService.findWarningById(warningId);
    if (!warning) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'WARNING_NOT_FOUND',
        message: 'Warning not found.',
      });
    }

    if (String(warning.userId) !== String(callerId)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'NOT_YOUR_WARNING',
        message: 'You can only appeal your own warnings.',
      });
    }

    if (warning.status !== 'active') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'WARNING_NOT_ACTIVE',
        message: 'Only active warnings can be appealed.',
      });
    }

    // 7-day appeal window check
    const nowMs = this.clockService ? new Date(this.clockService.now()).getTime() : Date.now();
    const warnMs = new Date(warning.createdAt).getTime();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (nowMs - warnMs > SEVEN_DAYS_MS) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'APPEAL_WINDOW_CLOSED',
        message: 'The 7-day appeal window for this warning has expired.',
      });
    }

    // Single appeal per warning check
    const existing = this.appeals.find((a) => String(a.warningId) === String(warningId));
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ALREADY_APPEALED',
        message: 'This warning has already been appealed. Only one appeal is permitted per warning.',
      });
    }

    const trimmed = (dto.explanation || '').trim();
    if (trimmed.length < 20 || trimmed.length > 1000) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'VALIDATION',
        message: 'Appeal explanation must be between 20 and 1000 characters.',
      });
    }

    const nowIso = this.clockService?.nowIso?.() || new Date().toISOString();
    const appeal: Appeal = {
      id: `appeal-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      warningId: String(warningId),
      userId: String(callerId),
      explanation: trimmed,
      status: 'pending',
      createdAt: nowIso,
    };

    this.appeals.unshift(appeal);

    try {
      this.auditService.create({
        action: 'appeal-created',
        performedBy: String(callerId),
        actor: String(callerId),
        target: warning.id,
        entityType: 'appeal',
        entityId: appeal.id,
        event: `User ${callerId} appealed warning ${warning.id}`,
        details: { warningId: warning.id, appealId: appeal.id },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message || err}`);
    }

    return appeal;
  }

  getUserAppeals(userId: string): any[] {
    const list = this.appeals.filter((a) => String(a.userId) === String(userId));
    return list.map((a) => {
      const warning = this.moderationService.findWarningById(a.warningId);
      return {
        id: a.id,
        warningId: a.warningId,
        warningReason: warning?.reason || '',
        warningCreatedAt: warning?.createdAt || '',
        warningStatus: warning?.status || '',
        explanation: a.explanation,
        status: a.status,
        adminNote: a.adminNote,
        decidedBy: a.decidedBy,
        createdAt: a.createdAt,
        decidedAt: a.decidedAt,
      };
    });
  }

  getAdminAppeals(status?: string): any[] {
    let list = [...this.appeals];
    if (status && status !== 'all') {
      const s = status.toLowerCase();
      list = list.filter((a) => a.status.toLowerCase() === s);
    }

    return list.map((a) => {
      const u = this.usersRepository.findById(a.userId);
      const warning = this.moderationService.findWarningById(a.warningId);
      return {
        id: a.id,
        warningId: a.warningId,
        userId: a.userId,
        userName: u?.name || 'Unknown User',
        userUsername: u?.username || '',
        userEmail: u?.email || '',
        warningReason: warning?.reason || '',
        warningCreatedAt: warning?.createdAt || '',
        warningStatus: warning?.status || '',
        explanation: a.explanation,
        status: a.status,
        adminNote: a.adminNote,
        decidedBy: a.decidedBy,
        createdAt: a.createdAt,
        decidedAt: a.decidedAt,
      };
    });
  }

  async decideAppeal(
    appealId: string,
    dto: DecideAppealDto,
    adminId: string,
  ): Promise<{ appeal: Appeal; warning?: any }> {
    const trimmedNote = (dto.note || '').trim();
    if (trimmedNote.length < 10) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REASON_REQUIRED',
        message: 'Decision note must be at least 10 characters.',
      });
    }

    const appeal = this.appeals.find((a) => String(a.id) === String(appealId));
    if (!appeal) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'APPEAL_NOT_FOUND',
        message: 'Appeal not found.',
      });
    }

    if (appeal.status !== 'pending') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'APPEAL_ALREADY_DECIDED',
        message: 'This appeal has already been decided.',
      });
    }

    const nowIso = this.clockService?.nowIso?.() || new Date().toISOString();
    appeal.status = dto.decision === 'accept' ? 'accepted' : 'rejected';
    appeal.adminNote = trimmedNote;
    appeal.decidedBy = adminId;
    appeal.decidedAt = nowIso;

    const warning = this.moderationService.findWarningById(appeal.warningId);

    if (dto.decision === 'accept') {
      if (warning) {
        this.moderationService.removeWarning(warning.id, nowIso);
      }

      // Restore +10 reputation exactly once
      this.reputationService.recordWarningRemoved(appeal.userId, appeal.warningId);

      try {
        await this.notificationsService.create({
          userId: appeal.userId,
          type: 'success',
          title: 'Appeal Accepted',
          message: `Your appeal for warning has been accepted: "${trimmedNote}". 10 reputation points have been restored.`,
        });
      } catch (err: any) {
        this.logger.warn(`User notification failed: ${err?.message || err}`);
      }
    } else if (dto.decision === 'reject') {
      try {
        await this.notificationsService.create({
          userId: appeal.userId,
          type: 'warning',
          title: 'Appeal Rejected',
          message: `Your appeal for warning has been rejected: "${trimmedNote}". The warning remains active.`,
        });
      } catch (err: any) {
        this.logger.warn(`User notification failed: ${err?.message || err}`);
      }
    }

    try {
      this.auditService.create({
        action: 'appeal-decided',
        performedBy: adminId,
        actor: adminId,
        target: appeal.userId,
        entityType: 'appeal',
        entityId: appeal.id,
        event: `Admin ${adminId} ${dto.decision}ed appeal ${appeal.id}`,
        details: { appealId: appeal.id, decision: dto.decision, note: trimmedNote, warningId: appeal.warningId },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message || err}`);
    }

    return {
      appeal,
      warning: this.moderationService.findWarningById(appeal.warningId),
    };
  }
}
