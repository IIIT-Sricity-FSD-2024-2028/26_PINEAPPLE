# Step 4: Roles, Controllers, and Store Mapping Matrix

> **Requirement 8 Spec:** *"Stores must be present with slices, showing how we put the roles and controllers, CRUD slices, and all displayed data must come from the Redux store."*
> **Rule:** The NestJS back end (`AuthGuard`, `RolesGuard`, `EmailVerifiedGuard`, `SelfAccountUpdateGuard`, and service ownership checks) remains the **only real authorization authority**. Redux selectors only mirror authenticated session/role/permission claims for navigation, menu visibility, and UI state.

---

## 1. Roles, Permissions, and Auth Design in the Redux Store

### 1A. `sessionSlice` State Shape (`src/store/slices/sessionSlice.js`)
Replaces `AuthContext`, `RoleContext`, `utils/roleStore.js`, `storage.getAdminSession()`, and `tokenManager` localStorage keys with a single serializable Redux slice (plus mirror access-token ref for `apiClient` headers — see [`06-no-local-storage.md`](./06-no-local-storage.md)):

```js
// Illustrative shape of state.session
{
  authStatus: 'idle' | 'checking' | 'authenticated' | 'signed_out' | 'suspended',
  authMode: 'jwt' | 'firebase' | 'legacy',
  isPortalSession: false,        // true when logged into /admin portal
  user: null,                    // User object from /auth/me or /users/me (id, email, name, username, role, emailVerified, profileComplete, mentorStatus, ...)
  accessToken: null,             // In-memory JWT/Firebase ID token (or admin token)
  expiresAtMs: null,             // Decoded JWT exp * 1000
  activeRole: 'collaborator',    // Canonical: 'collaborator' | 'project-owner' | 'mentor' | 'admin' | 'superuser'
  allowedRoles: ['collaborator', 'project-owner'],
  portalRole: null,              // 'admin' | 'superuser' | null
  isSuperUser: false,
  permissions: [],               // Portal admin sections: ['*'] or subset of ['dashboard','users','projects','mentor_apps','revenue','reports','support','audit','manage_admins','config']
  adminMeta: { id: null, email: null, name: null },
  suspendedInfo: null,           // Replaces sessionStorage 'teamforge_suspended_info'
  flashNotices: {                // Replaces sessionStorage notices
    sessionEnded: '',
    serverRestart: '',
    demoReset: '',
    accountDeleted: '',
  },
  bootId: null,                  // Mirrors backend X-Boot-Id header in memory
  status: 'idle',                // Thunk lifecycle: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,                   // { statusCode, error, code, message }
}
```

### 1B. Centralized `canAccess` Selector Architecture (`src/store/selectors/sessionSelectors.js`)
Matches `back-end/src/core/guards/roles.guard.ts:70-140` and `back-end/src/common/utils/role.util.ts:10-51` identically:

- `normalizeRole(raw)` canonicalizes `'Project Owner'` / `'owner'` -> `'project-owner'`, `'Administrator'` / `'portal_admin'` -> `'admin'`, `'Super User'` -> `'superuser'`, `'Collaborator'` -> `'collaborator'`, `'Mentor'` -> `'mentor'`, `'User'` -> `'user'`.
- **`selectCanAccess({ roles = [], section = null, requireEmailVerified = false, requireProfileComplete = true })`**:
  1. Returns `false` if `authStatus !== 'authenticated'` or `user?.status?.toLowerCase() === 'suspended'`.
  2. If `requireProfileComplete && !isPortalSession && user?.profileComplete === false`, returns `false` (mirrors `AuthGuard:85-100`).
  3. If `requireEmailVerified && !isPortalSession && user?.emailVerified === false`, returns `false` (mirrors `EmailVerifiedGuard`).
  4. If `isSuperUser || portalRole === 'superuser'`, returns `true` (Super User override in `RolesGuard:84`).
  5. Role match: checks `requiredRoles` against normalized `activeRole`, `allowedRoles`, or `portalRole` (with `'user'` matching any logged-in app user, and `'admin'` matching non-superuser admin routes per `RolesGuard:89-98`).
  6. Portal Admin section check (`RolesGuard:107-139`): when `section` is specified (`'dashboard'`, `'users'`, `'projects'`, `'mentor_apps'`, `'revenue'`, `'reports'`, `'support'`, `'audit'`, `'manage_admins'`, `'config'`), requires `permissions.includes('*') || permissions.includes(section)`.

### 1C. Refactoring Route Guards & Navigation Menus

| Guard / Menu Component | Old Source | New Redux Selector Binding | Server Authority Preserved How |
|---|---|---|---|
| `ProtectedRoute.jsx` | `AuthContext` | `useSelector(selectIsAuthenticated)`, `selectProfileComplete`, `selectSuspendedInfo` | Unverified JWT/cookie triggers `401` -> global interceptor dispatches `sessionInvalidated` -> redirects `/login`. |
| `OwnerProtectedRoute.jsx` | `roleStore` + `useEffect` sync | `useSelector(selectCanAccess({ roles: ['project-owner', 'admin', 'superuser'] }))`; route entry dispatches `switchActiveRole('project-owner')` | Backend `@Roles('Project Owner', 'Administrator')` + `isProjectOwner()` rejects spoofed `Owner` on API call. |
| `MentorProtectedRoute.jsx` | `roleStore` + `useEffect` sync | `useSelector(selectCanAccess({ roles: ['mentor', 'admin', 'superuser'] }))` | Backend verifies mentor approval & `mentorId === userId` in `MentorMarketplaceService`. |
| `AdminProtectedRoute.jsx` | `storage.getAdminSession()` | `useSelector(selectIsPortalAuthenticated)` + `selectPortalSectionAccess` | Backend `RolesGuard` verifies signed JWT (`role`, `permissions[]`), ignoring client state on API calls. |
| `Navbar.jsx` & `Sidebar.jsx` | `AuthContext` + `RoleContext` + `useActiveRole` | `selectCurrentUser`, `selectActiveRole`, `selectAllowedRoles`, `selectUnreadNotificationsCount`, `selectChatUnreadTotal` | Role switcher dispatches `switchRoleThunk` -> `POST /users/switch-role` before updating claim. |
| `AdminLayout.jsx` | `storage.getAdminSession().permissions` | `useSelector(selectAdminSidebarSections)` (uses `canAccess({ section })`) + `selectOpenReportsCount` | Backend `RolesGuard:107-139` enforces `requiredSection` independently on every `/admin/*` endpoint. |

