import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { ClockService } from '../common/services/clock.service';

function createSpy<T = any>(impl?: (...args: any[]) => any) {
  const calls: any[][] = [];
  const fn = (...args: any[]) => {
    calls.push(args);
    return impl ? impl(...args) : undefined;
  };
  fn.calls = calls;
  fn.reset = () => {
    calls.length = 0;
  };
  return fn;
}

describe('ModerationService Unit Tests', () => {
  let moderationService: ModerationService;
  let clockService: ClockService;
  let mockReputationService: any;
  let mockSuspensionConsequencesService: any;
  let mockUsersRepo: any;
  let mockMailService: any;
  let mockNotificationsService: any;
  let mockAuditService: any;

  let usersDb: Record<string, any>;
  let recordWarningSpy: any;
  let handleSuspensionSpy: any;
  let sendWarningEmailSpy: any;
  let sendSuspensionEmailSpy: any;
  let createNotificationSpy: any;
  let createAuditSpy: any;

  beforeEach(() => {
    clockService = new ClockService();

    usersDb = {
      'admin-1': { id: 'admin-1', name: 'Admin One', role: 'admin', email: 'admin@tf.io' },
      'user-1': { id: 'user-1', name: 'User One', role: 'collaborator', email: 'user1@tf.io', status: 'Active', activeWarningsCount: 0 },
      'user-2': { id: 'user-2', name: 'User Two', role: 'collaborator', email: 'user2@tf.io', status: 'Suspended', activeWarningsCount: 4 },
      'target-admin': { id: 'target-admin', name: 'Admin Target', role: 'admin', email: 'admin2@tf.io' },
      'target-su': { id: 'target-su', name: 'Super User', role: 'superuser', email: 'su@tf.io' },
    };

    recordWarningSpy = createSpy();
    mockReputationService = {
      recordWarning: recordWarningSpy,
      getReputation: () => 100,
    };

    handleSuspensionSpy = createSpy(async () => undefined);
    mockSuspensionConsequencesService = {
      handleSuspension: handleSuspensionSpy,
    };

    mockUsersRepo = {
      findById: (id: string) => usersDb[id] || null,
      update: (id: string, updates: any) => {
        if (usersDb[id]) {
          Object.assign(usersDb[id], updates);
          return usersDb[id];
        }
        return null;
      },
    };

    sendWarningEmailSpy = createSpy(async () => true);
    sendSuspensionEmailSpy = createSpy(async () => true);
    mockMailService = {
      sendWarningEmail: sendWarningEmailSpy,
      sendSuspensionEmail: sendSuspensionEmailSpy,
    };

    createNotificationSpy = createSpy();
    mockNotificationsService = {
      create: createNotificationSpy,
    };

    createAuditSpy = createSpy();
    mockAuditService = {
      create: createAuditSpy,
    };

    moderationService = new ModerationService(
      clockService,
      mockReputationService,
      mockSuspensionConsequencesService,
      mockUsersRepo,
      mockMailService,
      mockNotificationsService,
      mockAuditService,
    );
  });

  afterEach(() => {
    moderationService.reset();
  });

  describe('Validation & Policy Constraints', () => {
    it('throws REASON_REQUIRED when reason is shorter than 10 characters', async () => {
      await expect(
        moderationService.warn('admin-1', 'user-1', 'short'),
      ).rejects.toThrow(BadRequestException);

      try {
        await moderationService.warn('admin-1', 'user-1', 'too short');
      } catch (err: any) {
        expect(err.getResponse().code).toBe('REASON_REQUIRED');
      }
    });

    it('throws REASON_REQUIRED when reason exceeds 500 characters', async () => {
      const longReason = 'a'.repeat(501);
      await expect(
        moderationService.warn('admin-1', 'user-1', longReason),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws CANNOT_MODERATE_SELF (403) when actor attempts to moderate themselves', async () => {
      await expect(
        moderationService.warn('admin-1', 'admin-1', 'Valid explanation reason here'),
      ).rejects.toThrow(ForbiddenException);

      try {
        await moderationService.warn('admin-1', 'admin-1', 'Valid explanation reason here');
      } catch (err: any) {
        expect(err.getResponse().code).toBe('CANNOT_MODERATE_SELF');
      }
    });

    it('throws CANNOT_MODERATE_ADMIN (403) when target is an admin or superuser', async () => {
      await expect(
        moderationService.warn('admin-1', 'target-admin', 'Valid explanation reason here'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        moderationService.warn('admin-1', 'target-su', 'Valid explanation reason here'),
      ).rejects.toThrow(ForbiddenException);

      try {
        await moderationService.warn('admin-1', 'target-admin', 'Valid explanation reason here');
      } catch (err: any) {
        expect(err.getResponse().code).toBe('CANNOT_MODERATE_ADMIN');
      }
    });

    it('throws USER_NOT_FOUND (404) when target user does not exist', async () => {
      await expect(
        moderationService.warn('admin-1', 'non-existent', 'Valid explanation reason here'),
      ).rejects.toThrow(NotFoundException);

      try {
        await moderationService.warn('admin-1', 'non-existent', 'Valid explanation reason here');
      } catch (err: any) {
        expect(err.getResponse().code).toBe('USER_NOT_FOUND');
      }
    });
  });

  describe('Warning Flow & Automatic Suspension', () => {
    it('issues warning with incrementing active count, sends email, and sends titled notification', async () => {
      const res = await moderationService.warn('admin-1', 'user-1', 'Violation of conduct policy');

      expect(res.activeCount).toBe(1);
      expect(res.autoSuspended).toBe(false);
      expect(res.warning.status).toBe('active');
      expect(recordWarningSpy.calls.length).toBe(1);
      expect(recordWarningSpy.calls[0]).toEqual(['user-1', res.warning.id]);

      // Notification check
      expect(createNotificationSpy.calls.length).toBe(1);
      expect(createNotificationSpy.calls[0][0].userId).toBe('user-1');
      expect(createNotificationSpy.calls[0][0].title).toBe('Warning 1/4');
      expect(createNotificationSpy.calls[0][0].message).toBe('Violation of conduct policy');

      // Email check
      expect(sendWarningEmailSpy.calls.length).toBe(1);
      expect(sendWarningEmailSpy.calls[0][0].to).toBe('user1@tf.io');
      expect(sendWarningEmailSpy.calls[0][0].warningNumber).toBe(1);
      expect(sendWarningEmailSpy.calls[0][0].maxWarnings).toBe(4);
      expect(sendWarningEmailSpy.calls[0][0].reason).toBe('Violation of conduct policy');
    });

    it('automatically suspends user on the 4th active warning', async () => {
      await moderationService.warn('admin-1', 'user-1', 'Warning number one explanation');
      await moderationService.warn('admin-1', 'user-1', 'Warning number two explanation');
      await moderationService.warn('admin-1', 'user-1', 'Warning number three explanation');

      const fourth = await moderationService.warn('admin-1', 'user-1', 'Warning number four explanation');

      expect(fourth.activeCount).toBe(4);
      expect(fourth.autoSuspended).toBe(true);

      // Verify suspension consequences triggered
      expect(handleSuspensionSpy.calls.length).toBe(1);
      expect(handleSuspensionSpy.calls[0]).toEqual([
        'user-1',
        'Automatic suspension after 4 warnings',
      ]);

      // Verify user record updated to Suspended with bumped tokenVersion
      expect(usersDb['user-1'].status).toBe('Suspended');
      expect(usersDb['user-1'].suspendedReason).toBe('Automatic suspension after 4 warnings');
      expect(usersDb['user-1'].tokenVersion).toBeGreaterThan(0);

      // Verify suspension email sent, and NO extra notification sent for suspension
      expect(sendSuspensionEmailSpy.calls.length).toBe(1);
      expect(sendSuspensionEmailSpy.calls[0][0].to).toBe('user1@tf.io');
      expect(sendSuspensionEmailSpy.calls[0][0].reason).toBe('Automatic suspension after 4 warnings');
    });
  });

  describe('Manual Suspension & Reactivation', () => {
    it('suspends user, triggers consequences, sends mail only, and prevents duplicate suspension', async () => {
      const res = await moderationService.suspend('admin-1', 'user-1', 'Direct suspension by admin');
      expect(res.status).toBe('suspended');
      expect(usersDb['user-1'].status).toBe('Suspended');

      // Mail sent, no notification
      expect(sendSuspensionEmailSpy.calls.length).toBe(1);
      expect(sendSuspensionEmailSpy.calls[0][0].to).toBe('user1@tf.io');
      expect(sendSuspensionEmailSpy.calls[0][0].reason).toBe('Direct suspension by admin');

      // Already suspended -> ALREADY_SUSPENDED (409)
      await expect(
        moderationService.suspend('admin-1', 'user-1', 'Another suspension attempt'),
      ).rejects.toThrow(ConflictException);

      try {
        await moderationService.suspend('admin-1', 'user-1', 'Another suspension attempt');
      } catch (err: any) {
        expect(err.getResponse().code).toBe('ALREADY_SUSPENDED');
      }
    });

    it('reactivates user, clears active warnings to cleared status, sends notification only, no mail', async () => {
      // Issue 2 warnings first
      await moderationService.warn('admin-1', 'user-1', 'First warning for user 1');
      await moderationService.warn('admin-1', 'user-1', 'Second warning for user 1');
      // Suspend
      await moderationService.suspend('admin-1', 'user-1', 'Manual suspension for testing');

      createNotificationSpy.reset();
      sendSuspensionEmailSpy.reset();

      const res = await moderationService.reactivate('admin-1', 'user-1', 'Account appeal granted');
      expect(res.status).toBe('active');
      expect(res.clearedWarnings).toBe(2);
      expect(usersDb['user-1'].status).toBe('Active');
      expect(usersDb['user-1'].activeWarningsCount).toBe(0);

      // Check active count is 0
      expect(moderationService.getActiveWarningsCount('user-1')).toBe(0);

      // Notification sent, but NO mail sent
      expect(createNotificationSpy.calls.length).toBe(1);
      expect(createNotificationSpy.calls[0][0].userId).toBe('user-1');
      expect(createNotificationSpy.calls[0][0].type).toBe('ACCOUNT_REACTIVATED');
      expect(createNotificationSpy.calls[0][0].title).toBe('Account Reactivated');
      expect(createNotificationSpy.calls[0][0].message).toContain('Account appeal granted');
      expect(sendSuspensionEmailSpy.calls.length).toBe(0);

      // Attempting to reactivate again -> NOT_SUSPENDED (409)
      await expect(
        moderationService.reactivate('admin-1', 'user-1', 'Reactivate again explanation'),
      ).rejects.toThrow(ConflictException);

      try {
        await moderationService.reactivate('admin-1', 'user-1', 'Reactivate again explanation');
      } catch (err: any) {
        expect(err.getResponse().code).toBe('NOT_SUSPENDED');
      }
    });
  });

  describe('Warnings Queries', () => {
    it('returns admin warnings with moderatorName and own warnings with N/4 labels', async () => {
      await moderationService.warn('admin-1', 'user-1', 'Violation one reason');
      await moderationService.warn('admin-1', 'user-1', 'Violation two reason');

      const adminView = moderationService.getAdminUserWarnings('user-1');
      expect(adminView).toHaveLength(2);
      expect(adminView[0].moderatorName).toBe('Admin One');

      const userView = moderationService.getUserOwnWarnings('user-1');
      expect(userView).toHaveLength(2);
      expect(userView[0].label).toBe('Warning 1/4');
      expect(userView[1].label).toBe('Warning 2/4');
    });
  });
});
