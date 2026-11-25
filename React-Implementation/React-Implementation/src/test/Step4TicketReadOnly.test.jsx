import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminSupport from '../pages/admin/AdminSupport';
import Help from '../pages/help';
import { renderWithProviders } from './test-utils';

const { mockSupportApi, mockReportsApi, mockUsersApi } = vi.hoisted(() => ({
  mockSupportApi: {
    listAdminTickets: vi.fn(),
    listAssignees: vi.fn(),
    getAdminTicket: vi.fn(),
    updateAdminTicket: vi.fn(),
    replyAdminTicket: vi.fn(),
    closeProjectFromTicket: vi.fn(),
    listMyTickets: vi.fn(),
    getMyTicket: vi.fn(),
    createTicket: vi.fn(),
    replyToMyTicket: vi.fn(),
  },
  mockReportsApi: {
    getMyReports: vi.fn().mockResolvedValue([]),
  },
  mockUsersApi: {
    searchUsers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/supportApi', () => ({
  default: mockSupportApi,
  supportApi: mockSupportApi,
}));

vi.mock('../services/reportsApi', () => ({
  default: mockReportsApi,
  reportsApi: mockReportsApi,
}));

vi.mock('../services/usersApi', () => ({
  default: mockUsersApi,
  usersApi: mockUsersApi,
}));

describe('Step 4 Frontend Tests: Resolved or Rejected Support Tickets Must Be Read-Only', () => {
  const resolvedTicket = {
    id: 'ticket-resolved-1',
    type: 'help',
    userId: '2',
    userName: 'Arjun Sharma',
    from: 'arjun.sharma@teamforge.io',
    category: 'Help Inquiry',
    subject: 'Cannot build frontend workspace',
    message: 'Getting build failure when compiling the workspace frontend.',
    priority: 'high',
    status: 'resolved',
    assigneeId: 'u-admin-1',
    assigneeName: 'Support Lead',
    resolutionNote: 'Issue was resolved by updating package lock dependencies.',
    resolvedAt: '2026-11-20T12:00:00.000Z',
    replies: [
      {
        id: 'rep-1',
        authorId: 'u-admin-1',
        authorName: 'Support Lead',
        authorRole: 'admin',
        body: 'Please run npm install to update packages.',
        internal: false,
        createdAt: '2026-11-20T11:30:00.000Z',
      },
    ],
    createdAt: '2026-11-20T10:00:00.000Z',
  };

  const rejectedTicket = {
    id: 'ticket-rejected-1',
    type: 'project_closure',
    userId: '2',
    userName: 'Arjun Sharma',
    from: 'arjun.sharma@teamforge.io',
    category: 'Project Closure Request',
    subject: 'Close inactive project request',
    message: 'Please close this project due to inactive owner.',
    priority: 'high',
    status: 'rejected',
    assigneeId: null,
    assigneeName: null,
    resolutionNote: 'Rejected because project owner was active 2 days ago.',
    resolvedAt: '2026-11-20T14:00:00.000Z',
    replies: [],
    createdAt: '2026-11-20T10:00:00.000Z',
    projectFacts: {
      projectId: 'proj-1',
      projectTitle: 'Active Project',
      projectStatus: 'Open',
      isDeleted: false,
      ownerLastActiveAt: '2026-11-18T10:00:00.000Z',
      membersLastActiveAt: '2026-11-19T10:00:00.000Z',
      openTasksCount: 2,
      totalTasksCount: 5,
      escrowHeldAmount: 0,
      pendingRequestsCount: 0,
    },
  };

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    sessionStorage.setItem('teamforge.portalRole', 'admin');
    sessionStorage.setItem('teamforge.isSuperUser', 'true');
    sessionStorage.setItem('teamforge.adminPermissions', JSON.stringify(['support']));

    mockSupportApi.listAssignees.mockResolvedValue([
      { id: 'u-admin-1', name: 'Support Lead', email: 'support@teamforge.io', role: 'admin' },
    ]);
  });

  it('1. Drawer renders read-only banner, resolution note, and closed date for resolved ticket', async () => {
    mockSupportApi.listAdminTickets.mockResolvedValue({
      items: [resolvedTicket],
      total: 1,
      totalPages: 1,
    });
    mockSupportApi.getAdminTicket.mockResolvedValue(resolvedTicket);

    render(
      <MemoryRouter>
        <AdminSupport />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ticket-row-ticket-resolved-1')).toBeDefined();
    });

    // Open ticket drawer
    fireEvent.click(screen.getByTestId('open-ticket-ticket-resolved-1'));

    await waitFor(() => {
      expect(screen.getByTestId('ticket-readonly-banner')).toBeDefined();
    });

    const banner = screen.getByTestId('ticket-readonly-banner');
    expect(banner.textContent).toContain('This ticket is resolved. It can no longer be changed. If the user needs more help they can open a new ticket.');
    expect(banner.textContent).toContain('Issue was resolved by updating package lock dependencies.');
    expect(screen.getByTestId('ticket-closed-date')).toBeDefined();
  });

  it('2. Drawer renders status, priority, and assignee as plain text (no select inputs/dropdowns)', async () => {
    mockSupportApi.listAdminTickets.mockResolvedValue({
      items: [resolvedTicket],
      total: 1,
      totalPages: 1,
    });
    mockSupportApi.getAdminTicket.mockResolvedValue(resolvedTicket);

    render(
      <MemoryRouter>
        <AdminSupport />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ticket-row-ticket-resolved-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('open-ticket-ticket-resolved-1'));

    await waitFor(() => {
      expect(screen.getByTestId('readonly-metadata-grid')).toBeDefined();
    });

    // Verify select dropdowns do NOT exist
    expect(screen.queryByTestId('ticket-status-select')).toBeNull();
    expect(screen.queryByTestId('ticket-priority-select')).toBeNull();
    expect(screen.queryByTestId('ticket-assignee-select')).toBeNull();

    // Verify plain text labels exist
    expect(screen.getByTestId('read-only-status').textContent).toContain('Resolved');
    expect(screen.getByTestId('read-only-priority').textContent).toContain('high');
    expect(screen.getByTestId('read-only-assignee').textContent).toContain('Support Lead');
  });

  it('3. Drawer hides reply box, internal-note toggle, and Close Project button on terminal tickets', async () => {
    mockSupportApi.listAdminTickets.mockResolvedValue({
      items: [rejectedTicket],
      total: 1,
      totalPages: 1,
    });
    mockSupportApi.getAdminTicket.mockResolvedValue(rejectedTicket);

    render(
      <MemoryRouter>
        <AdminSupport />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ticket-row-ticket-rejected-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('open-ticket-ticket-rejected-1'));

    await waitFor(() => {
      expect(screen.getByTestId('ticket-readonly-banner')).toBeDefined();
    });

    // Reply box and toggle must be hidden
    expect(screen.queryByTestId('admin-reply-input')).toBeNull();
    expect(screen.queryByTestId('admin-reply-internal-toggle')).toBeNull();
    expect(screen.queryByTestId('send-admin-reply-btn')).toBeNull();

    // Close project button must be hidden
    expect(screen.queryByTestId('close-project-from-ticket-btn')).toBeNull();
  });

  it('4. Handles 409 TICKET_CLOSED by refreshing ticket to read-only view with error message', async () => {
    // Ticket starts open in frontend state
    const openTicket = {
      ...resolvedTicket,
      id: 'ticket-just-closed',
      status: 'open',
      priority: 'normal',
    };

    mockSupportApi.listAdminTickets.mockResolvedValue({
      items: [openTicket],
      total: 1,
      totalPages: 1,
    });
    mockSupportApi.getAdminTicket.mockResolvedValue(openTicket);

    render(
      <MemoryRouter>
        <AdminSupport />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ticket-row-ticket-just-closed')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('open-ticket-ticket-just-closed'));

    await waitFor(() => {
      expect(screen.getByTestId('ticket-priority-select')).toBeDefined();
    });

    // Mock backend returning 409 TICKET_CLOSED on attempt to change priority
    const conflictErr = new Error('Resolved or rejected tickets are read-only and cannot be modified.');
    conflictErr.code = 'TICKET_CLOSED';
    conflictErr.serverMessage = 'Resolved or rejected tickets are read-only and cannot be modified.';
    mockSupportApi.updateAdminTicket.mockRejectedValue(conflictErr);

    // When refreshed, server returns the resolved ticket
    mockSupportApi.getAdminTicket.mockResolvedValue({
      ...openTicket,
      status: 'resolved',
      priority: 'normal',
      resolutionNote: 'Closed by another admin in parallel.',
      resolvedAt: '2026-11-20T12:00:00.000Z',
    });

    // Change priority
    fireEvent.change(screen.getByTestId('ticket-priority-select'), { target: { value: 'high' } });

    await waitFor(() => {
      expect(screen.getByTestId('drawer-error')).toBeDefined();
    });

    expect(screen.getByTestId('drawer-error').textContent).toContain('This ticket is closed and read-only.');

    // Drawer switched to read-only view
    await waitFor(() => {
      expect(screen.getByTestId('ticket-readonly-banner')).toBeDefined();
      expect(screen.queryByTestId('ticket-priority-select')).toBeNull();
    });
  });

  it('5. User ticket view (help.jsx) hides reply box and shows Open Follow-Up Ticket button for terminal tickets', async () => {
    mockSupportApi.listMyTickets.mockResolvedValue([resolvedTicket]);
    mockSupportApi.getMyTicket.mockResolvedValue(resolvedTicket);

    renderWithProviders(<Help />, { route: '/help?tab=tickets' });

    await waitFor(() => {
      expect(screen.getByTestId('my-tickets-list')).toBeDefined();
    });

    // Click view thread
    fireEvent.click(screen.getByTestId('view-my-ticket-ticket-resolved-1'));

    await waitFor(() => {
      expect(screen.getByTestId('my-ticket-detail')).toBeDefined();
    });

    // Reply input should be hidden
    expect(screen.queryByTestId('my-ticket-reply-input')).toBeNull();
    expect(screen.queryByTestId('send-my-reply-btn')).toBeNull();

    // Open follow-up ticket button should be visible
    expect(screen.getByTestId('open-followup-ticket-btn')).toBeDefined();
  });
});
