# Phase 13 Display Audit (`src/pages/**`)

> **Requirement 4 & 8 Verification:** All server-derived entities, lists, counts, balances, permissions, and notifications displayed in `src/pages/**` come from Redux store selectors (`useSelector` / `useSafeStoreSelector`). Local React `useState` is restricted strictly to controlled form keystroke drafts, transient modal open/close toggles, ephemeral UI feedback strings, search autocomplete dropdown input, and the documented Decision D8 unwired backend stub (`needs-review`).

---

## 1. Phase 13 Audit Fixes Applied

During the Phase 13 line-by-line `useState(` audit across all `46` page files under `src/pages/`, six remaining pages were refactored so zero server entities/metrics reside in component `useState`:

| Page File | Removed Local Server `useState` | Replacement Redux Selectors (`useMemo` + `useSelector`) |
|---|---|---|
| `src/pages/dashboard.jsx` | `dashboardData`, `stats`, `latestBadge`, `userActions` | `selectCurrentUser`, `selectOwnProfile`, `selectAllProjects`, `selectUserBadges(state, userId)`, `selectAllNotifications`, `selectMyOpenAbandonmentReviews`, `selectAbandonmentConfirmingIds`, `selectActiveRole` |
| `src/pages/owner/OwnerDashboard.jsx` | `ownedProjects`, `activeProjectsCount`, `tasksByProject`, `pendingRequestsCount`, `totalCollaborators`, `totalTasksCount`, `ownerActions` | `selectCurrentUser`, `selectAllProjects`, `selectAllJoinRequests`, `selectTasksMapByProject`, `selectAllNotifications` |
| `src/pages/profile.jsx` | `profileData` | `selectOwnProfile`, `selectAllProjects`, `selectTasksMapByProject`, `selectAllJoinRequests`, `selectUserBadges(state, resolvedUserId)`, `selectAllReputationEntries`, `selectReputationTotal`, `selectMyTrust`, `selectUserGamificationLedger` |
| `src/pages/mentor/MentorProjectWorkspace.jsx` | `project`, `tombstoneData`, `awardedMembers` (`Set`) | `selectProjectById(state, projectId)`, `selectProjectTombstoneById(state, projectId)`, `selectProjectBadges(state, projectId)`, `selectTasksByProjectId`, `selectMessagesByProjectId` |
| `src/pages/owner/CreateProject.jsx` | `maxCapacityLimit` | `selectPublicConfig(state)?.maxCollaboratorsPerProject \|\| 20` |
| `src/pages/collaborator/ProjectsMarketplace.jsx` | `ownerResponseTimes` | `selectResponseTimeMap(state)` |

---

## 2. Complete Page-by-Page Displayed Server Data Inventory

### 2.1 Public, Auth & Core Shell Pages (`src/pages/*.jsx`)

