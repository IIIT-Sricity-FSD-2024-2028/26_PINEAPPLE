import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { ClockService } from '../common/services/clock.service';
import { SupportService } from './support.service';
import { ALLOWED_STATUS_TRANSITIONS } from './entities/support-request.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { UsersRepository } from '../users/users.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskStatus } from '../tasks/dto/create-task.dto';
import { ProjectStatus } from '../projects/dto/create-project.dto';

describe('Phase 27 Unit Tests: Support Service, Transitions, Limits & 7-Day Reminder', () => {
  let supportService: SupportService;
  let notificationsService: NotificationsService;
  let auditService: AuditService;
  let clockService: ClockService;
  let usersRepo: UsersRepository;
  let projectsRepo: ProjectsRepository;
  let projectsService: ProjectsService;
  let tasksService: TasksService;
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

    supportService = app.get(SupportService);
    notificationsService = app.get(NotificationsService);
    auditService = app.get(AuditService);
    clockService = app.get(ClockService);
    usersRepo = app.get(UsersRepository);
    projectsRepo = app.get(ProjectsRepository);
    projectsService = app.get(ProjectsService);
    tasksService = app.get(TasksService);
  });

  beforeEach(() => {
    usersRepo.reset();
    projectsRepo.reset();
    notificationsService.reset();
    supportService.reset();
    clockService.setTime('2026-11-12T10:00:00.000Z');
  });

  afterAll(async () => {
    await appRef?.close();
  });

  it('1. Enforces status transition table across all allowed and refused transitions + requires note on resolved/rejected', () => {
    const allStatuses = ['open', 'in_progress', 'waiting_user', 'resolved', 'rejected'] as const;

    for (const from of allStatuses) {
      for (const to of allStatuses) {
        if (from === to) continue;

        const ticket = supportService.create({
          type: 'help',
          subject: `Transition test ${from} -> ${to}`,
          message: 'Valid ticket body describing issue clearly for transition verification.',
          userId: `user-${from}-${to}`,
          from: `${from}.${to}@teamforge.io`,
        });

        // Move ticket to `from` state first if not `open`
        if (from === 'in_progress') {
          supportService.updateAdminTicket(ticket.id, { uid: 'u-admin', name: 'Admin' }, { status: 'in_progress' });
        } else if (from === 'waiting_user') {
          supportService.updateAdminTicket(ticket.id, { uid: 'u-admin', name: 'Admin' }, { status: 'waiting_user' });
        } else if (from === 'resolved' || from === 'rejected') {
          supportService.updateAdminTicket(
            ticket.id,
            { uid: 'u-admin', name: 'Admin' },
            { status: from, note: 'Initial terminal transition with valid explanation note.' },
          );
        }

        const isAllowed = ALLOWED_STATUS_TRANSITIONS[from].includes(to);
        if (isAllowed) {
          const updated = supportService.updateAdminTicket(
            ticket.id,
            { uid: 'u-admin', name: 'Admin' },
            to === 'resolved' || to === 'rejected'
              ? { status: to, note: 'Valid terminal resolution note with sufficient detail.' }
              : { status: to },
          );
          expect(updated.status).toBe(to);
        } else {
          expect(() =>
            supportService.updateAdminTicket(
              ticket.id,
              { uid: 'u-admin', name: 'Admin' },
              { status: to, note: 'Should be blocked by transition matrix.' },
            ),
          ).toThrow(ConflictException);
        }
      }
    }

    // Resolving or rejecting without a 10-500 char note throws BadRequest NOTE_REQUIRED
    const t = supportService.create({
      type: 'help',
      subject: 'Note validation check',
      message: 'Checking that note is strictly validated before moving to resolved or rejected.',
      userId: '2',
      from: 'arjun.sharma@teamforge.io',
    });

    try {
      supportService.updateAdminTicket(t.id, { uid: 'u-admin' }, { status: 'resolved', note: 'too short' });
      fail('Expected NOTE_REQUIRED');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse().code).toBe('NOTE_REQUIRED');
    }

    try {
      supportService.updateAdminTicket(t.id, { uid: 'u-admin' }, { status: 'rejected', note: '' });
      fail('Expected NOTE_REQUIRED');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse().code).toBe('NOTE_REQUIRED');
    }
  });

  it('2. Enforces 5-ticket daily limit (429 TICKET_DAILY_LIMIT), filters ticket subject/message, and leaves replies unfiltered', () => {
    // Content filter applies to ticket subject & message
    try {
      supportService.create({
        type: 'help',
        subject: 'Help with fuck issue',
        message: 'Ticket message that is long enough to pass length check.',
        userId: '2',
        from: 'arjun.sharma@teamforge.io',
      });
      fail('Expected CONTENT_NOT_ALLOWED');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse().code).toBe('CONTENT_NOT_ALLOWED');
    }

    let lastTicketId = '';
    for (let i = 1; i <= 5; i++) {
      const created = supportService.create({
        type: 'help',
        subject: `Daily Limit Ticket ${i}`,
        message: `Genuine support question #${i} needing help from admin team.`,
        userId: '2',
        from: 'arjun.sharma@teamforge.io',
      });
      lastTicketId = created.id;
    }

    try {
      supportService.create({
        type: 'help',
        subject: 'Sixth ticket blocked',
        message: 'Sixth help ticket on same 24h window should fail with 429.',
        userId: '2',
        from: 'arjun.sharma@teamforge.io',
      });
      fail('Expected TICKET_DAILY_LIMIT');
    } catch (err: any) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(429);
      expect(err.getResponse().code).toBe('TICKET_DAILY_LIMIT');
    }

    // Support replies are explicitly NOT content-filtered
    const replied = supportService.addUserReply(lastTicketId, '2', 'Additional context with fuck word permitted in reply');
    expect(replied.replies).toHaveLength(1);

    // Advancing clock 24h resets the 5/day window
    clockService.advanceHours(24);
    const nextDay = supportService.create({
      type: 'help',
      subject: 'Next Day Ticket Allowed',
      message: 'Submitted more than 24 hours later after daily window reset.',
      userId: '2',
      from: 'arjun.sharma@teamforge.io',
    });
    expect(nextDay.id).toBeTruthy();
  });

  it('3. Hides internal notes from user queries while exposing them to admins', () => {
    const ticket = supportService.create({
      type: 'help',
      subject: 'Internal Note Privacy Check',
      message: 'Please investigate missing project credit on my account.',
      userId: '2',
      from: 'arjun.sharma@teamforge.io',
    });

    supportService.addAdminReply(
      ticket.id,
      { uid: 'u-admin', name: 'Admin One' },
      { body: 'Internal: check reputation ledger mismatch before replying.', internal: true },
    );
    supportService.addAdminReply(
      ticket.id,
      { uid: 'u-admin', name: 'Admin One' },
      { body: 'We are reviewing your ledger now and will update shortly.', internal: false },
    );

    const adminView = supportService.getAdminTicket(ticket.id);
    expect(adminView.replies).toHaveLength(2);
    expect(adminView.replies?.some((r) => r.internal)).toBe(true);

    const userView = supportService.getUserTicket(ticket.id, '2');
    expect(userView.replies).toHaveLength(1);
    expect(userView.replies?.[0].internal).toBe(false);
    expect(userView.replies?.[0].body).not.toContain('ledger mismatch');

    const userList = supportService.listUserTickets('2');
    expect(userList[0].replies).toHaveLength(1);
  });

  it('4. Closure action refuses already closed, completed, or soft-deleted projects (409 PROJECT_NOT_CLOSABLE)', () => {
    const closedProj = projectsService.create('1', {
      title: 'Already Closed Workspace',
      description: 'Workspace already closed before admin clicks Close project from a support ticket in this Phase 27 verification test.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    projectsRepo.update(closedProj.id, { status: ProjectStatus.Closed } as any);

    const closedTicket = supportService.create({
      type: 'project_closure',
      priority: 'high',
      category: 'Project Closure Request',
      subject: 'Close closed proj',
      message: 'Requesting closure for project that already closed.',
      userId: '2',
      from: 'arjun@teamforge.io',
      projectId: closedProj.id,
      internalSystem: true,
    });

    try {
      supportService.closeProjectFromTicket(
        closedTicket.id,
        { uid: 'u-admin', name: 'Admin' },
        { reason: 'Attempting to close already closed project.' },
      );
      fail('Expected PROJECT_NOT_CLOSABLE');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('PROJECT_NOT_CLOSABLE');
    }

    const completedProj = projectsService.create('1', {
      title: 'Already Completed Workspace',
      description: 'Workspace already completed before admin attempts Close project from a support ticket in this Phase 27 test.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    projectsRepo.update(completedProj.id, { status: ProjectStatus.Completed } as any);

    const completedTicket = supportService.create({
      type: 'project_closure',
      priority: 'high',
      category: 'Project Closure Request',
      subject: 'Close completed proj',
      message: 'Requesting closure for project that already completed.',
      userId: '2',
      from: 'arjun@teamforge.io',
      projectId: completedProj.id,
      internalSystem: true,
    });

    try {
      supportService.closeProjectFromTicket(
        completedTicket.id,
        { uid: 'u-admin', name: 'Admin' },
        { reason: 'Attempting to close already completed project.' },
      );
      fail('Expected PROJECT_NOT_CLOSABLE');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('PROJECT_NOT_CLOSABLE');
    }

    const deletedProj = projectsService.create('1', {
      title: 'Soft Deleted Workspace',
      description: 'Workspace soft deleted before admin attempts Close project from a support ticket in this Phase 27 verification test.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    projectsRepo.update(deletedProj.id, { deletedAt: clockService.nowIso() } as any);

    const delTicket = supportService.create({
      type: 'project_closure',
      priority: 'high',
      category: 'Project Closure Request',
      subject: 'Close deleted proj',
      message: 'Requesting closure for soft deleted project.',
      userId: '2',
      from: 'arjun@teamforge.io',
      projectId: deletedProj.id,
      internalSystem: true,
    });

    try {
      supportService.closeProjectFromTicket(
        delTicket.id,
        { uid: 'u-admin', name: 'Admin' },
        { reason: 'Attempting to close deleted project.' },
      );
      fail('Expected PROJECT_NOT_CLOSABLE');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('PROJECT_NOT_CLOSABLE');
    }

    // Advance clock 25h to stay within Phase 16's 3-projects-per-24h owner cap
    clockService.advanceHours(25);

    // Live closure ticket includes accurate projectFacts
    const liveProj = projectsService.create('1', {
      title: 'Abandoned Live Workspace',
      description: 'Live workspace with open tasks to verify projectFacts enrichment inside closure ticket during Phase 27 unit test.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    tasksService.create({
      projectId: liveProj.id,
      title: 'Pending Feature Task',
      assigneeId: 'unassigned',
      priority: 'Medium',
      status: TaskStatus.ToDo,
      dueDate: '2027-05-01T00:00:00.000Z',
    });
    const liveTicket = supportService.create({
      type: 'project_closure',
      priority: 'high',
      category: 'Project Closure Request',
      subject: 'Close abandoned project',
      message: 'Owner inactive over 30 days.',
      userId: '2',
      from: 'arjun@teamforge.io',
      projectId: liveProj.id,
      internalSystem: true,
    });
    const detail = supportService.getAdminTicket(liveTicket.id);
    expect(detail.projectFacts?.projectId).toBe(liveProj.id);
    expect(detail.projectFacts?.openTasksCount).toBe(1);
    expect(detail.projectFacts?.escrowHeldAmount).toBe(0);
    expect(auditService).toBeDefined();
  });

  it('5. 7-day untouched reminder notifies Super User once per ticket', () => {
    const untouched = supportService.create({
      type: 'help',
      subject: 'Ignored Help Request',
      message: 'Submitted 7+ days ago with zero admin interaction.',
      userId: '2',
      from: 'arjun.sharma@teamforge.io',
    });

    const touched = supportService.create({
      type: 'help',
      subject: 'Handled Help Request',
      message: 'Submitted 7+ days ago but already assigned or replied by an admin.',
      userId: '2',
      from: 'arjun.sharma@teamforge.io',
    });
    supportService.addAdminReply(touched.id, { uid: 'u-admin', name: 'Admin' }, { body: 'Looking into this now.', internal: false });

    notificationsService.reset();

    // Before 7 days -> 0 reminders
    clockService.advanceDays(6);
    expect(supportService.notifyUntouchedTicketsToSuperUser().notifiedTicketIds).toEqual([]);

    // At 7+ days -> notifies Super User once for untouched only
    clockService.advanceDays(2);
    const run1 = supportService.notifyUntouchedTicketsToSuperUser();
    expect(run1.notifiedTicketIds).toEqual([untouched.id]);

    const suUsers = usersRepo.findAll().filter((u) => String(u.role).toLowerCase().includes('super'));
    expect(suUsers.length).toBeGreaterThan(0);
    const suNotifs = notificationsService
      .findByUser(suUsers[0].id)
      .filter((n) => n.type === 'SUPPORT_TICKET_OVERDUE');
    expect(suNotifs).toHaveLength(1);
    expect(suNotifs[0].metadata?.ticketIds).toContain(untouched.id);

    // Second run is idempotent -> 0 new notifications
    const run2 = supportService.notifyUntouchedTicketsToSuperUser();
    expect(run2.notifiedTicketIds).toEqual([]);
  });
});
