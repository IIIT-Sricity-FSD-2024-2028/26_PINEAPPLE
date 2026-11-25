import { AuditService } from './audit.service';
import { ClockService } from '../common/services/clock.service';

describe('Step 5 Unit: Audit Filtering by userId, reportId, and action', () => {
  let auditService: AuditService;
  let clock: ClockService;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';
    clock = new ClockService();
    clock.setTime('2026-11-20T10:00:00.000Z');
    auditService = new AuditService(clock);
    auditService.reset();
  });

  it('filters entries by userId when user is actor, target, or in metadata', () => {
    // 1. Entry where user-100 is actor
    auditService.log({
      action: 'project-created',
      actor: 'user-100',
      performedBy: 'user-100',
      target: 'Project Alpha',
      entityType: 'project',
      entityId: 'proj-1',
      details: { title: 'Project Alpha' },
    });

    // 2. Entry where user-100 is target
    auditService.log({
      action: 'user-warned',
      actor: 'admin-1',
      performedBy: 'admin-1',
      target: 'user-100',
      entityType: 'user',
      entityId: 'user-100',
      details: { reason: 'spam' },
    });

    // 3. Entry where user-100 is in metadata/details
    auditService.log({
      action: 'report-action',
      actor: 'admin-1',
      performedBy: 'admin-1',
      target: 'Report #rep-1',
      entityType: 'report',
      entityId: 'rep-1',
      details: { reportId: 'rep-1', reportedUserId: 'user-100', action: 'warn' },
    });

    // 4. Unrelated entry for user-999
    auditService.log({
      action: 'user-warned',
      actor: 'admin-2',
      performedBy: 'admin-2',
      target: 'user-999',
      entityType: 'user',
      entityId: 'user-999',
      details: { reason: 'inappropriate' },
    });

    const results = (auditService as any).findAll(undefined, undefined, 'user-100');
    expect(results.length).toBe(3);
    const actions = results.map((r: any) => r.action);
    expect(actions).toContain('project-created');
    expect(actions).toContain('user-warned');
    expect(actions).toContain('report-action');
    expect(actions).not.toContain('inappropriate');
  });

  it('filters entries by reportId (in entityId, target, or metadata)', () => {
    // 1. Entry where report is entity
    auditService.log({
      action: 'report-status-changed',
      actor: 'admin-1',
      target: 'rep-50',
      entityType: 'report',
      entityId: 'rep-50',
      details: { reportId: 'rep-50', status: 'Under review' },
    });

    // 2. Moderation action linked to report in details
    auditService.log({
      action: 'user-warned',
      actor: 'admin-1',
      target: 'user-100',
      entityType: 'user',
      entityId: 'user-100',
      details: { userId: 'user-100', reportId: 'rep-50' },
    });

    // 3. Different report entry
    auditService.log({
      action: 'report-status-changed',
      actor: 'admin-1',
      target: 'rep-99',
      entityType: 'report',
      entityId: 'rep-99',
      details: { reportId: 'rep-99', status: 'Dismissed' },
    });

    const results = (auditService as any).findAll(undefined, undefined, undefined, 'rep-50');
    expect(results.length).toBe(2);
    expect(results.map((r: any) => r.action)).toEqual(
      expect.arrayContaining(['report-status-changed', 'user-warned']),
    );
  });

  it('filters by both userId and reportId together, intersecting results', () => {
    // Entry with user-100 AND report rep-50
    auditService.log({
      action: 'user-warned',
      actor: 'admin-1',
      target: 'user-100',
      entityType: 'user',
      entityId: 'user-100',
      details: { userId: 'user-100', reportId: 'rep-50' },
    });

    // Entry with user-100 but report rep-99
    auditService.log({
      action: 'user-warned',
      actor: 'admin-1',
      target: 'user-100',
      entityType: 'user',
      entityId: 'user-100',
      details: { userId: 'user-100', reportId: 'rep-99' },
    });

    // Entry with user-200 and report rep-50
    auditService.log({
      action: 'user-warned',
      actor: 'admin-1',
      target: 'user-200',
      entityType: 'user',
      entityId: 'user-200',
      details: { userId: 'user-200', reportId: 'rep-50' },
    });

    const results = (auditService as any).findAll(undefined, undefined, 'user-100', 'rep-50');
    expect(results.length).toBe(1);
    expect(results[0].details.userId).toBe('user-100');
    expect(results[0].details.reportId).toBe('rep-50');
  });

  it('filters by userId, reportId, and action simultaneously', () => {
    // user-100 + rep-50 + user-warned
    auditService.log({
      action: 'user-warned',
      actor: 'admin-1',
      target: 'user-100',
      entityType: 'user',
      entityId: 'user-100',
      details: { userId: 'user-100', reportId: 'rep-50' },
    });

    // user-100 + rep-50 + user-suspended
    auditService.log({
      action: 'user-suspended',
      actor: 'admin-1',
      target: 'user-100',
      entityType: 'user',
      entityId: 'user-100',
      details: { userId: 'user-100', reportId: 'rep-50' },
    });

    const results = (auditService as any).findAll(undefined, undefined, 'user-100', 'rep-50', 'user-suspended');
    expect(results.length).toBe(1);
    expect(results[0].action).toBe('user-suspended');
  });

  it('exportAuditLog accepts and applies userId and reportId filters', () => {
    auditService.log({
      action: 'user-warned',
      actor: 'admin-1',
      target: 'user-100',
      entityType: 'user',
      entityId: 'user-100',
      details: { userId: 'user-100', reportId: 'rep-50' },
    });
    auditService.log({
      action: 'user-warned',
      actor: 'admin-1',
      target: 'user-999',
      entityType: 'user',
      entityId: 'user-999',
      details: { userId: 'user-999', reportId: 'rep-99' },
    });

    const jsonExport = (auditService as any).exportAuditLog({
      format: 'json',
      userId: 'user-100',
      reportId: 'rep-50',
    });
    expect(jsonExport.exportedCount).toBe(1);
    expect(jsonExport.items[0].target).toBe('user-100');

    const csvExport = (auditService as any).exportAuditLog({
      format: 'csv',
      userId: 'user-100',
      reportId: 'rep-50',
    });
    expect(csvExport.exportedCount).toBe(1);
    expect(csvExport.csv).toContain('user-100');
    expect(csvExport.csv).not.toContain('user-999');
  });
});
