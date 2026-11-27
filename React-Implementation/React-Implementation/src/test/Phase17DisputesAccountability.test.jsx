import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithStore } from './test-utils';

import MentorsDirectory from '../pages/owner/MentorsDirectory';
import AdminReports from '../pages/admin/AdminReports';
import AdminProjectDetails from '../pages/admin/AdminProjectDetails';
import AuditLog from '../pages/admin/AuditLog';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminUserDetails from '../pages/admin/AdminUserDetails';
import NotificationsPage from '../pages/notifications';

import mentorMarketplaceApi from '../services/mentorMarketplaceApi';
import adminApi from '../services/adminApi';
import reportsApi from '../services/reportsApi';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../services/apiClient.js', async () => {
  const actual = await vi.importActual('../services/apiClient.js');
  return {
    ...actual,
    getAuthMode: vi.fn(() => 'jwt'),
    setAccessToken: vi.fn(),
  };
});

vi.mock('../services/mentorMarketplaceApi', () => {
  const api = {
    listMentors: vi.fn(),
    mySessions: vi.fn(),
    openDispute: vi.fn(),
    listDisputes: vi.fn(),
    decideDispute: vi.fn(),
    getProjectEscrow: vi.fn(),
  };
  return {
    default: api,
    mentorMarketplaceApi: api,
    calculateEscrowBreakdown: (p) => {
      const price = Math.round(Number(p) || 0);
      const platformFee = Math.round(price * 0.15);
      const gatewayFee = Math.round(price * 0.02);
      return { price, platformFee, gatewayFee, totalAmount: price + platformFee + gatewayFee, mentorPayout: price };
    },
  };
});

vi.mock('../services/adminApi', () => ({
  default: {
    listUsers: vi.fn(),
    getUserDetails: vi.fn(),
    getDuplicateUsers: vi.fn(() => Promise.resolve({ groups: [] })),
    suspendUser: vi.fn(),
    getModerationActions: vi.fn(),
    approveModerationAction: vi.fn(),
    rejectModerationAction: vi.fn(),
    getDisputes: vi.fn(),
    decideDispute: vi.fn(),
    getProjectEscrow: vi.fn(),
    getAuditLog: vi.fn(),
    exportAuditLog: vi.fn(),
    getMyWarnings: vi.fn(),
    getUserReputation: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    getPublicConfig: vi.fn(() => Promise.resolve({})),
  },
  recordPortalAuditEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../services/reportsApi', () => ({
  default: {
    getAdminReports: vi.fn(() => Promise.resolve([])),
    getReportDetails: vi.fn(),
    updateReportStatus: vi.fn(),
    actionReport: vi.fn(),
    getOwnerPatterns: vi.fn(),
  },
}));