---

## 2. Backend Controller -> Thunk File -> Slice File Mapping Convention

To make Requirement 8 ("showing how we put the roles and controllers, CRUD slices") crystal clear for the team and viva evaluators:

1. **Every Backend Controller maps to a dedicated Thunk Module (`src/store/thunks/<domain>Thunks.js`)** invoking the matching existing `src/services/*Api.js` transport function.
2. **Every Active Backend Repository / Collection maps to a Repository Slice (`src/store/slices/<repo>Slice.js`)** holding entities (`createEntityAdapter` or normalized state), synchronous CRUD reducers (`setAll`, `addOne`, `updateOne`, `removeOne`), and `extraReducers` synced by those thunks.
3. **Cross-controller shared repositories** (e.g. `ProjectsRepository` touched by both `ProjectsController` and `AdminController`; `NotificationsService` touched by both `NotificationsController` and `CommunicationController`) dispatch thunks whose `extraReducers` target the **same canonical repository slice** so state stays single-source-of-truth!

---

## 3. Complete Real Back-End Controllers -> Slices, Thunks, Roles & Screens Matrix

*(Derived directly from all **32 NestJS controller files / 282 handlers** verified on branch `Redux-Conversion`. Multi-path `@Controller(['a', 'b'])` mountings are noted inline.)*

### 3.1 `AppController`, `Core / Logs`, `Mail` (`app.controller.ts`, `log-viewer.controller.ts`, `mail.controller.ts`)

| Controller & Base Path | Route (`Method Path`) | Backend Repo / Service | Allowed Roles / Guards / Section | Target Slice | Target Thunk (`*Thunks.js`) | Displayed Screen(s) |
|---|---|---|---|---|---|---|
| `AppController` (`/`) | `GET /health` | None (`BootService`) | `@Public()` | `session` / `ui` | `systemThunks/checkBackendHealth` | `App` / health check |
| `AppController` (`/`) | `GET /ping` | None | Authenticated (`AuthGuard`) | — | None (diagnostic only) | None |
| `AppController` (`/`) | `GET /admin-test` | None | `@Roles('Administrator')` | — | None (diagnostic only) | None |
| `LogViewerController` (`/logs`) | `GET /logs/requests`, `GET /logs/errors` | `LogManagerService` (buffers) | `@Roles('Administrator')` | None (ops only) | Optional `adminThunks/fetchServerLogs` | None today (FE unused) |
| `MailController` (`/mail`) | `GET /mail/health` | `MailService` (SMTP status) | `@Public()` | None | None | None |

### 3.2 `AuthController` (`back-end/src/auth/auth.controller.ts` — `@Controller('auth')`)

| Route (`Method Path`) | Backend Repo / Store | Allowed Roles / Guards | Target Slice(s) | Target Thunk (`authThunks.js`) | Displayed Screen(s) |
|---|---|---|---|---|---|
| `POST /auth/signup` | `UsersRepository` | `@Public()` | `session`, `users` | `authThunks/signupUser` | `Signup`, `CompleteProfile` |
| `POST /auth/login` | `UsersRepository`, `LoginThrottleService` | `@Public()` | `session` | `authThunks/loginUser` | `Login` |
| `POST /auth/refresh` | `UsersRepository.refreshTokens`, `AuthService.rotatedRefreshTokens` | `@Public()` (reads `httpOnly` cookie or body) | `session` | `authThunks/refreshAccessToken` | App boot, focus/visibility listener, `apiClient` 401 retry |
| `POST /auth/logout` | `UsersRepository.refreshTokens` | Authenticated (`AuthGuard`) | `session` (+ clears all slices) | `authThunks/logoutUser` | `Navbar`, `settings` |
| `POST /auth/logout-all` | `UsersRepository.refreshTokens` | Authenticated | `session` (+ clears all slices) | `authThunks/logoutAllSessions` | `settings` (security section) |
| `GET /auth/me` | `UsersRepository` | Authenticated *(allowed even if `profileComplete === false`)* | `session`, `users` | `authThunks/fetchCurrentUser` | `ProtectedRoute`, `Navbar`, `CompleteProfile` |
| `POST /auth/verify-email` | `UsersRepository`, `AuthService.emailVerificationTokens` | `@Public()` | `session` | `authThunks/verifyEmailToken` | `VerifyEmail` |
| `POST /auth/resend-verification` | `UsersRepository`, `MailService` | Authenticated | `session` (banner feedback) | `authThunks/resendVerificationEmail` | `VerifyEmailBanner` |
| `POST /auth/change-password` | `UsersRepository` | Authenticated | `session` (op status) | `authThunks/changePassword` | `settings` |
| `POST /auth/switch-role` | `UsersRepository` | Authenticated | `session` | `authThunks/switchActiveRole` *(canonical calls `/users/switch-role`)* | `Navbar`, `Sidebar`, `Owner/MentorProtectedRoute` |
| `POST /auth/profile` | `UsersRepository` | Authenticated *(allowed if `profileComplete === false`)* | `session`, `users` | `authThunks/completeUserProfile` | `CompleteProfile` |
| `GET /auth/resolve-identifier` | `UsersRepository` | `@Public()` | `session` (lookup helper) | `authThunks/resolveLoginIdentifier` | `Login`, `ForgotPassword` |
| `POST /auth/forgot-password` | `UsersRepository`, `AuthService.resetTokens` | `@Public()` | `session` (reset notice state) | `authThunks/requestPasswordReset` | `ForgotPassword` |
| `POST /auth/reset-password` | `UsersRepository`, `AuthService.resetTokens` | `@Public()` | `session` (reset notice state) | `authThunks/confirmPasswordReset` | `ResetPassword` |
| `POST /auth/test-set-expiry` | `UsersRepository` | `@Roles('superuser')` | — | None (E2E test helper only) | None |

