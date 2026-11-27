# Step 7: Target Store Architecture, Phased Migration, Team Allocation & Viva Prep

> **Note on `docs/work-division.md`:** `docs/work-division.md` was **not found** in the repository. Team ownership below was recovered from `git log --all --no-merges` across the 5 repository authors: **Aditya Sai**, **Rithvik**, **Satwik**, **Jathin Surya**, and **Kevin Gandham**.

---

## 1. Target Store Layout (`React-Implementation/React-Implementation/src/store/`)

Follows the front end's existing camelCase `.js` / PascalCase `.jsx` naming conventions and bundle budget rules (`< 300 kB` gzipped JS in `docs/srs/SRS_updated.md`, `@reduxjs/toolkit` + `react-redux` tree-shaken):

```text
src/
├── store/
│   ├── index.js                      # configureStore({ reducer, middleware }) + devTools + listenerMiddleware
│   ├── actions/
│   │   └── appActions.js             # routeChanged, resetRouteGroup, sessionReset
│   ├── middleware/
│   │   └── routeResetListener.js     # RTK createListenerMiddleware: Req 5 working-state reset + cascading sync
│   ├── utils/
│   │   ├── thunkError.js             # normalizeThunkError() matching HttpExceptionFilter shape
│   │   └── setupInterceptors.js      # Injects store dispatch/getState into apiClient.js (no circular imports)
│   ├── components/
│   │   └── RouteResetListener.jsx    # Watches React Router pathname -> dispatches routeChanged (uses useDispatch directly; no React Context APIs or optional-store shims remain anywhere in src/)
│   ├── slices/                       # 32 slices (session + ui + 30 domain repository slices covering 31 FE collections)
│   │   ├── sessionSlice.js
│   │   ├── uiSlice.js
│   │   ├── projectsSlice.js
│   │   ├── tasksSlice.js
│   │   ├── usersSlice.js
│   │   ├── chatMessagesSlice.js
│   │   ├── leaveRequestsSlice.js
│   │   ├── actionFeedbackSlice.js
│   │   ├── gamificationLedgerSlice.js
│   │   ├── recommendationBadgesSlice.js
│   │   ├── joinRequestsSlice.js
│   │   ├── mentorApplicationsSlice.js
│   │   ├── mentorRequestsSlice.js
│   │   ├── supportTicketsSlice.js
│   │   ├── portalAdminsSlice.js
│   │   ├── escrowAccountsSlice.js
│   │   ├── notificationsSlice.js
│   │   ├── projectInvitesSlice.js
│   │   ├── reportsSlice.js
│   │   ├── appealsSlice.js
│   │   ├── warningsSlice.js
│   │   ├── pendingModerationActionsSlice.js
│   │   ├── reputationEntriesSlice.js
│   │   ├── platformConfigSlice.js
│   │   ├── auditLogsSlice.js
│   │   ├── jobRunsSlice.js
│   │   ├── dataExportsSlice.js
│   │   ├── mentorProfilesSlice.js
│   │   ├── mentorSessionsSlice.js
│   │   ├── sessionDisputesSlice.js
│   │   ├── abandonmentReviewsSlice.js
│   │   └── sessionFeedbacksSlice.js  # Also stores bundled mentorAbandonmentHistory
│   ├── thunks/                       # Controller-grouped createAsyncThunk modules calling src/services/*Api.js
│   │   ├── authThunks.js
│   │   ├── usersThunks.js
│   │   ├── projectsThunks.js
│   │   ├── tasksThunks.js
│   │   ├── joinRequestsThunks.js
│   │   ├── leaveRequestsThunks.js
│   │   ├── invitesThunks.js
│   │   ├── feedbackThunks.js
│   │   ├── chatThunks.js
│   │   ├── notificationsThunks.js
│   │   ├── gamificationThunks.js
│   │   ├── mentorshipThunks.js
│   │   ├── mentorAppsThunks.js
│   │   ├── mentorRequestsThunks.js
│   │   ├── mentorMarketplaceThunks.js
│   │   ├── abandonmentThunks.js
│   │   ├── disputesThunks.js
│   │   ├── reportsThunks.js
│   │   ├── appealsThunks.js
│   │   ├── moderationThunks.js
│   │   ├── supportThunks.js
│   │   ├── portalAdminsThunks.js
│   │   └── adminThunks.js
│   └── selectors/
│       ├── sessionSelectors.js       # canAccess, selectActiveRole, selectIsMentorApproved, admin section checks
│       ├── projectsSelectors.js
│       ├── tasksSelectors.js
│       ├── mentorSelectors.js
│       ├── moderationSelectors.js
│       └── adminSelectors.js
```

---

## 2. Full Slice Inventory, Thunks, Sync Reducers & Req 5 Behavior

*(Every repository slice exposes all 4 synchronous CRUD reducers `setAll`, `addOne`, `updateOne`, `removeOne` + `clearWorkingState` + `resetSlice`.)*

