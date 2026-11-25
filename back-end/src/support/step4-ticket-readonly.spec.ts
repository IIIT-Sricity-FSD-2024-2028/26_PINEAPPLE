import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { ClockService } from '../common/services/clock.service';
import { SupportService } from './support.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { UsersRepository } from '../users/users.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { ProjectsService } from '../projects/projects.service';

describe('Step 4 Unit Tests: Resolved or Rejected Support Tickets Must Be Read-Only', () => {
  let supportService: SupportService;
  let notificationsService: NotificationsService;
  let auditService: AuditService;
  let clockService: ClockService;
  let usersRepo: UsersRepository;
  let projectsRepo: ProjectsRepository;
  let projectsService: ProjectsService;
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
  });

  beforeEach(() => {
    usersRepo.reset();
    projectsRepo.reset();
    notificationsService.reset();
    auditService.reset();
    supportService.reset();
    clockService.setTime('2026-11-20T10:00:00.000Z');
  });

  afterAll(async () => {
    await appRef?.close();
  });

  it('1. assertTicketOpen throws 409 TICKET_CLOSED on resolved and rejected tickets, but allows open, in_progress, waiting_user', () => {
    const openTicket = supportService.create({
      type: 'help',
      subject: 'Open ticket',
      message: 'Description of an open ticket.',
      userId: '2',
      from: 'user@example.com',
    });

    expect(() => supportService.assertTicketOpen(openTicket, ['test'])).not.toThrow();

    supportService.updateAdminTicket(openTicket.id, { uid: 'u-admin' }, { status: 'in_progress' });
    const inProgressTicket = supportService.findOne(openTicket.id);
    expect(() => supportService.assertTicketOpen(inProgressTicket, ['test'])).not.toThrow();

    supportService.updateAdminTicket(openTicket.id, { uid: 'u-admin' }, { status: 'waiting_user' });
    const waitingTicket = supportService.findOne(openTicket.id);
    expect(() => supportService.assertTicketOpen(waitingTicket, ['test'])).not.toThrow();

    // Now resolve ticket
    supportService.updateAdminTicket(
      openTicket.id,
      { uid: 'u-admin' },
      { status: 'resolved', note: 'Resolution note with sufficient length.' },
    );
    const resolvedTicket = supportService.findOne(openTicket.id);
    expect(() => supportService.assertTicketOpen(resolvedTicket, ['status'])).toThrow(ConflictException);
    try {
      supportService.assertTicketOpen(resolvedTicket, ['status']);
    } catch (err: any) {
      expect(err.getResponse().code).toBe('TICKET_CLOSED');
    }

    // Now check rejected ticket
    const rejTicket = supportService.create({
      type: 'help',
      subject: 'Rejected ticket',
      message: 'Description of ticket to reject.',
      userId: '2',
      from: 'user2@example.com',
    });
    supportService.updateAdminTicket(
      rejTicket.id,
      { uid: 'u-admin' },
      { status: 'rejected', note: 'Rejection explanation note with sufficient length.' },
    );
    const rejectedTicket = supportService.findOne(rejTicket.id);
    expect(() => supportService.assertTicketOpen(rejectedTicket, ['priority'])).toThrow(ConflictException);
    try {
      supportService.assertTicketOpen(rejectedTicket, ['priority']);
    } catch (err: any) {
      expect(err.getResponse().code).toBe('TICKET_CLOSED');
    }
  });

  it('2. updateAdminTicket rejects each forbidden field on resolved and rejected tickets', () => {
    const terminalStatuses = ['resolved', 'rejected'] as const;

    for (const termStatus of terminalStatuses) {
      const ticket = supportService.create({
        type: 'help',
        subject: `Terminal ${termStatus} test`,
        message: 'Valid ticket description for testing field rejection.',
        userId: '2',
        from: 'user@example.com',
      });

      supportService.updateAdminTicket(
        ticket.id,
        { uid: 'u-admin' },
        { status: termStatus, note: 'Resolution or rejection explanation note.' },
      );

      // 1. PATCH priority
      expect(() =>
        supportService.updateAdminTicket(ticket.id, { uid: 'u-admin' }, { priority: 'high' }),
      ).toThrow(ConflictException);

      // 2. PATCH assigneeId
      expect(() =>
        supportService.updateAdminTicket(ticket.id, { uid: 'u-admin' }, { assigneeId: 'u-admin-2' }),
      ).toThrow(ConflictException);

      // 3. PATCH status (to same status or different status)
      expect(() =>
        supportService.updateAdminTicket(ticket.id, { uid: 'u-admin' }, { status: termStatus }),
      ).toThrow(ConflictException);
      expect(() =>
        supportService.updateAdminTicket(ticket.id, { uid: 'u-admin' }, { status: 'open' }),
      ).toThrow(ConflictException);

      // 4. PATCH note
      expect(() =>
        supportService.updateAdminTicket(
          ticket.id,
          { uid: 'u-admin' },
          { note: 'Attempting to change note on closed ticket' },
        ),
      ).toThrow(ConflictException);
    }
  });

  it('3. addAdminReply and addUserReply throw 409 TICKET_CLOSED on terminal tickets', () => {
    const ticket = supportService.create({
      type: 'help',
      subject: 'Reply test ticket',
      message: 'Description for testing replies on closed tickets.',
      userId: '2',
      from: 'user@example.com',
    });

    supportService.updateAdminTicket(
      ticket.id,
      { uid: 'u-admin' },
      { status: 'resolved', note: 'Resolution explanation note here.' },
    );

    // Admin public reply
    expect(() =>
      supportService.addAdminReply(
        ticket.id,
        { uid: 'u-admin', name: 'Admin' },
        { body: 'Public reply after closed', internal: false },
      ),
    ).toThrow(ConflictException);

    // Admin internal note
    expect(() =>
      supportService.addAdminReply(
        ticket.id,
        { uid: 'u-admin', name: 'Admin' },
        { body: 'Internal note after closed', internal: true },
      ),
    ).toThrow(ConflictException);

    // User reply
    expect(() =>
      supportService.addUserReply(ticket.id, '2', 'User reply after closed'),
    ).toThrow(ConflictException);
  });

  it('4. closeProjectFromTicket throws 409 TICKET_CLOSED on finished closure tickets', () => {
    const proj = projectsService.create('1', {
      title: 'Closure Unit Project',
      description: 'Project for testing closure action refusal on closed tickets. Must be at least 100 characters long to satisfy validation.',
      teamSize: 4,
      dueDate: '2027-01-01T00:00:00.000Z',
    });

    const closureTicket = supportService.create({
      type: 'project_closure',
      priority: 'high',
      category: 'Project Closure Request',
      projectId: proj.id,
      subject: `Project Closure: ${proj.title}`,
      message: 'Owner inactive request',
      userId: '2',
      from: 'collaborator@example.com',
      internalSystem: true,
    });

    // Close project first time -> succeeds
    const closeRes = supportService.closeProjectFromTicket(
      closureTicket.id,
      { uid: 'u-admin', email: 'admin@teamforge.io' },
      { reason: 'Verified inactivity for closure unit test.' },
    );
    expect(closeRes.ticket.status).toBe('resolved');

    // Duplicate call on now-resolved ticket -> throws ConflictException TICKET_CLOSED
    try {
      supportService.closeProjectFromTicket(
        closureTicket.id,
        { uid: 'u-admin', email: 'admin@teamforge.io' },
        { reason: 'Second attempt to close project.' },
      );
      fail('Expected TICKET_CLOSED');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('TICKET_CLOSED');
    }
  });

  it('5. notifyUntouchedTicketsToSuperUser skips resolved and rejected tickets', () => {
    // Create an open ticket
    const openTicket = supportService.create({
      type: 'help',
      subject: 'Untouched Open Ticket',
      message: 'This ticket has been untouched for 8 days.',
      userId: '2',
      from: 'user@example.com',
    });

    // Create a resolved ticket
    const resolvedTicket = supportService.create({
      type: 'help',
      subject: 'Untouched Resolved Ticket',
      message: 'This ticket is resolved.',
      userId: '2',
      from: 'user@example.com',
    });
    supportService.updateAdminTicket(
      resolvedTicket.id,
      { uid: 'u-admin' },
      { status: 'resolved', note: 'Resolution explanation note here.' },
    );

    // Create a rejected ticket
    const rejectedTicket = supportService.create({
      type: 'help',
      subject: 'Untouched Rejected Ticket',
      message: 'This ticket is rejected.',
      userId: '2',
      from: 'user@example.com',
    });
    supportService.updateAdminTicket(
      rejectedTicket.id,
      { uid: 'u-admin' },
      { status: 'rejected', note: 'Rejection explanation note here.' },
    );

    // Advance clock by 8 days so tickets are >7 days old
    clockService.advanceDays(8);

    const result = supportService.notifyUntouchedTicketsToSuperUser();
    expect(result.notifiedTicketIds).toContain(openTicket.id);
    expect(result.notifiedTicketIds).not.toContain(resolvedTicket.id);
    expect(result.notifiedTicketIds).not.toContain(rejectedTicket.id);
  });
});
