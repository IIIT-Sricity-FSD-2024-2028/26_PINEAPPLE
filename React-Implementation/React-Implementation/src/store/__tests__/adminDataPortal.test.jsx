import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { createAppStore } from '../index';
import { renderWithStore } from '../../test/test-utils';
import { routeChanged, sessionReset } from '../actions/appActions';
import adminUsersReducer, {
  setAll as setAllAdminUsers,
  addOne as addOneAdminUser,
  updateOne as updateOneAdminUser,
  removeOne as removeOneAdminUser,
  setAdminUsersFilter,
  setAdminUsersQuery,
} from '../slices/adminUsersSlice';
import auditLogReducer, {
  setAll as setAllAuditLogs,
  addOne as addOneAuditLog,
  updateOne as updateOneAuditLog,
  removeOne as removeOneAuditLog,
  syncAuditFiltersFromUrl,
  setAuditSearch,
} from '../slices/auditLogSlice';
import jobRunsReducer, {
  setAll as setAllJobRuns,
  addOne as addOneJobRun,
  updateOne as updateOneJobRun,
  removeOne as removeOneJobRun,
  selectJobRun,
} from '../slices/jobRunsSlice';
import platformConfigReducer, {
  setAll as setAllConfig,
  addOne as addOneConfig,
  updateOne as updateOneConfig,
  removeOne as removeOneConfig,
  setConfigSaveError,
} from '../slices/platformConfigSlice';
import portalAdminsReducer, {
  setAll as setAllPortalAdmins,
  addOne as addOnePortalAdmin,
  updateOne as updateOnePortalAdmin,
  removeOne as removeOnePortalAdmin,
  openAdminModal,
} from '../slices/portalAdminsSlice';
import adminProjectsReducer, {
  setAll as setAllAdminProjects,
  addOne as addOneAdminProject,
  updateOne as updateOneAdminProject,
  removeOne as removeOneAdminProject,
  setAdminProjectsFilter,
  setAdminProjectActiveTab,
} from '../slices/adminProjectsSlice';
import dataExportsReducer, {
  setAll as setAllDataExports,
  addOne as addOneDataExport,
  updateOne as updateOneDataExport,
  removeOne as removeOneDataExport,
} from '../slices/dataExportsSlice';
import { fetchAdminUsers, fetchDashboardStats } from '../thunks/adminUsersThunks';
import { fetchAuditLogs, exportAuditLogs } from '../thunks/auditLogThunks';
import { triggerJobTick } from '../thunks/jobRunsThunks';
import { updatePlatformConfig } from '../thunks/platformConfigThunks';
import { fetchPortalAdmins } from '../thunks/portalAdminsThunks';
import { fetchAdminProjectDetails } from '../thunks/adminProjectsThunks';
import { requestDataExport } from '../thunks/dataExportsThunks';
import AuditLog from '../../pages/admin/AuditLog';
import SuperuserConfig from '../../pages/admin/SuperuserConfig';
import SuperuserAdmins from '../../pages/admin/SuperuserAdmins';
import ScheduledJobsPanel from '../../pages/admin/ScheduledJobsPanel';
import AdminProjectDetails from '../../pages/admin/AdminProjectDetails';
import AdminDashboard from '../../pages/admin/AdminDashboard';