| Slice | Backing Repo / Collection | Async Thunks (Existing BE Routes Only) | Primary Selectors | On Route Change (Req 5 Reading B) |
|---|---|---|---|---|
| `sessionSlice` | `AuthController` + `UsersRepository` (self) + `AdminController/login` | `loginUser`, `signupUser`, `restoreSession`, `fetchCurrentUser`, `switchActiveRole`, `completeUserProfile`, `adminLogin`, `logoutUser`, `logoutAll`, `verifyEmail`, `resendVerification`, `changePassword`, `resolveIdentifier`, `forgotPassword`, `resetPassword` | `selectCurrentUser`, `selectIsAuthenticated`, `selectActiveRole`, `selectAllowedRoles`, `selectCanAccess` | **NEVER CLEARS** *(except `flashNotices` consumed after display)* |
| `uiSlice` | Frontend App/Layout UI | `fetchPublicConfig` (mirrors maintenance banner) | `selectTheme`, `selectIsSidebarOpen`, `selectMaintenanceBanner` | **NEVER CLEARS** (`theme`, `isSidebarOpen`) |
| `notificationsSlice` | `NotificationsService.notifications` | `fetchNotifications`, `fetchUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`, `deleteNotification`, `createNotification` | `selectAllNotifications`, `selectUnreadNotificationsCount` | Keep `items` for Navbar badge; clear transient `error` |
| `platformConfigSlice` | `PlatformConfigService.config` | `fetchPublicConfig`, `fetchAdminConfig`, `updatePlatformConfig`, `fetchDemoResetStatus`, `resetDemoData` | `selectPublicConfig`, `selectPlatformConfig`, `selectMinMentorYears` | Keep `publicConfig`; clear admin edit draft/error |
| `projectsSlice` | `ProjectsRepository.projects` | `fetchProjects`, `fetchMyWork`, `fetchProjectById`, `createProject`, `updateProject`, `completeProject`, `changeProjectDeadline`, `checkProjectDeletion`, `softDeleteProject`, `cancelProjectDeletion`, `removeProjectMember`, `checkMemberRemoval`, `releaseMemberTasks`, `leaveProject`, `requestProjectClose`, `closeProjectAdmin`, `restoreProjectAdmin`, `fetchSkillMatch`, `fetchStarterTemplates`, `applyStarterTemplates` | `selectAllProjects`, `selectProjectById`, `selectOwnedProjects`, `selectCollaboratorProjects`, `selectTombstoneError` | Clear `working` (`searchQuery`, `statusFilter`, `selectedProjectId`, `tombstoneError`, `deletionCheckById`); keep entities |
| `tasksSlice` | `TasksRepository.tasks` | `fetchProjectTasks`, `fetchTaskById`, `createTask`, `updateTask`, `updateTaskStatus`, `reviewTask`, `unassignTask`, `addTaskComment`, `deleteTask` | `selectTasksByProjectId`, `selectMyAssignedTasks`, `selectTasksGroupedByStatus` | Clear `working` (`taskFilter`, `selectedTaskId`, `rejectError`); keep entities *(optional clear on workspace leave under Reading A)* |
| `usersSlice` | `UsersRepository.users` | `fetchMe`, `updateMyProfile`, `confirmUsername`, `checkUsernameAvailability`, `searchUsers`, `fetchUserPublicProfile`, `fetchOwnerResponseTime`, `fetchMySettings`, `updateMySettings`, `verifyPhone*`, `deletePhone`, `checkDeletionEligibility`, `deleteMyAccount`, `fetchAdminUsers`, `fetchDuplicateUsers`, `fetchAdminUserDetails`, `updateUserStatus`, `flagUser`, `fetchAdminStats` | `selectUserById`, `selectUserSearchResults`, `selectAdminUsersList`, `selectDuplicateGroups` | Clear `searchResults`, `usernameAvailability`, `selectedUserId`, `otpError`; keep loaded directory/self |
| `chatMessagesSlice` | `CommunicationRepository.messages` | `fetchProjectMessages`, `sendMessage`, `fetchChatUnread`, `markProjectRead`, `reportChatMessage` | `selectMessagesByProjectId`, `selectChatUnreadTotal`, `selectUnreadByProject` | **NEVER clear `unreadSummary` (Navbar)**; clear active project chat buffer/forbidden flag when leaving workspace |
| `joinRequestsSlice` | `JoinRequestsService.items` | `fetchMyJoinRequests`, `fetchJoinRequests`, `fetchJoinRequestById`, `createJoinRequest`, `updateJoinRequest`, `respondJoinRequest`, `deleteJoinRequest` | `selectMyJoinRequests`, `selectRequestsByProjectId` | Clear filter/selected reject modal state |
| `leaveRequestsSlice` | `LeaveRequestsRepository.requests` | `createLeaveRequest`, `fetchProjectLeaveRequests`, `fetchMyLeaveRequest`, `withdrawLeaveRequest`, `approveLeaveRequest`, `rejectLeaveRequest` | `selectLeaveRequestsByProjectId`, `selectMyLeaveRequestForProject` | Clear modal/rejection error |
| `projectInvitesSlice` | `ProjectInvitesService.invites` | `fetchMyInvites`, `fetchProjectInvites`, `sendProjectInvite`, `cancelProjectInvite`, `acceptProjectInvite`, `declineProjectInvite` | `selectMyPendingInvites`, `selectInvitesByProjectId` | Clear transient invite search/feedback |
| `actionFeedbackSlice` | `ActionFeedbackRepository.items` + Reasons | `fetchReasonsConfig`, `fetchEntityFeedback` | `selectReasonCategory`, `selectFeedbackByEntity` | **Keep `reasonsConfig`**; clear per-entity error/loading |
| `gamificationLedgerSlice` | `GamificationRepository.ledgers` + `LeaderboardService` | `fetchUserLedger`, `fetchUserStats`, `fetchLeaderboard`, `fetchUserRank` | `selectLedgerByUserId`, `selectLeaderboardEntries` | Clear `activeTab`/`period`/`searchQuery` working filters |
| `recommendationBadgesSlice` | `MentorshipRepository.badges` | `fetchUserBadges`, `fetchProjectBadges`, `issueBadge` | `selectBadgesByUserId`, `selectBadgesByProjectId` | Clear modal/issue errors |
| `mentorApplicationsSlice` | `MentorApplicationsService.items` | `fetchMyMentorApp`, `fetchAllMentorApps`, `fetchMentorAppById`, `createMentorApp`, `approveMentorApp`, `rejectMentorApp`, `deleteMentorApp`, `fetchDigiLockerStatus`, `pullDigiLockerDocs`, `uploadCv`, `downloadCv` | `selectMyMentorApplication`, `selectIsMentorApprovedFromApp`, `selectAdminMentorApps` | **Keep `myApplication` (Navbar/Role check)**; clear form/CV/modal states |
| `mentorRequestsSlice` | `MentorRequestsService.items` | `fetchMentorRequests`, `createMentorRequest`, `acceptMentorRequest`, `declineMentorRequest`, `deleteMentorRequest` | `selectAllMentorRequests` | Clear transient errors |
| `mentorProfilesSlice` | `MentorMarketplaceService.profiles` | `fetchMentors`, `fetchMentorById`, `fetchMyMentorProfile`, `fetchMyMentorStats`, `saveMentorProfile`, `toggleMentorAvailability`, `confirmMentorRole` | `selectAllMentors`, `selectMyMentorProfile`, `selectMentorStats` | Clear `searchQuery`, edit validation errors |
| `mentorSessionsSlice` | `MentorMarketplaceService.sessions` | `fetchMySessions`, `fetchMentorSessions`, `fetchMentoredProjects`, `fetchAllSessionsAdmin`, `fetchSessionAdminStats`, `bookSession`, `confirmPayment`, `paySession`, `cancelPayment`, `acceptSession`, `declineSession`, `startSession`, `completeSession`, `cancelSession`, `retryPayout`, `addSessionNote` | `selectMySessions`, `selectMentorSessions`, `selectMentoredProjects`, `selectActiveCheckout`, `selectAdminSessionStats` | **Preserve `activeCheckout` (incl. `idempotencyKey`) until paid/cancelled**; clear decline/feedback modals |
| `escrowAccountsSlice` | `EscrowService.items` | `fetchEscrows`, `fetchEscrowById`, `fetchProjectEscrow`, `reconcileEscrow` | `selectProjectEscrowSummary`, `selectReconciliationReport` | Clear selected reconciliation error/banner |
| `sessionDisputesSlice` | `MentorMarketplaceService.disputes` | `openSessionDispute`, `fetchAdminDisputes`, `decideDispute` | `selectDisputesByStatus`, `selectSelectedDispute` | Clear `selectedDispute`, decision draft/error |
| `abandonmentReviewsSlice` | `MentorMarketplaceService.abandonmentReviews` | `openAbandonmentReview`, `fetchProjectAbandonmentReview`, `fetchMyAbandonmentReviews`, `confirmAbandonmentReview`, `cancelAbandonmentReview` | `selectOpenAbandonmentReviewsForMentor`, `selectProjectAbandonmentReview` | Clear modal errors |
| `sessionFeedbacksSlice` | `MentorMarketplaceService.sessionFeedbacks` & `mentorAbandonmentHistory` | `submitSessionFeedback`, `fetchMentorFeedbackAdmin` | `selectAdminMentorFeedbackById`, `selectAbandonmentHistoryByMentorId` | Clear admin detail view on leave |
| `reportsSlice` | `ReportsService.reports` | `createReport`, `fetchMyReports`, `fetchAdminReports`, `fetchOpenReportsCount`, `fetchOwnerPatterns`, `fetchReportDetails`, `updateReportStatus`, `actionReport` | `selectOpenReportsCount`, `selectMyReports`, `selectAdminReports` | **Keep `openReportsCount` in Admin sidebar**; clear `reportDetail` & `dismissError` |
| `appealsSlice` | `AppealsService.appeals` | `submitAppeal`, `fetchMyAppeals`, `fetchAdminAppeals`, `decideAppeal` | `selectMyAppeals`, `selectAdminAppeals` | Clear `selectedAppeal` / decision draft |
| `warningsSlice` | `ModerationService.warnings` | `fetchMyWarnings`, `fetchAdminWarnings`, `warnUser` | `selectMyWarnings`, `selectWarningsByUserId` | Clear modal state |
| `pendingModerationActionsSlice` | `ModerationService.pendingActions` | `suspendUser`, `reactivateUser`, `fetchModerationActions`, `approveModerationAction`, `rejectModerationAction` | `selectPendingModerationActions` | Clear approval modal state |
| `reputationEntriesSlice` | `ReputationService.entries` | `fetchMyReputation`, `fetchMyTrust`, `fetchUserTrust`, `fetchTrustSummaries`, `fetchAdminReputation`, `fetchUserReputationAdmin`, `reconcileReputation` | `selectTrustByUserId`, `selectReputationEntriesByUserId` | Clear pagination/type filter (`repPage`, `repTypeFilter`) |
| `supportTicketsSlice` | `SupportService.items` | `createTicket`, `fetchMyTickets`, `fetchMyTicketById`, `replyToMyTicket`, `fetchAdminTickets`, `fetchAdminTicket`, `updateAdminTicket`, `replyAdminTicket`, `closeProjectFromTicket` | `selectMyTickets`, `selectAdminTickets`, `selectSelectedTicket` | Clear `selectedTicket`, `replyBody`, filters |
| `portalAdminsSlice` | `PortalAdminsService.items` | `fetchPortalAdmins`, `fetchSupportAssignees`, `createPortalAdmin`, `updatePortalAdmin`, `deletePortalAdmin` | `selectAllPortalAdmins`, `selectSupportAssignees` | Clear `editingAdmin` modal state |
| `auditLogsSlice` | `AuditService.auditLog` | `fetchAuditLogs`, `exportAuditLogs`, `recordAuditEntry` | `selectAuditLogs`, `selectExportFeedback` | Clear `exportFeedback` & search filters |
| `jobRunsSlice` | `JobRunsService.runs` | `fetchJobRuns`, `fetchJobRunById`, `triggerJobsTick` | `selectJobRuns`, `selectSelectedJobRun` | Clear `selectedRun`, manual tick banners |
| `dataExportsSlice` | `DataExportService.exportsById` | `requestExport`, `fetchExports`, `downloadExport` | `selectLatestExport` | Clear `exportError` |

