import { Injectable, BadRequestException, Optional } from '@nestjs/common';
import { AuditLogEntry } from '../admin/entities/audit-log-entry.entity';
import { ClockService } from '../common/services/clock.service';

export interface CreateAuditEntryDto {
  action: string;
  entityType?: string;
  entityId?: string;
  performedBy?: string;
  actor?: string;
  target?: string;
  event?: string;
  details?: any;
}

@Injectable()
export class AuditService {
  private static readonly MAX_ENTRIES = 5000;
  private static readonly MAX_EXPORT_ROWS = 10000;

  constructor(@Optional() private readonly clockService?: ClockService) {}

  private buildSeedEntries(): AuditLogEntry[] {
    return [
      {
        id: 'audit-seed-1',
        action: 'signup',
        entityType: 'user',
        entityId: '8',
        performedBy: 'Vikram Nair',
        actor: 'Vikram Nair',
        target: 'Account Registration',
        event: 'New user Vikram Nair registered on TeamForge',
        details: { role: 'Collaborator', university: 'SRM University' },
        timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
      },
      {
        id: 'audit-seed-2',
        action: 'project-created',
        entityType: 'project',
        entityId: 'proj-1',
        performedBy: 'Priya Patel',
        actor: 'Priya Patel',
        target: 'AI Study Planner',
        event: 'Priya Patel created project "AI Study Planner"',
        details: { difficulty: 'Hard', dueDate: '2027-02-28T00:00:00.000Z' },
        timestamp: new Date(Date.now() - 3600000 * 36).toISOString(),
      },
      {
        id: 'audit-seed-3',
        action: 'task-created',
        entityType: 'task',
        entityId: 't-1',
        performedBy: 'Priya Patel',
        actor: 'Priya Patel',
        target: 'Set up PyTorch pipeline',
        event: 'Task "Set up PyTorch pipeline" created in AI Study Planner',
        details: { xp: 50, status: 'Open' },
        timestamp: new Date(Date.now() - 3600000 * 30).toISOString(),
      },
      {
        id: 'audit-seed-4',
        action: 'join-request-sent',
        entityType: 'join_request',
        entityId: 'req-1',
        performedBy: 'Vikram Nair',
        actor: 'Vikram Nair',
        target: 'AI Study Planner',
        event: 'Vikram Nair applied to join "AI Study Planner"',
        details: { role: 'Contributor' },
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
      {
        id: 'audit-seed-5',
        action: 'join-request-approved',
        entityType: 'join_request',
        entityId: 'req-1',
        performedBy: 'Priya Patel',
        actor: 'Priya Patel',
        target: 'Vikram Nair',
        event: 'Priya Patel accepted Vikram Nair into "AI Study Planner"',
        details: { status: 'Approved' },
        timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
      },
      {
        id: 'audit-seed-6',
        action: 'task-approved',
        entityType: 'task',
        entityId: 't-1',
        performedBy: 'Priya Patel',
        actor: 'Priya Patel',
        target: 'Set up PyTorch pipeline',
        event: 'Task "Set up PyTorch pipeline" approved (+50 XP awarded)',
        details: { xp: 50, status: 'Completed' },
        timestamp: new Date(Date.now() - 3600000 * 16).toISOString(),
      },
      {
        id: 'audit-seed-7',
        action: 'mentor-application-sent',
        entityType: 'mentor_application',
        entityId: 'app-1',
        performedBy: 'Sneha Iyer',
        actor: 'Sneha Iyer',
        target: 'Mentor Application',
        event: 'Sneha Iyer submitted mentor application for Cloud Architecture',
        details: { years: 6, skills: ['DevOps', 'AWS', 'Docker'] },
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
      {
        id: 'audit-seed-8',
        action: 'mentor-application-approved',
        entityType: 'mentor_application',
        entityId: 'app-1',
        performedBy: 'admin',
        actor: 'Admin',
        target: 'Sneha Iyer',
        event: 'Admin approved mentor application for Sneha Iyer',
        details: { status: 'approved' },
        timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
      },
      {
        id: 'audit-seed-9',
        action: 'booking-funded',
        entityType: 'mentor_session',
        entityId: 'sess-demo-1',
        performedBy: 'Arjun Sharma',
        actor: 'Arjun Sharma',
        target: 'Neha Gupta',
        event: 'Mentorship session booked with Neha Gupta (Escrow ₹1,500 held)',
        details: { price: 1500, status: 'escrow_funded' },
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
    ];
  }

  private readonly auditLog: AuditLogEntry[] = this.buildSeedEntries();

  private normalizeEventText(event: any, details: any, actor: string, action: string): string {
    const pickText = (val: any): string => {
      if (typeof val === 'string') return val.trim();
      if (val && typeof val === 'object') {
        for (const key of ['message', 'reason', 'event', 'title', 'label']) {
          if (typeof val[key] === 'string' && val[key].trim()) {
            return val[key].trim();
          }
        }
      }
      return '';
    };
    return (
      pickText(event) ||
      pickText(details) ||
      (() => {
        const cleanAction = String(action || 'system-event').replace(/[-_]/g, ' ');
        return `${actor} performed ${cleanAction}`;
      })()
    );
  }

  log(entry: CreateAuditEntryDto): AuditLogEntry {
    const actor = entry.actor || entry.performedBy || 'System';
    const action = entry.action || 'system-event';
    const target = entry.target || (entry.entityId ? `${entry.entityType || 'Entity'} #${entry.entityId}` : '-');

    const rawEventText = this.normalizeEventText(entry.event, entry.details, actor, action);
    const eventText =
      typeof entry.event === 'string' && entry.event.trim()
        ? entry.event.trim()
        : `${rawEventText}${target && target !== '-' && !rawEventText.includes(target) ? ` on ${target}` : ''}`;

    const newEntry: AuditLogEntry & { actor: string; target: string; event: string } = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      action,
      entityType: entry.entityType || 'system',
      entityId: entry.entityId || '',
      performedBy: actor,
      actor,
      target,
      event: eventText,
      details: entry.details || {},
      timestamp: this.clockService?.nowIso?.() || new Date().toISOString(),
    };

    this.auditLog.unshift(newEntry);
    if (this.auditLog.length > AuditService.MAX_ENTRIES) {
      this.auditLog.length = AuditService.MAX_ENTRIES;
    }
    return newEntry;
  }

  create(entry: any): AuditLogEntry {
    const actor = entry.actor || entry.performedBy || entry.userId || 'System';
    const action = entry.action || 'system-event';
    const target = entry.target || (entry.entityId ? `${entry.entityType || 'Entity'} #${entry.entityId}` : (entry.userId ? `User #${entry.userId}` : '-'));
    const details = typeof entry.details === 'object' && entry.details !== null ? entry.details : { message: entry.details };

    return this.log({
      action,
      actor,
      performedBy: actor,
      target,
      entityType: entry.entityType || 'user',
      entityId: entry.entityId || entry.userId || '',
      event: this.normalizeEventText(entry.event, entry.details, actor, action),
      details,
    });
  }

  private matchesUserId(entry: AuditLogEntry, uid: string): boolean {
    const actor = String(entry.actor || entry.performedBy || '').toLowerCase();
    const target = String(entry.target || '').toLowerCase();
    const entityType = String(entry.entityType || '').toLowerCase();
    const entityId = String(entry.entityId || '').toLowerCase();
    const details = entry.details;
    const detailsUser = details?.userId ? String(details.userId).toLowerCase() : '';
    const detailsTargetUser = details?.targetUserId ? String(details.targetUserId).toLowerCase() : '';
    const detailsReported = details?.reportedUserId ? String(details.reportedUserId).toLowerCase() : '';
    const detailsSubject = details?.subjectUserId ? String(details.subjectUserId).toLowerCase() : '';
    const detailsMetaUser = details?.metadata?.userId ? String(details.metadata.userId).toLowerCase() : '';
    const detailsMetaReported = details?.metadata?.reportedUserId ? String(details.metadata.reportedUserId).toLowerCase() : '';

    return (
      actor === uid ||
      target === uid ||
      target.includes(uid) ||
      actor.includes(uid) ||
      (entityType === 'user' && entityId === uid) ||
      entityId === uid ||
      detailsUser === uid ||
      detailsTargetUser === uid ||
      detailsReported === uid ||
      detailsSubject === uid ||
      detailsMetaUser === uid ||
      detailsMetaReported === uid
    );
  }

  private matchesReportId(entry: AuditLogEntry, rid: string): boolean {
    const target = String(entry.target || '').toLowerCase();
    const entityType = String(entry.entityType || '').toLowerCase();
    const entityId = String(entry.entityId || '').toLowerCase();
    const details = entry.details;
    const detailsReportId = details?.reportId ? String(details.reportId).toLowerCase() : '';
    const detailsMetaReportId = details?.metadata?.reportId ? String(details.metadata.reportId).toLowerCase() : '';

    return (
      (entityType === 'report' && entityId === rid) ||
      target === rid ||
      target.includes(rid) ||
      entityId === rid ||
      detailsReportId === rid ||
      detailsMetaReportId === rid
    );
  }

  findAll(
    limit?: number,
    offset?: number,
    userId?: string,
    reportId?: string,
    action?: string,
    actor?: string,
  ): AuditLogEntry[] {
    let sorted = [...this.auditLog].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    if (userId && userId.trim()) {
      const uid = userId.trim().toLowerCase();
      sorted = sorted.filter((entry) => this.matchesUserId(entry, uid));
    }

    if (reportId && reportId.trim()) {
      const rid = reportId.trim().toLowerCase();
      sorted = sorted.filter((entry) => this.matchesReportId(entry, rid));
    }

    if (action && action.trim() && action !== 'all') {
      const act = action.trim().toLowerCase();
      sorted = sorted.filter((entry) => String(entry.action || '').toLowerCase().includes(act));
    }

    if (actor && actor.trim()) {
      const actr = actor.trim().toLowerCase();
      sorted = sorted.filter((entry) => String(entry.actor || entry.performedBy || '').toLowerCase().includes(actr));
    }

    if (limit !== undefined && limit > 0) {
      const start = offset || 0;
      return sorted.slice(start, start + limit);
    }
    return sorted;
  }

  count(): number {
    return this.auditLog.length;
  }

  clearAll(): void {
    this.auditLog.length = 0;
  }

  resetToSeed(): void {
    this.auditLog.length = 0;
    this.auditLog.push(...this.buildSeedEntries());
  }

  reset(): void {
    if (process.env.NODE_ENV !== 'test' && !process.env.ALLOW_STORE_RESET) return;
    this.auditLog.length = 0;
  }

  private escapeCsvCell(value: unknown): string {
    const raw =
      value === null || value === undefined
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
    const formulaSafe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    if (/[",\r\n]/.test(formulaSafe)) {
      return `"${formulaSafe.replace(/"/g, '""')}"`;
    }
    return formulaSafe;
  }

  exportAuditLog(options?: {
    format?: string;
    from?: string;
    to?: string;
    actor?: string;
    action?: string;
    userId?: string;
    reportId?: string;
    requesterId?: string;
  }): {
    format: 'json' | 'csv';
    totalMatched: number;
    exportedCount: number;
    truncated: boolean;
    exportedAt: string;
    items?: AuditLogEntry[];
    csv?: string;
  } {
    const fmt = String(options?.format || 'json').trim().toLowerCase();
    if (fmt !== 'json' && fmt !== 'csv') {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'INVALID_FORMAT',
        message: 'Export format must be either "csv" or "json".',
      });
    }

    let fromMs: number | null = null;
    if (options?.from && options.from.trim()) {
      const parsed = new Date(options.from.trim()).getTime();
      if (Number.isNaN(parsed)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVALID_DATE_RANGE',
          message: 'Invalid "from" date parameter.',
        });
      }
      fromMs = parsed;
    }