### 3.3 `UsersController` (`back-end/src/users/users.controller.ts` — `@Controller('users')`)

| Route (`Method Path`) | Backend Repo / Store | Allowed Roles / Guards / Section | Target Slice(s) | Target Thunk (`usersThunks.js`) | Displayed Screen(s) |
|---|---|---|---|---|---|
| `GET /users/me` | `UsersRepository` | Authenticated (`profileComplete=false` allowed) | `session`, `users` | `usersThunks/fetchMe` | `dashboard`, `profile`, `settings` |
| `PATCH /users/:id` | `UsersRepository` | `@Roles('Administrator', 'Collaborator', 'Project Owner', 'Mentor', 'User', 'Super User')` + `SelfAccountUpdateGuard` | `session`, `users` | `usersThunks/updateMyProfile` | `settings` |
| `PATCH /users/me/username` | `UsersRepository` | Authenticated | `session`, `users` | `usersThunks/confirmUsername` | `UsernameConfirmationBanner`, `settings` |
| `GET /users/username-available` | `UsersRepository` | `@Public()` | `users` (working availability) | `usersThunks/checkUsernameAvailability` | `CompleteProfile`, `settings` |
| `GET /users/search` | `UsersRepository` | Authenticated | `users` (working `searchResults`) | `usersThunks/searchUsers` | `OwnedWorkspace` (invite modal), `help` (report search) |
| `POST /users/switch-role` | `UsersRepository` | Authenticated | `session` | `authThunks/switchActiveRole` | `Navbar`, `roleStore` replacement |
| `GET /users/:id/public-profile`, `GET /users/:id` | `UsersRepository` | Authenticated | `users` | `usersThunks/fetchUserPublicProfile` / `fetchUserById` | `OwnedWorkspace` (applicant preview), `profile` |
| `GET /users/:id/response-time` | `UsersRepository`, `JoinRequestsService` | `@Public()` | `users` (`responseTimesByOwnerId`) | `usersThunks/fetchOwnerResponseTime` | `ProjectsMarketplace` |
| `GET /users/me/settings`, `PATCH /users/me/settings` | `UsersRepository` (user preferences) | Authenticated | `session`, `ui` | `usersThunks/fetchMySettings`, `updateMySettings` | `settings` (email digest settings) |
| `GET /users/me/phone/otp-status`, `POST request-otp`, `POST verify-otp`, `POST failed-attempt`, `POST verify`, `DELETE /users/me/phone` | `UsersRepository`, `UsersService.otpChallenges` | Authenticated | `session`, `users` | `usersThunks/verifyPhone*`, `deletePhone` | `settings` (phone OTP verification modal) |
| `POST /users/me/export`, `GET /users/me/export`, `GET :id`, `GET :id/download` | `DataExportService` | Authenticated + `EmailVerifiedGuard` (POST) | `dataExports` | `usersThunks/requestExport`, `fetchExports`, `downloadExport` | `settings` |
| `GET /users/me/deletion-check`, `POST /users/me/delete` | `UsersRepository`, `AccountDeletionService` | Authenticated | `session` (triggers logout on delete) | `usersThunks/checkDeletionEligibility`, `deleteMyAccount` | `settings` |
| `GET /users/me/reputation`, `GET /users/me/trust`, `GET /users/:id/trust`, `POST /users/trust-summaries` | `ReputationService` | Authenticated | `reputationEntries` (incl. `trustByUserId`) | `trustThunks/fetchMyReputation`, `fetchTrustSummary`, `fetchTrustSummaries` | `profile`, `MentorsDirectory`, `OwnedWorkspace`, `AdminUsers` |
| `GET /users/:id/badges` | `MentorshipRepository.badges` | Authenticated | `recommendationBadges` | `mentorshipThunks/fetchUserBadges` | `profile`, `dashboard` |
| `GET /users/me/invites` | `ProjectInvitesService` | Authenticated | `projectInvites` | `invitesThunks/fetchMyInvites` | `ProjectsMarketplace`, `notifications` |
| `GET /users`, `POST /users`, `DELETE /users/:id` | `UsersRepository` | `GET /users`: `'admin', 'superuser'` (`users` perm); `POST`/`DELETE`: `@Roles('superuser')` | `users` | `adminThunks/fetchUsers` *(POST/DELETE unused by FE today)* | `AdminUsers` |

### 3.4 `ProjectsController`, `LeaveRequestsController`, `InvitesController`, `TaskTemplatesController` (`back-end/src/projects/*.ts`)