| Page | Displayed Server Values | Supplying Redux Selector(s) |
|---|---|---|
| `src/pages/landingpage.jsx` | Session/account deletion & demo reset notices | `selectSessionNotices` |
| `src/pages/layout.jsx` | Current user identity, auth status/loading, active role, sidebar open state | `selectSidebarOpen`, `selectAuthStatus`, `selectCurrentUser`, `selectAuthLoading`, `selectActiveRole` |
| `src/pages/Login.jsx` | Suspension details panel & flash notices (`sessionEnded`, `serverRestart`, `demoReset`, `accountDeleted`) | `selectSuspendedInfo`, `selectSessionNotices` *(email/password inputs kept local)* |
| `src/pages/Signup.jsx` | Session error / auth redirect on success | Reads session via `sessionThunks/signupSessionUser` *(email/password inputs kept local)* |
| `src/pages/CompleteProfile.jsx` | Prefilled user profile status (`profileComplete`), loading/auth state | `selectCurrentUser`, `selectIsAuthenticated`, `selectAuthLoading`, `selectAuthStatus` *(draft fields & username check UI local)* |
| `src/pages/ForgotPassword.jsx` | Auth guard redirect | `selectIsAuthenticated` *(reset identifier form kept local)* |
| `src/pages/ResetPassword.jsx` | Auth guard redirect | `selectIsAuthenticated` *(password reset form kept local)* |
| `src/pages/VerifyEmail.jsx` | Logged-in user record updated on verification | `selectCurrentUser` |
| `src/pages/Suspended.jsx` | Suspension reason, moderator message, timestamp, support contact | `selectSuspendedInfo` |
| `src/pages/NotFound.jsx` | Static 404 route fallback | N/A (static page) |
| `src/pages/ProjectTombstone.jsx` | Deleted project title, scheduled purge metadata | `selectProjectTombstoneById`, `selectProjectById` |
| `src/pages/dashboard.jsx` | Welcome name, XP, reputation, active projects count, completed tasks count, mentor recommendation badges, abandonment alerts, recent notifications/activity feed | `selectCurrentUser`, `selectOwnProfile`, `selectAllProjects`, `selectUserBadges`, `selectAllNotifications`, `selectMyOpenAbandonmentReviews`, `selectAbandonmentConfirmingIds`, `selectActiveRole` |
| `src/pages/notifications.jsx` | Filtered notifications, unread badge count, project invitations, user warnings, warning appeals | `selectFilteredNotifications`, `selectUnreadNotificationsCount`, `selectNotificationWorking`, `selectMyInvites`, `selectInviteActingIds`, `selectMyAppeals`, `selectMyWarnings`, `selectAppealsWorking` |
| `src/pages/profile.jsx` | Profile header (name, bio, avatar, university, phone, joined date), mentor badge, trust summary / XP & stats cards, active/completed/mentored projects, reputation ledger, contribution history | `selectCurrentUser`, `selectIsSuperUser`, `selectAdminPermissions`, `selectOwnProfile`, `selectAllProjects`, `selectTasksMapByProject`, `selectAllJoinRequests`, `selectReputationWorking`, `selectAllReputationEntries`, `selectReputationTotal`, `selectMyTrust`, `selectUserGamificationLedger`, `selectUserBadges` |
| `src/pages/leaderboard.jsx` | Ranked leaderboard rows, active tab/period filters, loading/error banner, user XP & reliability/standing rank | `selectCurrentUser`, `selectActiveRole`, `selectGamificationWorking`, `selectLeaderboardEntries`, `selectLeaderboardForTab`, `selectGamificationStatus`, `selectGamificationError` |
| `src/pages/settings.jsx` | Saved user profile (`fullName`, `username`, `email`, `phone`, `phoneVerified`, `skills`), email digest settings, theme, data export jobs/download state, account deletion blockers | `selectCurrentUser`, `selectTheme`, `selectLatestDataExport`, `selectDataExportsWorking`, `selectDeletionCheck`, `selectDeletionBlockersSummary`, `selectSettingsWorking` *(keystroke drafts & OTP modal kept local per D6 / Phase 12)* |
| `src/pages/help.jsx` | My submitted support tickets, selected thread + replies, My submitted user reports, submission errors/email-verified blocker | `selectCurrentUser`, `selectMySupportTickets`, `selectMyTicketsStatus`, `selectSelectedMyTicket`, `selectSupportTicketsWorking`, `selectReportsWorking`, `selectMyReports`, `selectMyReportsStatus` *(ticket/report keystroke inputs & combobox dropdown kept local)* |

### 2.2 Collaborator Pages (`src/pages/collaborator/*.jsx`)

| Page | Displayed Server Values | Supplying Redux Selector(s) |
|---|---|---|
| `src/pages/collaborator/ProjectsMarketplace.jsx` | Recommended & catalog projects, skill match score, join request / invite control state, owner response times | `selectCurrentUser`, `selectMarketplaceProjects`, `selectProjectsStatus`, `selectProjectsWorking`, `selectProjectById`, `selectProjectSkillMatch`, `selectProjectMatchStatus`, `selectMyJoinRequests`, `selectMyInvites`, `selectResponseTimeMap` |
| `src/pages/collaborator/AppliedProjects.jsx` | Collaborator's submitted join requests, project titles/metadata, application status | `selectCurrentUser`, `selectMyJoinRequests`, `selectMyJoinRequestsStatus`, `selectAllProjects` |
| `src/pages/collaborator/MyWork.jsx` | Ongoing vs completed projects, server summary counts, project tasks | `selectCurrentUser`, `selectMyWorkOngoingProjects`, `selectMyWorkCompletedProjects`, `selectMyWorkStatus`, `selectProjectSummaryCounts`, `selectProjectsWorking`, `selectAllProjects` / `selectProjectById`, `selectTasksMapByProject` |
| `src/pages/collaborator/CollaboratorWorkspace.jsx` | Project details/tombstone, team/tasks board, unassign feedback reasons, leave request status/cooldown, project chat messages & 403 member guard | `selectCurrentUser`, `selectProjectById`, `selectProjectTombstoneById`, `selectMyLeaveRequestByProject`, `selectLeaveRequestError` (`state.leaveRequests`), `selectProjectDetailStatus`, `selectTasksByProjectId`, `selectTasksForbiddenForProject`, `selectReasonOptionsByCategory`, `selectMessagesByProjectId`, `selectIsSendingMessage`, `selectIsChatForbidden`, `selectChatForbiddenMessage` |

