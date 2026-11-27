# Phase 13 Team Viva Pack (5 Students)

> Grounded strictly in the final **Phase 13** codebase (`React-Implementation/React-Implementation/src/store/` and `src/pages/`) and actual Phases 0–13 contributions recorded in [`08-progress.md`](./08-progress.md).

---

## Team Ownership Summary Across Final `34` Redux Slices

| Student | Owned Slices & Store Infrastructure | Owned Pages / Components |
|---|---|---|
| **Aditya Sai** *(Store Lead)* | `store/index.js`, `appActions.js`, `routeReset.js`, `routeResetListener.js`, `setupInterceptors.js`, `thunkError.js`, `RouteResetObserver.jsx`, `sessionSlice`, `uiSlice`, `notificationsSlice`, `platformConfigSlice`, `auditLogSlice`, `dataExportsSlice`, `settingsSlice`, scan tests (`NoApiInComponentsScan`, `NoBrowserStorageScan`, `NoCustomDomEventsScan`, `RoleStoreScan`, `complianceCrudProof`) | `main.jsx`, `App.jsx`, `navbar.jsx`, `ProtectedRoute`, `Login`, `Signup`, `CompleteProfile`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `Suspended`, `notifications`, `settings`, `VerifyEmailBanner`, `UsernameConfirmationBanner`, `AuditLog` |
| **Rithvik** | `projectsSlice`, `joinRequestsSlice`, `projectInvitesSlice`, `leaveRequestsSlice`, `actionFeedbackSlice` (plus `useReasonAction.js` abandonment/reason hook) | `OwnerProtectedRoute`, `OwnerDashboard`, `CreateProject`, `MyProjects`, `OwnedWorkspace` (Requests, Invites, Leave Requests, Task Board, Feedback, Chat, Deletion), `AppliedProjects`, `UniversalReasonModal`, `FeedbackHistory`, `JoinRequestCard`, `DeleteProjectDialog`, `ProjectTombstone` |
| **Satwik** | `tasksSlice`, `communicationSlice`, `warningsSlice`, `pendingModerationActionsSlice`, `adminUsersSlice`, `adminProjectsSlice`, `profilesSlice`, `reputationSlice` | `layout.jsx`, `sidebar.jsx`, `ProjectsMarketplace`, `MyWork`, `CollaboratorWorkspace`, `ChatBox`, `TaskCard`, `ProjectCard`, `UserTrustCard`, `ModerationModal`, `AdminUsers`, `AdminUserDetails`, `AdminProjects`, `AdminProjectDetails` (`ProjectDetailsCard`, `EscrowFinancialsCard`, `TasksMilestonesCard`, `TeamMembersCard`) |
| **Jathin Surya** | `mentorProfilesSlice`, `mentorSessionsSlice`, `abandonmentReviewsSlice`, `sessionFeedbackSlice`, `paymentsSlice`, `escrowAccountsSlice`, `gamificationSlice` | `MentorProtectedRoute`, `dashboard`, `profile`, `leaderboard`, `MentorsDirectory`, `MyMentorProfile`, `MentorRequests`, `MentoredProjects`, `MentorEarnings`, `MentorProjectWorkspace`, `MentorRevenue`, `MentorCard` |
| **Kevin Gandham** | `mentorApplicationsSlice`, `reportsSlice`, `appealsSlice`, `sessionDisputesSlice`, `supportTicketsSlice`, `portalAdminsSlice`, `jobRunsSlice` | `AdminProtectedRoute`, `AdminLayout`, `AdminLogin`, `AdminDashboard`, `AdminMentorApps`, `AdminReports`, `AdminSupport`, `ScheduledJobsPanel`, `SuperuserAdmins`, `SuperuserConfig`, `MentorApplication`, `help`, `landingpage` |

---

## 1. Aditya Sai (Store Lead, Session/RBAC, Core Chrome, Notifications, Settings, Audit & Scans)