| Controller & Route | Backend Repo / Store | Allowed Roles / Guards / Section | Target Slice | Target Thunk (`projectsThunks.js` / `invitesThunks.js` / `leaveRequestsThunks.js`) | Displayed Screen(s) |
|---|---|---|---|---|---|
| `GET /projects`, `GET /projects/my-work`, `GET /projects/collaborator/:userId`, `GET /projects/owner/:ownerId` | `ProjectsRepository` | Authenticated (`AuthGuard`) | `projects` | `projectsThunks/fetchProjects`, `fetchMyWork` | `dashboard`, `ProjectsMarketplace`, `AppliedProjects`, `MyWork`, `OwnerDashboard`, `MyProjects`, `MentorsDirectory`, `MentoredProjects`, `MentorRequests`, `profile`, `AdminProjects` |
| `GET /projects/:id`, `GET /projects/:id/members` | `ProjectsRepository`, `UsersRepository` | Authenticated (`AuthGuard`) | `projects` | `projectsThunks/fetchProjectById`, `fetchProjectMembers` | `CollaboratorWorkspace`, `OwnedWorkspace`, `MentorProjectWorkspace`, `AdminProjectDetails` |
| `POST /projects` | `ProjectsRepository` | `@Roles('Project Owner', 'Administrator')` + `EmailVerifiedGuard` | `projects` | `projectsThunks/createProject` | `CreateProject` |
| `PATCH /projects/:id`, `POST /projects/:id/complete`, `PATCH /projects/:id/deadline` | `ProjectsRepository`, `TasksRepository` | `@Roles('Project Owner', 'Administrator')` + owner check | `projects` (+ `tasks` if shifted) | `projectsThunks/updateProject`, `completeProject`, `changeProjectDeadline` | `OwnedWorkspace` |
| `GET /projects/:id/deletion-check`, `DELETE /projects/:id`, `POST /projects/:id/cancel-deletion` | `ProjectsRepository`, `DeletionPolicyService` | `@Roles('Project Owner', 'Administrator', 'superuser', 'admin')` | `projects` | `projectsThunks/checkProjectDeletion`, `softDeleteProject`, `cancelProjectDeletion` | `DeleteProjectDialog`, `MyProjects`, `OwnedWorkspace`, `AdminProjectDetails` |
| `GET /projects/:id/members/:userId/removal-check`, `DELETE /projects/:id/members/:memberId`, `POST /projects/:id/members/:userId/release-tasks` | `ProjectsRepository`, `TasksRepository` | Owner (`removal-check` allows `'Project Owner', 'Administrator', 'admin', 'superuser'`; `DELETE` `'Project Owner', 'Administrator'`) | `projects`, `tasks` | `projectsThunks/checkMemberRemoval`, `removeProjectMember`, `releaseMemberTasks` | `OwnedWorkspace` |
| `POST /projects/:id/leave`, `POST /projects/:id/request-close`, `POST /projects/:id/close` | `ProjectsRepository`, `SupportService` | Leave/request-close: member (`AuthGuard`); `close`: `'admin', 'superuser', 'Administrator'` | `projects` | `projectsThunks/leaveProject`, `requestProjectClose`, `closeProjectAdmin` | `CollaboratorWorkspace`, `AdminProjectDetails` |
| `GET /projects/:id/match`, `GET /projects/:id/my-request-status` | `ProjectsRepository`, `JoinRequestsService`, `UsersRepository` | Authenticated | `projects` (`skillMatchesById`) | `projectsThunks/fetchSkillMatch`, `fetchMyRequestStatus` | `ProjectsMarketplace`, `ProjectCard` |
| `GET /projects/:id/task-templates`, `POST /projects/:id/task-templates/apply`, `GET /task-templates` | `TemplatesService`, `TasksRepository` | `RolesGuard` (`OwnedWorkspace`/Creator) | `tasks`, `projects` (`starterTemplates`) | `projectsThunks/fetchStarterTemplates`, `applyStarterTemplates` | `CreateProject`, `OwnedWorkspace` |
| `POST /projects/:id/leave-requests`, `GET .../leave-requests`, `GET .../leave-requests/mine`, `DELETE .../leave-requests/mine`, `POST .../approve`, `POST .../reject` + `LeaveRequestsController` (`/leave-requests/:id/approve`, `/reject`) | `LeaveRequestsRepository` | Member (create/mine/withdraw) or Owner/Admin (list/approve/reject) | `leaveRequests` | `leaveRequestsThunks/createLeaveRequest`, `fetchProjectLeaveRequests`, `fetchMyLeaveRequest`, `withdrawLeaveRequest`, `approveLeaveRequest`, `rejectLeaveRequest` | `CollaboratorWorkspace`, `OwnedWorkspace` |
| `POST /projects/:id/invites`, `GET /projects/:id/invites`, `DELETE /projects/:id/invites/:inviteId` + `InvitesController` (`POST /invites/:id/accept`, `/decline`) | `ProjectInvitesService` | Owner (send/list/cancel); Recipient (accept w/ `EmailVerifiedGuard`, decline) | `projectInvites`, `projects` | `invitesThunks/sendProjectInvite`, `fetchProjectInvites`, `cancelProjectInvite`, `acceptProjectInvite`, `declineProjectInvite` | `OwnedWorkspace`, `ProjectsMarketplace`, `notifications` |
| `POST /projects/:id/mentor/abandonment-review`, `GET /projects/:id/mentor/abandonment-review` | `MentorMarketplaceService.abandonmentReviews` | Owner | `abandonmentReviews` | `abandonmentThunks/openAbandonmentReview`, `fetchProjectAbandonmentReview` | `OwnedWorkspace` |

### 3.5 `TasksController` (`back-end/src/tasks/tasks.controller.ts` — `@Controller('tasks')`)