### Route-Leave Reset Middleware (`src/store/middleware/routeResetListener.js`)
1. `<RouteResetListener />` sits inside `<BrowserRouter>` and `<Provider store={store}>`, compares `prevPathname` vs `location.pathname` (ignoring search-only `?tab=chat` updates), and dispatches `routeChanged({ from, to })` directly via `useDispatch()` (all optional-store fallbacks and `useContext` calls have been removed across `src/`).
3. Under **Reading B (Default)**, every feature slice's `extraReducers` handles `routeChanged` via `clearWorkingState`.
4. **Configurable Switch for Reading A/C:** `routeResetListener.js` can inspect `getRouteGroup(from) !== getRouteGroup(to)` and dispatch `resetSlice()` for leaving group's slices if the professor selects Reading A (or `resetSlice()` across all non-global slices for Reading C).
5. On `sessionReset` (logout, `401 SESSION_INVALID`, account delete, demo reset), **all** 30 domain slices + `sessionSlice` reset to `initialState`.

---

## 3. Independently Shippable Phased Migration Plan

> Every phase keeps the app building, passing existing tests + new Redux tests, and deployable! Temporary compatibility shims allow old Context consumers to read Redux during transition until removed in Phase 12.

| Phase | Domain / Focus | Slices Added | Components & Services Changed | Old Code Removed / Shim | Tests Required | Key Risks | Done When | Effort |
|---|---|---|---|---|---|---|---|---|
| **0** | Store Foundation & Test Harness | `store/index.js`, `thunkError`, `appActions`, `routeResetListener` | Install `@reduxjs/toolkit`, `react-redux`; wrap `main.jsx` with `<Provider store={store}>`; create `RouteResetListener` | Keep existing Contexts temporarily alongside `<Provider>` | Update `test-utils.jsx` (`renderWithStore`), store smoke test | SSR/test mock leaks between tests (`createTestStore()` factory needed) | Store mounts cleanly in app & Vitest | **S** |
| **1** | Session, Auth, Roles & Guards *(Reqs 7, 8)* | `sessionSlice`, `authThunks`, `sessionSelectors` | `AuthContext`, `ProtectedRoute`, `OwnerProtectedRoute`, `MentorProtectedRoute`, `AdminProtectedRoute`, `Login`, `Signup`, `AdminLogin`, `CompleteProfile`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `Suspended`, `apiClient` interceptor | Shim `useAuth()` / `useActiveRole()` reading Redux `sessionSlice` temporarily; remove `REFRESH_TOKEN`, `ADMIN_TOKEN`, `roleStore` storage writes | Auth thunk specs, `canAccess` role/permission selector specs, F5 cookie refresh spec | Refresh loop on `401`, Admin reload behavior, Firebase persistence | Auth & route guards read 100% from Redux; zero token/role writes to `storage` | **L** |
| **2** | Global UI Chrome & Public Config | `uiSlice`, `platformConfigSlice`, `uiSelectors` | `App.jsx`, `pages/layout.jsx`, `components/navbar.jsx`, `components/sidebar.jsx`, `landingpage.jsx`, `settings.jsx` theme, `AdminLayout.jsx` sidebar | Remove `UIContext.jsx`, `layout.jsx` duplicate `isSidebarOpen`, `teamforge.theme` & `teamforge.platformConfig` storage keys | `uiSlice` CRUD/reset tests, theme CSS switch test | Removing duplicate `layout.jsx` sidebar state cleanly | Navbar, Sidebar, Theme, Maintenance banner driven 100% by Redux | **S** |
| **3** | Notifications & Chat Unread Badges | `notificationsSlice`, `chatMessagesSlice` *(unread slice part)* | `navbar.jsx`, `dashboard.jsx`, `OwnerDashboard.jsx`, `notifications.jsx` | Remove `NotificationContext.jsx`, `teamforge:notification_updated` DOM event, notification `localStorage` keys | Optimistic `markAsRead` rollback test, 300s/60s poll cleanup test | Lost notification count across navigation if cleared accidentally | Navbar badges & notifications page read 100% from Redux with rollback | **M** |
| **4** | Projects Catalog & Lifecycle | `projectsSlice`, `projectsThunks` | `ProjectsMarketplace`, `MyProjects`, `OwnerDashboard`, `MyWork`, `CreateProject`, `dashboard`, `ProjectCard`, `DeleteProjectDialog`, `ProjectTombstone`, `AdminProjects` | Remove `projectsApi.js` `teamforge:project_updated` events | `projectsSlice` 4 CRUD reducers + soft-delete/tombstone thunk tests | Stale project counts across `OwnedWorkspace` & `MyProjects` -> trigger refetch on mutation | All project lists & tombstones select from `state.projects` | **L** |
| **5** | Tasks, Workspaces & Chat | `tasksSlice`, `chatMessagesSlice` *(messages)* | `OwnedWorkspace` (tasks/chat), `CollaboratorWorkspace`, `MentorProjectWorkspace`, `ChatBox`, `TaskCard`, `AdminProjectDetails` | Remove `tasksApi.js` `teamforge:task_updated` events, workspace `teamforge:chat_read` events, local `Set` `reportedIds` | Task status/review cascading `fetchProjectById` tests, 6s chat poll unmount test | `OwnedWorkspace.jsx` is 4,173L; migrate incrementally tab-by-tab | Tasks & project chat synced across all 3 role workspaces | **L** |
| **6** | Join Requests, Leave Requests, Invites & Feedback Reasons | `joinRequestsSlice`, `leaveRequestsSlice`, `projectInvitesSlice`, `actionFeedbackSlice` | `AppliedProjects`, `ProjectsMarketplace` (apply/invites), `OwnedWorkspace` (members/requests/invites tabs), `notifications` (invites), `UniversalReasonModal`, `FeedbackHistory`, `JoinRequestCard` | Remove `feedbackApi.js` module `cachedReasonsConfig`, `storage.clearLegacyInviteKeys` | Reason-modal config selector test, invite accept -> `fetchProjects` sync test | Preserve 400 reason validation rules and invite slot availability sync | Zero non-Redux feedback caches; join/leave/invites in Redux | **M** |
| **7** | Users Directory, Trust, Reputation & Badges | `usersSlice`, `reputationEntriesSlice`, `recommendationBadgesSlice`, `gamificationLedgerSlice`, `dataExportsSlice` | `profile.jsx`, `settings.jsx` (`2,124L`), `leaderboard.jsx`, `dashboard.jsx`, `UserTrustCard`, `AdminUsers`, `AdminUserDetails`, `UsernameConfirmationBanner` | Remove `storage.getBackendUserId()` fallback across 10 files | Self-update guard error propagation test, OTP/export state serializability test | `settings.jsx` has 54 local `useState` hooks; separate form inputs from Redux user/export state | Profile, trust, leaderboard, settings, badges driven by Redux | **L** |
| **8** | Mentor Marketplace, Sessions, Escrow & Disputes | `mentorProfilesSlice`, `mentorSessionsSlice`, `mentorRequestsSlice`, `escrowAccountsSlice`, `abandonmentReviewsSlice`, `sessionFeedbacksSlice`, `sessionDisputesSlice` | `MentorsDirectory` (`1,266L`), `MentorRequests`, `MentoredProjects`, `MentorEarnings`, `MyMentorProfile`, `MentorRevenue`, `AdminUserDetails` (feedback tab), `AdminReports` (disputes tab) | Keep `idempotencyKey` on `mentorSessions.activeCheckout` | Payment confirm idempotency header test, abandonment confirmation -> project sync test | Interrupted UPI checkout on route leave (must preserve pending session!) | Complete mentor marketplace & escrow flows in Redux | **L** |
| **9** | Moderation, Reports, Appeals & Support | `reportsSlice`, `appealsSlice`, `warningsSlice`, `pendingModerationActionsSlice`, `supportTicketsSlice` | `help.jsx` (`1,297L`), `notifications.jsx` (warnings/appeals), `AdminReports` (`1,723L`), `AdminSupport` (`1,102L`), `AdminUsers` (pending approvals), `ModerationModal` | Remove `teamforge:report_updated` DOM event; handle missing `needs-review` routes safely | Report triage -> `openReportsCount` sync test, 2-person approval test, appeal accept -> clear warning test | `AdminReports.jsx` & `help.jsx` length; keep form drafts local | Moderation, reports, appeals & support inbox 100% Redux | **L** |
| **10** | Mentor Apps, Admin Portal & Superuser | `mentorApplicationsSlice`, `portalAdminsSlice`, `auditLogsSlice`, `jobRunsSlice` | `MentorApplication`, `AdminMentorApps`, `AdminDashboard`, `AuditLog`, `SuperuserAdmins`, `SuperuserConfig`, `ScheduledJobsPanel`, `AdminProjectDetails` | Remove DigiLocker/CV local data state (keep `File` local until uploaded), remove `storage.getAdminSession()` | Scheduled jobs 15s poll cleanup test, demo reset -> `sessionReset` wipe test | Admin Demo Reset must wipe entire store cleanly | Admin/Superuser portal & mentor apps 100% Redux | **M** |
| **11** | Route-Leave Clearing Verification | Wire `RouteResetObserver` + Req 5 policy across all slices | Verify navigation resets working state (or chosen Reading) across every route transition | Audit remaining component `useState` hooks for leftover API state | Cross-route reset test suite (`Projects` -> `Dashboard` -> `OwnedWorkspace`) | Ensure `ProtectedRoute` redirects don't wipe `flashNotices` before display | Zero leaked filters/errors/drawers across navigation | **M** |
| **12** | Cleanup & Hardening | None (deletion phase) | Remove `src/services/apiClient.js` `apiGetCache`, `tokenManager.js` storage calls, **all `teamforge:*` DOM event listeners/dispatchers**, delete `src/context/{Auth,Role,UI,Notification}Context.jsx`, `src/utils/roleStore.js`, `src/utils/storage.js` | **All compatibility shims deleted** | Enable `NoBrowserStorageScan.test.jsx` (`0` violations), full 84+ Vitest regression suite, Vite build bundle budget check (`< 300 kB` gzip) | Test mocks referencing `AuthContext` or `storage.js` need update to `renderWithStore` | Clean `eslint`, 100% tests pass, zero browser storage | **M** |

