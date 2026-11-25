import { MentorMarketplaceService, calculateEscrowBreakdown } from './mentor-marketplace.service';
import { EscrowService } from '../escrow/escrow.service';
import { DemoUpiProvider } from './payments/demo-upi.provider';
import { ClockService } from '../common/services/clock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../users/dto/create-user.dto';

describe('MentorMarketplaceService - getMentoredProjects Unit Tests', () => {
  let service: MentorMarketplaceService;
  let escrowService: EscrowService;
  let paymentProvider: DemoUpiProvider;
  let clockService: ClockService;
  let projectStore: Map<string, any>;
  let mockProjectsRepository: any;

  const MENTOR_USER_ID = '7'; // Neha Gupta
  const MENTOR_PROFILE_ID = 'mentor-profile-1';

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';

    clockService = new ClockService();
    clockService.setTime('2026-03-01T12:00:00.000Z');

    escrowService = new EscrowService();
    paymentProvider = new DemoUpiProvider();
    const notificationsService = new NotificationsService();

    projectStore = new Map();

    mockProjectsRepository = {
      findById: (id: string) => projectStore.get(id) || null,
      update: (id: string, patch: any) => {
        const existing = projectStore.get(id);
        if (existing) {
          Object.assign(existing, patch);
        }
      },
      findAll: (includeDeleted = false) => {
        const all = Array.from(projectStore.values());
        if (includeDeleted) return all;
        return all.filter((p) => !p.deletedAt && !p.deletionScheduledAt && !p.isDeleted);
      },
    };

    const mockAuditService: any = { log: () => {} };
    const mockPayoutsService: any = { recordTransaction: () => {} };
    const mockUsersService: any = {
      findById: (id: string) => ({ id, name: `User ${id}`, email: `user${id}@example.com`, role: UserRole.Mentor }),
      findUserSafe: (id: string) => ({ id, name: `User ${id}`, email: `user${id}@example.com`, role: UserRole.Mentor }),
      findAll: () => [
        { id: '7', name: 'Neha Gupta', email: 'neha@example.com', role: UserRole.Mentor },
        { id: 'owner-1', name: 'Alice Owner', email: 'owner@example.com', role: UserRole.ProjectOwner },
      ],
    };
    const mockGamificationService: any = { awardBadges: () => {}, awardXp: () => {} };
    const mockMentorApplicationsService: any = {
      isMentorVerified: () => true,
      findByUser: () => [{ id: 'app-1', userId: '7', status: 'approved' }],
    };

    service = new MentorMarketplaceService(
      escrowService,
      mockPayoutsService,
      mockUsersService,
      mockGamificationService,
      notificationsService,
      mockMentorApplicationsService,
      mockProjectsRepository,
      mockAuditService,
      paymentProvider,
      clockService,
    );
  });

  it('1. shows active mentored project under Active and All', () => {
    projectStore.set('proj-active-1', {
      id: 'proj-active-1',
      ownerId: 'owner-1',
      title: 'Active Blockchain Protocol',
      status: 'In Progress',
      progress: 40,
      dueDate: '2026-04-01T00:00:00.000Z',
      isCompleted: false,
    });

    const escrow = escrowService.fundForSession('sess-act-1', 1500);
    const b = calculateEscrowBreakdown(1500);
    (service as any).sessions.push({
      id: 'sess-act-1',
      mentorId: MENTOR_PROFILE_ID,
      studentId: 'owner-1',
      projectId: 'proj-active-1',
      projectDescription: 'Active mentorship',
      agreedPrice: 1500,
      totalAmount: escrow.totalFunded,
      payout: b.mentorPayout,
      escrowId: escrow.id,
      status: 'active',
      createdAt: '2026-02-01T10:00:00.000Z',
      startedAt: '2026-02-02T10:00:00.000Z',
    });

    const res = service.getMentoredProjects(MENTOR_USER_ID);

    expect(res.counts.all).toBe(1);
    expect(res.counts.active).toBe(1);
    expect(res.counts.completed).toBe(0);
    expect(res.items).toHaveLength(1);

    const item = res.items[0];
    expect(item.projectId).toBe('proj-active-1');
    expect(item.title).toBe('Active Blockchain Protocol');
    expect(item.status).toBe('In Progress');
    expect(item.sessionStatus).toBe('active');
    expect(item.amount).toBe(1500);
    expect(item.dueDate).toBe('2026-04-01T00:00:00.000Z');
    expect(item.tab).toBe('active');
  });

  it('2. shows completed project under Completed and All when project is completed', () => {
    projectStore.set('proj-comp-1', {
      id: 'proj-comp-1',
      ownerId: 'owner-1',
      title: 'Completed ML Architecture',
      status: 'Completed',
      progress: 100,
      isCompleted: true,
      completedAt: '2026-02-20T10:00:00.000Z',
    });

    const escrow = escrowService.fundForSession('sess-comp-1', 2000);
    const b = calculateEscrowBreakdown(2000);
    (service as any).sessions.push({
      id: 'sess-comp-1',
      mentorId: MENTOR_PROFILE_ID,
      studentId: 'owner-1',
      projectId: 'proj-comp-1',
      projectDescription: 'Completed mentorship',
      agreedPrice: 2000,
      totalAmount: escrow.totalFunded,
      payout: b.mentorPayout,
      escrowId: escrow.id,
      status: 'completed',
      createdAt: '2026-01-01T10:00:00.000Z',
      startedAt: '2026-01-02T10:00:00.000Z',
      completedAt: '2026-02-20T10:00:00.000Z',
    });

    const res = service.getMentoredProjects(MENTOR_USER_ID);

    expect(res.counts.all).toBe(1);
    expect(res.counts.active).toBe(0);
    expect(res.counts.completed).toBe(1);
    expect(res.items).toHaveLength(1);

    const item = res.items[0];
    expect(item.projectId).toBe('proj-comp-1');
    expect(item.title).toBe('Completed ML Architecture');
    expect(item.status).toBe('Completed');
    expect(item.sessionStatus).toBe('completed');
    expect(item.completedAt).toBe('2026-02-20T10:00:00.000Z');
    expect(item.tab).toBe('completed');
  });

  it('3. shows closed project under Completed and All with Closed badge and closedReason', () => {
    projectStore.set('proj-closed-1', {
      id: 'proj-closed-1',
      ownerId: 'owner-1',
      title: 'Closed Research Project',
      status: 'Closed',
      closureReason: 'Project pivoted to mobile app',
      progress: 70,
      isCompleted: false,
      closedAt: '2026-02-15T10:00:00.000Z',
    });

    const escrow = escrowService.fundForSession('sess-closed-1', 1200);
    const b = calculateEscrowBreakdown(1200);
    (service as any).sessions.push({
      id: 'sess-closed-1',
      mentorId: MENTOR_PROFILE_ID,
      studentId: 'owner-1',
      projectId: 'proj-closed-1',
      projectDescription: 'Mentorship on closed project',
      agreedPrice: 1200,
      totalAmount: escrow.totalFunded,
      payout: b.mentorPayout,
      escrowId: escrow.id,
      status: 'completed',
      createdAt: '2026-01-10T10:00:00.000Z',
      startedAt: '2026-01-11T10:00:00.000Z',
    });

    const res = service.getMentoredProjects(MENTOR_USER_ID);

    expect(res.counts.all).toBe(1);
    expect(res.counts.active).toBe(0);
    expect(res.counts.completed).toBe(1);

    const item = res.items[0];
    expect(item.projectId).toBe('proj-closed-1');
    expect(item.status).toBe('Closed');
    expect(item.closedReason).toBe('Project pivoted to mobile app');
    expect(item.tab).toBe('completed');
  });

  it('4. mentor history survives project completion when mentorId is cleared on project', () => {
    projectStore.set('proj-cleared-slot', {
      id: 'proj-cleared-slot',
      ownerId: 'owner-1',
      title: 'Project With Cleared Mentor Slot',
      status: 'Completed',
      isCompleted: true,
      mentorId: null, // slot cleared on completion
      mentor: null,
      completedAt: '2026-02-25T10:00:00.000Z',
    });

    const escrow = escrowService.fundForSession('sess-cleared-1', 1500);
    const b = calculateEscrowBreakdown(1500);
    (service as any).sessions.push({
      id: 'sess-cleared-1',
      mentorId: MENTOR_PROFILE_ID,
      studentId: 'owner-1',
      projectId: 'proj-cleared-slot',
      projectDescription: 'Guided to completion',
      agreedPrice: 1500,
      totalAmount: escrow.totalFunded,
      payout: b.mentorPayout,
      escrowId: escrow.id,
      status: 'completed',
      createdAt: '2026-01-15T10:00:00.000Z',
      startedAt: '2026-01-16T10:00:00.000Z',
      completedAt: '2026-02-25T10:00:00.000Z',
    });

    const res = service.getMentoredProjects(MENTOR_USER_ID);

    expect(res.counts.completed).toBe(1);
    expect(res.items.some((it) => it.projectId === 'proj-cleared-slot')).toBe(true);
  });

  it('5. excludes bookings that never started (payment_pending, cancelled/refunded before acceptance)', () => {
    projectStore.set('proj-unstarted-1', {
      id: 'proj-unstarted-1',
      ownerId: 'owner-1',
      title: 'Unstarted Project 1',
      status: 'Open',
      isCompleted: false,
    });
    projectStore.set('proj-unstarted-2', {
      id: 'proj-unstarted-2',
      ownerId: 'owner-1',
      title: 'Unstarted Project 2',
      status: 'Open',
      isCompleted: false,
    });

    // Session 1: payment_pending (never accepted or started)
    (service as any).sessions.push({
      id: 'sess-unstarted-1',
      mentorId: MENTOR_PROFILE_ID,
      studentId: 'owner-1',
      projectId: 'proj-unstarted-1',
      projectDescription: 'Pending payment',
      agreedPrice: 1000,
      escrowId: 'escrow-none',
      status: 'payment_pending',
      createdAt: '2026-02-28T10:00:00.000Z',
    });

    // Session 2: cancelled before start
    (service as any).sessions.push({
      id: 'sess-unstarted-2',
      mentorId: MENTOR_PROFILE_ID,
      studentId: 'owner-1',
      projectId: 'proj-unstarted-2',
      projectDescription: 'Cancelled booking',
      agreedPrice: 1000,
      escrowId: 'escrow-none',
      status: 'cancelled',
      createdAt: '2026-02-28T10:00:00.000Z',
    });

    const res = service.getMentoredProjects(MENTOR_USER_ID);

    expect(res.counts.all).toBe(0);
    expect(res.items).toHaveLength(0);
  });

  it('6. excludes projects where mentor was released via an abandonment review (Phase 14)', () => {
    projectStore.set('proj-abandoned-1', {
      id: 'proj-abandoned-1',
      ownerId: 'owner-1',
      title: 'Abandoned Mentorship Project',
      status: 'In Progress',
      isCompleted: false,
    });

    (service as any).sessions.push({
      id: 'sess-abandoned-1',
      mentorId: MENTOR_PROFILE_ID,
      studentId: 'owner-1',
      projectId: 'proj-abandoned-1',
      projectDescription: 'Abandoned session',
      agreedPrice: 1500,
      escrowId: 'escrow-ab',
      status: 'refunded',
      createdAt: '2026-01-01T10:00:00.000Z',
      startedAt: '2026-01-02T10:00:00.000Z',
    });

    // Abandonment review was released
    (service as any).abandonmentReviews.push({
      id: 'review-ab-1',
      projectId: 'proj-abandoned-1',
      mentorId: MENTOR_USER_ID,
      status: 'released',
      openedAt: '2026-01-10T10:00:00.000Z',
      deadlineAt: '2026-01-12T10:00:00.000Z',
    });

    const res = service.getMentoredProjects(MENTOR_USER_ID);

    expect(res.counts.all).toBe(0);
    expect(res.items).toHaveLength(0);
  });

  it('7. excludes soft-deleted projects', () => {
    projectStore.set('proj-deleted-1', {
      id: 'proj-deleted-1',
      ownerId: 'owner-1',
      title: 'Soft Deleted Project',
      status: 'In Progress',
      isCompleted: false,
      deletedAt: '2026-02-20T10:00:00.000Z',
    });

    (service as any).sessions.push({
      id: 'sess-del-1',
      mentorId: MENTOR_PROFILE_ID,
      studentId: 'owner-1',
      projectId: 'proj-deleted-1',
      projectDescription: 'Session on deleted project',
      agreedPrice: 1500,
      escrowId: 'escrow-del',
      status: 'active',
      createdAt: '2026-02-01T10:00:00.000Z',
      startedAt: '2026-02-02T10:00:00.000Z',
    });

    const res = service.getMentoredProjects(MENTOR_USER_ID);

    expect(res.counts.all).toBe(0);
    expect(res.items).toHaveLength(0);
  });

  it('8. deduplicates multiple sessions on one project into exactly one row', () => {
    projectStore.set('proj-multi-sess', {
      id: 'proj-multi-sess',
      ownerId: 'owner-1',
      title: 'Multi Session Project',
      status: 'Completed',
      isCompleted: true,
      completedAt: '2026-02-20T10:00:00.000Z',
    });

    // Session 1: completed
    (service as any).sessions.push({
      id: 'sess-m-1',
      mentorId: MENTOR_PROFILE_ID,
      studentId: 'owner-1',
      projectId: 'proj-multi-sess',
      projectDescription: 'Session 1',
      agreedPrice: 1000,
      escrowId: 'esc-1',
      status: 'completed',
      createdAt: '2026-01-01T10:00:00.000Z',
      startedAt: '2026-01-02T10:00:00.000Z',
    });

    // Session 2: also completed on same project
    (service as any).sessions.push({
      id: 'sess-m-2',
      mentorId: MENTOR_PROFILE_ID,
      studentId: 'owner-1',
      projectId: 'proj-multi-sess',
      projectDescription: 'Session 2',
      agreedPrice: 1500,
      escrowId: 'esc-2',
      status: 'completed',
      createdAt: '2026-02-01T10:00:00.000Z',
      startedAt: '2026-02-02T10:00:00.000Z',
    });

    const res = service.getMentoredProjects(MENTOR_USER_ID);

    expect(res.counts.all).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].projectId).toBe('proj-multi-sess');
  });

  it('9. verifies counts: all === items.length, active === activeItems.length, completed === completedItems.length', () => {
    // 1 Active project
    projectStore.set('p-act', {
      id: 'p-act',
      ownerId: 'owner-1',
      title: 'Active Project',
      status: 'In Progress',
      isCompleted: false,
    });
    (service as any).sessions.push({
      id: 's-act',
      mentorId: MENTOR_PROFILE_ID,
      studentId: 'owner-1',
      projectId: 'p-act',
      agreedPrice: 1000,
      escrowId: 'e-1',
      status: 'active',
      startedAt: '2026-02-01T10:00:00.000Z',
    });

    // 1 Completed project
    projectStore.set('p-comp', {
      id: 'p-comp',
      ownerId: 'owner-1',
      title: 'Completed Project',
      status: 'Completed',
      isCompleted: true,
      completedAt: '2026-02-10T10:00:00.000Z',
    });
    (service as any).sessions.push({
      id: 's-comp',
      mentorId: MENTOR_PROFILE_ID,
      studentId: 'owner-1',
      projectId: 'p-comp',
      agreedPrice: 1500,
      escrowId: 'e-2',
      status: 'completed',
      startedAt: '2026-02-05T10:00:00.000Z',
    });

    // 1 Closed project
    projectStore.set('p-closed', {
      id: 'p-closed',
      ownerId: 'owner-1',
      title: 'Closed Project',
      status: 'Closed',
      closureReason: 'Owner paused',
      isCompleted: false,
    });
    (service as any).sessions.push({
      id: 's-closed',
      mentorId: MENTOR_PROFILE_ID,
      studentId: 'owner-1',
      projectId: 'p-closed',
      agreedPrice: 800,
      escrowId: 'e-3',
      status: 'completed',
      startedAt: '2026-01-20T10:00:00.000Z',
    });

    const res = service.getMentoredProjects(MENTOR_USER_ID);

    expect(res.counts.all).toBe(3);
    expect(res.counts.active).toBe(1);
    expect(res.counts.completed).toBe(2);
    expect(res.counts.all).toBe(res.counts.active + res.counts.completed);
    expect(res.items).toHaveLength(3);
  });
});
