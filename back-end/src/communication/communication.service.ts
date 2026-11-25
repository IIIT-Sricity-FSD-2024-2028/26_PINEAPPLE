import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef, Optional } from '@nestjs/common';
import { CommunicationRepository, Message } from './communication.repository';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ProjectsRepository } from '../projects/projects.repository';
import { ProjectsService } from '../projects/projects.service';
import { ClockService } from '../common/services/clock.service';
import { getProjectRole, isPlatformAdminOrSuperUser } from '../common/utils/role.util';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Notification } from '../notifications/notification.entity';

import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { ReportsService } from '../moderation/reports.service';

@Injectable()
export class CommunicationService {
  constructor(
    private readonly communicationRepository: CommunicationRepository,
    @Inject(forwardRef(() => ProjectsRepository))
    private readonly projectsRepository: any,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    @Optional()
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService?: ProjectsService,
    @Optional()
    private readonly clockService?: ClockService,
    @Optional()
    @Inject(forwardRef(() => MentorMarketplaceService))
    private readonly mentorMarketplaceService?: MentorMarketplaceService,
    @Optional()
    private readonly contentFilterService?: ContentFilterService,
    @Optional()
    @Inject(forwardRef(() => ReportsService))
    private readonly reportsService?: ReportsService,
  ) {}

