import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { ClockService } from '../common/services/clock.service';
import {
  NotificationsService,
  formatGroupedItemList,
} from './notifications.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { ProjectStatus } from '../projects/dto/create-project.dto';
import { TasksService } from '../tasks/tasks.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { TaskStatus } from '../tasks/dto/create-task.dto';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { UsersRepository } from '../users/users.repository';
import { JobsService } from '../jobs/jobs.service';
import { ModerationService } from '../moderation/moderation.service';
import { AccountDeletionService } from '../users/account-deletion.service';
import { ProjectInvitesService } from '../projects/invites.service';
import { UserRole, UserStatus } from '../users/dto/create-user.dto';

describe('Phase 26 Unit Tests: Notification Aggregation & Bulk Loops', () => {
  let notificationsService: NotificationsService;
  let clockService: ClockService;
  let projectsService: ProjectsService;
  let projectsRepo: ProjectsRepository;
  let tasksService: TasksService;
  let tasksRepo: TasksRepository;
  let joinRequestsService: JoinRequestsService;
  let usersRepo: UsersRepository;
  let jobsService: JobsService;
  let moderationService: ModerationService;
  let accountDeletionService: AccountDeletionService;
  let invitesService: ProjectInvitesService;
  let appRef: { close: () => Promise<void> };

  const mailMock = {
    onModuleInit: async () => {},
    initializeTransport: async () => {},
    sendPasswordResetEmail: async () => ({ success: true, mode: 'console' as const }),
    sendMail: async () => ({ success: true, mode: 'console' as const }),
    sendWarningEmail: async () => ({ success: true, mode: 'console' as const }),
    sendSuspensionEmail: async () => ({ success: true, mode: 'console' as const }),
  };

  beforeAll(async () => {
    process.env.SCHEDULER_ENABLED = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailMock)
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    appRef = app;

    notificationsService = app.get(NotificationsService);
    clockService = app.get(ClockService);
    projectsService = app.get(ProjectsService);
    projectsRepo = app.get(ProjectsRepository);
    tasksService = app.get(TasksService);
    tasksRepo = app.get(TasksRepository);
    joinRequestsService = app.get(JoinRequestsService);
    usersRepo = app.get(UsersRepository);
    jobsService = app.get(JobsService);
    moderationService = app.get(ModerationService);
    accountDeletionService = app.get(AccountDeletionService);
    invitesService = app.get(ProjectInvitesService);
  });

  beforeEach(() => {
    usersRepo.reset();
    projectsRepo.reset();
    tasksRepo.reset();
    notificationsService.reset();
    joinRequestsService.reset();
    moderationService.reset();
    invitesService.reset();
    clockService.setTime('2026-11-11T10:00:00.000Z');
  });

  afterAll(async () => {
    await appRef?.close();
  });

  it('1. NotificationsService.sendGrouped creates one notice with count, groupKey, items and formatGroupedItemList caps at 10 + and N more', () => {
    const empty = notificationsService.sendGrouped('1', 'empty-group', [], () => ({
      type: 'TASK_RELEASED',
      title: 'Ignored',
      message: 'Ignored',
    }));
    expect(empty).toBeNull();

    const twelveItems = Array.from({ length: 12 }, (_, idx) => ({
      label: `Task #${idx + 1}`,
      link: `/owner/workspace/proj-1`,
    }));

    const formatted = formatGroupedItemList(twelveItems, 10);
    expect(formatted).toContain('Task #1');
    expect(formatted).toContain('Task #10');
    expect(formatted).not.toContain('Task #11');
    expect(formatted).toContain('and 2 more');

    const sent = notificationsService.sendGrouped('1', 'bulk-tasks-1', twelveItems, (items, count) => ({
      type: 'TASK_RELEASED',
      title: `${count} tasks released in Project Atlas`,
      message: `${count} tasks released: ${formatGroupedItemList(items, 10)}`,
      referenceId: 'proj-1',
    }));

    expect(sent).not.toBeNull();
    expect(sent?.type).toBe('TASK_RELEASED');
    expect(sent?.groupKey).toBe('bulk-tasks-1');
    expect(sent?.count).toBe(12);
    expect(sent?.items).toHaveLength(12);
    expect(sent?.items?.[0]).toEqual({ label: 'Task #1', link: '/owner/workspace/proj-1' });
  });

  it('3. Releasing 8 tasks when a member leaves gives owner ONE notification with count 8 (even with 12 tasks capped in text)', () => {
    const project = projectsService.create('1', {
      title: 'Project Atlas',
      description:
        'Collaborative workspace engineered to verify single grouped TASK_RELEASED notice on member departure cleanly.',
      teamSize: 5,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    projectsService.addCollaborator(project.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    for (let i = 1; i <= 8; i++) {
      tasksService.create({
        projectId: project.id,
        title: `Atlas Task ${i}`,
        assigneeId: '2',
        assigneeName: 'Arjun Sharma',
        priority: 'Medium',
        status: TaskStatus.ToDo,
        dueDate: '2027-05-01T00:00:00.000Z',
      });
    }

    notificationsService.reset();

    projectsService.leaveProject(project.id, '2', {
      category: 'Too busy',
      reason: 'Stepping back due to semester examinations.',
    });

    const ownerNotices = notificationsService
      .findByUser('1')
      .filter((n) => n.type === 'TASK_RELEASED' && n.referenceId === project.id);
    expect(ownerNotices).toHaveLength(1);
    expect(ownerNotices[0].count).toBe(8);
    expect(ownerNotices[0].items).toHaveLength(8);
    expect(ownerNotices[0].title).toContain('8 tasks released');

    // Also test >10 tasks directly via suspension departure -> ONE immediate notice with "and 2 more"
    const project2 = projectsService.create('1', {
      title: 'Project Borealis',
      description:
        'Collaborative workspace with 12 tasks specifically designed to verify over-ten grouped summary formatting.',
      teamSize: 5,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    projectsService.addCollaborator(project2.id, { id: '3', name: 'Kiran Bose', role: 'Collaborator' });
    const kiran = usersRepo.findById('3');
    if (kiran) kiran.role = UserRole.Collaborator;

    for (let i = 1; i <= 12; i++) {
      tasksService.create({
        projectId: project2.id,
        title: `Borealis Task ${i}`,
        assigneeId: '3',
        assigneeName: 'Kiran Bose',
        priority: 'Low',
        status: TaskStatus.InProgress,
        dueDate: '2027-05-01T00:00:00.000Z',
      });
    }

    notificationsService.reset();
    tasksService.releaseMemberTasksOnDeparture({
      userId: '3',
      userName: 'Kiran Bose',
      reason: 'suspended',
    });

    const suspensionOwnerNotices = notificationsService
      .findByUser('1')
      .filter((n) => n.type === 'TASK_RELEASED');
    expect(suspensionOwnerNotices).toHaveLength(1);
    expect(suspensionOwnerNotices[0].count).toBe(12);
    expect(suspensionOwnerNotices[0].items).toHaveLength(12);
    expect(suspensionOwnerNotices[0].message).toContain('and 2 more');
  });

  it('4. Closing a project with 5 pending requests notifies each applicant once + sends ONE summary notice to owner', () => {
    const project = projectsService.create('1', {
      title: 'Pending Closure Project',
      description:
        'Workspace with 5 applicants waiting in queue to verify applicant notices and owner summary notifications.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });

    const applicantIds: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const applicant = usersRepo.create({
        name: `Applicant ${i}`,
        username: `p26_app_${i}`,
        email: `p26.app${i}@test.local`,
        password: 'Password@123',
        role: UserRole.Collaborator,
        emailVerified: true,
        status: UserStatus.Active,
      } as any);
      applicantIds.push(applicant.id);

      joinRequestsService.create(
        {
          projectId: project.id,
          userId: applicant.id,
          userName: applicant.name,
          message: `Application message from applicant ${i} to join workspace cleanly.`,
        },
        applicant.id,
      );
    }

    notificationsService.reset();
    projectsService.closeProject(project.id, 'Owner closed for Phase 26 testing', '1');

    for (const appId of applicantIds) {
      const appNotices = notificationsService
        .findByUser(appId)
        .filter((n) => n.type === 'PROJECT_CLOSED' && n.referenceId === project.id);
      expect(appNotices).toHaveLength(1);
    }

    const ownerSummary = notificationsService
      .findByUser('1')
      .filter((n) => n.referenceId === project.id && n.groupKey === `project_closed_owner:${project.id}`);
    expect(ownerSummary).toHaveLength(1);
    expect(ownerSummary[0].count).toBe(5);
    expect(ownerSummary[0].items).toHaveLength(5);
  });

  it('5. Hourly job run with multiple items for one owner sends ONE grouped reminder notice per owner', async () => {
    const project = projectsService.create('1', {
      title: 'Review Queue Project',
      description:
        'Workspace containing multiple overdue review tasks specifically for verifying hourly job notification grouping.',
      teamSize: 5,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    projectsService.addCollaborator(project.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    for (let i = 1; i <= 3; i++) {
      const task = tasksService.create({
        projectId: project.id,
        title: `Review Task ${i}`,
        assigneeId: '2',
        assigneeName: 'Arjun Sharma',
        priority: 'Medium',
        status: TaskStatus.InReview,
        proofLink: `https://github.com/teamforge/pr/${i}`,
        dueDate: '2027-05-01T00:00:00.000Z',
      });
      tasksRepo.update(task.id, {
        inReviewSince: clockService.nowIso(),
      } as any);
    }

    notificationsService.reset();
    clockService.advanceDays(3);
    clockService.advanceHours(1);

    const res = await jobsService.reviewDeadlineJob();
    expect(res.remindedTasks.length).toBeGreaterThanOrEqual(3);

    const ownerReminders = notificationsService
      .findByUser('1')
      .filter((n) => n.type === 'TASK_REVIEW_REMINDER');
    expect(ownerReminders).toHaveLength(1);
    expect(ownerReminders[0].count).toBeGreaterThanOrEqual(3);
    expect(ownerReminders[0].items?.length).toBeGreaterThanOrEqual(3);
  });

  it('6. Account deletion affecting 3 projects of same owner sends ONE combined notice to that owner', async () => {
    const collab = usersRepo.create({
      name: 'Departing Member',
      username: 'p26_depart_member',
      email: 'p26.depart@test.local',
      password: 'DeletePass@123',
      role: UserRole.Collaborator,
      emailVerified: true,
      status: UserStatus.Active,
    } as any);

    const projIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const proj = projectsService.create('1', {
        title: `Shared Deletion Project ${i}`,
        description: `Project ${i} engineered for verifying single grouped owner notifications when a collaborator deletes their account.`,
        teamSize: 4,
        dueDate: '2027-06-01T00:00:00.000Z',
      });
      projectsService.addCollaborator(proj.id, {
        id: collab.id,
        name: collab.name,
        role: 'Collaborator',
      });
      tasksService.create({
        projectId: proj.id,
        title: `Deletion Task P${i}`,
        assigneeId: collab.id,
        assigneeName: collab.name,
        priority: 'Low',
        status: TaskStatus.ToDo,
        dueDate: '2027-05-01T00:00:00.000Z',
      });
      projIds.push(proj.id);
    }

    notificationsService.reset();
    await accountDeletionService.deleteMyAccount(collab.id, {
      username: collab.username,
    });

    const ownerNotices = notificationsService
      .findByUser('1')
      .filter((n) => n.type === 'TASK_RELEASED' && n.groupKey?.startsWith('account_deleted:'));
    expect(ownerNotices).toHaveLength(1);
    expect(ownerNotices[0].count).toBe(3);
    expect(ownerNotices[0].items).toHaveLength(3);
    expect(ownerNotices[0].title).toContain('3 projects updated');
    expect(projIds).toHaveLength(3);
  });
});
