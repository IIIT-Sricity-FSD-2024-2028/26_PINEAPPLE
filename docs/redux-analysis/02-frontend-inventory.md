# Step 2: Front-End Inventory (Evidence Only)

> **Scope:** Read-only evidence audit of all **96 non-test JS/JSX source files** (`58,712` total lines) in `React-Implementation/React-Implementation/src/`.
> Under Professor Requirement 4 (*"Any data being displayed in a component must be displayed from the Redux store"*), **currently `0` components display from Redux** (no `redux`, `@reduxjs/toolkit`, or `react-redux` packages exist in `React-Implementation/React-Implementation/package.json`). Every non-Redux data source below is flagged `[NOT IN REDUX]`.

---

## 1. Displayed Data Sources (Every Page, Layout, Guard, and Component)

> **Rule Applied:** Controlled form input `useState` (typing buffers before submit) is **not** flagged as a Requirement 4 violation unless it displays server-fetched data.

### 1A. Root Shell, Route Guards, Layouts & Chrome

| File | Displayed / Guarded Data | Current Source(s) | Req 4 Flag |
|---|---|---|---|
| `src/main.jsx` | Root mount around `<App />` | `BrowserRouter` only (no Redux `<Provider>`) | `[NOT IN REDUX]` |
| `src/App.jsx` (`168L`) | Maintenance banner (`maintenance`, `maintenanceMsg`), demo reset banner (`resettingBanner`) | `useState` (`L90-92`) + `adminApi.getPublicConfig()` (`L115`) + `teamforge:maintenance` DOM event (`L112`) | `[NOT IN REDUX]` |
| `src/routes/ProtectedRoute.jsx` (`40L`) | `isAuthenticated`, `user`, `loading`, `status` | `AuthContext` (`L6`) | `[NOT IN REDUX]` |
| `src/routes/AdminProtectedRoute.jsx` (`17L`) | `portalRole`, `token` | `storage.getAdminSession()` -> `sessionStorage` (`L6`) | `[NOT IN REDUX]` |
| `src/routes/OwnerProtectedRoute.jsx` (`28L`) | `allowedRoles`, `homePath` | `useActiveRole()` hook -> `roleStore` (`L7`) + `useLocation()` | `[NOT IN REDUX]` |
| `src/routes/MentorProtectedRoute.jsx` (`28L`) | `allowedRoles` | `useActiveRole()` hook -> `roleStore` (`L7`) + `useLocation()` | `[NOT IN REDUX]` |
| `src/pages/layout.jsx` (`60L`) | `status`, `user`, `loading`, `activeRole`, `isSidebarOpen` | `AuthContext` (`L14`), `useActiveRole()` (`L15`), duplicate local `useState(true)` (`L13`, ignores `UIContext.isSidebarOpen`) | `[NOT IN REDUX]` |
| `src/components/navbar.jsx` (`413L`) | `user`, `activeRole`, `allowedRoles`, `isMentorApproved`, `mentorAppStatus`, `unreadCount`, `chatUnread` | `AuthContext` (`L13`), `RoleContext`/`useActiveRole` (`L14-15`), `NotificationContext` (`L16`), local `useState` (`L21`) + `communicationApi.getUnread()` (`L60`) | `[NOT IN REDUX]` |
| `src/components/sidebar.jsx` (`246L`) | `activeRole` badge, nav items, `isOpen` | `useActiveRole()` -> `roleStore` (`L75`) + prop `isOpen` from `layout.jsx` | `[NOT IN REDUX]` |
| `src/pages/admin/AdminLayout.jsx` (`162L`) | `isSuperUser`, `permissions`, `openReportsCount` | `storage.getAdminSession()` (`L27`), local `useState` (`L12`) + `reportsApi.getOpenCount()` (`L40`) + `teamforge:report_updated` | `[NOT IN REDUX]` |

### 1B. Public & Auth Pages

| File | Displayed Server / Session Data | Current Source(s) | Req 4 Flag |
|---|---|---|---|
| `src/pages/landingpage.jsx` (`849L`) | Account-deleted banner (`deletedBanner`) | `useState` initialized from `location.state?.accountDeletedMessage` or `storage.consumeAccountDeletedNotice()` (`sessionStorage`) | `[NOT IN REDUX]` |
| `src/pages/Login.jsx` (`480L`) | Suspension notice (`suspendedInfo`), error/session/restart notices (`error`, `notice`), login result | `sessionStorage.getItem('teamforge_suspended_info')` (`L50`), `storage.consume*Notice()` (`L58-75`), `location.state`, URL query (`L61`), `AuthContext.login` (`L83`), `authApi` (`L102,154,265,302`) | `[NOT IN REDUX]` |
| `src/pages/Signup.jsx` (`358L`) | Post-signup session/profile status, server errors | `AuthContext` (`L50`), `authApi.signup` / `getMe` (`L68,104,219`) | `[NOT IN REDUX]` |
| `src/pages/CompleteProfile.jsx` (`290L`) | Prefilled `user` name, username availability status, server error | `AuthContext` (`L9`), `location.state?.name` (`L13`), `useState` `asyncAvailability` (`L24`) + `usersApi.checkUsernameAvailable` (`L68`) + `authApi.createProfile` (`L140`) | `[NOT IN REDUX]` |
| `src/pages/ForgotPassword.jsx` (`407L`) | Reset status message, `deliveryHint`, `devNotice`, `resendTimer` | `AuthContext` (`L33`), `useState` (`L20-30`) + `authApi.resolveIdentifier` (`L77`) / `forgotPassword` (`L120`) | `[NOT IN REDUX]` |
| `src/pages/ResetPassword.jsx` (`425L`) | Reset token validity, `verifiedEmail`, success/error toast | `AuthContext` (`L47`), `useSearchParams` (`L24`), `useState` (`L37-43`), Firebase `verifyPasswordResetCode` / `authApi.resetPassword` (`L170`) | `[NOT IN REDUX]` |
| `src/pages/VerifyEmail.jsx` (`97L`) | Verification status & message (`status`, `message`) | `AuthContext` (`L10`), `useSearchParams` (`L8`), `useState` (`L20-21`), `authApi.verifyEmail` | `[NOT IN REDUX]` |
| `src/pages/Suspended.jsx` (`82L`) | Suspension reason/timestamp/details (`info`) | `location.state?.suspendedInfo` or `sessionStorage.getItem('teamforge_suspended_info')` (`L13-18`) | `[NOT IN REDUX]` |
| `src/pages/NotFound.jsx` (`44L`) | Static 404 UI | Static JSX (no server data displayed) | OK (Static) |
| `src/pages/ProjectTombstone.jsx` (`101L`) | Tombstone notice for deleted/scheduled project | `props.project`, `props.onNavigate` from parent workspace fetch (`useState` in parent) | `[NOT IN REDUX]` (via parent props) |