### 2.3 Project Owner Pages (`src/pages/owner/*.jsx`)

| Page | Displayed Server Values | Supplying Redux Selector(s) |
|---|---|---|
| `src/pages/owner/OwnerDashboard.jsx` | Active projects count, total collaborators, pending requests count, total tasks, recent activity, owned project cards + progress | `selectCurrentUser`, `selectAllNotifications`, `selectAllProjects`, `selectAllJoinRequests`, `selectTasksMapByProject` |
| `src/pages/owner/CreateProject.jsx` | Platform max capacity limit (`maxCapacityLimit`), category starter task templates, creation status/errors | `selectCurrentUser`, `selectProjectsWorking`, `selectCreateProjectStatus`, `selectPublicConfig` *(form inputs kept local)* |
| `src/pages/owner/MyProjects.jsx` | Owner's all / active / completed / closed projects, deletion schedules | `selectCurrentUser`, `selectMyProjectsBuckets`, `selectMyProjectsStatus`, `selectProjectsWorking` |
| `src/pages/owner/OwnedWorkspace.jsx` | Project details/tombstone, removal blockers, tasks board & forbidden flag, join requests & combined request/invite list + filter counts, invite send status, bulk trust summaries, pending leave requests, chat messages, mentor abandonment state | `selectCurrentUser`, `selectProjectById`, `selectProjectTombstoneById`, `selectProjectRemovalChecks`, `selectProjectDetailStatus`, `selectTasksByProjectId`, `selectTasksForbiddenForProject`, `selectJoinRequestsByProjectId`, `selectCombinedRequestsByProjectId`, `selectCombinedRequestItemsByProjectId`, `selectRequestStatusFilter`, `selectMembersSubSection`, `selectMessagesByProjectId`, `selectIsSendingMessage`, `selectIsChatForbidden`, `selectChatForbiddenMessage`, `selectInvitesSendStatus`, `selectTrustSummariesMap`, `selectLeaveRequestsByProject`, `selectLeaveProcessingIds`, `selectAbandonmentReviewByProject`, `selectAbandonmentWorking`, `selectIsAbandonmentReporting` |
| `src/pages/owner/MentorsDirectory.jsx` | Verified mentor directory cards, owned projects dropdown, booking/payment/session states, checkout idempotency + server money totals (`subtotal`, `platformFee`, `total`, `escrow`), mentor trust summaries, dispute/feedback submission errors | `selectCurrentUser`, `selectAllowedRoles`, `selectAllDirectoryMentors`, `selectMentorsListStatus`, `selectMentorProfilesWorking`, `selectAllProjects`, `selectMySessions`, `selectMySessionsStatus`, `selectMentorSessionsWorking`, `selectSessionFeedbackSubmitting`, `selectSessionFeedbackWorking`, `selectPaymentCheckout`, `selectCheckoutDisplayTotals`, `selectPaymentsWorking`, `selectSessionDisputesWorking`, `selectTrustSummariesMap` |

### 2.4 Mentor Pages (`src/pages/mentor/*.jsx`)

