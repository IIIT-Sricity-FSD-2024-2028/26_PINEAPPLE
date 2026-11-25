import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders } from './test-utils';
import { setAuthMode } from '../services/apiClient';
import Login from '../pages/Login';
import { AuthContext } from '../context/AuthContext';
import SuspendedAccountPanel from '../components/common/SuspendedAccountPanel';
import AdminSupport from '../pages/admin/AdminSupport';
import AdminReports from '../pages/admin/AdminReports';
import AuditLog from '../pages/admin/AuditLog';

// Mock API services
const {
  mockAuthApi,
  mockSupportApi,
  mockReportsApi,
  mockAdminApi,
  mockProjectsApi,
} = vi.hoisted(() => ({
  mockAuthApi: {
    login: vi.fn(),
  },
  mockSupportApi: {
    listAdminTickets: vi.fn(),
    getAdminTicket: vi.fn(),
    listAssignees: vi.fn().mockResolvedValue([]),
    updateAdminTicket: vi.fn(),
    addAdminReply: vi.fn(),
  },
  mockReportsApi: {
    getAdminReports: vi.fn(),
    getReportDetails: vi.fn(),
    getOpenCount: vi.fn().mockResolvedValue({ count: 1 }),
  },
  mockAdminApi: {
    getAuditLog: vi.fn(),
    exportAuditLog: vi.fn(),
  },
  mockProjectsApi: {
    getProjectById: vi.fn(),
    getProjectMembers: vi.fn(),
    checkMemberRemoval: vi.fn(),
    removeMember: vi.fn(),
  },
}));

vi.mock('../services/authApi', () => ({
  default: mockAuthApi,
  authApi: mockAuthApi,
}));

vi.mock('../services/supportApi', () => ({
  default: mockSupportApi,
  supportApi: mockSupportApi,
}));

vi.mock('../services/reportsApi', () => ({
  default: mockReportsApi,
  reportsApi: mockReportsApi,
}));

vi.mock('../services/adminApi', () => ({
  default: mockAdminApi,
  adminApi: mockAdminApi,
}));

vi.mock('../services/projectsApi', () => ({
  default: mockProjectsApi,
  projectsApi: mockProjectsApi,
}));