| Route (`Method Path`) | Backend Repo | Allowed Roles / Guards | Target Slice | Target Thunk (`tasksThunks.js`) | Displayed Screen(s) |
|---|---|---|---|---|---|
| `GET /tasks/project/:projectId`, `GET /tasks/:id` | `TasksRepository` | Authenticated project member/admin | `tasks` | `tasksThunks/fetchProjectTasks`, `fetchTaskById` | `CollaboratorWorkspace`, `OwnedWorkspace`, `MentorProjectWorkspace`, `MyWork`, `OwnerDashboard`, `profile`, `AdminProjectDetails` |
| `POST /tasks` | `TasksRepository` | `@Roles('Project Owner', 'Collaborator', 'Mentor', 'Administrator', 'Super User')` | `tasks` | `tasksThunks/createTask` | `OwnedWorkspace` |
| `PATCH/PUT /tasks/:id`, `PATCH/PUT /tasks/:id/status`, `POST /tasks/:id/review`, `POST /tasks/:id/unassign`, `POST /tasks/:id/comments` | `TasksRepository`, `ProjectsRepository`, `GamificationRepository` | `@Roles('Project Owner', 'Collaborator', 'Mentor', 'Administrator', 'Super User')` *(approve/reject/review enforced as Owner in service)* | `tasks` (+ sync `projects`, `session`, `actionFeedback`) | `tasksThunks/updateTask`, `updateTaskStatus`, `reviewTask`, `unassignTask`, `addTaskComment` | `CollaboratorWorkspace`, `OwnedWorkspace` |
| `DELETE /tasks/:id` | `TasksRepository` | `@Roles('Project Owner', 'Collaborator', 'Mentor', 'Administrator', 'Super User')` | `tasks` | `tasksThunks/deleteTask` | `OwnedWorkspace` |

### 3.6 `JoinRequestsController` (`back-end/src/join-requests/join-requests.controller.ts` — `@Controller('join-requests')`)

| Route (`Method Path`) | Backend Store | Allowed Roles / Guards | Target Slice | Target Thunk (`joinRequestsThunks.js`) | Displayed Screen(s) |
|---|---|---|---|---|---|
| `GET /join-requests/mine`, `GET /join-requests`, `GET /join-requests/:id` | `JoinRequestsService` (`BaseService`) | `@Roles('admin', 'user')` | `joinRequests` | `joinRequestsThunks/fetchMyJoinRequests`, `fetchJoinRequests`, `fetchJoinRequestById` | `AppliedProjects`, `ProjectsMarketplace`, `MyWork`, `OwnedWorkspace`, `OwnerDashboard`, `profile` |
| `POST /join-requests` | `JoinRequestsService` | `@Roles('admin', 'user')` + `EmailVerifiedGuard` | `joinRequests` | `joinRequestsThunks/createJoinRequest` | `ProjectsMarketplace` |
| `PUT/PATCH /join-requests/:id`, `PUT/PATCH /join-requests/:id/status` | `JoinRequestsService` | `@Roles('admin', 'user')` | `joinRequests`, `projects` | `joinRequestsThunks/updateJoinRequest`, `respondJoinRequest` | `OwnedWorkspace` |
| `DELETE /join-requests/:id` | `JoinRequestsService` | `@Roles('admin', 'user')` | `joinRequests` | `joinRequestsThunks/deleteJoinRequest` | `AppliedProjects` |

### 3.7 `CommunicationController`, `NotificationsController`, `FeedbackController`

| Controller & Route | Backend Repo / Service | Allowed Roles / Guards | Target Slice | Target Thunk | Displayed Screen(s) |
|---|---|---|---|---|---|
| `CommunicationController`: `GET /communication/messages/project/:projectId`, `POST /communication/messages`, `GET /communication/unread`, `POST /communication/projects/:id/read` | `CommunicationRepository` | Authenticated project member (`POST messages` requires `EmailVerifiedGuard`) | `chatMessages` | `chatThunks/fetchProjectMessages`, `sendMessage`, `fetchChatUnread`, `markProjectRead` | `Navbar`, `CollaboratorWorkspace`, `OwnedWorkspace`, `MentorProjectWorkspace`, `ChatBox` |
| `CommunicationController`: `POST /communication/messages/:id/report` | `CommunicationRepository`, `ReportsService` | Authenticated project member | `chatMessages`, `reports` | `chatThunks/reportChatMessage` | `ChatBox` |
| `CommunicationController`: `GET /communication/notifications`, `PATCH /communication/notifications/:id/read` | `NotificationsService` | Authenticated user | `notifications` | `notificationsThunks/fetchNotifications`, `markAsRead` | Legacy / `notifications` |
| `NotificationsController`: `GET /notifications`, `GET /notifications/unread-count`, `GET /notifications/:id`, `POST /notifications`, `PUT /notifications/:id`, `PATCH/PUT /notifications/:id/read`, `PATCH/PUT /notifications/read-all`, `DELETE /notifications/:id` | `NotificationsService` | `POST`: `@Roles('admin', 'superuser')`; all others: `@Roles('admin', 'superuser', 'user')` | `notifications` | `notificationsThunks/fetchNotifications`, `fetchUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`, `deleteNotification`, `createNotification` | `Navbar`, `dashboard`, `OwnerDashboard`, `notifications` |
| `FeedbackController`: `GET /feedback/reasons`, `GET /feedback` | `ActionFeedbackRepository`, static `REASON_CATEGORIES` | Authenticated (`AuthGuard`) | `actionFeedback` | `feedbackThunks/fetchReasonsConfig`, `fetchEntityFeedback` | `UniversalReasonModal`, `FeedbackHistory`, `CollaboratorWorkspace`, `MentorRequests` |

### 3.8 `GamificationController`, `LeaderboardController`, `MentorshipController`