    let toMs: number | null = null;
    if (options?.to && options.to.trim()) {
      const trimmedTo = options.to.trim();
      const isoTarget =
        trimmedTo.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(trimmedTo)
          ? `${trimmedTo}T23:59:59.999Z`
          : trimmedTo;
      const parsed = new Date(isoTarget).getTime();
      if (Number.isNaN(parsed)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVALID_DATE_RANGE',
          message: 'Invalid "to" date parameter.',
        });
      }
      toMs = parsed;
    }

    const actorFilter = options?.actor ? options.actor.trim().toLowerCase() : '';
    const actionFilter = options?.action ? options.action.trim().toLowerCase() : '';
    const userFilter = options?.userId ? options.userId.trim().toLowerCase() : '';
    const reportFilter = options?.reportId ? options.reportId.trim().toLowerCase() : '';

    const sorted = [...this.auditLog].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const matched = sorted.filter((entry) => {
      const tsMs = new Date(entry.timestamp).getTime();
      if (fromMs !== null && tsMs < fromMs) return false;
      if (toMs !== null && tsMs > toMs) return false;
      if (actorFilter) {
        const entryActor = String(entry.actor || entry.performedBy || '').toLowerCase();
        if (!entryActor.includes(actorFilter)) return false;
      }
      if (actionFilter) {
        const entryAction = String(entry.action || '').toLowerCase();
        if (!entryAction.includes(actionFilter)) return false;
      }
      if (userFilter && !this.matchesUserId(entry, userFilter)) return false;
      if (reportFilter && !this.matchesReportId(entry, reportFilter)) return false;
      return true;
    });

    const truncated = matched.length > AuditService.MAX_EXPORT_ROWS;
    const rows = matched.slice(0, AuditService.MAX_EXPORT_ROWS);
    const nowIso = this.clockService?.nowIso?.() || new Date().toISOString();

    this.log({
      action: 'audit-exported',
      actor: options?.requesterId || 'Admin',
      performedBy: options?.requesterId || 'Admin',
      target: 'Audit Log Export',
      entityType: 'audit',
      entityId: 'export',
      event: `Audit log exported (${fmt.toUpperCase()}, ${rows.length} rows)`,
      details: {
        format: fmt,
        from: options?.from || null,
        to: options?.to || null,
        actor: options?.actor || null,
        action: options?.action || null,
        exportedCount: rows.length,
        totalMatched: matched.length,
        truncated,
      },
    });

    if (fmt === 'json') {
      return {
        format: 'json',
        totalMatched: matched.length,
        exportedCount: rows.length,
        truncated,
        exportedAt: nowIso,
        items: rows,
      };
    }

    const headers = [
      'id',
      'timestamp',
      'action',
      'actor',
      'target',
      'entityType',
      'entityId',
      'event',
      'details',
    ];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.timestamp,
          r.action,
          r.actor || r.performedBy || '',
          r.target || '',
          r.entityType || '',
          r.entityId || '',
          r.event || '',
          r.details || '',
        ]
          .map((cell) => this.escapeCsvCell(cell))
          .join(','),
      );
    }

    return {
      format: 'csv',
      totalMatched: matched.length,
      exportedCount: rows.length,
      truncated,
      exportedAt: nowIso,
      csv: lines.join('\n'),
    };
  }

  anonymizeUser(userId: string, anonymizedId: string, identifiers: Array<string | undefined> = []): number {
    const uid = String(userId || '').trim();
    const idents = Array.from(
      new Set(
        identifiers
          .filter((v): v is string => Boolean(v && String(v).trim()))
          .map((v) => String(v).trim()),
      ),
    );
    const identsLower = idents.map((s) => s.toLowerCase());
    const scrubText = (val?: string): string | undefined => {
      if (!val || typeof val !== 'string') return val;
      let next = val;
      for (const ident of idents) {
        if (ident.length >= 3) {
          const escaped = ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          next = next.replace(new RegExp(escaped, 'gi'), anonymizedId);
        }
      }
      return next;
    };
    const matchesUser = (val?: string): boolean => {
      if (!val) return false;
      const lower = String(val).trim().toLowerCase();
      return lower === uid.toLowerCase() || identsLower.includes(lower);
    };

    let count = 0;
    for (const entry of this.auditLog) {
      let touched = false;
      if (entry.entityType === 'user' && String(entry.entityId || '') === uid) {
        entry.entityId = anonymizedId;
        touched = true;
      }
      if (matchesUser(entry.actor)) {
        entry.actor = anonymizedId;
        touched = true;
      }
      if (matchesUser(entry.performedBy)) {
        entry.performedBy = anonymizedId;
        touched = true;
      }
      if (matchesUser(entry.target)) {
        entry.target = anonymizedId;
        touched = true;
      }
      const nextEvent = scrubText(entry.event);
      if (nextEvent !== entry.event) {
        entry.event = nextEvent!;
        touched = true;
      }
      if (entry.details && typeof entry.details === 'object') {
        try {
          const rawJson = JSON.stringify(entry.details);
          const scrubbedJson = scrubText(rawJson);
          if (scrubbedJson && scrubbedJson !== rawJson) {
            entry.details = JSON.parse(scrubbedJson);
            touched = true;
          }
        } catch {}
        if (String(entry.details.userId || '') === uid) {
          entry.details.userId = anonymizedId;
          touched = true;
        }
        if (String(entry.details.targetUserId || '') === uid) {
          entry.details.targetUserId = anonymizedId;
          touched = true;
        }
      }
      if (touched) count += 1;
    }
    return count;
  }
}