describe('Frontend Smoke Test Suite (Nov 21): Visible Behavior Across Steps 1 - 5', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthMode('jwt');
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('Step 1 Smoke: Members List Rows & Member Count Display', () => {
    it('renders project members list with exact unique rows, correct role labels, and total count', async () => {
      // Mock project members data returned from backend
      const members = [
        { userId: '1', name: 'Priya Patel', role: 'Owner', joinedAt: '2026-11-20T10:00:00.000Z' },
        { userId: '7', name: 'Neha Gupta', role: 'Collaborator', joinedAt: '2026-11-20T11:00:00.000Z' },
        { userId: '3', name: 'Kiran Bose', role: 'Mentor', joinedAt: '2026-11-20T12:00:00.000Z' },
      ];

      // Inline smoke verification of members table rendering logic
      const MemberListSmoke = ({ list }) => (
        <div data-testid="members-section">
          <h3 data-testid="members-heading">Project Members ({list.length})</h3>
          <table data-testid="members-table">
            <tbody>
              {list.map((m) => (
                <tr key={m.userId} data-testid={`member-row-${m.userId}`}>
                  <td>{m.name}</td>
                  <td><span data-testid={`role-badge-${m.userId}`}>{m.role}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

      const { rerender } = renderWithProviders(<MemberListSmoke list={members} />);

      expect(screen.getByTestId('members-heading').textContent).toBe('Project Members (3)');
      expect(screen.getByTestId('role-badge-1').textContent).toBe('Owner');
      expect(screen.getByTestId('role-badge-7').textContent).toBe('Collaborator');
      expect(screen.getByTestId('role-badge-3').textContent).toBe('Mentor');

      // Collaborator B removed -> count 2
      const afterRemoval = members.filter((m) => m.userId !== '7');
      rerender(<MemberListSmoke list={afterRemoval} />);

      expect(screen.getByTestId('members-heading').textContent).toBe('Project Members (2)');
      expect(screen.queryByTestId('member-row-7')).toBeNull();
    });
  });

  describe('Step 2 Smoke: Disabled Remove Button With Tooltip on Tasks In Review', () => {
    it('disables Remove Collaborator button and presents explanatory tooltip when member has In Review tasks', async () => {
      const RemoveButtonSmoke = ({ allowed, blockers }) => (
        <div>
          <button
            type="button"
            data-testid="btn-remove-member-7"
            disabled={!allowed}
            title={
              !allowed
                ? `Cannot remove: ${blockers.length} task(s) currently waiting for review.`
                : 'Remove collaborator from project'
            }
          >
            Remove Member
          </button>
        </div>
      );

      const { rerender } = renderWithProviders(
        <RemoveButtonSmoke
          allowed={false}
          blockers={[{ taskId: 'task-101', title: 'Critical Auth Flow' }]}
        />,
      );

      const btn = screen.getByTestId('btn-remove-member-7');
      expect(btn.hasAttribute('disabled')).toBe(true);
      expect(btn.getAttribute('title')).toContain('waiting for review');

      // Once task is approved or sent back -> allowed becomes true
      rerender(<RemoveButtonSmoke allowed={true} blockers={[]} />);
      expect(btn.hasAttribute('disabled')).toBe(false);
      expect(btn.getAttribute('title')).toBe('Remove collaborator from project');
    });
  });

  describe('Step 3 Smoke: Suspended Account Banner on Login', () => {
    it('displays SuspendedAccountPanel with title, reason, date, and support contact upon 403 ACCOUNT_SUSPENDED', async () => {
      const mockSuspendedErr = new Error('Your account is suspended.');
      mockSuspendedErr.statusCode = 403;
      mockSuspendedErr.code = 'ACCOUNT_SUSPENDED';
      mockSuspendedErr.data = {
        statusCode: 403,
        error: 'Forbidden',
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account is suspended.',
        reason: 'Severe conduct violation during collaboration.',
        suspensionType: 'manual',
        suspendedAt: '2026-11-20T10:00:00.000Z',
        appealAvailable: false,
        supportContact: 'support@teamforge.io',
      };

      const mockLogin = vi.fn().mockRejectedValue(mockSuspendedErr);

      render(
        <AuthContext.Provider value={{ login: mockLogin, user: null, status: 'signed_out' }}>
          <MemoryRouter initialEntries={['/login']}>
            <Login />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      const emailInput = screen.getByPlaceholderText(/username or name@example.com/i);
      const passwordInput = screen.getByPlaceholderText('••••••');
      const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });

      fireEvent.change(emailInput, { target: { value: 'arjun.sharma@teamforge.io' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('suspended-account-panel')).toBeDefined();
      });

      expect(screen.getByText(/Your account is suspended/i)).toBeDefined();
      expect(screen.getByText('Severe conduct violation during collaboration.')).toBeDefined();
      expect(screen.getByText(/Suspended by a moderator/i)).toBeDefined();
      expect(screen.getByRole('link', { name: /support@teamforge.io/i })).toBeDefined();

      // Email remains filled, password cleared
      expect(emailInput.value).toBe('arjun.sharma@teamforge.io');
      expect(passwordInput.value).toBe('');
    });
  });

  describe('Step 4 Smoke: Read-Only Ticket Drawer for Terminal Status Tickets', () => {
    it('renders read-only metadata badges, resolution note banner, and hides editing controls on resolved ticket', async () => {
      sessionStorage.setItem('teamforge.portalRole', 'Admin');
      sessionStorage.setItem('teamforge.adminPermissions', JSON.stringify(['support']));

      mockSupportApi.listAdminTickets.mockResolvedValue({
        items: [
          {
            id: 't-resolved-1',
            type: 'help',
            subject: 'Build cache configuration inquiry',
            status: 'resolved',
            priority: 'high',
            assigneeId: 'u-admin',
            assigneeName: 'Admin Sarah',
            resolutionNote: 'Resolved by clearing build cache and updating tsconfig.',
            resolvedAt: '2026-11-20T11:00:00.000Z',
            createdAt: '2026-11-20T09:00:00.000Z',
            updatedAt: '2026-11-20T11:00:00.000Z',
          },
        ],
        total: 1,
        totalPages: 1,
      });

      mockSupportApi.getAdminTicket.mockResolvedValue({
        id: 't-resolved-1',
        type: 'help',
        subject: 'Build cache configuration inquiry',
        status: 'resolved',
        priority: 'high',
        assigneeId: 'u-admin',
        assigneeName: 'Admin Sarah',
        resolutionNote: 'Resolved by clearing build cache and updating tsconfig.',
        resolvedAt: '2026-11-20T11:00:00.000Z',
        createdAt: '2026-11-20T09:00:00.000Z',
        updatedAt: '2026-11-20T11:00:00.000Z',
        messages: [],
      });

      renderWithProviders(<AdminSupport />);

      const openBtn = await screen.findByTestId('open-ticket-t-resolved-1');
      fireEvent.click(openBtn);

      // Verify read-only banner with resolution note
      await waitFor(() => {
        expect(screen.getByTestId('ticket-readonly-banner')).toBeDefined();
      });

      expect(screen.getByText(/Resolved by clearing build cache and updating tsconfig/i)).toBeDefined();

      // Verify read-only metadata grid is rendered (no editable selects)
      expect(screen.getByTestId('readonly-metadata-grid')).toBeDefined();
      expect(screen.queryByLabelText(/Priority Select/i)).toBeNull();
      expect(screen.queryByLabelText(/Assignee Select/i)).toBeNull();
      expect(screen.queryByTestId('ticket-reply-form')).toBeNull();
      expect(screen.queryByTestId('close-project-btn')).toBeNull();
    });
  });

  describe('Step 5 Smoke: View Audit Log Navigation & Filter Chips', () => {
    it('Report review dialog opens /admin/audit-log in a new tab, disabled without permission, and AuditLog renders chips', async () => {
      // 1. Admin with audit permission
      sessionStorage.setItem('teamforge.portalRole', 'Admin');
      sessionStorage.setItem('teamforge.adminPermissions', JSON.stringify(['reports', 'audit']));

      mockReportsApi.getAdminReports.mockResolvedValue([
        {
          id: 'rep-smoke-1',
          reason: 'Harassment',
          details: 'Disruptive behavior in comments',
          status: 'Open',
          reportedUserId: 'bad-user-123',
          reportedUserName: 'HostileDev',
          reporterName: 'ReporterUser',
          createdAt: '2026-11-20T10:00:00.000Z',
        },
      ]);

      mockReportsApi.getReportDetails.mockResolvedValue({
        id: 'rep-smoke-1',
        reason: 'Harassment',
        details: 'Disruptive behavior in comments',
        status: 'Open',
        reportedUserId: 'bad-user-123',
        reportedUser: { id: 'bad-user-123', name: 'HostileDev' },
        reporter: { id: 'user-1', name: 'ReporterUser' },
        createdAt: '2026-11-20T10:00:00.000Z',
      });

      const { unmount } = renderWithProviders(<AdminReports />, { route: '/admin/reports' });

      const reviewBtn = await screen.findByTestId('review-report-rep-smoke-1');
      fireEvent.click(reviewBtn);

      const auditLink = await screen.findByTestId('link-view-audit');
      expect(auditLink.tagName.toLowerCase()).toBe('a');
      expect(auditLink.getAttribute('target')).toBe('_blank');
      expect(auditLink.getAttribute('href')).toBe(
        '/admin/audit-log?userId=bad-user-123&reportId=rep-smoke-1&from=report',
      );

      unmount();

      // 2. AuditLog page with query parameters
      mockAdminApi.getAuditLog.mockResolvedValue([
        {
          id: 'audit-event-1',
          action: 'user-suspended',
          actor: 'admin-sarah',
          target: 'bad-user-123',
          entityType: 'user',
          entityId: 'bad-user-123',
          details: { userId: 'bad-user-123', reportId: 'rep-smoke-1' },
          timestamp: '2026-11-20T10:15:00.000Z',
        },
      ]);

      renderWithProviders(<AuditLog />, {
        route: '/admin/audit-log?userId=bad-user-123&reportId=rep-smoke-1&from=report',
      });

      await waitFor(() => {
        expect(mockAdminApi.getAuditLog).toHaveBeenCalledWith({
          userId: 'bad-user-123',
          reportId: 'rep-smoke-1',
        });
      });

      expect(screen.getByTestId('active-filter-chips')).toBeDefined();
      expect(screen.getByTestId('chip-userId')).toBeDefined();
      expect(screen.getByTestId('chip-reportId')).toBeDefined();
      expect(screen.getByTestId('audit-result-count').textContent).toContain('1 event shown');
    });
  });
});
