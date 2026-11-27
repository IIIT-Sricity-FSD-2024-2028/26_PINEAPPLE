import { describe, it, expect } from 'vitest';
import { rootReducers, createAppStore } from '../index';

import * as abandonmentReviewsSlice from '../slices/abandonmentReviewsSlice';
import * as actionFeedbackSlice from '../slices/actionFeedbackSlice';
import * as adminProjectsSlice from '../slices/adminProjectsSlice';
import * as adminUsersSlice from '../slices/adminUsersSlice';
import * as appealsSlice from '../slices/appealsSlice';
import * as auditLogSlice from '../slices/auditLogSlice';
import * as communicationSlice from '../slices/communicationSlice';
import * as dataExportsSlice from '../slices/dataExportsSlice';
import * as escrowAccountsSlice from '../slices/escrowAccountsSlice';
import * as gamificationSlice from '../slices/gamificationSlice';
import * as jobRunsSlice from '../slices/jobRunsSlice';
import * as joinRequestsSlice from '../slices/joinRequestsSlice';
import * as leaveRequestsSlice from '../slices/leaveRequestsSlice';
import * as mentorApplicationsSlice from '../slices/mentorApplicationsSlice';
import * as mentorProfilesSlice from '../slices/mentorProfilesSlice';
import * as mentorSessionsSlice from '../slices/mentorSessionsSlice';
import * as notificationsSlice from '../slices/notificationsSlice';
import * as paymentsSlice from '../slices/paymentsSlice';
import * as pendingModerationActionsSlice from '../slices/pendingModerationActionsSlice';
import * as platformConfigSlice from '../slices/platformConfigSlice';
import * as portalAdminsSlice from '../slices/portalAdminsSlice';
import * as profilesSlice from '../slices/profilesSlice';
import * as projectInvitesSlice from '../slices/projectInvitesSlice';
import * as projectsSlice from '../slices/projectsSlice';
import * as reportsSlice from '../slices/reportsSlice';
import * as reputationSlice from '../slices/reputationSlice';
import * as sessionDisputesSlice from '../slices/sessionDisputesSlice';
import * as sessionFeedbackSlice from '../slices/sessionFeedbackSlice';
import * as sessionSlice from '../slices/sessionSlice';
import * as settingsSlice from '../slices/settingsSlice';
import * as supportTicketsSlice from '../slices/supportTicketsSlice';
import * as tasksSlice from '../slices/tasksSlice';
import * as uiSlice from '../slices/uiSlice';
import * as warningsSlice from '../slices/warningsSlice';

const DOMAIN_SLICES = [
  ['abandonmentReviews', abandonmentReviewsSlice],
  ['actionFeedback', actionFeedbackSlice],
  ['adminProjects', adminProjectsSlice],
  ['adminUsers', adminUsersSlice],
  ['appeals', appealsSlice],
  ['auditLog', auditLogSlice],
  ['communication', communicationSlice],
  ['dataExports', dataExportsSlice],
  ['escrowAccounts', escrowAccountsSlice],
  ['gamification', gamificationSlice],
  ['jobRuns', jobRunsSlice],
  ['joinRequests', joinRequestsSlice],
  ['leaveRequests', leaveRequestsSlice],
  ['mentorApplications', mentorApplicationsSlice],
  ['mentorProfiles', mentorProfilesSlice],
  ['mentorSessions', mentorSessionsSlice],
  ['notifications', notificationsSlice],
  ['payments', paymentsSlice],
  ['pendingModerationActions', pendingModerationActionsSlice],
  ['platformConfig', platformConfigSlice],
  ['portalAdmins', portalAdminsSlice],
  ['profiles', profilesSlice],
  ['projectInvites', projectInvitesSlice],
  ['projects', projectsSlice],
  ['reports', reportsSlice],
  ['reputation', reputationSlice],
  ['sessionDisputes', sessionDisputesSlice],
  ['sessionFeedback', sessionFeedbackSlice],
  ['settings', settingsSlice],
  ['supportTickets', supportTicketsSlice],
  ['tasks', tasksSlice],
  ['warnings', warningsSlice],
];

// Literal Group A `*Repository` classes in back-end/src/*/*.repository.ts (plus retired aliases)
// ProjectsRepository, TasksRepository, UsersRepository (profiles/settings/adminUsers),
// CommunicationRepository, LeaveRequestsRepository, ActionFeedbackRepository,
// GamificationRepository, MentorshipRepository (Badges), GovernanceRepository (superseded by reports)
const LITERAL_REPOSITORY_BACKED_SLICES = [
  projectsSlice,
  tasksSlice,
  profilesSlice,
  communicationSlice,
  leaveRequestsSlice,
  actionFeedbackSlice,
  gamificationSlice,
  reputationSlice,
  reportsSlice,
];

describe('Phase 13 Compliance Proof: Store Slices & 4xN CRUD Reducers', () => {
  it('registers all 34 slices (32 domain slices + sessionSlice + uiSlice) in rootReducers', () => {
    expect(DOMAIN_SLICES).toHaveLength(32);
    expect(sessionSlice.default).toBeTypeOf('function');
    expect(uiSlice.default).toBeTypeOf('function');

    const store = createAppStore();
    const state = store.getState();
    expect(Object.keys(rootReducers)).toHaveLength(34);
    expect(Object.keys(state)).toHaveLength(34);
  });

  it('proves every domain slice exports all 4 explicit CRUD action creators (setAll, addOne, updateOne, removeOne) -> 32 x 4 = 128', () => {
    let crudCount = 0;
    for (const [sliceKey, mod] of DOMAIN_SLICES) {
      expect(mod.default, `${sliceKey} default reducer`).toBeTypeOf('function');
      expect(mod.setAll, `${sliceKey}.setAll`).toBeTypeOf('function');
      expect(mod.addOne, `${sliceKey}.addOne`).toBeTypeOf('function');
      expect(mod.updateOne, `${sliceKey}.updateOne`).toBeTypeOf('function');
      expect(mod.removeOne, `${sliceKey}.removeOne`).toBeTypeOf('function');
      expect(rootReducers[sliceKey], `rootReducers.${sliceKey}`).toBe(mod.default);
      crudCount += 4;
    }
    expect(crudCount).toBe(128);
    // Decision D1 counts 31 UI-consumed backend collections -> at least 31 x 4 = 124 CRUD ops
    expect(crudCount).toBeGreaterThanOrEqual(31 * 4);
  });

  it('proves Lens A literal repository count (9 x 4 = 36 CRUD ops) is strictly satisfied and non-empty', () => {
    let literalCrudCount = 0;
    for (const mod of LITERAL_REPOSITORY_BACKED_SLICES) {
      for (const actionName of ['setAll', 'addOne', 'updateOne', 'removeOne']) {
        expect(mod[actionName]).toBeTypeOf('function');
        literalCrudCount += 1;
      }
    }
    expect(LITERAL_REPOSITORY_BACKED_SLICES).toHaveLength(9);
    expect(literalCrudCount).toBe(36);
  });
});