---

## 4. Team Allocation (5 Students Grounded in Git History)

> Allocation maximizes familiarity with files each student previously authored in `git log --all` while keeping workload (~`11–13K` LOC touched per person) and viva ownership balanced across backend repositories -> Redux slices -> React components.

| Student | Historical Ownership Basis (`steps/46`) | Assigned Slices & Thunks | Assigned Pages & Components | Approx Scope | Primary Reviewer |
|---|---|---|---|---:|---|
| **Aditya Sai** *(Store Lead)* | `AuthContext`, `NotificationContext`, `UIContext`, `apiClient`, `tokenManager`, `roleStore`, `storage`, `settings`, `App.jsx` (`518` files historically) | `sessionSlice`, `uiSlice`, `notificationsSlice`, `platformConfigSlice`, `auditLogsSlice`, `dataExportsSlice`; Core `store/index.js`, `routeResetListener`, `setupInterceptors`, `NoBrowserStorageScan` | `main.jsx`, `App.jsx`, `ProtectedRoute`, `navbar`, `VerifyEmailBanner`, `UsernameConfirmationBanner`, `Login`, `Signup`, `CompleteProfile`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `Suspended`, `notifications`, `settings` | 6 slices · 15 UI files (~5.6K LOC) + Store Core | **Kevin Gandham** |
| **Rithvik** | `ProjectsRepository`, `JoinRequests`, `CreateProject`, `MyProjects`, `OwnerDashboard`, `OwnedWorkspace`, `AppliedProjects`, `OwnerProtectedRoute` (`80` files) | `projectsSlice`, `joinRequestsSlice`, `leaveRequestsSlice`, `projectInvitesSlice`, `actionFeedbackSlice` | `OwnerProtectedRoute`, `CreateProject`, `MyProjects`, `OwnerDashboard`, `OwnedWorkspace`, `AppliedProjects`, `DeleteProjectDialog`, `FeedbackHistory`, `UniversalReasonModal`, `JoinRequestCard`, `ProjectTombstone` | 5 slices · 11 UI files (~7.7K LOC incl. `OwnedWorkspace`) | **Aditya Sai** |
| **Satwik** | `TasksRepository`, `CommunicationRepository`, `Escrow`, `RolesGuard`, `CollaboratorWorkspace`, `MyWork`, `ProjectsMarketplace`, `ChatBox`, `TaskCard`, `AdminUsers` (`74` files) | `tasksSlice`, `chatMessagesSlice`, `usersSlice`, `escrowAccountsSlice`, `warningsSlice`, `pendingModerationActionsSlice`, `reputationEntriesSlice` | `layout`, `sidebar`, `ProjectsMarketplace`, `MyWork`, `CollaboratorWorkspace`, `ChatBox`, `TaskCard`, `ProjectCard`, `UserTrustCard`, `AdminUsers`, `AdminUserDetails`, `ModerationModal`, `AdminProjectDetails` (+ 5 admin project cards) | 7 slices · 18 UI files (~6.8K LOC) | **Rithvik** |
| **Jathin Surya** | `MentorMarketplace` FE (`MentorsDirectory`, `MentorRequests`, `MentoredProjects`, `MentorEarnings`, `MyMentorProfile`, `MentorProjectWorkspace`, `MentorCard`), `leaderboard`, `profile` (`19` files) | `mentorProfilesSlice`, `mentorSessionsSlice` (UPI checkout & `Idempotency-Key`), `mentorRequestsSlice`, `recommendationBadgesSlice`, `abandonmentReviewsSlice`, `sessionFeedbacksSlice` (+ `mentorAbandonmentHistory`), `gamificationLedgerSlice` | `MentorProtectedRoute`, `MentorsDirectory`, `MentoredProjects`, `MentorRequests`, `MentorEarnings`, `MyMentorProfile`, `MentorProjectWorkspace`, `MentorCard`, `dashboard`, `profile`, `leaderboard`, `MentorRevenue` | 7 slices · 12 UI files (~5.9K LOC) | **Satwik** |
| **Kevin Gandham** | `AdminController`, `AdminDashboard`, `AdminLayout`, `AdminLogin`, `AdminMentorApps`, `AdminProjects`, `AuditLog`, `Superuser*`, `help`, `landingpage`, `MentorApplication` (`24` files) | `mentorApplicationsSlice`, `reportsSlice`, `appealsSlice`, `sessionDisputesSlice`, `supportTicketsSlice`, `portalAdminsSlice`, `jobRunsSlice` | `AdminProtectedRoute`, `AdminLayout`, `AdminLogin`, `AdminDashboard`, `AdminMentorApps`, `AdminProjects`, `AdminReports`, `AdminSupport`, `ScheduledJobsPanel`, `AuditLog`, `SuperuserAdmins`, `SuperuserConfig`, `MentorApplication`, `help`, `landingpage` | 7 slices · 15 UI files (~7.8K LOC) | **Jathin Surya** |

