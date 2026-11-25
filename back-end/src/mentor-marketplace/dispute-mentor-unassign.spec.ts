import { ConflictException } from '@nestjs/common';
import {
  MentorMarketplaceService,
  calculateEscrowBreakdown,
} from './mentor-marketplace.service';
import { ProjectsService } from '../projects/projects.service';
import { EscrowService } from '../escrow/escrow.service';
import { DemoUpiProvider } from './payments/demo-upi.provider';
import { ClockService } from '../common/services/clock.service';
import { UserRole } from '../users/dto/create-user.dto';

describe('Escrow Dispute Refund Mentor Slot Clearing Spec', () => {
  let service: MentorMarketplaceService;
  let escrowService: EscrowService;
  let paymentProvider: DemoUpiProvider;
  let clockService: ClockService;
  let auditLogs: any[];
  let notifications: any[];
  let projectStore: Map<string, any>;
  let userStore: Map<string, any>;

  const BASE_TIME = '2026-06-01T08:00:00.000Z';

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    clockService = new ClockService();
    clockService.setTime(BASE_TIME);

    escrowService = new EscrowService();
    paymentProvider = new DemoUpiProvider(clockService);
    auditLogs = [];
    notifications = [];

    userStore = new Map([
      [
        'owner-1',
        {
          id: 'owner-1',
          name: 'Project Owner 1',
          email: 'owner1@example.com',
          role: UserRole.ProjectOwner,
          status: 'Active',
        },
      ],
      [
        'mentor-user-1',
        {
          id: 'mentor-user-1',
          name: 'Expert Mentor',
          email: 'expert@example.com',
          role: UserRole.Mentor,
          status: 'Active',
        },
      ],
      [
        'replacement-mentor-user',
        {
          id: 'replacement-mentor-user',
          name: 'Replacement Mentor',
          email: 'replacement@example.com',
          role: UserRole.Mentor,
          status: 'Active',
        },
      ],
    ]);

    projectStore = new Map([
      [
        'proj-1',
        {
          id: 'proj-1',
          ownerId: 'owner-1',
          title: 'Fullstack App Project',
          status: 'Open',
          dueDate: '2026-10-01T00:00:00.000Z',
          isCompleted: false,
          collaborators: [],
          mentorId: 'mentor-user-1',
          mentor: 'Expert Mentor',
        },
      ],
      [
        'proj-split-0',
        {
          id: 'proj-split-0',
          ownerId: 'owner-1',
          title: 'Split 0 Test Project',
          status: 'Open',
          dueDate: '2026-10-01T00:00:00.000Z',
          isCompleted: false,
          collaborators: [],
          mentorId: 'mentor-user-1',
          mentor: 'Expert Mentor',
        },
      ],
      [
        'proj-release',
        {
          id: 'proj-release',
          ownerId: 'owner-1',
          title: 'Release Test Project',
          status: 'Open',
          dueDate: '2026-10-01T00:00:00.000Z',
          isCompleted: false,
          collaborators: [],
          mentorId: 'mentor-user-1',
          mentor: 'Expert Mentor',
        },
      ],
      [
        'proj-split-50',
        {
          id: 'proj-split-50',
          ownerId: 'owner-1',
          title: 'Split 50 Test Project',
          status: 'Open',
          dueDate: '2026-10-01T00:00:00.000Z',
          isCompleted: false,
          collaborators: [],
          mentorId: 'mentor-user-1',
          mentor: 'Expert Mentor',
        },
      ],
    ]);

    const mockProjectsRepository: any = {
      findById: (id: string, includeDeleted = false) => {
        const p = projectStore.get(id);
        if (!p) return null;
        if (p.deletedAt && !includeDeleted) return null;
        return p;
      },
      update: (id: string, patch: any) => {
        const existing = projectStore.get(id);
        if (existing) Object.assign(existing, patch);
        return existing;
      },
      findAll: () => Array.from(projectStore.values()).filter((p) => !p.deletedAt),
    };

    const mockAuditService: any = {
      log: (entry: any) => auditLogs.push(entry),
    };

    const mockNotificationsService: any = {
      create: (entry: any) => notifications.push(entry),
    };

    const mockPayoutsService: any = {
      recordTransaction: () => undefined,
    };

    const mockUsersService: any = {
      findById: (id: string) => userStore.get(String(id)) || null,
      findUserSafe: (id: string) => userStore.get(String(id)) || null,
      findAll: () => Array.from(userStore.values()),
    };

    const mockGamificationService: any = {
      awardBadges: () => undefined,
      awardXp: () => undefined,
    };

    const mockMentorApplicationsService: any = {
      findByUser: (uid: string) => [{ id: `app-${uid}`, userId: uid, status: 'approved' }],
      findByStatus: () => [],
    };

    service = new MentorMarketplaceService(
      escrowService,
      mockPayoutsService,
      mockUsersService,
      mockGamificationService,
      mockNotificationsService,
      mockMentorApplicationsService,
      mockProjectsRepository,
      mockAuditService,
      paymentProvider,
      clockService,
    );

    (service as any).sessions = [];
    (service as any).disputes = [];
    (service as any).abandonmentReviews = [];

    // Register mentor profiles
    (service as any).profiles = [
      {
        id: 'mentor-profile-1',
        userId: 'mentor-user-1',
        name: 'Expert Mentor',
        title: 'Senior Architect',
        bio: '10+ years architecting cloud applications',
        skills: ['Node.js', 'NestJS', 'React'],
        sessionPrice: 1000,
        status: 'approved',
        isAvailable: true,
        rating: 5.0,
        totalReviews: 10,
        totalSessions: 15,
      },
      {
        id: 'replacement-mentor-profile',
        userId: 'replacement-mentor-user',
        name: 'Replacement Mentor',
        title: 'Staff Engineer',
        bio: 'Specialist in distributed systems',
        skills: ['TypeScript', 'Microservices'],
        sessionPrice: 1200,
        status: 'approved',
        isAvailable: true,
        rating: 4.9,
        totalReviews: 8,
        totalSessions: 12,
      },
    ];
  });

  // Helper to setup a disputed session
  function setupDisputedSession(
    sessionId: string,
    projectId: string,
    mentorProfileId: string = 'mentor-profile-1',
    price: number = 1000,
  ) {
    const escrow = escrowService.fundForSession(sessionId, price);
    const breakdown = calculateEscrowBreakdown(price);
    const session: any = {
      id: sessionId,
      mentorId: mentorProfileId,
      studentId: 'owner-1',
      projectId,
      projectDescription: 'Mentorship on app architecture',
      agreedPrice: price,
      platformFee: breakdown.platformFee,
      gatewayFee: breakdown.gatewayFee,
      totalAmount: breakdown.totalAmount,
      payout: breakdown.mentorPayout,
      escrowId: escrow.id,
      status: 'active',
      disputed: true,
      createdAt: clockService.nowIso(),
    };
    (service as any).sessions.push(session);

    const dispute: any = {
      id: `dispute-${sessionId}`,
      sessionId,
      raisedBy: 'owner-1',
      role: 'project-owner',
      reason: 'Mentor was unresponsive and missed sessions',
      status: 'open',
      createdAt: clockService.nowIso(),
    };
    (service as any).disputes.push(dispute);

    return { session, dispute, escrow };
  }

  describe('1. Full Refund to Owner (refund_to_owner)', () => {
    it('sets project.mentorId and project.mentor to null, logs mentorUnassigned: true, and marks session refunded', async () => {
      const { dispute, session } = setupDisputedSession('sess-refund', 'proj-1');
      const projectBefore = projectStore.get('proj-1');
      expect(projectBefore.mentorId).toBe('mentor-user-1');
      expect(projectBefore.mentor).toBe('Expert Mentor');

      const result = await service.decideDispute(dispute.id, 'admin-1', {
        decision: 'refund_to_owner',
        reason: 'Mentor completely abandoned the session deliverables.',
      });

      // Session refunded
      expect(result.session.status).toBe('refunded');
      expect(result.dispute.status).toBe('decided');
      expect(result.dispute.decision).toBe('refund_to_owner');
      expect(result.dispute.ownerRefundAmount).toBe(session.totalAmount);

      // Project mentor slot cleared
      const projectAfter = projectStore.get('proj-1');
      expect(projectAfter.mentorId).toBeNull();
      expect(projectAfter.mentor).toBeNull();

      // Audit log records mentorUnassigned: true
      const disputeAudit = auditLogs.find(
        (l) => l.action === 'escrow-dispute-decided' && l.details?.disputeId === dispute.id,
      );
      expect(disputeAudit).toBeDefined();
      expect(disputeAudit.details.mentorUnassigned).toBe(true);
      expect(disputeAudit.details.decision).toBe('refund_to_owner');
    });

    it('sends owner notification stating mentor has been unassigned and project is open for a new booking', async () => {
      const { dispute } = setupDisputedSession('sess-refund-notif', 'proj-1');

      await service.decideDispute(dispute.id, 'admin-1', {
        decision: 'refund_to_owner',
        reason: 'Valid owner dispute claim.',
      });

      const ownerNotice = notifications.find(
        (n) => n.userId === 'owner-1' && n.type === 'ESCROW_DISPUTE_DECIDED',
      );
      expect(ownerNotice).toBeDefined();
      expect(ownerNotice.message).toContain('mentor has been unassigned');
      expect(ownerNotice.message).toContain('project is open for a new mentor booking');

      // Mentor notification does not include unassigned text
      const mentorNotice = notifications.find(
        (n) => n.userId === 'mentor-user-1' && n.type === 'ESCROW_DISPUTE_DECIDED',
      );
      expect(mentorNotice).toBeDefined();
      expect(mentorNotice.message).not.toContain('open for a new mentor booking');
    });
  });

  describe('2. Split Decision with 0% Mentor Payout', () => {
    it('clears project.mentorId and project.mentor and logs mentorUnassigned: true when mentorPercent is 0', async () => {
      const { dispute } = setupDisputedSession('sess-split-0', 'proj-split-0');

      const result = await service.decideDispute(dispute.id, 'admin-1', {
        decision: 'split',
        mentorPercent: 0,
        reason: 'Zero deliverables produced so mentor payout is 0%.',
      });

      expect(result.session.status).toBe('refunded');
      expect(result.dispute.status).toBe('decided');

      const projectAfter = projectStore.get('proj-split-0');
      expect(projectAfter.mentorId).toBeNull();
      expect(projectAfter.mentor).toBeNull();

      const disputeAudit = auditLogs.find(
        (l) => l.action === 'escrow-dispute-decided' && l.details?.disputeId === dispute.id,
      );
      expect(disputeAudit).toBeDefined();
      expect(disputeAudit.details.mentorUnassigned).toBe(true);

      const ownerNotice = notifications.find(
        (n) => n.userId === 'owner-1' && n.referenceId === 'sess-split-0',
      );
      expect(ownerNotice.message).toContain('mentor has been unassigned');
      expect(ownerNotice.message).toContain('project is open for a new mentor booking');
    });
  });

  describe('3. Non-Full-Refund Decisions Keep Mentor Slot Intact', () => {
    it('keeps project.mentorId intact and does not log mentorUnassigned on release_to_mentor', async () => {
      const { dispute } = setupDisputedSession('sess-release', 'proj-release');

      const result = await service.decideDispute(dispute.id, 'admin-1', {
        decision: 'release_to_mentor',
        reason: 'Mentor delivered all agreed architectural sessions.',
      });

      expect(result.session.status).toBe('completed');
      const projectAfter = projectStore.get('proj-release');
      expect(projectAfter.mentorId).toBe('mentor-user-1');
      expect(projectAfter.mentor).toBe('Expert Mentor');

      const disputeAudit = auditLogs.find(
        (l) => l.action === 'escrow-dispute-decided' && l.details?.disputeId === dispute.id,
      );
      expect(disputeAudit.details.mentorUnassigned).toBeUndefined();
    });

    it('keeps project.mentorId intact and does not log mentorUnassigned on split with pct > 0', async () => {
      const { dispute } = setupDisputedSession('sess-split-50', 'proj-split-50');

      const result = await service.decideDispute(dispute.id, 'admin-1', {
        decision: 'split',
        mentorPercent: 50,
        reason: 'Half of the agreed deliverables completed.',
      });

      expect(result.session.status).toBe('split');
      const projectAfter = projectStore.get('proj-split-50');
      expect(projectAfter.mentorId).toBe('mentor-user-1');
      expect(projectAfter.mentor).toBe('Expert Mentor');

      const disputeAudit = auditLogs.find(
        (l) => l.action === 'escrow-dispute-decided' && l.details?.disputeId === dispute.id,
      );
      expect(disputeAudit.details.mentorUnassigned).toBeUndefined();
    });
  });

  describe('4. Replacement Booking Immediately Succeeds Without 409 Conflict', () => {
    it('allows project owner to book a new mentor on the same project immediately after dispute refund', async () => {
      const { dispute } = setupDisputedSession('sess-to-refund', 'proj-1');

      // Before dispute resolution, project has mentorId 'mentor-user-1'
      // Booking a new mentor throws 409 Conflict: 'This project already has an active or pending mentor session.'
      await expect(
        service.createBooking('owner-1', {
          projectId: 'proj-1',
          mentorId: 'replacement-mentor-profile',
          projectDescription: 'Replacement mentoring needed',
        }),
      ).rejects.toThrow(ConflictException);

      // Now resolve dispute with refund_to_owner
      await service.decideDispute(dispute.id, 'admin-1', {
        decision: 'refund_to_owner',
        reason: 'Full refund to owner and unassign mentor.',
      });

      // Project mentor slot is now cleared
      expect(projectStore.get('proj-1').mentorId).toBeNull();

      // Immediately call createBooking for the replacement mentor
      const newBooking = await service.createBooking('owner-1', {
        projectId: 'proj-1',
        mentorId: 'replacement-mentor-profile',
        projectDescription: 'New architectural review after refund',
      });

      expect(newBooking).toBeDefined();
      expect(newBooking.session).toBeDefined();
      expect(newBooking.session.mentorId).toBe('replacement-mentor-profile');
      expect(newBooking.session.studentId).toBe('owner-1');
      expect(newBooking.session.projectId).toBe('proj-1');
      expect(newBooking.session.status).toBe('payment_pending');
      expect(newBooking.paymentIntent).toBeDefined();
    });
  });

  describe('5. Profile ID vs User ID Mentor Identification', () => {
    it('clears project mentor slot when project.mentorId holds profile ID instead of user ID', async () => {
      projectStore.set('proj-profile-id', {
        id: 'proj-profile-id',
        ownerId: 'owner-1',
        title: 'Project using Profile ID',
        status: 'Open',
        dueDate: '2026-10-01T00:00:00.000Z',
        isCompleted: false,
        collaborators: [],
        mentorId: 'mentor-profile-1', // Stored as profile ID
        mentor: 'Expert Mentor',
      });

      const { dispute } = setupDisputedSession('sess-profile-id', 'proj-profile-id', 'mentor-profile-1');

      await service.decideDispute(dispute.id, 'admin-1', {
        decision: 'refund_to_owner',
        reason: 'Refund and unassign mentor using profile ID.',
      });

      const projectAfter = projectStore.get('proj-profile-id');
      expect(projectAfter.mentorId).toBeNull();
      expect(projectAfter.mentor).toBeNull();

      const disputeAudit = auditLogs.find(
        (l) => l.action === 'escrow-dispute-decided' && l.details?.disputeId === dispute.id,
      );
      expect(disputeAudit.details.mentorUnassigned).toBe(true);
    });
  });

  describe('6. Admin Controller POST /admin/disputes/:id/decide Integration', () => {
    it('resolves dispute via decideDispute endpoint, unassigns mentor from project, and clears mentor from project views', async () => {
      const { dispute } = setupDisputedSession('sess-admin-endpoint', 'proj-1');
      const projectBefore = projectStore.get('proj-1');
      expect(projectBefore.mentorId).toBe('mentor-user-1');
      expect(projectBefore.mentor).toBe('Expert Mentor');

      // Admin decides dispute with refund_to_owner via decideDispute
      const result = await service.decideDispute(dispute.id, 'admin-super', {
        decision: 'refund_to_owner',
        reason: 'Refund approved by administrator after dispute mediation.',
      });

      expect(result.dispute.status).toBe('decided');
      expect(result.session.status).toBe('refunded');

      // Project record in store has mentor unassigned
      const projectAfter = projectStore.get('proj-1');
      expect(projectAfter.mentorId).toBeNull();
      expect(projectAfter.mentor).toBeNull();

      // Owner notification reflects unassignment
      const ownerNotice = notifications.find(
        (n) => n.userId === 'owner-1' && n.referenceId === 'sess-admin-endpoint',
      );
      expect(ownerNotice).toBeDefined();
      expect(ownerNotice.message).toContain('mentor has been unassigned and the project is open for a new mentor booking');

      // Audit log records mentorUnassigned
      const audit = auditLogs.find(
        (l) => l.action === 'escrow-dispute-decided' && l.details?.disputeId === dispute.id,
      );
      expect(audit.details.mentorUnassigned).toBe(true);

      // Replacement booking succeeds immediately
      const newBooking = await service.createBooking('owner-1', {
        projectId: 'proj-1',
        mentorId: 'replacement-mentor-profile',
        projectDescription: 'Follow-up replacement session',
      });
      expect(newBooking.session.status).toBe('payment_pending');
      expect(newBooking.session.mentorId).toBe('replacement-mentor-profile');
    });
  });

  describe('7. Refunded Mentor Completely Removed From Project Members & Mentored Projects', () => {
    it('does not leak mentor into project.collaborators or project.members across multiple enrichProject reads and dispute refund', async () => {
      const projectsRepoAdapter: any = {
        findById: (id: string) => projectStore.get(id) || null,
        update: (id: string, patch: any) => {
          const existing = projectStore.get(id);
          if (existing) Object.assign(existing, patch);
          return existing;
        },
        findAll: () => Array.from(projectStore.values()),
      };
      const usersSvcAdapter: any = {
        findById: (id: string) => userStore.get(String(id)) || null,
        findUserSafe: (id: string) => userStore.get(String(id)) || null,
        findAll: () => Array.from(userStore.values()),
      };
      const projectsService = new ProjectsService(
        projectsRepoAdapter,
        { findAllByProjectId: () => [] } as any,
        { findByProject: () => [] } as any,
        { create: () => undefined } as any,
        service,
        { log: () => undefined } as any,
        { getConfig: () => ({ maxCollaboratorsPerProject: 20 }) } as any,
        usersSvcAdapter,
        clockService,
      );

      const { session, dispute } = setupDisputedSession('sess-leak-test', 'proj-1');
      session.startedAt = '2026-06-01T07:00:00.000Z';

      // Fetch project TWICE before dispute resolution (reproduces enrichProject member caching)
      const firstRead = projectsService.findById('proj-1', 'owner-1', { includeDeleted: true });
      expect(firstRead.members.some((m: any) => String(m.userId || m.id) === 'mentor-user-1')).toBe(true);

      const secondRead = projectsService.findById('proj-1', 'owner-1', { includeDeleted: true });
      expect(secondRead.members.some((m: any) => String(m.userId || m.id) === 'mentor-user-1')).toBe(true);
      expect(secondRead.collaborators).toHaveLength(0);

      // Resolve dispute with full refund to owner
      await service.decideDispute(dispute.id, 'admin-1', {
        decision: 'refund_to_owner',
        reason: 'Mentor failed to attend sessions and was refunded.',
      });

      // Fetch project AFTER dispute refund
      const afterRefundRead = projectsService.findById('proj-1', 'owner-1', { includeDeleted: true });
      expect(afterRefundRead.mentorId).toBeNull();
      expect(afterRefundRead.mentor).toBeNull();
      expect(afterRefundRead.collaborators).toHaveLength(0);
      expect(
        afterRefundRead.members.some((m: any) => String(m.userId || m.id) === 'mentor-user-1'),
      ).toBe(false);
      expect(afterRefundRead.members.map((m: any) => m.role)).toEqual(['Owner']);

      // Refunded mentor's Mentored Projects list no longer shows this project
      const mentored = service.getMentoredProjects('mentor-user-1');
      expect(mentored.items.some((i) => i.projectId === 'proj-1')).toBe(false);
    });
  });
});