  private assertChatMembership(projectId: string, caller?: any, denyAction: 'post in' | 'access' = 'access') {
    const project = this.projectsRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    const isAdmin = isPlatformAdminOrSuperUser(caller);
    const callerId = typeof caller === 'string'
      ? caller.trim()
      : String(caller?.uid || caller?.id || caller?.userId || '').trim();
    const projectRole = getProjectRole(project, caller || callerId);
    const isAllowed = isAdmin || (projectRole && projectRole !== 'Former member');

    if (!isAllowed) {
      try {
        this.auditService.log({
          action: 'CHAT_ACCESS_DENIED',
          actor: callerId || 'anonymous',
          target: `Project #${projectId}`,
          entityType: 'project',
          entityId: projectId,
          event: `Chat access denied for user ${callerId} on project ${projectId}`,
          details: { userId: callerId, projectId },
        });
      } catch (err: any) {
        console.warn('[communication.service] Audit log failed:', err?.message || err);
      }

      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'CHAT_MEMBERSHIP_REQUIRED',
        message: `You must be a project member (Owner, Mentor, or Collaborator) or an Admin to ${denyAction} project chat.`,
      });
    }

    return { project, isAdmin, projectRole, callerId };
  }

  sendMessage(senderId: string, dto: SendMessageDto, callerUser?: any): Message {
    const userForCheck = callerUser || senderId;
    const { project, isAdmin, projectRole } = this.assertChatMembership(dto.projectId, userForCheck, 'post in');

    const effectiveRole = projectRole || (isAdmin ? 'Admin' : 'Collaborator');
    const nowDate = this.clockService ? this.clockService.now() : new Date();
    const rawContent = String(dto.content || dto.text || '');
    const isFlagged = Boolean(this.contentFilterService?.containsBlockedContent(rawContent));

    const msg = this.communicationRepository.sendMessage(
      senderId,
      dto,
      effectiveRole,
      nowDate,
      isFlagged ? { flaggedForAdmin: true, flagReason: 'Automated content filter match' } : undefined,
    );

    if (isFlagged) {
      try {
        this.auditService.log({
          action: 'chat-message-flagged',
          actor: String(senderId),
          target: `Message #${msg.id}`,
          entityType: 'message',
          entityId: msg.id,
          event: `Flagged chat message in project ${dto.projectId} for admin review`,
          details: { field: 'content', projectId: String(dto.projectId), messageId: msg.id },
        });
      } catch {}
    }

    if (projectRole === 'Mentor' || String((project as any).mentorId || '') === String(senderId)) {
      const activityAt = nowDate.toISOString();
      this.mentorMarketplaceService?.recordMentorActivity?.(
        dto.projectId,
        String(senderId),
        'chat_message',
        activityAt,
      );
    }

    if (this.projectsService && typeof this.projectsService.recordMemberActivity === 'function') {
      try {
        this.projectsService.recordMemberActivity(dto.projectId, senderId, nowDate.toISOString());
      } catch {}
    }

    return msg;
  }

  reportMessage(messageId: string, reporterId: string, reason: string, callerUser?: any) {
    const msg = this.communicationRepository.findMessageById(messageId);
    if (!msg) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'MESSAGE_NOT_FOUND',
        message: `Chat message with ID ${messageId} not found.`,
      });
    }

    const userForCheck = callerUser || reporterId;
    const { project } = this.assertChatMembership(String(msg.projectId), userForCheck, 'access');

    if (!this.reportsService) {
      throw new NotFoundException('Reports service unavailable.');
    }

    const snapshot = this.communicationRepository.getMessageContextSnapshot(
      String(msg.projectId),
      String(msg.id),
      20,
    );
    const authorRole = getProjectRole(project, String(msg.senderId)) || msg.role || undefined;

    return this.reportsService.createChatReport(String(reporterId), {
      projectId: String(msg.projectId),
      message: {
        id: String(msg.id),
        senderId: String(msg.senderId),
        senderName: String(msg.senderName || 'Unknown user'),
        role: authorRole || undefined,
        content: String(msg.content || msg.text || ''),
        timestamp: msg.timestamp,
      },
      messageSnapshot: snapshot,
      reason,
    });
  }

  getMessagesByProjectId(projectId: string, caller?: any): Message[] {
    this.assertChatMembership(projectId, caller, 'access');
    return this.communicationRepository.getMessagesByProjectId(projectId);
  }

  markProjectRead(projectId: string, caller?: any): { projectId: string; userId: string; lastReadAt: string } {
    const { callerId } = this.assertChatMembership(projectId, caller, 'access');
    const effectiveUserId = callerId || (typeof caller === 'string' ? caller : String(caller?.uid || caller?.id || ''));
    const nowMs = this.clockService ? this.clockService.now().getTime() : Date.now();
    const msgs = this.communicationRepository.getMessagesByProjectId(projectId);
    const latestMsgMs = msgs.reduce((maxMs, m) => {
      const t = new Date(m.timestamp).getTime();
      return Number.isNaN(t) ? maxMs : Math.max(maxMs, t);
    }, 0);
    const readIso = new Date(Math.max(nowMs, latestMsgMs)).toISOString();
    this.communicationRepository.setLastReadAt(effectiveUserId, projectId, readIso);
    return {
      projectId: String(projectId),
      userId: String(effectiveUserId),
      lastReadAt: readIso,
    };
  }

  getUnreadSummary(caller?: any): {
    total: number;
    byProject: Array<{ projectId: string; projectTitle: string; unreadCount: number; lastReadAt: string | null }>;
  } {
    const callerId = typeof caller === 'string'
      ? caller.trim()
      : String(caller?.uid || caller?.id || caller?.userId || '').trim();
    if (!callerId) {
      return { total: 0, byProject: [] };
    }

    const allProjects: any[] = typeof this.projectsRepository?.findAll === 'function'
      ? this.projectsRepository.findAll()
      : [];

    const byProject: Array<{ projectId: string; projectTitle: string; unreadCount: number; lastReadAt: string | null }> = [];
    let total = 0;

    for (const proj of allProjects) {
      if (!proj) continue;
      const role = getProjectRole(proj, caller || callerId);
      if (!role || role === 'Former member') continue;

      const messages = this.communicationRepository.getMessagesByProjectId(String(proj.id));
      const lastReadAt = this.communicationRepository.getLastReadAt(callerId, String(proj.id)) || null;
      const lastReadMs = lastReadAt ? new Date(lastReadAt).getTime() : null;

      const unreadCount = messages.filter((m) => {
        if (String(m.senderId) === callerId) return false;
        if (lastReadMs === null || Number.isNaN(lastReadMs)) return true;
        return new Date(m.timestamp).getTime() > lastReadMs;
      }).length;

      total += unreadCount;
      byProject.push({
        projectId: String(proj.id),
        projectTitle: proj.title || proj.name || String(proj.id),
        unreadCount,
        lastReadAt,
      });
    }

    byProject.sort((a, b) => b.unreadCount - a.unreadCount);
    return { total, byProject };
  }

  createNotification(dto: CreateNotificationDto): Notification {
    return this.notificationsService.create(dto as any);
  }

  getNotificationsByUserId(userId: string): Notification[] {
    return this.notificationsService.findByUser(userId);
  }

  markNotificationAsRead(notificationId: string): Notification {
    const notif = this.notificationsService.markAsRead(notificationId);
    if (!notif) {
      throw new NotFoundException(`Notification with ID ${notificationId} not found.`);
    }
    return notif;
  }
}
