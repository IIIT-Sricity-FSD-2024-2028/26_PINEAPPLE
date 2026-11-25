import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { ActionFeedbackRepository } from './feedback.repository';
import { ACTION_CONFIGS, REASON_CATEGORIES } from './reason-config';

function createSpy(impl?: (...args: any[]) => any) {
  const calls: any[][] = [];
  const fn: any = (...args: any[]) => {
    calls.push(args);
    return impl ? impl(...args) : undefined;
  };
  fn.calls = calls;
  fn.reset = () => {
    calls.length = 0;
  };
  return fn;
}

describe('FeedbackService', () => {
  let service: FeedbackService;
  let repo: ActionFeedbackRepository;
  let mockAuditService: any;
  let mockClockService: any;
  let mockContentFilter: any;

  beforeEach(() => {
    repo = new ActionFeedbackRepository();
    mockAuditService = {
      log: createSpy(),
    };
    mockClockService = {
      now: createSpy(() => new Date('2026-11-13T10:00:00.000Z')),
    };
    mockContentFilter = {
      assertClean: createSpy(),
    };

    service = new FeedbackService(
      repo,
      mockAuditService,
      mockClockService,
      mockContentFilter,
    );
  });

  describe('Configuration Integrity', () => {
    it('defines 10 distinct reason categories', () => {
      const categoryKeys = Object.keys(REASON_CATEGORIES);
      expect(categoryKeys.length).toBeGreaterThanOrEqual(10);
      expect(REASON_CATEGORIES.WORK_REJECTION).toBeDefined();
      expect(REASON_CATEGORIES.TASK_WITHDRAWAL).toBeDefined();
      expect(REASON_CATEGORIES.COLLAB_DECLINE).toBeDefined();
    });

    it('returns all action configs', () => {
      const configs = service.getReasonsConfig();
      expect(configs).toBeDefined();
      expect(configs.REJECT_APPLICATION).toBeDefined();
      expect(configs.DROP_TASK).toBeDefined();
      expect(configs.REJECT_WORK).toBeDefined();
      expect(configs.DECLINE_INVITATION).toBeDefined();
    });

    it('throws INVALID_ACTION_TYPE for unknown actions', () => {
      expect(() => service.getActionConfig('NON_EXISTENT_ACTION')).toThrow(BadRequestException);
    });

    it('every action config has valid reasons and constraints', () => {
      const configs = service.getReasonsConfig();
      for (const [actionType, config] of Object.entries(configs)) {
        expect(config.title).toBeTruthy();
        expect(config.reasons.length).toBeGreaterThan(0);
        expect(config.minReasons).toBeGreaterThanOrEqual(1);
        for (const reason of config.reasons) {
          expect(reason.id).toBeTruthy();
          expect(reason.label).toBeTruthy();
        }
      }
    });
  });

  describe('Validation Rules', () => {
    it('throws REASON_REQUIRED when reasons array is empty or missing', () => {
      expect(() => {
        service.validate('DECLINE_INVITATION', { reasons: [] });
      }).toThrow(BadRequestException);

      expect(() => {
        service.validate('DECLINE_INVITATION', {} as any);
      }).toThrow(BadRequestException);
    });

    it('throws INVALID_REASON when an unknown reason code is submitted', () => {
      expect(() => {
        service.validate('DECLINE_INVITATION', { reasons: ['TOTALLY_FAKE_REASON_CODE'] });
      }).toThrow(BadRequestException);
    });

    it('requires an explanation when OTHER is selected', () => {
      expect(() => {
        service.validate('DECLINE_INVITATION', { reasons: ['OTHER'] });
      }).toThrow(BadRequestException);

      expect(() => {
        service.validate('DECLINE_INVITATION', { reasons: ['OTHER'], explanation: '   ' });
      }).toThrow(BadRequestException);

      const res = service.validate('DECLINE_INVITATION', {
        reasons: ['OTHER'],
        explanation: 'Conflict with personal schedule',
      });
      expect(res.valid).toBe(true);
      expect(res.explanation).toBe('Conflict with personal schedule');
    });

    it('requires a 10-500 character explanation for REJECT_WORK', () => {
      // Missing explanation
      expect(() => {
        service.validate('REJECT_WORK', { reasons: ['INCOMPLETE_WORK'] });
      }).toThrow(BadRequestException);

      // Too short (<10 chars)
      expect(() => {
        service.validate('REJECT_WORK', { reasons: ['INCOMPLETE_WORK'], explanation: 'too short' });
      }).toThrow(BadRequestException);

      // Valid length (>= 10 chars)
      const validRes = service.validate('REJECT_WORK', {
        reasons: ['INCOMPLETE_WORK'],
        explanation: 'Unit tests are missing for edge cases.',
      });
      expect(validRes.valid).toBe(true);
      expect(validRes.explanation).toBe('Unit tests are missing for edge cases.');
    });

    it('rejects explanations exceeding 500 characters', () => {
      const longExplanation = 'a'.repeat(501);
      expect(() => {
        service.validate('DROP_TASK', {
          reasons: ['PERSONAL_EMERGENCY'],
          explanation: longExplanation,
        });
      }).toThrow(BadRequestException);
    });

    it('validates clean content using ContentFilterService', () => {
      mockContentFilter.assertClean = createSpy(() => {
        throw new BadRequestException('PROFANITY_DETECTED');
      });

      expect(() => {
        service.validate('DROP_TASK', {
          reasons: ['OTHER'],
          explanation: 'bad words included here',
        });
      }).toThrow(BadRequestException);
    });
  });

  describe('Recording and History', () => {
    beforeEach(() => {
      service.registerEntityResolver('TASK', (entityId: string) => {
        if (entityId === 'task-100') {
          return {
            exists: true,
            projectId: 'proj-1',
            parties: ['user-owner', 'user-collab'],
            actorId: 'user-collab',
            targetId: 'user-owner',
          };
        }
        return { exists: false, parties: [] };
      });
    });

    it('records feedback, writes to repo, and logs audit', async () => {
      const record = service.record({
        actionType: 'DROP_TASK',
        entityType: 'TASK',
        entityId: 'task-100',
        actorUserId: 'user-collab',
        targetUserId: 'user-owner',
        projectId: 'proj-1',
        reasons: ['TIME_COMMITMENT'],
        explanation: 'Underestimated study load this semester.',
      });

      expect(record.id).toBeDefined();
      expect(record.reasons).toEqual(['TIME_COMMITMENT']);
      expect(record.explanation).toBe('Underestimated study load this semester.');
      expect(record.projectId).toBe('proj-1');
      expect(record.targetUserId).toBe('user-owner');

      expect(mockAuditService.log.calls.length).toBeGreaterThan(0);
      expect(mockAuditService.log.calls[0][0].action).toBe('ACTION_FEEDBACK_RECORDED');
      expect(mockAuditService.log.calls[0][0].actor).toBe('user-collab');
    });

    it('allows actor, target, project owner, and admin to read history', async () => {
      service.record({
        actionType: 'DROP_TASK',
        entityType: 'TASK',
        entityId: 'task-100',
        actorUserId: 'user-collab',
        targetUserId: 'user-owner',
        projectId: 'proj-1',
        reasons: ['TIME_COMMITMENT'],
      });

      // Actor can read
      const actorHistory = await service.getEntityHistory('TASK', 'task-100', {
        id: 'user-collab',
        role: 'Collaborator',
      });
      expect(actorHistory.length).toBe(1);

      // Affected user can read
      const targetHistory = await service.getEntityHistory('TASK', 'task-100', {
        id: 'user-owner',
        role: 'Project Owner',
      });
      expect(targetHistory.length).toBe(1);

      // Admin can read
      const adminHistory = await service.getEntityHistory('TASK', 'task-100', {
        id: 'random-admin',
        role: 'Admin',
      });
      expect(adminHistory.length).toBe(1);

      // Unrelated user cannot read
      let err: any;
      try {
        await service.getEntityHistory('TASK', 'task-100', {
          id: 'stranger-user',
          role: 'Collaborator',
        });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(ForbiddenException);
    });

    it('returns empty history or throws when entity does not exist', async () => {
      let err: any;
      try {
        await service.getEntityHistory('TASK', 'non-existent', {
          id: 'any-user',
          role: 'Collaborator',
        });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(NotFoundException);
    });
  });
});