### 8 Viva Q&As
1. **Q: How does `src/store/index.js` prove `34` slices and zero legacy storage without circular dependencies?**
   - `rootReducers` registers `34` slices (`32` domain slices + `session` + `ui`). `apiClient.js` never imports `store/index.js`; instead, `setupInterceptors(store)` in `src/store/index.js:110` registers token/bootId callbacks after store creation (`NoApiInComponentsScan` + `NoBrowserStorageScan` allowlists are both empty `[]`).
2. **Q: Why does a standard user survive F5 reload cleanly without `localStorage`, while `/admin` redirects to `/admin/login`?**
   - `App.jsx` dispatches `bootstrapSession()` (`POST /auth/refresh` with `credentials: 'include'`) on non-admin routes so `teamforge_refresh_token` restores standard user sessions, and dispatches single-flight `restoreAdminSession()` (`POST /admin/auth/refresh` with `credentials: 'include'`) on `/admin/*` so the backend's separate `httpOnly` `SameSite=Strict` (`Path=/admin/auth`) `teamforge_admin_refresh_token` cookie restores admin/superuser sessions across F5 while all tokens/claims remain strictly in Redux memory.
3. **Q: How does `notificationsSlice` implement optimistic mark-as-read with rollback?**
   - `markRead.pending` snapshots `{ isRead, readStatus }` in `state.optimisticSnapshots[id]`, updates the entity + `unreadCount`, deletes the snapshot on `.fulfilled`, and restores the exact prior flag and `unreadCount` on `.rejected` if the API call fails.
4. **Q: Why does `notificationsSlice.toggleGroupExpanded` guard `if (!state.working)`?**
   - Tests using partial `preloadedState.notifications` (e.g., `Phase18` / `Phase26` passing `{ ids, entities, unreadCount }`) omit `working`; initializing via `createInitialNotificationWorking()` ensures toggling grouped/digest notifications never crashes with `TypeError`.
5. **Q: How does `routeReset.js` let us switch between Reading B and Reading A with one edit?**
   - Changing `export const RESET_SCOPE = 'page'` to `'group'` in `src/store/utils/routeReset.js:8` switches `addRouteReset` from resetting `working` on every pathname change to preserving `working` across routes sharing the same first URL segment (`getPathGroup`).
6. **Q: How does `settings.jsx` keep form typing responsive while syncing Navbar after Save?**
   - Controlled inputs (`fullName`, `bio`, `skills`, `phone`, `email`) stay in React local `useState` until Save; `saveProfileSettings` updates `profilesSlice` AND dispatches `userUpdated(savedUser)` so `Navbar`, `profile.jsx`, and `settings.jsx` update atomically.
7. **Q: Why did `apiClient.js:checkServerBoot()` fail `Fix1RestartAndSession` when cookie-only session logic ran, and how did we fix it?**
   - Removing `storage.js` initially left `checkServerBoot()` without an active-session check; wiring `hasActiveAppSession()` from in-memory session state restored `handleServerRestart(bootId)` when `knownBootId !== bootId`.
8. **Q: What is the difference between `NoApiInComponentsScan` and `complianceCrudProof`?**
   - `NoApiInComponentsScan.test.jsx` scans every non-test file in `src/` to forbid `*Api.js`/`apiClient`/`createContext` in UI layers (`DIRECT_API_IMPORT_ALLOWLIST = []`), whereas `complianceCrudProof.test.jsx` imports all `34` slices to prove all `32` domain slices export `setAll`, `addOne`, `updateOne`, `removeOne` (`32 × 4 = 128`).

### 3 Live-Change Tasks (Aditya Sai)
1. Switch `src/store/utils/routeReset.js` `RESET_SCOPE` to `'group'`, run `routeReset.test.jsx`, and add a test proving `/admin/users` → `/admin/reports` keeps a filter in `'group'` scope while `/admin/users` → `/dashboard` resets it.
2. Add a `markNotificationUnread` thunk + optimistic rollback snapshot case in `notificationsSlice.js`.
3. Add a memoized `selectUnreadNotificationIds` selector in `notificationsSelectors.js` and render an unread-only count tooltip in `navbar.jsx`.

