import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAppStore } from '../index';
import { renderWithStore } from '../../test/test-utils';
import { routeChanged, sessionReset } from '../actions/appActions';
import { setAdminSession } from '../slices/sessionSlice';
import { canAccess, selectCanAccess } from '../selectors/sessionSelectors';
import reportsReducer, {
  setAll as setAllReports,
  addOne as addOneReport,
  updateOne as updateOneReport,
  removeOne as removeOneReport,
  setReportFilter,
  setReportSearch,
} from '../slices/reportsSlice';
import appealsReducer, {
  setAll as setAllAppeals,
  addOne as addOneAppeal,
  updateOne as updateOneAppeal,
  removeOne as removeOneAppeal,
  setAppealFilter,
} from '../slices/appealsSlice';
import warningsReducer, {
  setAll as setAllWarnings,
  addOne as addOneWarning,
  updateOne as updateOneWarning,
  removeOne as removeOneWarning,
} from '../slices/warningsSlice';
import moderationReducer, {
  setAll as setAllModActions,
  addOne as addOneModAction,
  updateOne as updateOneModAction,
  removeOne as removeOneModAction,
} from '../slices/pendingModerationActionsSlice';
import supportTicketsReducer, {
  setAll as setAllTickets,
  addOne as addOneTicket,
  updateOne as updateOneTicket,
  removeOne as removeOneTicket,
  setSupportStatusFilter,
  setSupportSearchQuery,
  selectMyTicket,
} from '../slices/supportTicketsSlice';
import {
  fetchAdminReportDetails,
  fetchOpenReportsCount,
} from '../thunks/reportsThunks';
import { issueUserWarning } from '../thunks/warningsThunks';
import { updateAdminSupportTicket } from '../thunks/supportTicketsThunks';
import AdminSupport from '../../pages/admin/AdminSupport';
import AdminReports from '../../pages/admin/AdminReports';
import AdminUsers from '../../pages/admin/AdminUsers';
import ModerationModal from '../../components/common/ModerationModal';

vi.mock('../../services/reportsApi', () => {
  const api = {
    createReport: vi.fn(),
    submitReport: vi.fn(),
    getMyReports: vi.fn().mockResolvedValue([]),
    getAdminReports: vi.fn().mockResolvedValue([]),
    getOpenCount: vi.fn().mockResolvedValue({ count: 0 }),
    getReportDetails: vi.fn(),
    getAdminReportById: vi.fn(),
    updateReportStatus: vi.fn(),
    actionReport: vi.fn(),
    getOwnerPatterns: vi.fn().mockResolvedValue({ items: [] }),
  };
  return { __esModule: true, default: api, reportsApi: api };
});

vi.mock('../../services/appealsApi', () => {
  const api = {
    submitAppeal: vi.fn(),
    getMyAppeals: vi.fn().mockResolvedValue([]),
    getAdminAppeals: vi.fn().mockResolvedValue([]),
    decideAppeal: vi.fn(),
  };
  return { __esModule: true, default: api, appealsApi: api };
});

vi.mock('../../services/supportApi', () => {
  const api = {
    listMyTickets: vi.fn().mockResolvedValue([]),
    getMyTicket: vi.fn(),
    createTicket: vi.fn(),
    replyToMyTicket: vi.fn(),
    listAdminTickets: vi.fn().mockResolvedValue({ items: [], total: 0, totalPages: 1 }),
    listAssignees: vi.fn().mockResolvedValue([]),
    getAdminTicket: vi.fn(),
    updateAdminTicket: vi.fn(),
    replyAdminTicket: vi.fn(),
    closeProjectFromTicket: vi.fn(),
  };
  return { __esModule: true, default: api, supportApi: api };
});

