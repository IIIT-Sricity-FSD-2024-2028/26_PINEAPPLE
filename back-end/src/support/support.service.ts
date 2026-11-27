import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { BaseService } from '../common/abstracts/base.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';
import { UpdateAdminTicketDto } from './dto/update-admin-ticket.dto';
import { CloseProjectTicketDto } from './dto/close-project-ticket.dto';
import {
  ALLOWED_STATUS_TRANSITIONS,
  normalizeTicketStatus,
  SupportProjectFacts,
  SupportReplyEntity,
  SupportRequestEntity,
  SupportRequestStatus,
  SupportTicketCanonicalStatus,
  SupportTicketPriority,
  SupportTicketType,
} from './entities/support-request.entity';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/services/clock.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import {
  NotificationsService,
  NotificationGroupedItem,
  dispatchGroupedNotification,
  formatGroupedItemList,
} from '../notifications/notifications.service';
import { UsersRepository } from '../users/users.repository';
import { PortalAdminsService } from '../portal-admins/portal-admins.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { ProjectsService } from '../projects/projects.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { EscrowService } from '../escrow/escrow.service';
import { EscrowState } from '../escrow/entities/escrow-account.entity';
import { normalizeRole } from '../common/utils/role.util';

export const SUPPORT_DAILY_TICKET_LIMIT = 5;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SupportAssigneeOption {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'superuser';
}

@Injectable()
export class SupportService extends BaseService<SupportRequestEntity> {
  private readonly visitorRateBuckets = new Map<string, number[]>();

  constructor(
    private readonly auditService: AuditService,
    @Optional() private readonly clockService?: ClockService,
    @Optional() private readonly contentFilterService?: ContentFilterService,
    @Optional() private readonly moduleRef?: ModuleRef,
    @Optional()
    @Inject('SUPPORT_DEPS')
    private readonly injectedDeps?: {
      notificationsService?: NotificationsService;
      usersRepository?: UsersRepository;
      portalAdminsService?: PortalAdminsService;
      projectsRepository?: ProjectsRepository;
      projectsService?: ProjectsService;
      tasksRepository?: TasksRepository;
      joinRequestsService?: JoinRequestsService;
      mentorMarketplaceService?: MentorMarketplaceService;
      escrowService?: EscrowService;
    },
  ) {
    super();
  }

  private getService<T>(token: any, fallbackKey?: keyof NonNullable<SupportService['injectedDeps']>): T | undefined {
    if (fallbackKey && this.injectedDeps?.[fallbackKey]) {
      return this.injectedDeps[fallbackKey] as unknown as T;
    }
    try {
      return this.moduleRef?.get(token, { strict: false });
    } catch {
      return undefined;
    }
  }