---

## 2. Rithvik (Projects, Join Requests, Invites, Leave Requests, Action Feedback)

### 8 Viva Q&As
1. **Q: Why did `projectsSlice` separate `marketplaceIds`, `myProjectIds`, `myWorkOngoingIds`, and `myWorkCompletedIds`?**
   - All project entities live once in `entities` (`createEntityAdapter`), while each screen keeps server-ordered ID lists so `ProjectsMarketplace`, `MyProjects`, and `MyWork` never filter/reorder entities differently from backend pagination or lose shared updates.
2. **Q: How does `OwnedWorkspace` show combined applications AND invitations with chip counts (`All`, `Pending`, `Approved`, `Rejected`)?**
   - `fetchProjectCombinedRequests` stores server-returned `combinedItems` and `combinedCounts` directly in `joinRequestsSlice` (`combinedByProjectId`); clicking a chip updates `working.requestStatusFilter` via `setRequestStatusFilter` without recomputing counts client-side.
3. **Q: Why does `actionFeedbackSlice` store `reasonsConfig` once without clearing on route change?**
   - `GET /feedback/reasons` is static reference configuration (`reasonsLoadedOnce`); `clearWorkingFeedbackState` clears per-entity modal errors/loading on `routeChanged` while keeping `reasonsConfig` cached across routes (replacing the old `feedbackApi` module variable).
4. **Q: How did `RoleContext` + `teamforge:project_updated` DOM events get replaced in Owner/Collaborator workspaces?**
   - Thunks (`approveJoinRequest`, `cancelProjectInvite`, `approveLeaveRequest`, `softDeleteProject`, `cancelProjectDeletion`) apply server payloads directly into their own slices AND trigger `fetchProjectById` / `fetchMyJoinRequests` / `fetchPendingCounts` where backend state changed.
5. **Q: What happened in `OwnerDashboard.jsx` during the Phase 13 Display Audit?**
   - `OwnerDashboard.jsx` previously copied `ownedProjects`, `tasksByProject`, `pendingRequestsCount`, `totalCollaborators`, `totalTasksCount`, and `ownerActions` into local `useState`; refactored to derive them via `useMemo` from `selectAllProjects`, `selectAllJoinRequests`, and `selectTasksMapByProject`.
6. **Q: How does `AppliedProjects.jsx` prevent double-withdraw clicks while updating both list and marketplace state?**
   - `withdrawJoinRequest` tracks per-ID pending flag in `state.joinRequests.withdrawingIds` and removes the ID from `myRequestIds` + entities on `.fulfilled`, automatically unlocking the Apply button on `ProjectsMarketplace` via `selectMyJoinRequests`.
7. **Q: How is Project Tombstone (`410 PROJECT_DELETED`) handled via Redux instead of local `useState`?**
   - `fetchProjectById.rejected` stores the server's `isDeletedProject` metadata in `state.projects.tombstoneById[id]`, which `ProjectTombstone.jsx` reads via `selectProjectTombstoneById`.
8. **Q: Why does switching tabs inside `/owner/workspace/:id?tab=tasks` → `?tab=requests` NOT clear filters or modals?**
   - `RouteResetObserver` compares `location.pathname` (`'/owner/workspace/p-1'`), ignoring `location.search`, so query-param tab switches never dispatch `routeChanged`.

### 3 Live-Change Tasks (Rithvik)
1. Move `starterTemplates` modal state in `OwnedWorkspace.jsx` (`L392–398`) directly onto `selectProjectTaskTemplatesById(state, projectId)` (already populated by `projectsSlice:793`).
2. Add an optimistic pending toggle + rollback in `leaveRequestsSlice.js` when `withdrawLeaveRequest` is dispatched.
3. Add a `selectPendingCombinedCount(projectId)` selector in `joinRequestsSelectors.js` for the `Members` tab badge.