---

## 5. Per-Phase Test Plan (Preserving All 84 Existing Tests)

1. **`renderWithStore(ui, { preloadedState, route, store })` (`src/test/test-utils.jsx`):**
   - Replaces `<AuthProvider><RoleProvider><UIProvider><NotificationProvider>` with `<Provider store={store}><MemoryRouter initialEntries={[route]}>`.
   - Creates a fresh `configureStore` instance per test so state never leaks across `it()` blocks.
2. **Reducer Unit Tests (`src/store/slices/*.test.js`):**
   - Test initial state + **all 4 CRUD reducers** (`setAll`, `addOne`, `updateOne`, `removeOne`) + `clearWorkingState` + `resetSlice` + `routeChanged` / `sessionReset` handling.
3. **Thunk Tests (`src/store/thunks/*.test.js`):**
   - Mock existing `*Api.js` functions: verify `.pending` -> `.fulfilled` state sync, `.rejected` normalized error via `rejectWithValue`, `condition` duplicate-fetch blocking, optimistic rollback (`notificationsSlice.markAsRead`), cascading sync (`tasks.reviewTask` -> `fetchProjectById`), and `Idempotency-Key` header preservation (`confirmPayment`).
4. **Selector Tests (`src/store/selectors/*.test.js`):**
   - Verify `selectCanAccess` across all roles + portal admin permission combinations, memoization reference stability (`reselect`), and that server fields (`progress`, `xp`, `trustScore`) pass through un-recomputed.