  private now(): Date {
    return this.clockService ? this.clockService.now() : new Date();
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  resetToSeed(): void {
    this.reset();
  }

  reset(): void {
    this.items.length = 0;
    this.visitorRateBuckets.clear();
  }

  private normalizeEntity(raw: Partial<SupportRequestEntity> & Record<string, any>): SupportRequestEntity {
    const type: SupportTicketType =
      raw.type === 'project_closure' ||
      raw.category === 'Project Closure Request' ||
      raw.metadata?.type === 'abandoned_owner_close_request'
        ? 'project_closure'
        : 'help';

    const priority: SupportTicketPriority =
      raw.priority === 'low' || raw.priority === 'normal' || raw.priority === 'high'
        ? raw.priority
        : type === 'project_closure'
          ? 'high'
          : 'normal';

    const status = normalizeTicketStatus(raw.status);
    const replies: SupportReplyEntity[] = Array.isArray(raw.replies)
      ? raw.replies.map((r) => ({ ...r }))
      : [];

    return {
      ...(raw as any),
      type,
      priority,
      status,
      replies,
      createdAt: raw.createdAt || this.nowIso(),
      updatedAt: raw.updatedAt || raw.createdAt || this.nowIso(),
    };
  }

  private isVisitorUserId(userId?: string): boolean {
    return !userId || String(userId).startsWith('visitor:') || userId === 'anonymous';
  }

  private buildNotFound(): NotFoundException {
    return new NotFoundException({
      statusCode: 404,
      error: 'Not Found',
      code: 'TICKET_NOT_FOUND',
      message: 'Support ticket not found.',
    });
  }

  private sanitizeForUser(ticket: SupportRequestEntity): SupportRequestEntity {
    const normalized = this.normalizeEntity(ticket);
    return {
      ...normalized,
      projectFacts: undefined,
      replies: (normalized.replies || []).filter((r) => !r.internal),
    };
  }

  private enrichForAdmin(ticket: SupportRequestEntity): SupportRequestEntity {
    const normalized = this.normalizeEntity(ticket);
    if (normalized.type === 'project_closure') {
      const pid = normalized.projectId || normalized.metadata?.projectId;
      return {
        ...normalized,
        projectFacts: pid ? this.computeProjectFacts(String(pid)) : null,
      };
    }
    return normalized;
  }

  computeProjectFacts(projectId: string): SupportProjectFacts | null {
    const projectsRepo = this.getService<ProjectsRepository>(ProjectsRepository, 'projectsRepository');
    if (!projectsRepo) return null;
    const project = projectsRepo.findById(String(projectId));
    if (!project) return null;

    const usersRepo = this.getService<UsersRepository>(UsersRepository, 'usersRepository');
    const tasksRepo = this.getService<TasksRepository>(TasksRepository, 'tasksRepository');
    const joinRequestsService = this.getService<JoinRequestsService>(JoinRequestsService, 'joinRequestsService');
    const mentorMarketplaceService = this.getService<MentorMarketplaceService>(
      MentorMarketplaceService,
      'mentorMarketplaceService',
    );
    const escrowService = this.getService<EscrowService>(EscrowService, 'escrowService');

    const ownerUser = project.ownerId ? usersRepo?.findById?.(String(project.ownerId)) : undefined;
    const rawOwnerLastActive =
      ownerUser?.lastActiveAt ||
      project.lastOwnerActionAt ||
      project.updatedAt ||
      project.createdAt;
    const ownerLastActiveAt = rawOwnerLastActive ? new Date(rawOwnerLastActive).toISOString() : null;

    // Latest member activity timestamp from project.memberActivity and collaborators' lastActiveAt
    const memberActivityDates: number[] = [];
    if (project.memberActivity && typeof project.memberActivity === 'object') {
      for (const ts of Object.values(project.memberActivity)) {
        const ms = new Date(ts as any).getTime();
        if (!isNaN(ms) && ms > 0) memberActivityDates.push(ms);
      }
    }
    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    for (const c of collabs) {
      const cid = typeof c === 'string' ? c : String(c?.id || c?.userId || '');
      if (!cid || cid === String(project.ownerId)) continue;
      const memberUser = usersRepo?.findById?.(cid);
      if (memberUser?.lastActiveAt) {
        const ms = new Date(memberUser.lastActiveAt).getTime();
        if (!isNaN(ms) && ms > 0) memberActivityDates.push(ms);
      }
    }
    const membersLastActiveAt =
      memberActivityDates.length > 0 ? new Date(Math.max(...memberActivityDates)).toISOString() : null;

    const tasks = tasksRepo?.findAllByProjectId?.(String(project.id)) || [];
    const openTasksCount = tasks.filter((t: any) => {
      const st = String(t.status || '').replace(/[\s_-]+/g, '').toLowerCase();
      return st !== 'completed' && st !== 'done';
    }).length;

    let pendingRequestsCount = 0;
    try {
      const reqs = joinRequestsService?.findByProject?.(String(project.id)) || [];
      pendingRequestsCount = reqs.filter(
        (r: any) => String(r.status || '').toLowerCase() === 'pending',
      ).length;
    } catch {
      pendingRequestsCount = 0;
    }

    let escrowHeldAmount = 0;
    try {
      const sessions = mentorMarketplaceService?.getSessionsByProject?.(String(project.id)) || [];
      const escrows = escrowService?.findAll?.() || [];
      const escrowBySession = new Map<string, any>();
      for (const e of escrows) {
        if (e.mentorSessionId) escrowBySession.set(String(e.mentorSessionId), e);
      }
      for (const s of sessions) {
        const esc = escrowBySession.get(String(s.id));
        if (esc && (esc.status === EscrowState.Funded || esc.status === EscrowState.Disputed)) {
          escrowHeldAmount += Number(esc.totalFunded || 0);
        } else if (
          !esc &&
          (s.status === 'escrow_funded' || s.status === 'active' || s.status === 'payout_pending' || s.status === 'disputed')
        ) {
          escrowHeldAmount += Number(s.totalAmount || s.agreedPrice || 0);
        }
      }
    } catch {
      escrowHeldAmount = 0;
    }

    return {
      projectId: String(project.id),
      projectTitle: project.title || project.name || String(project.id),
      projectStatus: String(project.status || 'Open'),
      isDeleted: Boolean(project.deletedAt),
      ownerId: String(project.ownerId || ''),
      ownerName: ownerUser?.name || project.owner,
      ownerLastActiveAt,
      membersLastActiveAt,
      openTasksCount,
      totalTasksCount: tasks.length,
      escrowHeldAmount,
      pendingRequestsCount,
    };
  }

  private enforceDailyLimit(userKey: string, ipKey?: string): void {
    const nowMs = this.now().getTime();
    const recentCount = this.items.filter((t) => {
      if (t.type !== 'help') return false;
      const sameUser = String(t.userId).toLowerCase() === String(userKey).toLowerCase();
      if (!sameUser) return false;
      const createdMs = new Date(t.createdAt).getTime();
      return !isNaN(createdMs) && nowMs - createdMs < DAY_MS;
    }).length;

    const ipTimestamps = ipKey
      ? (this.visitorRateBuckets.get(ipKey) || []).filter((ts) => nowMs - ts < DAY_MS)
      : [];

    if (recentCount >= SUPPORT_DAILY_TICKET_LIMIT || (ipKey && ipTimestamps.length >= SUPPORT_DAILY_TICKET_LIMIT * 3)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          code: 'TICKET_DAILY_LIMIT',
          message: `You can submit at most ${SUPPORT_DAILY_TICKET_LIMIT} support tickets per 24 hours.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordVisitorIpHit(ipKey?: string): void {
    if (!ipKey) return;
    const nowMs = this.now().getTime();
    const arr = (this.visitorRateBuckets.get(ipKey) || []).filter((ts) => nowMs - ts < DAY_MS);
    arr.push(nowMs);
    this.visitorRateBuckets.set(ipKey, arr);
  }

  create(
    createSupportRequestDto: CreateSupportRequestDto & {
      userId?: string;
      userName?: string;
      from?: string;
      projectId?: string;
      metadata?: Record<string, any>;
      internalSystem?: boolean;
      clientIp?: string;
    },
  ): SupportRequestEntity {
    const nowIso = this.nowIso();
    const isSystemClosure =
      Boolean(createSupportRequestDto.internalSystem) ||
      createSupportRequestDto.category === 'Project Closure Request' ||
      createSupportRequestDto.metadata?.type === 'abandoned_owner_close_request';

    const resolvedType: SupportTicketType = isSystemClosure ? 'project_closure' : 'help';

    if (!isSystemClosure && createSupportRequestDto.type && createSupportRequestDto.type !== 'help') {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'INVALID_TICKET_TYPE',
        message: 'User-submitted support tickets must use type "help".',
      });
    }

    const rawSubject = String(
      createSupportRequestDto.subject ||
        (createSupportRequestDto.category ? `Support request: ${createSupportRequestDto.category}` : ''),
    ).trim();
    const rawMessage = String(createSupportRequestDto.message || '').trim();

    if (!isSystemClosure) {
      if (rawSubject.length < 5 || rawSubject.length > 120) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: 'Ticket subject must be between 5 and 120 characters.',
        });
      }
      if (rawMessage.length < 10 || rawMessage.length > 2000) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: 'Ticket message must be between 10 and 2000 characters.',
        });
      }

      this.contentFilterService?.assertClean(
        { subject: rawSubject, message: rawMessage },
        ['subject', 'message'],
        {
          actorId: createSupportRequestDto.userId || createSupportRequestDto.email || 'visitor',
          entityType: 'support_ticket',
        },
      );
    }

    const resolvedEmail = String(
      createSupportRequestDto.from || createSupportRequestDto.email || '',
    )
      .trim()
      .toLowerCase();

    let resolvedUserId = String(createSupportRequestDto.userId || '').trim();
    if (!resolvedUserId || resolvedUserId === 'anonymous') {
      if (!resolvedEmail || !EMAIL_RE.test(resolvedEmail)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'EMAIL_REQUIRED',
          message: 'A valid email address is required for support inquiries.',
        });
      }
      resolvedUserId = `visitor:${resolvedEmail}`;
    }

    if (!isSystemClosure) {
      const rateIp = this.isVisitorUserId(resolvedUserId) ? createSupportRequestDto.clientIp : undefined;
      this.enforceDailyLimit(resolvedUserId, rateIp);
      this.recordVisitorIpHit(rateIp);
    }

    let parentTicketId: string | undefined;
    if (createSupportRequestDto.parentTicketId) {
      const parent = this.items.find((t) => t.id === createSupportRequestDto.parentTicketId);
      if (!parent || (!isSystemClosure && String(parent.userId) !== resolvedUserId)) {
        throw this.buildNotFound();
      }
      const pStatus = normalizeTicketStatus(parent.status);
      if (pStatus !== 'resolved' && pStatus !== 'rejected') {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'INVALID_STATUS_CHANGE',
          message: 'Follow-up tickets can only link to resolved or rejected tickets.',
        });
      }
      parentTicketId = parent.id;
    }

    const usersRepo = this.getService<UsersRepository>(UsersRepository, 'usersRepository');
    const requesterRecord = !this.isVisitorUserId(resolvedUserId)
      ? usersRepo?.findById?.(resolvedUserId)
      : undefined;

    const priority: SupportTicketPriority =
      createSupportRequestDto.priority && !isSystemClosure
        ? createSupportRequestDto.priority
        : resolvedType === 'project_closure'
          ? 'high'
          : 'normal';

    const created = super.create({
      type: resolvedType,
      userId: resolvedUserId,
      userName: createSupportRequestDto.userName || requesterRecord?.name,
      from: resolvedEmail || requesterRecord?.email || 'anonymous@local',
      category:
        createSupportRequestDto.category ||
        (resolvedType === 'project_closure' ? 'Project Closure Request' : 'Help Inquiry'),
      subject: rawSubject || `Support request: ${createSupportRequestDto.category || 'Help'}`,
      message: rawMessage,
      priority,
      projectId: createSupportRequestDto.projectId,
      metadata: createSupportRequestDto.metadata,
      status: 'open',
      assigneeId: null,
      assigneeName: null,
      parentTicketId,
      replies: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    } as any);

    try {
      this.auditService.log({
        action: 'support-request',
        actor: created.from || `User #${created.userId}`,
        target: created.subject,
        entityType: 'support_ticket',
        entityId: created.id,
        event: `${created.from || 'User'} opened support ticket: "${created.subject}"`,
        details: { category: created.category, type: created.type, priority: created.priority },
      });
    } catch (err: any) {
      console.warn('[support.service] Suppressed non-critical error:', err?.message || err);
    }