| Page | Displayed Server Values | Supplying Redux Selector(s) |
|---|---|---|
| `src/pages/mentor/MentorApplication.jsx` | Current mentor application status, approval flag, server min experience years, re-apply cooldown timer, uploaded CV metadata, DigiLocker sync state | `selectCurrentUser`, `selectIsMentorApproved`, `selectMentorAppStatus`, `selectMyMentorStatusData`, `selectMyMentorApplication`, `selectMyApplicationLoadStatus`, `selectMinYearsRequired`, `selectMyMentorCooldownInfo`, `selectMentorCvState`, `selectDigiLockerState`, `selectMentorApplicationsWorking` *(keystroke inputs & local `File` kept local until submit)* |
| `src/pages/mentor/MyMentorProfile.jsx` | Saved mentor profile fields (`title`, `bio`, `skills`, `experienceYears`, `sessionPrice`, `isAvailable`, `maxActiveMentees`), profile existence flag, saving status, toast feedback | `selectCurrentUser`, `selectMyMentorProfile`, `selectHasExistingMentorProfile`, `selectMyMentorProfileStatus`, `selectIsSavingMentorProfile`, `selectMentorProfilesWorking`, `selectToasts` *(form inputs kept local until Save per Phase 8 Step 3)* |
| `src/pages/mentor/MentorRequests.jsx` | Incoming mentorship session requests, project titles/metadata, accept/decline processing flags, server decline reasons catalog | `selectMentorViewSessions`, `selectMentorViewSessionsStatus`, `selectAllProjects`, `selectSessionProcessingIds`, `selectMentorSessionsWorking`, `selectReasonOptionsByCategory` |
| `src/pages/mentor/MentoredProjects.jsx` | Server-provided `All` / `Active` / `Completed` mentored project lists & counts, open abandonment review banners & confirming flags | `selectCurrentUser`, `selectFilteredMentoredProjects`, `selectMentoredProjectsCounts`, `selectMentoredFilter`, `selectMentoredProjectsStatus`, `selectMyOpenAbandonmentReviews`, `selectAbandonmentConfirmingIds` |
| `src/pages/mentor/MentorEarnings.jsx` | Mentor session payout ledger, server-calculated money totals (`totalEarned`, `pendingEscrow`, `released`, `refunded`), dispute submission status | `selectMentorViewSessions`, `selectMentorViewSessionsStatus`, `selectMentorEarningsTotals`, `selectSessionDisputesWorking` |
| `src/pages/mentor/MentorProjectWorkspace.jsx` | Project details/tombstone, project tasks, project chat messages, issued recommendation badges per member | `selectCurrentUser`, `selectProjectById`, `selectProjectTombstoneById`, `selectProjectBadges`, `selectTasksByProjectId`, `selectMessagesByProjectId`, `selectIsSendingMessage`, `selectIsChatForbidden`, `selectChatForbiddenMessage` |

### 2.5 Admin & Superuser Pages (`src/pages/admin/*.jsx`)

