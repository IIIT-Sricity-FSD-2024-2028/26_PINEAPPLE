import { Injectable, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ClockService } from '../common/services/clock.service';
import { UsersRepository } from '../users/users.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { Notification } from './notification.entity';
import type { NotificationsService } from './notifications.service';
import {
  MAX_DIGEST_ITEMS,
  resolveNotificationPriority,
} from './notification-priority.config';

export interface DigestBufferedItem {
  id: string;
  userId: string;
  type: string;
  title?: string;
  message: string;
  referenceId?: string;
  link?: string;
  targetTitle?: string;
  metadata?: Record<string, any>;
  suggestedProjects?: any[];
  count?: number;
  groupKey?: string;
  items?: Array<{ label: string; link?: string }>;
  createdAt: string;
}

export interface DigestSummaryLine {
  key: string;
  type: string;
  referenceId?: string;
  targetTitle?: string;
  link?: string;
  count: number;
  summary: string;
  latestAt: string;
}

@Injectable()
export class DigestService {
  private buffer = new Map<string, DigestBufferedItem[]>();
  private lastFlushLocalDateByUser = new Map<string, string>();

  private explicitNotificationsService?: NotificationsService;

  constructor(
    @Optional() private readonly clockService?: ClockService,
    @Optional() private readonly usersRepository?: UsersRepository,
    @Optional() private readonly moduleRef?: ModuleRef,
    @Optional() private readonly projectsRepository?: ProjectsRepository,
  ) {}

  registerNotificationsService(svc: NotificationsService): void {
    this.explicitNotificationsService = svc;
  }

  setNotificationsServiceForTest(svc: NotificationsService): void {
    this.explicitNotificationsService = svc;
  }

  private getNotificationsService(): NotificationsService | undefined {
    return this.explicitNotificationsService;
  }

  private now(): Date {
    return this.clockService ? this.clockService.now() : new Date();
  }

  private getProjectsRepository(): ProjectsRepository | undefined {
    if (this.projectsRepository) return this.projectsRepository;
    try {
      return this.moduleRef?.get(ProjectsRepository, { strict: false });
    } catch {
      return undefined;
    }
  }

  getUserSchedule(userId: string): {
    digestEnabled: boolean;
    digestHour: number;
    utcOffsetMinutes: number;
  } {
    const user: any = this.usersRepository?.findById(String(userId));
    return {
      digestEnabled: user ? user.digestEnabled !== false : false,
      digestHour:
        user && Number.isInteger(user.digestHour) && user.digestHour >= 0 && user.digestHour <= 23
          ? user.digestHour
          : 9,
      utcOffsetMinutes:
        user && Number.isInteger(user.utcOffsetMinutes)
          ? user.utcOffsetMinutes
          : 0,
    };
  }

  shouldBuffer(notification: Notification): boolean {
    if (!notification || !notification.userId) return false;
    if (String(notification.type || '').toUpperCase() === 'DAILY_DIGEST') return false;

    const nowMs = this.now().getTime();
    const priority = resolveNotificationPriority(notification, nowMs);
    if (priority === 'immediate') {
      return false;
    }

    const user: any = this.usersRepository?.findById(String(notification.userId));
    if (!user || user.isDeleted || user.deletedAt) {
      return false;
    }

    return user.digestEnabled !== false;
  }

  enqueue(notification: Notification): DigestBufferedItem {
    const uid = String(notification.userId);
    const projectsRepo = this.getProjectsRepository();
    const refProject =
      notification.referenceId && projectsRepo
        ? projectsRepo.findById(String(notification.referenceId))
        : undefined;

    const targetTitle =
      notification.metadata?.projectTitle ||
      notification.metadata?.targetTitle ||
      refProject?.title ||
      (refProject as any)?.name ||
      undefined;

    const item: DigestBufferedItem = {
      id: notification.id,
      userId: uid,
      type: String(notification.type || 'PROJECT_UPDATE'),
      title: notification.title,
      message: notification.message,
      referenceId: notification.referenceId,
      link: notification.link,
      targetTitle,
      metadata: notification.metadata,
      suggestedProjects: notification.suggestedProjects,
      count: notification.count ?? notification.metadata?.count,
      groupKey: notification.groupKey ?? notification.metadata?.groupKey,
      items: notification.items ?? notification.metadata?.items,
      createdAt: new Date(notification.createdAt || this.now()).toISOString(),
    };

    const existing = this.buffer.get(uid) || [];
    existing.push(item);
    this.buffer.set(uid, existing);
    return item;
  }

  getBufferForUser(userId: string): DigestBufferedItem[] {
    return [...(this.buffer.get(String(userId)) || [])];
  }

