import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Notification } from './notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { ClockService } from '../common/services/clock.service';
import { AuditService } from '../audit/audit.service';

export interface NotificationGroupedItem {
  label: string;
  link?: string;
}

export function formatGroupedItemList(
  items: NotificationGroupedItem[],
  maxVisible = 10,
): string {
  const safe = Array.isArray(items) ? items : [];
  const visible = safe.slice(0, maxVisible).map((i) => i.label);
  const remaining = safe.length - visible.length;
  return remaining > 0
    ? `${visible.join(', ')}, and ${remaining} more`
    : visible.join(', ');
}

export function dispatchGroupedNotification(
  notificationsService: any,
  userId: string,
  groupKey: string,
  items: NotificationGroupedItem[],
  builder: (
    items: NotificationGroupedItem[],
    count: number,
  ) => Partial<CreateNotificationDto>,
): Notification | null {
  if (!notificationsService || !userId || !Array.isArray(items) || items.length === 0) {
    return null;
  }
  if (typeof notificationsService.sendGrouped === 'function') {
    return notificationsService.sendGrouped(userId, groupKey, items, builder);
  }
  const normalizedItems = items.map((item) => ({
    label: String(item?.label || '').trim(),
    ...(item?.link ? { link: String(item.link) } : {}),
  }));
  const count = normalizedItems.length;
  const built = builder(normalizedItems, count);
  return notificationsService.create({
    ...built,
    userId: String(userId),
    readStatus: built.readStatus ?? false,
    groupKey,
    count,
    items: normalizedItems,
    metadata: {
      ...(built.metadata || {}),
      groupKey,
      count,
      items: normalizedItems,
    },
  });
}

@Injectable()
export class NotificationsService {
  private static readonly MAX_NOTIFICATIONS = 5000;
  private notifications: Notification[] = [];
  private notificationsById = new Map<string, Notification>();
  private notificationsByUserId = new Map<string, Notification[]>();
  private nextId = 100;

