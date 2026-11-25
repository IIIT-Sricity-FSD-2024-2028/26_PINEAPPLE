import { AppealsService } from './appeals.service';
import { ClockService } from '../common/services/clock.service';
import { ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';

const createSpy = () => {
  const calls: any[][] = [];
  const fn = (...args: any[]) => {
    calls.push(args);
  };
  fn.calls = calls;
  return fn;
};

describe('AppealsService Unit Tests', () => {
  let appealsService: AppealsService;
  let clockService: ClockService;
  let mockUsersRepo: any;
  let mockModerationService: any;
  let mockReputationService: any;
  let mockNotificationsService: any;
  let mockAuditService: any;
  let notifySpy: any;
  let auditSpy: any;
  let warningsList: any[];
  let removedWarnings: string[];
  let reputationDeltas: number[];

  beforeEach(() => {
    clockService = new ClockService();
    removedWarnings = [];
    reputationDeltas = [];

    warningsList = [
      {
        id: 'warn-active-1',
        userId: 'user-alice',
        issuedBy: 'admin-1',
        reason: 'Inappropriate language in workspace chat.',
        status: 'active',
        createdAt: clockService.nowIso(),
      },
      {
        id: 'warn-cleared-2',
        userId: 'user-alice',
        issuedBy: 'admin-1',
        reason: 'Old cleared warning.',
        status: 'cleared',
        createdAt: clockService.nowIso(),
      },
      {
        id: 'warn-bob-3',
        userId: 'user-bob',
        issuedBy: 'admin-1',
        reason: 'Warning belonging to Bob.',
        status: 'active',
        createdAt: clockService.nowIso(),
      },
    ];

    const usersMap: Record<string, any> = {
      'user-alice': { id: 'user-alice', name: 'Alice', status: 'Active' },
      'user-bob': { id: 'user-bob', name: 'Bob', status: 'Active' },
      'user-suspended': { id: 'user-suspended', name: 'Charlie Suspended', status: 'Suspended' },
    };

    mockUsersRepo = {
      findById: (id: string) => usersMap[String(id)],
      update: () => {},
    };

    mockModerationService = {
      findWarningById: (id: string) => warningsList.find((w) => w.id === id),
      removeWarning: (id: string, removedAt?: string) => {
        const w = warningsList.find((x) => x.id === id);
        if (w) {
          w.status = 'removed';
          w.removedAt = removedAt;
          removedWarnings.push(id);
        }
        return w;
      },
      getAllWarnings: () => warningsList,
    };

    mockReputationService = {
      recordWarningRemoved: (userId: string, warningId: string) => {
        reputationDeltas.push(10);
        return { delta: 10 };
      },
      getReputation: () => 90,
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

    appealsService = new AppealsService(
      clockService,
      mockUsersRepo,
      mockModerationService,
      mockReputationService,
      mockNotificationsService,
      mockAuditService,
    );
  });

  afterEach(() => {
    appealsService.reset();
  });

  it('rejects appeal from suspended user with 403 SUSPENDED', async () => {
    warningsList.push({
      id: 'warn-susp-4',
      userId: 'user-suspended',
      issuedBy: 'admin-1',
      reason: 'Caused suspension',
      status: 'active',
      createdAt: clockService.nowIso(),
    });

    try {
      await appealsService.createAppeal(
        'warn-susp-4',
        { explanation: 'I am appealing this warning but my account is suspended.' },
        'user-suspended',
      );
      fail('Should have thrown ForbiddenException');
    } catch (err: any) {
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse().code).toBe('SUSPENDED');
    }
  });

  it('rejects appeal for another user warning with 403 NOT_YOUR_WARNING', async () => {
    try {
      await appealsService.createAppeal(
        'warn-bob-3',
        { explanation: 'Alice trying to appeal Bob warning here with sufficient characters.' },
        'user-alice',
      );
      fail('Should have thrown ForbiddenException');
    } catch (err: any) {
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse().code).toBe('NOT_YOUR_WARNING');
    }
  });

  it('rejects appeal if warning is not active with 409 WARNING_NOT_ACTIVE', async () => {
    try {
      await appealsService.createAppeal(
        'warn-cleared-2',
        { explanation: 'Trying to appeal a cleared warning that is no longer active.' },
        'user-alice',
      );
      fail('Should have thrown ConflictException');
    } catch (err: any) {
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse().code).toBe('WARNING_NOT_ACTIVE');
    }
  });

  it('rejects appeal after 7 days have passed with 409 APPEAL_WINDOW_CLOSED', async () => {
    // Advance clock by 8 days
    clockService.advanceDays(8);

    try {
      await appealsService.createAppeal(
        'warn-active-1',
        { explanation: 'This appeal is submitted after the 7-day limit has passed.' },
        'user-alice',
      );
      fail('Should have thrown ConflictException');
    } catch (err: any) {
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse().code).toBe('APPEAL_WINDOW_CLOSED');
    }
  });

  it('rejects second appeal on the same warning with 409 ALREADY_APPEALED', async () => {
    await appealsService.createAppeal(
      'warn-active-1',
      { explanation: 'First valid appeal submitted within 7 days of warning.' },
      'user-alice',
    );

    try {
      await appealsService.createAppeal(
        'warn-active-1',
        { explanation: 'Second appeal attempt for the exact same warning.' },
        'user-alice',
      );
      fail('Should have thrown ConflictException');
    } catch (err: any) {
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse().code).toBe('ALREADY_APPEALED');
    }
  });

  it('accept decision removes warning, restores +10 reputation, notifies user, and is idempotent', async () => {
    const appeal = await appealsService.createAppeal(
      'warn-active-1',
      { explanation: 'I apologize for the misunderstanding, here is the full context.' },
      'user-alice',
    );

    const result = await appealsService.decideAppeal(
      appeal.id,
      { decision: 'accept', note: 'Context accepted. Warning removed from record.' },
      'admin-1',
    );

    expect(result.appeal.status).toBe('accepted');
    expect(result.appeal.adminNote).toContain('Context accepted');
    expect(removedWarnings).toContain('warn-active-1');
    expect(reputationDeltas.length).toBe(1);
    expect(reputationDeltas[0]).toBe(10);

    // User notified
    expect(notifySpy.calls.length).toBe(1);
    expect(notifySpy.calls[0][0].userId).toBe('user-alice');
    expect(notifySpy.calls[0][0].title).toBe('Appeal Accepted');

    // Calling accept again on the already decided appeal throws 409 APPEAL_ALREADY_DECIDED
    try {
      await appealsService.decideAppeal(
        appeal.id,
        { decision: 'accept', note: 'Context accepted. Warning removed from record.' },
        'admin-1',
      );
      fail('Should have thrown ConflictException');
    } catch (err: any) {
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse().code).toBe('APPEAL_ALREADY_DECIDED');
    }
    // Reputation delta not added a second time
    expect(reputationDeltas.length).toBe(1);
  });

  it('reject decision keeps warning active, records admin note, and notifies user', async () => {
    const appeal = await appealsService.createAppeal(
      'warn-active-1',
      { explanation: 'I would like to contest this warning because it was unintentional.' },
      'user-alice',
    );

    const result = await appealsService.decideAppeal(
      appeal.id,
      { decision: 'reject', note: 'Review upheld. The violation was explicit in logs.' },
      'admin-1',
    );

    expect(result.appeal.status).toBe('rejected');
    expect(removedWarnings).not.toContain('warn-active-1');
    const warning = mockModerationService.findWarningById('warn-active-1');
    expect(warning.status).toBe('active');

    // User notified of rejection
    expect(notifySpy.calls.length).toBe(1);
    expect(notifySpy.calls[0][0].userId).toBe('user-alice');
    expect(notifySpy.calls[0][0].title).toBe('Appeal Rejected');
    expect(notifySpy.calls[0][0].message).toContain('Review upheld');
  });

  it('rejecting then accepting an appeal throws 409 APPEAL_ALREADY_DECIDED and changes nothing', async () => {
    const appeal = await appealsService.createAppeal(
      'warn-active-1',
      { explanation: 'I would like to contest this warning.' },
      'user-alice',
    );

    await appealsService.decideAppeal(
      appeal.id,
      { decision: 'reject', note: 'Rejected initially.' },
      'admin-1',
    );

    try {
      await appealsService.decideAppeal(
        appeal.id,
        { decision: 'accept', note: 'Attempting to accept after rejection.' },
        'admin-2',
      );
      fail('Should throw ConflictException');
    } catch (err: any) {
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse().code).toBe('APPEAL_ALREADY_DECIDED');
    }
    expect(removedWarnings).not.toContain('warn-active-1');
  });
});