### 1C. Shared Authenticated User Pages

| File | Displayed Server / Session Data | Current Source(s) | Req 4 Flag |
|---|---|---|---|
| `src/pages/dashboard.jsx` (`398L`) | `stats` (`xp`, `rep`, `activeProjects`, `completedTasks`, `badgesCount`), `latestBadge`, `userActions`, `openAbandonmentReviews`, `notifications` | `AuthContext` (`L50`), `NotificationContext` (`L51`), `useActiveRole` (`L52`), `storage.getBackendUserId()` (`L68`), `useState` (`L55-61`) + `usersApi.getMe`, `projectsApi.list`, `mentorshipApi.getBadges`, `mentorMarketplaceApi.getMyAbandonmentReviews` | `[NOT IN REDUX]` |
| `src/pages/profile.jsx` (`923L`) | `profileData`, `ledgerEntries`, `reputationEntries`, `repTotal`, `trustSummary`, projects, tasks, join requests, badges | `AuthContext` (`L112`), `storage.getBackendUserId()` (`L145`), `storage.getAdminSession()` (`L504`), `useState` (`L113-122`) + `usersApi.getMe/getReputation`, `projectsApi.list`, `joinRequestsApi.list`, `mentorshipApi.getBadges`, `gamificationApi.getUserLedger`, `trustApi.getMyTrust`, `tasksApi.listForProjects` | `[NOT IN REDUX]` |
| `src/pages/settings.jsx` (`2124L`) | Profile fields loaded from server (`savedEmail`, `savedPhone`, `savedPhoneVerified`), `digestEnabled`/`digestHour`, `exportState`, `deletionCheck`, `deleteObligations`, `deleteTaskBlockers`, `theme` | `AuthContext` (`L70`), `UIContext` (`L71`), `storage.getBackendUserId()` (`L213`), `useState` (`L72-154`) + `usersApi.getMe/getSettings/listExports/checkDeletionEligibility` | `[NOT IN REDUX]` |
| `src/pages/notifications.jsx` (`869L`) | `notifications`, `unreadCount`, `appeals`, `warnings`, `invites` | `NotificationContext` (`L27`), `useState` (`L31-32,56`) + `appealsApi.getMyAppeals`, `adminApi.getMyWarnings`, `projectsApi.getMyInvites` | `[NOT IN REDUX]` |
| `src/pages/leaderboard.jsx` (`400L`) | `entries` (rank list), current user highlight | `AuthContext` (`L13`), `RoleContext` (`L14`), `storage.getBackendUserId()` (`L60`), `useState` (`L18-20`) + `leaderboardApi.getLeaderboard` (`L31`) | `[NOT IN REDUX]` |
| `src/pages/help.jsx` (`1297L`) | Static FAQs, `myTickets`, `selectedTicket` + replies, `myReports`, `searchResults` (user search) | `AuthContext` (`L190`), `useLocation()` (`L191`), `useState` (`L204-238`) + `reportsApi.getMyReports`, `supportApi.listMyTickets/getMyTicket`, `usersApi.searchUsers` | `[NOT IN REDUX]` |

### 1D. Collaborator Role Pages

| File | Displayed Server Data | Current Source(s) | Req 4 Flag |
|---|---|---|---|
| `src/pages/collaborator/ProjectsMarketplace.jsx` (`728L`) | Open `projects`, `previewProject`, `skillMatch`, `myApplications`, `myInvites`, `ownerResponseTimes` | `AuthContext` (`L19`), `storage.getBackendUserId()` (`L53`), `useSearchParams` (`L21`), `useState` (`L23-36`) + `projectsApi.list/getMatch/getMyInvites`, `joinRequestsApi.getMyRequests`, `usersApi.getResponseTime` | `[NOT IN REDUX]` |
| `src/pages/collaborator/AppliedProjects.jsx` (`449L`) | `applications` merged with project metadata | `AuthContext` (`L15`), `storage.getBackendUserId()` (`L33`), `useState` (`L18-24`) + `joinRequestsApi.getMyRequests`, `projectsApi.list` | `[NOT IN REDUX]` |
| `src/pages/collaborator/MyWork.jsx` (`248L`) | `ongoingProjects`, `completedProjects`, counts, `tasksMap`, `summaryProject` | `AuthContext` (`L16`), `useState` (`L19-26`) + `projectsApi.getMyWork`, `projectsApi.list`, `tasksApi.listForProjects` | `[NOT IN REDUX]` |
| `src/pages/collaborator/CollaboratorWorkspace.jsx` (`1197L`) | `project`, `tombstoneData`, `tasks`, `messages`, `leaveRequest`, `unassignReasons`, `dropReasons` | `AuthContext` (`L35`), `useParams` (`L33`), `useState` (`L37-82`) + `projectsApi.get/getMyLeaveRequest`, `tasksApi.list`, `communicationApi.getMessages`, `feedbackApi.getFeedbackReasons` | `[NOT IN REDUX]` |

### 1E. Project Owner Role Pages

| File | Displayed Server Data | Current Source(s) | Req 4 Flag |
|---|---|---|---|
| `src/pages/owner/OwnerDashboard.jsx` (`303L`) | `ownedProjects`, `activeProjectsCount`, `tasksByProject`, `pendingRequestsCount`, `totalCollaborators`, `totalTasksCount`, `ownerActions`, `notifications` | `AuthContext` (`L24`), `NotificationContext` (`L25`), `useState` (`L28-35`) + `projectsApi.list`, `joinRequestsApi.list`, `tasksApi.listForProjects` | `[NOT IN REDUX]` |
| `src/pages/owner/MyProjects.jsx` (`231L`) | Owned `projects` (all/active/completed/scheduled deletion) | `AuthContext` (`L24`), `useState` (`L27-29`) + `projectsApi.list` (`L38`) | `[NOT IN REDUX]` |
| `src/pages/owner/CreateProject.jsx` (`522L`) | `maxCapacityLimit` (server config), `starterTemplates`, `resolvedTemplateCategory` | `AuthContext` (`L17`), `useState` (`L20,45-51`) + `adminApi.getPublicConfig` (`L54`), `projectsApi.getTaskTemplatesByCategory` (`L79`) | `[NOT IN REDUX]` |
| `src/pages/owner/MentorsDirectory.jsx` (`1266L`) | `mentors`, `trustSummaries`, `ownedProjects`, `mySessions`, `activePaymentIntent`, `activePaymentSession` | `AuthContext` (`L120`), `useActiveRole` (`L121`), `useState` (`L124-160`) + `mentorMarketplaceApi.listMentors/mySessions`, `projectsApi.list`, `trustApi.getTrustSummaries` | `[NOT IN REDUX]` |
| `src/pages/owner/OwnedWorkspace.jsx` (`4173L`) | `project`, `tombstoneData`, `tasks`, `joinRequests`, `messages`, `projectInvites`, `leaveRequests`, `trustSummaries`, `removalChecks`, `inviteSearchResults`, `applicantProfile`, `mentorAbandonmentInfo`, `starterTemplates`, `starterSkipped` | `AuthContext` (`L57`), `useParams`/`useLocation`, `useState` (`L59-265`) + `projectsApi`, `tasksApi`, `joinRequestsApi`, `communicationApi`, `usersApi`, `trustApi`, `mentorMarketplaceApi` | `[NOT IN REDUX]` |