5. **Architectural Scan Tests:**
   - Existing `RoleStoreScan.test.jsx` updated/superseded once `roleStore.js` & `storage.js` are deleted.
   - New `NoBrowserStorageScan.test.jsx` fails on any `localStorage`, `sessionStorage`, `document.cookie`, or `indexedDB` in non-test `src/`.
   - **Displayed-Data-From-Redux Scan (recommended):** Flag any non-test page holding server array responses (`setProjects`, `setTasks`, etc.) in `useState` outside permitted form/UI state.
6. **Existing 84 Vitest Tests:** Run iteratively after each phase; temporary context shims in Phases 1–11 prevent mass breakage, followed by migrating mocks cleanly to `renderWithStore` in Phase 12.

---

## 6. Compliance Matrix (Professor's 9 Requirements)

| Req # | Professor Requirement (Summary) | Target Design Satisfaction | Verification Proof |
|---|---|---|---|
| **1** | Have slices | `32` RTK `createSlice` modules (`session`, `ui`, `30` domain slices) in `configureStore` | `src/store/index.js` + unit tests |
| **2** | CRUD operations = repositories x 4 | Explicit 4 sync CRUD reducers (`setAll`, `addOne`, `updateOne`, `removeOne`) on every repository slice (`31 x 4 = 124` UI CRUD ops; or `9 x 4 = 36` / `41 x 4 = 164` documented) | Table in `01-repositories-and-crud.md` & slice reducer unit tests |
| **3** | Slices based on repositories + CRUD via reducers | Each slice models a backend repository collection and implements CRUD using RTK reducers + `extraReducers` | Slice source files & reducer specs |
| **4** | All displayed data comes from Redux store | Removed `useState` server data arrays, `apiGetCache`, `feedbackApi` module cache, and React Contexts; components use `useSelector` | Page integration tests (`renderWithStore`) |
| **5** | State clears when moving between components *(Not sure)* | `RouteResetListener` + `routeResetListener` clear working state on route change (`Reading B`), with `resetSlice` switchable for Readings A/C | Cross-route navigation Vitest specs |
| **6** | Use THUNK to synchronize FE & BE | Every HTTP read/mutation runs through `createAsyncThunk` wrapping `*Api.js`, applying server responses & cascading sync | Thunk unit tests mocking API responses |
| **7** | No local storage; state in variables | Deleted `storage.js`, removed all 16 `localStorage` & 19+1 `sessionStorage` keys; JWT `httpOnly` cookie + in-memory Redux variables | `NoBrowserStorageScan.test.jsx` passes with 0 matches |
| **8** | Store shows roles, controllers, CRUD slices & displayed data | `sessionSlice` (`user`, `activeRole`, `allowedRoles`, `permissions`) + `selectCanAccess` + controller-mapped `*Thunks.js` | Matrix in `04-roles-controllers-matrix.md` & guard tests |
| **9** | Follow the THUNK pattern | Standardized `createAsyncThunk` + `pending/fulfilled/rejected` + `normalizeThunkError` (`rejectWithValue`) + `status` | Code review checklist + thunk spec (`05-thunk-pattern.md`) |

---

## 7. Viva Preparation (8 Q&As + 3 Live-Change Tasks Per Student)

> Each student must be ready to defend React fundamentals (props, local controlled form inputs vs Redux state, `useEffect` cleanup/polls) AND their specific Redux slices, thunks, and components.

### 7.1 Aditya Sai (Store Core, Session/Auth/Roles, UI, Notifications, Settings)
**8 Viva Q&As:**
1. *Q: Why is `sessionSlice` NOT reset by `routeChanged` under Requirement 5?* — Keeping `user`, `accessToken`, `activeRole`, and `permissions` preserves authenticated navigation and `Navbar`/`Sidebar` role rendering; only explicit logout, `401 SESSION_INVALID`, or Demo Reset dispatches `sessionReset`.
2. *Q: How does silent login survive F5 refresh with zero `localStorage`?* — `App.jsx` runs a startup `useEffect` dispatching `restoreSession()`, calling `POST /auth/refresh` with `credentials: 'include'`, so the browser automatically sends the backend's `httpOnly` `teamforge_refresh_token` cookie.
3. *Q: Why does F5 refresh log out `/admin` portal users but not regular users?* — `AdminService.login` (`back-end/src/admin/admin.service.ts:444-475`) returns a JSON `token` without setting an `httpOnly` cookie, and `AdminProtectedRoute` now reads `session.accessToken` strictly from memory.
4. *Q: Fix in `notificationsSlice` vs old `NotificationContext.jsx:109-118`?* — Old code flipped `isRead: true` and logged errors without rolling back; our `markNotificationRead.pending` snapshots prior flags and `.rejected` restores them cleanly.
5. *Q: Why keep typing inputs in `settings.jsx` as local `useState` until Save?* — Keystrokes belong to React controlled forms (`value` + `onChange`) evaluated by the course rubric; once submitted via `updateMyProfile` thunk, displayed profile/error state updates from Redux.
6. *Q: How do you avoid circular imports between `apiClient.js` and `store/index.js`?* — `*Api.js` imports `apiClient`, thunks import `*Api.js`, and `store` imports thunks; `setupInterceptors(store)` injects `getState`/`dispatch` into `apiClient` after store creation.
7. *Q: Why store `expiresAtMs` (number) or ISO strings instead of `new Date()` in Redux?* — Redux Toolkit's `serializableCheck` rejects non-serializable `Date`, `Map`, `Set`, and `File` instances (`avatarFile` stays local until `uploadsApi.uploadAvatar` returns a URL string).
8. *Q: Why eliminate `window.dispatchEvent(new CustomEvent('teamforge:*'))`?* — Custom DOM events bypassed React/Redux dataflow and caused hidden race conditions; `extraReducers` and `listenerMiddleware` synchronize slices declaratively in one predictable store.

