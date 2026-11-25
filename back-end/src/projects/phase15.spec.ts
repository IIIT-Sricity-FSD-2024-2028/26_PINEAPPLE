import { ConflictException, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsRepository } from './projects.repository';
import { ProjectInvitesService } from './invites.service';
import { ProjectStatus } from './dto/create-project.dto';
import { ClockService } from '../common/services/clock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { CommunicationService } from '../communication/communication.service';
import { CommunicationRepository } from '../communication/communication.repository';
import { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/dto/create-user.dto';

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

describe('Phase 15: Collaboration UX Unit Tests', () => {
  let clockService: ClockService;
  let projectsRepository: ProjectsRepository;
  let projectsService: ProjectsService;
  let invitesService: ProjectInvitesService;
  let joinRequestsService: JoinRequestsService;
  let notificationsService: NotificationsService;
  let platformConfigService: PlatformConfigService;
  let communicationRepository: CommunicationRepository;
  let communicationService: CommunicationService;
  let usersRepository: UsersRepository;
  let usersService: UsersService;
  let tasksByProject: Map<string, any[]>;
  let auditLogs: any[];

  const BASE_TIME = '2026-07-01T10:00:00.000Z';

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';

    clockService = new ClockService();
    clockService.setTime(BASE_TIME);

    projectsRepository = new ProjectsRepository();
    (projectsRepository as any).projects = [];
    tasksByProject = new Map();
    auditLogs = [];

    notificationsService = new NotificationsService();
    notificationsService.reset();

    platformConfigService = new PlatformConfigService();

    usersRepository = new UsersRepository();
    usersRepository.reset();

    const mockGamificationRepo: any = {
      findByUserId: () => ({ userId: '2', xp: 100, rep: 80 }),
      findAll: () => [],
    };
    const mockModuleRef: any = { get: () => null };
    const mockFirebaseService: any = { isEnabled: () => false };
    const mockAuditService: any = {
      log: createSpy((entry: any) => auditLogs.push(entry)),
    };

    usersService = new UsersService(
      usersRepository,
      mockGamificationRepo,
      mockModuleRef,
      mockFirebaseService,
      mockAuditService,
      notificationsService,
    );

    const mockTasksService: any = {
      findAllByProjectId: (pid: string) => tasksByProject.get(pid) || [],
    };
    const mockMentorMarketplace: any = {
      settleSessionsOnProjectClosure: () => {},
    };

    projectsService = new ProjectsService(
      projectsRepository,
      mockTasksService,
      undefined,
      notificationsService,
      mockMentorMarketplace,
      mockAuditService,
      platformConfigService,
      usersService,
      clockService,
    );

    joinRequestsService = new JoinRequestsService(
      projectsService,
      mockAuditService,
      notificationsService,
      clockService,
      usersService,
    );
    (projectsService as any).joinRequestsService = joinRequestsService;

    invitesService = new ProjectInvitesService(
      projectsRepository,
      projectsService,
      usersService,
      notificationsService,
      mockAuditService,
      joinRequestsService,
      clockService,
    );

    communicationRepository = new CommunicationRepository(usersRepository, projectsRepository);
    communicationRepository.resetReadState();
    communicationService = new CommunicationService(
      communicationRepository,
      projectsRepository,
      mockAuditService,
      notificationsService,
      projectsService,
      clockService,
    );
  });

  function seedProject(overrides: Record<string, any> = {}) {
    const id = overrides.id || `p-${Math.random().toString(36).slice(2, 8)}`;
    const project = {
      id,
      title: overrides.title || `Project ${id}`,
      name: overrides.title || `Project ${id}`,
      description: overrides.description || 'Collaborative software engineering project.',
      ownerId: overrides.ownerId || '1',
      owner: overrides.owner || 'Priya Patel',
      status: overrides.status || ProjectStatus.Open,
      isCompleted: Boolean(overrides.isCompleted),
      requiredSkills: overrides.requiredSkills ?? overrides.skills ?? [],
      skills: overrides.skills ?? overrides.requiredSkills ?? [],
      collaborators: overrides.collaborators || [],
      removedUsers: overrides.removedUsers || [],
      blockedUsers: overrides.blockedUsers || [],
      teamSize: overrides.teamSize ?? 5,
      maxCollaborators: overrides.maxCollaborators ?? 5,
      dueDate: overrides.dueDate || '2027-09-01T00:00:00.000Z',
      difficulty: overrides.difficulty || 'Intermediate',
      createdAt: BASE_TIME,
      ...overrides,
    };
    (projectsRepository as any).projects.push(project);
    return project;
  }

  describe('1. Active Project Cap (MAX_ACTIVE_MEMBERSHIPS)', () => {
    it('excludes owned, Completed, and Closed projects from cap count', () => {
      // Owning 4 projects does not count toward active memberships
      for (let i = 1; i <= 4; i++) {
        seedProject({ id: `owned-${i}`, ownerId: '2', status: ProjectStatus.Open });
      }
      // Finished memberships also do not count
      seedProject({ id: 'done-1', ownerId: '1', status: ProjectStatus.Completed, isCompleted: true, collaborators: [{ id: '2', name: 'Arjun' }] });
      seedProject({ id: 'closed-1', ownerId: '1', status: ProjectStatus.Closed, collaborators: [{ id: '2', name: 'Arjun' }] });

      expect(projectsService.getUserActiveMemberships('2')).toHaveLength(0);

      // 2 active collaborator memberships -> under cap of 3
      seedProject({ id: 'act-1', ownerId: '1', status: ProjectStatus.Open, collaborators: [{ id: '2', name: 'Arjun' }] });
      seedProject({ id: 'act-2', ownerId: '1', status: ProjectStatus.InProgress, collaborators: [{ id: '2', name: 'Arjun' }] });
      expect(projectsService.getUserActiveMemberships('2')).toHaveLength(2);
      expect(() => projectsService.assertCanJoinProject('2')).not.toThrow();

      // Grandfathered user already on 4 active projects is not removed, but blocked from joining a 5th
      seedProject({ id: 'act-3', ownerId: '1', status: ProjectStatus.Open, collaborators: [{ id: '2', name: 'Arjun' }] });
      seedProject({ id: 'act-4', ownerId: '1', status: ProjectStatus.Open, collaborators: [{ id: '2', name: 'Arjun' }] });
      expect(projectsService.getUserActiveMemberships('2')).toHaveLength(4);

      try {
        projectsService.assertCanJoinProject('2');
        fail('Expected ACTIVE_PROJECT_CAP');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse().code).toBe('ACTIVE_PROJECT_CAP');
        expect(err.getResponse().currentCount).toBe(4);
        expect(err.getResponse().maxAllowed).toBe(3);
        expect(err.getResponse().projects).toHaveLength(4);
      }
    });

    it('enforces active project cap on apply, owner approve, and invite accept', async () => {
      // Fill 2 active projects first so user '2' can apply to p3 & p4
      seedProject({ id: 'm1', ownerId: '1', collaborators: [{ id: '2', name: 'Arjun' }] });
      seedProject({ id: 'm2', ownerId: '1', collaborators: [{ id: '2', name: 'Arjun' }] });
      const p3 = seedProject({ id: 'm3', ownerId: '1' });
      const p4 = seedProject({ id: 'm4', ownerId: '1' });
      const p5 = seedProject({ id: 'm5', ownerId: '1' });

      const req3 = joinRequestsService.create({ projectId: p3.id, userId: '2', userName: 'Arjun', message: 'Apply 3' });
      const req4 = joinRequestsService.create({ projectId: p4.id, userId: '2', userName: 'Arjun', message: 'Apply 4' });
      const inv5 = invitesService.sendInvite(p5.id, 'arjunsharma', { uid: '1', role: 'Project Owner' });

      // Approving p3 brings Arjun to 3/3 active memberships
      await joinRequestsService.update(req3.id, { status: 'Approved' }, { uid: '1', role: 'Project Owner' });

      // Owner approving already-pending req4 fails with 409 ACTIVE_PROJECT_CAP
      await expect(
        joinRequestsService.update(req4.id, { status: 'Approved' }, { uid: '1', role: 'Project Owner' }),
      ).rejects.toThrow(ConflictException);

      // Accepting invite fails with 409 ACTIVE_PROJECT_CAP
      await expect(invitesService.acceptInvite(inv5.id, '2')).rejects.toThrow(ConflictException);

      // Applying to a brand new project fails with 409 ACTIVE_PROJECT_CAP
      const p6 = seedProject({ id: 'm6', ownerId: '1' });
      expect(() =>
        joinRequestsService.create({ projectId: p6.id, userId: '2', userName: 'Arjun', message: 'Apply 6' }),
      ).toThrow(ConflictException);
    });
  });

  describe('2. Skill-Match Hint', () => {
    it('computes 100%, 50%, 0% match and null percent for skill-less projects', () => {
      // User '2' has ['React', 'Python', 'ML']
      const p100 = seedProject({ id: 'sm-100', requiredSkills: ['React', 'Python'] });
      const p50 = seedProject({ id: 'sm-50', requiredSkills: ['React', 'Go', 'Rust', 'ML'] });
      const p33 = seedProject({ id: 'sm-33', requiredSkills: ['React', 'Kubernetes', 'Terraform'] });
      const p0 = seedProject({ id: 'sm-0', requiredSkills: ['Rust', 'Solidity'] });
      const pEmpty = seedProject({ id: 'sm-none', requiredSkills: [], skills: [] });

      expect(projectsService.getSkillMatchForProject(p100.id, '2')).toEqual({
        percent: 100,
        shared: ['React', 'Python'],
        missing: [],
      });
      expect(projectsService.getSkillMatchForProject(p50.id, '2')).toEqual({
        percent: 50,
        shared: ['React', 'ML'],
        missing: ['Go', 'Rust'],
      });
      expect(projectsService.getSkillMatchForProject(p33.id, '2')).toEqual({
        percent: 33,
        shared: ['React'],
        missing: ['Kubernetes', 'Terraform'],
      });
      expect(projectsService.getSkillMatchForProject(p0.id, '2')).toEqual({
        percent: 0,
        shared: [],
        missing: ['Rust', 'Solidity'],
      });
      expect(projectsService.getSkillMatchForProject(pEmpty.id, '2')).toEqual({
        percent: null,
        shared: [],
        missing: [],
      });
    });
  });

  describe('3. Rejection Suggestions', () => {
    it('returns up to 3 open non-full non-closed non-applied projects sorted best match first', async () => {
      const target = seedProject({ id: 'rej-target', ownerId: '1', requiredSkills: ['Rust'] });
      seedProject({ id: 'sug-best', ownerId: '1', requiredSkills: ['React', 'Python'] }); // 100%
      seedProject({ id: 'sug-mid', ownerId: '1', requiredSkills: ['React', 'Go'] }); // 50%
      seedProject({ id: 'sug-low', ownerId: '1', requiredSkills: ['ML', 'Scala', 'Elixir'] }); // 33%
      seedProject({ id: 'sug-zero', ownerId: '1', requiredSkills: ['Ruby'] }); // 0% -> excluded when matched exist
      seedProject({ id: 'sug-full', ownerId: '1', requiredSkills: ['React'], teamSize: 1, maxCollaborators: 1, collaborators: [{ id: '3', name: 'Kiran' }] });
      seedProject({ id: 'sug-closed', ownerId: '1', status: ProjectStatus.Closed, requiredSkills: ['React'] });
      const alreadyApplied = seedProject({ id: 'sug-applied', ownerId: '1', requiredSkills: ['React', 'Python'] });
      joinRequestsService.create({ projectId: alreadyApplied.id, userId: '2', userName: 'Arjun', message: 'Applied' });

      const req = joinRequestsService.create({ projectId: target.id, userId: '2', userName: 'Arjun', message: 'Join' });
      const rejected = await joinRequestsService.update(
        req.id,
        { status: 'Rejected', reason: 'Skills did not align for this milestone.' },
        { uid: '1', role: 'Project Owner' },
      );

      expect(rejected.suggestedProjects).toBeDefined();
      expect(rejected.suggestedProjects).toHaveLength(3);
      expect(rejected.suggestedProjects!.map((s) => s.id)).toEqual(['sug-best', 'sug-mid', 'sug-low']);
      expect(rejected.suggestedProjects![0].percent).toBe(100);

      const userNotifs = notificationsService.findByUser('2');
      const rejNotif = userNotifs.find((n) => n.type === 'APPLICATION_REJECTED');
      expect(rejNotif).toBeDefined();
      expect(rejNotif!.suggestedProjects).toHaveLength(3);
    });
  });

  describe('4. Direct Invites, Validation, Cooldown, Expiry, Concurrency', () => {
    it('validates target errors, limit of 5 open invites, cooldowns, and expiry', async () => {
      const p = seedProject({ id: 'inv-p', ownerId: '1', teamSize: 4, maxCollaborators: 4 });

      // 404 unknown username
      expect(() => invitesService.sendInvite(p.id, 'no_such_user', { uid: '1' })).toThrow(NotFoundException);

      // 409 cannot invite self / owner (ALREADY_PROJECT_OWNER)
      expect(() => invitesService.sendInvite(p.id, 'priyapatel', { uid: '1' })).toThrow(ConflictException);

      // 409 suspended user
      const susp = usersRepository.create({
        name: 'Suspended User',
        email: 'susp@example.com',
        username: 'suspendedu',
        role: UserRole.Collaborator,
        password: 'Password123!',
      });
      (susp as any).status = 'Suspended';
      expect(() => invitesService.sendInvite(p.id, 'suspendedu', { uid: '1' })).toThrow(ConflictException);

      // 409 already member
      p.collaborators.push({ id: '3', name: 'Kiran' });
      expect(() => invitesService.sendInvite(p.id, 'kiranbose', { uid: '1' })).toThrow(ConflictException);

      // Send 5 open invites -> 6th hits INVITE_LIMIT
      for (let i = 1; i <= 5; i++) {
        usersRepository.create({
          name: `Tester ${i}`,
          email: `tester${i}@example.com`,
          username: `tester_${i}`,
          role: UserRole.Collaborator,
          password: 'Password123!',
        });
        const inv = invitesService.sendInvite(p.id, `tester_${i}`, { uid: '1' });
        expect(inv.status).toBe('pending');
      }

      // Duplicate pending invite for tester_1 rejected with ConflictException
      expect(() => invitesService.sendInvite(p.id, 'tester_1', { uid: '1' })).toThrow(ConflictException);

      // 6th open invite hits INVITE_LIMIT
      usersRepository.create({
        name: 'Tester 6',
        email: 'tester6@example.com',
        username: 'tester_6',
        role: UserRole.Collaborator,
        password: 'Password123!',
      });
      expect(() => invitesService.sendInvite(p.id, 'tester_6', { uid: '1' })).toThrow(ConflictException);

      // Does not count toward applicant's 2-request quota
      expect(joinRequestsService.requestsUsed('2', p.id)).toBe(0);

      // After 7 days, all 5 open invites expire
      clockService.advanceDays(7);
      const expRes = invitesService.expireStaleInvites();
      expect(expRes.expiredInvites).toHaveLength(5);

      const u1 = usersRepository.findByUsername('tester_1')!;
      await expect(invitesService.acceptInvite(invitesService.listForUser(u1.id)[0].id, u1.id)).rejects.toThrow(
        ConflictException,
      );

      // 14-day cooldown after decline with block
      const invArjun = invitesService.sendInvite(p.id, 'arjunsharma', { uid: '1' });
      invitesService.declineInvite(invArjun.id, '2', true);
      expect(() => invitesService.sendInvite(p.id, 'arjunsharma', { uid: '1' })).toThrow(ConflictException);

      clockService.advanceDays(14);
      const reInvited = invitesService.sendInvite(p.id, 'arjunsharma', { uid: '1' });
      expect(reInvited.status).toBe('pending');
    });

    it('serializes concurrent acceptInvite calls against team capacity', async () => {
      const p = seedProject({ id: 'race-p', ownerId: '1', teamSize: 1, maxCollaborators: 1 });
      const u1 = usersRepository.create({
        name: 'Race One',
        email: 'r1@example.com',
        username: 'race_one',
        role: UserRole.Collaborator,
        password: 'Password123!',
      });
      const u2 = usersRepository.create({
        name: 'Race Two',
        email: 'r2@example.com',
        username: 'race_two',
        role: UserRole.Collaborator,
        password: 'Password123!',
      });

      const inv1 = invitesService.sendInvite(p.id, 'race_one', { uid: '1' });
      const inv2 = invitesService.sendInvite(p.id, 'race_two', { uid: '1' });

      const results = await Promise.allSettled([
        invitesService.acceptInvite(inv1.id, u1.id),
        invitesService.acceptInvite(inv2.id, u2.id),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(projectsRepository.findById(p.id)!.collaborators).toHaveLength(1);
    });
  });

  describe('5. Unread Chat Badge & Read Tracking', () => {
    it('tracks unread messages per user & project, zeroes on markProjectRead, and enforces membership guard', () => {
      const p = seedProject({
        id: 'chat-p',
        ownerId: '1',
        collaborators: [{ id: '2', name: 'Arjun' }],
      });

      communicationService.sendMessage(
        '1',
        { projectId: p.id, senderName: 'Priya', text: 'Welcome aboard!' },
        { uid: '1', role: 'Project Owner' },
      );
      clockService.advanceHours(1);
      communicationService.sendMessage(
        '1',
        { projectId: p.id, senderName: 'Priya', text: 'Check milestone 1' },
        { uid: '1', role: 'Project Owner' },
      );

      const summaryBefore = communicationService.getUnreadSummary('2');
      expect(summaryBefore.total).toBe(2);
      expect(summaryBefore.byProject[0].unreadCount).toBe(2);

      // Self messages never count as unread
      expect(communicationService.getUnreadSummary('1').total).toBe(0);

      // Mark read zeroes count
      clockService.advanceHours(1);
      communicationService.markProjectRead(p.id, '2');
      expect(communicationService.getUnreadSummary('2').total).toBe(0);

      // Non-member cannot mark read (Phase 6 guard)
      expect(() => communicationService.markProjectRead(p.id, '3')).toThrow(ForbiddenException);
    });
  });

  describe('6. User Search Ranking', () => {
    it('ranks exact username > username prefix > name prefix > substring', () => {
      usersRepository.create({
        name: 'Kaya Surname',
        email: 'kayaname@example.com',
        username: 'zz_prefixname',
        role: UserRole.Collaborator,
        password: 'Password123!',
      });
      usersRepository.create({
        name: 'Pooja Nair',
        email: 'kaya@example.com',
        username: 'kayap_prefix',
        role: UserRole.Collaborator,
        password: 'Password123!',
      });
      usersRepository.create({
        name: 'Alex Morgan',
        email: 'alexm@example.com',
        username: 'kaya',
        role: UserRole.Collaborator,
        password: 'Password123!',
      });
      usersRepository.create({
        name: 'Nikhil Rao',
        email: 'nikhil@example.com',
        username: 'sub_kaya_mid',
        role: UserRole.Collaborator,
        password: 'Password123!',
      });

      const results = usersService.searchUsers('kaya', '1');
      expect(results.map((r) => r.username)).toEqual([
        'kaya',
        'kayap_prefix',
        'zz_prefixname',
        'sub_kaya_mid',
      ]);
    });
  });

  describe('7. Finished Project Finality (Done Means Done)', () => {
    it('finished projects are locked, read-only, and do not have clone or export methods', () => {
      const closedProj = seedProject({
        id: 'exp-closed',
        ownerId: '1',
        title: 'Smart Grid Optimizer',
        description: 'Optimize campus solar grid allocation.',
        requiredSkills: ['TypeScript', 'NestJS'],
        status: ProjectStatus.Closed,
        mentorId: '3',
        collaborators: [{ id: '2', name: 'Arjun' }],
      });

      expect(projectsService.isLocked(closedProj as any)).toBe(true);
      expect((projectsService as any).cloneProjectAsDraft).toBeUndefined();
      expect((projectsService as any).exportRequirementsMarkdown).toBeUndefined();
    });
  });
});