### 1F. Mentor Role Pages

| File | Displayed Server Data | Current Source(s) | Req 4 Flag |
|---|---|---|---|
| `src/pages/mentor/MentorApplication.jsx` (`910L`) | `existingApp`, `minYearsRequired`, `cooldownInfo`, `cvData`, `digiLockerDocs`, `digiLockerConnected`, `isMentorApproved` | `AuthContext` (`L22`), `RoleContext` (`L23`), `useState` (`L26-55`) + `mentorApplicationsApi.getMyStatus/list`, `adminApi.getPublicConfig`, `uploadsApi`, DigiLocker endpoints | `[NOT IN REDUX]` |
| `src/pages/mentor/MentoredProjects.jsx` (`320L`) | `mentoredProjects`, `counts`, `openAbandonmentReviews` | `AuthContext` (`L13`), `useState` (`L16-21`) + `mentorMarketplaceApi.getMentoredProjects/getMyAbandonmentReviews/mentorSessions`, `projectsApi.list`, `mentorRequestsApi.list` | `[NOT IN REDUX]` |
| `src/pages/mentor/MentorRequests.jsx` (`496L`) | `requests` (mentor sessions/requests + project titles), `declineReasons`, `declineReasonOptions` | `useState` (`L42-53`) + `mentorMarketplaceApi.mentorSessions`, `projectsApi.list`, `feedbackApi.getFeedbackReasons` | `[NOT IN REDUX]` |
| `src/pages/mentor/MentorEarnings.jsx` (`298L`) | `sessions` (completed/pending escrow/payouts) | `useState` (`L10-16`) + `mentorMarketApi.mentorSessions` (`L22`) | `[NOT IN REDUX]` |
| `src/pages/mentor/MyMentorProfile.jsx` (`490L`) | `hasExistingProfile`, loaded mentor profile fields (`title`, `bio`, `skillsInput`, `experienceYears`, `sessionPrice`, `isAvailable`, `maxActiveMentees`) | `AuthContext` (`L41`), `useState` (`L43-75`) + `mentorMarketplaceApi.myProfile` (`L84`) | `[NOT IN REDUX]` |
| `src/pages/mentor/MentorProjectWorkspace.jsx` (`670L`) | `project`, `tombstoneData`, `tasks`, `messages`, `awardedMembers` (badges) | `AuthContext` (`L39`), `useParams` (`L37`), `useState` (`L41-62`) + `projectsApi.get`, `tasksApi.list`, `communicationApi.getMessages`, `mentorshipApi.getBadgesByProject` | `[NOT IN REDUX]` |

### 1G. Admin & Super User Portal Pages + Admin Cards

| File | Displayed Server Data | Current Source(s) | Req 4 Flag |
|---|---|---|---|
| `src/pages/admin/AdminLogin.jsx` (`230L`) | Suspension info, restart/demo-reset notices, login errors | `useLocation()`, `sessionStorage.getItem('teamforge_suspended_info')` (`L26`), `storage.consume*` (`L36-38`), `adminApi.login` (`L85`) | `[NOT IN REDUX]` |
| `src/pages/admin/AdminDashboard.jsx` (`268L`) | `stats`, `recentEvents` (audit log), `openReportsCount` | `useState` (`L10-20`) + `adminApi.getStats/getAuditLog`, `reportsApi.getOpenCount` | `[NOT IN REDUX]` |
| `src/pages/admin/AdminUsers.jsx` (`816L`) | `users`, `duplicateGroups`, `trustSummaries`, `moderationActions` (pending 2-person approvals) | `storage.getAdminSession()` (`L62`), `useSearchParams` (`L32`), `useState` (`L33-60`) + `adminApi.listUsers/getDuplicateUsers/getModerationActions`, `trustApi.getTrustSummaries` | `[NOT IN REDUX]` |
| `src/pages/admin/AdminUserDetails.jsx` (`924L`) | `user`, badges, `reputationEntries`, `repTotal`, `mentorFeedbackData` (`sessionFeedbacks` + `abandonmentHistory`) | `useParams()` (`L16`), `useState` (`L19-36`) + `adminApi.getUserDetails/getUserReputation`, `mentorshipApi.getBadges`, `mentorMarketplaceApi.getAdminMentorFeedback` | `[NOT IN REDUX]` |
| `src/pages/admin/AdminProjects.jsx` (`256L`) | `projects` (all + deleted merged) | `useState` (`L41-46`) + `projectsApi.list({ status: 'all' })`, `projectsApi.list({ status: 'deleted' })` | `[NOT IN REDUX]` |
| `src/pages/admin/AdminProjectDetails.jsx` (`215L`) | `project`, `tasks`, `escrowSummary` | `useParams()` (`L15`), `useState` (`L18-30`) + `projectsApi.get`, `tasksApi.list`, `adminApi.getProjectEscrow` | `[NOT IN REDUX]` |
| `src/pages/admin/AdminMentorApps.jsx` (`800L`) | `applications`, `minYearsRequired`, toast | `useState` (`L160-179`) + `mentorApplicationsApi.list`, `adminApi.getPublicConfig`, `uploadsApi.downloadCv` | `[NOT IN REDUX]` |
| `src/pages/admin/MentorRevenue.jsx` (`285L`) | `sessions`, `stats`, `mentorMap`, `reconciliation` | `useState` (`L8-14`) + `mentorMarketApi.allSessions/adminStats/listMentors/reconcileEscrow` | `[NOT IN REDUX]` |
| `src/pages/admin/AuditLog.jsx` (`615L`) | `logs`, export feedback | `useSearchParams` (`L11`), `useState` (`L14-28`) + `adminApi.getAuditLog`, `adminApi.exportAuditLog` | `[NOT IN REDUX]` |
| `src/pages/admin/AdminReports.jsx` (`1723L`) | `reports`, `reportDetail`, `appeals`, `disputes`, `needsReviewSessions`, `ownerPatterns` | `storage.getAdminSession()` (`L16`), `useState` (`L39-97`) + `reportsApi`, `appealsApi`, `adminApi` | `[NOT IN REDUX]` |
| `src/pages/admin/AdminSupport.jsx` (`1102L`) | `tickets`, `total`, `totalPages`, `assignees`, `selectedTicket` | `storage.getAdminSession()` (`L33`), `useSearchParams` (`L31`), `useState` (`L51-84`) + `supportApi` | `[NOT IN REDUX]` |
| `src/pages/admin/SuperuserAdmins.jsx` (`365L`) | `admins` (portal admins list) | `useState` (`L159-166`) + `portalAdminsApi.list` (`L172`) | `[NOT IN REDUX]` |
| `src/pages/admin/SuperuserConfig.jsx` (`510L`) | `config`, `adminsCount`, `activeUsersCount`, `demoResetStatus`, `<ScheduledJobsPanel />` | `storage.getPlatformConfig()` (`L28`), `storage.getAdminSession()` (`L47`), `useState` (`L26-45`) + `portalAdminsApi.list`, `adminApi.getStats/getConfig/getDemoResetStatus` | `[NOT IN REDUX]` |
| `src/pages/admin/ScheduledJobsPanel.jsx` (`424L`) | `runs`, `selectedRun` | `useState` (`L9-15`) + `adminApi.getJobRuns(50)` (`L19`) via 15s poll | `[NOT IN REDUX]` |
| `src/pages/admin/EscrowFinancialsCard.jsx` (`119L`), `ProjectDetailsCard.jsx` (`220L`), `ProjectHeader.jsx` (`92L`), `TasksMilestonesCard.jsx` (`90L`), `TeamMembersCard.jsx` (`62L`) | Project, tasks, escrow summary, members | Props passed from `AdminProjectDetails.jsx` (`useState`) | `[NOT IN REDUX]` (via parent props) |