vi.mock('../../services/adminApi', () => {
  const api = {
    listUsers: vi.fn().mockResolvedValue([]),
    getDuplicateUsers: vi.fn().mockResolvedValue({ groups: [] }),
    getUserDetails: vi.fn(),
    getUserReputation: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    flagUser: vi.fn(),
    updateUserStatus: vi.fn(),
    getStats: vi.fn().mockResolvedValue({
      totalUsers: 12,
      activeUsers: 10,
      pendingMentorApps: 2,
      flaggedWarned: 1,
      suspendedUsers: 1,
      auditEvents: 4,
      activeAdmins: 3,
    }),
    getAuditLog: vi.fn().mockResolvedValue([]),
    exportAuditLog: vi.fn().mockResolvedValue({ csv: 'id,action\n', exportedCount: 1 }),
    recordAuditEntry: vi.fn().mockResolvedValue({}),
    getConfig: vi.fn().mockResolvedValue({
      maxProjectsPerUser: 10,
      maxCollaboratorsPerProject: 20,
      minimumTenure: 5,
      mentorMinYearsExperience: 5,
      xpPerTaskCompletion: 100,
      maintenanceMode: false,
      platformVersion: '1.4.2',
    }),
    getPublicConfig: vi.fn().mockResolvedValue({ mentorMinYearsExperience: 5 }),
    updateConfig: vi.fn(),
    getJobRuns: vi.fn().mockResolvedValue([]),
    getJobRun: vi.fn(),
    triggerJobTick: vi.fn(),
    getProjectEscrow: vi.fn().mockResolvedValue(null),
  };
  return { __esModule: true, default: api, adminApi: api };
});

vi.mock('../../services/portalAdminsApi', () => {
  const api = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  return { __esModule: true, default: api, portalAdminsApi: api };
});

vi.mock('../../services/projectsApi', async () => {
  const actual = await vi.importActual('../../services/projectsApi');
  const api = {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    restore: vi.fn(),
    cancelDeletion: vi.fn(),
    close: vi.fn(),
  };
  return { ...actual, __esModule: true, default: api, projectsApi: api };
});

vi.mock('../../services/tasksApi', () => {
  const api = {
    listByProject: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
  };
  return { __esModule: true, default: api, tasksApi: api };
});

