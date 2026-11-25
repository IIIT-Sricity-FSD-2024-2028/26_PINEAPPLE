import { JoinRequestsService } from './join-requests.service';
import { ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';

function createSpy<T = any>(impl?: (...args: any[]) => any) {
  const calls: any[][] = [];
  const fn: any = (...args: any[]) => {
    calls.push(args);
    return impl ? impl(...args) : undefined;
  };
  fn.calls = calls;
  fn.mockReturnValue = (val: any) => {
    return createSpy(() => val);
  };
  fn.reset = () => {
    calls.length = 0;
  };
  return fn;
}

describe('JoinRequestsService - Phase 3 Limit & State Machine', () => {
  let service: JoinRequestsService;
  let mockProjectsService: any;
  let mockAuditService: any;
  let mockNotificationsService: any;
  let mockClockService: any;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';

    mockProjectsService = {
      findById: (id: string) => ({
        id: id || 'proj-1',
        title: 'Alpha Project',
        ownerId: 'owner-1',
        status: 'Open',
        maxCollaborators: 3,
        collaborators: [],
        removedUsers: [],
      }),
      isLocked: () => false,
      isFull: () => false,
      addCollaborator: createSpy(),
    };

    mockAuditService = {
      log: createSpy(),
    };

    mockNotificationsService = {
      create: createSpy(),
    };

    mockClockService = {
      now: () => new Date('2026-03-01T12:00:00Z'),
      nowIso: () => '2026-03-01T12:00:00.000Z',
    };

    service = new JoinRequestsService(
      mockProjectsService,
      mockAuditService,
      mockNotificationsService,
      mockClockService,
    );
    service.reset();
  });

  describe('requestsUsed & requestsLeft table', () => {
    it('counts pending, approved, rejected, withdrawn requests toward the limit of 2', async () => {
      // 1. Pending request
      const req1 = service.create({
        projectId: 'proj-1',
        userId: 'user-a',
        userName: 'User A',
        message: 'First attempt',
      });
      expect(service.requestsUsed('user-a', 'proj-1')).toBe(1);
      expect(service.requestsLeft('user-a', 'proj-1')).toBe(1);

      // 2. Reject request
      await service.update(req1.id, {
        status: 'rejected',
        reason: 'Need someone with more backend experience',
      }, 'owner-1');
      expect(service.requestsUsed('user-a', 'proj-1')).toBe(1);
      expect(service.requestsLeft('user-a', 'proj-1')).toBe(1);

      // 3. Second request
      service.create({
        projectId: 'proj-1',
        userId: 'user-a',
        userName: 'User A',
        message: 'Second attempt with more details',
      });
      expect(service.requestsUsed('user-a', 'proj-1')).toBe(2);
      expect(service.requestsLeft('user-a', 'proj-1')).toBe(0);

      // 4. Third request is blocked with REQUEST_LIMIT_REACHED (409)
      expect(() => {
        service.create({
          projectId: 'proj-1',
          userId: 'user-a',
          userName: 'User A',
          message: 'Third attempt',
        });
      }).toThrow(ConflictException);
    });

    it('does NOT count system_closed requests against the user', () => {
      // Create request
      service.create({
        projectId: 'proj-1',
        userId: 'user-b',
        userName: 'User B',
        message: 'Interested in contributing',
      });
      expect(service.requestsUsed('user-b', 'proj-1')).toBe(1);

      // System closes requests (e.g. project closed or full)
      service.closePendingRequestsForProject('proj-1', 'Project closed: Owner suspended');

      // Now status is system_closed
      expect(service.requestsUsed('user-b', 'proj-1')).toBe(0);
      expect(service.requestsLeft('user-b', 'proj-1')).toBe(2);
    });

    it('isolates counts per project so requests on project A do not affect project B', async () => {
      mockProjectsService.findById = (id: string) => ({
        id,
        title: `Project ${id}`,
        ownerId: 'owner-1',
        status: 'Open',
        collaborators: [],
      });

      // 2 requests on proj-1
      const r1 = service.create({ projectId: 'proj-1', userId: 'user-c', userName: 'User C', message: 'Hi' });
      await service.update(r1.id, { status: 'rejected', reason: 'Not enough experience' }, 'owner-1');
      const r2 = service.create({ projectId: 'proj-1', userId: 'user-c', userName: 'User C', message: 'Hi again' });
      await service.update(r2.id, { status: 'rejected', reason: 'Position filled' }, 'owner-1');

      expect(service.requestsUsed('user-c', 'proj-1')).toBe(2);
      expect(service.requestsLeft('user-c', 'proj-1')).toBe(0);

      // proj-2 still has 2 requests left
      expect(service.requestsUsed('user-c', 'proj-2')).toBe(0);
      expect(service.requestsLeft('user-c', 'proj-2')).toBe(2);

      const r3 = service.create({ projectId: 'proj-2', userId: 'user-c', userName: 'User C', message: 'Hi proj 2' });
      expect(r3.id).toBeDefined();
      expect(service.requestsUsed('user-c', 'proj-2')).toBe(1);
    });

    it('withdrawn requests after 2 hours count toward the limit of 2 (early unviewed restores slot)', () => {
      let nowIso = '2026-03-01T12:00:00.000Z';
      mockClockService.now = () => new Date(nowIso);
      mockClockService.nowIso = () => nowIso;

      // Early withdraw within 1 hour with empty viewedAt restores slot
      const r0 = service.create({ projectId: 'proj-1', userId: 'user-early', userName: 'User Early', message: 'Applying early' });
      nowIso = '2026-03-01T13:00:00.000Z'; // +1 hour
      const resEarly = service.withdrawRequest(r0.id);
      expect(resEarly.slotRestored).toBe(true);
      expect(service.requestsUsed('user-early', 'proj-1')).toBe(0);
      expect(service.requestsLeft('user-early', 'proj-1')).toBe(2);

      // Late withdraw after 3 hours still counts toward limit
      nowIso = '2026-03-01T12:00:00.000Z';
      const r1 = service.create({ projectId: 'proj-1', userId: 'user-d', userName: 'User D', message: 'Applying' });
      nowIso = '2026-03-01T15:00:00.000Z'; // +3 hours
      service.remove(r1.id);

      const updated = service.findOne(r1.id);
      expect(updated.status).toBe('withdrawn');
      expect(service.requestsUsed('user-d', 'proj-1')).toBe(1);
      expect(service.requestsLeft('user-d', 'proj-1')).toBe(1);
    });
  });

  describe('getMyRequestStatus state mapping', () => {
    it('returns "none" when no prior requests exist', () => {
      const status = service.getMyRequestStatus('user-new', 'proj-1');
      expect(status).toEqual({
        state: 'none',
        requestsUsed: 0,
        requestsLeft: 2,
      });
    });

    it('returns "pending" when user has an active pending request', () => {
      service.create({ projectId: 'proj-1', userId: 'user-pending', userName: 'Pending User', message: 'Hi' });
      const status = service.getMyRequestStatus('user-pending', 'proj-1');
      expect(status.state).toBe('pending');
      expect(status.requestsUsed).toBe(1);
      expect(status.requestsLeft).toBe(1);
    });

    it('returns "rejected_can_retry" after first rejection', async () => {
      const r = service.create({ projectId: 'proj-1', userId: 'user-rej1', userName: 'Rej User', message: 'Hi' });
      await service.update(r.id, { status: 'rejected', reason: 'Need 1+ year React experience' }, 'owner-1');

      const status = service.getMyRequestStatus('user-rej1', 'proj-1');
      expect(status.state).toBe('rejected_can_retry');
      expect(status.requestsUsed).toBe(1);
      expect(status.requestsLeft).toBe(1);
      expect(status.lastReason).toBe('Need 1+ year React experience');
    });

    it('returns "rejected_final" after second rejection', async () => {
      const r1 = service.create({ projectId: 'proj-1', userId: 'user-rej2', userName: 'Rej2 User', message: 'Hi 1' });
      await service.update(r1.id, { status: 'rejected', reason: 'First rejection reason exceeding 10 chars' }, 'owner-1');

      const r2 = service.create({ projectId: 'proj-1', userId: 'user-rej2', userName: 'Rej2 User', message: 'Hi 2' });
      await service.update(r2.id, { status: 'rejected', reason: 'Second rejection reason exceeding 10 chars' }, 'owner-1');

      const status = service.getMyRequestStatus('user-rej2', 'proj-1');
      expect(status.state).toBe('rejected_final');
      expect(status.requestsUsed).toBe(2);
      expect(status.requestsLeft).toBe(0);
      expect(status.lastReason).toBe('Second rejection reason exceeding 10 chars');
    });

    it('returns "member" when user is already a collaborator or owner', () => {
      mockProjectsService.findById = () => ({
        id: 'proj-1',
        title: 'Alpha Project',
        ownerId: 'owner-1',
        collaborators: [{ id: 'user-collab', name: 'Collab User' }],
      });

      const collabStatus = service.getMyRequestStatus('user-collab', 'proj-1');
      expect(collabStatus.state).toBe('member');

      const ownerStatus = service.getMyRequestStatus('owner-1', 'proj-1');
      expect(ownerStatus.state).toBe('member');
    });

    it('returns "banned" when user was removed by owner', () => {
      mockProjectsService.findById = () => ({
        id: 'proj-1',
        title: 'Alpha Project',
        ownerId: 'owner-1',
        collaborators: [],
        removedUsers: [{ userId: 'user-banned', reason: 'Violation of project guidelines' }],
      });

      const status = service.getMyRequestStatus('user-banned', 'proj-1');
      expect(status.state).toBe('banned');
      expect(status.lastReason).toBe('Violation of project guidelines');
    });

    it('returns "closed" when project is closed', () => {
      mockProjectsService.findById = () => ({
        id: 'proj-1',
        title: 'Alpha Project',
        ownerId: 'owner-1',
        status: 'Closed',
        closureReason: 'No applicants within 5 days',
        collaborators: [],
      });

      const status = service.getMyRequestStatus('user-any', 'proj-1');
      expect(status.state).toBe('closed');
      expect(status.lastReason).toBe('No applicants within 5 days');
    });
  });

  describe('owner rejection validation', () => {
    it('requires a 10-500 character written reason from owner', async () => {
      const r = service.create({ projectId: 'proj-1', userId: 'user-x', userName: 'User X', message: 'Hi' });

      // Missing reason
      await expect(
        service.update(r.id, { status: 'rejected' }, 'owner-1')
      ).rejects.toThrow(BadRequestException);

      // Too short reason (< 10 chars)
      await expect(
        service.update(r.id, { status: 'rejected', reason: 'Too short' }, 'owner-1')
      ).rejects.toThrow(BadRequestException);

      // Non-owner cannot reject
      await expect(
        service.update(r.id, { status: 'rejected', reason: 'Valid 10+ character rejection reason' }, 'imposter-user')
      ).rejects.toThrow(ForbiddenException);

      // Owner with valid reason succeeds
      const updated = await service.update(
        r.id,
        { status: 'rejected', reason: 'Skillset does not match project requirements' },
        'owner-1',
      );
      expect(updated.status).toBe('rejected');
      expect(updated.rejectionReason).toBe('Skillset does not match project requirements');
    });
  });

  describe('Phase 8: Queue serialization and Capacity invariant', () => {
    it('serialises concurrent approvals for 1 free slot: exactly 1 succeeds and 4 fail with PROJECT_FULL or REQUEST_ALREADY_DECIDED', async () => {
      const collabs: any[] = [];
      const projectData = {
        id: 'proj-queue-1',
        title: 'Queue Project',
        ownerId: 'owner-1',
        status: 'Open',
        maxCollaborators: 1,
        collaborators: collabs,
        removedUsers: [],
      };

      mockProjectsService.findById = (id: string) => projectData;
      mockProjectsService.isFull = (p: any) => collabs.length >= 1;
      mockProjectsService.addCollaborator = (pId: string, user: any) => {
        collabs.push(user);
      };

      const reqs = [
        service.create({ projectId: 'proj-queue-1', userId: 'user-1', userName: 'User 1', message: 'Hello 1' }),
        service.create({ projectId: 'proj-queue-1', userId: 'user-2', userName: 'User 2', message: 'Hello 2' }),
        service.create({ projectId: 'proj-queue-1', userId: 'user-3', userName: 'User 3', message: 'Hello 3' }),
        service.create({ projectId: 'proj-queue-1', userId: 'user-4', userName: 'User 4', message: 'Hello 4' }),
        service.create({ projectId: 'proj-queue-1', userId: 'user-5', userName: 'User 5', message: 'Hello 5' }),
      ];

      // Fire 5 approvals concurrently
      const results = await Promise.allSettled(
        reqs.map((r) => service.update(r.id, { status: 'approved' }, 'owner-1'))
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(4);

      for (const rej of rejected) {
        const reason = (rej as PromiseRejectedResult).reason;
        expect(reason).toBeInstanceOf(ConflictException);
        const code = reason.getResponse()?.code;
        expect(['PROJECT_FULL', 'REQUEST_ALREADY_DECIDED']).toContain(code);
      }

      // Invariant: exactly 1 collaborator added
      expect(collabs).toHaveLength(1);
    });

    it('firing 5 concurrent approvals on the same request allows exactly 1 to succeed', async () => {
      const collabs: any[] = [];
      const projectData = {
        id: 'proj-queue-2',
        title: 'Queue Project 2',
        ownerId: 'owner-1',
        status: 'Open',
        maxCollaborators: 5,
        collaborators: collabs,
        removedUsers: [],
      };

      mockProjectsService.findById = (id: string) => projectData;
      mockProjectsService.isFull = () => false;
      mockProjectsService.addCollaborator = (pId: string, user: any) => {
        collabs.push(user);
      };

      const req = service.create({ projectId: 'proj-queue-2', userId: 'user-race', userName: 'Race User', message: 'Race' });

      const results = await Promise.allSettled([
        service.update(req.id, { status: 'approved' }, 'owner-1'),
        service.update(req.id, { status: 'approved' }, 'owner-1'),
        service.update(req.id, { status: 'approved' }, 'owner-1'),
        service.update(req.id, { status: 'approved' }, 'owner-1'),
        service.update(req.id, { status: 'approved' }, 'owner-1'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(4);

      for (const rej of rejected) {
        const reason = (rej as PromiseRejectedResult).reason;
        expect(reason).toBeInstanceOf(ConflictException);
        expect(reason.getResponse()?.code).toBe('REQUEST_ALREADY_DECIDED');
      }
    });
  });
});