### 1H. Feature & Common Components

| Component(s) | Displayed Data Source(s) | Req 4 Flag |
|---|---|---|
| `ChatBox.jsx` (`419L`) | `messages` prop from parent workspace `useState`; self-manages report modal state + calls `communicationApi.reportMessage` (`L118`) | `[NOT IN REDUX]` |
| `DeleteProjectDialog.jsx` (`475L`) | Fetches `projectsApi.checkDeletion(projectId)` directly into local `useState` `checkResult` & calls `projectsApi.softDelete` (`L134`) | `[NOT IN REDUX]` |
| `FeedbackHistory.jsx` (`155L`) | `initialFeedback` prop or direct `feedbackApi.getEntityFeedback()` into local `useState` `history` (`L54`) | `[NOT IN REDUX]` |
| `JoinRequestCard.jsx` (`213L`), `MentorCard.jsx` (`140L`), `UserTrustCard.jsx` (`431L`), `StarterTaskPicker.jsx` (`223L`) | Presentational props from parent `useState` (`request`, `trustSummary`, mentor fields, templates) | `[NOT IN REDUX]` (via parent props) |
| `ProjectCard.jsx` (`539L`) | Props from parent `useState` **plus** direct `AuthContext` (`L57`) and `storage.getBackendUserId()` (`L62`) | `[NOT IN REDUX]` |
| `TaskCard.jsx` (`509L`) | Props from parent `useState` **plus** direct `AuthContext` (`L36`) | `[NOT IN REDUX]` |
| `UniversalReasonModal.jsx` (`515L`) | Fetches `feedbackApi.getFeedbackReasons()` (`module` cache -> local `useState` `configs` `L236`) | `[NOT IN REDUX]` |
| `ModerationModal.jsx` (`222L`) | User metadata props + direct `adminApi.warnUser/suspendUser/reactivateUser` (`L66-70`) | `[NOT IN REDUX]` |
| `UsernameConfirmationBanner.jsx` (`69L`) | `AuthContext.user` (`L7`), mutates via `usersApi.updateUsername` (`L21`) | `[NOT IN REDUX]` |
| `VerifyEmailBanner.jsx` (`124L`) | `AuthContext.user`/`isAuthenticated` (`L6`), `authApi.resendVerification` (`L37`) | `[NOT IN REDUX]` |
| `SuspendedAccountPanel.jsx` (`158L`) | `info` prop (from `Login`/`AdminLogin`/`Suspended`) | `[NOT IN REDUX]` (via parent props) |
| `RoleSyncProbe.jsx` (`33L`) | Dev DOM assertion reading `[data-active-role]` attributes on Navbar, Sidebar, Page | Pure DOM probe (verify active role matches store) |
| Pure presentational UI primitives (`Avatar`, `Badge`, `ConfirmModal`, `DataTable`, `DatePicker`, `EmptyState`, `ErrorBoundary`, `FilterTabs`, `FormInput`, `Modal`, `ProgressBar`, `QRCodeSvg`, `SafeLink`, `SearchBar`, `StatCard`, `TagInput`) | Local UI props/state only (`imgError`, calendar `isOpen`, `showConfirm`) | OK once callers pass Redux-selected props |

*(Total checked: All **96** source files accounted for. `pages/Auth/login.jsx` and `sinup.jsx` previously existed in early git history and were already removed prior to this branch, as verified in `steps/250` and `steps/307`.)*

---

## 2. Browser Storage, Cookies, Module Variables & In-Memory Caches

### 2A. Complete `localStorage` & `sessionStorage` Inventory

**Summary:** `src/utils/storage.js` defines **16 `localStorage` keys** (`LOCAL_KEYS`, `L1-18`) and **19 `sessionStorage` keys** (`SESSION_KEYS`, `L20-40`). Five additional files bypass `storage.js` to read/write `'teamforge_suspended_info'` directly in `sessionStorage`.