    return created;
  }

  override findOne(id: string): SupportRequestEntity {
    const found = this.items.find((entry) => entry.id === id);
    if (!found) {
      throw this.buildNotFound();
    }
    return found;
  }

  listUserTickets(userId: string): SupportRequestEntity[] {
    return [...this.items]
      .filter((t) => String(t.userId) === String(userId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((t) => this.sanitizeForUser(t));
  }

  getUserTicket(id: string, userId: string): SupportRequestEntity {
    const ticket = this.items.find((t) => t.id === id);
    if (!ticket || String(ticket.userId) !== String(userId)) {
      throw this.buildNotFound();
    }
    return this.sanitizeForUser(ticket);
  }

  assertTicketOpen(
    ticket: SupportRequestEntity,
    attemptedFields: string[],
    actorLabel: string = 'System',
    actorId: string = 'system',
  ): void {
    const canonical = normalizeTicketStatus(ticket.status);
    if (canonical === 'resolved' || canonical === 'rejected') {
      try {
        this.auditService.log({
          action: 'TICKET_CHANGE_REFUSED',
          actor: actorLabel,
          performedBy: actorId,
          target: ticket.subject,
          entityType: 'support_ticket',
          entityId: ticket.id,
          event: `Refused modification of closed ticket "${ticket.subject}"`,
          details: {
            ticketId: ticket.id,
            attemptedFields,
          },
        });
      } catch {}

      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'TICKET_CLOSED',
        message: 'Resolved or rejected tickets are read-only and cannot be modified.',
      });
    }
  }

  addUserReply(id: string, userId: string, body: string): SupportRequestEntity {
    const ticket = this.items.find((t) => t.id === id);
    if (!ticket || String(ticket.userId) !== String(userId)) {
      throw this.buildNotFound();
    }

    const usersRepo = this.getService<UsersRepository>(UsersRepository, 'usersRepository');
    const userRecord = usersRepo?.findById?.(String(userId));
    const actorLabel = userRecord?.name || ticket.userName || ticket.from || 'User';

    this.assertTicketOpen(ticket, ['reply'], actorLabel, String(userId));

    const trimmedBody = String(body || '').trim();
    if (trimmedBody.length < 1 || trimmedBody.length > 2000) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        message: 'Reply body must be between 1 and 2000 characters.',
      });
    }

    const nowIso = this.nowIso();

    const reply: SupportReplyEntity = {
      id: randomUUID(),
      authorId: String(userId),
      authorName: userRecord?.name || ticket.userName || ticket.from || 'User',
      authorRole: 'user',
      body: trimmedBody,
      internal: false,
      createdAt: nowIso,
    };

    const existingReplies = Array.isArray(ticket.replies) ? [...ticket.replies] : [];
    existingReplies.push(reply);

    const updated = super.updateSync(ticket.id, {
      replies: existingReplies,
      updatedAt: nowIso,
    });

    try {
      this.auditService.log({
        action: 'TICKET_REPLY',
        actor: reply.authorName,
        performedBy: String(userId),
        target: ticket.subject,
        entityType: 'support_ticket',
        entityId: ticket.id,
        event: `${reply.authorName} replied to support ticket "${ticket.subject}"`,
        details: { ticketId: ticket.id, replyId: reply.id, internal: false, authorRole: 'user' },
      });
    } catch {}

    return this.sanitizeForUser(updated);
  }

  listAssignableAdmins(): SupportAssigneeOption[] {
    const result: SupportAssigneeOption[] = [];
    const seenIds = new Set<string>();

    const portalAdminsService = this.getService<PortalAdminsService>(
      PortalAdminsService,
      'portalAdminsService',
    );
    if (portalAdminsService) {
      for (const a of portalAdminsService.findAll()) {
        if (String(a.status || 'active').toLowerCase() !== 'active') continue;
        const perms = Array.isArray(a.permissions) ? a.permissions : [];
        if (!perms.includes('*') && !perms.includes('support') && a.portalRole !== 'superuser') {
          continue;
        }
        seenIds.add(String(a.id));
        result.push({
          id: String(a.id),
          name: a.name,
          email: a.email,
          role: a.portalRole === 'superuser' ? 'superuser' : 'admin',
        });
      }
    }

    const usersRepo = this.getService<UsersRepository>(UsersRepository, 'usersRepository');
    if (usersRepo) {
      for (const u of usersRepo.findAll()) {
        const r = normalizeRole(u.role);
        if (r !== 'superuser' && r !== 'admin') continue;
        if (String(u.status || 'Active').toLowerCase() !== 'active') continue;
        const perms = Array.isArray((u as any).permissions) ? (u as any).permissions : [];
        if (r === 'admin' && !perms.includes('*') && !perms.includes('support')) continue;
        if (seenIds.has(String(u.id))) continue;
        seenIds.add(String(u.id));
        result.push({
          id: String(u.id),
          name: u.name,
          email: u.email,
          role: r === 'superuser' ? 'superuser' : 'admin',
        });
      }
    }

    return result;
  }

  private resolveAssigneeName(assigneeId: string): string {
    const options = this.listAssignableAdmins();
    const matched = options.find((a) => String(a.id) === String(assigneeId));
    if (matched) return matched.name;

    const portalAdminsService = this.getService<PortalAdminsService>(
      PortalAdminsService,
      'portalAdminsService',
    );
    const portalAdmin = portalAdminsService?.findAll?.().find((a) => String(a.id) === String(assigneeId));
    if (portalAdmin) return portalAdmin.name;

    const usersRepo = this.getService<UsersRepository>(UsersRepository, 'usersRepository');
    const user = usersRepo?.findById?.(String(assigneeId));
    if (user && ['admin', 'superuser'].includes(normalizeRole(user.role))) {
      return user.name;
    }

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      code: 'INVALID_ASSIGNEE',
      message: 'Selected assignee must be an active admin or Super User.',
    });
  }

  listAdminTickets(filters: {
    status?: string;
    type?: string;
    assignee?: string;
    q?: string;
    page?: number | string;
    limit?: number | string;
  } = {}): {
    items: SupportRequestEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
    let list = [...this.items].map((t) => this.normalizeEntity(t));

    if (filters.status && filters.status !== 'all') {
      const targetStatus = normalizeTicketStatus(filters.status);
      list = list.filter((t) => normalizeTicketStatus(t.status) === targetStatus);
    }
    if (filters.type && filters.type !== 'all') {
      list = list.filter((t) => t.type === filters.type);
    }
    if (filters.assignee && filters.assignee !== 'all') {
      if (filters.assignee === 'unassigned') {
        list = list.filter((t) => !t.assigneeId);
      } else {
        list = list.filter((t) => String(t.assigneeId || '') === String(filters.assignee));
      }
    }
    if (filters.q && String(filters.q).trim()) {
      const q = String(filters.q).trim().toLowerCase();
      list = list.filter(
        (t) =>
          String(t.subject || '').toLowerCase().includes(q) ||
          String(t.message || '').toLowerCase().includes(q) ||
          String(t.from || '').toLowerCase().includes(q) ||
          String(t.userName || '').toLowerCase().includes(q) ||
          String(t.id || '').toLowerCase().includes(q),
      );
    }

    // Newest first (preserve newest creation order across same-ms tests using original index fallback)
    const indexMap = new Map<string, number>();
    this.items.forEach((item, idx) => indexMap.set(item.id, idx));
    list.sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (diff !== 0) return diff;
      return (indexMap.get(b.id) ?? 0) - (indexMap.get(a.id) ?? 0);
    });

    const total = list.length;
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paged = list.slice(start, start + limit).map((t) => this.enrichForAdmin(t));

    return { items: paged, total, page, limit, totalPages };
  }

  getAdminTicket(id: string): SupportRequestEntity {
    const ticket = this.findOne(id);
    return this.enrichForAdmin(ticket);
  }

  updateAdminTicket(
    id: string,
    adminUser: { uid?: string; id?: string; email?: string; name?: string },
    dto: UpdateAdminTicketDto,
  ): SupportRequestEntity {
    const ticket = this.findOne(id);
    const currentStatus = normalizeTicketStatus(ticket.status);
    const nowIso = this.nowIso();
    const actorLabel = adminUser?.name || adminUser?.email || adminUser?.uid || 'Admin';
    const actorId = String(adminUser?.uid || adminUser?.id || 'admin');

    if (currentStatus === 'resolved' || currentStatus === 'rejected') {
      const attemptedFields: string[] = [];
      if (dto.status !== undefined) attemptedFields.push('status');
      if (dto.priority !== undefined) attemptedFields.push('priority');
      if (dto.assigneeId !== undefined) attemptedFields.push('assigneeId');
      if (dto.note !== undefined) attemptedFields.push('note');
      if (attemptedFields.length === 0) {
        attemptedFields.push(...Object.keys(dto));
      }
      if (attemptedFields.length === 0) {
        attemptedFields.push('status');
      }
      this.assertTicketOpen(ticket, attemptedFields, actorLabel, actorId);
    }

    const patch: Partial<SupportRequestEntity> = {
      lastAdminActionAt: nowIso,
      updatedAt: nowIso,
    };

    let statusChanged = false;
    let nextStatus: SupportTicketCanonicalStatus = currentStatus;
    let trimmedResolutionNote: string | undefined = undefined;

    if (dto.status !== undefined) {
      nextStatus = normalizeTicketStatus(dto.status);
      if (nextStatus !== currentStatus) {
        const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(nextStatus)) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: 'INVALID_STATUS_CHANGE',
            message: `Invalid status transition from "${currentStatus}" to "${nextStatus}".`,
          });
        }
        if (nextStatus === 'resolved' || nextStatus === 'rejected') {
          const trimmedNote = String(dto.note || '').trim();
          if (trimmedNote.length < 10 || trimmedNote.length > 500) {
            throw new BadRequestException({
              statusCode: 400,
              error: 'Bad Request',
              code: 'NOTE_REQUIRED',
              message: 'Moving a ticket to resolved or rejected requires a note between 10 and 500 characters.',
            });
          }
          trimmedResolutionNote = trimmedNote;
        }
        statusChanged = true;
      }
    }

    if (dto.priority !== undefined) {
      if (!['low', 'normal', 'high'].includes(dto.priority)) {
        throw new BadRequestException('Priority must be low, normal, or high.');
      }
      patch.priority = dto.priority;
    }

    let assigneeChanged = false;
    let newAssigneeId: string | null = ticket.assigneeId ?? null;
    if (dto.assigneeId !== undefined) {
      const normalizedAssignee =
        dto.assigneeId === null || String(dto.assigneeId).trim() === ''
          ? null
          : String(dto.assigneeId).trim();

      if (normalizedAssignee !== (ticket.assigneeId ?? null)) {
        assigneeChanged = true;
        newAssigneeId = normalizedAssignee;
        patch.assigneeId = normalizedAssignee;
        patch.assigneeName = normalizedAssignee ? this.resolveAssigneeName(normalizedAssignee) : null;
      }
    }

    if (statusChanged) {
      patch.status = nextStatus;
      if (nextStatus === 'resolved' || nextStatus === 'rejected') {
        patch.resolutionNote = trimmedResolutionNote;
        patch.resolvedAt = nowIso;
      }
    }

    const updated = super.updateSync(ticket.id, patch);

    if (statusChanged) {
      try {
        this.auditService.log({
          action: 'TICKET_STATUS_CHANGED',
          actor: actorLabel,
          performedBy: actorId,
          target: updated.subject,
          entityType: 'support_ticket',
          entityId: updated.id,
          event: `${actorLabel} changed ticket "${updated.subject}" status from ${currentStatus} to ${nextStatus}`,
          details: {
            ticketId: updated.id,
            fromStatus: currentStatus,
            toStatus: nextStatus,
            note: patch.resolutionNote,
          },
        });
      } catch {}

      if (!this.isVisitorUserId(updated.userId)) {
        const notificationsService = this.getService<NotificationsService>(
          NotificationsService,
          'notificationsService',
        );
        try {
          notificationsService?.create({
            userId: String(updated.userId),
            type: 'SUPPORT_TICKET_STATUS',
            title: `Support Ticket ${nextStatus === 'resolved' ? 'Resolved' : nextStatus === 'rejected' ? 'Rejected' : 'Updated'}`,
            message: patch.resolutionNote
              ? `Your ticket "${updated.subject}" is now ${nextStatus.replace('_', ' ')}: ${patch.resolutionNote}`
              : `Your support ticket "${updated.subject}" status changed to ${nextStatus.replace('_', ' ')}.`,
            readStatus: false,
            referenceId: updated.id,
            link: `/help?ticket=${encodeURIComponent(updated.id)}`,
          });
        } catch {}
      }
    }

    if (assigneeChanged) {
      try {
        this.auditService.log({
          action: 'TICKET_ASSIGNED',
          actor: actorLabel,
          performedBy: actorId,
          target: updated.subject,
          entityType: 'support_ticket',
          entityId: updated.id,
          event: newAssigneeId
            ? `${actorLabel} assigned ticket "${updated.subject}" to ${updated.assigneeName}`
            : `${actorLabel} unassigned ticket "${updated.subject}"`,
          details: {
            ticketId: updated.id,
            assigneeId: newAssigneeId,
            assigneeName: updated.assigneeName,
          },
        });
      } catch {}

      if (newAssigneeId) {
        const notificationsService = this.getService<NotificationsService>(
          NotificationsService,
          'notificationsService',
        );
        try {
          notificationsService?.create({
            userId: newAssigneeId,
            type: 'SUPPORT_TICKET_ASSIGNED',
            title: 'Support Ticket Assigned to You',
            message: `Support ticket "${updated.subject}" (${updated.priority} priority) was assigned to you.`,
            readStatus: false,
            referenceId: updated.id,
            link: `/admin/support?ticket=${encodeURIComponent(updated.id)}`,
          });
        } catch {}
      }
    }

    return this.enrichForAdmin(updated);
  }

  addAdminReply(
    id: string,
    adminUser: { uid?: string; id?: string; email?: string; name?: string },
    dto: { body: string; internal?: boolean },
  ): SupportRequestEntity {
    const ticket = this.findOne(id);
    const authorId = String(adminUser?.uid || adminUser?.id || 'admin');
    const authorName = adminUser?.name || adminUser?.email || 'Support Admin';

    this.assertTicketOpen(ticket, [dto?.internal ? 'internal_note' : 'reply'], authorName, authorId);

    const trimmedBody = String(dto?.body || '').trim();
    if (trimmedBody.length < 1 || trimmedBody.length > 2000) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        message: 'Reply body must be between 1 and 2000 characters.',
      });
    }

    const nowIso = this.nowIso();
    const isInternal = Boolean(dto?.internal);

    const reply: SupportReplyEntity = {
      id: randomUUID(),
      authorId,
      authorName,
      authorRole: 'admin',
      body: trimmedBody,
      internal: isInternal,
      createdAt: nowIso,
    };

    const existingReplies = Array.isArray(ticket.replies) ? [...ticket.replies] : [];
    existingReplies.push(reply);

    const updated = super.updateSync(ticket.id, {
      replies: existingReplies,
      lastAdminActionAt: nowIso,
      updatedAt: nowIso,
    });

    try {
      this.auditService.log({
        action: 'TICKET_REPLY',
        actor: authorName,
        performedBy: authorId,
        target: ticket.subject,
        entityType: 'support_ticket',
        entityId: ticket.id,
        event: isInternal
          ? `${authorName} added an internal note to support ticket "${ticket.subject}"`
          : `${authorName} replied to support ticket "${ticket.subject}"`,
        details: { ticketId: ticket.id, replyId: reply.id, internal: isInternal, authorRole: 'admin' },
      });
    } catch {}

    if (!isInternal && !this.isVisitorUserId(updated.userId)) {
      const notificationsService = this.getService<NotificationsService>(
        NotificationsService,
        'notificationsService',
      );
      try {
        notificationsService?.create({
          userId: String(updated.userId),
          type: 'SUPPORT_TICKET_REPLY',
          title: 'New Reply on Support Ticket',
          message: `Support replied to your ticket "${updated.subject}": ${trimmedBody.slice(0, 140)}`,
          readStatus: false,
          referenceId: updated.id,
          link: `/help?ticket=${encodeURIComponent(updated.id)}`,
        });
      } catch {}
    }

    return this.enrichForAdmin(updated);
  }

  closeProjectFromTicket(
    id: string,
    adminUser: { uid?: string; id?: string; email?: string; name?: string },
    dto: CloseProjectTicketDto,
  ): { ticket: SupportRequestEntity; project: any } {
    const ticket = this.normalizeEntity(this.findOne(id));
    const actorLabel = adminUser?.email || adminUser?.name || adminUser?.uid || 'Admin';
    const actorId = String(adminUser?.uid || adminUser?.id || 'admin');

    this.assertTicketOpen(ticket, ['close-project'], actorLabel, actorId);

    const projectId = String(ticket.projectId || ticket.metadata?.projectId || '');

    if (ticket.type !== 'project_closure' || !projectId) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_NOT_CLOSABLE',
        message: 'Only project closure request tickets linked to a project can close a project.',
      });
    }

    const trimmedReason = String(dto?.reason || '').trim();
    if (trimmedReason.length < 10 || trimmedReason.length > 500) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'NOTE_REQUIRED',
        message: 'Closing a project from a ticket requires a reason between 10 and 500 characters.',
      });
    }

    const projectsRepo = this.getService<ProjectsRepository>(ProjectsRepository, 'projectsRepository');
    const projectsService = this.getService<ProjectsService>(ProjectsService, 'projectsService');
    const project = projectsRepo?.findById?.(projectId);

    if (
      !project ||
      project.deletedAt ||
      project.isCompleted ||
      ['closed', 'completed', 'cancelled'].includes(String(project.status || '').toLowerCase())
    ) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_NOT_CLOSABLE',
        message: 'Project is already closed, completed, or deleted and cannot be closed.',
      });
    }

    if (!projectsService) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_NOT_CLOSABLE',
        message: 'Project service is unavailable.',
      });
    }

    const closedProject = projectsService.closeProject(projectId, 'Owner inactive', actorLabel);

    const nowIso = this.nowIso();
    const resolvedTicket = super.updateSync(ticket.id, {
      status: 'resolved',
      resolutionNote: trimmedReason,
      resolvedAt: nowIso,
      lastAdminActionAt: nowIso,
      updatedAt: nowIso,
    });

    try {
      this.auditService.log({
        action: 'PROJECT_CLOSED_FROM_TICKET',
        actor: actorLabel,
        performedBy: actorId,
        target: project.title || project.name || projectId,
        entityType: 'support_ticket',
        entityId: ticket.id,
        event: `${actorLabel} closed project "${project.title || project.name || projectId}" ("Owner inactive") from support ticket ${ticket.id}`,
        details: {
          ticketId: ticket.id,
          projectId,
          closedReason: 'Owner inactive',
          reason: trimmedReason,
        },
      });
    } catch {}

    return {
      ticket: this.enrichForAdmin(resolvedTicket),
      project: closedProject,
    };
  }

  /**
   * Backwards-compatible status update handler (also used by Phase 12 closeProject cleanup).
   */
  updateStatus(id: string, updateSupportStatusDto: UpdateSupportStatusDto): SupportRequestEntity {
    const ticket = this.findOne(id);
    const attemptedFields: string[] = ['status'];
    if (updateSupportStatusDto.note) attemptedFields.push('note');
    this.assertTicketOpen(ticket, attemptedFields, 'System', 'system');

    const rawTarget = String(updateSupportStatusDto.status || '');
    const normalizedTarget = normalizeTicketStatus(rawTarget);
    const allowedTargets: SupportTicketCanonicalStatus[] = [
      'open',
      'in_progress',
      'waiting_user',
      'resolved',
      'rejected',
    ];
    if (!allowedTargets.includes(normalizedTarget)) {
      throw new BadRequestException('Invalid status value');
    }

    const nowIso = this.nowIso();
    return super.updateSync(ticket.id, {
      status: normalizedTarget,
      ...(updateSupportStatusDto.note ? { resolutionNote: String(updateSupportStatusDto.note).trim() } : {}),
      ...(normalizedTarget === 'resolved' || normalizedTarget === 'rejected' ? { resolvedAt: nowIso } : {}),
      updatedAt: nowIso,
    });
  }

  /**
   * Phase 27 Hourly Job: notify Super Users once for any ticket untouched by an admin for 7 days.
   */
  notifyUntouchedTicketsToSuperUser(): { notifiedTicketIds: string[] } {
    const now = this.now();
    const nowMs = now.getTime();
    const nowIso = now.toISOString();
    const notifiedTicketIds: string[] = [];
    const groupedItems: NotificationGroupedItem[] = [];

    for (const rawTicket of this.items) {
      const status = normalizeTicketStatus(rawTicket.status);
      if (status === 'resolved' || status === 'rejected') continue;
      if (rawTicket.lastAdminActionAt || rawTicket.untouchedReminderSentAt) continue;

      const createdMs = new Date(rawTicket.createdAt || 0).getTime();
      if (isNaN(createdMs) || createdMs <= 0) continue;
      if (nowMs - createdMs < SEVEN_DAYS_MS) continue;

      rawTicket.untouchedReminderSentAt = nowIso;
      notifiedTicketIds.push(rawTicket.id);
      groupedItems.push({
        label: rawTicket.subject || rawTicket.id,
        link: `/admin/support?ticket=${encodeURIComponent(rawTicket.id)}`,
      });
    }

    if (groupedItems.length === 0) {
      return { notifiedTicketIds: [] };
    }

    const notificationsService = this.getService<NotificationsService>(
      NotificationsService,
      'notificationsService',
    );
    const usersRepo = this.getService<UsersRepository>(UsersRepository, 'usersRepository');
    const superUsers = (usersRepo?.findAll?.() || []).filter(
      (u) => normalizeRole(u.role) === 'superuser' && String(u.status || 'Active').toLowerCase() === 'active',
    );
    const recipients = superUsers.length > 0 ? superUsers.map((u) => String(u.id)) : ['superuser'];

    const runKey = nowIso.slice(0, 13);
    for (const suId of recipients) {
      try {
        dispatchGroupedNotification(
          notificationsService,
          suId,
          `support_ticket_untouched:${runKey}`,
          groupedItems,
          (items, count) => ({
            type: 'SUPPORT_TICKET_OVERDUE',
            priority: 'immediate',
            title:
              count === 1
                ? 'Support Ticket Untouched for 7 Days'
                : `${count} Support Tickets Untouched for 7 Days`,
            message:
              count === 1
                ? `Support ticket "${items[0].label}" has had no admin response for 7+ days.`
                : `${count} support tickets have had no admin response for 7+ days: ${formatGroupedItemList(items, 10)}`,
            readStatus: false,
            referenceId: notifiedTicketIds[0],
            link: items[0]?.link || '/admin/support',
            metadata: { ticketIds: notifiedTicketIds },
          }),
        );
      } catch {}
    }

    return { notifiedTicketIds };
  }

  findByUser(userId: string): SupportRequestEntity[] {
    return this.items.filter((ticket: SupportRequestEntity) => ticket.userId === userId);
  }

  findByStatus(status: SupportRequestStatus): SupportRequestEntity[] {
    const target = normalizeTicketStatus(status);
    return this.items.filter(
      (ticket: SupportRequestEntity) => normalizeTicketStatus(ticket.status) === target,
    );
  }

  findByProject(projectId: string): SupportRequestEntity[] {
    return this.items.filter(
      (ticket: SupportRequestEntity) =>
        String(ticket.projectId || ticket.metadata?.projectId || '') === String(projectId),
    );
  }
}