vi.mock('../services/appealsApi', () => ({
  default: {
    getAdminAppeals: vi.fn(() => Promise.resolve([])),
    getMyAppeals: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../services/projectsApi', () => ({
  default: {
    list: vi.fn(() => Promise.resolve([])),
    get: vi.fn(),
    close: vi.fn(),
  },
  isProjectLocked: vi.fn(() => false),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    getMyInvites: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../services/notificationsApi', () => ({
  default: {
    list: vi.fn(() => Promise.resolve([])),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

function renderWithProviders(ui, { role = 'admin', userId = 'u-admin-1', initialEntries = ['/'] } = {}) {
  const roleLower = String(role || '').toLowerCase();
  const isAdmin = roleLower === 'admin' || roleLower === 'superuser';
  return renderWithStore(ui, {
    route: initialEntries[0] || '/',
    preloadedState: {
      session: {
        user: { id: userId, role },
        isAuthenticated: true,
        status: 'authenticated',
        activeRole: role,
        allowedRoles: [role],
        ...(isAdmin
          ? {
              adminUid: userId,
              portalRole: roleLower,
              isSuperUser: roleLower === 'superuser',
              permissions: ['*'],
            }
          : {}),
      },
    },
  });
}

describe('Phase 17 Disputes & Admin Accountability UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows owner to open an escrow dispute and displays payout frozen badge', async () => {
    mentorMarketplaceApi.listMentors.mockResolvedValue([
      { id: 'm1', name: 'Dr. Mentor', sessionPrice: 1000, isAvailable: true, skills: ['React'] },
    ]);
    projectsApi.list.mockResolvedValue([
      { id: 'p1', title: 'Alpha App', ownerId: '1', status: 'Open', members: [] },
    ]);
    mentorMarketplaceApi.mySessions.mockResolvedValue([
      {
        id: 'sess-1',
        mentorId: 'm1',
        mentorName: 'Dr. Mentor',
        projectId: 'p1',
        projectName: 'Alpha App',
        agreedPrice: 1000,
        platformFee: 150,
        gatewayFee: 20,
        totalAmount: 1170,
        payout: 1000,
        status: 'active',
        createdAt: '2026-06-01T10:00:00.000Z',
      },
    ]);
    mentorMarketplaceApi.openDispute.mockResolvedValue({
      id: 'disp-1',
      sessionId: 'sess-1',
      status: 'open',
      reason: 'Session stopped halfway without deliverables.',
    });

    renderWithProviders(<MentorsDirectory />, { role: 'project-owner', userId: '1' });

    const historyTab = await screen.findByText(/Booking History/i);
    fireEvent.click(historyTab);

    const disputeBtn = await screen.findByTestId('open-dispute-btn-sess-1');
    fireEvent.click(disputeBtn);

    fireEvent.change(screen.getByTestId('dispute-reason-input'), {
      target: { value: 'Session stopped halfway without deliverables.' },
    });
    fireEvent.click(screen.getByTestId('submit-dispute-btn'));

    await waitFor(() => {
      expect(mentorMarketplaceApi.openDispute).toHaveBeenCalledWith(
        'sess-1',
        'Session stopped halfway without deliverables.',
      );
    });

    expect(await screen.findByTestId('session-frozen-badge-sess-1')).toBeTruthy();
  });

  it('AdminReports Escrow Disputes split slider calculates 70/30 fee on mentor share only, and Owner Patterns shows Review Pattern badge', async () => {
    adminApi.getDisputes.mockResolvedValue([
      {
        id: 'disp-70',
        sessionId: 'sess-70',
        projectId: 'p1',
        projectTitle: 'Alpha App',
        openedByRole: 'owner',
        studentName: 'Priya',
        mentorName: 'Neha',
        reason: 'Partial session coverage provided.',
        status: 'open',
        session: { agreedPrice: 1000, totalAmount: 1170 },
      },
    ]);
    adminApi.decideDispute.mockResolvedValue({ dispute: { id: 'disp-70', status: 'decided' } });
    reportsApi.getOwnerPatterns.mockResolvedValue({
      windowDays: 30,
      items: [
        {
          ownerId: 'owner-strict',
          ownerName: 'Strict Owner',
          ownerEmail: 'strict@tf.io',
          rejectedJoinRequests: 4,
          approvedJoinRequests: 0,
          rejectedTaskReviews: 2,
          approvedTaskReviews: 0,
          totalRejections: 6,
          totalApprovals: 0,
          rejectionRate: 100,
          reviewPatternFlag: true,
          badge: 'review pattern',
          reasons: [{ type: 'join_request', reason: 'Skills did not match stack.' }],
        },
        {
          ownerId: 'owner-ok',
          ownerName: 'Balanced Owner',
          ownerEmail: 'ok@tf.io',
          rejectedJoinRequests: 1,
          approvedJoinRequests: 3,
          rejectedTaskReviews: 0,
          approvedTaskReviews: 2,
          totalRejections: 1,
          totalApprovals: 5,
          rejectionRate: 17,
          reviewPatternFlag: false,
          reasons: [],
        },
      ],
    });

    renderWithProviders(<AdminReports />);

    // Open Escrow Disputes tab
    fireEvent.click(screen.getByTestId('tab-disputes'));
    const decideBtn = await screen.findByTestId('decide-dispute-btn-disp-70');
    fireEvent.click(decideBtn);

    fireEvent.click(screen.getByTestId('dispute-opt-split'));
    const slider = screen.getByTestId('dispute-split-slider');
    fireEvent.change(slider, { target: { value: '70' } });

    const preview = screen.getByTestId('split-preview-breakdown');
    expect(preview.textContent).toContain('₹700');
    expect(preview.textContent).toContain('₹105');
    expect(preview.textContent).toContain('₹365');

    fireEvent.change(screen.getByTestId('dispute-decision-reason-input'), {
      target: { value: 'Awarding 70 percent based on partial milestones reviewed.' },
    });
    fireEvent.click(screen.getByTestId('confirm-dispute-decision-btn'));

    await waitFor(() => {
      expect(adminApi.decideDispute).toHaveBeenCalledWith('disp-70', {
        decision: 'split',
        mentorPercent: 70,
        reason: 'Awarding 70 percent based on partial milestones reviewed.',
      });
    });

    // Switch to Owner Patterns tab
    fireEvent.click(screen.getByTestId('tab-owner-patterns'));
    expect(await screen.findByTestId('review-pattern-badge-owner-strict')).toBeTruthy();
    expect(screen.queryByTestId('review-pattern-badge-owner-ok')).toBeNull();
  });

  it('AdminProjectDetails renders Escrow & Financials tab with held/released/refunded/fee breakdown', async () => {
    projectsApi.get.mockResolvedValue({ id: 'p-1', title: 'Escrow Tracked Project', status: 'Open' });
    tasksApi.list.mockResolvedValue([]);
    adminApi.getProjectEscrow.mockResolvedValue({
      projectId: 'p-1',
      projectTitle: 'Escrow Tracked Project',
      ok: true,
      totals: { ownerPaid: 2340, inEscrow: 1170, mentorPayout: 1000, refunds: 0, platformFee: 170 },
      sessions: [
        { sessionId: 's-1', mentorName: 'Neha', status: 'active', held: 1170, released: 0, refunded: 0, platformFee: 0 },
      ],
    });

    renderWithProviders(
      <Routes>
        <Route path="/admin/projects/:id" element={<AdminProjectDetails />} />
      </Routes>,
      { initialEntries: ['/admin/projects/p-1'] },
    );

    const escrowTabBtn = await screen.findByTestId('admin-project-escrow-tab');
    fireEvent.click(escrowTabBtn);

    const panel = await screen.findByTestId('admin-project-escrow-panel');
    expect(panel.textContent).toContain('Reconciled');
    expect(panel.textContent).toContain('1,170');
    expect(panel.textContent).toContain('1,000');
  });

  it('AuditLog opens export dialog with filters and downloads CSV/JSON', async () => {
    adminApi.getAuditLog.mockResolvedValue([]);
    adminApi.exportAuditLog.mockResolvedValue({ format: 'json', exportedCount: 3, items: [] });

    renderWithProviders(<AuditLog />);

    const exportBtn = await screen.findByTestId('open-audit-export-btn');
    fireEvent.click(exportBtn);

    expect(screen.getByTestId('audit-export-modal')).toBeTruthy();
    fireEvent.change(screen.getByTestId('audit-export-format'), { target: { value: 'json' } });
    fireEvent.click(screen.getByTestId('confirm-audit-export-btn'));

    await waitFor(() => {
      expect(adminApi.exportAuditLog).toHaveBeenCalledWith({
        format: 'json',
        from: '',
        to: '',
        actor: '',
        action: '',
      });
    });
  });

  it('AdminUsers shows Approvals queue with Waiting for another admin on own request vs Approve for peers, and AdminUserDetails/Notifications render Expired warning status', async () => {
    adminApi.listUsers.mockResolvedValue([
      { id: '2', name: 'Arjun Sharma', role: 'collaborator', status: 'Active', pendingModerationAction: { id: 'pma-self' } },
    ]);
    adminApi.getModerationActions.mockResolvedValue([
      {
        id: 'pma-self',
        type: 'suspend',
        targetUserId: '2',
        targetUserName: 'Arjun Sharma',
        requestedBy: 'u-admin-1',
        requestedByName: 'Admin One',
        reason: 'Requested by self for second opinion',
        status: 'pending',
        thresholdReasons: ['account_age_over_90_days'],
      },
      {
        id: 'pma-other',
        type: 'suspend',
        targetUserId: '3',
        targetUserName: 'Peer User',
        requestedBy: 'u-admin-2',
        requestedByName: 'Admin Two',
        reason: 'Requested by peer admin for approval',
        status: 'pending',
        thresholdReasons: ['reputation_150_plus'],
      },
    ]);

    renderWithProviders(<AdminUsers />);

    fireEvent.click(await screen.findByText(/Approvals/i));
    expect(await screen.findByTestId('waiting-other-admin-pma-self')).toBeTruthy();
    expect(screen.getByTestId('approve-mod-action-pma-other')).toBeTruthy();

    // AdminUserDetails warning history shows Expired badge cleanly
    adminApi.getUserDetails.mockResolvedValue({
      id: '2',
      name: 'Arjun Sharma',
      email: 'arjun@tf.io',
      status: 'Active',
      activeWarningsCount: 0,
      warningHistory: [
        { id: 'w-exp', reason: 'Old warning > 90 days ago', status: 'expired', createdAt: '2026-01-01T00:00:00.000Z', expiredAt: '2026-04-03T00:00:00.000Z' },
      ],
      pendingModerationActions: [],
    });

    renderWithProviders(
      <Routes>
        <Route path="/admin/users/:id" element={<AdminUserDetails />} />
      </Routes>,
      { initialEntries: ['/admin/users/2'] },
    );

    const wStatus = await screen.findByTestId('warning-status-w-exp');
    expect(wStatus.textContent).toBe('Expired');

    // Notifications page warning history preserves expired warning labeled Expired
    adminApi.getMyWarnings.mockResolvedValue([
      { id: 'w-exp', reason: 'Old warning > 90 days ago', status: 'expired', createdAt: '2026-01-01T00:00:00.000Z', expiredAt: '2026-04-03T00:00:00.000Z', label: 'Expired' },
    ]);
    renderWithProviders(<NotificationsPage />, { role: 'collaborator', userId: '2' });
    const myWarnStatus = await screen.findByTestId('my-warning-status-w-exp');
    expect(myWarnStatus.textContent).toBe('Expired');
  });
});