| Category (Prompt Checklist) | Exact Storage Key | Backing Store & File/Line | Purpose | Who Reads / Writes It | Req 7 Replacement (In-Memory Variable / Redux) |
|---|---|---|---|---|---|
| **Auth Token (User Access)** | *(Already in memory)* | `inMemoryAccessToken` in `services/apiClient.js:81` & `services/tokenManager.js:3` | JWT/Firebase Bearer token (`tokenExpiresAtMs` in `tokenManager.js:4`) | `apiClient.js`, `tokenManager.js`, `AuthContext.jsx` | Move/sync into Redux `sessionSlice` (`accessToken`, `expiresAtMs`) + mirror ref in `apiClient` interceptor *(note: `tokenManager.js` & `apiClient.js` duplicate `inMemoryAccessToken` today!)* |
| **Auth Token (User Refresh)** | `teamforge.refreshToken` (`LOCAL_KEYS.REFRESH_TOKEN`) | `localStorage` (`storage.js:14, 280-296`) | Stores backend opaque/JWT refresh token across reloads | Written by `tokenManager.setTokens` (`L55`), read by `tokenManager.getRefreshToken` (`L49`), `AuthContext.jsx:457` | **Delete from `localStorage`**. Backend `AuthService.setRefreshTokenCookie` (`auth.service.ts:238-245`) ALREADY sets `httpOnly` cookie `teamforge_refresh_token` on signup/login/refresh; call `POST /auth/refresh` with `{}` and `credentials: 'include'`. Optionally hold transient fallback in JS closure if legacy body-token needed without reload persistence. |
| **Auth Token (Admin Portal)** | `teamforge.adminToken` + legacy `adminToken` (`SESSION_KEYS.ADMIN_TOKEN`, `LEGACY_ADMIN_TOKEN`) | `sessionStorage` (`storage.js:22, 35, 146-226`) | Stores 24h portal admin/superuser JWT token | Written by `AdminLogin.jsx:66,88`; read by `AdminProtectedRoute.jsx:6`, `apiClient.js:209,713` | Redux `session.adminToken` (in-memory variable). **Resolved:** Backend `AdminService.login` / `AdminRefreshService` now sets an `httpOnly` `SameSite=Strict` (`Path=/admin/auth`) cookie (`teamforge_admin_refresh_token`) and `App.jsx` runs single-flight `restoreAdminSession()` (`POST /admin/auth/refresh`) on `/admin/*` so browser reload keeps portal admins signed in without Web Storage. |
| **Current User** | `teamforge.backendUserId` (`LOCAL_KEYS.BACKEND_USER_ID`), `teamforge.currentUser` (`L4`), `teamforge.userProfile` (`L5`), `teamforge.userProfile_` prefix (`L6`), `teamforge.uid`, `teamforge.userId`, `userId` (`SESSION_KEYS`) | `localStorage` (`L3-6`) & `sessionStorage` (`L28-29, 39`) (`storage.js`) | Backend UUID fallback before/after `AuthContext` hydration | Read/written in `AuthContext.jsx:69,371`, `NotificationContext.jsx:21,121`, `dashboard.jsx:68,71`, `profile.jsx:145`, `settings.jsx:213,820,914`, `AppliedProjects.jsx:33`, `ProjectsMarketplace.jsx:53`, `leaderboard.jsx:60`, `ProjectCard.jsx:62`, `apiClient.js:733` | Redux `session.user` (`state.session.user.id`). Remove `storage.getBackendUserId()` fallbacks completely. (`CURRENT_USER`/`USER_PROFILE*` keys are mostly leftover cleanup targets cleared by `clearUserSessionKeys()`.) |
| **Role & Admin Permissions** | `teamforge.role` (in BOTH `LOCAL_KEYS:11` & `SESSION_KEYS:21` + legacy `role` `L34`), `teamforge.portalRole`, `portalRole`, `teamforge.isSuperUser`, `isSuperUser`, `teamforge.adminEmail`, `teamforge.adminName`, `teamforge.adminPermissions`, `adminPermissions` | `localStorage` & `sessionStorage` (`storage.js:11,21-27,34-38`) | Stores active user role (`collaborator`/`project-owner`/`mentor`), admin portal role & permissions array, multi-tab `storage` event | `utils/roleStore.js` (`L32,132,155,176,212,239,255,265`), `AdminProtectedRoute.jsx:6`, `AdminLayout.jsx:27`, `AdminReports.jsx:16`, `AdminSupport.jsx:33`, `AdminUsers.jsx:62`, `SuperuserConfig.jsx:47`, `profile.jsx:504`, `apiClient.js:209,713` | Redux `session.activeRole`, `session.allowedRoles`, `session.portalRole`, `session.permissions`, `session.isSuperUser`. Remove `window.addEventListener('storage')` in `roleStore.js:265`. |
| **Theme** | `teamforge.theme` (`LOCAL_KEYS.THEME`) | `localStorage` (`storage.js:12, 90-96`) | Stores `'light'` vs `'dark'` mode | Read/written in `UIContext.jsx:82,93` | Redux `ui.theme` (default `'light'`), applied via CSS custom properties in an effect/listener. *(Or store server-side via `/users/me/settings` if persistence needed.)* |
| **Sidebar State** | *(Not in Web Storage)* | Component `useState(true)` in `UIContext.jsx:79` & `pages/layout.jsx:13` | Open/collapsed boolean for user sidebar | `layout.jsx` (`L13,18,48,52`) & unused in `UIContext.jsx` | Consolidate into Redux `ui.isSidebarOpen` (in-memory boolean). |
| **View State (Tabs, Filters, Search, Pagination)** | *(Not in Web Storage; some in URL)* | Local `useState` across 30+ pages + URL params (`AdminUsers`, `AdminSupport`, `AuditLog`, `ProjectsMarketplace`, `OwnedWorkspace`, `CollaboratorWorkspace`, `MentorProjectWorkspace`, `help.jsx`) | Active tabs (`tab`, `section`), status filters, search inputs, page numbers, modal open flags | Each page component individually | Keep shareable deep-link params (`?tab=`, `?ticket=`) synced from URL / Redux page `filters` UI state; other UI state moves to slice working state (resettable under Req 5). |
| **Drafts** | *(Not in Web Storage)* | Local `useState` in forms (`CreateProject`, `OwnedWorkspace` task/edit forms, `help`, `settings`, `ChatBox` input, `MentorApplication`, `AdminReports` notes) | Unsaved form text and file upload metadata | Local component state until submit | Controlled form inputs stay local until submit (or optional Redux slice draft if Req 5 clears on leave — see Step 3). |
| **Notification State** | `teamforge.notifications`, `teamforge.notificationSettings`, `teamforge.privacySettings` (`LOCAL_KEYS:7-9`) | Defined in `storage.js:7-9`, cleared on logout (`storage.js:322-324`), live state in `NotificationContext.jsx` `useState([])` | Live notifications come from `notificationsApi.list()` (legacy keys exist only in `LOCAL_KEYS` cleanup) | `NotificationContext.jsx`, `storage.js:322-324` | Redux `notifications` slice (`items`, `unreadCount`) populated by thunk from `/notifications` & `/communication/unread`; remove legacy storage keys. |
| **Language** | **Not found** | No key in `storage.js`, Context, or URL; hardcoded `languages: ['English']` in `MyMentorProfile.jsx:195` | Static default language on mentor profile submit | `MyMentorProfile.jsx:195` only | No translation state needed today; if added later, keep in `ui.language` (in memory). |
| **Boot / Config / Invites / Notices** | `teamforge.bootId` (`L2`), `teamforge.platformConfig` (`L10`), `teamforge.apiBaseUrl` (`L13`), `teamforge.invites` / `invites` / `runtime.invites` (`L15-17`), `teamforge.demoResetNotice`, `teamforge.serverRestartNotice`, `teamforge.accountDeletedNotice`, `teamforge.sessionEndedNotice` (`SESSION_KEYS:30-33`), plus unkeyed `'teamforge_suspended_info'` | `localStorage` (`storage.js:2,10,13,15-17,75-89,127-145,310`) & `sessionStorage` (`storage.js:30-33,244-308`, `apiClient.js:422`, `tokenManager.js:141`, `Login.jsx:50`, `AdminLogin.jsx:26`, `Suspended.jsx:18,43`) | Detects backend restarts (`X-Boot-Id`), caches platform limits, overrides API URL, cleans up legacy invites, passes post-redirect suspension/logout/reset banners | `apiClient.js`, `tokenManager.js`, `SuperuserConfig.jsx`, `AppliedProjects.jsx`, `Login.jsx`, `AdminLogin.jsx`, `Suspended.jsx`, `landingpage.jsx` | Store `bootId`, `platformConfig`, `apiBaseUrl` (from env/`window`), and flash notices (`sessionEndedNotice`, `serverRestartNotice`, `demoResetNotice`, `accountDeletedNotice`, `suspendedInfo`) in Redux `ui` / `platformConfig` / `session` state + `location.state`. Notice: across a **full browser reload**, flash banners set before `window.location.href = '/login'` will vanish unless navigation uses React Router `navigate('/login', { state })` instead of hard reload! |