**3 Live-Change Tasks (Aditya Sai):**
1. Add a **"Clear All Notifications"** banner confirmation state inside `notificationsSlice.working` that resets automatically on route leave (`routeChanged`).
2. Wire `restoreSession.rejected` to show a session-expired flash banner in `Login.jsx` via `session.flashNotices` without touching `sessionStorage`.
3. Add a `selectUserInitials` memoized `createSelector` in `sessionSelectors.js` and display it in `navbar.jsx`.

### 7.2 Rithvik (Projects, Join Requests, Leave Requests, Invites, Feedback)
**8 Viva Q&As:**
1. *Q: Where do your 4 CRUD operations live in `projectsSlice`?* — Synchronous reducers `setAll`, `addOne`, `updateOne`, `removeOne` (backed by `createEntityAdapter`) plus async thunks `fetchProjects`, `createProject`, `updateProject`, `deleteProject`.
2. *Q: Why does `deleteProject` refetch `fetchProjectById` when soft-deleted?* — Depending on blockers (`DeletionPolicyService`), `DELETE /projects/:id` may schedule deletion (`scheduledDeletionAt`) rather than immediately hiding it, so server truth (`Tombstone` vs active badge) must come back into `entities[id]`.
3. *Q: Why does `projectsSlice` use `createEntityAdapter` instead of a plain array?* — `Projects` is loaded by `ProjectsMarketplace`, `MyWork`, `MyProjects`, and `AdminProjects`; `upsertOne`/`setAll` by `id` prevents duplicate project cards and gives O(1) lookup (`selectProjectById`).
4. *Q: Should `UniversalReasonModal` compute or cache feedback reasons in a module variable?* — No; remove `feedbackApi.js`'s `cachedReasonsConfig` module cache and store reason catalogs in `actionFeedbackSlice.reasonsConfig`, keeping only selected checkboxes/explanation as local form `useState` until submit.
5. *Q: What happens in Redux when an Owner approves a Join Request in `OwnedWorkspace`?* — `respondJoinRequest.fulfilled` updates `joinRequestsSlice` AND triggers `fetchProjectById` so server-updated `collaborators[]` and capacity counts appear immediately in `Team` tab.
6. *Q: Why must the client NOT recompute `project.progress` from tasks?* — Backend `progress.util.ts` owns progress rules (excluding closed/rejected states); selectors read `project.progress` directly so UI matches reports and completion eligibility.
7. *Q: How do query-param tab switches (`/owner/workspace/123?tab=tasks` -> `?tab=chat`) avoid triggering Req 5 state clearing?* — `RouteResetListener` compares `location.pathname` (not `location.search`), so tab switches keep loaded project/tasks/invites untouched while leaving `/owner/workspace/123` resets working filters.
8. *Q: How is `OwnedWorkspace.jsx`'s 6s chat poll prevented from firing when viewing the Tasks tab?* — `useVisibilityPoll` passes `enabled: activeTab === 'chat'` and cleans up its interval on unmount/tab switch.

**3 Live-Change Tasks (Rithvik):**
1. Add `projectStatusFilter` (`'all' | 'active' | 'completed'`) to `projectsSlice.working` and bind `MyProjects.jsx`'s `FilterTabs` to dispatch it (with `clearWorkingState` resetting it to `'all'`).
2. Wire `acceptProjectInvite.fulfilled` in `projectInvitesThunks.js` to dispatch `fetchProjects({ force: true })` so accepted projects appear immediately in `MyWork.jsx`.
3. Convert `OwnedWorkspace`'s reject-task modal server error from local `useState` `rejectTaskError` to `tasksSlice.error` via `rejectWithValue`.

### 7.3 Satwik (Tasks, Chat, Users, Escrow, Warnings/Moderation, Trust)
**8 Viva Q&As:**
1. *Q: Why does `tasks` lack a global `GET /tasks` thunk?* — `TasksController` only exposes `GET /tasks/project/:projectId` and `GET /tasks/:id` for security/perf; `tasksThunks` fetches per project and merges into `tasksAdapter` (`upsertMany`).
2. *Q: How did you fix unserializable `Set` usage in `ChatBox.jsx:79`?* — Replaced `new Set()` `reportedIds` with a plain array / record map `{ [messageId]: true }` in `chatMessagesSlice.working.reportedIdsById`.
3. *Q: Why does `chatMessagesSlice` have no `deleteMessage` thunk even though `4 x N` mentions Delete?* — `CommunicationController` exposes `GET`, `POST`, `read`, and `report`, with no `DELETE` route; `chatMessagesSlice` implements the `removeOne` synchronous reducer while omitting an invented HTTP endpoint.
4. *Q: How does `AdminUsers.jsx` reflect two-person suspension approvals cleanly?* — Approving/rejecting in `pendingModerationActions` updates the action entity AND triggers `fetchAdminUsers` so suspended status updates atomically in the users table.
5. *Q: Why does `escrowAccounts` only have Read thunks (`getProjectEscrow`, `reconcileEscrow`) and internal server writes?* — Financial escrow state transitions happen atomically inside `MentorMarketplaceService` payments/disputes; exposing direct client Create/Update escrow routes would be a security vulnerability.
6. *Q: How does `TasksCard` enforce `DUE_DATE_AFTER_PROJECT` server errors cleanly?* — `createTask`/`updateTask` uses `normalizeThunkError(err)` which preserves `code: 'DUE_DATE_AFTER_PROJECT'` and forwarded metadata (`minProjectDueDate`) from `HttpExceptionFilter`.
7. *Q: What role guard protects self-profile edits on the backend, and how does Redux reflect it?* — `UsersController` `PATCH /users/:id` enforces `SelfAccountUpdateGuard` (`NOT_YOUR_ACCOUNT`); `usersThunks/updateMyProfile` passes `state.session.user.id` instead of reading `storage.getBackendUserId()`.
8. *Q: How do you batch-fetch trust badges in `AdminUsers` / `OwnedWorkspace` without exceeding the API limit?* — `trustApi.getTrustSummaries` slices IDs to 50 and merges results into `reputationEntries.trustByUserId`, skipping IDs already cached in Redux.

**3 Live-Change Tasks (Satwik):**
1. Add a `createSelector` `selectTasksByProjectAndStatus(projectId, status)` in `tasksSelectors.js` and render its count badge in `CollaboratorWorkspace.jsx`.
2. Dispatch `markProjectChatRead` inside `OwnedWorkspace`/`CollaboratorWorkspace` when the chat poll receives new messages, updating `chatMessages.unreadSummary` directly without `teamforge:chat_read`.
3. Display normalized `reputationEntries.error.message` in `UserTrustCard` fallback banner when trust summaries fail to load.