---

## 3. Satwik (Tasks, Chat, Marketplace/Collaborator Workspaces, Users, Trust, Moderation, Admin Users/Projects)

### 8 Viva Q&As
1. **Q: Why does `tasksSlice` support optimistic status changes with rollback only on existing routes (`updateTaskStatus`, `reviewTask`)?**
   - When dragging/updating task status or submitting proof, `updateTaskStatus.pending` snapshots the task in `optimisticSnapshots` for instant UI feedback; if backend rejects (e.g., `DUE_DATE_AFTER_PROJECT` or `INVALID_TRANSITION`), `.rejected` restores the snapshot and surfaces `normalizeThunkError`.
2. **Q: How does `communicationSlice` handle optimistic chat messages and 403 non-member errors?**
   - `sendProjectMessage.pending` inserts a temp message keyed by `temp-<requestId>`, `.fulfilled` replaces the temp entry with the persisted server message, `.rejected` removes the temp message and records the error; a `403` sets `forbiddenByProject[projectId] = true` for the read-only non-member view.
3. **Q: How does chat polling obey Phase 3 & Phase 7 rules without leaking timers?**
   - `src/hooks/useChatPolling.js` manages a single module-level interval handle (`useVisibilityPoll`), pauses automatically when `document.visibilityState === 'hidden'`, aborts on unmount/tab switch, and skips when `chatForbidden` is true.
4. **Q: How does `UserTrustCard` protect private fields (`reputation`, `needsAttention`) in Redux selectors?**
   - `selectSafeTrustSummaryById(state, userId, { isSelf, isAdminViewer })` (`profilesSelectors.js:39–73`) strips `reputation`, `needsAttention`, and `ledgerLink` unless the viewer is self or an authenticated admin/superuser.
5. **Q: Why does `AdminUsers.jsx` render "Waiting for another admin" on the requester's own suspension proposal?**
   - `AdminUsers` compares `action.requestedByAdminId` against `selectCurrentAdminUid` (`sessionSelectors.js:76`); disabling Approve when IDs match preserves backend two-person moderation enforcement in `pendingModerationActionsSlice`.
6. **Q: How were `ChatBox` unserializable `Set` (`reportedIds`) and `DOM` events replaced?**
   - Message reports now store plain booleans `{ [msgId]: true }` in `communicationSlice.working.reportedMessageIds` and refresh `unread` counts via Redux state rather than `teamforge:chat_read`.
7. **Q: How does `ProjectsMarketplace.jsx` display owner response times after Phase 13 cleanup?**
   - `ProjectsMarketplace` dispatches `fetchUserResponseTime(ownerId)` (deduped via ref) and reads `selectResponseTimeMap(state)` (`profilesSelectors.js:75`) formatted in `useMemo`, storing zero fetched objects in `useState`.
8. **Q: How does `AdminProjectDetails.jsx` share data with its sub-cards (`EscrowFinancialsCard`, `ProjectDetailsCard`, `TasksMilestonesCard`, `TeamMembersCard`)?**
   - `AdminProjectDetails` selects project, escrow summary (`selectAdminProjectEscrowById`), and project tasks (`selectTasksByProjectId`) from Redux and passes slice-owned values down, while `ProjectDetailsCard` dispatches `adminCloseProject` / `adminRestoreProject`.

### 3 Live-Change Tasks (Satwik)
1. Add a `createSelector` `selectTasksCountByStatus(state, projectId)` in `tasksSelectors.js` returning counts per status column (`Todo`, `In Progress`, `In Review`, `Approved`) for `CollaboratorWorkspace`.
2. Dispatch `markProjectChatRead({ projectId })` automatically inside `useChatMessagesPolling` when a poll fetches new unread messages while the chat tab is active.
3. Add bulk trust summary caching deduplication in `profilesThunks.js` (`condition` check skipping IDs already present in `state.profiles.trustByUserId`).

---