vi.mock('../../services/adminApi', () => {
  const api = {
    listUsers: vi.fn().mockResolvedValue([]),
    getDuplicateUsers: vi.fn().mockResolvedValue({ groups: [] }),
    getModerationActions: vi.fn().mockResolvedValue([]),
    approveModerationAction: vi.fn(),
    rejectModerationAction: vi.fn(),
    warnUser: vi.fn(),
    suspendUser: vi.fn(),
    reactivateUser: vi.fn(),
    getWarnings: vi.fn().mockResolvedValue([]),
    getMyWarnings: vi.fn().mockResolvedValue([]),
    getDisputes: vi.fn().mockResolvedValue([]),
    getNeedsReviewSessions: vi.fn().mockResolvedValue([]),
  };
  return { __esModule: true, default: api, adminApi: api };
});

vi.mock('../../services/trustApi', () => ({
  __esModule: true,
  default: { getTrustSummaries: vi.fn().mockResolvedValue([]) },
}));

import reportsApi from '../../services/reportsApi';
import supportApi from '../../services/supportApi';
import { adminApi } from '../../services/adminApi';

describe('Phase 10: Moderation, Reports, Appeals & Support Slices + UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportsApi.getAdminReports.mockResolvedValue([]);
    reportsApi.getOpenCount.mockResolvedValue({ count: 0 });
    supportApi.listAssignees.mockResolvedValue([]);
    supportApi.listAdminTickets.mockResolvedValue({ items: [], total: 0, totalPages: 1 });
    adminApi.listUsers.mockResolvedValue([]);
    adminApi.getModerationActions.mockResolvedValue([]);
  });

  describe('1. CRUD Reducers & Reading B Route-Leave Reset', () => {
    it('supports all 4 explicit CRUD reducers on reports, appeals, warnings, pendingModerationActions, and supportTickets', () => {
      // reportsSlice
      let rState = reportsReducer(undefined, { type: '@@INIT' });
      rState = reportsReducer(rState, setAllReports([{ id: 'r-1', status: 'Open' }]));
      rState = reportsReducer(rState, addOneReport({ id: 'r-2', status: 'Open' }));
      rState = reportsReducer(rState, updateOneReport({ id: 'r-2', changes: { status: 'Resolved' } }));
      expect(rState.entities['r-2'].status).toBe('Resolved');
      rState = reportsReducer(rState, removeOneReport('r-1'));
      expect(rState.ids).toEqual(['r-2']);

      // appealsSlice
      let aState = appealsReducer(undefined, { type: '@@INIT' });
      aState = appealsReducer(aState, setAllAppeals([{ id: 'a-1', status: 'pending' }]));
      aState = appealsReducer(aState, addOneAppeal({ id: 'a-2', status: 'pending' }));
      aState = appealsReducer(aState, updateOneAppeal({ id: 'a-1', changes: { status: 'accepted' } }));
      expect(aState.entities['a-1'].status).toBe('accepted');
      aState = appealsReducer(aState, removeOneAppeal('a-2'));
      expect(aState.ids).toEqual(['a-1']);

      // warningsSlice
      let wState = warningsReducer(undefined, { type: '@@INIT' });
      wState = warningsReducer(wState, setAllWarnings([{ id: 'w-1', userId: 'u-1' }]));
      wState = warningsReducer(wState, addOneWarning({ id: 'w-2', userId: 'u-1' }));
      wState = warningsReducer(wState, updateOneWarning({ id: 'w-1', changes: { active: false } }));
      expect(wState.entities['w-1'].active).toBe(false);
      wState = warningsReducer(wState, removeOneWarning('w-2'));
      expect(wState.ids).toEqual(['w-1']);

      // pendingModerationActionsSlice
      let mState = moderationReducer(undefined, { type: '@@INIT' });
      mState = moderationReducer(mState, setAllModActions([{ id: 'm-1', status: 'pending' }]));
      mState = moderationReducer(mState, addOneModAction({ id: 'm-2', status: 'pending' }));
      mState = moderationReducer(mState, updateOneModAction({ id: 'm-1', changes: { status: 'approved' } }));
      expect(mState.entities['m-1'].status).toBe('approved');
      mState = moderationReducer(mState, removeOneModAction('m-2'));
      expect(mState.ids).toEqual(['m-1']);

      // supportTicketsSlice
      let tState = supportTicketsReducer(undefined, { type: '@@INIT' });
      tState = supportTicketsReducer(tState, setAllTickets([{ id: 't-1', status: 'open' }]));
      tState = supportTicketsReducer(tState, addOneTicket({ id: 't-2', status: 'open' }));
      tState = supportTicketsReducer(tState, updateOneTicket({ id: 't-1', changes: { status: 'resolved' } }));
      expect(tState.entities['t-1'].status).toBe('resolved');
      tState = supportTicketsReducer(tState, removeOneTicket('t-2'));
      expect(tState.ids).toEqual(['t-1']);
    });

    it('routeChanged clears selected ticket, report, and filters while keeping loaded lists and openCount', async () => {
      const store = createAppStore();

      reportsApi.getOpenCount.mockResolvedValueOnce({ count: 7 });
      reportsApi.getReportDetails.mockResolvedValueOnce({ id: 'rep-1', status: 'Open', reportedUserId: 'u-5' });

      await store.dispatch(fetchOpenReportsCount());
      await store.dispatch(fetchAdminReportDetails('rep-1'));
      store.dispatch(setReportFilter('Open'));
      store.dispatch(setReportSearch('spam'));
      store.dispatch(setAppealFilter('pending'));
      store.dispatch(addOneTicket({ id: 'tic-1', subject: 'Billing help', status: 'open' }));
      store.dispatch(selectMyTicket('tic-1'));
      store.dispatch(setSupportStatusFilter('open'));
      store.dispatch(setSupportSearchQuery('billing'));

      expect(store.getState().reports.working.selectedReportId).toBe('rep-1');
      expect(store.getState().supportTickets.working.selectedMyTicketId).toBe('tic-1');
      expect(store.getState().supportTickets.working.statusFilter).toBe('open');

      // Navigate across routes
      store.dispatch(routeChanged({ from: '/admin/support', to: '/admin/reports' }));

      // Lists & openCount MUST remain; selected tickets/reports/filters MUST reset
      expect(store.getState().reports.openCount).toBe(7);
      expect(store.getState().reports.entities['rep-1']).toBeTruthy();
      expect(store.getState().reports.working.selectedReportId).toBeNull();
      expect(store.getState().reports.working.reportFilter).toBe('all');
      expect(store.getState().reports.working.reportSearch).toBe('');
      expect(store.getState().appeals.working.appealFilter).toBe('all');

      expect(store.getState().supportTickets.entities['tic-1']).toBeTruthy();
      expect(store.getState().supportTickets.working.selectedMyTicketId).toBeNull();
      expect(store.getState().supportTickets.working.statusFilter).toBe('all');
      expect(store.getState().supportTickets.working.searchQuery).toBe('');

      // Logout / sessionReset wipes everything
      store.dispatch(sessionReset());
      expect(store.getState().reports.openCount).toBe(0);
      expect(store.getState().supportTickets.ids).toEqual([]);
    });
  });

  describe('2. RBAC Session Slice canAccess & Audit Link URL', () => {
    it('reads admin permission visibility from sessionSlice and renders audit link in new tab when permitted', async () => {
      const store = createAppStore();
      store.dispatch(setAdminSession({ adminUid: 'adm-1', portalRole: 'admin', permissions: ['reports'] }));

      expect(selectCanAccess('reports')(store.getState())).toBe(true);
      expect(selectCanAccess('audit')(store.getState())).toBe(false);
      expect(canAccess(store.getState().session, 'support')).toBe(false);

      reportsApi.getAdminReports.mockResolvedValueOnce([
        {
          id: 'rep-audit-1',
          reporterName: 'Riya',
          reportedUserId: 'bad-u-9',
          reportedUserName: 'Spammer',
          reason: 'Harassment',
          status: 'Open',
          createdAt: '2026-11-15T10:00:00.000Z',
        },
      ]);
      reportsApi.getReportDetails.mockResolvedValueOnce({
        id: 'rep-audit-1',
        reportedUserId: 'bad-u-9',
        reportedUserName: 'Spammer',
        reporterName: 'Riya',
        reason: 'Harassment',
        details: 'Repeated harassment messages in chat.',
        status: 'Open',
      });

      renderWithStore(<AdminReports />, {
        preloadedState: {
          session: {
            adminUid: 'adm-1',
            portalRole: 'admin',
            isSuperUser: false,
            permissions: ['reports', 'audit'],
            initialized: true,
          },
        },
      });

      fireEvent.click(await screen.findByTestId('review-report-rep-audit-1'));
      const auditLink = await screen.findByTestId('link-view-audit');
      expect(auditLink.tagName).toBe('A');
      expect(auditLink.getAttribute('target')).toBe('_blank');
      expect(auditLink.getAttribute('href')).toBe(
        '/admin/audit-log?userId=bad-u-9&reportId=rep-audit-1&from=report',
      );
    });

    it('denies AdminSupport when sessionSlice lacks support permission', () => {
      renderWithStore(<AdminSupport />, {
        preloadedState: {
          session: {
            adminUid: 'adm-2',
            portalRole: 'admin',
            isSuperUser: false,
            permissions: ['reports'],
            initialized: true,
          },
        },
      });
      expect(screen.getByTestId('admin-support-denied')).toBeTruthy();
    });
  });

  describe('3. Terminal Ticket (TICKET_CLOSED), Decided Report & Second-Approval Queue', () => {
    it('renders resolved ticket read-only from store and handles 409 TICKET_CLOSED on PATCH', async () => {
      const resolvedTicket = {
        id: 'tic-res-1',
        type: 'help',
        subject: 'Resolved billing inquiry',
        message: 'Everything fixed',
        status: 'resolved',
        priority: 'high',
        assigneeName: 'Support Lead',
        resolutionNote: 'Confirmed payment settled cleanly.',
        resolvedAt: '2026-11-18T12:00:00.000Z',
        createdAt: '2026-11-18T10:00:00.000Z',
        replies: [],
      };
      supportApi.listAdminTickets.mockResolvedValue({
        items: [resolvedTicket],
        total: 1,
        totalPages: 1,
      });
      supportApi.getAdminTicket.mockResolvedValue(resolvedTicket);

      const { store } = renderWithStore(<AdminSupport />, {
        preloadedState: {
          session: {
            adminUid: 'adm-sup',
            portalRole: 'admin',
            isSuperUser: false,
            permissions: ['support'],
            initialized: true,
          },
        },
      });

      fireEvent.click(await screen.findByTestId('open-ticket-tic-res-1'));
      expect(await screen.findByTestId('ticket-readonly-banner')).toBeTruthy();
      expect(screen.queryByTestId('ticket-status-select')).toBeNull();
      expect(screen.queryByTestId('admin-reply-input')).toBeNull();

      // Verify PATCH returning 409 TICKET_CLOSED stores error and refreshes read-only state
      const closedErr = new Error('Ticket closed');
      closedErr.code = 'TICKET_CLOSED';
      closedErr.statusCode = 409;
      supportApi.updateAdminTicket.mockRejectedValueOnce(closedErr);
      supportApi.getAdminTicket.mockResolvedValueOnce(resolvedTicket);

      await store.dispatch(
        updateAdminSupportTicket({ ticketId: 'tic-res-1', payload: { priority: 'low' } }),
      );
      expect(store.getState().supportTickets.working.drawerError).toBe(
        'This ticket is closed and read-only.',
      );
    });

    it('disables report resolution actions when selected report is already decided', async () => {
      const decidedReport = {
        id: 'rep-decided-1',
        reporterName: 'User A',
        reportedUserId: 'u-bad',
        reportedUserName: 'User B',
        reason: 'Abuse',
        details: 'Abusive chat messages in workspace.',
        status: 'Resolved',
        adminNote: 'Warning issued earlier.',
        createdAt: '2026-11-10T09:00:00.000Z',
        updatedAt: '2026-11-10T11:00:00.000Z',
      };
      reportsApi.getAdminReports.mockResolvedValueOnce([decidedReport]);
      reportsApi.getReportDetails.mockResolvedValueOnce(decidedReport);

      renderWithStore(<AdminReports />, {
        preloadedState: {
          session: {
            adminUid: 'adm-rep',
            portalRole: 'admin',
            isSuperUser: true,
            permissions: ['reports', 'audit'],
            initialized: true,
          },
        },
      });

      fireEvent.click(await screen.findByTestId('review-report-rep-decided-1'));
      expect(await screen.findByTestId('report-decided-banner')).toBeTruthy();
      expect(screen.getByTestId('action-warn-btn').hasAttribute('disabled')).toBe(true);
      expect(screen.getByTestId('action-suspend-btn').hasAttribute('disabled')).toBe(true);
      expect(screen.getByTestId('action-dismiss-btn').hasAttribute('disabled')).toBe(true);
    });

    it('renders own pending moderation actions as waiting while allowing peer actions', async () => {
      adminApi.getModerationActions.mockResolvedValueOnce([
        {
          id: 'mod-own-1',
          targetUserId: 'u-1',
          targetUserName: 'Own Target',
          requestedBy: 'adm-current',
          requestedByName: 'Current Admin',
          status: 'pending',
          reason: 'Repeated harassment violations across rooms.',
        },
        {
          id: 'mod-peer-2',
          targetUserId: 'u-2',
          targetUserName: 'Peer Target',
          requestedBy: 'adm-other',
          requestedByName: 'Other Admin',
          status: 'pending',
          reason: 'Escalated conduct violations in workspace.',
        },
      ]);

      renderWithStore(<AdminUsers />, {
        preloadedState: {
          session: {
            adminUid: 'adm-current',
            portalRole: 'admin',
            isSuperUser: false,
            permissions: ['users'],
            initialized: true,
          },
        },
      });

      const approvalsTab = await screen.findByRole('tab', { name: /Approvals/i });
      fireEvent.click(approvalsTab);

      expect(await screen.findByTestId('waiting-other-admin-mod-own-1')).toBeTruthy();
      expect(screen.queryByTestId('approve-mod-action-mod-own-1')).toBeNull();
      expect(screen.getByTestId('approve-mod-action-mod-peer-2')).toBeTruthy();
      expect(screen.getByTestId('reject-mod-action-mod-peer-2')).toBeTruthy();
    });

    it('updates user warning count in warningsSlice after issuing warning and enforces ModerationModal reason validation', async () => {
      const user = userEvent.setup();
      adminApi.warnUser.mockResolvedValueOnce({
        warning: { id: 'w-99', userId: 'u-warn-1', active: true },
        activeCount: 3,
        autoSuspended: false,
      });

      const onClose = vi.fn();
      const onSuccess = vi.fn();
      const { store } = renderWithStore(
        <ModerationModal
          isOpen={true}
          actionType="warn"
          targetUser={{
            id: 'u-warn-1',
            name: 'Priya',
            username: 'priya',
            activeWarningsCount: 2,
          }}
          onClose={onClose}
          onSuccess={onSuccess}
        />,
      );

      const submitBtn = screen.getByRole('button', { name: /Confirm Warning/i });
      expect(submitBtn.hasAttribute('disabled')).toBe(true);

      const input = screen.getByPlaceholderText(/Explain the reason for this action/i);
      await user.type(input, 'Too short');
      expect(submitBtn.hasAttribute('disabled')).toBe(true);

      await user.clear(input);
      await user.type(input, 'Repeated policy breach in project chat.');
      expect(submitBtn.hasAttribute('disabled')).toBe(false);

      await user.click(submitBtn);

      await waitFor(() => {
        expect(adminApi.warnUser).toHaveBeenCalledWith('u-warn-1', {
          reason: 'Repeated policy breach in project chat.',
        });
      });

      expect(store.getState().warnings.activeWarningsCountByUserId['u-warn-1']).toBe(3);

      // Direct thunk verification too
      adminApi.warnUser.mockResolvedValueOnce({
        warning: { id: 'w-100', userId: 'u-warn-1', active: true },
        activeCount: 4,
        autoSuspended: true,
      });
      await store
        .dispatch(
          issueUserWarning({
            userId: 'u-warn-1',
            reason: 'Fourth warning automatically suspending user.',
          }),
        )
        .unwrap();
      expect(store.getState().warnings.activeWarningsCountByUserId['u-warn-1']).toBe(4);
    });
  });
});