vi.mock('../../services/trustApi', () => ({
  __esModule: true,
  default: { getTrustSummaries: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../services/mentorshipApi', () => ({
  __esModule: true,
  default: { getBadges: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../services/usersApi', () => {
  const api = {
    listExports: vi.fn().mockResolvedValue([]),
    requestExport: vi.fn(),
    getExportStatus: vi.fn(),
    downloadExport: vi.fn(),
  };
  return { __esModule: true, default: api, usersApi: api };
});

vi.mock('../../services/reportsApi', () => {
  const api = { getOpenCount: vi.fn().mockResolvedValue({ count: 0 }) };
  return { __esModule: true, default: api, reportsApi: api };
});

import adminApi from '../../services/adminApi';
import portalAdminsApi from '../../services/portalAdminsApi';
import projectsApi from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import usersApi from '../../services/usersApi';

describe('Phase 11: Admin Data Portal Slices, RBAC, Audit Filters, Jobs & Project Details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.listUsers.mockResolvedValue([]);
    adminApi.getDuplicateUsers.mockResolvedValue({ groups: [] });
    adminApi.getStats.mockResolvedValue({
      totalUsers: 12,
      activeUsers: 10,
      pendingMentorApps: 2,
      flaggedWarned: 1,
      suspendedUsers: 1,
      auditEvents: 4,
      activeAdmins: 3,
    });
    adminApi.getAuditLog.mockResolvedValue([]);
    adminApi.getConfig.mockResolvedValue({
      maxProjectsPerUser: 10,
      maxCollaboratorsPerProject: 20,
      minimumTenure: 5,
      mentorMinYearsExperience: 5,
      xpPerTaskCompletion: 100,
      maintenanceMode: false,
      platformVersion: '1.4.2',
    });
    adminApi.getJobRuns.mockResolvedValue([]);
    adminApi.getProjectEscrow.mockResolvedValue(null);
    portalAdminsApi.list.mockResolvedValue([]);
    tasksApi.list.mockResolvedValue([]);
  });

  describe('1. CRUD Reducers, Thunks & Route-Leave Reset (Reading B)', () => {
    it('supports all 4 explicit CRUD reducers on every Phase 11 slice', () => {
      // adminUsers
      let u = adminUsersReducer(undefined, { type: '@@INIT' });
      u = adminUsersReducer(u, setAllAdminUsers([{ id: 'u1', name: 'Alice' }]));
      u = adminUsersReducer(u, addOneAdminUser({ id: 'u2', name: 'Bob' }));
      u = adminUsersReducer(u, updateOneAdminUser({ id: 'u1', changes: { status: 'Flagged' } }));
      expect(u.entities.u1.status).toBe('Flagged');
      u = adminUsersReducer(u, removeOneAdminUser('u2'));
      expect(u.ids).toEqual(['u1']);

      // auditLog
      let a = auditLogReducer(undefined, { type: '@@INIT' });
      a = auditLogReducer(a, setAllAuditLogs([{ id: 'a1', action: 'warn' }]));
      a = auditLogReducer(a, addOneAuditLog({ id: 'a2', action: 'suspend' }));
      a = auditLogReducer(a, updateOneAuditLog({ id: 'a1', changes: { actor: 'su-1' } }));
      expect(a.entities.a1.actor).toBe('su-1');
      a = auditLogReducer(a, removeOneAuditLog('a2'));
      expect(a.ids).toEqual(['a1']);

      // jobRuns
      let j = jobRunsReducer(undefined, { type: '@@INIT' });
      j = jobRunsReducer(j, setAllJobRuns([{ id: 'r1', status: 'running' }]));
      j = jobRunsReducer(j, addOneJobRun({ id: 'r2', status: 'success' }));
      j = jobRunsReducer(j, updateOneJobRun({ id: 'r1', changes: { status: 'success' } }));
      expect(j.entities.r1.status).toBe('success');
      j = jobRunsReducer(j, removeOneJobRun('r2'));
      expect(j.ids).toEqual(['r1']);

      // platformConfig
      let c = platformConfigReducer(undefined, { type: '@@INIT' });
      c = platformConfigReducer(c, setAllConfig([{ id: 'singleton', xpPerTaskCompletion: 100 }]));
      c = platformConfigReducer(c, updateOneConfig({ id: 'singleton', changes: { xpPerTaskCompletion: 250 } }));
      expect(c.entities.singleton.xpPerTaskCompletion).toBe(250);
      c = platformConfigReducer(c, removeOneConfig('singleton'));
      expect(c.ids).toEqual([]);
      c = platformConfigReducer(c, addOneConfig({ maxProjectsPerUser: 15 }));
      expect(c.entities.singleton.maxProjectsPerUser).toBe(15);

      // portalAdmins
      let p = portalAdminsReducer(undefined, { type: '@@INIT' });
      p = portalAdminsReducer(p, setAllPortalAdmins([{ id: 'adm1', name: 'Ops' }]));
      p = portalAdminsReducer(p, addOnePortalAdmin({ id: 'adm2', name: 'Mod' }));
      p = portalAdminsReducer(p, updateOnePortalAdmin({ id: 'adm1', changes: { status: 'suspended' } }));
      expect(p.entities.adm1.status).toBe('suspended');
      p = portalAdminsReducer(p, removeOnePortalAdmin('adm2'));
      expect(p.ids).toEqual(['adm1']);

      // adminProjects
      let pr = adminProjectsReducer(undefined, { type: '@@INIT' });
      pr = adminProjectsReducer(pr, setAllAdminProjects([{ id: 'p1', title: 'Alpha' }]));
      pr = adminProjectsReducer(pr, addOneAdminProject({ id: 'p2', title: 'Beta' }));
      pr = adminProjectsReducer(pr, updateOneAdminProject({ id: 'p1', changes: { status: 'Closed' } }));
      expect(pr.entities.p1.status).toBe('Closed');
      pr = adminProjectsReducer(pr, removeOneAdminProject('p2'));
      expect(pr.ids).toEqual(['p1']);

      // dataExports
      let d = dataExportsReducer(undefined, { type: '@@INIT' });
      d = dataExportsReducer(d, setAllDataExports([{ exportId: 'e1', status: 'queued' }]));
      d = dataExportsReducer(d, addOneDataExport({ exportId: 'e2', status: 'ready' }));
      d = dataExportsReducer(d, updateOneDataExport({ id: 'e1', changes: { status: 'ready' } }));
      expect(d.entities.e1.status).toBe('ready');
      d = dataExportsReducer(d, removeOneDataExport('e2'));
      expect(d.ids).toEqual(['e1']);
    });

    it('syncs thunks cleanly and clears filters/drawers on routeChanged while keeping loaded lists', async () => {
      const store = createAppStore();

      adminApi.listUsers.mockResolvedValueOnce([{ id: 'u1', name: 'Ravi', status: 'Active' }]);
      adminApi.getAuditLog.mockResolvedValueOnce([{ id: 'aud-1', action: 'user-warned', actor: 'adm' }]);
      adminApi.triggerJobTick.mockRejectedValueOnce({
        statusCode: 409,
        code: 'JOB_ALREADY_RUNNING',
        serverMessage: 'Tick active',
      });
      portalAdminsApi.list.mockResolvedValueOnce([{ id: 'pa-1', name: 'Ops Lead', permissions: ['reports'] }]);
      projectsApi.get.mockResolvedValueOnce({ id: 'proj-9', title: 'Store Project', status: 'Open' });
      usersApi.requestExport.mockResolvedValueOnce({ exportId: 'exp-9', status: 'ready' });

      await store.dispatch(fetchAdminUsers());
      await store.dispatch(fetchDashboardStats());
      await store.dispatch(fetchAuditLogs());
      await store.dispatch(triggerJobTick());
      await store.dispatch(fetchPortalAdmins());
      await store.dispatch(fetchAdminProjectDetails('proj-9'));
      await store.dispatch(requestDataExport());

      expect(store.getState().adminUsers.ids).toEqual(['u1']);
      expect(store.getState().adminUsers.dashboardStats.totalUsers).toBe(12);
      expect(store.getState().jobRuns.working.errorMessage).toBe('Tick active');
      expect(store.getState().dataExports.latestExportId).toBe('exp-9');

      // Populate working filters, search & drawer flags
      store.dispatch(setAdminUsersFilter('flagged'));
      store.dispatch(setAdminUsersQuery('ravi'));
      store.dispatch(syncAuditFiltersFromUrl({ userId: 'u1', actor: 'adm', action: 'warn', range: '7d' }));
      store.dispatch(setAuditSearch('warn'));
      store.dispatch(selectJobRun('run-1'));
      store.dispatch(setConfigSaveError('Validation error'));
      store.dispatch(openAdminModal('pa-1'));
      store.dispatch(setAdminProjectsFilter('closed'));
      store.dispatch(setAdminProjectActiveTab('escrow'));

      // Navigate -> clears working state while preserving lists/entities
      store.dispatch(routeChanged({ from: '/admin/audit-log', to: '/admin/users' }));

      expect(store.getState().adminUsers.ids).toEqual(['u1']);
      expect(store.getState().adminUsers.working.filter).toBe('all');
      expect(store.getState().adminUsers.working.query).toBe('');
      expect(store.getState().auditLog.ids).toEqual(['aud-1']);
      expect(store.getState().auditLog.working.filters.userId).toBe('');
      expect(store.getState().auditLog.working.search).toBe('');
      expect(store.getState().jobRuns.working.selectedRunId).toBeNull();
      expect(store.getState().jobRuns.working.errorMessage).toBe('');
      expect(store.getState().platformConfig.working.saveError).toBe('');
      expect(store.getState().portalAdmins.ids).toEqual(['pa-1']);
      expect(store.getState().portalAdmins.working.modalOpen).toBe(false);
      expect(store.getState().adminProjects.entities['proj-9']).toBeTruthy();
      expect(store.getState().adminProjects.working.activeTab).toBe('overview');

      // Full reset on sessionReset
      store.dispatch(sessionReset());
      expect(store.getState().adminUsers.ids).toEqual([]);
      expect(store.getState().auditLog.ids).toEqual([]);
      expect(store.getState().portalAdmins.ids).toEqual([]);
      expect(store.getState().adminProjects.ids).toEqual([]);
      expect(store.getState().dataExports.ids).toEqual([]);
    });
  });

  describe('2. Audit Log URL Filters, Chips & Matching Export + AdminDashboard', () => {
    it('populates slice filters and chips from URL and dispatches export with identical filters', async () => {
      adminApi.getAuditLog.mockResolvedValueOnce([
        {
          id: 'aud-99',
          action: 'user-suspended',
          actor: 'admin-2',
          entityType: 'user',
          entityId: 'u-88',
          timestamp: '2026-11-20T09:00:00.000Z',
        },
      ]);
      adminApi.exportAuditLog.mockResolvedValueOnce('id,action\naud-99,user-suspended\n');

      const { store } = renderWithStore(<AuditLog />, {
        route: '/admin/audit-log?userId=u-88&reportId=rep-9&actor=admin-2&action=suspend&range=7d',
        preloadedState: {
          session: {
            adminUid: 'adm-audit',
            portalRole: 'admin',
            isSuperUser: false,
            permissions: ['audit'],
            initialized: true,
          },
        },
      });

      await waitFor(() => {
        expect(adminApi.getAuditLog).toHaveBeenCalledWith({
          userId: 'u-88',
          reportId: 'rep-9',
          actor: 'admin-2',
          action: 'suspend',
          range: '7d',
        });
      });

      expect(store.getState().auditLog.working.filters).toEqual(
        expect.objectContaining({
          userId: 'u-88',
          reportId: 'rep-9',
          actor: 'admin-2',
          action: 'suspend',
          range: '7d',
        }),
      );

      expect(await screen.findByTestId('chip-userId')).toBeTruthy();
      expect(screen.getByTestId('chip-reportId')).toBeTruthy();
      expect(screen.getByTestId('chip-actor')).toBeTruthy();
      expect(screen.getByTestId('chip-action')).toBeTruthy();
      expect(screen.getByTestId('chip-range')).toBeTruthy();

      // Open export modal and download CSV -> dispatches with identical filters
      fireEvent.click(screen.getByTestId('open-audit-export-btn'));
      fireEvent.click(await screen.findByTestId('confirm-audit-export-btn'));

      await waitFor(() => {
        expect(adminApi.exportAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            format: 'csv',
            userId: 'u-88',
            reportId: 'rep-9',
            actor: 'admin-2',
            action: 'suspend',
          }),
        );
      });

      // Verify exportAuditLogs also updates dataExportsSlice.lastAuditExport
      await store.dispatch(exportAuditLogs({ format: 'json', userId: 'u-88', refreshFilters: false }));
      expect(store.getState().dataExports.lastAuditExport.format).toBe('json');
    });

    it('renders AdminDashboard summaries and recent events directly from Redux store', async () => {
      adminApi.getAuditLog.mockResolvedValueOnce([
        { id: 'ev-1', action: 'project-closed', actor: 'admin', target: 'Proj X' },
      ]);

      renderWithStore(<AdminDashboard />, {
        preloadedState: {
          session: {
            adminUid: 'adm-dash',
            portalRole: 'admin',
            isSuperUser: false,
            permissions: ['dashboard'],
            initialized: true,
          },
        },
      });

      expect(await screen.findByText('Platform Overview')).toBeTruthy();
      expect(screen.getByText('12')).toBeTruthy(); // totalUsers
      expect(screen.getByText(/project-closed/i)).toBeTruthy();
    });
  });

  describe('3. Super User RBAC Controls, Jobs Panel & Server Errors', () => {
    it('disables platform config and Run now controls for non-superuser admin from sessionSlice', async () => {
      renderWithStore(<SuperuserConfig />, {
        preloadedState: {
          session: {
            adminUid: 'adm-readonly',
            portalRole: 'admin',
            isSuperUser: false,
            permissions: ['config'],
            initialized: true,
          },
        },
      });

      expect(await screen.findByText('Admin Read-Only')).toBeTruthy();
      const commitBtn = screen.getByTestId('commit-config-btn');
      const runNowBtn = screen.getByTestId('run-now-btn');
      expect(commitBtn.disabled).toBe(true);
      expect(runNowBtn.disabled).toBe(true);
    });

    it('disables portal admin mutations for admin lacking manage_admins permission and renders server error', async () => {
      const { store } = renderWithStore(<SuperuserAdmins />, {
        preloadedState: {
          session: {
            adminUid: 'adm-limited',
            portalRole: 'admin',
            isSuperUser: false,
            permissions: ['dashboard'],
            initialized: true,
          },
        },
      });

      expect(await screen.findByTestId('portal-admins-permission-notice')).toBeTruthy();
      expect(screen.getByTestId('new-portal-admin-btn').disabled).toBe(true);

      // Server error during updateConfig populates platformConfig working.saveError
      adminApi.updateConfig.mockRejectedValueOnce({
        statusCode: 403,
        serverMessage: 'Super User role required.',
      });
      await store.dispatch(updatePlatformConfig({ maxProjectsPerUser: 12 }));
      expect(store.getState().platformConfig.working.saveError).toContain('Super User role required.');
    });

    it('displays job run list and disables Run now while running or executes tick cleanly', async () => {
      adminApi.getJobRuns.mockResolvedValueOnce([
        { id: 'run-busy', trigger: 'cron', startedAt: '2026-11-20T08:00:00.000Z', status: 'running', jobs: [] },
      ]);

      renderWithStore(<ScheduledJobsPanel />, {
        preloadedState: {
          session: {
            adminUid: 'su-1',
            portalRole: 'superuser',
            isSuperUser: true,
            permissions: ['*'],
            initialized: true,
          },
        },
      });

      expect(await screen.findByTestId('run-row-run-busy')).toBeTruthy();
      const runBtn = screen.getByTestId('run-now-btn');
      expect(runBtn.disabled).toBe(true);
      expect(runBtn.textContent).toContain('Running...');
    });
  });

  describe('4. AdminProjectDetails Renders From Store', () => {
    it('renders title, status, closure notice, team members, tasks, and escrow ledger from store', async () => {
      const proj = {
        id: 'proj-det-1',
        title: 'Store-Backed Neural Grid',
        status: 'Closed',
        closureReason: 'Owner inactive 30+ days',
        closedAt: '2026-11-12T10:00:00.000Z',
        owner: { id: 'o-1', name: 'Priya Patel' },
        members: [
          { id: 'o-1', name: 'Priya Patel', role: 'Owner' },
          { id: 'c-1', name: 'Arjun Sharma', role: 'Collaborator' },
        ],
      };
      const projTasks = [
        { id: 't-1', title: 'Build Redux Layer', status: 'Completed', assigneeId: 'c-1', assignee: 'Arjun Sharma' },
      ];
      const escrowData = {
        ok: true,
        totals: { ownerPaid: 2000, inEscrow: 1500, mentorPayout: 500, refunds: 0, platformFee: 75 },
        sessions: [{ sessionId: 'sess-9901', mentorName: 'Neha', status: 'funded', held: 1500, released: 0, refunded: 0, platformFee: 75 }],
      };

      projectsApi.get.mockResolvedValueOnce(proj);
      tasksApi.list.mockResolvedValueOnce(projTasks);
      adminApi.getProjectEscrow.mockResolvedValueOnce(escrowData);

      renderWithStore(
        <Routes>
          <Route path="/admin/projects/:id" element={<AdminProjectDetails />} />
        </Routes>,
        {
          route: '/admin/projects/proj-det-1',
          preloadedState: {
            session: {
              adminUid: 'adm-proj',
              portalRole: 'admin',
              isSuperUser: true,
              permissions: ['projects', 'revenue'],
              initialized: true,
            },
          },
        },
      );

      expect(await screen.findByRole('heading', { level: 1, name: /Store-Backed Neural Grid/i })).toBeTruthy();
      expect(screen.getByTestId('admin-closure-notice')).toBeTruthy();
      expect(screen.getByTestId('admin-closure-reason').textContent).toContain('Owner inactive 30+ days');
      expect(screen.getAllByText('Priya Patel').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Arjun Sharma').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Build Redux Layer')).toBeTruthy();

      fireEvent.click(screen.getByTestId('admin-project-escrow-tab'));
      expect(await screen.findByTestId('admin-project-escrow-panel')).toBeTruthy();
      expect(screen.getByText('Reconciled')).toBeTruthy();
    });
  });
});
