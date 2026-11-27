import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  createRouteResetListener,
  routeResetListener,
} from './middleware/routeResetListener';
import { RESET_SCOPE } from './utils/routeReset';
import { setupInterceptors } from './utils/setupInterceptors';
import { setAdminSessionRefreshedHandler } from '../services/adminTokenManager';
import sessionReducer, {
  clearAdminSession,
  setAdminSession,
  setSuspendedInfo,
} from './slices/sessionSlice';
import uiReducer from './slices/uiSlice';
import notificationsReducer from './slices/notificationsSlice';
import projectsReducer from './slices/projectsSlice';
import tasksReducer from './slices/tasksSlice';
import actionFeedbackReducer from './slices/actionFeedbackSlice';
import joinRequestsReducer from './slices/joinRequestsSlice';
import projectInvitesReducer from './slices/projectInvitesSlice';
import leaveRequestsReducer from './slices/leaveRequestsSlice';
import communicationReducer from './slices/communicationSlice';
import mentorProfilesReducer from './slices/mentorProfilesSlice';
import mentorApplicationsReducer from './slices/mentorApplicationsSlice';
import mentorSessionsReducer from './slices/mentorSessionsSlice';
import abandonmentReviewsReducer from './slices/abandonmentReviewsSlice';
import sessionFeedbackReducer from './slices/sessionFeedbackSlice';
import paymentsReducer from './slices/paymentsSlice';
import escrowAccountsReducer from './slices/escrowAccountsSlice';
import sessionDisputesReducer from './slices/sessionDisputesSlice';
import reportsReducer from './slices/reportsSlice';
import appealsReducer from './slices/appealsSlice';
import warningsReducer from './slices/warningsSlice';
import pendingModerationActionsReducer from './slices/pendingModerationActionsSlice';
import supportTicketsReducer from './slices/supportTicketsSlice';
import adminUsersReducer from './slices/adminUsersSlice';
import auditLogReducer from './slices/auditLogSlice';
import jobRunsReducer from './slices/jobRunsSlice';
import platformConfigReducer from './slices/platformConfigSlice';
import portalAdminsReducer from './slices/portalAdminsSlice';
import adminProjectsReducer from './slices/adminProjectsSlice';
import dataExportsReducer from './slices/dataExportsSlice';
import profilesReducer from './slices/profilesSlice';
import reputationReducer from './slices/reputationSlice';
import gamificationReducer from './slices/gamificationSlice';
import settingsReducer from './slices/settingsSlice';

/**
 * Root reducer map (populated slice-by-slice across Phases 1–12 per Decision D1).
 */
export const rootReducers = {
  session: sessionReducer,
  ui: uiReducer,
  notifications: notificationsReducer,
  projects: projectsReducer,
  tasks: tasksReducer,
  actionFeedback: actionFeedbackReducer,
  joinRequests: joinRequestsReducer,
  projectInvites: projectInvitesReducer,
  leaveRequests: leaveRequestsReducer,
  communication: communicationReducer,
  mentorProfiles: mentorProfilesReducer,
  mentorApplications: mentorApplicationsReducer,
  mentorSessions: mentorSessionsReducer,
  abandonmentReviews: abandonmentReviewsReducer,
  sessionFeedback: sessionFeedbackReducer,
  payments: paymentsReducer,
  escrowAccounts: escrowAccountsReducer,
  sessionDisputes: sessionDisputesReducer,
  reports: reportsReducer,
  appeals: appealsReducer,
  warnings: warningsReducer,
  pendingModerationActions: pendingModerationActionsReducer,
  supportTickets: supportTicketsReducer,
  adminUsers: adminUsersReducer,
  auditLog: auditLogReducer,
  jobRuns: jobRunsReducer,
  platformConfig: platformConfigReducer,
  portalAdmins: portalAdminsReducer,
  adminProjects: adminProjectsReducer,
  dataExports: dataExportsReducer,
  profiles: profilesReducer,
  reputation: reputationReducer,
  gamification: gamificationReducer,
  settings: settingsReducer,
};

function buildRootReducer(extraReducers = {}) {
  const merged = { ...rootReducers, ...extraReducers };
  return combineReducers(merged);
}

export function bindAdminRefreshStore(targetStore) {
  if (!targetStore || typeof targetStore.dispatch !== 'function') return;
  setAdminSessionRefreshedHandler((payload) => {
    if (!payload || payload.error) {
      const err = payload?.error;
      if (err?.code === 'ACCOUNT_SUSPENDED' || err?.data?.code === 'ACCOUNT_SUSPENDED') {
        targetStore.dispatch(
          setSuspendedInfo(
            err.data || {
              reason: err.reason,
              suspendedAt: err.suspendedAt,
              suspensionType: err.suspensionType,
              appealAvailable: err.appealAvailable,
              supportContact: err.supportContact,
            },
          ),
        );
      }
      targetStore.dispatch(clearAdminSession());
      return;
    }
    if (payload.token) {
      const adminObj = payload.admin || payload;
      targetStore.dispatch(
        setAdminSession({
          uid: adminObj.id || adminObj.uid || payload.uid || payload.id || '',
          token: payload.token,
          portalRole: adminObj.role || payload.role || 'admin',
          email: adminObj.email || payload.email || '',
          permissions: adminObj.permissions || payload.permissions || [],
          name: adminObj.name || payload.name || 'Admin',
        }),
      );
    }
  });
}

export function createAppStore({
  preloadedState,
  extraReducers,
  routeResetScope = RESET_SCOPE,
} = {}) {
  const activeListener =
    routeResetScope === RESET_SCOPE
      ? routeResetListener
      : createRouteResetListener(routeResetScope);

  const created = configureStore({
    reducer: buildRootReducer(extraReducers),
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: true,
        immutableCheck: true,
      }).prepend(activeListener.middleware),
  });
  bindAdminRefreshStore(created);
  return created;
}

export const makeStore = createAppStore;

export const store = createAppStore();
setupInterceptors(store);
bindAdminRefreshStore(store);

export default store;