| Controller & Route | Backend Repo / Store | Allowed Roles / Guards | Target Slice | Target Thunk | Displayed Screen(s) |
|---|---|---|---|---|---|
| `GamificationController`: `GET /gamification/leaderboard`, `GET /gamification/:userId/ledger`, `GET /gamification/:userId/stats` | `GamificationRepository` | Authenticated (`AuthGuard`) | `gamificationLedger` | `gamificationThunks/fetchUserLedger`, `fetchUserStats` | `profile` |
| `LeaderboardController`: `GET /leaderboard`, `GET /leaderboard/:userId` | `LeaderboardService` (reads `Users`, `Projects`, `Tasks`, `Gamification`, `Reputation`) | `@Roles('Collaborator', 'Project Owner', 'Mentor', 'Administrator')` | `gamificationLedger` (`leaderboardEntries`) | `leaderboardThunks/fetchLeaderboard`, `fetchUserRank` | `leaderboard` |
| `MentorshipController`: `POST /mentorship/badge`, `POST /mentorship/badges`, `GET /mentorship/badges/:userId`, `GET /mentorship/badges/project/:projectId` | `MentorshipRepository.badges` | Create: `@Roles('Mentor', 'Administrator', 'Super User')`; Read: `'user', 'project-owner', 'collaborator', 'mentor', 'admin', 'superuser'` | `recommendationBadges` | `mentorshipThunks/issueBadge`, `fetchUserBadges`, `fetchProjectBadges` | `MentorProjectWorkspace`, `dashboard`, `profile`, `AdminUserDetails` |
| `MentorshipController` *(legacy 410)*: `POST apply`, `GET application`, `PATCH application/:id/review` + `GovernanceController` *(legacy 410)*: `/governance/reports*` | `MentorshipRepository.applications` / `GovernanceRepository` | Retired (`410 GONE`) | None | None | None (retired) |

### 3.9 `MentorApplicationsController`, `MentorRequestsController`, `UploadsController`