## 4. Jathin Surya (Dashboard, Profile, Leaderboard, Mentor Marketplace, Payments, Escrow, Gamification)

### 8 Viva Q&As
1. **Q: Why MUST `paymentsSlice.checkout.idempotencyKey` NOT clear on `routeChanged` (Decision D3 exception)?**
   - If an owner opens Demo Payment, navigates or retries after a slow network response, changing the `Idempotency-Key` header would cause `DemoUpiProvider` to risk double-charging; `paymentsSlice` explicitly creates the key once on dialog open, reuses it across retries, and clears it only on payment success, cancel, or `sessionReset`.
2. **Q: How did `Fix6Payment` / `paymentsSlice` handle `NETWORK_ERROR`, `ALREADY_PAID`, and post-payment totals sync?**
   - `paySession.rejected` distinguishes `err.statusCode === 0` / missing HTTP response (`NETWORK_ERROR` retry banner) vs `409 ALREADY_PAID`; `paySession.fulfilled` triggers refetches of `fetchMySessions`, `fetchEscrows`/`projectEscrow`, and money totals so zero arithmetic is done in JSX.
3. **Q: Why does `MentoredProjects.jsx` never recompute `All`, `Active`, and `Completed` project lists on the client?**
   - Backend returns canonical `{ all, active, completed, counts }` via `fetchMentoredProjects`; `mentorSessionsSlice` stores those server lists/counts verbatim and `selectFilteredMentoredProjects` simply selects the active server bucket.
4. **Q: What did Phase 13 change in `dashboard.jsx`, `profile.jsx`, and `MentorProjectWorkspace.jsx`?**
   - All three previously held local `useState` copies (`dashboardData`/`stats`/`userActions`, `profileData`, `project`/`awardedMembers`); each now computes view models via `useMemo` directly from Redux selectors (`selectOwnProfile`, `selectAllProjects`, `selectTasksMapByProject`, `selectUserBadges`, `selectProjectById`, `selectProjectBadges`).
5. **Q: How did `gamificationSlice` replace `localStorage` sorting state on `leaderboard.jsx`?**
   - Active tab (`'xp' | 'reliable' | 'standing'`) and search query live in `gamificationSlice.working`, reset via `routeChanged`; `selectLeaderboardForTab` (`gamificationSelectors.js:66`) sorts stored entries purely without extra network fetches or `storage.js`.
6. **Q: How does `MyMentorProfile.jsx` follow local-draft-until-Save (Decision D6) and surface the save toast?**
   - `title`, `bio`, `skillsInput`, `experienceYears`, `sessionPrice`, `isAvailable`, `maxActiveMentees` stay in local controlled inputs, hydrated on load from `selectMyMentorProfile`; submitting dispatches `saveMentorMentorProfile` -> updates `mentorProfilesSlice` + `uiSlice` `addToast`.
7. **Q: How does `MentorRequests` read decline reasons without a hardcoded component list or `feedbackApi` cache?**
   - Decline options come from `selectReasonOptionsByCategory(state, 'MENTOR_SESSION_DECLINE')` in `actionFeedbackSlice` (and `selectMentorViewSessions` provides request state & `processingIds`).
8. **Q: Why does `MentorRevenue` use `mentorSessions` + `escrowAccounts` instead of `PayoutsController` (`/payouts/transactions`)?**
   - `MentorRevenue` displays session-level admin stats, escrow reconciliation (`reconcileEscrow`), and mentor payouts from `mentorSessionsSlice` and `escrowAccountsSlice`; `GET /payouts/transactions` has no active consumer in the UI today.

### 3 Live-Change Tasks (Jathin Surya)
1. Add a price range filter (`maxSessionPrice`) to `mentorProfilesSlice.working` and wire a filter slider into `MentorsDirectory.jsx`.
2. Add an error banner in `MentorEarnings.jsx` bound to `selectMentorSessionsError` when `retryPayout` rejects.
3. Add a `selectActiveMentoredCount` selector in `mentorSessionsSelectors.js` for the mentor dashboard KPI card.