  constructor(
    @Optional() private readonly clockService?: ClockService,
    @Optional()
    @Inject(AuditService)
    private readonly auditService?: AuditService,
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {
    this.initSeeds();
  }

  private getAuditService(): AuditService | undefined {
    if (this.auditService) return this.auditService;
    try {
      return this.moduleRef?.get(AuditService, { strict: false });
    } catch {
      return undefined;
    }
  }

  private initSeeds(): void {
    const now = new Date('2025-01-15T10:00:00.000Z').getTime();
    this.notifications = [
      {
        id: 'notif-1',
        userId: '2', // Arjun Sharma
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned',
        message: 'You have been assigned to "Implement Authentication".',
        readStatus: false,
        createdAt: new Date(now - 1000 * 60 * 60),
      },
      {
        id: 'notif-2',
        userId: '1', // Priya Patel
        type: 'PROJECT_UPDATE',
        title: 'Project Update',
        message: 'Arjun completed the "Design Database Schema" task.',
        readStatus: true,
        createdAt: new Date(now - 1000 * 60 * 30),
      },
      {
        id: 'notif-4',
        userId: '7', // Neha Gupta
        type: 'TASK_IN_PROGRESS',
        title: 'Task In Progress',
        message: 'You started working on "Train ML Model".',
        readStatus: true,
        createdAt: new Date(now - 1000 * 60 * 15),
      },
    ];
    this.rebuildIndexes();
  }

  private static readonly DEFAULT_TITLES: Record<string, string> = {
    PROJECT_MEMBERSHIP_ENDED: 'Project Membership Ended',
    PROJECT_COMPLETED: 'Project Completed',
    PROJECT_UPDATE: 'Project Update',
    APPLICATION_APPROVED: 'Application Approved',
    TASK_APPROVED: 'Submission Approved',
    TASK_ASSIGNED: 'Task Assigned',
    MENTOR_REQUEST: 'Mentor Request',
    MENTOR_SESSION_BOOKED: 'Mentor Booking Confirmed',
    MENTOR_SESSION_STARTED: 'Mentor Session Started',
    MENTOR_SESSION_ACCEPTED: 'Mentor Request Accepted',
    MENTOR_SESSION_DECLINED: 'Mentor Request Declined',
    MENTOR_SESSION_COMPLETED: 'Mentor Session Completed',
    MENTOR_SESSION_CANCELLED: 'Mentor Session Cancelled',
    NEW_MESSAGE: 'New Message',
    PROJECT_PAUSED: 'Pending Applications Require Decision',
    REQUEST_TIMEOUT: 'Join Request Closed',
    OWNER_INACTIVE: 'Project Owner Inactive',
    OWNER_INACTIVE_30D: 'Owner Inactive — Closure Option Available',
    MEMBER_INACTIVE: 'Inactivity Notice',
    TASKS_RELEASED: 'Tasks Released',
    PROJECT_CLOSE_REQUEST: 'Project Close Requested',
    TASK_REJECTED: 'Task Revision Requested',
    TASK_REVIEW_REMINDER: 'Task Review Needed',
    TASK_AUTO_APPROVED: 'Task Auto-Approved',
    TASK_UNASSIGNED: 'Collaborator Dropped Task',
    MENTOR_ABANDONMENT_REVIEW_OPENED: 'Mentor Abandonment Review Opened',
    MENTOR_REVIEW_CONFIRMED: 'Mentor Confirmed Activity',
    MENTOR_REVIEW_CANCELLED: 'Mentor Abandonment Review Cancelled',
    MENTOR_ABANDONMENT_RELEASED: 'Mentor Unassigned Due to Inactivity',
    MENTOR_FIRST_WEEK_INACTIVE: 'Mentor First-Week Activity Reminder',
    MENTOR_INACTIVE_7D: 'Mentor Inactivity Notice',
    PROJECT_INVITE: 'Project Collaboration Invite',
    INVITE_ACCEPTED: 'Project Invite Accepted',
    INVITE_DECLINED: 'Project Invite Declined',
  };

  private indexNotification(n: Notification): void {
    if (!n) return;
    this.notificationsById.set(String(n.id), n);
    const uid = String(n.userId).trim().toLowerCase();
    if (!this.notificationsByUserId.has(uid)) {
      this.notificationsByUserId.set(uid, []);
    }
    const list = this.notificationsByUserId.get(uid)!;
    const existingIdx = list.findIndex((item) => item.id === n.id);
    if (existingIdx !== -1) {
      list[existingIdx] = n;
    } else {
      list.push(n);
    }
  }

  private rebuildIndexes(): void {
    this.notificationsById.clear();
    this.notificationsByUserId.clear();
    for (const n of this.notifications) {
      this.indexNotification(n);
    }
  }

  create(createNotificationDto: CreateNotificationDto): Notification {
    const rawType = createNotificationDto.type || 'NOTIFICATION';
    const computedTitle =
      createNotificationDto.title ||
      NotificationsService.DEFAULT_TITLES[rawType] ||
      rawType.replace(/_/g, ' ');

    const nowDate = this.clockService ? this.clockService.now() : new Date();

    const resolvedGroupKey =
      createNotificationDto.groupKey || createNotificationDto.metadata?.groupKey;
    const resolvedItems = Array.isArray(createNotificationDto.items)
      ? createNotificationDto.items
      : Array.isArray(createNotificationDto.metadata?.items)
        ? createNotificationDto.metadata.items
        : undefined;
    const resolvedCount =
      createNotificationDto.count ??
      createNotificationDto.metadata?.count ??
      (resolvedItems ? resolvedItems.length : undefined);

    const notification: Notification = {
      id: this.generateId(),
      userId: String(createNotificationDto.userId),
      type: rawType,
      title: computedTitle,
      message: createNotificationDto.message,
      readStatus: createNotificationDto.readStatus ?? false,
      createdAt: nowDate,
      referenceId: createNotificationDto.referenceId,
      link: createNotificationDto.link || (createNotificationDto.referenceId ? `/projects/${createNotificationDto.referenceId}` : undefined),
      metadata: createNotificationDto.metadata,
      ...(resolvedGroupKey ? { groupKey: resolvedGroupKey } : {}),
      ...(resolvedCount !== undefined ? { count: resolvedCount } : {}),
      ...(resolvedItems ? { items: resolvedItems } : {}),
      ...(createNotificationDto.suggestedProjects ? { suggestedProjects: createNotificationDto.suggestedProjects } : {}),
    };

    this.notifications.push(notification);
    if (this.notifications.length > NotificationsService.MAX_NOTIFICATIONS) {
      this.notifications.shift();
    }
    this.indexNotification(notification);
    return notification;
  }

  /**
   * Phase 26: Aggregate a batch of items for one affected recipient into a single notification
   * carrying `count`, `groupKey`, and `items` (`{ label, link }[]`) while preserving original notification type names.
   */
  sendGrouped(
    userId: string,
    groupKey: string,
    items: NotificationGroupedItem[],
    builder: (
      items: NotificationGroupedItem[],
      count: number,
    ) => Partial<CreateNotificationDto>,
  ): Notification | null {
    if (!userId || !Array.isArray(items) || items.length === 0) {
      return null;
    }
    const normalizedItems: NotificationGroupedItem[] = items.map((item) => ({
      label: String(item?.label || '').trim(),
      ...(item?.link ? { link: String(item.link) } : {}),
    }));
    const count = normalizedItems.length;
    const built = builder(normalizedItems, count);
    return this.create({
      ...built,
      userId: String(userId),
      type: built.type || 'PROJECT_UPDATE',
      message: built.message || formatGroupedItemList(normalizedItems, 10),
      readStatus: built.readStatus ?? false,
      groupKey,
      count,
      items: normalizedItems,
      metadata: {
        ...(built.metadata || {}),
        groupKey,
        count,
        items: normalizedItems,
      },
    });
  }

  findAll(limit?: number, offset?: number): Notification[] {
    const sorted = [...this.notifications]
      .reverse()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (limit !== undefined && limit > 0) {
      const start = offset || 0;
      return sorted.slice(start, start + limit);
    }
    return sorted;
  }

  private buildNotFoundError(): NotFoundException {
    return new NotFoundException({
      statusCode: 404,
      error: 'Not Found',
      code: 'NOTIFICATION_NOT_FOUND',
      message: 'Notification not found.',
    });
  }

  private assertOwnedIfCallerProvided(notification: Notification, callerUserId?: string): void {
    if (callerUserId === undefined) return;
    if (String(notification.userId).trim().toLowerCase() !== String(callerUserId).trim().toLowerCase()) {
      try {
        this.getAuditService()?.log({
          action: 'ACCESS_DENIED_NOTIFICATION',
          actor: String(callerUserId),
          target: notification.id,
          entityType: 'notification',
          entityId: notification.id,
          performedBy: String(callerUserId),
          event: `Unauthorized access attempt on notification ${notification.id}`,
          details: {
            userId: String(callerUserId),
            notificationId: notification.id,
            ownerId: notification.userId,
          },
        });
      } catch {
        // Non-critical audit write
      }
      throw this.buildNotFoundError();
    }
  }

  findOne(id: string, callerUserId?: string): Notification {
    const fromMap = this.notificationsById.get(String(id));
    if (fromMap) {
      this.assertOwnedIfCallerProvided(fromMap, callerUserId);
      return fromMap;
    }
    const notification = this.notifications.find((n: Notification) => n.id === id);
    if (!notification) {
      throw this.buildNotFoundError();
    }
    this.assertOwnedIfCallerProvided(notification, callerUserId);
    return notification;
  }

  findByUser(userId: string, limit?: number, offset?: number): Notification[] {
    const target = String(userId).trim().toLowerCase();
    const list = this.notificationsByUserId.get(target);
    const base = (list ? [...list] : this.notifications.filter((n: Notification) => String(n.userId).trim().toLowerCase() === target)).reverse();
    base.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (limit !== undefined && limit > 0) {
      const start = offset || 0;
      return base.slice(start, start + limit);
    }
    return base;
  }

  findByUserId(userId: string, limit?: number, offset?: number): Notification[] {
    return this.findByUser(userId, limit, offset);
  }

  update(id: string, updateNotificationDto: UpdateNotificationDto, callerUserId?: string): Notification {
    const notificationIndex = this.notifications.findIndex(n => n.id === id);
    if (notificationIndex === -1) {
      throw this.buildNotFoundError();
    }
    this.assertOwnedIfCallerProvided(this.notifications[notificationIndex], callerUserId);

    const updatedNotification = {
      ...this.notifications[notificationIndex],
      ...updateNotificationDto,
    };

    this.notifications[notificationIndex] = updatedNotification;
    this.indexNotification(updatedNotification);
    return updatedNotification;
  }

  markAsRead(id: string, callerUserId?: string): Notification {
    return this.update(id, { readStatus: true }, callerUserId);
  }

  getUnreadCount(userId?: string): { count: number; unreadCount: number } {
    if (!userId) {
      return { count: 0, unreadCount: 0 };
    }
    const target = String(userId).trim().toLowerCase();
    const list = this.notificationsByUserId.get(target);
    const userNotifs = list ? list : this.notifications.filter((n: Notification) => String(n.userId).trim().toLowerCase() === target);
    const unread = userNotifs.filter((n: Notification) => !n.readStatus).length;
    return { count: unread, unreadCount: unread };
  }

  markAllAsRead(userId?: string): { updated: number; unread: number } {
    const target = userId ? String(userId).trim().toLowerCase() : null;
    const toUpdate = target
      ? this.notifications.filter((n: Notification) => String(n.userId).trim().toLowerCase() === target)
      : this.notifications;
    const unreadCount = toUpdate.filter((n: Notification) => !n.readStatus).length;
    toUpdate.forEach((n: Notification) => {
      n.readStatus = true;
      this.indexNotification(n);
    });
    return { updated: unreadCount, unread: 0 };
  }

  remove(id: string, callerUserId?: string): void {
    const notificationIndex = this.notifications.findIndex(n => n.id === id);
    if (notificationIndex === -1) {
      throw this.buildNotFoundError();
    }
    this.assertOwnedIfCallerProvided(this.notifications[notificationIndex], callerUserId);
    this.notifications.splice(notificationIndex, 1);
    this.rebuildIndexes();
  }

  private generateId(): string {
    return `notif-${this.nextId++}`;
  }

  resetToSeed(): void {
    this.notifications = [];
    this.notificationsById.clear();
    this.notificationsByUserId.clear();
    this.nextId = 100;
    this.initSeeds();
  }

  reset(): void {
    if (process.env.NODE_ENV !== 'test' && !process.env.ALLOW_STORE_RESET) return;
    this.resetToSeed();
  }
}