### 2B. Cookies & Non-Storage Module Caches
1. **Cookies:** Front end has **zero** `document.cookie` or `indexedDB` reads/writes (`steps/270` scan confirmed 0 hits). Back end (`auth.service.ts:238-253`) sets/clears **`httpOnly` cookie `teamforge_refresh_token`** (`path: '/'`, `sameSite: 'lax'`), sent automatically by `fetch(..., { credentials: 'include' })` in `apiClient.js:345,664` and `tokenManager.js:100`.
2. **External Caches (Conflict with Requirement 4):**
   - `apiClient.js:284-286`: `apiGetCache` (`Map`, `DEFAULT_CACHE_TTL_MS = 20000`) returns `JSON.parse(JSON.stringify(cached.data))` at `L614`, bypassing the server & holding displayed data in a non-Redux module variable! Also `inFlightRequests` (`L285`) deduplicates concurrent identical GETs.
   - `feedbackApi.js:5-6`: `cachedReasonsConfig` & `pendingConfigRequest` module variables cache `/feedback/reasons` outside Redux.
   - `utils/roleStore.js:41-59`: Module singleton `state` + `listeners` (`Set`) read via `useSyncExternalStore`.
   - **Action under Req 4:** Replace `apiGetCache`, `cachedReasonsConfig`, and `roleStore` state with Redux slices (`actionFeedback.reasonsConfig`, `session.activeRole`, entity slices). (RTK `createAsyncThunk`'s `condition` option handles in-flight deduping natively!)

---

## 3. Data Fetching, Polling, Optimistic Updates, Events & Duplicate Fetches

### 3A. Every `*Api.js` Service Module (`24` files under `src/services/`)

| Service File | Endpoints Called | Trigger Style in Current App | Conflicting Module State / Events |
|---|---|---|---|
| `apiClient.js` (`770L`) | `/health`, `/auth/*` fallback refresh + HTTP transport | Called by all `*Api.js` | `apiGetCache`, `inFlightRequests`, `inMemoryAccessToken`, dispatches `teamforge:session_invalid` & `teamforge:maintenance`, writes `teamforge_suspended_info` |
| `tokenManager.js` (`226L`) | `POST /auth/refresh` | `focus` / `visibilitychange` listeners & pre-request check | Stores `refreshToken` in `localStorage`; dispatches `session_invalid`, `token_refreshed`, `account_suspended`, `force_logout` |
| `authApi.js` (`36L`) | `/health`, `/auth/signup`, `login`, `refresh`, `logout`, `logout-all`, `me`, `change-password`, `profile`, `resolve-identifier`, `forgot-password`, `reset-password`, `verify-email`, `resend-verification`, `/users/switch-role` | `AuthContext`, `Login`, `Signup`, `CompleteProfile`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `VerifyEmailBanner`, `roleStore` | None directly |
| `adminApi.js` (`173L`) | `/admin/login`, `users*`, `stats`, `audit*`, `config*`, `jobs/*`, `moderation-actions*`, `disputes*`, `projects/:id/escrow`, `reports/owner-patterns`, `system/demo-reset*`, `users/me/warnings`, **plus missing BE routes `mentor-sessions/needs-review` & `clear-review`** | Event handlers + `useEffect` in `App`, `Admin*`, `ScheduledJobsPanel`, `CreateProject`, `MentorApplication`, `notifications` | None directly |
| `appealsApi.js` (`19L`) | `/warnings/:id/appeal`, `/users/me/appeals`, `/admin/appeals*` | `notifications`, `AdminReports` | None |
| `communicationApi.js` (`57L`) | `/communication/messages/project/:id`, `messages`, `notifications`, `notifications/:id/read`, `unread`, `projects/:id/read`, `messages/:id/report` | 6s/60s `useVisibilityPoll` + `useEffect` + send/report handlers | None (`ChatBox`, workspaces dispatch `teamforge:chat_read`) |
| `feedbackApi.js` (`65L`) | `/feedback/reasons`, `/feedback` | `UniversalReasonModal`, `FeedbackHistory`, `CollaboratorWorkspace`, `MentorRequests` | Module cache `cachedReasonsConfig` & `pendingConfigRequest` |
| `gamificationApi.js` (`37L`) | `/gamification/:userId/ledger` (+ unused `getLeaderboard`/`getUserStats` wrappers) | `profile.jsx` | None |
| `joinRequestsApi.js` (`58L`) | `/join-requests*` (`list`, `get`, `getMyRequests`, `create`, `update`, `respond`, `remove`) | `ProjectsMarketplace`, `AppliedProjects`, `MyWork`, `OwnedWorkspace`, `OwnerDashboard`, `profile` | Triggers `ProjectsMarketplace` / `OwnedWorkspace` manual reloads |
| `leaderboardApi.js` (`29L`) | `/leaderboard`, `/leaderboard/:userId` | `leaderboard.jsx` (`useEffect` + `teamforge:task_updated` + `focus`) | None |
| `mentorApplicationsApi.js` (`73L`) | `/mentor-applications*`, `/mentor-applications/digilocker/*` | `MentorApplication`, `AdminMentorApps`, `RoleContext` | None |
| `mentorMarketplaceApi.js` (`283L`) | `/mentor-marketplace/mentors*`, `/mentor-marketplace/sessions*`, `/mentor-marketplace/mentored-projects`, `/mentor-sessions/:id/*`, `/mentor/abandonment-reviews/*`, `/projects/:id/mentor/abandonment-review`, `/admin/abandonment-reviews/*`, `/admin/mentors/:id/feedback`, `/admin/disputes*`, `/admin/projects/:id/escrow`, `/admin/escrow/reconcile` | `MentorsDirectory`, `MentorRequests`, `MentoredProjects`, `MentorEarnings`, `MyMentorProfile`, `OwnedWorkspace`, `dashboard`, `AdminReports`, `AdminUserDetails`, `MentorRevenue` | Generates/forwards `Idempotency-Key` header on booking/payment |
| `mentorRequestsApi.js` (`45L`) | `/mentor-requests*` | `MentoredProjects.jsx:64` (legacy fallback read) | None |
| `mentorshipApi.js` (`18L`) | `/mentorship/badge`, `/mentorship/badges/:userId`, `/mentorship/badges/project/:projectId` | `MentorProjectWorkspace`, `dashboard`, `profile`, `AdminUserDetails` | None |
| `notificationsApi.js` (`63L`) | `/notifications*` | `NotificationContext` | Dispatches `teamforge:notification_updated` (`L28,40,57`) |
| `portalAdminsApi.js` (`22L`) | `/portal-admins*` | `SuperuserAdmins`, `SuperuserConfig` | None |
| `projectsApi.js` (`332L`) | `/projects*`, `/invites*`, `/leave-requests*`, `/users/me/invites`, `/admin/projects/:id/close`, `/admin/projects/:id/restore` | 15+ pages & `DeleteProjectDialog` | Dispatches `teamforge:project_updated` & `teamforge:task_updated` **21 times** (`L59-326`) |
| `reportsApi.js` (`40L`) | `/reports*`, `/admin/reports*` | `help`, `AdminLayout`, `AdminDashboard`, `AdminReports` | `AdminReports` dispatches `teamforge:report_updated` |
| `supportApi.js` (`67L`) | `/support*`, `/support/tickets*`, `/admin/support/*` | `help`, `AdminSupport` | None |
| `tasksApi.js` (`90L`) | `/tasks*` | `AdminProjectDetails`, `CollaboratorWorkspace`, `MyWork`, `OwnedWorkspace`, `OwnerDashboard`, `MentorProjectWorkspace`, `profile` | Dispatches `teamforge:task_updated` **6 times** (`L37-84`) |
| `trustApi.js` (`20L`) | `/users/me/trust`, `/users/:id/trust`, `/users/trust-summaries` | `profile`, `MentorsDirectory`, `OwnedWorkspace`, `AdminUsers` | Batch limit capped at 50 IDs |
| `uploadsApi.js` (`51L`) | `/uploads/cv`, `/uploads/cv/:filename`, `/uploads/task-proof`, `/uploads/avatar`, `/uploads/resource`, `/uploads` | `MentorApplication`, `AdminMentorApps`, `settings` *(task-proof/resource unused)* | Multipart `FormData` / `Blob` download |
| `usersApi.js` (`66L`) | `/users/me*`, `/users/username-available`, `/users/:id*` | `dashboard`, `profile`, `settings`, `CompleteProfile`, `help`, `OwnedWorkspace`, `ProjectsMarketplace` | None |
| `firebase.js` (`55L`) | Firebase SDK auth helpers | `AuthContext`, `Login`, `Signup`, `AdminLogin`, `ForgotPassword`, `ResetPassword`, `settings` | External Firebase SDK singleton |

### 3B. Polling Timers & Cleanup Audit

| Location | Interval | Trigger / Hook | Pause on Hidden Tab & Cleanup? | Target Under Redux |
|---|---:|---|---|---|
| `navbar.jsx:72` | `60,000 ms` | `useVisibilityPoll(loadUnread, 60000)` (`communicationApi.getUnread()`) | **Yes** (stops on `teamforge:stop_polls`, clears interval, skips when `document.hidden`) | `chatMessages/fetchUnreadCounts` thunk gated on authenticated session |
| `NotificationContext.jsx:68` | `300,000 ms` | `setInterval` + throttled `focus` / `visibilitychange` + `notification_updated` event | **Yes** (`!document.hidden`, `clearInterval` on unmount and `teamforge:stop_polls`) | Move into app-level `NotificationsPoller` / `store` listener dispatching `notifications/fetchNotifications` |
| `pages/dashboard.jsx:170` | `12,000 ms` | Raw `setInterval(() => loadDashboardData(true), 12000)` + 3 DOM events | Partial (`clearInterval` on unmount & `stop_polls`, **checks `!document.hidden`**, still triggers multi-API waterfall every 12s) | Convert to `useVisibilityPoll` dispatching thunks (or skip if Req 5 keeps slice active only while mounted) |
| `pages/admin/ScheduledJobsPanel.jsx:30` | `15,000 ms` | `useVisibilityPoll(fetchRuns, 15000)` (`adminApi.getJobRuns(50)`) | **Yes** (`useVisibilityPoll` cleanup & hidden check) | Dispatch `jobRuns/fetchJobRuns` thunk while mounted on `/admin/su-config` |
| `pages/collaborator/CollaboratorWorkspace.jsx:166` | `6,000 ms` | `useVisibilityPoll(pollCollabChat, 6000)` (`enabled: activeTab === 'chat' && !chatForbidden`) | **Yes** (only polls when `chat` tab active & visible) | Dispatch `chatMessages/fetchProjectMessages` + `markProjectChatRead` while chat tab open |
| `pages/owner/OwnedWorkspace.jsx:386` | `6,000 ms` | `useVisibilityPoll(pollOwnerChat, 6000)` (`enabled: activeTab === 'chat'`) | **Yes** | Dispatch `chatMessages/fetchProjectMessages` + `markProjectChatRead` while chat tab open |
| `pages/mentor/MentorProjectWorkspace.jsx:138` | `6,000 ms` | `useVisibilityPoll(pollMentorChat, 6000)` (`enabled: activeTab === 'chat' && !chatForbidden`) | **Yes** | Dispatch `chatMessages/fetchProjectMessages` + `markProjectChatRead` while chat tab open |
| Countdown UI timers (`VerifyEmailBanner.jsx:15`, `ForgotPassword.jsx:41`, `MentorsDirectory.jsx:240`, `settings.jsx:348,360`) | `1,000 ms` | UI cooldown/OTP/payment expiry countdown `setInterval` | **Yes** (`clearInterval` on unmount / expiry) | Pure UI countdown state (local or derived from server `paymentExpiresAt` / `expiresAt` ISO timestamp) |

### 3C. Optimistic Updates, Custom Event Bus & Duplicate Fetches
1. **Optimistic Updates:**
   - **Verified Bug in `NotificationContext.jsx:109-118`:** `markAsRead(id)` optimistically sets `isRead: true` BEFORE `await notificationsApi.markAsRead(id)`, and its `catch` block **only logs to console without rolling back state!** Under Redux, optimistic updates must snapshot previous state in `.pending` and explicitly roll back in `.rejected`.
2. **Custom DOM Event Bus (`13` `teamforge:*` events replacing proper shared state):**
   - `teamforge:project_updated`, `teamforge:task_updated`, `teamforge:notification_updated`, `teamforge:chat_read`, `teamforge:report_updated`, `teamforge:mentor_status_updated`, `teamforge:user_updated`, `teamforge:badge_awarded`, `teamforge:role_switched`, `teamforge:maintenance`, `teamforge:session_invalid`, `teamforge:token_refreshed`, `teamforge:account_suspended`, `teamforge:force_logout`, `teamforge:stop_polls` (15 distinct event names found across `App.jsx`, `navbar`, `AuthContext`, `NotificationContext`, `RoleContext`, `useVisibilityPoll`, `tokenManager`, `apiClient`, `projectsApi`, `tasksApi`, `notificationsApi`, `dashboard`, `leaderboard`, `AdminDashboard`, `AdminLayout`, `AdminReports`, `profile`, `settings`, and workspaces).
   - **Redux Replacement:** Mutations updating projects/tasks/reports/notifications/user update Redux slices directly via `extraReducers`, and polling/cross-slice invalidation uses thunk chaining or store middleware (`listenerMiddleware`) — **zero `window.dispatchEvent(new CustomEvent('teamforge:*'))`**.
3. **Duplicate / Redundant Fetches Across Components:**
   - `adminApi.getPublicConfig()` is independently fetched in **4 components**: `App.jsx:115`, `AdminMentorApps.jsx:211`, `MentorApplication.jsx:145`, `CreateProject.jsx:54`.
   - `feedbackApi.getFeedbackReasons()` is fetched independently in `UniversalReasonModal`, `CollaboratorWorkspace.jsx:85`, `MentorRequests.jsx:56` (currently mitigated only by non-Redux `feedbackApi.js:5` module cache).
   - `projectsApi.list()` is redundantly fetched across **9+ pages** (`dashboard`, `ProjectsMarketplace`, `AppliedProjects`, `MyWork`, `OwnerDashboard`, `MyProjects`, `MentorsDirectory`, `MentoredProjects`, `MentorRequests`, `profile`, `AdminProjects`), relying on `apiGetCache` (`20s` TTL) to avoid slow waterfalls.
   - `projectsApi.getMyInvites()` is fetched separately by both `ProjectsMarketplace.jsx:64` and `notifications.jsx:96`.
   - `reportsApi.getOpenCount()` is fetched by both `AdminLayout.jsx:40` and `AdminDashboard.jsx:29,64`.

---

## 4. Contexts & External Store Inventory

| Context / Store | File & Lines | Values Exposed | Exact Consumer Count | Replaced By in Redux |
|---|---|---|---|---|
| `AuthContext` | `src/context/AuthContext.jsx` (`559L`) | `user`, `token`, `loading`, `status`, `isAuthenticated`, `login()`, `signup()`, `logout()`, `updateUser()`, `refreshUser()`, `refreshToken()`, `getToken()` | **25 component/page/guard files** (plus App & 3 sibling contexts = **29 total files** in `steps/209`) | `sessionSlice` (`user`, `accessToken`, `expiresAtMs`, `authStatus`, `authMode`) + thunks (`loginUser`, `signupUser`, `restoreSession`, `refreshUserProfile`, `logoutUser`) + selectors (`selectIsAuthenticated`, `selectCurrentUser`) |
| `RoleContext` + `roleStore` | `src/context/RoleContext.jsx` (`163L`) + `src/utils/roleStore.js` (`301L`) | `activeRole` (`currentRole`), `allowedRoles` (`availableRoles`), `status`, `switchRole()`, `setActiveRole()`, `isMentorApproved`, `mentorAppStatus`, `homePath`, `refreshMentorStatus()` | `RoleContext`: **4 UI files** (`navbar`, `leaderboard`, `MentorApplication`, `App`); `useActiveRole` (`roleStore`): **9 UI/guard files** (`navbar`, `sidebar`, `dashboard`, `MentorsDirectory`, `layout`, `MentorProtectedRoute`, `OwnerProtectedRoute`, `RoleContext`, `App`) | Fold active role into `sessionSlice` (`activeRole`, `allowedRoles`) + `mentorApplicationsSlice.myApplication` (`mentorAppStatus`, `isMentorApproved` selector) + `switchRoleThunk` (calls `authApi.switchRole`) |
| `NotificationContext` | `src/context/NotificationContext.jsx` (`151L`) | `notifications`, `unreadCount`, `addNotification()`, `markAsRead()`, `markAllAsRead()`, `refreshNotifications()` | **4 UI files + `App.jsx`**: `navbar.jsx`, `dashboard.jsx`, `OwnerDashboard.jsx`, `notifications.jsx` | `notificationsSlice` (`items` via `entityAdapter`, `status`, `error`, derived `selectUnreadCount`, thunks `fetchNotifications`, `markNotificationRead`, `markAllNotificationsRead`) |
| `UIContext` | `src/context/UIContext.jsx` (`112L`) | `isSidebarOpen`, `toggleSidebar()`, `theme`, `setTheme()`, `toggleTheme()` | **2 files** (`App.jsx` provider, `settings.jsx` reads `theme`/`setTheme`; `layout.jsx` duplicates `isSidebarOpen`!) | `uiSlice` (`theme`, `isSidebarOpen`, `maintenanceMode`, `maintenanceMessage`, flash notices) + CSS variable subscriber in `App.jsx` |

---

## 5. Cross-Page State vs. Single-Page State Classification

| Scope | State Data | Rationale |
|---|---|---|
| **Cross-Page Global State** *(Must survive route navigation)* | Authenticated `user`, `accessToken` / admin portal token, `activeRole`, `allowedRoles`, `portalRole`, `isSuperUser`, `permissions`, `notifications` & `unreadCount`, `chatUnread` counts (`communication/unread`), `platformConfig.public` (`maintenanceMode`, capacity & experience limits), `ui.theme`, `ui.isSidebarOpen`, flash notices (`sessionEnded`, `suspendedInfo`, `demoReset`), feedback reasons dictionary (`actionFeedback.reasonsConfig`) | Used continuously across navbar, sidebar, route guards, badges, and global interceptors while user navigates across routes. |
| **Multi-Page Shared Domain Entities** *(Candidates for entity slices — see Step 3 Req 5 analysis)* | `projects`, `tasks`, `joinRequests`, `projectInvites`, `leaveRequests`, `mentorProfiles`, `mentorSessions`, `mentorApplications`, `reports`, `appeals`, `warnings`, `users` (trust summaries/directory), `supportTickets`, `portalAdmins` | Edited on one page (e.g., workspace/modal) and immediately reflected on dashboards/lists (`MyProjects`, `MyWork`, `AdminDashboard`, `notifications`). |
| **Single-Page Working & Form State** | Local controlled form inputs, active tab (`activeTab`), search query strings, filter dropdowns (`filter`, `statusFilter`, `repTypeFilter`), pagination page numbers, open/closed modals & confirmation drawers, transient toast messages, selected row (`selectedTicket`, `selectedAppeal`), temporary UPI checkout countdown & `idempotencyKey` | Scoped cleanly to a single page lifecycle (or page-working substate reset on navigation under Requirement 5). |