### 7.4 Jathin Surya (Mentor Marketplace, Sessions/Escrow, Gamification & Engagement)
**8 Viva Q&As:**
1. *Q: Why must `mentorSessionsSlice` preserve `activeCheckout.idempotencyKey` until payment finishes or is cancelled?* — Clicking "Confirm Paid" twice due to slow network must send the exact same `Idempotency-Key` header to `DemoUpiProvider` so the owner is never double-charged.
2. *Q: Why do `MentoredProjects` & `dashboard` NOT store server data in `setInterval` state anymore?* — Components dispatch `fetchMyAbandonmentReviews`/`fetchProjects` thunks via `useVisibilityPoll` and render via `useSelector`, cleaning up intervals in `useEffect` return.
3. *Q: Why do we NOT compute mentor `rating` or `activeMenteesCount` in `mentorSelectors.js`?* — Server aggregates completed reviews and active mentorship cap (`maxActiveMentees`), ensuring capacity enforcement (`PROJECT_FULL` / mentor cap) cannot drift from Redux display.
4. *Q: Why does `MentorProjectWorkspace.jsx:60` `awardedMembers` `Set` need conversion?* — Redux state must be JSON-serializable; store awarded badge records in `recommendationBadgesSlice` and derive `selectAwardedMemberIdsByProject(projectId)` via `createSelector`.
5. *Q: Why does `MentorRevenue` use `mentorSessions` rather than `PayoutsService` (`/payouts/transactions`)?* — The live UI (`MentorRevenue.jsx:33`, `MentorEarnings.jsx:22`) reads `sessions`, `admin-stats`, and `reconcileEscrow`; `PayoutsController` (`GET /payouts/transactions`) is unused today (`01-repositories-and-crud.md`).
6. *Q: Why is `recommendationBadges` missing Update and Delete thunks?* — Recommendation badges are issued credentials (`POST /mentorship/badge`) and are immutable on the backend; only `setAll`/`addOne`/`updateOne`/`removeOne` sync reducers exist for CRUD structure.
7. *Q: How does `MentoredProjects.jsx` combine `MentorMarketplace` & legacy `MentorRequests`?* — Primary data comes from `fetchMentoredProjects()` (`/mentor-marketplace/mentored-projects`), merging any remaining legacy items from `mentorRequestsSlice`.
8. *Q: What does `leaderboardSlice`/`gamificationLedger` do when a task is completed?* — Backend `GamificationRepository` appends an immutable `LedgerEntryDto`; refreshing profile/leaderboard fetches updated XP and rank from `/leaderboard` and `/gamification/:userId/ledger`.

**3 Live-Change Tasks (Jathin Surya):**
1. Add a price-range filter (`minPrice`, `maxPrice`) to `mentorProfilesSlice.working` and connect it to `MentorsDirectory.jsx`.
2. Add an error recovery retry button in `MentorEarnings.jsx` reading `state.mentorSessions.updateStatus` & `error` when `retryPayout` fails.
3. Move `MentorRequests.jsx`'s decline reason list from local `useState` to `selectReasonCategory('COLLAB_DECLINE')` in `actionFeedbackSlice`.

### 7.5 Kevin Gandham (Admin Portal, Mentor Apps, Reports, Appeals, Support, Jobs)
**8 Viva Q&As:**
1. *Q: How does `AdminLayout.jsx` sidebar permissions work without `storage.getAdminSession()`?* — `AdminLayout` calls `useSelector(selectCanAccessSection)` against `state.session.permissions` (`['*']` or section list) loaded when `adminLogin` fulfilled; backend `RolesGuard` still checks every HTTP call independently.
2. *Q: Why do `GET /admin/mentor-sessions/needs-review` and `clear-review` need special handling in `adminThunks`?* — `AdminReports.jsx:153,193` calls those helper functions, **but those controller routes do not exist in `AdminController`** today (`clearSessionReview` exists only in `mentor-marketplace.service.ts:4677`), so the thunk handles `404` gracefully without breaking the Reports & Disputes tabs.
3. *Q: What happens in Redux when a Portal Admin approves a Mentor Application (`AdminMentorApps`)?* — `approveMentorApp.fulfilled` updates `mentorApplicationsSlice` status to `'approved'`, and if the current user is viewing/switching role, `fetchMyMentorApp` unlocks `MENTOR` role eligibility.
4. *Q: What must happen to the entire Redux store when a Superuser triggers `resetDemoData('RESET')` (`SuperuserConfig.jsx:175`)?* — `resetDemoData.fulfilled` dispatches `sessionReset()`, clearing all 32 slices in memory and navigating cleanly to `/admin/login` with a Redux `demoReset` flash notice (replacing `storage.clearAll()`).
5. *Q: How do `auditLogs` and `jobRuns` behave when the user moves from `/admin/audit` to `/admin/users`?* — `auditLogs.working` (`exportFeedback`, `search`, `page`) clears via `routeChanged` (Reading B), while `ScheduledJobsPanel` stops its 15s `useVisibilityPoll` immediately on component unmount.
6. *Q: How are `AdminSupport.jsx` ticket replies and admin `internal` notes kept synchronized?* — Submitting a reply or `closeProjectFromTicket` dispatches the reply thunk and updates `supportTicketsSlice` `entities[ticketId]`, while `closeProjectFromTicket` also updates/invalidates `projectsSlice`.
7. *Q: Why does `AdminLogin` still work if `AdminUsers` lists users created by `Signup`?* — Both share `/users` & `/admin/users` backed by `UsersRepository`; `AdminUsers` fetches `/admin/users` with the admin Bearer token stored in `state.session.accessToken`.
8. *Q: Why can't `MentorApplication.jsx` store the selected PDF `File` object directly in `mentorApplicationsSlice`?* — Browser `File` objects are non-serializable (`serializableCheck` error in RTK); hold `cvFile` in component ref/state, upload via `uploadsApi.uploadCv(cvFile)`, and store the returned `{ cvFileName, cvOriginalName, cvUrl }` metadata in Redux!

**3 Live-Change Tasks (Kevin Gandham):**
1. Connect `AdminLayout`'s `openReportsCount` badge and `AdminDashboard`'s open-reports card to a single shared selector `selectOpenReportsCount` in `reportsSlice`, eliminating duplicate `/admin/reports/open-count` fetches.
2. Add `assigneeFilter` & `statusFilter` to `supportTicketsSlice.working` and verify `routeChanged` clears them when navigating away from `/admin/support`.
3. Add a `createSelector` `selectPendingMentorAppsCount` in `mentorApplicationsSlice` and render its badge next to `"Mentor Applications"` in `AdminLayout.jsx`.
