import { Injectable } from '@nestjs/common';
import { AuditLogEntry } from '../admin/entities/audit-log-entry.entity';

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
  private readonly auditLog: AuditLogEntry[] = [
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
      details: { difficulty: 'Hard', duration: '3 Months' },
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

  log(entry: CreateAuditEntryDto): AuditLogEntry {
    const actor = entry.actor || entry.performedBy || 'System';
    const action = entry.action || 'system-event';
    const target = entry.target || (entry.entityId ? `${entry.entityType || 'Entity'} #${entry.entityId}` : '-');

    let eventText = entry.event;
    if (!eventText) {
      const cleanAction = action.replace(/[-_]/g, ' ');
      eventText = `${actor} performed ${cleanAction}${target && target !== '-' ? ` on ${target}` : ''}`;
    }

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
      timestamp: new Date().toISOString(),
    };

    this.auditLog.unshift(newEntry);
    return newEntry;
  }

  findAll(): AuditLogEntry[] {
    return [...this.auditLog].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  count(): number {
    return this.auditLog.length;
  }
}