| Controller & Route | Backend Store | Allowed Roles / Guards / Section | Target Slice | Target Thunk | Displayed Screen(s) |
|---|---|---|---|---|---|
| `MentorApplicationsController` (`/mentor-applications` & `/admin/mentor-applications`): `GET digilocker/status`, `POST digilocker/pull-documents`, `GET /me`, `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `PUT /:id/approve`, `PUT/POST /:id/reject`, `DELETE /:id` | `MentorApplicationsService` (`BaseService`) | `me`/create/DigiLocker: `'admin', 'project-owner', 'collaborator', 'mentor', 'superuser', 'user'` (`EmailVerifiedGuard` on create); list/one: excludes `'user'`; approve/reject/update/delete: `'admin', 'superuser'` (`mentor_apps` perm) | `mentorApplications`, `session` | `mentorAppsThunks/fetchMyMentorApp`, `fetchAllMentorApps`, `createMentorApp`, `pullDigiLockerDocs`, `approveMentorApp`, `rejectMentorApp`, `deleteMentorApp` | `RoleContext` -> `Navbar`, `MentorApplication`, `AdminMentorApps` |
| `MentorRequestsController` (`/mentor-requests`): `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PUT accept`, `PUT decline`, `DELETE /:id` | `MentorRequestsService` (`BaseService`) | `@Roles('admin', 'user')` | `mentorRequests` | `mentorRequestsThunks/fetchMentorRequests`, `createMentorRequest`, `acceptMentorRequest`, `declineMentorRequest` | `MentoredProjects.jsx:64` (legacy fallback) |
| `UploadsController` (`/uploads`): `POST cv`, `GET cv/:filename`, `POST avatar`, `POST task-proof`, `POST resource`, `POST /`, `GET :filename` | Disk storage (`./uploads`, `./secure-cvs`); checks `MentorApplicationsService` for CV download | `GET cv/:filename`: `@Roles('admin', 'superuser', 'collaborator', 'mentor', 'project-owner', 'user')` + service ownership/admin `mentor_apps` check; `GET :filename` `@Public()`; others authenticated | No entity slice (returns uploaded URL/file metadata to `mentorApplications`/`session`/`tasks`) | `uploadsThunks/uploadCv`, `downloadCv`, `uploadAvatar` | `MentorApplication`, `AdminMentorApps`, `settings` |

### 3.10 `MentorMarketplaceController` (`['mentor-marketplace', '']`), `MentorLifecycleController` (`'mentor'`), `EscrowController`, `PayoutsController`

| Controller & Route | Backend Store | Allowed Roles / Guards / Section | Target Slice | Target Thunk (`mentorMarketplaceThunks.js`) | Displayed Screen(s) |
|---|---|---|---|---|---|
| `GET /mentors`, `GET /mentors/:id` | `MentorMarketplaceService.profiles` | `'user', 'admin', 'project-owner', 'collaborator', 'mentor', 'superuser'` | `mentorProfiles` | `mentorThunks/fetchMentors`, `fetchMentorById` | `MentorsDirectory`, `MentorRevenue` |
| `GET /mentors/me`, `GET /mentors/me/stats`, `POST /mentors/profile`, `PATCH/PUT /mentors/profile`, `PATCH /mentors/availability`, `PATCH /mentors/confirm-role` | `MentorMarketplaceService.profiles` | `'mentor', 'admin', 'superuser'` | `mentorProfiles`, `session` | `mentorThunks/fetchMyMentorProfile`, `fetchMyMentorStats`, `saveMentorProfile`, `toggleMentorAvailability`, `confirmMentorRole` | `MyMentorProfile` |
| `POST /sessions/book`, `POST /sessions/:id/confirm-payment`, `POST /sessions/:id/pay`, `POST /sessions/:id/cancel-payment`, `POST /sessions/:id/complete`, `POST /sessions/:id/cancel` | `MentorMarketplaceService.sessions`, `EscrowService`, `DemoUpiProvider` | `'project-owner', 'admin', 'superuser'` (`EmailVerifiedGuard` on book/confirm/pay; cancel excludes mentor) | `mentorSessions`, `escrowAccounts` | `mentorSessionsThunks/bookSession`, `confirmPayment`, `paySession`, `cancelPayment`, `completeSession`, `cancelSession` *(carries `Idempotency-Key`)* | `MentorsDirectory`, `useReasonAction` |
| `GET /sessions/mine` | `MentorMarketplaceService.sessions` | `'user', 'project-owner', 'collaborator', 'admin', 'superuser'` | `mentorSessions` | `mentorSessionsThunks/fetchMySessions` | `MentorsDirectory` |
| `GET /sessions/mentor-view`, `GET /mentored-projects`, `POST /sessions/:id/accept`, `POST/PATCH /sessions/:id/decline` | `MentorMarketplaceService.sessions`, `ProjectsRepository` | `'mentor', 'admin', 'superuser'` | `mentorSessions`, `projects` (`mentoredProjects`) | `mentorSessionsThunks/fetchMentorSessions`, `fetchMentoredProjects`, `acceptSession`, `declineSession` | `MentorRequests`, `MentoredProjects`, `MentorEarnings` |
| `GET /sessions`, `GET /sessions/admin-stats`, `POST /sessions/:id/start` | `MentorMarketplaceService.sessions` | `'admin', 'superuser'` (`revenue` perm) | `mentorSessions` | `mentorSessionsThunks/fetchAllSessionsAdmin`, `fetchSessionAdminStats` | `MentorRevenue` |
| `POST /sessions/:id/retry-payout`, `POST /sessions/:id/notes` (& `/mentor/:id/notes`) | `MentorMarketplaceService.sessions`, `EscrowService`, `PayoutsService` | Retry: `'admin', 'superuser', 'project-owner', 'mentor'`; Notes: `'mentor', 'project-owner', 'admin', 'superuser'` | `mentorSessions` | `mentorSessionsThunks/retryPayout`, `addSessionNote` | `MentorEarnings`, `MentorRevenue` |
| `POST /sessions/:id/review` | `MentorMarketplaceService.reviews` | `'user', 'project-owner', 'collaborator', 'admin', 'superuser'` | Optional `mentorReviews` | `mentorSessionsThunks/submitReview` *(unused in UI today)* | None today |
| `POST /sessions/:id/feedback` (& `MentorLifecycleController` `/mentor/:id/feedback`) | `MentorMarketplaceService.sessionFeedbacks` | `'user', 'project-owner', 'collaborator', 'admin', 'superuser'` | `sessionFeedbacks`, `mentorSessions` | `mentorFeedbackThunks/submitSessionFeedback` | `MentorsDirectory` |
| `POST /sessions/:id/dispute` (& `/mentor/:id/dispute`) | `MentorMarketplaceService.disputes`, `EscrowService` | `'user', 'project-owner', 'collaborator', 'mentor', 'admin', 'superuser'` + `EmailVerifiedGuard` | `sessionDisputes`, `mentorSessions` | `disputesThunks/openSessionDispute` | `MentorsDirectory`, `MentorEarnings` |
| `GET /mentor/abandonment-reviews/mine`, `POST /mentor/abandonment-reviews/:id/confirm` | `MentorMarketplaceService.abandonmentReviews` | `'mentor', 'admin', 'superuser'` | `abandonmentReviews` | `abandonmentThunks/fetchMyAbandonmentReviews`, `confirmAbandonmentReview` | `dashboard`, `MentoredProjects` |
| `EscrowController`: `GET /escrow`, `GET /escrow/:id` | `EscrowService` | List: `'admin', 'superuser'` (`revenue` perm); `:id`: `'admin', 'superuser', 'user'` | `escrowAccounts` | `escrowThunks/fetchEscrows`, `fetchEscrowById` | `AdminProjectDetails`, `MentorRevenue` |
| `PayoutsController`: `GET /payouts/transactions` | `PayoutsService` | `@Roles('user')` | None (FE unused today) | Optional `payoutsThunks/fetchTransactions` | None today |

### 3.11 `ReportsController`, `AppealsController`, `ModerationController`, `SupportController`, `AdminSupportController`, `PortalAdminsController`, `AdminController`

| Controller & Route | Backend Store | Allowed Roles / Guards / Section | Target Slice | Target Thunk | Displayed Screen(s) |
|---|---|---|---|---|---|
| `ReportsController`: `POST /reports`, `GET /reports/mine` | `ReportsService` | Authenticated (`EmailVerifiedGuard` on POST) | `reports` | `reportsThunks/createReport`, `fetchMyReports` | `help` |
| `ReportsController`: `GET /admin/reports`, `GET /admin/reports/open-count`, `GET /admin/reports/owner-patterns`, `GET /admin/reports/:id`, `PATCH /admin/reports/:id/status`, `POST /admin/reports/:id/action` | `ReportsService`, `ModerationService` | `@Roles('admin', 'superuser')` (`reports` perm) | `reports` | `reportsThunks/fetchAdminReports`, `fetchOpenReportsCount`, `fetchOwnerPatterns`, `fetchReportDetails`, `updateReportStatus`, `actionReport` | `AdminLayout`, `AdminDashboard`, `AdminReports` |
| `AppealsController`: `POST /warnings/:id/appeal`, `GET /users/me/appeals` | `AppealsService` | Authenticated user | `appeals` | `appealsThunks/submitAppeal`, `fetchMyAppeals` | `notifications` |
| `AppealsController`: `GET /admin/appeals`, `POST /admin/appeals/:id/decision` | `AppealsService`, `ModerationService` | `@Roles('admin', 'superuser')` (`reports` perm) | `appeals`, `warnings` | `appealsThunks/fetchAdminAppeals`, `decideAppeal` | `AdminReports` |
| `ModerationController`: `GET /users/me/warnings`, `GET /admin/users/:id/warnings`, `POST/PUT /admin/users/:id/warn`, `POST/PUT /admin/users/:id/suspend`, `POST/PUT /admin/users/:id/reactivate`, `GET /admin/moderation-actions`, `POST approve`, `POST reject` | `ModerationService` (`warnings`, `pendingActions`), `UsersRepository` | `me/warnings`: `@Roles('user')`; Admin routes: `@Roles('admin', 'superuser')` (`users` perm) | `warnings`, `pendingModerationActions`, `users` | `moderationThunks/fetchMyWarnings`, `fetchAdminWarnings`, `warnUser`, `suspendUser`, `reactivateUser`, `fetchModerationActions`, `approveModerationAction`, `rejectModerationAction` | `notifications`, `AdminUsers`, `AdminUserDetails`, `AdminReports`, `ModerationModal` |
| `SupportController`: `POST /support/tickets` (`@Public()`), `GET /support/tickets`, `GET /support/tickets/:id`, `POST .../replies`, `GET/POST /support`, `GET /support/:id`, `PUT /support/:id/status`, `DELETE /support/:id` | `SupportService` (`BaseService`) | `POST /support/tickets`: `@Public()`; user ticket routes: all app/admin roles; status/delete: `'admin', 'superuser'` (`support` perm) | `supportTickets` | `supportThunks/createTicket`, `fetchMyTickets`, `fetchMyTicketById`, `replyToMyTicket` | `help` |
| `AdminSupportController`: `GET /admin/support/tickets`, `GET /admin/support/assignees`, `GET .../tickets/:id`, `PATCH .../tickets/:id`, `POST .../replies`, `POST .../close-project` | `SupportService`, `PortalAdminsService`, `ProjectsRepository` | Class `@Roles('admin', 'superuser')` (`support` perm) | `supportTickets`, `portalAdmins` | `adminSupportThunks/fetchAdminTickets`, `fetchAssignees`, `fetchAdminTicket`, `updateAdminTicket`, `replyAdminTicket`, `closeProjectFromTicket` | `AdminSupport` |
| `PortalAdminsController`: `GET /portal-admins`, `POST /portal-admins`, `PUT /portal-admins/:id`, `DELETE /portal-admins/:id` | `PortalAdminsService` (`BaseService`) | `@Roles('superuser', 'portal_admin')` (`manage_admins` perm) | `portalAdmins` | `portalAdminsThunks/fetchPortalAdmins`, `createPortalAdmin`, `updatePortalAdmin`, `deletePortalAdmin` | `SuperuserAdmins`, `SuperuserConfig` |
| `AdminController` (Auth & Users): `POST /admin/login` (`@Public()`), `GET /admin/users`, `GET /admin/users/duplicates`, `GET /admin/users/:id`, `PATCH/PUT/POST /admin/users/:id/status`, `PUT /admin/users/:id/flag` | `PortalAdminsService`, `UsersRepository`, `DuplicateDetectionService` | `login`: `@Public()`; others: `@Roles('admin')` (`users` perm; `duplicates` allows `'admin', 'superuser'`) | `session`, `users` | `adminThunks/adminLogin`, `fetchAdminUsers`, `fetchDuplicateUsers`, `fetchAdminUserDetails`, `updateUserStatus`, `flagUser` | `AdminLogin`, `AdminUsers`, `AdminUserDetails` |
| `AdminController` (Stats, Audit & Config): `GET /admin/stats`, `GET /admin/audit`, `GET /admin/audit/export`, `POST /admin/audit`, `GET /admin/config/public` (`@Public()`), `GET /admin/config`, `PUT /admin/config`, `GET /admin/system/demo-reset-status`, `POST /admin/system/reset-demo` | `AdminService`, `AuditService`, `PlatformConfigService`, `DemoResetService` | `stats`: `admin` (`dashboard`); `audit`: `admin` (`audit`); `POST /admin/audit`: `'user'`; `GET config`: `'admin', 'superuser'` (`config`); `PUT config` & demo reset: `'superuser'` only | `auditLogs`, `platformConfig`, `users` (`stats`) | `adminThunks/fetchAdminStats`, `fetchAuditLogs`, `exportAuditLogs`, `recordAuditEntry`, `fetchPublicConfig`, `fetchAdminConfig`, `updatePlatformConfig`, `fetchDemoResetStatus`, `resetDemoData` | `App`, `AdminDashboard`, `AuditLog`, `SuperuserConfig`, `CreateProject`, `MentorApplication`, `AdminMentorApps`, `Login`, `Signup` |
| `AdminController` (Jobs, Escrow, Disputes, Abandonment, Mentor Feedback, Projects, Reputation): `GET /admin/jobs/runs`, `GET /admin/jobs/runs/:id`, `POST /admin/jobs/tick`, `GET /admin/escrow/reconcile`, `GET /admin/projects/:id/escrow`, `GET /admin/disputes`, `POST /admin/disputes/:id/decide`, `POST /admin/abandonment-reviews/:id/cancel`, `GET /admin/mentors/:id/feedback`, `POST /admin/projects/:id/close`, `POST /admin/projects/:id/restore`, `GET /admin/users/:id/reputation`, `GET /admin/reputation`, `GET /admin/reputation/reconcile` | `JobRunsService`, `EscrowService`, `MentorMarketplaceService`, `ProjectsRepository`, `ReputationService` | Section perms per `RolesGuard:112-135` (`tick` & `reputation/reconcile`: `'superuser'` only; disputes: `reports`; escrow: `revenue`; abandonment/mentor-feedback: `mentor_apps`; projects: `projects`) | `jobRuns`, `escrowAccounts`, `sessionDisputes`, `abandonmentReviews`, `sessionFeedbacks`, `projects`, `reputationEntries` | `adminThunks/fetchJobRuns`, `triggerJobsTick`, `reconcileEscrow`, `fetchProjectEscrow`, `fetchDisputes`, `decideDispute`, `cancelAbandonmentReview`, `fetchMentorFeedbackAdmin`, `adminCloseProject`, `adminRestoreProject`, `fetchUserReputationAdmin` | `ScheduledJobsPanel`, `MentorRevenue`, `AdminProjectDetails`, `AdminProjects`, `AdminReports`, `AdminUserDetails` |
| **Missing BE Routes (FE Debt):** `GET /admin/mentor-sessions/needs-review`, `POST /admin/mentor-sessions/:id/clear-review` | `MentorMarketplaceService.clearSessionReview` (`L4677` service only) | N/A (not exposed in controller) | `mentorSessions` *(fallback)* | Documented gap (returns empty / handles 404 gracefully) | `AdminReports.jsx` |