---

## 5. Kevin Gandham (Admin Portal Auth/Guards, Mentor Apps, Reports, Appeals, Disputes, Support, Jobs, Config)

### 8 Viva Q&As
1. **Q: How do `AdminLayout.jsx` and `AdminProtectedRoute.jsx` enforce permissions now that `storage.js` is deleted?**
   - Both read `canAccess(session, sectionKey)` (`sessionSelectors.js:90`) against `state.session.portalRole`, `isSuperUser`, and `permissions[]`. When `AdminReports`, `AdminSupport`, or `ScheduledJobsPanel` lacks the required permission, UI blocks access cleanly while backend `RolesGuard` enforces security on every HTTP request.
2. **Q: How does `AuditLog.jsx` synchronize URL query filters with Redux without drifting?**
   - One `useEffect` reads URL params (`userId`, `reportId`, `actor`, `action`, `from`, `to`) and dispatches `setAuditFilters` + `fetchAuditLogs`; `selectAuditFilters` and `selectFilteredAuditLogs` drive the table, active filter chips, and `exportAuditLog` payload.
3. **Q: Why are decided reports, appeals, and resolved support tickets immutable in the UI (`409` handling)?**
   - Status transitions (`decideAppeal`, `actionReport`, `updateAdminTicket` / `closeProjectFromTicket`) store the terminal status (`Resolved`, `Closed`, `Dismissed`) in the slice, rendering read-only views from store selectors; conflicting concurrent PATCHes propagate `TICKET_CLOSED` / `409` errors via `thunkError.js`.
4. **Q: Why did `AdminReports` keep `needsReviewSessions` local instead of creating a new slice (Decision D8)?**
   - `AdminController` on `back-end` does not expose `GET /admin/mentor-sessions/needs-review` or `POST .../clear-review`; per Decision D8, those two unwired helper calls remain 404-tolerant fallbacks without inventing phantom endpoints or slices.
5. **Q: How does `AdminMentorApps.jsx` prevent hardcoded reason IDs in components (`AdminRejectMentorApp` guard)?**
   - Admin mentor-application rejection reads server reason categories from `actionFeedbackSlice` / modal options rather than embedding literal uppercase backend enum strings in JSX.
6. **Q: What happens across all `34` slices when a Super User executes Demo Reset in `SuperuserConfig.jsx`?**
   - `triggerDemoReset.fulfilled` dispatches `sessionReset()` (`appActions.js`), resetting every domain slice back to initial state, clearing portal session tokens, and setting the `demoReset` flash notice for `/admin/login`.
7. **Q: Why must `MentorApplication.jsx` keep the selected CV `File` object out of `mentorApplicationsSlice`?**
   - RTK's `serializableCheck` rejects non-serializable DOM `File` objects; only serializable metadata returned by `/uploads/cv` (`{ cvUrl, cvFileName, cvOriginalName }`) is stored in Redux, while `File` stays in component state/ref until upload.
8. **Q: How do `help.jsx` (user side) and `AdminSupport.jsx` (admin side) share `supportTicketsSlice` cleanly?**
   - `supportTicketsSlice` separates `myTicketIds` from `adminTicketIds` while storing normalized ticket entities by `id` with distinct `selectedMyTicketId` / `selectedAdminTicketId` in `working`, resetting active drawer/reply errors on `routeChanged`.

### 3 Live-Change Tasks (Kevin Gandham)
1. Replace the local `searchResults` `useState` in `help.jsx` (`L256`) with `selectUserSearchResults` from `profilesSelectors.js` (`profilesSlice.working.searchResults`).
2. Add `assigneeFilter` & `priorityFilter` to `supportTicketsSlice.working` and confirm `clearWorkingState` resets them when navigating away from `/admin/support`.
3. Add `selectPendingMentorAppsCount` in `mentorApplicationsSelectors.js` and render its badge next to `"Mentor Applications"` in `AdminLayout.jsx`.
