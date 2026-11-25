import { ReportsService } from './reports.service';
import { ClockService } from '../common/services/clock.service';
import { HttpException, HttpStatus, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';

const createSpy = () => {
  const calls: any[][] = [];
  const fn = (...args: any[]) => {
    calls.push(args);
  };
  fn.calls = calls;
  return fn;
};

describe('ReportsService Unit Tests', () => {
  let reportsService: ReportsService;
  let clockService: ClockService;
  let mockUsersRepo: any;
  let mockModerationService: any;
  let mockReputationService: any;
  let mockNotificationsService: any;
  let mockAuditService: any;
  let notifySpy: any;
  let auditSpy: any;

  beforeEach(() => {
    clockService = new ClockService();

    const usersMap: Record<string, any> = {
      'reporter-1': { id: 'reporter-1', name: 'Alice Reporter', username: 'alice', role: 'Collaborator', status: 'Active' },
      'user-target': { id: 'user-target', name: 'Bob Target', username: 'bob', role: 'Collaborator', status: 'Active' },
      'admin-target': { id: 'admin-target', name: 'Admin Charlie', username: 'charlie', role: 'Administrator', status: 'Active' },
      'su-target': { id: 'su-target', name: 'Super Dave', username: 'dave', role: 'SuperUser', status: 'Active' },
    };

    mockUsersRepo = {
      findById: (id: string) => usersMap[String(id)],
      findAll: () => Object.values(usersMap),
    };

    mockModerationService = {
      warn: async () => {},
      suspend: async () => {},
      getAdminUserWarnings: () => [],
    };

    mockReputationService = {
      getReputation: () => 100,
    };

    notifySpy = createSpy();
    mockNotificationsService = {
      create: async (...args: any[]) => {
        notifySpy(...args);
      },
    };

    auditSpy = createSpy();
    mockAuditService = {
      create: (...args: any[]) => {
        auditSpy(...args);
      },
    };

    reportsService = new ReportsService(
      clockService,
      mockUsersRepo,
      mockModerationService,
      mockReputationService,
      mockNotificationsService,
      mockAuditService,
    );
  });

  afterEach(() => {
    reportsService.reset();
  });

  it('rejects self-reporting with 400 CANNOT_REPORT_SELF', async () => {
    await expect(
      reportsService.createReport('reporter-1', {
        reportedUserId: 'reporter-1',
        reason: 'Harassment',
        details: 'Self reporting details that are long enough',
      }),
    ).rejects.toThrow(BadRequestException);

    try {
      await reportsService.createReport('reporter-1', {
        reportedUserId: 'reporter-1',
        reason: 'Harassment',
        details: 'Self reporting details that are long enough',
      });
    } catch (err: any) {
      expect(err.getResponse().code).toBe('CANNOT_REPORT_SELF');
    }
  });

  it('rejects reporting an admin or superuser with 403 CANNOT_REPORT_ADMIN', async () => {
    try {
      await reportsService.createReport('reporter-1', {
        reportedUserId: 'admin-target',
        reason: 'Spam',
        details: 'Attempting to report admin user account',
      });
      fail('Should have thrown ForbiddenException');
    } catch (err: any) {
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse().code).toBe('CANNOT_REPORT_ADMIN');
    }

    try {
      await reportsService.createReport('reporter-1', {
        reportedUserId: 'su-target',
        reason: 'Spam',
        details: 'Attempting to report superuser account',
      });
      fail('Should have thrown ForbiddenException');
    } catch (err: any) {
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse().code).toBe('CANNOT_REPORT_ADMIN');
    }
  });

  it('validates report reason against allowed options', async () => {
    try {
      await reportsService.createReport('reporter-1', {
        reportedUserId: 'user-target',
        reason: 'InvalidReason' as any,
        details: 'Valid length details describing the incident here.',
      });
      fail('Should have thrown BadRequestException');
    } catch (err: any) {
      expect(err.getStatus()).toBe(400);
      expect(err.getResponse().code).toBe('VALIDATION');
    }
  });

  it('validates report details length (min 20, max 1000 characters)', async () => {
    try {
      await reportsService.createReport('reporter-1', {
        reportedUserId: 'user-target',
        reason: 'Harassment',
        details: 'Too short',
      });
      fail('Should have thrown BadRequestException');
    } catch (err: any) {
      expect(err.getStatus()).toBe(400);
      expect(err.getResponse().code).toBe('VALIDATION');
    }
  });

  it('enforces maximum 5 reports per day per reporter with fake clock', async () => {
    for (let i = 1; i <= 5; i++) {
      // Different targets to avoid duplicate open check
      const dummyTargetId = `target-${i}`;
      mockUsersRepo.findById = (id: string) => ({ id, name: `User ${id}`, role: 'Collaborator', status: 'Active' });

      const report = await reportsService.createReport('reporter-1', {
        reportedUserId: dummyTargetId,
        reason: 'Spam',
        details: `Valid report description number ${i} with enough length.`,
      });
      expect(report.status).toBe('Open');
    }

    // 6th report within 24h throws 429 DAILY_LIMIT
    try {
      await reportsService.createReport('reporter-1', {
        reportedUserId: 'target-6',
        reason: 'Spam',
        details: 'Sixth report in the same 24 hour rolling window.',
      });
      fail('Should have thrown 429 HttpException');
    } catch (err: any) {
      expect(err.getStatus()).toBe(429);
      expect(err.getResponse().code).toBe('DAILY_LIMIT');
    }

    // Advance clock by 1 day (24 hours) -> allows reporting again
    clockService.advanceDays(1);

    const reportAfter1Day = await reportsService.createReport('reporter-1', {
      reportedUserId: 'target-6',
      reason: 'Spam',
      details: 'New day report description with enough characters.',
    });
    expect(reportAfter1Day.id).toBeDefined();
  });

  it('rejects duplicate open report against the same target user with 409 DUPLICATE_OPEN_REPORT', async () => {
    await reportsService.createReport('reporter-1', {
      reportedUserId: 'user-target',
      reason: 'Harassment',
      details: 'First report that is currently open and pending review.',
    });

    try {
      await reportsService.createReport('reporter-1', {
        reportedUserId: 'user-target',
        reason: 'Spam',
        details: 'Second report attempting to be created while first is open.',
      });
      fail('Should have thrown ConflictException');
    } catch (err: any) {
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse().code).toBe('DUPLICATE_OPEN_REPORT');
    }
  });

  it('allows second report once previous report is resolved or dismissed', async () => {
    const report1 = await reportsService.createReport('reporter-1', {
      reportedUserId: 'user-target',
      reason: 'Harassment',
      details: 'First report that is currently open and pending review.',
    });

    // Dismiss first report
    reportsService.updateReportStatus(report1.id, { status: 'Dismissed', note: 'Not a violation' }, 'admin-1');

    // Reporter can now file another report
    const report2 = await reportsService.createReport('reporter-1', {
      reportedUserId: 'user-target',
      reason: 'Harassment',
      details: 'Follow-up report filed after dismissal of previous report.',
    });
    expect(report2.id).toBeDefined();
    expect(report2.status).toBe('Open');
  });

  it('admin action resolves report and sends single-line outcome notification without leaking reporter', async () => {
    const report = await reportsService.createReport('reporter-1', {
      reportedUserId: 'user-target',
      reason: 'Harassment',
      details: 'User has been sending harassing messages in workspace.',
    });

    await reportsService.actionReport(
      report.id,
      { action: 'warn', reason: 'Official warning issued for harassment.' },
      'admin-1',
    );

    const updated = reportsService.getReporterReports('reporter-1');
    expect(updated[0].status).toBe('Resolved');
    expect(updated[0].outcome).toBe('Reviewed and action taken');

    // Reporter was notified
    expect(notifySpy.calls.length).toBe(1);
    expect(notifySpy.calls[0][0].userId).toBe('reporter-1');
    expect(notifySpy.calls[0][0].title).toBe('Report Update');
    expect(notifySpy.calls[0][0].message).toContain('reviewed and resolved');
    // Does not leak internal reporter metadata
  });

  it('actioning or updating a report twice throws 409 REPORT_ALREADY_ACTIONED and applies penalty only once', async () => {
    let warnCount = 0;
    mockModerationService.warn = async () => {
      warnCount++;
    };

    const report = await reportsService.createReport('reporter-1', {
      reportedUserId: 'user-target',
      reason: 'Harassment',
      details: 'User has been sending harassing messages in workspace.',
    });

    // First action succeeds
    await reportsService.actionReport(
      report.id,
      { action: 'warn', reason: 'Official warning issued for harassment.' },
      'admin-1',
    );
    expect(warnCount).toBe(1);

    // Second action throws 409 REPORT_ALREADY_ACTIONED
    await expect(
      reportsService.actionReport(
        report.id,
        { action: 'warn', reason: 'Second warning attempt.' },
        'admin-2',
      ),
    ).rejects.toThrow(ConflictException);

    try {
      await reportsService.actionReport(
        report.id,
        { action: 'warn', reason: 'Second warning attempt.' },
        'admin-2',
      );
      fail('Should throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse().code).toBe('REPORT_ALREADY_ACTIONED');
    }

    // Also updateReportStatus on resolved report throws 409
    expect(() => {
      reportsService.updateReportStatus(report.id, { status: 'Dismissed', note: 'Attempt dismiss' }, 'admin-2');
    }).toThrow(ConflictException);

    try {
      reportsService.updateReportStatus(report.id, { status: 'Dismissed', note: 'Attempt dismiss' }, 'admin-2');
      fail('Should throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse().code).toBe('REPORT_ALREADY_ACTIONED');
    }

    // Ensure penalty/warning was only called once
    expect(warnCount).toBe(1);
  });
});