| Page | Displayed Server Values | Supplying Redux Selector(s) |
|---|---|---|
| `src/pages/admin/AdminLayout.jsx` | Permission-filtered navigation sections (`canAccess`), superuser visibility, open reports count badge | `selectOpenReportsCount`, `selectSession`, `selectIsSuperUser` |
| `src/pages/admin/AdminLogin.jsx` | Suspended banner & portal logout/demo-reset notices | `selectSuspendedInfo`, `selectSessionNotices` |
| `src/pages/admin/AdminDashboard.jsx` | KPI stats, open reports count, recent audit events | `selectOpenReportsCount`, `selectDashboardStats`, `selectDashboardStatsStatus`, `selectAllAuditLogs`, `selectRecentAuditEvents`, `selectAuditLogStatus` |
| `src/pages/admin/AdminUsers.jsx` | User directory table, duplicate account groups, bulk trust summaries, pending second-approval moderation queue, self-approval lock (`storeAdminUid`) | `selectAllAdminUsers`, `selectAdminDuplicateGroups`, `selectAdminTrustSummaries`, `selectAdminUsersStatus`, `selectAdminUsersError`, `selectAdminUsersWorking`, `selectAllModerationActions`, `selectModerationWorking`, `selectCurrentAdminUid`, `selectSession` |
| `src/pages/admin/AdminUserDetails.jsx` | Full user detail record, moderation history, reputation ledger entries & paginated totals, mentor feedback history, active warnings count | `selectAdminUserDetailsById(id)`, `selectAdminUsersWorking`, `selectAdminUserReputationById(id)`, `selectMentorFeedbackByUserId`, `selectUserActiveWarningsCount(id)` |
| `src/pages/admin/AdminProjects.jsx` | Active & soft-deleted admin project table, loading/error state | `selectAllAdminProjects`, `selectAdminProjectsStatus`, `selectAdminProjectsError`, `selectAdminProjectsWorking` |
| `src/pages/admin/AdminProjectDetails.jsx` | Full admin project record, escrow & financials breakdown (`EscrowFinancialsCard`), project tasks (`TasksMilestonesCard`), team roster (`TeamMembersCard`) | `selectAdminProjectById(id)`, `selectAdminProjectEscrowById(id)`, `selectTasksByProjectId(state, id)`, `selectAdminProjectsWorking` |
| `src/pages/admin/AdminMentorApps.jsx` | Mentor application queue, public min-experience rule, approval/rejection status | `selectAdminMentorApplications`, `selectMentorApplicationsListStatus`, `selectMentorApplicationsListError`, `selectMentorApplicationsWorking`, `selectPublicConfig` |
| `src/pages/admin/AdminReports.jsx` | Portal permissions, user reports queue & selected details, user warning appeals, escrow disputes, owner rejection patterns *(unwired `/admin/mentor-sessions/needs-review` uses 404-tolerant fallback per Decision D8)* | `selectSession`, `selectAdminReports`, `selectAdminReportsStatus`, `selectReportsWorking`, `selectAdminAppeals`, `selectAdminAppealsStatus`, `selectAppealsWorking`, `selectAllSessionDisputes`, `selectSessionDisputesStatus`, `selectSessionDisputesWorking`, `selectOwnerPatterns`, `selectOwnerPatternsStatus` |
| `src/pages/admin/AdminSupport.jsx` | Portal permissions, paginated support tickets list, assignee dropdown, selected ticket drawer (public replies & internal notes), closure facts | `selectSession`, `selectAdminSupportTickets`, `selectSupportTotal`, `selectSupportTotalPages`, `selectAdminTicketsStatus`, `selectSupportAssignees`, `selectSelectedAdminTicket`, `selectSupportTicketsWorking` |
| `src/pages/admin/MentorRevenue.jsx` | All platform mentor sessions, server revenue metrics, mentor directory lookup, escrow reconciliation report | `selectAllSessionsAdmin`, `selectAllSessionsAdminStatus`, `selectAdminRevenueStats`, `selectAdminRevenueStatsStatus`, `selectAllDirectoryMentors`, `selectEscrowReconciliation`, `selectEscrowReconcileStatus` |
| `src/pages/admin/AuditLog.jsx` | All/filtered audit entries, distinct action types, URL-synced active filter chips & export status | `selectAllAuditLogs`, `selectFilteredAuditLogs`, `selectAuditTypes`, `selectAuditLogStatus`, `selectAuditFilters`, `selectAuditLogWorking` |
| `src/pages/admin/ScheduledJobsPanel.jsx` | Background job run history, manual tick run details, Super User guard | `selectAllJobRuns`, `selectJobRunsStatus`, `selectJobRunsWorking`, `selectSelectedJobRun`, `selectSession`, `selectIsSessionConfigured` |
| `src/pages/admin/SuperuserAdmins.jsx` | Portal admin roster, editing/delete targets, Super User guard | `selectAllPortalAdmins`, `selectPortalAdminsStatus`, `selectPortalAdminsError`, `selectPortalAdminsWorking`, `selectEditingPortalAdmin`, `selectErasePortalAdmin`, `selectSession`, `selectIsSessionConfigured` |
| `src/pages/admin/SuperuserConfig.jsx` | Stored platform config values, initial tenure, demo reset readiness, admin count & stats, Super User guard | `selectPlatformConfig`, `selectInitialTenure`, `selectDemoResetStatus`, `selectPlatformConfigWorking`, `selectAllPortalAdmins`, `selectDashboardStats`, `selectSession`, `selectIsSessionConfigured`, `selectIsSuperUser` |
| `AdminProjectDetails` subcards (`EscrowFinancialsCard.jsx`, `ProjectDetailsCard.jsx`, `ProjectHeader.jsx`, `TasksMilestonesCard.jsx`, `TeamMembersCard.jsx`) | Project fields, tasks, members, escrow breakdown | Props passed directly from `AdminProjectDetails.jsx` Redux selectors (with `ProjectDetailsCard.jsx` dispatch for project edit/restore/close) |