  mergeItems(rawItems: DigestBufferedItem[]): DigestSummaryLine[] {
    const projectsRepo = this.getProjectsRepository();
    const groups = new Map<
      string,
      {
        type: string;
        referenceId?: string;
        targetTitle?: string;
        link?: string;
        items: DigestBufferedItem[];
      }
    >();

    for (const item of rawItems) {
      const upperType = String(item.type || 'PROJECT_UPDATE').toUpperCase();
      const canonicalType = upperType === 'TASK_RELEASED' ? 'TASKS_RELEASED' : upperType;
      const refKey = item.referenceId ? String(item.referenceId) : `single:${item.id}`;
      const groupKey = `${canonicalType}::${refKey}`;

      let targetTitle = item.targetTitle;
      if (!targetTitle && item.referenceId && projectsRepo) {
        const proj = projectsRepo.findById(String(item.referenceId));
        targetTitle = proj?.title || (proj as any)?.name;
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          type: canonicalType,
          referenceId: item.referenceId,
          targetTitle,
          link: item.link,
          items: [item],
        });
      } else {
        const g = groups.get(groupKey)!;
        g.items.push(item);
        if (!g.targetTitle && targetTitle) g.targetTitle = targetTitle;
        if (!g.link && item.link) g.link = item.link;
      }
    }

    const lines: DigestSummaryLine[] = [];
    for (const [key, g] of groups.entries()) {
      const count = g.items.reduce((sum, item) => {
        const c = Number(item.count ?? item.metadata?.count ?? 1);
        return sum + (Number.isFinite(c) && c > 0 ? c : 1);
      }, 0);
      const targetLabel = g.targetTitle || (g.referenceId ? `Project ${g.referenceId}` : 'your project');
      const latestAt = g.items[g.items.length - 1].createdAt;

      let summary: string;
      if (g.items.length === 1) {
        summary = g.items[0].message;
      } else if (g.type === 'TASKS_RELEASED') {
        summary = `${count} tasks released from ${targetLabel}`;
      } else if (g.type === 'PROJECT_LIKE') {
        summary = `${count} likes on ${targetLabel}`;
      } else if (g.type === 'NEW_APPLICANT' || g.type === 'JOIN_REQUEST') {
        summary = `${count} new applicants for ${targetLabel}`;
      } else if (g.type === 'TASK_COMMENT') {
        summary = `${count} task comments on ${targetLabel}`;
      } else if (g.type === 'BADGE_AWARDED') {
        summary = `${count} badges awarded in ${targetLabel}`;
      } else {
        summary = `${count} ${g.type.toLowerCase().replace(/_/g, ' ')} updates for ${targetLabel}`;
      }

      lines.push({
        key,
        type: g.type,
        referenceId: g.referenceId,
        targetTitle: g.targetTitle,
        link: g.link || (g.referenceId ? `/projects/${g.referenceId}` : '/notifications'),
        count,
        summary,
        latestAt,
      });
    }

    // Most recent first for capped summary visibility
    lines.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
    return lines;
  }

  /**
   * Immediately flushes buffered items for a user as individual notifications
   * when digest mode is turned off.
   */
  flushBufferAsImmediate(userId: string): number {
    const uid = String(userId);
    const items = this.buffer.get(uid) || [];
    if (items.length === 0) return 0;
    this.buffer.delete(uid);

    const notifSvc = this.getNotificationsService();
    if (!notifSvc) return items.length;
    for (const item of items) {
      notifSvc.create({
        userId: uid,
        type: item.type,
        title: item.title,
        message: item.message,
        readStatus: false,
        referenceId: item.referenceId,
        link: item.link,
        metadata: item.metadata,
        suggestedProjects: item.suggestedProjects,
        groupKey: item.groupKey,
        count: item.count,
        items: item.items,
        bypassDigest: true,
        priority: 'immediate',
      });
    }
    return items.length;
  }

  flushDueDigests(): {
    flushedUsers: string[];
    digestsCreated: number;
    errors: string[];
  } {
    const now = this.now();
    const nowMs = now.getTime();
    const flushedUsers: string[] = [];
    let digestsCreated = 0;
    const errors: string[] = [];

    for (const [uid, rawItems] of Array.from(this.buffer.entries())) {
      if (!rawItems || rawItems.length === 0) {
        this.buffer.delete(uid);
        continue;
      }

      const user: any = this.usersRepository?.findById(uid);
      if (!user || user.isDeleted || user.deletedAt) {
        this.buffer.delete(uid);
        continue;
      }

      const { digestEnabled, digestHour, utcOffsetMinutes } = this.getUserSchedule(uid);
      if (!digestEnabled) {
        this.flushBufferAsImmediate(uid);
        continue;
      }

      const localNow = new Date(nowMs + utcOffsetMinutes * 60_000);
      const localDate = localNow.toISOString().slice(0, 10);
      const localHour = localNow.getUTCHours();

      if (localHour < digestHour) {
        continue;
      }

      if (this.lastFlushLocalDateByUser.get(uid) === localDate) {
        continue;
      }

      try {
        const merged = this.mergeItems(rawItems);
        const cappedItems = merged.slice(0, MAX_DIGEST_ITEMS);
        const omittedCount = Math.max(0, merged.length - MAX_DIGEST_ITEMS);

        const summaryPreview = cappedItems
          .slice(0, 3)
          .map((l) => l.summary)
          .join(' • ');
        const message =
          omittedCount > 0
            ? `Daily digest (${merged.length} updates, showing top ${MAX_DIGEST_ITEMS}): ${summaryPreview}`
            : `Daily digest (${rawItems.length} events, ${merged.length} updates): ${summaryPreview}`;

        const notifSvc = this.getNotificationsService();
        if (notifSvc) {
          notifSvc.create({
            userId: uid,
            type: 'DAILY_DIGEST',
            title: 'Daily Notification Digest',
            message,
            readStatus: false,
            link: '/notifications',
            bypassDigest: true,
            priority: 'immediate',
            metadata: {
              isDigest: true,
              localDate,
              digestHour,
              utcOffsetMinutes,
              items: cappedItems,
              totalBufferedCount: rawItems.length,
              totalMergedCount: merged.length,
              omittedCount,
            },
          });
        }

        this.lastFlushLocalDateByUser.set(uid, localDate);
        this.buffer.delete(uid);
        flushedUsers.push(uid);
        digestsCreated += 1;
      } catch (err: any) {
        errors.push(err?.message || String(err));
      }
    }

    return { flushedUsers, digestsCreated, errors };
  }

  resetToSeed(): void {
    this.buffer.clear();
    this.lastFlushLocalDateByUser.clear();
  }

  reset(): void {
    if (process.env.NODE_ENV !== 'test' && process.env.ALLOW_STORE_RESET !== 'true') return;
    this.resetToSeed();
  }
}
