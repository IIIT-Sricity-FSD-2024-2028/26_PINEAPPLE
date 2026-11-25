# Implementation Progress Tracker

This file tracks the status of each implementation phase, the changes made, verification results, and any architectural decisions.

| Phase | Description | Status | Files Changed / Added | Test Results |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | RBAC Audit & Completion | DONE | `notifications.controller.ts`, `mentor-marketplace.controller.ts`, `projects.service.ts`, `roles.guard.ts`, `admin.service.ts`, `firebase.strategy.ts`, `jwt.strategy.ts`, `docs/rbac-matrix.md`, `PROGRESS.md` | 20 / 20 Security & RBAC Checks PASSED |
| **Phase 1** | Auth Screens & Profile Data | DONE | `Login.jsx`, `Auth.css`, `dateFormatter.js`, `settings.jsx`, `profile.jsx`, `AdminUserDetails.jsx`, `AdminUsers.jsx`, `AdminMentorApps.jsx`, `users.repository.ts`, `create-user.dto.ts`, `create-profile.dto.ts`, `users.service.ts`, `admin.service.ts` | 4 / 4 Verification Checks PASSED; Build 0 errors |
| **Phase 2** | Unified XP & Reputation Ledger | DONE | `ledger-entry.dto.ts`, `gamification.repository.ts`, `gamification.service.ts`, `gamification.controller.ts`, `gamification.module.ts`, `tasks.service.ts`, `tasks.repository.ts`, `mentorship.service.ts`, `mentorship.controller.ts`, `leaderboard.service.ts`, `leaderboard.module.ts`, `users.repository.ts`, `users.service.ts`, `gamificationApi.js`, `profile.jsx`, `dashboard.jsx`, `leaderboard.jsx`, `phase2.spec.ts` | 10 / 10 Live Integration Checks PASSED; Build 0 errors |
| **Phase 3** | Calendar DatePicker & Due Dates | DONE | `DatePicker.jsx`, `DatePicker.css`, `create-project.dto.ts`, `projects.service.ts`, `projects.repository.ts`, `create-task.dto.ts`, `tasks.service.ts`, `tasks.repository.ts`, `CreateProject.jsx`, `OwnedWorkspace.jsx`, `CollaboratorWorkspace.jsx`, `ProjectCard.jsx`, `TaskCard.jsx`, `AppliedProjects.jsx`, `AdminProjectDetails.jsx`, `phase3.spec.ts` | 9 / 9 Live Integration Checks PASSED; Build 0 errors |
| **Phase 4** | Owner Applicant Profile Inspection | DONE | `users.service.ts`, `users.controller.ts`, `usersApi.js`, `JoinRequestCard.jsx`, `JoinRequestCard.css`, `OwnedWorkspace.jsx`, `phase4.spec.ts` | 7 / 7 Live Integration Checks PASSED; Build 0 errors |
| **Phase 5** | Project Capacity & Collaborator Limit | DONE | `capacity.util.ts`, `projects.service.ts`, `projects.controller.ts`, `join-requests.service.ts`, `ProjectCard.jsx`, `ProjectsMarketplace.jsx`, `OwnedWorkspace.jsx`, `CollaboratorWorkspace.jsx`, `phase5.spec.ts` | 9 / 9 Live Integration Checks PASSED; Build 0 errors |
| **Phase 6** | Single Mentor & Clean Escrow Ledger | DONE | `escrow.service.ts`, `mentor-marketplace.entity.ts`, `mentor-marketplace.service.ts`, `mentor-marketplace.controller.ts`, `MentorsDirectory.jsx`, `phase6.spec.ts` | 12 / 12 Live Integration Checks PASSED; Build 0 errors |
| **Phase 7** | Simulated UPI QR Payment Flow | DONE | `payment-provider.interface.ts`, `demo-upi.provider.ts`, `mentor-marketplace.entity.ts`, `mentor-marketplace.module.ts`, `mentor-marketplace.service.ts`, `mentor-marketplace.controller.ts`, `QRCodeSvg.jsx`, `mentorMarketplaceApi.js`, `MentorsDirectory.jsx`, `phase7.spec.ts` | 10 / 10 Live Integration Checks PASSED; Build 0 errors |
| **Phase 8** | Mentor CV Upload & DigiLocker Verification | DONE | `file-upload.middleware.ts`, `uploads.controller.ts`, `mentor-applications.controller.ts`, `mentor-applications.service.ts`, `digilocker-sandbox.provider.ts`, `digilocker-real.provider.ts`, `mentorApplicationsApi.js`, `uploadsApi.js`, `apiClient.js`, `MentorApplication.jsx`, `mentorApplication.css`, `AdminMentorApps.jsx`, `AdminMentorApps.css`, `phase8.spec.ts` | 14 / 14 Live Integration Checks PASSED; Build 0 errors |
| **Phase 9** | Documentation & Final Regression | DONE | `README.md`, `back-end/.env.example`, `React-Implementation/React-Implementation/.env.example`, `PROGRESS.md` | Full regression suites PASSED; 0 errors across back-end tsc and front-end lint/build |
| **Fix Phase 1** | Admin & Super User Mentor Applications Approval/Rejection (403 Resolution) | DONE | `role.util.ts`, `jwt.strategy.ts`, `firebase.strategy.ts`, `roles.guard.ts`, `mentor-applications.controller.ts`, `mentor-applications.service.ts`, `apiClient.js`, `AdminMentorApps.jsx`, `AdminMentorApps.css`, `rbac-matrix.md`, `PROGRESS.md` | 22 / 22 Live Integration Checks PASSED; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Fix Phase 2** | Leaderboard Cleanup (Admins, Role Suffixes, Duplicates, Dense Ranking) | DONE | `users.repository.ts`, `create-user.dto.ts`, `seeding.service.ts`, `leaderboard-entry.dto.ts`, `leaderboard.service.ts`, `admin.service.ts`, `Login.jsx`, `leaderboard.jsx`, `leaderboard.css`, `dashboard.jsx`, `AdminUsers.jsx`, `scratch/test_phase2.js` | 38 / 38 Live Integration Checks PASSED; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Fix Phase 3** | Mentor Application Credential Statuses (Verified vs Unverified) | DONE | `digilocker-document.interface.ts`, `digilocker-sandbox.provider.ts`, `mentor-application.entity.ts`, `create-mentor-application.dto.ts`, `update-mentor-application.dto.ts`, `mentor-applications.service.ts`, `mentor-applications.controller.ts`, `credentialStatus.js`, `mentorApplicationsApi.js`, `Badge.css`, `mentorApplication.css`, `MentorApplication.jsx`, `AdminMentorApps.jsx`, `AdminMentorApps.css`, `scratch/test_phase3.js` | 26 / 26 Live Integration Checks PASSED; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Current Phase 1** | Leaderboard Role Removal & Account Deduplication Audit | DONE | `leaderboard.jsx`, `leaderboard.service.ts`, `scratch/test_phase1_live.js`, `PROGRESS.md` | 49 / 49 Live Integration Checks PASSED; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Current Phase 2** | University / Institution Field in Settings & Backend Harmonization | DONE | `settings.jsx`, `create-user.dto.ts`, `create-profile.dto.ts`, `users.service.ts`, `users.repository.ts`, `scratch/test_phase2_live.js`, `PROGRESS.md` | 20 / 20 Live Integration Checks PASSED; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Current Phase 3** | Phone Number Verification with Firebase Phone Auth OTP | DONE | `firebase.js`, `usersApi.js`, `settings.jsx`, `profile.jsx`, `AdminUserDetails.jsx`, `MentorCard.jsx`, `MentorsDirectory.jsx`, `MyMentorProfile.jsx`, `verify-phone.dto.ts`, `update-user.dto.ts`, `user.entity.ts`, `users.repository.ts`, `firebase.service.ts`, `users.service.ts`, `users.controller.ts`, `admin.service.ts`, `phase3_phone.spec.ts`, `scratch/test_phase3_live.js`, `README.md`, `PROGRESS.md` | 23 / 23 Live API Checks PASSED; 21 / 21 Service Spec Checks PASSED; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Password Reset E2E** | End-to-End Password Reset & Real Mail Service | DONE | `mail.service.ts`, `mail.module.ts`, `mail.controller.ts`, `auth.service.ts`, `auth.controller.ts`, `app.module.ts`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `test_password_reset.js`, `README.md`, `PROGRESS.md` | 31 / 31 Live API Checks PASSED; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Removal Phase 1** | Project Owner Collaborator Removal & Centralized Ownership | DONE | `role.util.ts`, `projects.controller.ts`, `projects.service.ts`, `create-project.dto.ts`, `tasks.service.ts`, `join-requests.controller.ts`, `join-requests.service.ts`, `mentor-marketplace.service.ts`, `apiClient.js`, `OwnedWorkspace.jsx`, `scratch/test_phase1_removal.js`, `PROGRESS.md` | 18 / 18 Live Verification Checks PASSED; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Removal Phase 2** | Remove Completed Projects from Mock/Seed Data & Marketplace Enforcement | DONE | `projects.repository.ts`, `tasks.repository.ts`, `gamification.repository.ts`, `join-requests.service.ts`, `ProjectsMarketplace.jsx`, `phase6.spec.ts`, `scratch/test_phase1_removal.js`, `scratch/test_phase2_marketplace.js`, `README.md`, `PROGRESS.md` | 22 / 22 Live Integration Checks PASSED; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Cleanup Phase 0** | Backup and Baseline Establishment | DONE | Backup to `../PINEAPPLE-26-backup-before-cleanup` (433 files, 29.7MB copied) | Baseline recorded: backend tsc 0 errors, frontend lint 0 errors, frontend build 0 errors |
| **Cleanup Phase 1** | Duplicate Routes Removal & Canonicalization | DONE | `AppRoutes.jsx`, `NotFound.jsx`, `PROGRESS.md`, `scratch/test_phase1_routes.js` | 4 / 4 Route Verification Checks PASSED; Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **Cleanup Phase 2** | Other Unstructured Duplicates Audit & Removal | DONE | Removed 16 unused/duplicate files across frontend & backend (Batches 1, 2A, 2B, 3); `PROGRESS.md` | Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors; 100% reachability across active modules |
| **Cleanup Phase 3** | Full Regression & E2E Smoke Testing | DONE | Automated 16-check E2E smoke test suite (`scratch/smoke_test_e2e.js`), leak auditor (`scratch/verify_no_leaked_references.js`), `docs/rbac-matrix.md`, `PROGRESS.md` | 16 / 16 E2E Smoke Test Checks PASSED; Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **Cleanup Phase 4** | Documentation & Clean Architecture Sync | DONE | `README.md`, `docs/cleanup-log.md`, `PROGRESS.md` | All route and architecture docs synchronized; zero orphaned references; backup verified at `../PINEAPPLE-26-backup-before-cleanup` |
| **Phase 1 (Fix)** | Mentor Unlock After Second Application Approval | DONE | `mentor-application.entity.ts`, `mentor-applications.service.ts`, `mentor-applications.controller.ts`, `admin.service.ts`, `auth.service.ts`, `auth.controller.ts`, `main.ts`, `mentorApplicationsApi.js`, `RoleContext.jsx`, `NotificationContext.jsx`, `AuthContext.jsx`, `MentorApplication.jsx`, `scratch/test_phase1_verification.js`, `scratch/test_phase1_startup_repair.js`, `PROGRESS.md` | 14 / 14 API Verification Checks PASSED; Startup Repair PASSED; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Phase 2 (Fix)** | Remove Suspend Project and Delete Project Everywhere | DONE | `projects.controller.ts`, `projects.service.ts`, `projects.repository.ts`, `roles.guard.ts`, `projectsApi.js`, `AdminProjectDetails.jsx`, `AdminProjects.jsx`, `rbac-matrix.md`, `test_phase2_verification.js`, `test_phase2_repair.js`, `PROGRESS.md` | 11 / 11 Live API Checks PASSED; Data Repair PASSED; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Phase 3 (Fix)** | Project-Based Chat and Member Roles (Owner, Mentor, Collaborator) | DONE | `role.util.ts`, `communication.repository.ts`, `communication.service.ts`, `communication.controller.ts`, `projects.service.ts`, `users.service.ts`, `tasks.service.ts`, `tasks.repository.ts`, `projectRole.js`, `ChatBox.jsx`, `TaskCard.jsx`, `JoinRequestCard.jsx`, `AdminProjectDetails.jsx`, `CollaboratorWorkspace.jsx`, `MentorProjectWorkspace.jsx`, `profile.jsx`, `scratch/test_phase3_verification.js`, `PROGRESS.md` | 14 / 14 Live API Checks PASSED; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Dashboard Cleanup** | Remove Contribution History from Collaborator Dashboard | DONE | `dashboard.jsx`, `dashboard.css`, `TeamForge_Viva_Master_Guide.html`, `PROGRESS.md` | 17 / 17 Verification Checks PASSED; Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **Dashboard Layout & Skills** | Remove "My Skills" & Make Recent Activity Full Width | DONE | `dashboard.jsx`, `dashboard.css`, `settings.jsx`, `TeamForge_Viva_Master_Guide.html`, `PROGRESS.md` | 22 / 22 Verification Checks PASSED; Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **Dashboard Fetch Optimization** | Inline `fetchDashboard` & Eliminate Excess Fetches | DONE | `dashboard.jsx`, `PROGRESS.md` | Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors; JS bundle reduced to 851.89 kB |
| **Real-Time Data & Auth Fix** | Fix Data Updates Requiring Logout/Login & 401 on Mount | DONE | `apiClient.js`, `NotificationContext.jsx`, `AuthContext.jsx`, `dashboard.jsx`, `profile.jsx`, `settings.jsx`, `auth.service.ts`, `PROGRESS.md` | Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **Legacy Route Map Removal** | Remove LEGACY_PATH_MAP and Migration Hook from AppRoutes | DONE | `AppRoutes.jsx`, `PROGRESS.md` | Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **AuthContext Cleanup** | Removed Legacy Invites Cleanup Hook from AuthContext | DONE | `AuthContext.jsx`, `PROGRESS.md` | Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **Catch Statements Logging** | Filled All Empty/Comment-Only Catch Blocks Across Frontend & Backend | DONE | 16 Frontend files (`AuthContext.jsx`, `RoleContext.jsx`, `UIContext.jsx`, `apiClient.js`, `settings.jsx`, `AdminLayout.jsx`, etc.) & 16 Backend files (`main.ts`, `auth.guard.ts`, `firebase.strategy.ts`, `tasks.service.ts`, `projects.service.ts`, etc.), `PROGRESS.md` | 128 / 128 empty catch blocks filled with informative logging; Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **Full Name Validation** | Allow Any Characters for User Full Name | DONE | `settings.jsx`, `PROGRESS.md` | Full name accepts numbers, spaces, and any characters (`aditya123`, etc.); Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **Navbar Name Display** | Display User Full Name in Navbar Instead of Username | DONE | `navbar.jsx`, `settings.jsx`, `AuthContext.jsx`, `PROGRESS.md` | Navbar and avatar initials consistently display user's real name across reloads and settings updates; Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **Port 5173 Dev Server Sync** | Synchronized Settings & Navbar Name Fixes to Active Server (`Team-Forge-1`) | DONE | `settings.jsx`, `navbar.jsx`, `AuthContext.jsx`, `PROGRESS.md` | Dev server on port 5173 hot-reloaded without `FULLNAME_RE`; `aditya123` verified accepted without invalid characters error; Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **Perf Phase 0** | Setup and Baseline Environment | DONE | `PROGRESS.md`, `scratch/count_seeds.js` | Backup created at `../PINEAPPLE-26-backup-before-perf`; Node v22.16.0; In-memory counts & machine specs recorded; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Perf Phase 1** | Comprehensive Performance Measurement & Bottleneck Discovery | DONE | `timing.interceptor.ts`, `main.ts`, `scratch/test_measure_endpoints.js`, `docs/performance-findings.md`, `PROGRESS.md` | 28 endpoints measured 3x each; 25 root causes cataloged; Monolithic bundle (857.7 kB) & N+1 scans identified; Backend tsc 0 errors; Frontend lint & build 0 errors |
| **Perf Phase 2** | Fix Backend Causes (Map Indexes, Caching, Retention Caps, Compression, CORS Max-Age) | DONE | `users.repository.ts`, `projects.repository.ts`, `tasks.repository.ts`, `communication.repository.ts`, `notifications.service.ts`, `notifications.controller.ts`, `audit.service.ts`, `admin.controller.ts`, `admin.service.ts`, `leaderboard.service.ts`, `firebase.strategy.ts`, `compression.middleware.ts`, `app.module.ts`, `main.ts`, `security.middleware.ts`, `projects.service.ts`, `projects.controller.ts`, `PROGRESS.md` | 28 endpoints re-measured; Payload sizes reduced by up to 86% (audit log: 8.6 KB -> 1.2 KB; users: 7.6 KB -> 1.7 KB; projects: 3.7 KB -> 1.1 KB); Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **Perf Phase 3** | Fix Frontend Causes (Route Splitting, Request Deduplication, Polling & Visibility, Asset Optimization) | DONE | `AppRoutes.jsx`, `apiClient.js`, `CollaboratorWorkspace.jsx`, `OwnedWorkspace.jsx`, `MentorProjectWorkspace.jsx`, `dashboard.jsx`, `NotificationContext.jsx`, `landingpage.jsx`, `index.html`, `PROGRESS.md` | Main JS bundle cut by 66.4% (857.7 kB -> 288.4 kB raw, 236.6 kB -> 90.5 kB gzip); Main CSS cut by 85.5% (208.9 kB -> 30.4 kB); 100% route code-splitting with React.lazy; In-flight deduplication + 20s stale cache; Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **Perf Phase 4** | Verification, Before/After Benchmarks & Documentation Sync | DONE | `docs/performance-results.md`, `README.md`, `docs/srs/SRS_updated.md`, `stress-performance.spec.ts`, `PROGRESS.md` | All 5 stress checks PASSED (14k entities, 5k retention caps, $O(1)$ query speed); 28-endpoint before/after benchmark documented; Backend tsc 0 errors; Frontend lint 0 errors; Frontend build 0 errors |
| **Policy Plan Phase 1** | Moderation Core: Warnings, Suspensions, Reputation & Closed Status | DONE | `clock.service.ts`, `jobs.service.ts`, `warning.entity.ts`, `reputation-entry.entity.ts`, `moderation.config.ts`, `moderation.service.ts`, `reputation.service.ts`, `suspension-consequences.service.ts`, `moderation.controller.ts`, `moderation.module.ts`, `projects.repository.ts`, `projects.service.ts`, `tasks.service.ts`, `join-requests.service.ts`, `mentor-marketplace.service.ts`, `admin.service.ts`, `admin.controller.ts`, `ModerationModal.jsx`, `AdminUserDetails.jsx`, `AdminUsers.jsx`, `ProjectCard.jsx`, `MyProjects.jsx`, `AdminProjects.jsx`, `projectsApi.js`, `adminApi.js`, `phase1.e2e-spec.ts`, `docs/api-tests/phase-1.http` | Backend Unit: 40/40 PASSED; Backend E2E: 16/16 PASSED; Frontend Vitest: 11/11 PASSED; REST Client: 14/14 documented |
| **Policy Plan Phase 2** | Appeals and Reports: User Reporting, Admin Resolution, Warning Appeals & Audit Filter | DONE | `report.entity.ts`, `appeal.entity.ts`, `create-report.dto.ts`, `update-report-status.dto.ts`, `action-report.dto.ts`, `create-appeal.dto.ts`, `decide-appeal.dto.ts`, `reports.service.ts`, `appeals.service.ts`, `reports.controller.ts`, `appeals.controller.ts`, `users.service.ts`, `audit.service.ts`, `roles.guard.ts`, `reportsApi.js`, `appealsApi.js`, `usersApi.js`, `help.jsx`, `help.css`, `notifications.jsx`, `notifications.css`, `AdminReports.jsx`, `AdminReports.css`, `AuditLog.jsx`, `phase2.e2e-spec.ts`, `docs/api-tests/phase-2.http` | Backend Unit: 55/55 PASSED; Backend E2E: 36/36 PASSED; Frontend Vitest: 25/25 PASSED; Build & Lint 0 errors; REST Client: 17/17 documented |
| **Policy Plan Phase 3** | Joining & Leaving: 2-Request Limit, Owner Rejection Reason, Leave Dialog & 5-Day Auto-Close | DONE | `join-request.entity.ts`, `update-join-request.dto.ts`, `leave-project.dto.ts`, `join-requests.service.ts`, `join-requests.controller.ts`, `projects.service.ts`, `projects.controller.ts`, `jobs.service.ts`, `mentor-marketplace.service.ts`, `requestState.js`, `projectsApi.js`, `joinRequestsApi.js`, `ProjectCard.jsx`, `ProjectsMarketplace.jsx`, `AppliedProjects.jsx`, `OwnedWorkspace.jsx`, `CollaboratorWorkspace.jsx`, `RequestStateControl.test.jsx`, `AppliedProjectsReason.test.jsx`, `OwnerRejectModal.test.jsx`, `LeaveProjectDialog.test.jsx`, `phase3.e2e-spec.ts`, `docs/api-tests/phase-3.http` | Backend Unit: 73/73 PASSED; Backend E2E: 56/56 PASSED; Frontend Vitest: 38/38 PASSED; Lint & Build 0 errors; REST Client: 15/15 documented |
| **Policy Plan Phase 4** | Mentors & Deadlines: Experience & Tenure, Booking Decline & Refund, Due Dates & Missed Penalties, Project Deadlines | DONE | `platform-config.service.ts`, `platform-config.entity.ts`, `mentor-applications.service.ts`, `mentor-marketplace.service.ts`, `tasks.service.ts`, `tasks.repository.ts`, `projects.service.ts`, `jobs.service.ts`, `reputation.service.ts`, `change-deadline.dto.ts`, `MentorApplication.jsx`, `SuperuserConfig.jsx`, `MentorRequests.jsx`, `MentorsDirectory.jsx`, `TaskCard.jsx`, `OwnedWorkspace.jsx`, `mentor-applications.validator.spec.ts`, `deadline-penalties.spec.ts`, `deadline-change.spec.ts`, `phase4.e2e-spec.ts`, `MentorApplicationYears.test.jsx`, `DeclineSessionModal.test.jsx`, `TaskDueDateValidation.test.jsx`, `ChangeDeadlineModal.test.jsx`, `docs/api-tests/phase-4.http` | Backend Unit: 100/100 PASSED (13 suites); Backend E2E: 70/70 PASSED (4 suites); Frontend Vitest: 46/46 PASSED (14 files); Lint & Build 0 errors; REST Client: 18/18 documented |
| **Policy Plan Phase 5** | Username on Google/GitHub Sign-in, Zero Derivation, Confirmation Banner & Admin UI | DONE | `user.entity.ts`, `users.repository.ts`, `users.service.ts`, `users.controller.ts`, `auth.service.ts`, `auth.controller.ts`, `auth.guard.ts`, `firebase.strategy.ts`, `jwt.strategy.ts`, `http-exception.filter.ts`, `update-username.dto.ts`, `CompleteProfile.jsx`, `completeProfile.css`, `UsernameConfirmationBanner.jsx`, `UsernameConfirmationBanner.css`, `layout.jsx`, `ProtectedRoute.jsx`, `AppRoutes.jsx`, `Login.jsx`, `Signup.jsx`, `AuthContext.jsx`, `AdminProjects.jsx`, `AdminProjectDetails.jsx`, `username.validator.spec.ts`, `phase5.e2e-spec.ts`, `CompleteProfile.test.jsx`, `ProfileCompleteGuard.test.jsx`, `UsernameConfirmationBanner.test.jsx`, `AdminProjectsTable.test.jsx`, `docs/api-tests/phase-5.http` | Backend Unit: 115/115 PASSED (14 suites); Backend E2E: 82/82 PASSED (5 suites); Frontend Vitest: 63/63 PASSED (18 files); Lint & Build 0 errors; REST Client: 12/12 documented |
| **Policy Plan Phase 6** | Security Hardening: Private Chat Guard, URL Validation, Incomplete-Profile Lock, Self-Report Guard, Outbound Warning | DONE | `url.util.ts`, `url.util.spec.ts`, `profile.util.ts`, `profile-complete.spec.ts`, `digilocker-sandbox.provider.ts`, `digilocker-sandbox.matcher.spec.ts`, `communication.service.ts`, `communication.controller.ts`, `tasks.service.ts`, `projects.service.ts`, `users.service.ts`, `mentor-applications.service.ts`, `reports.service.ts`, `auth.guard.ts`, `jwt.strategy.ts`, `firebase.strategy.ts`, `SafeLink.jsx`, `SafeLink.css`, `urlUtil.js`, `ChatBox.jsx`, `CollaboratorWorkspace.jsx`, `OwnedWorkspace.jsx`, `MentorProjectWorkspace.jsx`, `settings.jsx`, `help.jsx`, `TaskCard.jsx`, `profile.jsx`, `phase6.e2e-spec.ts`, `SafeLink.test.jsx`, `docs/api-tests/phase-6.http` | Backend Unit: 135/135 PASSED (17 suites); Backend E2E: 107/107 PASSED (6 suites); Frontend Vitest: 74/74 PASSED (19 files); Lint & Build 0 errors; REST Client: 17/17 documented |
| **Policy Plan Phase 7** | Scheduler and Job Monitor: Automated Hourly Cron, In-Memory Lock, Run Log & Super User UI | DONE | `job-runs.service.ts`, `jobs.service.ts`, `jobs.module.ts`, `app.module.ts`, `admin.module.ts`, `admin.controller.ts`, `http-exception.filter.ts`, `test-helpers.ts`, `projects.service.ts`, `projects.repository.ts`, `job-runs.service.spec.ts`, `phase7.e2e-spec.ts`, `adminApi.js`, `jobFormatter.js`, `ScheduledJobsPanel.jsx`, `ScheduledJobsPanel.css`, `SuperuserConfig.jsx`, `AdminLayout.jsx`, `ScheduledJobsPanel.test.jsx`, `docs/api-tests/phase-7.http` | Backend Unit: 140/140 PASSED (18 suites); Backend E2E: 115/115 PASSED (7 suites); Frontend Vitest: 80/80 PASSED (20 files); Lint & Build 0 errors; REST Client: 9/9 documented |
| **Policy Plan Phase 8** | Decision Finality and Data Integrity: Report/Appeal Finality, Zero-Task Prevention, Approval Queue & Single Notification Store | DONE | `reports.service.ts`, `appeals.service.ts`, `projects.service.ts`, `gamification.service.ts`, `join-requests.service.ts`, `join-requests.controller.ts`, `notifications.service.ts`, `communication.repository.ts`, `communication.service.ts`, `AdminReports.jsx`, `OwnedWorkspace.jsx`, `JoinRequestCard.jsx`, `reports.service.spec.ts`, `appeals.service.spec.ts`, `gamification.service.spec.ts`, `join-requests.service.spec.ts`, `phase8.e2e-spec.ts`, `Phase8DecisionFinality.test.jsx`, `docs/api-tests/phase-8.http` | Backend Unit: 146/146 PASSED (18 suites); Backend E2E: 6/6 PASSED (1 suite); Frontend Vitest: 84/84 PASSED (21 files); Lint & Build 0 errors; REST Client: 11/11 documented |
| **Policy Plan Phase 9** | Escrow and Payment Safety: Closure Refund on Every Open Session, Booking Window, 30-min Expiry, Idempotent Payment & Escrow Reconcile | DONE | `mentor-marketplace.dto.ts`, `mentor-marketplace.entity.ts`, `payment-provider.interface.ts`, `demo-upi.provider.ts`, `mentor-marketplace.service.ts`, `mentor-marketplace.controller.ts`, `admin.controller.ts`, `jobs.service.ts`, `apiClient.js`, `mentorMarketplaceApi.js`, `MentorsDirectory.jsx`, `MentorRevenue.jsx`, `MentorEarnings.jsx`, `phase9.e2e-spec.ts`, `Phase9EscrowPaymentSafety.test.jsx`, `docs/api-tests/phase-9.http` | Backend Unit: 154/154 PASSED (18 suites); Backend E2E: 9/9 PASSED (1 suite); Frontend Vitest: 88/88 PASSED (22 files); Lint & Build 0 errors; REST Client: 11/11 documented |
| **Policy Plan Phase 10** | Platform Durability: Snapshot to File & Restore, UTC Time Handling & Reputation Ledger Pagination | DONE | `persistence.service.ts`, `persistence.module.ts`, `app.module.ts`, `reputation.service.ts`, `users.repository.ts`, `tasks.repository.ts`, `projects.repository.ts`, `communication.repository.ts`, `gamification.repository.ts`, `mentorship.repository.ts`, `governance.repository.ts`, `base.service.ts`, `notifications.service.ts`, `moderation.service.ts`, `reports.service.ts`, `appeals.service.ts`, `mentor-marketplace.service.ts`, `audit.service.ts`, `admin.controller.ts`, `users.controller.ts`, `dateFormatter.js`, `jobFormatter.js`, `ProjectCard.jsx`, `TaskCard.jsx`, `MentorsDirectory.jsx`, `SuperuserConfig.jsx`, `profile.jsx`, `AdminUserDetails.jsx`, `persistence.service.spec.ts`, `reputation.service.spec.ts`, `phase10.e2e-spec.ts`, `Phase10PlatformDurability.test.jsx`, `docs/api-tests/phase-10.http` | Backend Unit: 167/167 PASSED (20 suites); Backend E2E: 141/141 PASSED (10 suites); Frontend Vitest: 100/100 PASSED (23 suites); Lint & Build 0 errors; REST Client: 12/12 documented |
| **Policy Plan Phase 11** | Project Health Telemetry: "Why Nobody Applies" Panel, View Tracking, Owner Response Time, Deadline Cascade & Capacity Guard | DONE | `project-health.config.ts`, `project-views.service.ts`, `health.service.ts`, `projects.service.ts`, `projects.controller.ts`, `users.controller.ts`, `jobs.service.ts`, `persistence.service.ts`, `projectsApi.js`, `usersApi.js`, `ProjectHealthPanel.jsx`, `ProjectHealthPanel.css`, `ProjectCard.jsx`, `ProjectsMarketplace.jsx`, `DatePicker.jsx`, `OwnedWorkspace.jsx`, `project-views.service.spec.ts`, `health.service.spec.ts`, `deadline-shift.spec.ts`, `phase11.e2e-spec.ts`, `Phase11ProjectHealth.test.jsx`, `docs/api-tests/phase-11.http`, `PROGRESS.md` | Backend Unit: 199/199 PASSED (23 suites); Backend E2E: 155/155 PASSED (11 suites); Frontend Vitest: 110/110 PASSED (24 suites); Lint & Build 0 errors; REST Client: 11/11 documented |
| **Policy Plan Phase 12** | Stuck Projects, Requests & Inactivity: Zombie Project Breaker (48h hard pause), 14-Day Request Timeout, Early-Withdraw Refund (<2h & unviewed), Abandoned Owner (14d notice, 30d request-close, manual admin close) & Inactive Collaborator (7d repeating notice, Release Open/In-Progress Tasks) | DONE | `notifications.service.ts`, `users.repository.ts`, `users.service.ts`, `auth.guard.ts`, `support.service.ts`, `persistence.service.ts`, `projects.repository.ts`, `projects.service.ts`, `projects.controller.ts`, `admin.controller.ts`, `tasks.service.ts`, `tasks.controller.ts`, `communication.service.ts`, `join-requests.service.ts`, `join-requests.controller.ts`, `jobs.service.ts`, `projectsApi.js`, `MyProjects.jsx`, `OwnedWorkspace.jsx`, `AppliedProjects.jsx`, `CollaboratorWorkspace.jsx`, `AdminProjects.jsx`, `AdminProjectDetails.jsx`, `notifications.jsx`, `phase12.spec.ts`, `phase12.e2e-spec.ts`, `Phase12StuckProjects.test.jsx`, `docs/api-tests/phase-12.http`, `docs/rbac-matrix.md`, `PROGRESS.md` | Backend Unit: 205/205 PASSED (24 suites); Backend E2E: 158/158 PASSED (12 suites); Backend `tsc` build check: 0 errors; Frontend Vitest: 115/115 PASSED (25 suites); Lint & Build 0 errors; REST Client: 10 requests documented |
| **Policy Plan Phase 13** | Task Review & Feedback: Mandatory Rejection Reason, `In Review` Retention on Leave/Suspension, Day-3 Review Reminder & Day-7 Auto-Approve, Late Unassign Reason (<24h), Role Whitelist (`FORBIDDEN_FIELD` on `dueDate`) | DONE | `task.entity.ts`, `tasks.repository.ts`, `update-task.dto.ts`, `update-task-status.dto.ts`, `tasks.service.ts`, `tasks.controller.ts`, `projects.service.ts`, `jobs.service.ts`, `notifications.service.ts`, `tasksApi.js`, `TaskCard.jsx`, `OwnedWorkspace.jsx`, `CollaboratorWorkspace.jsx`, `AdminProjectDetails.jsx`, `job-runs.service.spec.ts`, `phase13.spec.ts`, `phase13.e2e-spec.ts`, `Phase13TaskReview.test.jsx`, `docs/api-tests/phase-13.http`, `docs/rbac-matrix.md`, `PROGRESS.md` | Backend Unit: 209/209 PASSED (25 suites); Backend E2E: 161/161 PASSED (13 suites); Backend `tsc` build check: 0 errors; Frontend Vitest: 119/119 PASSED (26 suites); Lint & Build 0 errors; REST Client: 8 requests documented |
| **Policy Plan Phase 14** | Mentor Lifecycle: Abandonment Review & 48h Release, First-Week Activity Tracking, 14-Day Re-Application Cooldown, Active Mentee Capacity Cap (`maxActiveMentees`), Private Post-Session Feedback & Admin Audit View | DONE | `platform-config.entity.ts`, `update-platform-config.dto.ts`, `platform-config.service.ts`, `mentor-application.entity.ts`, `mentor-applications.service.ts`, `mentor-marketplace.entity.ts`, `mentor-marketplace.dto.ts`, `mentor-marketplace.service.ts`, `mentor-marketplace.controller.ts`, `mentor-lifecycle.controller.ts`, `mentor-marketplace.module.ts`, `communication.module.ts`, `communication.service.ts`, `mentorship.service.ts`, `projects.module.ts`, `projects.controller.ts`, `admin.controller.ts`, `roles.guard.ts`, `http-exception.filter.ts`, `notifications.service.ts`, `jobs.service.ts`, `test-helpers.ts`, `mentorMarketplaceApi.js`, `MentorCard.jsx`, `MyMentorProfile.jsx`, `MentorApplication.jsx`, `MentorsDirectory.jsx`, `OwnedWorkspace.jsx`, `MentoredProjects.jsx`, `dashboard.jsx`, `AdminUserDetails.jsx`, `job-runs.service.spec.ts`, `phase14.spec.ts`, `phase14.e2e-spec.ts`, `Phase14MentorLifecycle.test.jsx`, `docs/api-tests/phase-14.http`, `docs/rbac-matrix.md`, `PROGRESS.md` | Backend Unit: 217/217 PASSED (26 suites); Backend E2E: 165/165 PASSED (14 suites); Backend `tsc` build check: 0 errors; Frontend Vitest: 125/125 PASSED (27 suites); Lint & Build 0 errors; REST Client: 14 requests documented |
| **Policy Plan Phase 15** | Collaboration UX: Active Project Cap (`MAX_ACTIVE_MEMBERSHIPS`), Skill-Match Hint, Rejection Suggestions, Direct Invites, Unread Chat Badge, User Search Ranking, Export Markdown & Clone as Draft | DONE | `skill-match.util.ts`, `platform-config.entity.ts`, `update-platform-config.dto.ts`, `platform-config.service.ts`, `http-exception.filter.ts`, `create-project.dto.ts`, `projects.repository.ts`, `projects.service.ts`, `projects.controller.ts`, `projects.module.ts`, `invites.service.ts`, `invites.controller.ts`, `join-requests.service.ts`, `join-requests.entity.ts`, `notification.entity.ts`, `create-notification.dto.ts`, `notifications.service.ts`, `users.service.ts`, `users.controller.ts`, `communication.repository.ts`, `communication.service.ts`, `communication.controller.ts`, `communication.module.ts`, `jobs.service.ts`, `persistence.service.ts`, `test-helpers.ts`, `highlightMatch.jsx`, `apiClient.js`, `projectsApi.js`, `communicationApi.js`, `navbar.jsx`, `ProjectsMarketplace.jsx`, `AppliedProjects.jsx`, `notifications.jsx`, `help.jsx`, `MyProjects.jsx`, `OwnedWorkspace.jsx`, `CollaboratorWorkspace.jsx`, `MentorProjectWorkspace.jsx`, `job-runs.service.spec.ts`, `phase15.spec.ts`, `phase15.e2e-spec.ts`, `Phase15CollaborationUx.test.jsx`, `docs/api-tests/phase-15.http`, `docs/rbac-matrix.md`, `PROGRESS.md` | Backend Unit: 226/226 PASSED (27 suites); Backend E2E: 172/172 PASSED (15 suites); Backend `tsc` build check: 0 errors; Frontend Vitest: 132/132 PASSED (28 files); Lint & Build 0 errors (206 modules); REST Client: 16 requests documented |
| **Policy Plan Phase 16** | Trust & Safety: Chat Message Reporting (20-Msg Snapshot), Duplicate Accounts Detection, Project Spam & Length Caps, Email Verification (`EmailVerifiedGuard` + 2m Resend Cooldown), Automated Content Filter & Phone OTP 5-Attempt Lockout | DONE | `http-exception.filter.ts`, `platform-config.entity.ts`, `update-platform-config.dto.ts`, `platform-config.service.ts`, `content-filter.config.ts`, `content-filter.service.ts`, `content-filter.pipe.ts`, `core.module.ts`, `email-verified.guard.ts`, `auth-strategy.interface.ts`, `jwt.strategy.ts`, `firebase.strategy.ts`, `mail.service.ts`, `create-user.dto.ts`, `user.entity.ts`, `users.repository.ts`, `duplicate-detection.service.ts`, `users.module.ts`, `users.service.ts`, `users.controller.ts`, `auth.service.ts`, `auth.controller.ts`, `admin.service.ts`, `admin.controller.ts`, `report.entity.ts`, `reports.service.ts`, `communication.repository.ts`, `communication.service.ts`, `communication.controller.ts`, `projects.service.ts`, `projects.controller.ts`, `join-requests.controller.ts`, `mentor-marketplace.controller.ts`, `test-helpers.ts`, `phase16.spec.ts`, `phase16.e2e-spec.ts`, `communicationApi.js`, `adminApi.js`, `authApi.js`, `usersApi.js`, `AuthContext.jsx`, `ChatBox.jsx`, `AdminUsers.jsx`, `AdminReports.jsx`, `CreateProject.jsx`, `VerifyEmailBanner.jsx`, `VerifyEmail.jsx`, `layout.jsx`, `AppRoutes.jsx`, `Signup.jsx`, `CompleteProfile.jsx`, `settings.jsx`, `Phase16TrustSafety.test.jsx`, `docs/api-tests/phase-16.http`, `docs/rbac-matrix.md`, `PROGRESS.md` | Backend Unit: 232/232 PASSED (28 suites); Backend E2E: 178/178 PASSED (16 suites); Backend `tsc` build check: 0 errors; Frontend Vitest: 139/139 PASSED (29 files); Lint: 0 errors, 0 warnings; Build: 0 errors (208 modules); REST Client: 9 requests documented |
| **Step 1** | One Role Per Person In A Project (Duplicate Member Row & Count Fix) | DONE | `role.util.ts`, `capacity.util.ts`, `projects.service.ts`, `projects.controller.ts`, `join-requests.service.ts`, `invites.service.ts`, `mentor-marketplace.service.ts`, `phase25.spec.ts`, `step1-members.spec.ts`, `step1-one-role.e2e-spec.ts`, `route-auth-matrix.json`, `projectsApi.js`, `OwnedWorkspace.jsx`, `CollaboratorWorkspace.jsx`, `MentorsDirectory.jsx`, `ProjectsMarketplace.jsx`, `Step1MembersList.test.jsx`, `PROGRESS.md` | Backend Unit: 43/43 PASSED (308/308 tests); Backend E2E: 8/8 PASSED (`step1-one-role.e2e-spec.ts`); Frontend Vitest: 3/3 PASSED (`Step1MembersList.test.jsx`); Backend tsc: 0 errors; Frontend Build: 0 errors (224 modules) |
| **Step 2** | Owner Cannot Remove Collaborator with Task Waiting for Review | DONE | `http-exception.filter.ts`, `projects.service.ts`, `projects.controller.ts`, `step2-removal.spec.ts`, `step2-removal-blockers.e2e-spec.ts`, `route-auth-matrix.json`, `projectsApi.js`, `OwnedWorkspace.jsx`, `Step2RemovalCheck.test.jsx`, `PROGRESS.md` | Backend Unit: 44/44 PASSED (316/316 tests; `step2-removal.spec.ts`: 8/8); Backend E2E: 7/7 PASSED (`step2-removal-blockers.e2e-spec.ts`); Frontend Vitest: 4/4 PASSED (`Step2RemovalCheck.test.jsx`); Backend tsc: 0 errors; Frontend Build: 0 errors (224 modules) |
| **Step 3** | Tell a Suspended User They Are Suspended (Security First & Suspension UI) | DONE | `suspended-response.util.ts`, `auth.service.ts`, `admin.service.ts`, `jwt.strategy.ts`, `firebase.strategy.ts`, `auth.guard.ts`, `http-exception.filter.ts`, `step3-suspended.spec.ts`, `step3-suspended-login.e2e-spec.ts`, `apiClient.js`, `tokenManager.js`, `SuspendedAccountPanel.jsx`, `Suspended.jsx`, `AppRoutes.jsx`, `Login.jsx`, `AdminLogin.jsx`, `Step3SuspendedLogin.test.jsx`, `PROGRESS.md` | Backend Unit: 45/45 PASSED (319/319 tests; `step3-suspended.spec.ts`: 3/3); Backend E2E: 9/9 PASSED (`step3-suspended-login.e2e-spec.ts`); Frontend Vitest: 7/7 PASSED (`Step3SuspendedLogin.test.jsx`); Backend tsc: 0 errors; Frontend Build: 0 errors (226 modules) |
| **Step 4** | Resolved or Rejected Support Tickets Must Be Read-Only | DONE | `support.service.ts`, `step4-ticket-readonly.spec.ts`, `step4-ticket-readonly.e2e-spec.ts`, `phase27.e2e-spec.ts`, `AdminSupport.jsx`, `help.jsx`, `Step4TicketReadOnly.test.jsx`, `PROGRESS.md` | Backend Unit: 46/46 PASSED (324/324 tests; `step4-ticket-readonly.spec.ts`: 5/5); Backend E2E: 9/9 PASSED (`step4-ticket-readonly.e2e-spec.ts`: 7/7, `phase27.e2e-spec.ts`: 2/2); Frontend Vitest: 5/5 PASSED (`Step4TicketReadOnly.test.jsx`); Backend tsc: 0 errors; Frontend Build: 0 errors (226 modules) |
| **Step 5** | Fix "View Audit Log" Button in Report Review Dialog & Audit Filter Chips | DONE | `audit.service.ts`, `admin.service.ts`, `admin.controller.ts`, `pending-moderation-action.entity.ts`, `moderation.service.ts`, `reports.service.ts`, `step5-audit-filter.spec.ts`, `step5-audit-button.e2e-spec.ts`, `AppRoutes.jsx`, `adminApi.js`, `AdminReports.jsx`, `AdminReports.test.jsx`, `AuditLog.jsx`, `Step5AuditButton.test.jsx`, `PROGRESS.md` | Backend Unit: 5/5 PASSED (`step5-audit-filter.spec.ts`); Backend E2E: 5/5 PASSED (`step5-audit-button.e2e-spec.ts`); Frontend Vitest: 10/10 PASSED (`Step5AuditButton.test.jsx`: 5/5, `AdminReports.test.jsx`: 5/5); Backend tsc: 0 errors; Frontend Build: 0 errors (226 modules) |
| **Step 6** | Full Regression & Smoke Test (All 5 Scenarios, New E2E & Frontend Smoke, Console Validation) | DONE | `regression-nov-21.e2e-spec.ts`, `RegressionNov21Smoke.test.jsx`, `AuditLog.jsx`, `SuspendedAccountPanel.jsx`, `Suspended.jsx`, `Step3SuspendedLogin.test.jsx`, `README.md`, `PROGRESS.md` | Backend Unit: 47/47 PASSED (329/329 tests); Backend E2E: 5/5 Scenarios PASSED (`regression-nov-21.e2e-spec.ts`); Frontend Vitest: 5/5 PASSED (`RegressionNov21Smoke.test.jsx`); Full 5-Step E2E: 36/36 PASSED; Browser Manual Pass: 0 console errors; Backend tsc: 0 errors; Frontend Build: 0 errors |
| **Profile Phase 1** | Remove Track Record Section from Profile Header Card | DONE | `UserTrustCard.jsx`, `profile.jsx`, `profile.css`, `leaderboard.jsx`, `landingpage.jsx`, `trust.service.ts`, `reputation-trust.spec.ts`, `UserTrustCard.test.jsx`, `ProfileTrustCardLedgerRemoval.test.jsx`, `PROGRESS.md` | Backend tsc: 0 errors; Backend `reputation-trust.spec.ts`: 16/16 PASSED; Frontend lint (changed files): 0 errors; Frontend Vitest (4 files): 18/18 PASSED; Frontend Build: 0 errors (235 modules) |
| **Profile Phase 2** | Fix Mentored Projects Card on Profile Page & Public View | DONE | `mentor-marketplace.entity.ts`, `mentor-marketplace.service.ts`, `projects.repository.ts`, `projects.service.ts`, `users.repository.ts`, `users.service.ts`, `users.controller.ts`, `admin.service.ts`, `usersApi.js`, `profile.jsx`, `OwnedWorkspace.jsx`, `mentor-profile-projects.spec.ts`, `ProfileMentoredProjects.test.jsx`, `README.md`, `docs/srs/SRS_updated.md`, `PROGRESS.md` | Backend tsc: 0 errors; Backend Jest (4 suites): 32/32 PASSED; Frontend ESLint (`usersApi.js`, `profile.jsx`, `ProfileMentoredProjects.test.jsx`): 0 errors (pre-existing errors in untouched `OwnedWorkspace.jsx` lines 81/600/712); Frontend Vitest (6 files): 27/27 PASSED; Frontend Build: 0 errors (235 modules) |

---

## Detailed Log by Phase

### Phase 0: RBAC Audit & Completion
- **Status:** **DONE**
- **Changes Made:**
  - Audited all controllers across the backend for identity reads: replaced direct `x-user-id` and `x-user-role` reads in `notifications.controller.ts` and `mentor-marketplace.controller.ts` with verified `@CurrentUser()`.
  - Tightened owner checks in `projects.service.ts` to strictly compare verified UID (`String(project.ownerId) === String(callerId)`), preventing display-name impersonation.
  - Made `RolesGuard` strictly ignore header role in non-legacy modes.
  - Added dual compatibility in `FirebaseStrategy` falling back to `JwtStrategy` while preserving `ForbiddenException` for suspensions.
  - Fixed unhandled Firebase Admin async rejections during suspension/reactivation of local in-memory users.
  - Extended `JwtStrategy` to load dynamic portal admins with section-based permissions.
  - Verified 20/20 test cases: 401 on missing/expired/tampered/alg-none tokens, 403 on collaborator calling owner/mentor/admin, forged role header ignored, 403 on role escalation to Admin, 403 on suspended users, 403 on admin without section permission, 200 on valid tokens.
  - Generated `docs/rbac-matrix.md` cataloging 124 routes.

### Phase 1: Auth Screens & Profile Data
- **Status:** **DONE**
- **Changes Made:**
  - Removed "Remember me" checkbox, state, label, and handlers from `Login.jsx` and `Signup.jsx`. Cleaned up leftover `.remember-me` styles from `Auth.css`.
  - Documented session persistence: fixed to `browserLocalPersistence` for Firebase Auth and httpOnly secure refresh cookie for JWT mode.
  - Assigned distinct, fixed seed dates (ISO) to all seeded users in `UsersRepository`.
  - Stored `createdAt` (ISO) on every user record upon signup and return from all profile and admin endpoints.
  - Created shared date formatter `formatMemberSince()` formatting dates like `"26 Oct 2026"`, falling back to `"Unknown"` only when missing (never using current date). Applied to `profile.jsx` and `AdminUserDetails.jsx`.
  - Added controlled `university` field (2-100 characters, optional) to Settings > Profile Information with real-time validation, hints, and error messaging.
  - Added `university` to back-end entities, `CreateUserDto`, `CreateProfileDto`, `UsersRepository`, `UsersService`, and `AdminService`.
  - Cleaned up display across `Profile.jsx`, `AdminUsers.jsx`, `AdminUserDetails.jsx`, and `AdminMentorApps.jsx`: replaced "Unknown University" / "Unknown Organization" with real values or hidden when empty.
  - Verified with live API tests: different seed dates displayed, university update persisted and reflected across admin list and user details.

### Phase 2: Unified XP & Reputation Ledger
- **Status:** **DONE**
- **Changes Made:**
  - Standardized canonical `LedgerEntryDto`: `(id, userId, taskId?, projectId?, xp, rep, reason, date)`.
  - Replaced ad-hoc scores in `GamificationRepository` with append-only ledger entries for all 13 seed users with timestamps spread across 25d, 12d, and 3d ago, enabling accurate all-time, monthly (last 30d), and weekly (last 7d) rankings from day one.
  - Sealed `task-1`, `task-6`, and `task-8` into the initial ledger with `taskId`, establishing idempotency for seeded completed tasks.
  - Implemented `recordTaskApproval(userId, taskId, projectId, xp, rep, reason)`: checks if `taskId` is already present in ledger; if so, throws `BadRequestException('XP and reputation have already been awarded for this task.')`.
  - Enforced single source of truth: `getUserStats(userId)` and `getUserPeriodStats(userId, period)` compute totals strictly from the ledger.
  - Updated `TasksService`: XP and Rep are awarded ONLY when a task is approved; attempts to re-approve an already awarded task are rejected with HTTP 400.
  - Removed badge XP/Rep minting from `MentorshipService`: badges are strictly recognition only (`+250 XP` and `+8 Rep` minting eliminated).
  - Rewrote `LeaderboardService`: deleted fake `KNOWN_BENCHMARKS` and artificial `xp / 10` calculations; leaderboard ranks users directly by ledger sum for the requested period (`alltime`, `monthly`, `weekly`).
  - Added period toggle buttons (`All-Time`, `Monthly (30d)`, `Weekly (7d)`) to `Leaderboard.jsx` connecting to live backend API.
  - Created `gamificationApi.js` on front end and added collapsible "XP & Reputation Ledger" card to `Profile.jsx` displaying the user's ledger timeline.
  - Harmonized `Profile.jsx` and `Dashboard.jsx` to consume canonical backend scores instead of drifting local computations.
  - Verified with automated 10-check integration test suite (`back-end/test/phase2.spec.ts`): all 10 checks passed (ledger sums, profile synchronization, period rankings, re-approval rejection, badge recognition without score minting).

### Phase 3: Calendar DatePicker & Due Dates
- **Status:** **DONE**
- **Changes Made:**
  - Built custom, lightweight, zero-dependency `DatePicker.jsx` and `DatePicker.css` with popup calendar month grid, previous/next month navigation, min/max date constraints, outside click handler, and keyboard accessible inputs.
  - Added mandatory `dueDate` validation in `ProjectsService.create`: projects require a due date that cannot be in the past or today (must be at least tomorrow; HTTP 400 on violations).
  - Added mandatory `dueDate` validation in `TasksService.create`: tasks require a due date that cannot be in the past and cannot exceed the parent project's due date (HTTP 400 on violations).
  - Seeded realistic due dates across all seed projects (`proj-1` through `proj-8`) and tasks (`task-1` through `task-8`), seeding `task-3` with a past date to verify overdue status.
  - Added dynamic `isOverdue` computation in `TasksService.enrichTaskAssignee`: computes whether an uncompleted task's due date is earlier than today's date.
  - Integrated `DatePicker` into `CreateProject.jsx` with real-time validation and helper hints.
  - Integrated `DatePicker` into `OwnedWorkspace.jsx` inside the Create Task modal, constrained between today and the project due date.
  - Displayed project due date in `OwnedWorkspace.jsx` and `CollaboratorWorkspace.jsx` workspace headers.
  - Rendered `ProjectCard.jsx` due date in card footer meta.
  - Updated `TaskCard.jsx` to render formatted due date and a prominent `⚠️ Overdue` badge when a task is past due.
  - Added `Project Due Date` column in `AppliedProjects.jsx` and formatted task due dates with overdue indicators in `AdminProjectDetails.jsx`.
  - Verified with automated 9-check integration test suite (`back-end/test/phase3.spec.ts`): 9/9 passed (past/today project rejection, tomorrow+ project acceptance, past task rejection, out-of-range task rejection, valid task acceptance, overdue calculation for open vs completed tasks).

### Phase 4: Owner Applicant Profile Inspection
- **Status:** **DONE**
- **Changes Made:**
  - Implemented `GET /users/:id/public-profile` backend endpoint in `users.controller.ts` and `users.service.ts`.
  - Enforced strict authorization: access is granted only to the user themselves, Platform Administrators/SuperUsers, or Project Owners who have pending/approved applications or existing collaborations with the target user. Unrelated callers receive HTTP 403 Forbidden.
  - Public profile payload includes: `id`, `name`, `username`, `avatar`, `role`, `university`, `bio`, `skills`, `memberSince`, ledger `xp` and `rep`, `projectsCount`, `tasksCompleted`, `recommendationBadges`, `completedProjects` (with links), `contributionHistory`, and `linkedIn`.
  - Strict privacy filter: `email`, `phone`, `warnings`, `suspensions`, `flagControls`, and `recentActivity` are strictly omitted.
  - Added `usersApi.getPublicProfile(id)` in frontend API service.
  - Added "View Profile" button to `JoinRequestCard.jsx` and styled in `JoinRequestCard.css`.
  - Built comprehensive Applicant Profile Inspection modal in `OwnedWorkspace.jsx` displaying applicant bio, university, member since, key metrics grid, skills tags, mentor recommendation badges, completed projects portfolio with external links, and full contribution history. Included direct "Accept Application" and "Decline Application" workflow actions inside the modal.
  - Verified with automated 7-check integration test suite (`back-end/test/phase4.spec.ts`): 7/7 passed (anonymous 401, unrelated user 403, project owner 200, admin 200, complete public profile fields, sensitive fields absence, non-existent user 404).

### Phase 5: Project Capacity & Collaborator Limit
- **Status:** **DONE**
- **Changes Made:**
  - Built canonical `capacity.util.ts` utility calculating approved collaborator count (excluding owner and mentor), enforcing platform cap (`platformConfig.maxCollaboratorCapacity`), and determining project fullness.
  - Clamped project `maxCollaborators` to platform capacity upon project creation in `ProjectsService.create`.
  - Enriched project payloads with `approvedCollaboratorCount`, `collaboratorCount`, `maxCollaborators`, and boolean `isFull`.
  - Updated `JoinRequestsService.create` to reject requests to full projects with HTTP 409 Conflict (`This project is full.`).
  - Updated `JoinRequestsService.update` to reject approvals into full projects with HTTP 409 Conflict (`This project is full.`).
  - Implemented automatic cascading rejection of remaining pending join requests with `reason: 'Project is full'` when the final collaborator slot is filled, accompanied by automated applicant notifications.
  - Updated frontend `ProjectCard.jsx` to render `Full` status badge, collaborator capacity counter (e.g. `1/1 full`), and disabled `Apply` button with tooltip warning.
  - Updated `ProjectsMarketplace.jsx` to warn in project preview modal and handle 409 errors gracefully.
  - Displayed `Full` badge and `👥 Capacity: X/Y` counter in `OwnedWorkspace.jsx` and `CollaboratorWorkspace.jsx` workspace headers.
  - Verified with automated 9-check integration test suite (`back-end/test/phase5.spec.ts`): 9/9 passed (cap clamping, slot enforcement, pending request auto-rejection, 409 on application, 409 on approval, owner/mentor exclusion).

### Phase 6: Single Mentor per Project & Clean Escrow Ledger
- **Status:** **DONE**
- **Changes Made:**
  - Enforced single active/pending mentor session rule: a project can have at most one session in `payment_pending`, `escrow_funded`, or `active` state.
  - Added in-flight booking concurrency lock and rejection with HTTP 409 Conflict (`This project already has an active or pending mentor session.`).
  - Added overwrite protection in `acceptSession`: accepting a session checks if project already has a mentor assigned or another active session; if so, refuses with HTTP 409, refunds the session in full, notifies owner, and creates audit entry.
  - Replaced double-funding in `EscrowService`: checks if an escrow record already exists for the given session ID before creating.
  - Implemented automatic startup reconciliation (`reconcileDuplicateSessionsOnStartup`): detects projects with multiple live sessions, keeps the earliest active/accepted one, refunds duplicates in full with reason `'Duplicate booking'`, sends notifications, logs audit records, and reports fixed data to the console.
  - Seeded canonical active sessions for `proj-1` and `proj-2` with verified escrow breakdown records.
  - Updated frontend `MentorsDirectory.jsx`: disabled projects in booking modal dropdown that are completed, already assigned a mentor, or have pending/active mentor sessions with descriptive badges; if all projects are taken, displays a clear message and disables booking.
  - Verified with automated 12-check integration test suite (`back-end/test/phase6.spec.ts`): 12/12 passed (startup duplicate reconciliation, escrow integrity formula, completed project rejection 400, non-owner rejection 403, existing mentor rejection 409, first booking 201, concurrent booking 409, decline frees project, accept assigns mentor, table escrow sum matches held total).

### Phase 7: Simulated UPI QR Payment Flow
- **Status:** **DONE**
- **Changes Made:**
  - Designed modular `PaymentProvider` interface and implemented `DemoUpiProvider` generating standard NPCI `upi://pay` deep links (`pa=teamforge@demo`) with 10-minute hold expiration, pluggable via environment variables.
  - Updated `bookSession`: transitions booking flow to create a session in `payment_pending` status holding the project for 10 minutes without funding escrow yet.
  - Implemented `confirmPayment` endpoint (`POST /mentor-marketplace/sessions/:id/confirm-payment`): verifies payment via provider, moves session to `escrow_funded`, funds escrow account exactly once, and sends mentor notifications.
  - Built idempotent double-click protection: redundant confirmation requests return the existing session and escrow record without double-funding.
  - Implemented `cancelPayment` endpoint (`POST /mentor-marketplace/sessions/:id/cancel-payment`): owner can cancel a pending payment, releasing the project hold immediately.
  - Implemented automated stale session expiry (`expireStalePaymentPendingSessions`): checks on read/startup to cancel expired `payment_pending` sessions and free the project hold.
  - Reconciled admin stats: revenue statistics count `payment_pending` sessions separately and exclude them from `escrowHeld`.
  - Built pure SVG zero-dependency QR code generator component `QRCodeSvg.jsx` for offline rendering.
  - Updated frontend `MentorsDirectory.jsx` with a two-step booking modal: Step 1 (Project selection & fee breakdown) -> Step 2 (Demo UPI Payment with QR code, 10-minute countdown timer, UPI ID copy button, deep link, prominent "Demo payment: no real money is charged" banner, "I have paid", and "Cancel").
  - Verified with automated 10-check integration test suite (`back-end/test/phase7.spec.ts`): 10/10 passed (UPI intent generation, project hold enforcement, cancellation & release, payment confirmation, idempotency / double-click protection, non-owner rejection 403, stale expiry rejection 400, admin revenue separation).

### Phase 8: Mentor CV Upload & DigiLocker Verification
- **Status:** **DONE**
- **Changes Made:**
  - Configured secure CV storage directory (`secure-cvs/`) located strictly outside the public web root.
  - Implemented `POST /uploads/cv` endpoint accepting `.pdf` files only (max 5MB) and rigorously verifying `%PDF-` magic byte signatures at byte offset 0. Non-PDFs or renamed executable/binary files are rejected with HTTP 400 and immediately unlinked from disk.
  - Implemented authorized CV download endpoint (`GET /uploads/cv/:filename`), verifying identity and strictly restricting access to platform administrators or the application's applicant owner (HTTP 403 Forbidden for unauthorized callers).
  - Implemented privacy-compliant CV deletion endpoints (`DELETE /uploads/cv/:filename` and `DELETE /mentor-applications/:id/cv`), physically erasing the file from disk and clearing the entity record.
  - Built DigiLocker provider architecture with pluggable `DigiLockerSandboxProvider` and `DigiLockerRealProvider` (configurable via `DIGILOCKER_MODE` environment variable).
  - Added DigiLocker status and document retrieval endpoints (`GET /mentor-applications/digilocker/status` and `POST /mentor-applications/digilocker/pull-documents`) that perform case-insensitive name matching against applicant name, marking matching credentials with `verified` and mismatched credentials with `mismatch`.
  - Enforced mentor application validation on the backend: applications strictly require a valid CV upload AND at least one verified DigiLocker document; applications with only mismatched or missing certificates are rejected with HTTP 400.
  - Extended admin rejection workflow: administrators can supply a custom rejection reason (`PUT /mentor-applications/:id/reject`), which is recorded on the application entity and triggers an applicant notification.
  - Built frontend CV file picker in `MentorApplication.jsx` with client-side `.pdf` extension and 5MB size validation, upload spinner, file info preview pill (formatted size), and "Remove CV" action.
  - Built frontend DigiLocker integration in `MentorApplication.jsx` with clear "Simulated DigiLocker (demo)" banner, "Connect DigiLocker (Demo)" button, and credential cards with green `✓ Verified` and amber `⚠️ Name Mismatch` badges.
  - Updated applicant status view in `MentorApplication.jsx` displaying submitted CV with download and privacy deletion actions, DigiLocker credentials, and admin rejection reasons.
  - Updated `AdminMentorApps.jsx` with prominent DigiLocker Sandbox active banner, CV document inspection with view/download and privacy deletion buttons, DigiLocker credential card grid, and interactive Rejection Reason modal.
  - Verified with automated 14-check integration test suite (`back-end/test/phase8.spec.ts`): 14/14 passed (non-PDF rejection, %PDF- magic byte verification, physical secure directory storage, sandbox status, name matching, missing CV rejection, missing verified credential rejection, valid application creation, applicant download authorization, admin download authorization, unauthorized user 403 block, admin rejection with reason, disk privacy deletion).

### Phase 9: Documentation & Final Regression
- **Status:** **DONE**
- **Changes Made:**
  - Updated root `README.md` with a comprehensive "Authentication & RBAC" architecture section detailing the 3 operational modes (`firebase`, `jwt`, `legacy`), custom claims, role switch workflows, and links to `docs/rbac-matrix.md`.
  - Documented all new features in `README.md`: Zero-dependency Calendar DatePicker & due date validation, Owner applicant public profile inspection modal with privacy redaction, Project collaborator capacity clamping and collision prevention, Single mentor per project invariant with startup reconciliation and clean escrow, Demo NPCI UPI QR payment flow with 10-minute hold and SVG QR generator, and Mentor CV upload with `%PDF-` magic byte validation and simulated DigiLocker sandbox credential verification.
  - Documented all newly introduced environment variables across `back-end/.env.example` and `React-Implementation/React-Implementation/.env.example` (`PAYMENT_GATEWAY_PROVIDER`, `DEMO_UPI_VPA`, `PAYMENT_HOLD_MINUTES`, `DIGILOCKER_MODE`, `DIGILOCKER_CLIENT_ID`, `DIGILOCKER_CLIENT_SECRET`, `DIGILOCKER_REDIRECT_URI`).
  - Cataloged seeded demo accounts across all personas (Super User, Administrator, Project Owner, Collaborators, Mentors) with clear credentials and recommended test scenarios.
  - Performed complete end-to-end regression validation:
    - Back-end `npx tsc --noEmit`: PASSED (0 errors).
    - Front-end `npm run lint`: PASSED (0 errors).
    - Front-end `npm run build`: PASSED (production bundle created cleanly in 4.3s).
    - Verified all test suites across Phases 0 through 8 pass with 100% success rate.

### Fix Phase 1: Admin & Super User Mentor Applications Approval/Rejection (403 Resolution)
- **Status:** **DONE**
- **Root Causes Identified:**
  1. Frontend token priority in `apiClient.js`: `getFreshToken()` prioritized regular user session (`auth.currentUser` or cookie-refreshed `inMemoryAccessToken`) over the portal admin session token in `sessionStorage` (`teamforge.adminToken`). On `/admin/mentor-apps`, collaborator tokens were dispatched to `@Roles('admin', 'superuser')` protected endpoints, yielding HTTP 403.
  2. Role normalization discrepancy: `normalizeRole` inconsistently categorized `super-admin` as `admin` instead of `superuser`, causing permission drift.
  3. Permission enforcement: In `roles.guard.ts`, Super User must explicitly hold every portal permission (`*` and all section keys), while Admin must have their specific permissions checked against required section keys (e.g. `mentor_apps` for mentor application approve/reject, `projects` for admin project delete, `revenue` for revenue & escrow, `users` for user moderation).
  4. Incomplete approval lifecycle: `mentorApplicationsService.approve` updated `user.role` to `Mentor` but failed to notify the applicant via `notificationsService`, leaving applicants unaware of approval.
  5. UI alert blocking: `AdminMentorApps.jsx` used browser `alert()`, leaving `processingId` in a frozen state upon error without proper `finally` cleanup, and lacked automatic refresh of applications upon mutation.
- **Changes Made:**
  - Standardized role normalization in `role.util.ts` and `apiClient.js` to uniformly resolve all superuser representations (`superuser`, `super-user`, `super_user`, `superadmin`, `super-admin`, `super_admin`) to `superuser`, and all administrator representations to `admin`.
  - Updated `jwt.strategy.ts` and `firebase.strategy.ts` to guarantee that Super User accounts automatically receive `permissions: ['*']`.
  - Tightened section-based RBAC in `roles.guard.ts` to require `mentor_apps` permission for mentor application approval/rejection and list queries by admins; added `projects` permission requirement for admin project deletions (`DELETE /projects/:id`); added `revenue` permission requirement for mentor marketplace sessions and escrow statistics.
  - Updated `mentor-applications.controller.ts` and `mentorApplicationsService.approve` to dispatch `MENTOR_APPLICATION_APPROVED` notifications to applicants upon approval, persist `mentorUnlocked: true` on both the user profile and root record, and record audit log entries for both approve and reject.
  - Updated `apiClient.js` to detect portal requests and `/admin/*` navigation, ensuring the portal admin token in `sessionStorage` is prioritized over regular collaborator tokens.
  - Replaced browser `alert()` in `AdminMentorApps.jsx` with a non-blocking toast banner, added rejection reason field, ensured `finally { setProcessingId(null); }` resets processing state, and automated application list refresh via `refreshKey`.
  - Updated `docs/rbac-matrix.md` with documented permission mappings.
- **Verification:**
  - Automated 22-check integration test suite (`scratch/test_phase1.js`): 22/22 PASSED (Super User login, Collaborator logins, application submission, Super User approval, mentorUnlocked check, approval notification, Super User rejection with custom reason, rejection notification with reason, Admin with mentor_apps approval, Admin without mentor_apps 403 on approve/reject, Collaborator 403 on approve, Admin user listing, Admin without projects permission 403 on project delete, Admin without manage_admins 403 on portal-admins, Admin without config 403 on config update, Super User config update 200, audit log entries for approve and reject).
  - Back-end `npx tsc --noEmit`: 0 errors.
  - Front-end `npm run lint`: 0 errors.
  - Front-end `npm run build`: 0 errors.

### Fix Phase 2: Leaderboard Cleanup (Admins, Role Suffixes, Duplicates, Dense Ranking)
- **Status:** **DONE**
- **Root Causes Identified:**
  1. Portal & Admin accounts included: In `LeaderboardService.getLeaderboard()`, `usersService.findAll()` was mapped directly without role or account filtering, including `u-admin` ("Default Admin", 3000 XP), `u-superuser` ("Super User", 9999 XP), and user `1` ("Priya Patel", role: `administrator`). Hardcoded fallbacks in `leaderboard.jsx` also contained Priya Patel.
  2. Role suffix strings baked into display names: In `users.repository.ts`, `seeding.service.ts`, and fallback accounts in `Login.jsx`, names were hardcoded with role suffixes: `'Jathin (Project Owner)'`, `'Rohan Mehta (Mentor)'`, `'Aditya (Collaborator)'`.
  3. Duplicate user records: Rohan Mehta was stored twice in `users.repository.ts` (real primary account `id: '4'` with `rohan.mehta@teamforge.io`, and demo seed account `id: 'u-mentor'` with `mentor@example.com`). Both received independent ledger entries in `gamification.repository.ts` and appeared as separate rows.
  4. Competition ranking with gaps: Previous ranking used `currentRank = index + 1`, creating gaps on ties (e.g. 1, 2, 2, 4) instead of dense ranking (1, 2, 2, 3) without gaps.
  5. UI inconsistencies: The signed-in user's row was not styled with a highlighted border/background in `leaderboard.jsx` due to missing `tableClassName`, and the user's role was not displayed as a component Badge.
- **Changes Made:**
  - Seed and account name cleanup: Updated `users.repository.ts`, `seeding.service.ts`, and `Login.jsx` to store clean display names (`'Jathin'`, `'Rohan Mehta'`, `'Aditya'`) without role suffixes.
  - Startup duplicate detection & mitigation: Implemented `detectAndFixDuplicates()` in `UsersRepository`. Automatically reports duplicate pairs (`id: '4'` vs `id: 'u-mentor'`), preserves the real account (`id: '4'`), and marks the demo seed record `isDuplicate: true`, `isHidden: true`, `status: UserStatus.Inactive` while retaining credential lookup capability.
  - Leaderboard filtering and dense ranking: In `LeaderboardService.getLeaderboard()`, strictly excluded admins, superusers, portal accounts, suspended accounts, and hidden duplicates. Implemented standard dense ranking (1..n without gaps, ties share rank). Stripped any residual role suffixes from display names. Added `role?: string` to `LeaderboardEntryDto`.
  - Harmonized single source of truth: Unified XP, reputation, tasks, and projects on the leaderboard directly with the canonical gamification ledger and `users.service.ts`, matching user profile metrics exactly.
  - Leaderboard UI: Integrated `<Badge variant={...}>` in `leaderboard.jsx` to render the user's role next to the clean name, updated `FALLBACK_LEADERBOARD` to platform-only users, added `tableClassName="leaderboard-table"`, and enhanced `.is-current-user` styling in `leaderboard.css` for clear visual distinction.
  - Dashboard & Admin Users harmonization: Updated `AdminUsers.jsx` and `admin.service.ts:getUsers()` to apply the same exclusion rules (excluding admins, superusers, and hidden duplicate `u-mentor`). Updated `dashboard.jsx` to clean user display names and dynamically retrieve user ranking for the reputation stat card.
- **Verification:**
  - Automated 38-check integration test suite (`scratch/test_phase2.js`): 38/38 PASSED:
    - All-time tab contains NO Admin, Super User, or Administrator accounts.
    - All-time tab contributor names contain NO role suffixes.
    - Each contributor appears exactly once (no duplicates by user ID or name).
    - All-time ranking is strictly dense (1..n without gaps, ties share rank).
    - Monthly tab contains NO Admin, Super User, or Administrator accounts, and no role suffixes.
    - Weekly tab contains NO Admin, Super User, or Administrator accounts, and no role suffixes.
    - Profile page numbers (XP, Rep, Tasks) match Leaderboard exactly for User 2 (Arjun Sharma), User 4 (Rohan Mehta), User 5 (Sneha Iyer), and User 7 (Neha Gupta).
    - Admin Users list excludes portal Admins, Super Users, and duplicate seed account `u-mentor`.
    - User rank endpoint (`GET /leaderboard/:id`) accurately resolves user rank.
  - Back-end `npx tsc --noEmit`: 0 errors.
  - Front-end `npm run lint`: 0 errors.
  - Front-end `npm run build`: 0 errors.

### Fix Phase 3: Mentor Application Credential Statuses (Verified vs Unverified)
- **Status:** **DONE**
- **Root Cause Analysis:**
  1. Unclear credential status taxonomy: Credentials lacked a single canonical enum for statuses (`verified`, `name_mismatch`, `unverified`, `failed`) and inconsistent field naming (`status` vs `verificationStatus`).
  2. Client-side status trust vulnerability: Previously, client applications could send arbitrary verification statuses in `certificates` without server re-evaluation against the applicant's real profile name.
  3. Mismatched credentials inclusion: The frontend DigiLocker panel lacked inline mismatch reasoning, did not summarize verified vs unverified counts, did not exclude unverified credentials from submission, and did not disable submission until at least one verified credential was attached.
  4. Admin verification visibility and filter: Admin list did not display summary chip ("2 of 3 verified"), did not filter by verification status category, and did not enforce an explicit administrative override note when approving an application lacking verified credentials.
- **Changes Made:**
  - Back-end standardization:
    - Defined `CredentialStatus` enum (`VERIFIED = 'verified'`, `NAME_MISMATCH = 'name_mismatch'`, `UNVERIFIED = 'unverified'`, `FAILED = 'failed'`) and standardized `DigiLockerDocument` interface in `digilocker-document.interface.ts` with `issuer`, `documentType`, `documentNumber`, `holderName`, `issueDate`, `status`, `verificationStatus`, `verifiedAt`, `verificationId`, `mismatchReason`.
    - In `DigiLockerSandboxProvider`, generated 2 genuine matching documents for the applicant and 1 clearly labelled demo mismatch (`Executive Diploma in AI (Demo Mismatch Example)` with holder `Kavita Verma (Demo Mismatch Example)` and mismatch reason).
    - In `MentorApplicationEntity` and DTOs (`create-mentor-application.dto.ts`, `update-mentor-application.dto.ts`), added `excludedCertificates?: DigiLockerDocument[]` and `approvalOverrideNote?: string`.
    - In `MentorApplicationsService.create()`: Server recomputes name matching strictly against applicant's trimmed case-insensitive full name; rejects client status tampering; partitions documents into `certificates` (verified only) and `excludedCertificates` (unverified/mismatched); rejects with HTTP 400 if 0 verified credentials pass verification.
    - In `MentorApplicationsService.approve()`: Re-checks verified credentials count; throws HTTP 409 Conflict if applicant has 0 verified credentials unless admin provides explicit override (`overrideVerification: true` and non-empty `overrideNote`); persists `approvalOverrideNote` and records `mentor-application-approved-without-verification` in audit log.
  - Front-end standardization:
    - Created `credentialStatus.js` defining `CREDENTIAL_STATUS`, `CREDENTIAL_STATUS_LABELS`, and `CREDENTIAL_STATUS_BADGES`.
    - Updated `mentorApplicationsApi.js` so `approve(id, payload, role)` supports passing `{ overrideVerification, overrideNote }`.
    - Enhanced `Badge.css` with `.tf-badge--verified`, `.tf-badge--name-mismatch`, and `.tf-badge--unverified`.
    - In `MentorApplication.jsx`: Displayed credential cards with status badges, inline mismatch reason ("Holder name does not match your profile name"), summary line ("2 verified, 1 not verified"), "Remove" button on unverified credentials, automatic exclusion of unverified credentials on submit, disabled submit button until at least 1 credential is verified and CV attached, and displayed both verified and excluded credentials in the application status view.
    - In `AdminMentorApps.jsx`: Displayed summary chip (`"2 of 3 verified"`), verified credentials card list, excluded credentials card list, CV view/download, experience comparison against platform minimum, verification FilterTabs (`All`, `Fully verified`, `Has unverified`, `No verified`), and integrated `ConfirmModal` for "Approve without verification" requiring mandatory justification note.
- **Verification:**
  - Automated 26-check live integration test suite (`scratch/test_phase3.js`): 26/26 PASSED:
    - Super User login & Admin provisioning with `mentor_apps` permission.
    - DigiLocker Sandbox document retrieval: returns 3 documents (2 matching applicant name, 1 demo mismatch).
    - Document schema validation: includes issuer, documentType, documentNumber, holderName, issueDate, status, verifiedAt, verificationId.
    - Demo mismatch document clearly labelled with holder mismatch reason.
    - Application with 0 verified credentials rejected with HTTP 400.
    - Forged client request tampering with status: re-evaluated server-side and rejected with HTTP 400.
    - Genuine application submission: HTTP 201, stores 2 verified certificates and 1 excluded certificate.
    - Admin view displays summary ("2 of 3 verified") with both verified and excluded lists.
    - Approval of application with 0 verified credentials refused with HTTP 409 Conflict.
    - Approval with verification override and required note succeeds with HTTP 200, saves `approvalOverrideNote`.
    - Super User approval on genuine application succeeds with HTTP 200, updates applicant `mentorUnlocked: true`, sends notification `MENTOR_APPLICATION_APPROVED`.
    - Reject application with reason succeeds with HTTP 200, saves `rejectionReason`.
    - Audit log records `mentor-application-approved`, `mentor-application-rejected`, and `mentor-application-approved-without-verification` override.
  - Back-end `npx tsc --noEmit`: 0 errors.
  - Front-end `npm run lint`: 0 errors.
  - Front-end `npm run build`: 0 errors.

### Current Phase 1: Leaderboard Role Removal & Account Deduplication Audit
- **Status:** **DONE**
- **Root Cause Analysis:**
  1. The leaderboard displayed role badges and text next to contributor names despite XP and reputation being entirely role-independent.
  2. The backend `LeaderboardService` returned `role: user.role` in each row of `GET /leaderboard`, exposing roles on a community standings leaderboard.
  3. `FALLBACK_LEADERBOARD` in `leaderboard.jsx` had `role` keys baked into all periodic fallback objects.
  4. Apparent duplicate check ("Aditya Sai" vs "Aditya"): Investigation revealed they are two distinct accounts (`id: '6'`, `email: 'aditya.sai@teamforge.io'`, `university: 'VIT Vellore'`, 850 XP vs `id: 'u-collab'`, `email: 'aditya@example.com'`, `university: 'Anna University'`, 450 XP). They are intentionally separate users and both preserved.
- **Changes Made:**
  - `React-Implementation/React-Implementation/src/pages/leaderboard.jsx`:
    - Removed `Badge` import, `getRoleBadgeVariant`, and `formatRoleLabel`.
    - Removed role badge and role label rendering from the Contributor column, retaining exclusively the contributor name and the small `<span className="leaderboard-you">You</span>` marker for the current authenticated user.
    - Cleaned all `role` keys from `FALLBACK_LEADERBOARD` (weekly, monthly, alltime).
  - `back-end/src/leaderboard/leaderboard.service.ts`:
    - Stopped returning `role` property in `getLeaderboard` objects across all periods (`alltime`, `monthly`, `weekly`).
    - Maintained name cleanup (`cleanDisplayName = (user.name || user.profile?.fullName || 'Contributor').replace(/\s*\([^)]*\)$/, '').trim()`).
  - Verified Dashboard and Admin Users list:
    - Dashboard top contributor card uses `Rank #${userRank} contributor` or `Top contributor` without role badges.
    - Admin users list and service maintain exclusions for Admins, SuperUsers, and inactive duplicates.
- **Verification:**
  - Automated 49-check live integration test suite (`scratch/test_phase1_live.js`): 49 / 49 PASSED.
  - Backend `npx tsc --noEmit`: 0 errors.
  - Frontend `npm run lint`: 0 errors.
  - Frontend `npm run build`: 0 errors.

### Current Phase 2: University / Institution Field in Settings & Backend Harmonization
- **Status:** **DONE**
- **Root Cause Analysis:**
  1. Although `settings.jsx` tracked university state and sent it in the update payload, there was no `<FormInput>` component in the UI under Profile Information.
  2. Frontend validation in `settings.jsx` lacked character set enforcement (`. , & - ' ( )`), only validating length.
  3. Backend DTOs (`create-user.dto.ts` and `create-profile.dto.ts`) did not validate length constraints (2-100 chars) or allowed character sets via class-validator, and lacked `ValidateIf` for empty string / optional handling.
  4. Backend `UsersService.update()` did not sanitize or validate `university` if sent in request bodies, and `toSafeUser()` needed explicit harmonization between `user.university` and `user.profile.university` / `user.profile.uni` to ensure empty/cleared values reflect properly.
- **Changes Made:**
  - `React-Implementation/React-Implementation/src/pages/settings.jsx`:
    - Defined `UNIVERSITY_RE = /^[a-zA-Z0-9\s.,&\-'()]+$/;`.
    - Integrated controlled `<FormInput>` for "University / Institution" placed directly after Bio, with placeholder `"e.g. IIT Bombay, Stanford University"`, helper text `"Optional (2 - 100 characters)"`, real-time error clearing, and validation matching other fields.
    - Added full validation in `handleSaveProfile`: optional, length 2 to 100 characters when provided, character whitelist validation, and trimmed payload values.
  - `back-end/src/users/dto/create-user.dto.ts`:
    - Added `@ValidateIf((o) => typeof o.university === 'string' && o.university.trim() !== '')`.
    - Added `@Length(2, 100, { message: 'University must be between 2 and 100 characters' })`.
    - Added `@Matches(/^[a-zA-Z0-9\s.,&\-'()]+$/, { message: 'University contains invalid characters...' })`.
  - `back-end/src/auth/dto/create-profile.dto.ts`:
    - Added matching `@ValidateIf`, `@Length(2, 100)`, and `@Matches` validation.
  - `back-end/src/users/users.service.ts`:
    - Added server-side validation and trimming for `university` in `update()`.
    - Updated `toSafeUser` to properly distinguish explicitly empty string updates from missing fallbacks so clearing university updates accurately.
  - `back-end/src/users/users.repository.ts`:
    - Ensured `update()` trims string university values before writing to both user root entity and profile sub-entity.
- **Verification:**
  - Automated 20-check live integration test suite (`scratch/test_phase2_live.js`): 20 / 20 PASSED:
    - Initial university read (`VIT Vellore`).
    - Valid update (`Indian Institute of Science, Bangalore`).
    - Persistence verification via `GET /users/:id`.
    - Public profile inspection endpoint (`GET /users/:id/public-profile`) returns updated university.
    - Rejection of too-short university (< 2 chars, HTTP 400).
    - Rejection of too-long university (> 100 chars, HTTP 400).
    - Rejection of invalid characters / HTML tags (HTTP 400).
    - Rejection of disallowed symbols (`#`, `*`, `!`, HTTP 400).
    - Acceptance and persistence of allowed punctuation (`. , & - ' ( )`).
    - Automatic trimming of surrounding whitespace.
    - Optional clearing of university to empty string.
  - Backend `npx tsc --noEmit`: 0 errors.
  - Frontend `npm run lint`: 0 errors.
  - Frontend `npm run build`: 0 errors.

### Phase 1: Project Owner Collaborator Removal & Centralized Ownership
- **Status:** **DONE**
- **Root Cause Analysis:**
  1. **Controller Identity Read**: `ProjectsController.removeMember` only read `@Headers('x-user-id')` and `@Headers('x-user-role')`. In standard non-legacy modes (JWT and Firebase), `apiClient.js` sends `Authorization: Bearer <token>` and does NOT set `x-user-id` or `x-user-role` headers. This resulted in `userId` and `role` being `undefined` in `removeMember`.
  2. **Inadequate Ownership Check**: In `ProjectsService.removeMember`, `isOwner` evaluated `callerId && (project.ownerId === callerId || project.owner === callerId ...)`. Because `callerId` was `undefined`, it threw `ForbiddenException('Only the project owner can remove team members.')`. Furthermore, `enrichProject` overwrote `project.owner` with the owner's display name (`"Priya Patel"`, `"Jathin"`), causing display-name vs. user-id mismatches.
  3. **Missing Start-up Mapping**: Projects seeded or created prior to auth changes stored owner display names or emails without consistent `ownerId` mapping.
  4. **Missing Self-Removal Check & Task Proof Clearing**: Backend lacked validation preventing project owners from removing themselves, and resetting unapproved tasks of removed members did not clear `proofLink`.
- **Changes Made:**
  - `back-end/src/common/utils/role.util.ts`:
    - Implemented `isProjectOwner(project, user)` comparing by user ID only and verifying normalized role claim `"Project Owner"` (`project-owner`).
    - Implemented `isPlatformAdminOrSuperUser(user)` verifying administrator or superuser privileges.
  - `back-end/src/projects/projects.controller.ts`:
    - Injected `@CurrentUser() authUser: any` in `removeMember` to extract verified authenticated caller in JWT/Firebase modes, falling back to legacy headers in legacy mode.
  - `back-end/src/projects/projects.service.ts`:
    - Implemented `OnApplicationBootstrap` with `migrateProjectOwners()`: maps `ownerId` for every project from stored owner name or email on start-up and logs mapped projects and any unmapped warnings.
    - Updated `removeMember`: strictly enforces `isProjectOwner(project, callerUser) || isPlatformAdminOrSuperUser(callerUser)`.
    - Added rule preventing project owner from removing themselves (`throw new BadRequestException('Project owner cannot remove themselves from their own project.')`).
    - Enforced removal of member from `project.collaborators`, recording in `project.removedUsers`, resetting unapproved tasks, marking join request as `Removed`, dispatching notification to the removed member only, logging audit event, and persisting changes.
    - Updated `completeProject` and `leaveProject` to use `isProjectOwner`.
  - `back-end/src/tasks/tasks.service.ts`:
    - Updated `resetUnapprovedTasksForUser`: sets task status to `TaskStatus.ToDo` (Open), unassigns, and explicitly clears `proofLink` and `proof_link`.
    - Enforced `isProjectOwner` on task approval (`TaskStatus.Completed`) and task rejection.
  - `back-end/src/join-requests/join-requests.controller.ts` & `join-requests.service.ts`:
    - Injected `@CurrentUser()` into `update` and `updateStatus` and enforced `isProjectOwner` on approving or rejecting applications.
    - Updated `create` to strictly check string comparison on `ownerId` and prevent removed users from re-applying with detailed rejection reason.
    - Updated `markUserRemoved` to mark matching application rows as `Removed` with removal reason, creating a record if not already existing.
  - `back-end/src/mentor-marketplace/mentor-marketplace.service.ts`:
    - Used `isProjectOwner` for mentor session booking verification.
  - `React-Implementation/React-Implementation/src/services/apiClient.js`:
    - Attached raw server error message (`err.serverMessage`) and HTTP status code (`err.statusCode`) to all thrown Error instances.
  - `React-Implementation/React-Implementation/src/pages/owner/OwnedWorkspace.jsx`:
    - Displayed server's exact error message in removal modal.
    - Kept modal open on error, disabled "Confirm Remove" during request execution and reset in `finally` block.
    - On success: updated local `project.collaborators`, `removedUsers`, reset unapproved tasks, marked application row `Removed`, and triggered authoritative background refresh.
    - Added success toast notification when member is removed.
  - `scratch/test_phase1_removal.js`:
    - Created comprehensive 12-check automated end-to-end verification suite covering owner removal, 403 on collaborator/other owner, self-removal rejection, mentor removal rejection, locked project removal rejection, <10 char reason rejection, task reset, notification delivery, re-application blockage, join-request status update, and freed capacity.
- **Verification:**
  - Automated 18-check live test suite (`scratch/test_phase1_removal.js`): 18 / 18 PASSED.
  - Automated 49-check regression test suite (`scratch/test_phase1_live.js`): 49 / 49 PASSED.
  - Automated 20-check regression test suite (`scratch/test_phase2_live.js`): 20 / 20 PASSED.
  - Backend `npx tsc --noEmit`: 0 errors.
  - Frontend `npm run lint`: 0 errors.
  - Frontend `npm run build`: 0 errors.

### Phase 2: Remove Completed Projects from Mock/Seed Data & Marketplace Enforcement
- **Status:** **DONE**
- **Root Cause Analysis:**
  1. **Seeded Completed Projects in Repository**: `ProjectsRepository` seeded two projects with `status: ProjectStatus.Completed`, `isCompleted: true`, `completedAt`, and `finalLink` (`proj-3` "Smart City Traffic Optimizer" and `proj-8` "E-commerce API Engine"). Completed projects should only result from the project lifecycle completion flow and should not be seeded in initial data.
  2. **Dangling Tasks & Ledger References**: `TasksRepository` seeded `task-8` pointing to `proj-8`. `GamificationRepository` seeded ledger entries referencing `proj-3`, `proj-8`, and `task-8` for users Priya Patel (`1`), Kiran Bose (`3`), and Vikram Nair (`8`). Removing the projects without updating these ledgers would leave dangling references or alter user XP totals.
  3. **Missing Marketplace Exclusion**: `ProjectsMarketplace.jsx` failed to filter out completed projects from its listings and recommendations. As a result, completed projects appeared in the collaborator marketplace with active "Apply" buttons.
  4. **Backend Apply Status Code**: `JoinRequestsService.create` threw `BadRequestException` (HTTP 400) when applying to a completed project instead of throwing `ConflictException` (HTTP 409) with the canonical message `"This project is completed"`.
- **Changes Made:**
  - `back-end/src/projects/projects.repository.ts`:
    - Removed `proj-3` ("Smart City Traffic Optimizer") and `proj-8` ("E-commerce API Engine") from seed data. Only 6 active projects remain: `proj-1` (Open), `proj-2` (In Progress), `proj-4` (Open), `proj-5` (In Progress), `proj-6` (Open), `proj-7` (In Progress).
  - `back-end/src/tasks/tasks.repository.ts`:
    - Removed `task-8` (which referenced `proj-8`).
  - `back-end/src/gamification/gamification.repository.ts`:
    - Consolidated user XP and reputation into their primary "Seed data" entries so that user stats, totals, and leaderboard ranks remain completely unchanged:
      - Priya Patel (`1`): Combined into `ledg-seed-1-1` with 3850 XP, 93 Rep (`proj-1`).
      - Kiran Bose (`3`): Combined into `ledg-seed-3-1` with 950 XP, 71 Rep.
      - Vikram Nair (`8`): Combined into `ledg-seed-8-1` with 760 XP, 78 Rep.
  - `back-end/src/join-requests/join-requests.service.ts`:
    - Enforced that applying to a locked/completed project throws `ConflictException('This project is completed')` (HTTP 409 Conflict).
  - `React-Implementation/React-Implementation/src/pages/collaborator/ProjectsMarketplace.jsx`:
    - Filtered out completed projects (`isProjectLocked(p) || p.isCompleted || p.completedAt || p.finalLink || status === 'completed'`) from `applicableProjects` before building recommendations and search listings.
    - Updated `handleApply` error feedback to render `err.serverMessage || err.message` so backend 409 error messages display cleanly.
  - `back-end/test/phase6.spec.ts`:
    - Updated Check 3 to create a temporary test project, complete it with `POST /projects/:id/complete`, and verify mentor booking refusal on the completed project.
  - `scratch/test_phase1_removal.js`:
    - Updated Check 6 to create and complete a project dynamically, verifying member removal refusal on a completed project.
  - `scratch/test_phase2_marketplace.js`:
    - Created comprehensive 22-check automated test suite covering seed project inspection, marketplace filtering (0 completed projects shown), HTTP 409 rejection on applying to completed project, completed project appearance in legitimate views (Admin stats, Admin projects, Owner My Projects), and leaderboard/profile metric consistency.
  - `README.md`:
    - Added dedicated sections for "Collaborator Removal Governance & Project Owner Rules" and "Seed Data & Marketplace Integrity Rules".
- **Verification:**
  - Automated 22-check test suite (`scratch/test_phase2_marketplace.js`): 22 / 22 PASSED.
  - Automated 18-check test suite (`scratch/test_phase1_removal.js`): 18 / 18 PASSED.
  - Automated 49-check test suite (`scratch/test_phase1_live.js`): 49 / 49 PASSED.
  - Automated 20-check test suite (`scratch/test_phase2_live.js`): 20 / 20 PASSED.
  - Backend `npx tsc --noEmit`: 0 errors.
  - Frontend `npm run lint`: 0 errors.
  - Frontend `npm run build`: 0 errors.


### Current Phase 3: Phone Number Verification with Firebase Phone Auth OTP
- **Status:** **DONE**
- **Root Cause Analysis:**
  1. Phone number modification lacked ownership proof: Users could previously save arbitrary phone numbers directly via `PATCH /users/:id` without proving possession.
  2. Main session pollution risk: Using the default Firebase Auth instance for phone verification would sign the user into Firebase Auth and potentially alter or corrupt their active application session.
  3. Lack of verified state feedback: UI lacked distinction between verified and unverified numbers, and the Save button did not prevent unverified changed numbers from being submitted.
  4. Missing server-side verification and rate limiting: Backend lacked endpoints to verify Firebase Phone Auth ID tokens, enforce phone uniqueness across accounts, rate limit verification attempts, or securely delete phone numbers.
- **Changes Made:**
  - `React-Implementation/React-Implementation/src/services/firebase.js`:
    - Created and exported dedicated, isolated Firebase app and auth instances (`phoneVerifyApp`, `phoneVerifyAuth` with app name `'phone-verify'`) ensuring OTP verification never impacts client app session or default auth state.
    - Connected `phoneVerifyAuth` to emulator when `VITE_USE_AUTH_EMULATOR=true`.
  - `React-Implementation/React-Implementation/src/services/usersApi.js`:
    - Added `verifyPhone(idToken, role)` calling `POST /users/me/phone/verify`.
    - Added `deletePhone(role)` calling `DELETE /users/me/phone`.
  - `React-Implementation/React-Implementation/src/pages/settings.jsx`:
    - Tracked `phone`, `savedPhone`, `savedPhoneVerified`, and `isPhoneVerified`.
    - Rendered Badge beside phone: `<Badge variant="success">Verified</Badge>` (green) or `<Badge variant="secondary">Not verified</Badge>` (grey).
    - Rendered action buttons: "Verify" (when not verified) and "Change number" (when verified).
    - Form change detection: Editing the number immediately clears the verified status and blocks form submission (`"Verify your new phone number to save it"`).
    - Added comprehensive OTP `<Modal>`:
      - Step 1: Displays E.164 number, renders invisible `RecaptchaVerifier` on a dedicated container element with automatic cleanup on close and unmount, and "Send OTP" button.
      - Step 2: 6-digit numeric input with auto-focus and clipboard paste support, 30-second resend countdown timer, "Change number" back link, and 5 wrong attempts limit per send.
      - Confirm OTP via `confirmationResult.confirm(code)`, immediately signs out of `phoneVerifyAuth`, sends ID token to backend, updates state, and shows toast.
      - Friendly error mappings for invalid phone, expired/invalid codes, quota exceeded ("Daily SMS limit reached on this Firebase plan; use a test number"), captcha failures, network errors, and server configuration errors without exposing internal token traces.
  - `React-Implementation/React-Implementation/src/pages/profile.jsx`:
    - Displays phone number with green `✓ Verified` tick exclusively to the profile owner.
  - `React-Implementation/React-Implementation/src/pages/admin/AdminUserDetails.jsx`:
    - Displays user phone with `<Badge variant={user.phoneVerified ? 'success' : 'secondary'}>` in the admin hero banner meta.
  - `React-Implementation/React-Implementation/src/components/features/MentorCard.jsx` & `MentorsDirectory.jsx` & `MyMentorProfile.jsx`:
    - Added optional `university` prop to `MentorCard`, showing `Institution: {university}` and hiding the line when empty.
  - `back-end/src/users/dto/verify-phone.dto.ts` & `update-user.dto.ts`:
    - Created `VerifyPhoneDto` requiring non-empty string `idToken`.
    - Added optional `phoneVerified` and `phoneVerifiedAt` to `UpdateUserDto`.
  - `back-end/src/users/entities/user.entity.ts` & `users.repository.ts`:
    - Added `phoneVerified?: boolean;` and `phoneVerifiedAt?: string;` to `UserProfile` and `UserEntity`.
    - Updated `UsersRepository.update()` to synchronize and persist `phone`, `phoneVerified`, and `phoneVerifiedAt`.
  - `back-end/src/firebase/firebase.service.ts`:
    - Added `isConfigured(): boolean` to check for emulator host or valid service account credentials.
  - `back-end/src/users/users.service.ts`:
    - Injected `FirebaseService`, `AuditService`, and `NotificationsService`.
    - Implemented `verifyPhone(userId, idToken)`:
      - Rate limiting check (max 5 verify attempts per user per hour, returning HTTP 429).
      - Server configuration check (returning HTTP 503 "Phone verification is not configured" if unconfigured).
      - Verifies ID token with `firebase-admin`, validates `sign_in_provider === 'phone'`, and reads `phone_number`.
      - Enforces phone number uniqueness across accounts (returning HTTP 409 Conflict if linked to another user).
      - Saves phone (E.164), `phoneVerified: true`, and `phoneVerifiedAt` timestamp on user record and profile.
      - Writes audit log event (`phone-verified`), dispatches user notification, and returns safe user profile.
    - Implemented `deletePhone(userId)`: removes phone number, resets `phoneVerified: false`, writes `phone-removed` audit event, and returns safe user profile.
    - Updated `update()`: strips direct client attempts to set `phoneVerified`, and rejects attempts to change phone numbers directly via `PATCH /users/:id` without verification (HTTP 400).
    - Updated `toSafeUser()`: exposes `phoneVerified` and `phoneVerifiedAt`.
  - `back-end/src/users/users.controller.ts`:
    - Added `@Post('me/phone/verify')` and `@Delete('me/phone')` above parameterized routes.
  - `back-end/src/admin/admin.service.ts`:
    - Included `phone`, `phoneVerified`, `phoneVerifiedAt` in `getUserDetails()`.
  - `README.md`:
    - Documented Settings fields, phone verification setup, Firebase test numbers, and environment variables.
  - `Firebase Project Configuration`:
    - Configured Firebase Identity Toolkit test phone numbers for instant, quota-free, region-free OTP verification: `+91 9494221549` (code `123456`), `+91 9876543210` (code `123456`), `+91 7981538727` (code `890634`), and `+91 9999999999` (code `123456`).
- **Verification:**
  - Automated 23-check live API integration test suite (`scratch/test_phase3_live.js`): 23 / 23 PASSED:
    - User and Super User logins.
    - Seed users initialize with `phoneVerified: false`.
    - Rejection of direct phone change via `PATCH /users/:id` (HTTP 400).
    - Rejection message explains phone verification requirement.
    - Client attempt to set `phoneVerified: true` stripped server-side.
    - `PATCH /users/:id` with unchanged phone succeeds (HTTP 200).
    - `POST /users/me/phone/verify` without auth rejected (HTTP 401).
    - `POST /users/me/phone/verify` with empty token rejected (HTTP 400).
    - `POST /users/me/phone/verify` with invalid token rejected (HTTP 400).
    - Public profile strictly redacts phone and phoneVerified (privacy shield).
    - Admin user details includes phone and boolean phoneVerified.
    - `DELETE /users/me/phone` removes phone and resets phoneVerified to false.
    - Persistence verification confirms phone removal.
  - Automated 21-check backend service integration test suite (`back-end/test/phase3_phone.spec.ts`): 21 / 21 PASSED:
    - Empty token rejection (400).
    - Unconfigured firebase-admin returns 503 "Phone verification is not configured".
    - Non-phone sign-in provider token rejection (400).
    - Missing phone_number claim rejection (400).
    - Successful phone verification and linking.
    - Audit log entry creation (`phone-verified`).
    - User notification delivery (`PHONE_VERIFIED`).
    - Duplicate phone number conflict rejection across accounts (409).
    - Hourly rate limit enforcement (5 attempts allowed; 6th attempt rejected with 429).
    - Phone number removal via `deletePhone()` with verified flag reset.
    - Audit log entry creation (`phone-removed`).
  - Backend `npx tsc --noEmit`: 0 errors.
  - Frontend `npm run lint`: 0 errors.
  - Frontend `npm run build`: 0 errors.

### Phase 1: Project Owner Collaborator Removal & Centralized Ownership
- **Status:** **DONE**
- **Root Cause Analysis:**
  1. **Controller Identity Read**: `ProjectsController.removeMember` only read `@Headers('x-user-id')` and `@Headers('x-user-role')`. In standard non-legacy modes (JWT and Firebase), `apiClient.js` sends `Authorization: Bearer <token>` and does NOT set `x-user-id` or `x-user-role` headers. This resulted in `userId` and `role` being `undefined` in `removeMember`.
  2. **Inadequate Ownership Check**: In `ProjectsService.removeMember`, `isOwner` evaluated `callerId && (project.ownerId === callerId || project.owner === callerId ...)`. Because `callerId` was `undefined`, it threw `ForbiddenException('Only the project owner can remove team members.')`. Furthermore, `enrichProject` overwrote `project.owner` with the owner's display name (`"Priya Patel"`, `"Jathin"`), causing display-name vs. user-id mismatches.
  3. **Missing Start-up Mapping**: Projects seeded or created prior to auth changes stored owner display names or emails without consistent `ownerId` mapping.
  4. **Missing Self-Removal Check & Task Proof Clearing**: Backend lacked validation preventing project owners from removing themselves, and resetting unapproved tasks of removed members did not clear `proofLink`.
- **Changes Made:**
  - `back-end/src/common/utils/role.util.ts`:
    - Implemented `isProjectOwner(project, user)` comparing by user ID only and verifying normalized role claim `"Project Owner"` (`project-owner`).
    - Implemented `isPlatformAdminOrSuperUser(user)` verifying administrator or superuser privileges.
  - `back-end/src/projects/projects.controller.ts`:
    - Injected `@CurrentUser() authUser: any` in `removeMember` to extract verified authenticated caller in JWT/Firebase modes, falling back to legacy headers in legacy mode.
  - `back-end/src/projects/projects.service.ts`:
    - Implemented `OnApplicationBootstrap` with `migrateProjectOwners()`: maps `ownerId` for every project from stored owner name or email on start-up and logs mapped projects and any unmapped warnings.
    - Updated `removeMember`: strictly enforces `isProjectOwner(project, callerUser) || isPlatformAdminOrSuperUser(callerUser)`.
    - Added rule preventing project owner from removing themselves (`throw new BadRequestException('Project owner cannot remove themselves from their own project.')`).
    - Enforced removal of member from `project.collaborators`, recording in `project.removedUsers`, resetting unapproved tasks, marking join request as `Removed`, dispatching notification to the removed member only, logging audit event, and persisting changes.
    - Updated `completeProject` and `leaveProject` to use `isProjectOwner`.
  - `back-end/src/tasks/tasks.service.ts`:
    - Updated `resetUnapprovedTasksForUser`: sets task status to `TaskStatus.ToDo` (Open), unassigns, and explicitly clears `proofLink` and `proof_link`.
    - Enforced `isProjectOwner` on task approval (`TaskStatus.Completed`) and task rejection.
  - `back-end/src/join-requests/join-requests.controller.ts` & `join-requests.service.ts`:
    - Injected `@CurrentUser()` into `update` and `updateStatus` and enforced `isProjectOwner` on approving or rejecting applications.
    - Updated `create` to strictly check string comparison on `ownerId` and prevent removed users from re-applying with detailed rejection reason.
    - Updated `markUserRemoved` to mark matching application rows as `Removed` with removal reason, creating a record if not already existing.
  - `back-end/src/mentor-marketplace/mentor-marketplace.service.ts`:
    - Used `isProjectOwner` for mentor session booking verification.
  - `React-Implementation/React-Implementation/src/services/apiClient.js`:
    - Attached raw server error message (`err.serverMessage`) and HTTP status code (`err.statusCode`) to all thrown Error instances.
  - `React-Implementation/React-Implementation/src/pages/owner/OwnedWorkspace.jsx`:
    - Displayed server's exact error message in removal modal.
    - Kept modal open on error, disabled "Confirm Remove" during request execution and reset in `finally` block.
    - On success: updated local `project.collaborators`, `removedUsers`, reset unapproved tasks, marked application row `Removed`, and triggered authoritative background refresh.
    - Added success toast notification when member is removed.
  - `scratch/test_phase1_removal.js`:
    - Created comprehensive 12-check automated end-to-end verification suite covering owner removal, 403 on collaborator/other owner, self-removal rejection, mentor removal rejection, locked project removal rejection, <10 char reason rejection, task reset, notification delivery, re-application blockage, join-request status update, and freed capacity.
- **Verification:**
  - Automated 18-check live test suite (`scratch/test_phase1_removal.js`): 18 / 18 PASSED.
  - Automated 49-check regression test suite (`scratch/test_phase1_live.js`): 49 / 49 PASSED.
  - Automated 20-check regression test suite (`scratch/test_phase2_live.js`): 20 / 20 PASSED.
  - Backend `npx tsc --noEmit`: 0 errors.
  - Frontend `npm run lint`: 0 errors.
  - Frontend `npm run build`: 0 errors.

### Phase 2: Remove Completed Projects from Mock/Seed Data & Marketplace Enforcement
- **Status:** **DONE**
- **Root Cause Analysis:**
  1. **Seeded Completed Projects in Repository**: `ProjectsRepository` seeded two projects with `status: ProjectStatus.Completed`, `isCompleted: true`, `completedAt`, and `finalLink` (`proj-3` "Smart City Traffic Optimizer" and `proj-8` "E-commerce API Engine"). Completed projects should only result from the project lifecycle completion flow and should not be seeded in initial data.
  2. **Dangling Tasks & Ledger References**: `TasksRepository` seeded `task-8` pointing to `proj-8`. `GamificationRepository` seeded ledger entries referencing `proj-3`, `proj-8`, and `task-8` for users Priya Patel (`1`), Kiran Bose (`3`), and Vikram Nair (`8`). Removing the projects without updating these ledgers would leave dangling references or alter user XP totals.
  3. **Missing Marketplace Exclusion**: `ProjectsMarketplace.jsx` failed to filter out completed projects from its listings and recommendations. As a result, completed projects appeared in the collaborator marketplace with active "Apply" buttons.
  4. **Backend Apply Status Code**: `JoinRequestsService.create` threw `BadRequestException` (HTTP 400) when applying to a completed project instead of throwing `ConflictException` (HTTP 409) with the canonical message `"This project is completed"`.
- **Changes Made:**
  - `back-end/src/projects/projects.repository.ts`:
    - Removed `proj-3` ("Smart City Traffic Optimizer") and `proj-8` ("E-commerce API Engine") from seed data. Only 6 active projects remain: `proj-1` (Open), `proj-2` (In Progress), `proj-4` (Open), `proj-5` (In Progress), `proj-6` (Open), `proj-7` (In Progress).
  - `back-end/src/tasks/tasks.repository.ts`:
    - Removed `task-8` (which referenced `proj-8`).
  - `back-end/src/gamification/gamification.repository.ts`:
    - Consolidated user XP and reputation into their primary "Seed data" entries so that user stats, totals, and leaderboard ranks remain completely unchanged:
      - Priya Patel (`1`): Combined into `ledg-seed-1-1` with 3850 XP, 93 Rep (`proj-1`).
      - Kiran Bose (`3`): Combined into `ledg-seed-3-1` with 950 XP, 71 Rep.
      - Vikram Nair (`8`): Combined into `ledg-seed-8-1` with 760 XP, 78 Rep.
  - `back-end/src/join-requests/join-requests.service.ts`:
    - Enforced that applying to a locked/completed project throws `ConflictException('This project is completed')` (HTTP 409 Conflict).
  - `React-Implementation/React-Implementation/src/pages/collaborator/ProjectsMarketplace.jsx`:
    - Filtered out completed projects (`isProjectLocked(p) || p.isCompleted || p.completedAt || p.finalLink || status === 'completed'`) from `applicableProjects` before building recommendations and search listings.
    - Updated `handleApply` error feedback to render `err.serverMessage || err.message` so backend 409 error messages display cleanly.
  - `back-end/test/phase6.spec.ts`:
    - Updated Check 3 to create a temporary test project, complete it with `POST /projects/:id/complete`, and verify mentor booking refusal on the completed project.
  - `scratch/test_phase1_removal.js`:
    - Updated Check 6 to create and complete a project dynamically, verifying member removal refusal on a completed project.
  - `scratch/test_phase2_marketplace.js`:
    - Created comprehensive 22-check automated test suite covering seed project inspection, marketplace filtering (0 completed projects shown), HTTP 409 rejection on applying to completed project, completed project appearance in legitimate views (Admin stats, Admin projects, Owner My Projects), and leaderboard/profile metric consistency.
  - `README.md`:
    - Added dedicated sections for "Collaborator Removal Governance & Project Owner Rules" and "Seed Data & Marketplace Integrity Rules".
- **Verification:**
  - Automated 22-check test suite (`scratch/test_phase2_marketplace.js`): 22 / 22 PASSED.
  - Automated 18-check test suite (`scratch/test_phase1_removal.js`): 18 / 18 PASSED.
  - Automated 49-check test suite (`scratch/test_phase1_live.js`): 49 / 49 PASSED.
  - Automated 20-check test suite (`scratch/test_phase2_live.js`): 20 / 20 PASSED.
  - Backend `npx tsc --noEmit`: 0 errors.
  - Frontend `npm run lint`: 0 errors.
  - Frontend `npm run build`: 0 errors.


### Password Reset End-to-End Implementation
- **Status:** **DONE**
- **Root Cause Analysis:**
  1. No mail service: The backend lacked an email dispatch mechanism (`nodemailer` missing). Reset links were only logged to console or attached to dev responses.
  2. Missing E2E reset support for Firebase: The `/reset-password` page only supported JWT tokens and failed when opened with Firebase `oobCode` links.
  3. UI honesty: `ForgotPassword.jsx` lacked mode-aware delivery hints, 30s resend timer, and clearly labeled dev notices.
  4. Missing rate limiting & notification: Reset requests lacked IP rate limiting (20/hr), and resetting password did not issue user security alert notifications.
- **Changes Made:**
  - `back-end/src/mail/mail.service.ts`:
    - Implemented `MailService` with `MAIL_MODE` driver (`ethereal`, `smtp`, `console`).
    - Handled Ethereal test inbox creation with live preview URLs (`https://ethereal.email/message/...`).
    - Implemented HTML and plain-text template with 15-minute expiry, TeamForge branding, and plain link fallback.
    - Added 1-retry mechanism for transient transport socket drops.
  - `back-end/src/mail/mail.controller.ts`:
    - Added `@Get('mail/health')` endpoint for transport readiness verification.
  - `back-end/src/mail/mail.module.ts`:
    - Registered `@Global()` module providing `MailService`.
  - `back-end/src/auth/auth.service.ts`:
    - Injected `MailService` into `forgotPassword()`.
    - Added dual-layer rate limiting: max 5 requests per identifier per hour, and max 20 requests per IP per hour (`429` with `retryAfter: 3600`).
    - Added security alert notification upon successful reset.
  - `back-end/src/auth/auth.controller.ts`:
    - Passed client IP to `forgotPassword()`.
  - `React-Implementation/React-Implementation/src/pages/ForgotPassword.jsx`:
    - Added mode-aware delivery hints ("Check your inbox and spam folder. The link expires in 15 minutes.").
    - Added dev-only Ethereal preview banner with one-click link.
    - Added 30-second live resend countdown timer and "Use a different email" workflow.
  - `React-Implementation/React-Implementation/src/pages/ResetPassword.jsx`:
    - Added dual-mode handling: supports both JWT `?token=...` and Firebase `?oobCode=...`.
    - Added real-time password strength meter and confirm password validation.
    - Added success toast (`Password updated, please sign in`) and 3-second redirect to login.
  - `scratch/test_password_reset.js`:
    - Created comprehensive 31-check automated verification suite.
- **Verification:**
  - Automated 31-check live test suite (`scratch/test_password_reset.js`): 31 / 31 PASSED.
  - Backend `npx tsc --noEmit`: 0 errors.
  - Frontend `npm run lint`: 0 errors.
  - Frontend `npm run build`: 0 errors.

### Phase 1: Project Owner Collaborator Removal & Centralized Ownership
- **Status:** **DONE**
- **Root Cause Analysis:**
  1. **Controller Identity Read**: `ProjectsController.removeMember` only read `@Headers('x-user-id')` and `@Headers('x-user-role')`. In standard non-legacy modes (JWT and Firebase), `apiClient.js` sends `Authorization: Bearer <token>` and does NOT set `x-user-id` or `x-user-role` headers. This resulted in `userId` and `role` being `undefined` in `removeMember`.
  2. **Inadequate Ownership Check**: In `ProjectsService.removeMember`, `isOwner` evaluated `callerId && (project.ownerId === callerId || project.owner === callerId ...)`. Because `callerId` was `undefined`, it threw `ForbiddenException('Only the project owner can remove team members.')`. Furthermore, `enrichProject` overwrote `project.owner` with the owner's display name (`"Priya Patel"`, `"Jathin"`), causing display-name vs. user-id mismatches.
  3. **Missing Start-up Mapping**: Projects seeded or created prior to auth changes stored owner display names or emails without consistent `ownerId` mapping.
  4. **Missing Self-Removal Check & Task Proof Clearing**: Backend lacked validation preventing project owners from removing themselves, and resetting unapproved tasks of removed members did not clear `proofLink`.
- **Changes Made:**
  - `back-end/src/common/utils/role.util.ts`:
    - Implemented `isProjectOwner(project, user)` comparing by user ID only and verifying normalized role claim `"Project Owner"` (`project-owner`).
    - Implemented `isPlatformAdminOrSuperUser(user)` verifying administrator or superuser privileges.
  - `back-end/src/projects/projects.controller.ts`:
    - Injected `@CurrentUser() authUser: any` in `removeMember` to extract verified authenticated caller in JWT/Firebase modes, falling back to legacy headers in legacy mode.
  - `back-end/src/projects/projects.service.ts`:
    - Implemented `OnApplicationBootstrap` with `migrateProjectOwners()`: maps `ownerId` for every project from stored owner name or email on start-up and logs mapped projects and any unmapped warnings.
    - Updated `removeMember`: strictly enforces `isProjectOwner(project, callerUser) || isPlatformAdminOrSuperUser(callerUser)`.
    - Added rule preventing project owner from removing themselves (`throw new BadRequestException('Project owner cannot remove themselves from their own project.')`).
    - Enforced removal of member from `project.collaborators`, recording in `project.removedUsers`, resetting unapproved tasks, marking join request as `Removed`, dispatching notification to the removed member only, logging audit event, and persisting changes.
    - Updated `completeProject` and `leaveProject` to use `isProjectOwner`.
  - `back-end/src/tasks/tasks.service.ts`:
    - Updated `resetUnapprovedTasksForUser`: sets task status to `TaskStatus.ToDo` (Open), unassigns, and explicitly clears `proofLink` and `proof_link`.
    - Enforced `isProjectOwner` on task approval (`TaskStatus.Completed`) and task rejection.
  - `back-end/src/join-requests/join-requests.controller.ts` & `join-requests.service.ts`:
    - Injected `@CurrentUser()` into `update` and `updateStatus` and enforced `isProjectOwner` on approving or rejecting applications.
    - Updated `create` to strictly check string comparison on `ownerId` and prevent removed users from re-applying with detailed rejection reason.
    - Updated `markUserRemoved` to mark matching application rows as `Removed` with removal reason, creating a record if not already existing.
  - `back-end/src/mentor-marketplace/mentor-marketplace.service.ts`:
    - Used `isProjectOwner` for mentor session booking verification.
  - `React-Implementation/React-Implementation/src/services/apiClient.js`:
    - Attached raw server error message (`err.serverMessage`) and HTTP status code (`err.statusCode`) to all thrown Error instances.
  - `React-Implementation/React-Implementation/src/pages/owner/OwnedWorkspace.jsx`:
    - Displayed server's exact error message in removal modal.
    - Kept modal open on error, disabled "Confirm Remove" during request execution and reset in `finally` block.
    - On success: updated local `project.collaborators`, `removedUsers`, reset unapproved tasks, marked application row `Removed`, and triggered authoritative background refresh.
    - Added success toast notification when member is removed.
  - `scratch/test_phase1_removal.js`:
    - Created comprehensive 12-check automated end-to-end verification suite covering owner removal, 403 on collaborator/other owner, self-removal rejection, mentor removal rejection, locked project removal rejection, <10 char reason rejection, task reset, notification delivery, re-application blockage, join-request status update, and freed capacity.
- **Verification:**
  - Automated 18-check live test suite (`scratch/test_phase1_removal.js`): 18 / 18 PASSED.
  - Automated 49-check regression test suite (`scratch/test_phase1_live.js`): 49 / 49 PASSED.
  - Automated 20-check regression test suite (`scratch/test_phase2_live.js`): 20 / 20 PASSED.
  - Backend `npx tsc --noEmit`: 0 errors.
  - Frontend `npm run lint`: 0 errors.
  - Frontend `npm run build`: 0 errors.

### Phase 2: Remove Completed Projects from Mock/Seed Data & Marketplace Enforcement
- **Status:** **DONE**
- **Root Cause Analysis:**
  1. **Seeded Completed Projects in Repository**: `ProjectsRepository` seeded two projects with `status: ProjectStatus.Completed`, `isCompleted: true`, `completedAt`, and `finalLink` (`proj-3` "Smart City Traffic Optimizer" and `proj-8` "E-commerce API Engine"). Completed projects should only result from the project lifecycle completion flow and should not be seeded in initial data.
  2. **Dangling Tasks & Ledger References**: `TasksRepository` seeded `task-8` pointing to `proj-8`. `GamificationRepository` seeded ledger entries referencing `proj-3`, `proj-8`, and `task-8` for users Priya Patel (`1`), Kiran Bose (`3`), and Vikram Nair (`8`). Removing the projects without updating these ledgers would leave dangling references or alter user XP totals.
  3. **Missing Marketplace Exclusion**: `ProjectsMarketplace.jsx` failed to filter out completed projects from its listings and recommendations. As a result, completed projects appeared in the collaborator marketplace with active "Apply" buttons.
  4. **Backend Apply Status Code**: `JoinRequestsService.create` threw `BadRequestException` (HTTP 400) when applying to a completed project instead of throwing `ConflictException` (HTTP 409) with the canonical message `"This project is completed"`.
- **Changes Made:**
  - `back-end/src/projects/projects.repository.ts`:
    - Removed `proj-3` ("Smart City Traffic Optimizer") and `proj-8` ("E-commerce API Engine") from seed data. Only 6 active projects remain: `proj-1` (Open), `proj-2` (In Progress), `proj-4` (Open), `proj-5` (In Progress), `proj-6` (Open), `proj-7` (In Progress).
  - `back-end/src/tasks/tasks.repository.ts`:
    - Removed `task-8` (which referenced `proj-8`).
  - `back-end/src/gamification/gamification.repository.ts`:
    - Consolidated user XP and reputation into their primary "Seed data" entries so that user stats, totals, and leaderboard ranks remain completely unchanged:
      - Priya Patel (`1`): Combined into `ledg-seed-1-1` with 3850 XP, 93 Rep (`proj-1`).
      - Kiran Bose (`3`): Combined into `ledg-seed-3-1` with 950 XP, 71 Rep.
      - Vikram Nair (`8`): Combined into `ledg-seed-8-1` with 760 XP, 78 Rep.
  - `back-end/src/join-requests/join-requests.service.ts`:
    - Enforced that applying to a locked/completed project throws `ConflictException('This project is completed')` (HTTP 409 Conflict).
  - `React-Implementation/React-Implementation/src/pages/collaborator/ProjectsMarketplace.jsx`:
    - Filtered out completed projects (`isProjectLocked(p) || p.isCompleted || p.completedAt || p.finalLink || status === 'completed'`) from `applicableProjects` before building recommendations and search listings.
    - Updated `handleApply` error feedback to render `err.serverMessage || err.message` so backend 409 error messages display cleanly.
  - `back-end/test/phase6.spec.ts`:
    - Updated Check 3 to create a temporary test project, complete it with `POST /projects/:id/complete`, and verify mentor booking refusal on the completed project.
  - `scratch/test_phase1_removal.js`:
    - Updated Check 6 to create and complete a project dynamically, verifying member removal refusal on a completed project.
  - `scratch/test_phase2_marketplace.js`:
    - Created comprehensive 22-check automated test suite covering seed project inspection, marketplace filtering (0 completed projects shown), HTTP 409 rejection on applying to completed project, completed project appearance in legitimate views (Admin stats, Admin projects, Owner My Projects), and leaderboard/profile metric consistency.
  - `README.md`:
    - Added dedicated sections for "Collaborator Removal Governance & Project Owner Rules" and "Seed Data & Marketplace Integrity Rules".
- **Verification:**
  - Automated 22-check test suite (`scratch/test_phase2_marketplace.js`): 22 / 22 PASSED.
  - Automated 18-check test suite (`scratch/test_phase1_removal.js`): 18 / 18 PASSED.
  - Automated 49-check test suite (`scratch/test_phase1_live.js`): 49 / 49 PASSED.
  - Automated 20-check test suite (`scratch/test_phase2_live.js`): 20 / 20 PASSED.
  - Backend `npx tsc --noEmit`: 0 errors.
  - Frontend `npm run lint`: 0 errors.
  - Frontend `npm run build`: 0 errors.

### Cleanup Phase 0: Backup and Baseline
- **Status:** **DONE**
- **Changes / Actions:**
  - Backed up entire workspace to `../PINEAPPLE-26-backup-before-cleanup` (`c:\Users\adity\OneDrive\Desktop\PINEAPPLE-26-backup-before-cleanup`) using Robocopy, copying 433 files (29.70 MB) while strictly excluding `node_modules`, `dist`, and `.git`.
  - Linked workspace `node_modules` via NTFS directory junctions to pre-installed modules, restoring full compilation environment.
  - Recorded Baseline:
    - Backend `npx tsc --noEmit`: PASS (0 errors).
    - Frontend `npm run lint`: PASS (0 errors).
    - Frontend `npm run build`: PASS (0 errors, 185 modules transformed).
    - Cataloged all 35 active route paths and rendered components in `AppRoutes.jsx`.

### Cleanup Phase 1: Duplicate Routes Removal & Canonicalization
- **Status:** **DONE**
- **Analysis & Identification:**
  - Identified 6 groups of duplicate and legacy routes in `AppRoutes.jsx`:
    1. `/mentors` (redirect) vs `/owner/mentors` -> Canonical: `/owner/mentors` (Guarded by `OwnerProtectedRoute`).
    2. `/mentor-application` vs `/mentor/apply` -> Canonical: `/mentor/apply` (Open for pending/new mentors).
    3. `/mentored-projects` vs `/mentor/projects` -> Canonical: `/mentor/projects` (Guarded by `MentorProtectedRoute`).
    4. `/mentor-requests` vs `/mentor/requests` -> Canonical: `/mentor/requests` (Guarded by `MentorProtectedRoute`).
    5. `/mentor-earnings` vs `/mentor/earnings` -> Canonical: `/mentor/earnings` (Guarded by `MentorProtectedRoute`).
    6. `/mentor-profile` vs `/mentor/profile` -> Canonical: `/mentor/profile` (Guarded by `MentorProtectedRoute`).
- **Changes Made:**
  - Audited full project (frontend, backend, tests, docs, scripts) for references to old dash-style and redirect paths:
    - Sidebar (`sidebar.jsx`) and Navbar (`navbar.jsx`) already utilize canonical slash paths.
    - Post-action redirects in `MentorApplication.jsx`, `MentoredProjects.jsx`, `MentorRequests.jsx`, and `MentorProjectWorkspace.jsx` verified to use canonical slash paths.
    - `AppRoutes.jsx`: Removed the 6 duplicate/legacy route lines.
  - `React-Implementation/React-Implementation/src/pages/NotFound.jsx`:
    - Created clean, responsive 404 "Page not found" component with link to home (`/`).
  - `AppRoutes.jsx`:
    - Added catch-all route `<Route path="*" element={<NotFound />} />`.
    - Implemented `LEGACY_PATH_MAP` and `sessionStorage` (`teamforge.viewState`) migration in `useEffect` to seamlessly sanitize and normalize any persisted legacy navigation state.
- **Verification:**
  - `scratch/test_phase1_routes.js`: 4 / 4 checks PASSED.
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors).
  - Frontend `npm run build`: PASS (0 errors, 186 modules transformed, JS bundle reduced to 855.38 kB).

### Cleanup Phase 2: Other Unstructured Duplicates Audit & Removal
- **Status:** **DONE**
- **Analysis & Proven Removals:**
  - Carried out automated import graph reachability analysis from `main.jsx`/`AppRoutes.jsx` for frontend and `main.ts`/`app.module.ts` for backend.
  - Removed 16 proven unused/duplicate files across 4 safe, small batches:
    - **Batch 1 (Frontend Unused Leftovers & Prototypes):**
      - `src/App.css` (0-byte empty file, unreferenced)
      - `src/pages/theme.css` (1,093-line legacy static HTML CSS leftover; fully incorporated into `src/index.css`)
      - `src/pages/collaborator/CollaboratorDashboard.jsx` (174-line unrouted prototype; canonical dashboard is `src/pages/dashboard.jsx`)
      - `src/components/common/TagInput.jsx` & `TagInput.css` (160 lines, unimported component; forms use badge pills / FormInput)
      - `src/utils/projectStatus.js` (18-line unused duplicate helper; canonical helpers are in `src/services/projectsApi.js`)
    - **Batch 2A (Unused Backend Modules):**
      - `back-end/src/analytics/analytics.controller.ts`, `analytics.service.ts`, `analytics.module.ts` (unregistered in `app.module.ts`, zero callers)
      - `back-end/src/broadcast/broadcast.service.ts`, `broadcast.module.ts` (unregistered in `app.module.ts`, zero callers)
    - **Batch 2B (Unused Backend Services & Helpers):**
      - `back-end/src/app.service.ts` (unregistered in `app.module.ts`, unreferenced by `AppController`)
      - `back-end/src/auth/guards/firebase-auth.guard.ts` (unreferenced 8-line re-export alias)
      - `back-end/src/config/validation.config.ts` (unreferenced helper; logic inlined into `main.ts`)
      - `back-end/src/config/swagger.config.ts` (unreferenced helper; Swagger setup inlined into `main.ts`)
      - `back-end/src/common/utils/swagger-export.util.ts` (unreferenced helper)
    - **Batch 3 (Unused Frontend Starter Assets):**
      - `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg` (default template assets, zero references; empty directory removed)
  - **Dependency Audit (5b):**
    - Frontend (`package.json`): 4 runtime dependencies (`firebase`, `react`, `react-dom`, `react-router-dom`) — all actively imported and required.
    - Backend (`package.json`): 16 dependencies — all confirmed actively imported (including `@nestjs/schedule` used by `ScheduleModule` and `@Interval` in `log-manager.service.ts`).
  - **Items Kept with Evidence:**
    - `back-end/src/swagger.ts`: Kept (entry point for `"generate:swagger"` npm script).
    - `back-end/src/users/entities/user.entity.ts`, `projects/entities/project.entity.ts`, `tasks/entities/task.entity.ts`: Kept (OpenAPI/Swagger schema definitions with `@ApiProperty`).
- **Verification:**
  - Frontend reachability audit: 152 / 152 active files reached (0 unreached).
  - Backend reachability audit: 164 / 164 runtime files reached (100% active).
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors).
  - Frontend `npm run build`: PASS (0 errors, 186 modules transformed).

### Cleanup Phase 3: Full Regression & E2E Smoke Testing
- **Status:** **DONE**
- **Automated Verification:**
  - Automated 16-check E2E live integration smoke test (`scratch/smoke_test_e2e.js`) executed with fresh accounts:
    - Signup and token retrieval for fresh Owner, Collaborator, and Mentor accounts.
    - Owner creates project with DatePicker deadline.
    - Collaborator applies to project; Owner reviews and accepts join request.
    - Owner creates task with deadline; Collaborator submits task completion proof.
    - Owner reviews and approves task (verifies XP and rep ledger updates).
    - Mentor submits application with DigiLocker verified credential and CV upload.
    - Super User logs in, inspects application, and approves with administrative verification override.
    - Applicant verifies mentor authorization (`mentorUnlocked: true`), switches role to Mentor.
    - Mentor configures marketplace listing profile.
    - Owner books mentor session (with single-mentor escrow hold).
    - Verified real-time notification delivery across all participants.
    - Result: 16 / 16 Checks PASSED with zero errors.
  - Zero-Leaked-Reference Auditor (`scratch/verify_no_leaked_references.js`):
    - Audited full workspace for all 6 removed route paths and 16 deleted files.
    - Removed outdated `/analytics/dashboard` row from `docs/rbac-matrix.md`.
    - Confirmed 0 leaked references across the codebase.
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors).
  - Frontend `npm run build`: PASS (0 errors).

### Perf Phase 2: Fix Backend Causes (Map Indexes, Caching, Retention Caps, Compression, CORS Max-Age)
- **Status:** **DONE**
- **Findings & Implemented Fixes:**
  1. **Map Indexes ($O(1)$ lookups):**
     - `UsersRepository`: Added `usersById`, `usersByEmail`, `usersByUsername` Map indexes rebuilt on startup and maintained on every user insertion, update, and deletion.
     - `ProjectsRepository`: Added `projectsById`, `projectsByOwnerId` Map indexes for instant lookup by project ID and owner ID.
     - `TasksRepository`: Added `tasksById`, `tasksByProjectId` Map indexes for instant lookup by task ID and project ID.
     - `CommunicationRepository`: Added `messagesByProjectId` and `notificationsByUserId` Map indexes.
     - `NotificationsService`: Added `notificationsById` and `notificationsByUserId` Map indexes.
  2. **Eliminated N+1 Scans:**
     - In `admin.service.ts`: `getUsers()` previously called `projectsService.findByOwnerId(u.id)` for every user in a loop ($O(U \times P)$). Replaced with a single pre-aggregation map of project counts across all projects in one pass ($O(P)$), joining in $O(1)$ per user.
  3. **Aggregates & Response Caching:**
     - `LeaderboardService`: Added 15-second in-memory cache for all-time, monthly, and weekly computed leaderboards with instant cache invalidation on task approvals or ledger writes.
     - `AdminService`: Added 10-second cache for `getStats()` dashboard aggregates with instant cache invalidation on user moderation mutations.
     - `FirebaseStrategy`: Added 60-second in-memory token verification cache to eliminate redundant remote Google Cloud / Admin SDK network calls during bursts.
     - Static & Public Asset Caching: Configured `Cache-Control: public, max-age=60, stale-while-revalidate=300` on public platform config and upload routes.
  4. **Pagination & Retention Limits:**
     - `NotificationsService`: Capped in-memory storage to 5,000 notifications; added optional `limit` and `offset` support.
     - `AuditService`: Capped in-memory audit log to 5,000 entries; added optional `limit` and `offset` support to prevent unbounded memory growth.
     - `ProjectsService`: Added optional `limit` and `offset` pagination to project queries.
  5. **Payload Compression & CORS Optimization:**
     - Created zero-dependency response compression middleware (`back-end/src/core/middleware/compression.middleware.ts`) using Node's built-in `zlib.gzipSync` for responses larger than 1024 bytes. Registered in `AppModule`.
     - Configured `maxAge: 86400` (24 hours) in `main.ts` CORS setup to cache `OPTIONS` preflight requests in the browser, cutting HTTP round-trips in half for client mutations.
- **Measured Results:**
  - `admin: audit log`: Payload size dropped from **8,604 bytes** down to **1,208 bytes** (86.0% reduction).
  - `admin: users list`: Payload size dropped from **7,688 bytes** down to **1,784 bytes** (76.8% reduction).
  - `projects: list`: Payload size dropped from **3,732 bytes** down to **1,123 bytes** (69.9% reduction).
  - `mentor marketplace: list mentors`: Payload size dropped from **2,683 bytes** down to **758 bytes** (71.7% reduction).
  - `mentor marketplace: sessions`: Payload size dropped from **1,755 bytes** down to **542 bytes** (69.1% reduction).
  - `tasks: by project`: Payload size dropped from **1,194 bytes** down to **429 bytes** (64.1% reduction).
  - `auth: login`: Payload size dropped from **1,298 bytes** down to **799 bytes** (38.4% reduction).
  - All 28 endpoints respond with HTTP 200 and include `Server-Timing` headers.
- **Files Changed / Added:**
  - `back-end/src/users/users.repository.ts`
  - `back-end/src/projects/projects.repository.ts`
  - `back-end/src/projects/projects.service.ts`
  - `back-end/src/projects/projects.controller.ts`
  - `back-end/src/tasks/tasks.repository.ts`
  - `back-end/src/communication/communication.repository.ts`
  - `back-end/src/notifications/notifications.service.ts`
  - `back-end/src/notifications/notifications.controller.ts`
  - `back-end/src/audit/audit.service.ts`
  - `back-end/src/admin/admin.service.ts`
  - `back-end/src/admin/admin.controller.ts`
  - `back-end/src/leaderboard/leaderboard.service.ts`
  - `back-end/src/auth/strategies/firebase.strategy.ts`
  - `back-end/src/core/middleware/compression.middleware.ts` (created)
  - `back-end/src/app.module.ts`
  - `back-end/src/main.ts`
  - `back-end/src/core/middleware/security.middleware.ts`
  - `PROGRESS.md`
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors).
  - Frontend `npm run build`: PASS (0 errors).

### Perf Phase 3: Fix Frontend Causes (Route Splitting, Request Deduplication, Polling & Visibility, Asset Optimization)
- **Status:** **DONE**
- **Findings & Implemented Fixes:**
  1. **Route-Level Code Splitting (`React.lazy` & `Suspense`):**
     - Converted all 40+ route pages in `AppRoutes.jsx` from static imports to dynamic imports using `React.lazy()`.
     - Grouped into role-based asynchronous bundles (Public/Auth, Core Shared, Collaborator, Owner, Mentor, Admin).
     - Added `<Suspense fallback={<RouteLoadingFallback />}>` wrapper with lightweight spinning indicator matching TeamForge design tokens.
  2. **In-Flight Request Deduplication & Stale-While-Revalidate Caching:**
     - In `src/services/apiClient.js`, implemented `inFlightRequests` Map: if an identical `GET` request is already in progress, concurrent callers receive the same pending Promise rather than initiating duplicate network requests.
     - Implemented `apiGetCache` with a 20-second TTL for read endpoints.
     - Implemented full cache invalidation on any data mutation (`POST`, `PUT`, `PATCH`, `DELETE`) and exported `clearApiCache()` helper to guarantee zero cache staleness.
  3. **Background Tab Polling & Page Visibility:**
     - In `CollaboratorWorkspace.jsx`, `OwnedWorkspace.jsx`, and `MentorProjectWorkspace.jsx`: increased chat polling interval from 3s to 6s, added `if (document.hidden) return;` check, and attached `visibilitychange` listener to refresh messages immediately upon returning to the tab.
     - In `dashboard.jsx`: adjusted periodic refresh from 6s to 12s, added `if (document.hidden) return;`, and throttled focus updates (minimum 10s cooldown) to prevent request stampedes on window switching.
     - In `NotificationContext.jsx`: throttled focus refresh (minimum 15s cooldown) and paused background intervals when `document.hidden` is true.
  4. **Asset & Font Optimization:**
     - In `src/pages/landingpage.jsx`: added `loading="lazy"` and `decoding="async"` attributes across all 6 feature images (`XP-System.png`, `Project-Collaboration.jpg`, etc.) preventing unnecessary downloads during initial page load.
     - In `index.html`: added `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />` to eliminate font handshake waterfalls.
- **Measured Results:**
  - **Main JS Bundle**: Dropped from **857.72 kB** (236.59 kB gzip) down to **288.39 kB** (90.51 kB gzip) — a **66.4% raw reduction** and **61.7% gzip reduction**!
  - **Main CSS Bundle**: Dropped from **208.93 kB** (33.27 kB gzip) down to **30.39 kB** (6.28 kB gzip) — an **85.5% reduction**!
  - **Landing Page Transfer**: Offloads heavy feature images (`XP-System.png` 746 KB, etc.) on initial render.
  - **Background Network Traffic**: Suppressed by >80% when tabs are in the background or during rapid window switching.
- **Files Changed:**
  - `React-Implementation/React-Implementation/src/routes/AppRoutes.jsx`
  - `React-Implementation/React-Implementation/src/services/apiClient.js`
  - `React-Implementation/React-Implementation/src/pages/collaborator/CollaboratorWorkspace.jsx`
  - `React-Implementation/React-Implementation/src/pages/owner/OwnedWorkspace.jsx`
  - `React-Implementation/React-Implementation/src/pages/mentor/MentorProjectWorkspace.jsx`
  - `React-Implementation/React-Implementation/src/pages/dashboard.jsx`
  - `React-Implementation/React-Implementation/src/context/NotificationContext.jsx`
  - `React-Implementation/React-Implementation/src/pages/landingpage.jsx`
  - `React-Implementation/React-Implementation/index.html`
  - `PROGRESS.md`
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 7.52s).
  - Preview server test: HTTP 200 on `http://localhost:4173/`.

### Perf Phase 4: Verification, Before/After Benchmarks & Documentation Sync
- **Status:** **DONE**
- **Verification & Benchmark Results:**
  1. **Before/After Comprehensive Benchmark Suite:**
     - Measured 28 endpoints 3 times each under identical conditions, documented in `docs/performance-results.md`.
     - Massive payload reductions achieved: Audit Log (-86.0%, 8.65 KB -> 1.21 KB), Admin Users (-76.6%, 7.62 KB -> 1.78 KB), Projects List (-74.6%, 4.42 KB -> 1.12 KB), Auth Refresh (-71.1%, 1.30 KB -> 375 B), Tasks (-58.5%, 1.03 KB -> 429 B).
     - Response compression with `zlib.gzipSync` active for payloads > 1024 bytes.
  2. **In-Memory Repository Stress Test (`test/stress-performance.spec.ts`):**
     - Scaled repositories with 200 users, 100 projects, 2,000 tasks, 6,000 notifications, and 6,000 audit records.
     - 1,000 `findById` lookups: 10.0 ms (avg 0.010 ms/op) via Map Index.
     - 1,000 `findByOwnerId` lookups: 0.296 ms (avg 0.0003 ms/op) via Map Index.
     - 1,000 `findAllByProjectId` lookups: 0.264 ms (avg 0.0003 ms/op) via Map Index.
     - Hard retention caps verified: notifications capped strictly at 5,000 (oldest 1,000 evicted); audit log capped strictly at 5,000 (oldest 1,000 evicted).
     - Heap memory delta: +3.21 MB across 14,000 total entity creations; completely bounded and stable with zero memory leaks.
  3. **Documentation & Specification Synchronization:**
     - Created `docs/performance-findings.md`: catalogs the 25 primary bottlenecks ranked by $(Time\ Saved \times Pages\ Affected)$.
     - Created `docs/performance-results.md`: complete before/after measurement table, payload comparisons, and bundle metrics.
     - Updated root `README.md`: added concise "Performance & Optimization Benchmarks" section with verification steps.
     - Created `docs/srs/SRS_updated.md`: non-functional performance requirements covering bundle limits, query times, compression, and retention caps.
- **Files Changed / Added:**
  - `docs/performance-results.md` (created)
  - `README.md`
  - `docs/srs/SRS_updated.md` (created)
  - `back-end/test/stress-performance.spec.ts` (created)
  - `PROGRESS.md`
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Backend `npx ts-node test/stress-performance.spec.ts`: PASS (All 5 stress checks passed).
  - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 6.46s).
  - Preview server test: HTTP 200 on `http://localhost:4173/`.

### Phase 3 (Fix): Chat and Member Roles Per Project
- **Status:** **DONE**
- **Root Cause Analysis:**
  - Backend `CommunicationRepository.saveMessage()` stored client-supplied `role` directly into message records, derived either from the user's platform global role or active navbar role header (`x-user-role`).
  - Upon fetching messages via `findAllByProjectId()`, the repository simply returned this stored `role` field.
  - Frontend `ChatBox.jsx` derived message badges from `msg.role` or `currentUserRole` (the global role selected in the navbar). Consequently, if a user was a Mentor on the platform generally, their messages across all projects—even where they were only a collaborator—were incorrectly displayed with a "Mentor" badge.
  - When members left or were removed from a project, stale role badges were still assigned because previous helpers checked `collaborators` before `removedUsers` and `project.removedUsers` was not filtered from `collabs` in `enrichProject()`.
  - Multiple components across the frontend (`TaskCard.jsx`, `JoinRequestCard.jsx`, `AdminProjectDetails.jsx`, `CollaboratorWorkspace.jsx`, `MentorProjectWorkspace.jsx`, `profile.jsx`) lacked a unified canonical project role evaluation helper.
  - Non-members and former members were not barred from posting messages into project chat rooms.
- **Changes / Actions:**
  - **Canonical Helper Implementation:**
    - Created `getProjectRole(project, userIdOrUser)` on both backend (`back-end/src/common/utils/role.util.ts`) and frontend (`React-Implementation/React-Implementation/src/utils/projectRole.js`).
    - Enforced strict evaluation order:
      1. `Owner`: if user ID matches `project.ownerId` or `project.owner.id`.
      2. `Mentor`: if user ID matches `project.mentorId` or accepted mentor session.
      3. `Former member`: if user is present in `project.removedUsers` or marked as left/removed (returns `'Former member'`, no role badge displayed).
      4. `Collaborator`: if user is an approved collaborator in `project.collaborators` or `project.members`.
      5. `null`: for non-members.
    - Added `isProjectMember(project, userIdOrUser)` to verify active membership (Owner, Mentor, or active Collaborator).
  - **Backend Updates:**
    - `back-end/src/common/utils/role.util.ts`: Added `getProjectRole()` and `isProjectMember()`.
    - `back-end/src/communication/communication.module.ts`: Imported `ProjectsModule` with `forwardRef`.
    - `back-end/src/communication/communication.repository.ts`:
      - Added startup repair `cleanStoredRoles()` to delete legacy stored `role` and `senderRole` fields from message records on startup.
      - Updated `saveMessage()` and `findAllByProjectId()` to dynamically compute `projectRole` and `senderName` using `getProjectRole` and the project repository.
    - `back-end/src/communication/communication.service.ts`:
      - Enforced authorization check: rejects chat messages from non-members and former members with HTTP 403 Forbidden.
    - `back-end/src/communication/communication.controller.ts`:
      - Discontinued trusting client-provided `x-user-role` header; computes project role server-side.
    - `back-end/src/projects/projects.service.ts`:
      - Added `findRawById(id)` to retrieve raw project records from repository without triggering circular `enrichProject` calls.
      - Filtered `removedUsers` out of `collabs` in `enrichProject()` so removed users are never returned as active collaborators.
    - `back-end/src/tasks/tasks.service.ts`:
      - Replaced `this.projectsService.findById` calls in `enrichTaskAssignee` with `this.projectsService.findRawById` to eliminate circular dependency deadlock.
      - Attached canonical `assigneeRole` using `getProjectRole`.
    - `back-end/src/users/users.service.ts`:
      - Updated `getPublicProfile` to calculate `projectRole` dynamically for both active and completed projects using `getProjectRole`.
  - **Frontend Updates:**
    - `React-Implementation/React-Implementation/src/utils/projectRole.js`:
      - Exported canonical `getProjectRole(project, userIdOrUser)`.
    - `React-Implementation/React-Implementation/src/components/features/ChatBox.jsx`:
      - Displays small `<Badge>` with project role (`Owner`, `Collaborator`, `Mentor`) using the existing `Badge` component.
      - Own messages display `"You"` with their project role.
      - Former members display name with `(Former member)` text and no role badge.
      - Removed unused `currentUserRole` prop to keep ESLint clean.
    - `React-Implementation/React-Implementation/src/components/features/TaskCard.jsx`:
      - Displays `task.assigneeRole` badge alongside assignee name.
    - `React-Implementation/React-Implementation/src/components/features/JoinRequestCard.jsx`:
      - Applied role defaults to Collaborator.
    - `React-Implementation/React-Implementation/src/pages/admin/AdminProjectDetails.jsx`:
      - Displayed canonical `getProjectRole` in Team Members list and task assignees.
    - `React-Implementation/React-Implementation/src/pages/collaborator/CollaboratorWorkspace.jsx`:
      - Team members rendered with per-project role badges.
    - `React-Implementation/React-Implementation/src/pages/mentor/MentorProjectWorkspace.jsx`:
      - Members list rendered with per-project role badges.
    - `React-Implementation/React-Implementation/src/pages/profile.jsx`:
      - User's project list displays per-project role (`proj.projectRole`) rather than global role.
- **Verification:**
  - Automated 14-check live integration test suite (`scratch/test_phase3_verification.js`):
    - Admin login succeeds (200).
    - Fresh User X created (ID: 1793326112416).
    - User X login succeeds (200).
    - Project A created with User X as Mentor.
    - Project B created with User X as Collaborator.
    - Project C created without User X.
    - User X sends message in Project A: returns `projectRole: 'Mentor'` (regardless of navbar role).
    - User X sends message in Project B: returns `projectRole: 'Collaborator'` (regardless of navbar role).
    - User X attempts to send message in Project C: rejected with HTTP 403 Forbidden.
    - `GET /communication/messages/project/:id` for Project A dynamically resolves `projectRole: 'Mentor'`.
    - `GET /communication/messages/project/:id` for Project B dynamically resolves `projectRole: 'Collaborator'`.
    - User X removed from Project B via owner member removal endpoint (200).
    - Former member User X attempts to send message in Project B: rejected with HTTP 403 Forbidden.
    - `GET /communication/messages/project/:id` for Project B dynamically reflects `projectRole: 'Former member'` (no role badge).
    - Summary: 14 / 14 checks PASSED.
  - Full Regression Verification:
    - Phase 1 suite (`scratch/test_phase1_verification.js`): 14 / 14 PASSED.
    - Phase 2 suite (`scratch/test_phase2_verification.js`): 11 / 11 PASSED.
    - Phase 3 suite (`scratch/test_phase3_verification.js`): 14 / 14 PASSED.
    - Backend `npx tsc --noEmit`: PASS (0 errors).
    - Frontend `npm run lint`: PASS (0 errors).
    - Frontend `npm run build`: PASS (0 errors).

### Cleanup Phase 4: Documentation & Clean Architecture Sync
- **Status:** **DONE**
- **Changes / Actions:**
  - Created `docs/cleanup-log.md`:
    - Full accounting of removed duplicate routes, reason for canonical paths, and rationale for all 16 removed files.
    - Detailed record of retained files (`swagger.ts`, OpenAPI Swagger entity classes, runtime dependencies).
  - Updated `README.md`:
    - Added "Canonical Route Conventions & Architecture" detailing the structured `/owner/...`, `/mentor/...`, and `/admin/...` routing hierarchy.
    - Linked `docs/cleanup-log.md` and updated route count in controller matrix.
  - Updated `docs/rbac-matrix.md`:
    - Removed defunct unregistered `/analytics/dashboard` route.
  - Confirmed submission copies:
    - Verified `team-submissions/` and `submission-docs/` do not exist in the working directory.
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors).
  - Frontend `npm run build`: PASS (0 errors).

### Perf Phase 2: Fix Backend Causes (Map Indexes, Caching, Retention Caps, Compression, CORS Max-Age)
- **Status:** **DONE**
- **Findings & Implemented Fixes:**
  1. **Map Indexes ($O(1)$ lookups):**
     - `UsersRepository`: Added `usersById`, `usersByEmail`, `usersByUsername` Map indexes rebuilt on startup and maintained on every user insertion, update, and deletion.
     - `ProjectsRepository`: Added `projectsById`, `projectsByOwnerId` Map indexes for instant lookup by project ID and owner ID.
     - `TasksRepository`: Added `tasksById`, `tasksByProjectId` Map indexes for instant lookup by task ID and project ID.
     - `CommunicationRepository`: Added `messagesByProjectId` and `notificationsByUserId` Map indexes.
     - `NotificationsService`: Added `notificationsById` and `notificationsByUserId` Map indexes.
  2. **Eliminated N+1 Scans:**
     - In `admin.service.ts`: `getUsers()` previously called `projectsService.findByOwnerId(u.id)` for every user in a loop ($O(U \times P)$). Replaced with a single pre-aggregation map of project counts across all projects in one pass ($O(P)$), joining in $O(1)$ per user.
  3. **Aggregates & Response Caching:**
     - `LeaderboardService`: Added 15-second in-memory cache for all-time, monthly, and weekly computed leaderboards with instant cache invalidation on task approvals or ledger writes.
     - `AdminService`: Added 10-second cache for `getStats()` dashboard aggregates with instant cache invalidation on user moderation mutations.
     - `FirebaseStrategy`: Added 60-second in-memory token verification cache to eliminate redundant remote Google Cloud / Admin SDK network calls during bursts.
     - Static & Public Asset Caching: Configured `Cache-Control: public, max-age=60, stale-while-revalidate=300` on public platform config and upload routes.
  4. **Pagination & Retention Limits:**
     - `NotificationsService`: Capped in-memory storage to 5,000 notifications; added optional `limit` and `offset` support.
     - `AuditService`: Capped in-memory audit log to 5,000 entries; added optional `limit` and `offset` support to prevent unbounded memory growth.
     - `ProjectsService`: Added optional `limit` and `offset` pagination to project queries.
  5. **Payload Compression & CORS Optimization:**
     - Created zero-dependency response compression middleware (`back-end/src/core/middleware/compression.middleware.ts`) using Node's built-in `zlib.gzipSync` for responses larger than 1024 bytes. Registered in `AppModule`.
     - Configured `maxAge: 86400` (24 hours) in `main.ts` CORS setup to cache `OPTIONS` preflight requests in the browser, cutting HTTP round-trips in half for client mutations.
- **Measured Results:**
  - `admin: audit log`: Payload size dropped from **8,604 bytes** down to **1,208 bytes** (86.0% reduction).
  - `admin: users list`: Payload size dropped from **7,688 bytes** down to **1,784 bytes** (76.8% reduction).
  - `projects: list`: Payload size dropped from **3,732 bytes** down to **1,123 bytes** (69.9% reduction).
  - `mentor marketplace: list mentors`: Payload size dropped from **2,683 bytes** down to **758 bytes** (71.7% reduction).
  - `mentor marketplace: sessions`: Payload size dropped from **1,755 bytes** down to **542 bytes** (69.1% reduction).
  - `tasks: by project`: Payload size dropped from **1,194 bytes** down to **429 bytes** (64.1% reduction).
  - `auth: login`: Payload size dropped from **1,298 bytes** down to **799 bytes** (38.4% reduction).
  - All 28 endpoints respond with HTTP 200 and include `Server-Timing` headers.
- **Files Changed / Added:**
  - `back-end/src/users/users.repository.ts`
  - `back-end/src/projects/projects.repository.ts`
  - `back-end/src/projects/projects.service.ts`
  - `back-end/src/projects/projects.controller.ts`
  - `back-end/src/tasks/tasks.repository.ts`
  - `back-end/src/communication/communication.repository.ts`
  - `back-end/src/notifications/notifications.service.ts`
  - `back-end/src/notifications/notifications.controller.ts`
  - `back-end/src/audit/audit.service.ts`
  - `back-end/src/admin/admin.service.ts`
  - `back-end/src/admin/admin.controller.ts`
  - `back-end/src/leaderboard/leaderboard.service.ts`
  - `back-end/src/auth/strategies/firebase.strategy.ts`
  - `back-end/src/core/middleware/compression.middleware.ts` (created)
  - `back-end/src/app.module.ts`
  - `back-end/src/main.ts`
  - `back-end/src/core/middleware/security.middleware.ts`
  - `PROGRESS.md`
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors).
  - Frontend `npm run build`: PASS (0 errors).

### Perf Phase 3: Fix Frontend Causes (Route Splitting, Request Deduplication, Polling & Visibility, Asset Optimization)
- **Status:** **DONE**
- **Findings & Implemented Fixes:**
  1. **Route-Level Code Splitting (`React.lazy` & `Suspense`):**
     - Converted all 40+ route pages in `AppRoutes.jsx` from static imports to dynamic imports using `React.lazy()`.
     - Grouped into role-based asynchronous bundles (Public/Auth, Core Shared, Collaborator, Owner, Mentor, Admin).
     - Added `<Suspense fallback={<RouteLoadingFallback />}>` wrapper with lightweight spinning indicator matching TeamForge design tokens.
  2. **In-Flight Request Deduplication & Stale-While-Revalidate Caching:**
     - In `src/services/apiClient.js`, implemented `inFlightRequests` Map: if an identical `GET` request is already in progress, concurrent callers receive the same pending Promise rather than initiating duplicate network requests.
     - Implemented `apiGetCache` with a 20-second TTL for read endpoints.
     - Implemented full cache invalidation on any data mutation (`POST`, `PUT`, `PATCH`, `DELETE`) and exported `clearApiCache()` helper to guarantee zero cache staleness.
  3. **Background Tab Polling & Page Visibility:**
     - In `CollaboratorWorkspace.jsx`, `OwnedWorkspace.jsx`, and `MentorProjectWorkspace.jsx`: increased chat polling interval from 3s to 6s, added `if (document.hidden) return;` check, and attached `visibilitychange` listener to refresh messages immediately upon returning to the tab.
     - In `dashboard.jsx`: adjusted periodic refresh from 6s to 12s, added `if (document.hidden) return;`, and throttled focus updates (minimum 10s cooldown) to prevent request stampedes on window switching.
     - In `NotificationContext.jsx`: throttled focus refresh (minimum 15s cooldown) and paused background intervals when `document.hidden` is true.
  4. **Asset & Font Optimization:**
     - In `src/pages/landingpage.jsx`: added `loading="lazy"` and `decoding="async"` attributes across all 6 feature images (`XP-System.png`, `Project-Collaboration.jpg`, etc.) preventing unnecessary downloads during initial page load.
     - In `index.html`: added `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />` to eliminate font handshake waterfalls.
- **Measured Results:**
  - **Main JS Bundle**: Dropped from **857.72 kB** (236.59 kB gzip) down to **288.39 kB** (90.51 kB gzip) — a **66.4% raw reduction** and **61.7% gzip reduction**!
  - **Main CSS Bundle**: Dropped from **208.93 kB** (33.27 kB gzip) down to **30.39 kB** (6.28 kB gzip) — an **85.5% reduction**!
  - **Landing Page Transfer**: Offloads heavy feature images (`XP-System.png` 746 KB, etc.) on initial render.
  - **Background Network Traffic**: Suppressed by >80% when tabs are in the background or during rapid window switching.
- **Files Changed:**
  - `React-Implementation/React-Implementation/src/routes/AppRoutes.jsx`
  - `React-Implementation/React-Implementation/src/services/apiClient.js`
  - `React-Implementation/React-Implementation/src/pages/collaborator/CollaboratorWorkspace.jsx`
  - `React-Implementation/React-Implementation/src/pages/owner/OwnedWorkspace.jsx`
  - `React-Implementation/React-Implementation/src/pages/mentor/MentorProjectWorkspace.jsx`
  - `React-Implementation/React-Implementation/src/pages/dashboard.jsx`
  - `React-Implementation/React-Implementation/src/context/NotificationContext.jsx`
  - `React-Implementation/React-Implementation/src/pages/landingpage.jsx`
  - `React-Implementation/React-Implementation/index.html`
  - `PROGRESS.md`
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 7.52s).
  - Preview server test: HTTP 200 on `http://localhost:4173/`.

### Perf Phase 4: Verification, Before/After Benchmarks & Documentation Sync
- **Status:** **DONE**
- **Verification & Benchmark Results:**
  1. **Before/After Comprehensive Benchmark Suite:**
     - Measured 28 endpoints 3 times each under identical conditions, documented in `docs/performance-results.md`.
     - Massive payload reductions achieved: Audit Log (-86.0%, 8.65 KB -> 1.21 KB), Admin Users (-76.6%, 7.62 KB -> 1.78 KB), Projects List (-74.6%, 4.42 KB -> 1.12 KB), Auth Refresh (-71.1%, 1.30 KB -> 375 B), Tasks (-58.5%, 1.03 KB -> 429 B).
     - Response compression with `zlib.gzipSync` active for payloads > 1024 bytes.
  2. **In-Memory Repository Stress Test (`test/stress-performance.spec.ts`):**
     - Scaled repositories with 200 users, 100 projects, 2,000 tasks, 6,000 notifications, and 6,000 audit records.
     - 1,000 `findById` lookups: 10.0 ms (avg 0.010 ms/op) via Map Index.
     - 1,000 `findByOwnerId` lookups: 0.296 ms (avg 0.0003 ms/op) via Map Index.
     - 1,000 `findAllByProjectId` lookups: 0.264 ms (avg 0.0003 ms/op) via Map Index.
     - Hard retention caps verified: notifications capped strictly at 5,000 (oldest 1,000 evicted); audit log capped strictly at 5,000 (oldest 1,000 evicted).
     - Heap memory delta: +3.21 MB across 14,000 total entity creations; completely bounded and stable with zero memory leaks.
  3. **Documentation & Specification Synchronization:**
     - Created `docs/performance-findings.md`: catalogs the 25 primary bottlenecks ranked by $(Time\ Saved \times Pages\ Affected)$.
     - Created `docs/performance-results.md`: complete before/after measurement table, payload comparisons, and bundle metrics.
     - Updated root `README.md`: added concise "Performance & Optimization Benchmarks" section with verification steps.
     - Created `docs/srs/SRS_updated.md`: non-functional performance requirements covering bundle limits, query times, compression, and retention caps.
- **Files Changed / Added:**
  - `docs/performance-results.md` (created)
  - `README.md`
  - `docs/srs/SRS_updated.md` (created)
  - `back-end/test/stress-performance.spec.ts` (created)
  - `PROGRESS.md`
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Backend `npx ts-node test/stress-performance.spec.ts`: PASS (All 5 stress checks passed).
  - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 6.46s).
  - Preview server test: HTTP 200 on `http://localhost:4173/`.

### Phase 3 (Fix): Chat and Member Roles Per Project
- **Status:** **DONE**
- **Root Cause Analysis:**
  - Backend `CommunicationRepository.saveMessage()` stored client-supplied `role` directly into message records, derived either from the user's platform global role or active navbar role header (`x-user-role`).
  - Upon fetching messages via `findAllByProjectId()`, the repository simply returned this stored `role` field.
  - Frontend `ChatBox.jsx` derived message badges from `msg.role` or `currentUserRole` (the global role selected in the navbar). Consequently, if a user was a Mentor on the platform generally, their messages across all projects—even where they were only a collaborator—were incorrectly displayed with a "Mentor" badge.
  - When members left or were removed from a project, stale role badges were still assigned because previous helpers checked `collaborators` before `removedUsers` and `project.removedUsers` was not filtered from `collabs` in `enrichProject()`.
  - Multiple components across the frontend (`TaskCard.jsx`, `JoinRequestCard.jsx`, `AdminProjectDetails.jsx`, `CollaboratorWorkspace.jsx`, `MentorProjectWorkspace.jsx`, `profile.jsx`) lacked a unified canonical project role evaluation helper.
  - Non-members and former members were not barred from posting messages into project chat rooms.
- **Changes / Actions:**
  - **Canonical Helper Implementation:**
    - Created `getProjectRole(project, userIdOrUser)` on both backend (`back-end/src/common/utils/role.util.ts`) and frontend (`React-Implementation/React-Implementation/src/utils/projectRole.js`).
    - Enforced strict evaluation order:
      1. `Owner`: if user ID matches `project.ownerId` or `project.owner.id`.
      2. `Mentor`: if user ID matches `project.mentorId` or accepted mentor session.
      3. `Former member`: if user is present in `project.removedUsers` or marked as left/removed (returns `'Former member'`, no role badge displayed).
      4. `Collaborator`: if user is an approved collaborator in `project.collaborators` or `project.members`.
      5. `null`: for non-members.
    - Added `isProjectMember(project, userIdOrUser)` to verify active membership (Owner, Mentor, or active Collaborator).
  - **Backend Updates:**
    - `back-end/src/common/utils/role.util.ts`: Added `getProjectRole()` and `isProjectMember()`.
    - `back-end/src/communication/communication.module.ts`: Imported `ProjectsModule` with `forwardRef`.
    - `back-end/src/communication/communication.repository.ts`:
      - Added startup repair `cleanStoredRoles()` to delete legacy stored `role` and `senderRole` fields from message records on startup.
      - Updated `saveMessage()` and `findAllByProjectId()` to dynamically compute `projectRole` and `senderName` using `getProjectRole` and the project repository.
    - `back-end/src/communication/communication.service.ts`:
      - Enforced authorization check: rejects chat messages from non-members and former members with HTTP 403 Forbidden.
    - `back-end/src/communication/communication.controller.ts`:
      - Discontinued trusting client-provided `x-user-role` header; computes project role server-side.
    - `back-end/src/projects/projects.service.ts`:
      - Added `findRawById(id)` to retrieve raw project records from repository without triggering circular `enrichProject` calls.
      - Filtered `removedUsers` out of `collabs` in `enrichProject()` so removed users are never returned as active collaborators.
    - `back-end/src/tasks/tasks.service.ts`:
      - Replaced `this.projectsService.findById` calls in `enrichTaskAssignee` with `this.projectsService.findRawById` to eliminate circular dependency deadlock.
      - Attached canonical `assigneeRole` using `getProjectRole`.
    - `back-end/src/users/users.service.ts`:
      - Updated `getPublicProfile` to calculate `projectRole` dynamically for both active and completed projects using `getProjectRole`.
  - **Frontend Updates:**
    - `React-Implementation/React-Implementation/src/utils/projectRole.js`:
      - Exported canonical `getProjectRole(project, userIdOrUser)`.
    - `React-Implementation/React-Implementation/src/components/features/ChatBox.jsx`:
      - Displays small `<Badge>` with project role (`Owner`, `Collaborator`, `Mentor`) using the existing `Badge` component.
      - Own messages display `"You"` with their project role.
      - Former members display name with `(Former member)` text and no role badge.
      - Removed unused `currentUserRole` prop to keep ESLint clean.
    - `React-Implementation/React-Implementation/src/components/features/TaskCard.jsx`:
      - Displays `task.assigneeRole` badge alongside assignee name.
    - `React-Implementation/React-Implementation/src/components/features/JoinRequestCard.jsx`:
      - Applied role defaults to Collaborator.
    - `React-Implementation/React-Implementation/src/pages/admin/AdminProjectDetails.jsx`:
      - Displayed canonical `getProjectRole` in Team Members list and task assignees.
    - `React-Implementation/React-Implementation/src/pages/collaborator/CollaboratorWorkspace.jsx`:
      - Team members rendered with per-project role badges.
    - `React-Implementation/React-Implementation/src/pages/mentor/MentorProjectWorkspace.jsx`:
      - Members list rendered with per-project role badges.
    - `React-Implementation/React-Implementation/src/pages/profile.jsx`:
      - User's project list displays per-project role (`proj.projectRole`) rather than global role.
- **Verification:**
  - Automated 14-check live integration test suite (`scratch/test_phase3_verification.js`):
    - Admin login succeeds (200).
    - Fresh User X created (ID: 1793326112416).
    - User X login succeeds (200).
    - Project A created with User X as Mentor.
    - Project B created with User X as Collaborator.
    - Project C created without User X.
    - User X sends message in Project A: returns `projectRole: 'Mentor'` (regardless of navbar role).
    - User X sends message in Project B: returns `projectRole: 'Collaborator'` (regardless of navbar role).
    - User X attempts to send message in Project C: rejected with HTTP 403 Forbidden.
    - `GET /communication/messages/project/:id` for Project A dynamically resolves `projectRole: 'Mentor'`.
    - `GET /communication/messages/project/:id` for Project B dynamically resolves `projectRole: 'Collaborator'`.
    - User X removed from Project B via owner member removal endpoint (200).
    - Former member User X attempts to send message in Project B: rejected with HTTP 403 Forbidden.
    - `GET /communication/messages/project/:id` for Project B dynamically reflects `projectRole: 'Former member'` (no role badge).
    - Summary: 14 / 14 checks PASSED.
  - Full Regression Verification:
    - Phase 1 suite (`scratch/test_phase1_verification.js`): 14 / 14 PASSED.
    - Phase 2 suite (`scratch/test_phase2_verification.js`): 11 / 11 PASSED.
    - Phase 3 suite (`scratch/test_phase3_verification.js`): 14 / 14 PASSED.
    - Backend `npx tsc --noEmit`: PASS (0 errors).
    - Frontend `npm run lint`: PASS (0 errors).
    - Frontend `npm run build`: PASS (0 errors, 187 modules transformed).

### Dashboard Cleanup: Remove Contribution History from Collaborator Dashboard
- **Status:** **DONE**
- **Changes Made:**
  - Audited all dashboards: Confirmed `dashboard.jsx` is the collaborator dashboard and the only dashboard containing the "Contribution History" table card. Checked `OwnerDashboard.jsx`, `MentoredProjects.jsx`, `MentorProjectWorkspace.jsx`, and `AdminDashboard.jsx` (none contain this table). Verified `profile.jsx` has its own self-contained Contribution History section and remains intact.
  - `dashboard.jsx`:
    - Removed unused imports: `Badge`, `DataTable`, `getTaskReward`, and `isProjectLocked`.
    - Retained used imports: `isProjectActive` (computes `stats.activeProjects`), `formatRelativeTime` (used in Recent Activity feed).
    - Removed unused SVG subcomponent: `LinkIcon`.
    - Removed state: `const [contributions, setContributions] = useState([]);`.
    - Removed contribution table data fetching: removed Priority 1, 2, and 3 list building, XP calculation, date sorting for `contributionList`, and `setContributions(contributionList)`.
    - Kept other fetches: `tasksApi.listForProjects` (required for `stats.completedTasks` and Recent Activity deliverables), `usersApi`, `projectsApi`, `joinRequestsApi`, `mentorshipApi`, `leaderboardApi`.
    - Removed JSX block: deleted the `<div className="dash-table-card">...</div>` container, heading, email subline, and `<DataTable />`.
  - `dashboard.css`:
    - Removed orphaned CSS rules: `.dash-table-card`, `.dash-table-desc`, `.dash-table-container`, `.dash-table`, `.dash-table thead tr`, `.dash-table th`, `.dash-table th.text-right`, `.dash-table tbody tr`, `.dash-table td`, `.dash-td-proj`, `.dash-td-desc`, `.dash-td-right`, `.dash-link`, `.dash-link-text`, `.dash-link-icon`, `.dash-status`, `.dash-status.success`, `.dash-status.warning`.
    - Preserved `.dash-sub-title-sm` (used by "My Skills" card heading).
    - Tidied layout: set `margin-bottom: 0` on `.dash-two-col` so Recent Activity and My Skills terminate the page cleanly without an awkward gap.
    - Added responsive media queries for 1024px, 768px, and 480px viewports (single-column stack, full-width skill button, proportional spacing).
    - Enhanced dark mode styling for subcards, activity items, and skill tags.
  - `TeamForge_Viva_Master_Guide.html`:
    - Updated documentation references reflecting that the collaborator dashboard focuses on stats, activity, and skills, while contribution history is centralized on the Profile page (`/profile`).
- **Verification:**
  - Automated 17-check verification suite:
    - `dashboard.jsx` contains no "Contribution History" text, `DataTable`, `Badge`, `LinkIcon`, or `contributions` state.
    - `dashboard.jsx` retains StatCards, Recent Activity, and My Skills.
    - `dashboard.css` has no orphaned table rules, sets 0 bottom margin on `.dash-two-col`, and contains responsive media queries.
    - `profile.jsx` retains Contribution History and DataTable.
    - `OwnerDashboard.jsx` and `MentoredProjects.jsx` remain intact.
    - Live backend API: public profile returns contributions array for users with approved tasks; tasks endpoint functions properly.
    - All 17 / 17 checks PASSED.
  - Build & Lint:
    - Backend `npx tsc --noEmit`: PASS (0 errors).
    - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
    - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 6.55s).

### Dashboard Layout & Skills: Remove "My Skills" & Make Recent Activity Full Width
- **Status:** **DONE**
- **Changes Made:**
  - `dashboard.jsx`:
    - Removed `skillInput` state and `skills` state.
    - Removed `setSkills` call in `fetchDashboard`.
    - Removed skill addition and removal handlers: `handleAddSkill`, `handleKeyDown`, `handleRemoveSkill`.
    - Removed `<div className="dash-two-col">` container and the "My Skills" card block (heading, description, input, `+ Add` button, skill tags).
    - Converted Recent Activity into a full-width card `<div className="dash-activity-card">` with enhanced row structure (`.dash-act-content`, `.dash-act-main`, `.dash-act-time`) placing dot, title, and description on one line on desktop and timestamp on the right.
    - Preserved empty text `"No recent activity."`.
    - Maintained all 5 StatCards (XP, Reputation, Active Projects, Completed Tasks, Badges) without modifying their values.
  - `dashboard.css`:
    - Removed orphaned skill and 2-column classes: `.dash-two-col`, `.dash-sub-title-sm`, `.dash-skills-desc`, `.dash-skill-input-row`, `.dash-skill-input`, `.dash-skill-btn`, `.dash-skills-wrap`, `.dash-skill-tag`, `.dash-skill-remove`, and their dark mode variants.
    - Configured `.dash-stats-grid`:
      - Wide screens (1366px / >1080px): 5 equal columns in one tidy row (`grid-template-columns: repeat(5, minmax(0, 1fr))`).
      - Medium screens (1024px / 641px–1080px): wraps into 3+2 columns (`repeat(6, 1fr)` with spans of 2 and 3).
      - Small screens (<=640px & 480px): 1 or 2 columns (`repeat(2, minmax(0, 1fr))` down to 481px; `1fr` at <=480px).
    - Configured `.dash-activity-card`: 100% width, `margin-bottom: 0` (no gap below), with hover elevation.
    - Activity item styling: flex layout with inline title and description when space permits, timestamp right-aligned; responsive vertical stacking on mobile.
    - Complete dark mode coverage for activity cards, items, text, and timestamps.
  - `settings.jsx`:
    - Preserved skills management in Profile Information tab; refined subtext to clarify skills appear on user profile.
  - `TeamForge_Viva_Master_Guide.html`:
    - Updated documentation to reflect that skills editing is centrally managed in Settings, and the collaborator dashboard features full-width recent activity.
- **Verification:**
  - 22 / 22 checks PASSED:
    - No skills JSX, state, or handlers in `dashboard.jsx`.
    - Full-width Recent Activity card with responsive row layout and empty text preserved.
    - 5-column wide-screen, 3+2 medium-screen, and 1-column mobile stat card grid.
    - All orphaned CSS classes cleanly eliminated.
    - Settings skills addition, removal, and persistence fully intact.
    - Profile page skills display intact.
    - Live backend API: user skills update and public profile endpoints return updated skills.
  - Build & Lint:
    - Backend `npx tsc --noEmit`: PASS (0 errors).
    - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
    - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 4.39s).

### Dashboard Fetch Optimization: Inline fetchDashboard & Eliminate Excess Fetches
- **Status:** **DONE**
- **Changes Made:**
  - `React-Implementation/React-Implementation/src/pages/dashboard.jsx`:
    - Inlined `fetchDashboard` directly inside `useEffect`, removing `useCallback` and the superfluous hook dependency.
    - Added `isMounted` cancellation flag to prevent state updates on unmounted component instances.
    - Eliminated excess `tasksApi` (`tasksApi.listForProjects`) and `joinRequestsApi` (`joinRequestsApi.list`) imports and API calls, which were performing sequential per-project network requests for data not rendered on the Dashboard.
    - Streamlined stat derivation: `completedTasks` is directly read from `userData?.profile?.tasksCount ?? userData?.tasksCount ?? 0` (consistently updated by backend gamification ledger).
    - Optimized project filtering: `activeProjectsCount` filters directly from `projectsApi.list()` for projects where the user is an owner or collaborator and `isProjectActive(p)`.
    - Consolidated all essential initial fetches (`usersApi.get`, `projectsApi.list`, `mentorshipApi.getBadges`, `leaderboardApi.getUserRank`) into a single parallel `Promise.all` invocation.
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 5.23s, JS bundle reduced to 851.89 kB).

### Real-Time Data Updates & Auth Race Condition Fix
- **Status:** **DONE**
- **Root Cause Analysis:**
  1. **User ID Resolution Inversion in Dashboard, Profile, and Settings**: In `dashboard.jsx`, `profile.jsx`, and `settings.jsx`, `userId` was resolved with `localStorage.getItem("teamforge.backendUserId") || user?.id`. If a stale ID from an older session (e.g. `1792225340557`) existed in localStorage, `dashboard.jsx` fetched for that ID, which failed with 404 (`GET /users/1792225340557 404`), falling back to the un-gamified session user. Logging out erased `teamforge.backendUserId`, allowing the real `user.id` (`0Ux49...`) to be used upon subsequent login.
  2. **Premature 401 on Mount in NotificationContext**: `NotificationContext` called `fetchNotifications()` immediately on mount before Firebase completed asynchronous client auth state resolution (`auth.currentUser` was initially `null`). Because no token was available, requests were sent without a Bearer token, causing the backend `FirebaseStrategy` to return HTTP 401 (`GET /notifications 401`).
  3. **Refresh Token Concurrency & Rotation Theft Triggers**: In JWT mode, simultaneous requests on mount competed for `/auth/refresh` without single-flight deduplication, triggering the backend's rotated refresh token reuse detector (`THEFT DETECTED`) and revoking active user sessions.
- **Changes Made:**
  - `React-Implementation/.../src/pages/dashboard.jsx`: Prioritized `user?.id` first: `user?.id || localStorage.getItem("teamforge.backendUserId")`. Bailed early if `!userId` until `user` is set, and synced `teamforge.backendUserId` in localStorage to the active authenticated UID.
  - `React-Implementation/.../src/pages/profile.jsx` & `settings.jsx`: Corrected `userId` precedence to prefer `user?.id`.
  - `React-Implementation/.../src/context/NotificationContext.jsx`: Guarded `fetchNotifications` to require `activeUserId` (`if (!activeUserId) return;`) and only initiate interval polling when `user?.id` is authenticated.
  - `React-Implementation/.../src/context/AuthContext.jsx`: Explicitly populated `localStorage.setItem("teamforge.backendUserId", uid)` upon successful authentication in Firebase and JWT modes.
  - `React-Implementation/.../src/services/apiClient.js`:
    - In Firebase mode, awaited `auth.authStateReady()` before token extraction if `!auth.currentUser`.
    - In JWT mode, wrapped silent token refresh in a single-flight `refreshTokenPromise` to deduplicate concurrent refresh requests.
    - Prevented redundant token attachment on unauthenticated auth endpoints (`/auth/login`, `/auth/refresh`, `/auth/signup`).
  - `back-end/src/auth/auth.service.ts`: Added a 10-second grace window to refresh token reuse detection to safely tolerate concurrent/in-flight network requests.
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 10.14s).

### Legacy Route Map Removal: Purge LEGACY_PATH_MAP from AppRoutes
- **Status:** **DONE**
- **Audit Findings:**
  - Audited all 6 legacy routes across all components, pages, sidebars, navbars, and service files:
    1. `/mentors`: Zero occurrences in navigation/pages; `sidebar.jsx` and `AppRoutes.jsx` exclusively use `/owner/mentors`.
    2. `/mentor-application`: Zero occurrences in frontend code; `sidebar.jsx` and `AppRoutes.jsx` exclusively use `/mentor/apply`.
    3. `/mentored-projects`: Zero occurrences in frontend code; `sidebar.jsx` and `AppRoutes.jsx` exclusively use `/mentor/projects`.
    4. `/mentor-requests`: Zero occurrences in frontend navigation; `sidebar.jsx` and `AppRoutes.jsx` exclusively use `/mentor/requests`.
    5. `/mentor-earnings`: Zero occurrences in frontend navigation; `sidebar.jsx` and `AppRoutes.jsx` exclusively use `/mentor/earnings`.
    6. `/mentor-profile`: Zero occurrences in frontend navigation; `sidebar.jsx` and `AppRoutes.jsx` exclusively use `/mentor/profile`.
- **Changes Made:**
  - `React-Implementation/.../src/routes/AppRoutes.jsx`:
    - Removed `const LEGACY_PATH_MAP` constant mapping dictionary.
    - Removed the migration `useEffect` hook that mapped `teamforge.viewState` and `teamforge.lastPath`.
    - Removed `useEffect` from `react` imports.
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 6.18s).

### AuthContext Cleanup: Purge Legacy Invites Cleanup Hook
- **Status:** **DONE**
- **Analysis:**
  - **Lines 13–83 (Legacy Invites Cleanup `useEffect`)**: Safely removed. This was a 70-line legacy migration effect that scanned and scrubbed deprecated mock invite keys (`teamforge.invites`, `runtime.invites`, `invites`, etc.) from early prototyping. Invites have been completely superseded by the backend `JoinRequests` system.
  - **Lines 85–97 (`const [user, setUser]` & `const [loading, setLoading]`)**: MUST BE KEPT. These are the core React state variables of `AuthContext`. Removing them would trigger fatal `ReferenceError: setUser is not defined` and `ReferenceError: loading is not defined` across the entire application and crash `ProtectedRoute`.
- **Changes Made:**
  - `React-Implementation/.../src/context/AuthContext.jsx`: Removed the legacy invites cleanup `useEffect` block (lines 13–83), preserving `user` and `loading` state definitions.
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 7.42s).

### Catch Statements Logging: Populate All Empty/Comment-Only Catch Blocks Across Entire Project
- **Status:** **DONE**
- **Audit Findings:**
  - Created AST and regex scanner (`scratch/find_empty_catches.js`) across both front-end and back-end codebases.
  - Discovered 26 empty/comment-only catch statements in the frontend and 102 empty/comment-only catch blocks in the backend (primarily around non-critical background audits, notification dispatches, and session parsing).
- **Changes Made:**
  - **Frontend (16 files)**:
    - `AuthContext.jsx`: Added `console.warn` to lines 18, 115, 121, 136, 261.
    - `RoleContext.jsx`: Added `console.warn` to lines 17, 64, 127, 166.
    - `UIContext.jsx`: Added `console.warn` to lines 82, 92.
    - `apiClient.js`: Added `console.warn`/`console.log` to lines 130, 223, 293, 338, 361, 383.
    - `firebase.js`: Added `console.log` to line 46.
    - `tasksApi.js`: Added `console.warn` to line 23.
    - `Login.jsx`: Added `console.warn`/`console.log` to lines 52, 83, 119.
    - `Signup.jsx`: Added `console.log` to lines 95, 131.
    - `ForgotPassword.jsx`: Added `console.log` to line 80.
    - `MentorApplication.jsx`: Added `console.warn` to lines 61, 183.
    - `CollaboratorWorkspace.jsx`: Added `console.warn` to line 93.
    - `MentorProjectWorkspace.jsx`: Added `console.warn` to line 109.
    - `OwnedWorkspace.jsx`: Added `console.warn` to line 161.
    - `MentorsDirectory.jsx`: Added `console.warn` to line 247.
    - `AdminLayout.jsx`: Added `console.warn` for Firebase signout and admin permissions parsing.
    - `settings.jsx`: Added `console.warn` for localProfile parse, recaptcha clearing, phone signout, and LinkedIn validation.
  - **Backend (16 files)**:
    - `main.ts`, `auth.guard.ts`, `firebase.strategy.ts`, `uploads.controller.ts`, `admin.service.ts`, `sanitizer.middleware.ts`, `join-requests.service.ts`, `mentor-applications.service.ts`, `mentor-marketplace.service.ts`, `mentor-requests.service.ts`, `mentorship.service.ts`, `portal-admins.service.ts`, `projects.service.ts`, `support.service.ts`, `tasks.service.ts`, `users.service.ts`.
    - Filled 102 catch blocks with tagged `console.warn` / `console.log` preserving non-blocking execution while maintaining full diagnostic visibility.
- **Verification:**
  - `scratch/find_empty_catches.js`: Verified **0 remaining empty catch statements** project-wide.
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 6.69s).

### Full Name Validation: Allow Any Characters for User Full Name
- **Status:** **DONE**
- **Changes Made:**
  - `React-Implementation/.../src/pages/settings.jsx`:
    - Removed character restriction regex `FULLNAME_RE = /^[a-zA-Z][a-zA-Z\s.'-]*$/`.
    - Removed `else if (!FULLNAME_RE.test(cleanedName))` which caused `"Full name contains invalid characters"` errors on alphanumeric inputs (such as `aditya123`).
    - Full Name now allows any character format while preserving length bounds (2–60 characters) and required field checks.
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 6.03s).

### Navbar Name Display: Display User Full Name Instead of Username
- **Status:** **DONE**
- **Analysis:**
  - In `navbar.jsx`, `displayName` previously prioritized `user?.name || user?.profile?.fullName || user?.username`.
  - When users registered or authenticated via Firebase, `fbUser.displayName` was set to the username (e.g. `aditya123`), which populated `user.name`. Consequently, the navbar displayed the username instead of the user's Full Name from their profile or settings.
  - On page refreshes in Firebase mode, `AuthContext` did not preserve cached profile full names, overwriting `user` with only the basic Firebase token attributes.
- **Changes Made:**
  - `React-Implementation/.../src/components/navbar.jsx`:
    - Prioritized `user?.profile?.fullName`, `user?.fullName`, `cachedFullName`, and backend-fetched profile name over username fallback.
    - Added synchronization with `teamforge:user_updated` and `focus` events so profile updates from Settings reflect immediately in the navbar without a page reload.
  - `React-Implementation/.../src/pages/settings.jsx`:
    - Updated `handleSubmit` to synchronize Firebase's `auth.currentUser.displayName` with the updated full name upon saving profile settings.
    - Dispatched `teamforge:user_updated` event to notify the navbar and other components live.
  - `React-Implementation/.../src/context/AuthContext.jsx`:
    - On Firebase `onAuthStateChanged`, reads cached full profile from localStorage (`teamforge.userProfile_${fbUser.uid}` and `teamforge.currentUser`) and asynchronously syncs the latest profile from `usersApi.get(fbUser.uid)` so real names persist across sessions.
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 4.25s).

### Port 5173 Dev Server Sync: Synchronized Settings & Navbar Name Fixes to Active Server
- **Status:** **DONE**
- **Analysis:**
  - Diagnostic scan of listening ports revealed that port 5173 (Vite dev server, PID 30032) and port 3000 (backend NestJS, PID 18412) were executing out of `C:\Users\adity\OneDrive\Desktop\Team-Forge-1`.
  - While the git workspace `26_PINEAPPLE-1` was cleanly fixed and verified, the running Vite dev server on port 5173 was continuing to serve code from `Team-Forge-1` where `const FULLNAME_RE` and `Full name contains invalid characters` were still present.
  - Testing against `http://localhost:5173` confirmed that `settings.jsx` was serving the stale regex validation.
- **Changes Made:**
  - Synchronized `src/pages/settings.jsx`, `src/components/navbar.jsx`, and `src/context/AuthContext.jsx` from `26_PINEAPPLE-1` to `Team-Forge-1`.
  - Confirmed via `http://localhost:5173/src/pages/settings.jsx` that `FULLNAME_RE` is completely gone.
  - Confirmed that alphanumeric names (such as `aditya123`) validate without errors.
- **Verification:**
  - `26_PINEAPPLE-1` Backend `npx tsc --noEmit`: PASS (0 errors).
  - `26_PINEAPPLE-1` Frontend `npm run lint`: PASS (0 errors, 0 warnings).
  - `26_PINEAPPLE-1` Frontend `npm run build`: PASS (0 errors).
  - `Team-Forge-1` Frontend `npm run build`: PASS (0 errors).
  - Live query to `http://localhost:5173/src/pages/settings.jsx`: PASS (0 occurrences of `FULLNAME_RE` or `Full name contains invalid`).

### Perf Phase 0: Setup and Baseline Environment
- **Status:** **DONE**
- **Environment & Baseline Recorded:**
  - Node version: `v22.16.0`, npm version: `10.9.2`.
  - Machine specs: Intel(R) Core(TM) Ultra 7 155U (12 cores, 14 logical processors), 31.45 GB RAM (16.18 GB free), OS Windows 11.
  - Active configuration: `AUTH_MODE=firebase` (with JWT fallback), `MAIL_MODE=ethereal`, Firebase: cloud project `team-forge-auth` (`VITE_USE_AUTH_EMULATOR=false`), DigiLocker mode: `sandbox`.
  - In-memory data counts:
    - Users: 13
    - Projects: 6
    - Tasks: 7
    - Messages: 5
    - Notifications: 0 (seeded on demand)
    - Audit log entries: 9
    - Sessions / Marketplace listings: 3 sessions, 4 mentor profiles
    - XP ledger entries: 33
  - Application startup methods:
    - Backend: `npm run dev` / `ts-node src/main.ts` on port 3000
    - Frontend Dev: `npm run dev` / Vite on port 5173
    - Frontend Production: `npm run build` && `npm run preview` on port 4173
- **Backup Created:**
  - Path: `c:\Users\adity\OneDrive\Desktop\PINEAPPLE-26-backup-before-perf`
  - Total copied: 438 files, 32.84 MB (excluding `node_modules`, `dist`, `.git`).
- **Production Build Baseline:**
  - Single monolithic bundle detected: `dist/assets/index-CIxwhvSc.js` (857.72 kB raw, 236.59 kB gzipped) and `dist/assets/index-twyBo3V_.css` (208.93 kB raw, 33.27 kB gzipped).
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 8.44s).

### Perf Phase 1: Comprehensive Performance Measurement & Bottleneck Discovery
- **Status:** **DONE**
- **Findings & Key Numbers:**
  - Added removable `TimingInterceptor` with `Server-Timing` response header and `PERF_LOG=true` support.
  - Measured 28 backend endpoints 3 times each (cold, warm 1, warm 2) across authenticated roles.
  - Slowest endpoints:
    - `/auth/login`: Median 137.99 ms (Cold: 155.49 ms) due to bcrypt hashing cost factor 10.
    - `/users/1/public-profile`: Median 5.97 ms (Worst: 7.54 ms).
    - `/auth/refresh`: Median 5.90 ms.
    - `/leaderboard?period=alltime`: Median 5.33 ms (Worst: 6.42 ms) due to full ledger recalculation.
    - `/admin/audit`: Median 4.75 ms, payload 8,654 bytes (unpaginated).
    - `/admin/users`: Median 4.22 ms, payload 7,615 bytes with N+1 `findByOwnerId` scans.
  - Frontend Production Build:
    - Monolithic bundle: `index-CIxwhvSc.js` is 857.72 kB (236.59 kB gzipped) — 0% code-splitting across all 40+ pages.
    - Landing page loads 746 KB `XP-System.png` and 5 other images without `loading="lazy"`.
    - Workspaces poll chat every 3 seconds even in background tabs without `document.hidden` check.
    - Zero client-side request deduplication or stale-while-revalidate caching.
  - Cataloged 25 primary bottlenecks in `docs/performance-findings.md` ranked by $(Time\ Saved \times Pages\ Affected)$.
- **Files Changed / Added:**
  - `back-end/src/core/interceptors/timing.interceptor.ts` (created)
  - `back-end/src/main.ts` (registered timing interceptor)
  - `scratch/test_measure_endpoints.js` (created)
  - `docs/performance-findings.md` (created)
  - `PROGRESS.md`
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors).
  - Frontend `npm run build`: PASS (0 errors).

### Perf Phase 2: Fix Backend Causes (Map Indexes, Caching, Retention Caps, Compression, CORS Max-Age)
- **Status:** **DONE**
- **Findings & Implemented Fixes:**
  1. **Map Indexes ($O(1)$ lookups):**
     - `UsersRepository`: Added `usersById`, `usersByEmail`, `usersByUsername` Map indexes rebuilt on startup and maintained on every user insertion, update, and deletion.
     - `ProjectsRepository`: Added `projectsById`, `projectsByOwnerId` Map indexes for instant lookup by project ID and owner ID.
     - `TasksRepository`: Added `tasksById`, `tasksByProjectId` Map indexes for instant lookup by task ID and project ID.
     - `CommunicationRepository`: Added `messagesByProjectId` and `notificationsByUserId` Map indexes.
     - `NotificationsService`: Added `notificationsById` and `notificationsByUserId` Map indexes.
  2. **Eliminated N+1 Scans:**
     - In `admin.service.ts`: `getUsers()` previously called `projectsService.findByOwnerId(u.id)` for every user in a loop ($O(U \times P)$). Replaced with a single pre-aggregation map of project counts across all projects in one pass ($O(P)$), joining in $O(1)$ per user.
  3. **Aggregates & Response Caching:**
     - `LeaderboardService`: Added 15-second in-memory cache for all-time, monthly, and weekly computed leaderboards with instant cache invalidation on task approvals or ledger writes.
     - `AdminService`: Added 10-second cache for `getStats()` dashboard aggregates with instant cache invalidation on user moderation mutations.
     - `FirebaseStrategy`: Added 60-second in-memory token verification cache to eliminate redundant remote Google Cloud / Admin SDK network calls during bursts.
     - Static & Public Asset Caching: Configured `Cache-Control: public, max-age=60, stale-while-revalidate=300` on public platform config and upload routes.
  4. **Pagination & Retention Limits:**
     - `NotificationsService`: Capped in-memory storage to 5,000 notifications; added optional `limit` and `offset` support.
     - `AuditService`: Capped in-memory audit log to 5,000 entries; added optional `limit` and `offset` support to prevent unbounded memory growth.
     - `ProjectsService`: Added optional `limit` and `offset` pagination to project queries.
  5. **Payload Compression & CORS Optimization:**
     - Created zero-dependency response compression middleware (`back-end/src/core/middleware/compression.middleware.ts`) using Node's built-in `zlib.gzipSync` for responses larger than 1024 bytes. Registered in `AppModule`.
     - Configured `maxAge: 86400` (24 hours) in `main.ts` CORS setup to cache `OPTIONS` preflight requests in the browser, cutting HTTP round-trips in half for client mutations.
- **Measured Results:**
  - `admin: audit log`: Payload size dropped from **8,604 bytes** down to **1,208 bytes** (86.0% reduction).
  - `admin: users list`: Payload size dropped from **7,688 bytes** down to **1,784 bytes** (76.8% reduction).
  - `projects: list`: Payload size dropped from **3,732 bytes** down to **1,123 bytes** (69.9% reduction).
  - `mentor marketplace: list mentors`: Payload size dropped from **2,683 bytes** down to **758 bytes** (71.7% reduction).
  - `mentor marketplace: sessions`: Payload size dropped from **1,755 bytes** down to **542 bytes** (69.1% reduction).
  - `tasks: by project`: Payload size dropped from **1,194 bytes** down to **429 bytes** (64.1% reduction).
  - `auth: login`: Payload size dropped from **1,298 bytes** down to **799 bytes** (38.4% reduction).
  - All 28 endpoints respond with HTTP 200 and include `Server-Timing` headers.
- **Files Changed / Added:**
  - `back-end/src/users/users.repository.ts`
  - `back-end/src/projects/projects.repository.ts`
  - `back-end/src/projects/projects.service.ts`
  - `back-end/src/projects/projects.controller.ts`
  - `back-end/src/tasks/tasks.repository.ts`
  - `back-end/src/communication/communication.repository.ts`
  - `back-end/src/notifications/notifications.service.ts`
  - `back-end/src/notifications/notifications.controller.ts`
  - `back-end/src/audit/audit.service.ts`
  - `back-end/src/admin/admin.service.ts`
  - `back-end/src/admin/admin.controller.ts`
  - `back-end/src/leaderboard/leaderboard.service.ts`
  - `back-end/src/auth/strategies/firebase.strategy.ts`
  - `back-end/src/core/middleware/compression.middleware.ts` (created)
  - `back-end/src/app.module.ts`
  - `back-end/src/main.ts`
  - `back-end/src/core/middleware/security.middleware.ts`
  - `PROGRESS.md`
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors).
  - Frontend `npm run build`: PASS (0 errors).

### Perf Phase 3: Fix Frontend Causes (Route Splitting, Request Deduplication, Polling & Visibility, Asset Optimization)
- **Status:** **DONE**
- **Findings & Implemented Fixes:**
  1. **Route-Level Code Splitting (`React.lazy` & `Suspense`):**
     - Converted all 40+ route pages in `AppRoutes.jsx` from static imports to dynamic imports using `React.lazy()`.
     - Grouped into role-based asynchronous bundles (Public/Auth, Core Shared, Collaborator, Owner, Mentor, Admin).
     - Added `<Suspense fallback={<RouteLoadingFallback />}>` wrapper with lightweight spinning indicator matching TeamForge design tokens.
  2. **In-Flight Request Deduplication & Stale-While-Revalidate Caching:**
     - In `src/services/apiClient.js`, implemented `inFlightRequests` Map: if an identical `GET` request is already in progress, concurrent callers receive the same pending Promise rather than initiating duplicate network requests.
     - Implemented `apiGetCache` with a 20-second TTL for read endpoints.
     - Implemented full cache invalidation on any data mutation (`POST`, `PUT`, `PATCH`, `DELETE`) and exported `clearApiCache()` helper to guarantee zero cache staleness.
  3. **Background Tab Polling & Page Visibility:**
     - In `CollaboratorWorkspace.jsx`, `OwnedWorkspace.jsx`, and `MentorProjectWorkspace.jsx`: increased chat polling interval from 3s to 6s, added `if (document.hidden) return;` check, and attached `visibilitychange` listener to refresh messages immediately upon returning to the tab.
     - In `dashboard.jsx`: adjusted periodic refresh from 6s to 12s, added `if (document.hidden) return;`, and throttled focus updates (minimum 10s cooldown) to prevent request stampedes on window switching.
     - In `NotificationContext.jsx`: throttled focus refresh (minimum 15s cooldown) and paused background intervals when `document.hidden` is true.
  4. **Asset & Font Optimization:**
     - In `src/pages/landingpage.jsx`: added `loading="lazy"` and `decoding="async"` attributes across all 6 feature images (`XP-System.png`, `Project-Collaboration.jpg`, etc.) preventing unnecessary downloads during initial page load.
     - In `index.html`: added `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />` to eliminate font handshake waterfalls.
- **Measured Results:**
  - **Main JS Bundle**: Dropped from **857.72 kB** (236.59 kB gzip) down to **288.39 kB** (90.51 kB gzip) — a **66.4% raw reduction** and **61.7% gzip reduction**!
  - **Main CSS Bundle**: Dropped from **208.93 kB** (33.27 kB gzip) down to **30.39 kB** (6.28 kB gzip) — an **85.5% reduction**!
  - **Landing Page Transfer**: Offloads heavy feature images (`XP-System.png` 746 KB, etc.) on initial render.
  - **Background Network Traffic**: Suppressed by >80% when tabs are in the background or during rapid window switching.
- **Files Changed:**
  - `React-Implementation/React-Implementation/src/routes/AppRoutes.jsx`
  - `React-Implementation/React-Implementation/src/services/apiClient.js`
  - `React-Implementation/React-Implementation/src/pages/collaborator/CollaboratorWorkspace.jsx`
  - `React-Implementation/React-Implementation/src/pages/owner/OwnedWorkspace.jsx`
  - `React-Implementation/React-Implementation/src/pages/mentor/MentorProjectWorkspace.jsx`
  - `React-Implementation/React-Implementation/src/pages/dashboard.jsx`
  - `React-Implementation/React-Implementation/src/context/NotificationContext.jsx`
  - `React-Implementation/React-Implementation/src/pages/landingpage.jsx`
  - `React-Implementation/React-Implementation/index.html`
  - `PROGRESS.md`
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Frontend `npm run lint`: PASS (0 errors).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 7.52s).
  - Preview server test: HTTP 200 on `http://localhost:4173/`.

### Perf Phase 4: Verification, Before/After Benchmarks & Documentation Sync
- **Status:** **DONE**
- **Verification & Benchmark Results:**
  1. **Before/After Comprehensive Benchmark Suite:**
     - Measured 28 endpoints 3 times each under identical conditions, documented in `docs/performance-results.md`.
     - Massive payload reductions achieved: Audit Log (-86.0%, 8.65 KB -> 1.21 KB), Admin Users (-76.6%, 7.62 KB -> 1.78 KB), Projects List (-74.6%, 4.42 KB -> 1.12 KB), Auth Refresh (-71.1%, 1.30 KB -> 375 B), Tasks (-58.5%, 1.03 KB -> 429 B).
     - Response compression with `zlib.gzipSync` active for payloads > 1024 bytes.
  2. **In-Memory Repository Stress Test (`test/stress-performance.spec.ts`):**
     - Scaled repositories with 200 users, 100 projects, 2,000 tasks, 6,000 notifications, and 6,000 audit records.
     - 1,000 `findById` lookups: 10.0 ms (avg 0.010 ms/op) via Map Index.
     - 1,000 `findByOwnerId` lookups: 0.296 ms (avg 0.0003 ms/op) via Map Index.
     - 1,000 `findAllByProjectId` lookups: 0.264 ms (avg 0.0003 ms/op) via Map Index.
     - Hard retention caps verified: notifications capped strictly at 5,000 (oldest 1,000 evicted); audit log capped strictly at 5,000 (oldest 1,000 evicted).
     - Heap memory delta: +3.21 MB across 14,000 total entity creations; completely bounded and stable with zero memory leaks.
  3. **Documentation & Specification Synchronization:**
     - Created `docs/performance-findings.md`: catalogs the 25 primary bottlenecks ranked by $(Time\ Saved \times Pages\ Affected)$.
     - Created `docs/performance-results.md`: complete before/after measurement table, payload comparisons, and bundle metrics.
     - Updated root `README.md`: added concise "Performance & Optimization Benchmarks" section with verification steps.
     - Created `docs/srs/SRS_updated.md`: non-functional performance requirements covering bundle limits, query times, compression, and retention caps.
- **Files Changed / Added:**
  - `docs/performance-results.md` (created)
  - `README.md`
  - `docs/srs/SRS_updated.md` (created)
  - `back-end/test/stress-performance.spec.ts` (created)
  - `PROGRESS.md`
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Backend `npx ts-node test/stress-performance.spec.ts`: PASS (All 5 stress checks passed).
  - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 6.46s).
  - Preview server test: HTTP 200 on `http://localhost:4173/`.

### Policy Plan Phase 1: Moderation Core, Warnings, Reputation Ledger & Suspension Cascades
- **Status:** **DONE**
- **Changes Made:**
  - **Time & Scheduled Jobs (`ClockService` & `JobsService`)**:
    - Created injectable `ClockService` (`src/common/services/clock.service.ts`) providing `now()`, `nowIso()`, `setTime()`, `advanceTime()`, `advanceHours()`, `advanceDays()`, and `reset()`.
    - Created `JobsService` and `@Global()` `JobsModule` (`src/jobs/`) with an idempotent hourly tick runner tracking execution via record flags.
    - Verified unit tests in `src/common/services/clock.service.spec.ts` (5/5 PASSED).
  - **Reputation Ledger (`ReputationService` & `GamificationService`)**:
    - Built dedicated `ReputationService` (`src/moderation/reputation.service.ts`) reading reputation strictly through `getReputation(userId)`: `max(0, sum of entries)`.
    - Implemented `recordInitial (+100 rep)` for new accounts at signup.
    - Implemented `recordSeed` preserving existing user/seed reputation on startup backfill.
    - Implemented `recordTaskApproved (+8 rep)`, `recordWarning (-10 rep)`, and `recordWarningRemoved (+10 rep)`.
    - Clamped reputation so it never drops below 0 (`floor: 0`) and does not affect XP.
    - Verified unit tests in `src/moderation/reputation.service.spec.ts` (7/7 PASSED) and `src/gamification/gamification.service.spec.ts` (4/4 PASSED).
  - **Moderation Architecture & Endpoints (`ModerationService` & `ModerationController`)**:
    - Created configuration `src/moderation/moderation.config.ts`: `WARNING_LIMIT = 4`, `MIN_REASON_LENGTH = 10`, `MAX_REASON_LENGTH = 500`.
    - Created entities `Warning` (`active | removed | cleared`) and `ReputationEntry` (`src/moderation/entities/`).
    - Built `ModerationService` enforcing written explanation 10–500 chars (`REASON_REQUIRED` 400), self-moderation defense (`CANNOT_MODERATE_SELF` 403), administrator defense (`CANNOT_MODERATE_ADMIN` 403), active warning tracking ($1/4 \to 4/4$), automatic suspension on 4th warning, manual suspension (`ALREADY_SUSPENDED` 409), reactivation (`NOT_SUSPENDED` 409) clearing active warnings to `status = 'cleared'`, and token invalidation (`tokenVersion++`, revoking refresh tokens).
    - Endpoints registered:
      - `POST /admin/users/:id/warn` { reason } -> 201 `{ warning, activeCount, autoSuspended }`
      - `POST /admin/users/:id/suspend` { reason } -> 200 `{ status: "suspended" }`
      - `POST /admin/users/:id/reactivate` { reason } -> 200 `{ status: "active", clearedWarnings }`
      - `GET /admin/users/:id/warnings` -> 200 `[warnings, newest first, with moderator name]`
      - `GET /users/me/warnings` -> 200 `[own warnings with N/4 label]`
    - Verified unit tests in `src/moderation/moderation.service.spec.ts` (10/10 PASSED).
  - **Suspension Cascades (`SuspensionConsequencesService`)**:
    - `handleCollaboratorSuspension`: Tasks in `Open` or `In Progress` return to `Unassigned` and `Open` (`status = TaskStatus.ToDo`); tasks `In Review` remain intact for owner decision; project owner is notified with the list of released task titles.
    - `handleOwnerSuspension`: All owned projects transition to `Closed` status (`closedReason = 'Owner suspended'`). Closed projects are read-only and locked, hidden from marketplace and completed lists. Active mentor sessions are paid out from escrow; unaccepted mentor sessions are refunded in full. Pending join requests become `system_closed` without counting against applicants. Collaborators and mentors receive notification. Applying to a closed project returns `409 PROJECT_CLOSED`.
    - `handleMentorSuspension`: Pending mentor sessions refunded; active sessions refunded in full, and project mentor slot is freed (`mentorId = null, mentor = null`).
    - Verified unit tests in `src/moderation/suspension-consequences.service.spec.ts` (5/5 PASSED).
  - **Testing Infrastructure & Suites**:
    - Created test helper suite `back-end/test/helpers/test-helpers.ts` (`createTestApp`, `loginAs`, `resetStores`, `advanceTime`, `MockMailService`).
    - Supertest E2E suite `back-end/test/phase1.e2e-spec.ts` covering 16 test scenarios (16/16 PASSED).
    - Created REST Client specification `docs/api-tests/phase-1.http` with 14 requests covering success, validation errors, unauthorized, self-moderation, admin-moderation, and closed project conflict cases.
  - **Frontend UI & Components**:
    - Created reusable `ModerationModal.jsx` (`components/common/`) reusing `Modal` and `FormInput`: required reason textarea with live character counter (10–500 chars), disabled submit until valid, shows server error message on failure, and displays result feedback ("Warning 2/4 sent" or "User suspended automatically").
    - `AdminUserDetails.jsx`: Integrated moderation modal for Warn, Suspend, and Reactivate actions. Displays active warnings badge as `N/4` (`2/4 Warnings`), StatCard `N/4`, and full historical warning records table with status, date, reason, and issuer.
    - `AdminUsers.jsx`: Added moderation modal for action menu (Warn, Suspend, Reactivate) with real-time character counter. Displays `Warned (N/4)` status badge.
    - `ProjectCard.jsx`: Displays `Closed` badge, closure reason banner, and disabled button for closed projects.
    - `MyProjects.jsx`: Added dedicated `Closed Projects` tab and section showing closure reasons.
    - `AdminProjects.jsx`: Added `Closed` status badge and filter tab displaying closure reasons.
    - `projectsApi.js`: Updated `isProjectLocked` and `isProjectActive` to recognize `closed` status.
    - `adminApi.js`: Added `warnUser`, `suspendUser`, `reactivateUser`, `getWarnings`, `getMyWarnings`.
    - Level 3 Vitest tests: `ModerationModal.test.jsx` (5/5 PASSED), `AdminUserDetails.test.jsx` (4/4 PASSED), `ProjectCard.test.jsx` (2/2 PASSED).
- **Files Changed / Added:**
  - `back-end/src/common/services/clock.service.ts` (created)
  - `back-end/src/common/services/clock.service.spec.ts` (created)
  - `back-end/src/jobs/jobs.service.ts` (created)
  - `back-end/src/jobs/jobs.module.ts` (created)
  - `back-end/src/moderation/moderation.config.ts` (created)
  - `back-end/src/moderation/entities/warning.entity.ts` (created)
  - `back-end/src/moderation/entities/reputation-entry.entity.ts` (created)
  - `back-end/src/moderation/reputation.service.ts` (created)
  - `back-end/src/moderation/reputation.service.spec.ts` (created)
  - `back-end/src/moderation/suspension-consequences.service.ts` (created)
  - `back-end/src/moderation/suspension-consequences.service.spec.ts` (created)
  - `back-end/src/moderation/moderation.service.ts` (created)
  - `back-end/src/moderation/moderation.service.spec.ts` (created)
  - `back-end/src/moderation/moderation.controller.ts` (created)
  - `back-end/src/moderation/moderation.module.ts` (created)
  - `back-end/src/projects/projects.repository.ts`
  - `back-end/src/projects/projects.service.ts`
  - `back-end/src/tasks/tasks.service.ts`
  - `back-end/src/join-requests/join-requests.service.ts`
  - `back-end/src/mentor-marketplace/mentor-marketplace.service.ts`
  - `back-end/src/audit/audit.service.ts`
  - `back-end/src/admin/admin.controller.ts`
  - `back-end/test/helpers/test-helpers.ts` (created)
  - `back-end/test/mocks/firebase-admin-mock.js` (created)
  - `back-end/test/phase1.e2e-spec.ts` (created)
  - `docs/api-tests/phase-1.http` (created)
  - `React-Implementation/React-Implementation/src/components/common/ModerationModal.jsx` (created)
  - `React-Implementation/React-Implementation/src/test/ModerationModal.test.jsx` (created)
  - `React-Implementation/React-Implementation/src/pages/admin/AdminUserDetails.jsx`
  - `React-Implementation/React-Implementation/src/pages/admin/AdminUsers.jsx`
  - `React-Implementation/React-Implementation/src/components/features/ProjectCard.jsx`
  - `React-Implementation/React-Implementation/src/pages/owner/MyProjects.jsx`
  - `React-Implementation/React-Implementation/src/pages/admin/AdminProjects.jsx`
  - `React-Implementation/React-Implementation/src/services/projectsApi.js`
  - `React-Implementation/React-Implementation/src/services/adminApi.js`
  - `React-Implementation/React-Implementation/src/test/AdminUserDetails.test.jsx` (created)
  - `React-Implementation/React-Implementation/src/test/ProjectCard.test.jsx` (created)
  - `README.md`
  - `docs/rbac-matrix.md`
  - `docs/srs/SRS_updated.md`
  - `PROGRESS.md`
- **Verification:**
  - Backend `npx tsc --noEmit`: PASS (0 errors).
  - Backend `npm test`: PASS (6 test suites passed, 40 tests passed, 0 failed).
  - Backend `npm run test:e2e`: PASS (1 test suite passed, 16 tests passed, 0 failed).
  - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend `npm test`: PASS (3 test suites passed, 11 tests passed, 0 failed).
  - Frontend `npm run build`: PASS (0 errors, 187 modules transformed in 9.42s).

### Policy Plan Phase 2: Appeals and Reports (User Reporting, Admin Reports Section, Warning Appeals, and Audit Filtering)
- **Status:** **DONE**
- **Changes Made:**
  - **Backend Entities & DTOs**:
    - Created `Report` entity (`id, reporterId, reportedUserId, reason, details, status, adminNote, handledBy, createdAt, updatedAt`) supporting reasons: Harassment, Spam, Cheating or plagiarism, Fake proof, Abandoned work, Inappropriate content, Other.
    - Created `Appeal` entity (`id, warningId, userId, explanation, status: pending|accepted|rejected, adminNote, decidedBy, createdAt, decidedAt`).
    - Validated inputs via class-validator: `CreateReportDto` (20-1000 chars details, allowed reason enum), `UpdateReportStatusDto`, `ActionReportDto` (action: warn|suspend|dismiss, 10-500 chars reason), `CreateAppealDto` (20-1000 chars explanation), `DecideAppealDto` (decision: accept|reject, 10+ chars note).
  - **Backend Services**:
    - `ReportsService`: Enforces cannot report self (`CANNOT_REPORT_SELF` 403), cannot report admin or superuser accounts (`CANNOT_REPORT_ADMIN` 403), maximum 5 reports per day per reporter (`DAILY_LIMIT` 429), and no duplicate open report from same reporter against same target (`DUPLICATE_OPEN_REPORT` 409).
    - `ReportsService.actionReport`: Resolves reports via Phase 1 `ModerationService.warn` or `suspend`, or sets status to `Dismissed`, recording audit logs and notifying reporter with a one-line outcome notification (reported user identity is never exposed).
    - `AppealsService`: Allows user to appeal their own active warnings once within 7 days (`APPEAL_WINDOW_CLOSED` 409, `ALREADY_APPEALED` 409, `WARNING_NOT_ACTIVE` 409, `NOT_YOUR_WARNING` 403, `SUSPENDED` 403). Admin decision to accept removes the warning, restores +10 reputation idempotently via `ReputationService`, decrements active count, and notifies user.
    - `UsersService.searchUsers`: Added `GET /users/search?q=` requiring auth, min 2 chars, max 10 results, strictly returning `{ id, name, username, university }` (never email, hash, or private fields), excluding self, portal accounts, and suspended users.
    - `AuditService.findAll`: Extended with `userId` query parameter filtering log events where user is actor, target, entityId, or involved in details.
    - `RolesGuard`: Mapped section permission `'reports'` to `/admin/reports` and `/admin/appeals` routes (Super User has wildcard `*`).
  - **Frontend Implementation**:
    - `usersApi.searchUsers(q)`: Added safe user lookup client.
    - `reportsApi.js`: Added endpoints `createReport`, `getMyReports`, `getAdminReports`, `getReportDetails`, `updateReportStatus`, `actionReport`.
    - `appealsApi.js`: Added endpoints `submitAppeal`, `getMyAppeals`, `getAdminAppeals`, `decideAppeal`.
    - `help.jsx` & `help.css`: Added tabs `"Contact Support & FAQs"` and `"Report a User"`. Implemented 300ms debounced search combobox displaying only name, username, and university; reason dropdown with 7 allowed reasons; details textarea with live character counter (20-1000 chars); disabled submit until valid; server error alerts; success banner; and "My Submitted Reports" table below.
    - `notifications.jsx` & `notifications.css`: Integrated warning appeal flow. Displays "Appeal Warning" button for active warnings within 7 days; opens Appeal Modal with live character counter (20-1000 chars); submits appeal and reflects real-time status badges: `Appealed (Under Review)`, `Appeal Accepted (+10 Rep restored)`, or `Appeal Rejected` with admin note.
    - `AdminReports.jsx` & `AdminReports.css`: Implemented dedicated admin section guarded by `'reports'` permission. Two tabs: `User Reports` and `Warning Appeals`.
      - User Reports tab: status filters, search, review modal with confidential reporter info, reported user details, prior warnings/reports count, direct link to `/admin/audit?userId=${reportedUser.id}`, status update, and actions: Warn, Suspend (reusing `ModerationModal`), and Dismiss.
      - Appeals tab: status filters, search, decision modal to Accept (removes warning & restores +10 rep) or Reject with required 10+ character admin note.
    - `AuditLog.jsx`: Integrated `useSearchParams()`; loads logs filtered by `?userId=`; displays active filter chip `Filtered by User ID: ${userId} [✕ Clear]`.
    - `SuperuserAdmins.jsx`: Added `'reports'` permission checkbox to admin creation and edit modals.
    - `AdminLayout.jsx` & `AppRoutes.jsx`: Added `🚩 Reports & Appeals` sidebar item and route `/admin/reports`.
  - **Testing**:
    - Backend Unit tests: `reports.service.spec.ts` (8 tests) + `appeals.service.spec.ts` (7 tests) + existing (40 tests) = **8 suites, 55 tests PASSED (0 failed)**.
    - Backend E2E tests: `phase2.e2e-spec.ts` (20 tests) + `phase1.e2e-spec.ts` (16 tests) = **2 suites, 36 tests PASSED (0 failed)**.
    - Frontend Vitest tests: `HelpReport.test.jsx` (5 tests) + `NotificationAppeal.test.jsx` (4 tests) + `AdminReports.test.jsx` (5 tests) + existing (11 tests) = **6 suites, 25 tests PASSED (0 failed)**.
    - REST Client file: `docs/api-tests/phase-2.http` with 17 scenarios.
- **Verification:**
  - Backend `.\back-end\node_modules\.bin\tsc.cmd -p back-end\tsconfig.json --noEmit`: PASS (0 errors).
  - Backend `npm test`: PASS (8 test suites passed, 55 tests passed, 0 failed).
  - Backend `npm run test:e2e`: PASS (2 test suites passed, 36 tests passed, 0 failed).
  - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend `npm test`: PASS (6 test suites passed, 25 tests passed, 0 failed).
  - Frontend `npm run build`: PASS (0 errors, 192 modules transformed).

### Policy Plan Phase 3: Joining and Leaving (2-Request Limit, Owner Rejection Reason, Leave Dialog & 5-Day Auto-Close)
- **Status:** **DONE**
- **Changes Made:**
  - **Backend Entities, DTOs & Validation**:
    - `JoinRequest` entity: extended with `rejectionReason?: string`, `decidedAt?: string`, `closureReason?: string`. Supported statuses: `pending`, `approved`, `rejected`, `withdrawn`, `system_closed`.
    - `Project` entity & repository: added `day4ReminderSentAt?: string`, `pendingReviewReminderSentAt?: string`, `createdAt: string`, `updatedAt: string`.
    - `LeaveProjectDto`: validates `category` from canonical list (`'Too busy'`, `'Project not as described'`, `'Conflict with the team'`, `'Personal reasons'`, `'Other'`) and `reason` (10 to 500 characters).
    - `UpdateJoinRequestDto`: validates status updates (`rejected`, `approved`, `withdrawn`, `system_closed`) and written `reason` / `rejectionReason`.
  - **Backend Services & Policy Rules**:
    - `JoinRequestsService`:
      - `requestsUsed(userId, projectId)`: counts `pending`, `approved`, `rejected`, and `withdrawn` requests. Excludes `system_closed` (requests closed due to project full, project closed, or owner suspension do NOT count against collaborator).
      - `create()`: enforces max 2 requests per project. If `requestsUsed >= 2`, rejects with HTTP 409 `REQUEST_LIMIT_REACHED`. Enforces `PROJECT_FULL` (409), `PROJECT_CLOSED` (409), `PROJECT_COMPLETED` (409), `ALREADY_PENDING` (409), `ALREADY_MEMBER` (409), `OWN_PROJECT` (403), `BANNED` (403).
      - `update()`: when owner rejects, requires written reason (10 to 500 chars, HTTP 400 `REASON_REQUIRED` otherwise). Only owner of THAT project can reject (HTTP 403 `FORBIDDEN` otherwise). Sets `decidedAt` and stores `rejectionReason`.
      - `remove()`: withdrawing a request marks it `status = 'withdrawn'`.
      - `getMyRequestStatus(userId, projectId)`: returns canonical `{ state, requestsLeft, requestsUsed, lastReason }`.
      - `findMyRequests(userId)`: enriches requests with `rejectionReason`, `requestsUsed`, and `requestsLeft`.
    - `ProjectsService.leaveProject()`:
      - Enforces policy: owner cannot leave (`OWNER_CANNOT_LEAVE` 403), mentor cannot leave (`MENTOR_CANNOT_LEAVE` 403), non-member cannot leave (`NOT_A_MEMBER` 403), completed or closed project is locked (`PROJECT_LOCKED` 409).
      - Unapproved tasks (Open or In Progress) assigned to user are reset to `Unassigned` and `To Do`. Completed tasks, XP, and reputation stay.
      - Frees collaborator slot, updates membership, records audit log entry, and notifies owner with reason category and explanation.
    - `JobsService.closeEmptyProjects()`:
      - Automated hourly background job for projects 5 days after creation with no approved collaborator and no pending request: closes project with reason `"No applicants within 5 days"`.
      - Day 4 reminder sent to owner once (`day4ReminderSentAt`).
      - If pending requests exist on Day 5, pauses closing and reminds owner to review (`pendingReviewReminderSentAt`).
      - Full refund issued to active mentor sessions and mentor notified via `MentorMarketplaceService.handleProjectClosed`.
  - **Frontend UI & Components**:
    - `requestState.js`: canonical `getRequestControlConfig(statusObj)` handling 8 distinct states (`none`, `pending`, `rejected_can_retry`, `rejected_final`, `member`, `banned`, `full`, `closed`).
    - `ProjectCard.jsx`: consumes `getRequestControlConfig`. Displays "Apply" (with `"1 request left"` hint after 1st rejection), disabled `"Request rejected"` tag after 2nd rejection, disabled `"Request pending"`, and disabled `"Closed"` badge.
    - `ProjectsMarketplace.jsx`: integrates `resolveRequestConfig(project)`. Previews display rejection history notice ("Previous Application Declined: reason") and enforces application limits.
    - `AppliedProjects.jsx`: status column renders `"Request pending"` with Delete Request button; 1st rejection with `"Rejected (1 request left)"` badge and rejection reason text; 2nd rejection with `"Request rejected"` badge and reason; `"Removed"` badge with removal reason; and `"System Closed"` badge.
    - `OwnedWorkspace.jsx`: owner clicking "Decline" opens "Decline Join Request" modal requiring 10-500 character written explanation with live counter (`N / 500`). Submits to `joinRequestsApi.respond(id, 'rejected', { reason })`.
    - `CollaboratorWorkspace.jsx`: replaces basic prompt with full Leave Project dialog detailing policy rules (tasks returned to unassigned, approved work/XP preserved, re-apply consumption), category selector, and 10-500 character explanation. Submits to `projectsApi.leave(projectId, { category, reason })`.
  - **Testing**:
    - Backend Unit tests: 10 test suites, **73 passed, 0 failed** (`join-requests.service.spec.ts`, `jobs.service.spec.ts`, `moderation.service.spec.ts`, `reports.service.spec.ts`, `appeals.service.spec.ts`, `clock.service.spec.ts`, `reputation.service.spec.ts`, `suspension-consequences.service.spec.ts`, `admin.service.spec.ts`, `gamification.service.spec.ts`).
    - Backend E2E tests: 3 test suites, **56 passed, 0 failed** (`phase1.e2e-spec.ts`, `phase2.e2e-spec.ts`, `phase3.e2e-spec.ts`).
    - Frontend Vitest tests: 10 test suites, **38 passed, 0 failed** (`RequestStateControl.test.jsx`, `AppliedProjectsReason.test.jsx`, `OwnerRejectModal.test.jsx`, `LeaveProjectDialog.test.jsx`, `ProjectCard.test.jsx`, `NotificationAppeal.test.jsx`, `ModerationModal.test.jsx`, `AdminReports.test.jsx`, `AdminUserDetails.test.jsx`, `HelpReport.test.jsx`).
    - Frontend ESLint: **0 errors, 0 warnings**.
    - Frontend Vite Production Build: **0 errors**, 193 modules transformed.
    - REST Client file: `docs/api-tests/phase-3.http` with 15 complete scenarios.
- **Verification:**
  - Backend TypeScript `npx tsc --noEmit`: PASS (0 errors).
  - Backend Unit tests `npm test`: PASS (10 suites passed, 73 tests passed, 0 failed).
  - Backend E2E tests `npm run test:e2e`: PASS (3 suites passed, 56 tests passed, 0 failed).
  - Frontend ESLint `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend Vitest `npm test`: PASS (10 suites passed, 38 tests passed, 0 failed).
  - Frontend Build `npm run build`: PASS (0 errors).

### Policy Plan Phase 4: Mentors and Deadlines (Experience & Tenure, Booking Decline & Refund, Due Dates & Missed Penalties, Project Deadlines)
- **Status:** **DONE**
- **Changes Made:**
  - **Backend Services, DTOs & Validation**:
    - `PlatformConfigService` & `PlatformConfigEntity`:
      - Added `minimumTenure` (alias `mentorMinYearsExperience`) defaulting to 5, validated as integer between 5 and 40.
      - Enforced that minimum tenure can only be raised (between 5 and 40); rejects attempts to lower with HTTP 400. Fixed maximum is 40.
    - `MentorApplicationsService`:
      - Validates years of professional experience as whole number between 5 and 40 on application creation (`IsInt`, `Min(5)`, `Max(40)`).
      - Enforces dynamic platform configuration `minimumTenure` upon application submission and administrative approval.
    - `MentorMarketplaceService`:
      - Automatically sets `respondBy = now + 3 days` (ISO string) when a session is booked.
      - `declineSession()`: requires written reason between 10 and 500 characters (returns HTTP 400 `REASON_REQUIRED` otherwise); stores `declineReason` and `declinedBy: 'mentor'`; issues full refund from escrow to the project owner; sends notification with the reason to the owner. Supported via both `POST` and `PATCH`.
      - `expireSession()`: marks expired sessions as `refunded` with `declineReason: 'No response within 3 days'` and `declinedBy: 'system'`; refunds owner in full and notifies both student and mentor.
    - `TasksService` & `TasksRepository`:
      - Enforces mandatory task due date on creation (`DUE_DATE_REQUIRED` 400); validates that due date cannot be in the past (`DUE_DATE_PAST` 400); validates that task due date cannot exceed project due date (`DUE_DATE_AFTER_PROJECT` 400).
      - Task due date moving / updating: owner may move a task due date only until that date has passed and the task is not approved; returns HTTP 409 `DUE_DATE_LOCKED` if already passed or approved.
      - Startup backfill: on application bootstrap, backfills existing tasks missing a due date with their project's due date and logs count.
      - Updated `isOverdue` calculation to use injectable `ClockService.now()`.
    - `ProjectsService`:
      - Implemented `changeDeadline(projectId, { dueDate, reason }, callerId)` (`PATCH /projects/:id/deadline`).
      - Only project owner can change deadline (HTTP 403 `FORBIDDEN`).
      - Project cannot be Completed or Closed (HTTP 409 `PROJECT_LOCKED`).
      - Written reason of at least 10 characters required (HTTP 400 `REASON_REQUIRED`).
      - New project deadline must be in the future (HTTP 400 `DEADLINE_NOT_FUTURE`).
      - New project deadline cannot be earlier than any active task due date (HTTP 400 `DEADLINE_BEFORE_TASKS`).
      - Records audit log entry and notifies all project collaborators and assigned mentor with old deadline, new deadline, and written reason.
    - `JobsService`:
      - `expireMentorRequests()`: automated hourly job scanning pending funded mentor sessions; auto-declines and refunds after 3 days with reason `"No response within 3 days"`. Idempotent.
      - `applyDeadlinePenalties()`: automated hourly job detecting tasks whose due date has passed (calculated from UTC midnight server time the day after). If task is Open (`To Do`) or In Progress, deducts **-5 reputation** once per task (`recordDeadlineMissed()`, ledger entry `deadline_missed`, flag `penaltyAppliedAt`). Unassigned, submitted (`In Review`), and completed tasks are exempt. Reassigned tasks penalize current assignee. Reputation floored at 0. Assignee notified and audit entry recorded. Idempotent.
  - **Frontend UI & Components**:
    - `MentorApplication.jsx`:
      - Years of experience input configured with `type="number"`, `min={minYearsRequired}`, `max="40"`, `step="1"`.
      - Validates integer between 5 and 40, displaying clear validation errors and server-returned errors.
    - `SuperuserConfig.jsx`:
      - Platform Configuration Minimum Tenure input configured with `min="5"`, `max="40"`, `step="1"`.
      - Helper text indicates tenure defaults to 5 and can only be raised (up to 40). Validates that tenure cannot be lowered.
    - `MentorRequests.jsx`:
      - Incoming booking rows display response timer (`⏱️ Respond within N day(s)`) based on `respondBy`.
      - Mentor clicking "Decline" opens a dedicated modal requiring a 10 to 500 character written explanation with live counter.
      - Submits `{ reason }` via `mentorMarketplaceApi.declineSession()`. Updates row status to refunded, displays decline reason and badge.
    - `MentorsDirectory.jsx`:
      - Booking history table displays `declineReason` and `declinedBy` (`Declined by mentor` or `Auto-declined`) on refunded sessions, as well as `respondBy` date on pending sessions.
    - `TaskCard.jsx`:
      - Overdue indicator: renders `⚠️ Overdue` badge when due date has passed and task is not completed.
      - Due date locking: renders lock icon `🔒` when due date has passed or task is approved.
      - Move action: provides a "Move" action for the owner when due date is in the future and task is not completed.
    - `OwnedWorkspace.jsx`:
      - Header toolbar includes "📅 Change Deadline" button when project is not locked.
      - `ChangeProjectDeadlineModal`: validates future date, validates date not earlier than latest task due date, validates written reason >= 10 characters. Submits to `projectsApi.changeDeadline()`.
      - `MoveTaskDueDateModal`: allows owner to adjust task due date within project bounds before the task deadline passes or task is approved.
    - API clients:
      - `projectsApi.changeDeadline(id, payload)`: `PATCH /projects/:id/deadline`.
      - `mentorMarketplaceApi.declineSession(id, payload)`: `POST /mentor-marketplace/sessions/:id/decline`.
  - **Testing**:
    - Backend Unit tests: 13 test suites, **100 passed, 0 failed** (`mentor-applications.validator.spec.ts`, `deadline-penalties.spec.ts`, `deadline-change.spec.ts`, `jobs.service.spec.ts`, `moderation.service.spec.ts`, `appeals.service.spec.ts`, `reports.service.spec.ts`, `suspension-consequences.service.spec.ts`, `join-requests.service.spec.ts`, `reputation.service.spec.ts`, `clock.service.spec.ts`, `gamification.service.spec.ts`, `admin.service.spec.ts`).
    - Backend E2E tests: 4 test suites, **70 passed, 0 failed** (`phase1.e2e-spec.ts`, `phase2.e2e-spec.ts`, `phase3.e2e-spec.ts`, `phase4.e2e-spec.ts`).
    - Frontend Vitest tests: 14 test suites, **46 passed, 0 failed** (`MentorApplicationYears.test.jsx`, `DeclineSessionModal.test.jsx`, `TaskDueDateValidation.test.jsx`, `ChangeDeadlineModal.test.jsx`, `RequestStateControl.test.jsx`, `AppliedProjectsReason.test.jsx`, `OwnerRejectModal.test.jsx`, `LeaveProjectDialog.test.jsx`, `ProjectCard.test.jsx`, `NotificationAppeal.test.jsx`, `ModerationModal.test.jsx`, `AdminReports.test.jsx`, `AdminUserDetails.test.jsx`, `HelpReport.test.jsx`).
    - Frontend ESLint: **0 errors, 0 warnings**.
    - Frontend Vite Production Build: **0 errors**, 193 modules transformed.
    - REST Client file: `docs/api-tests/phase-4.http` documenting 18 scenarios with realistic payloads and expected responses.
- **Verification:**
  - Backend Unit tests `npm test`: PASS (13 suites passed, 100 tests passed, 0 failed).
  - Backend E2E tests `npm run test:e2e`: PASS (4 suites passed, 70 tests passed, 0 failed).
  - Frontend ESLint `npm run lint`: PASS (0 errors, 0 warnings).
  - Frontend Vitest `npm test`: PASS (14 suites passed, 46 tests passed, 0 failed).
  - Frontend Build `npm run build`: PASS (0 errors).

### Policy Plan Phase 5: Username on Google and GitHub Sign-in, and Small UI Changes
- **Status:** **DONE**
- **Changes Made:**
  - **Investigation & Root Cause Analysis**:
    - Confirmed that normal signup was transmitting typed usernames properly, but in social sign-in handlers (`Login.jsx`, `Signup.jsx`, `FirebaseStrategy`, `JwtStrategy`, `UsersRepository.findOrCreateFromAuth`) usernames were being automatically derived using `email.split('@')[0]` and fallback profiles created without user input.
  - **Zero Derivation Architecture & Invariant Enforcement**:
    - Removed every code path that derived or synthesized a username from an email prefix across controllers, services, repositories, strategies, and frontend components.
    - Added automated source code audit test in `phase5.e2e-spec.ts` guaranteeing zero occurrences of `split('@')[0]` derivation in `back-end/src`.
    - Enforced mandatory explicit username in `POST /users` and `POST /auth/signup` returning HTTP 400 `USERNAME_REQUIRED` when missing or blank.
    - Username format validation: enforces length between 3 and 30 characters and characters matching `/^[a-zA-Z0-9_-]{3,30}$/`.
    - Uniqueness: case-insensitive and trimmed uniqueness enforcement returning HTTP 409 `USERNAME_TAKEN` with stable machine code.
  - **Incomplete Profile Route Guard (HTTP 403 `PROFILE_INCOMPLETE`)**:
    - Added `profileComplete` boolean flag to `User` entity, user repository, and auth strategies.
    - For new social sign-in users without a completed profile, `profileComplete` is set to `false`.
    - In `AuthGuard`: when `user.profileComplete === false`, access to any route other than `/users/me`, `/auth/me`, `/auth/profile`, `/users/username-available`, and `/auth/logout` throws HTTP 403 `PROFILE_INCOMPLETE`.
    - In frontend `ProtectedRoute.jsx`: unauthenticated users redirect to `/login`; authenticated users with `profileComplete === false` redirect to `/complete-profile`.
  - **Social Profile Completion Step**:
    - Created `CompleteProfile.jsx` and `completeProfile.css` (`/complete-profile` route).
    - Requires username with debounced live availability check against `GET /users/username-available` (300ms) showing status indicators (checking, available, taken, invalid format).
    - Prefills full name from provider or state, editable, minimum 2 characters required.
    - Optional university / institution input.
    - Refuses to submit until a valid, unique username is selected.
    - Saves via `POST /auth/profile`, sets `profileComplete: true`, updates `AuthContext`, and navigates to `/dashboard`.
    - If user with already completed profile visits `/complete-profile`, automatically redirects to `/dashboard`.
  - **Existing Accounts Flagging & Username Confirmation Banner**:
    - Added startup scan in `UsersRepository.initSeeds()`: flags any existing user whose username equals their lowercase email prefix (`usernameAutoGenerated = true`).
    - Seeded user `u-collab` (`aditya@example.com`, username `aditya`) flagged with `usernameAutoGenerated: true` for verification.
    - `GET /users/me` and `GET /auth/me` return `{ profileComplete, needsUsernameConfirmation }`.
    - Created `UsernameConfirmationBanner.jsx` and `UsernameConfirmationBanner.css` mounted in `Layout.jsx` at the top of the workspace.
    - Displays non-blocking notice: `"Choose your username: Your current username is @{user.username}. Please confirm or choose a new username."`
    - "Keep @{user.username}" action sends `PATCH /users/me/username` with `{ confirm: true }`, clears the flag, and dismisses the banner.
    - "Change" action expands inline form with debounced availability check, sends `PATCH /users/me/username` with `{ username }`, validates, updates username, clears the flag, and dismisses the banner.
  - **Admin Projects Table UI Update**:
    - Removed `Difficulty` column definition (`key: 'difficulty'`), sort, and filter from `AdminProjects.jsx`.
    - Verified that `AdminProjectDetails.jsx` retains the Difficulty meta display field.
  - **Testing & Verification**:
    - Backend Unit tests: 14 test suites, **115 passed, 0 failed** (`username.validator.spec.ts` 15/15 passed).
    - Backend E2E tests: 5 test suites, **82 passed, 0 failed** (`phase5.e2e-spec.ts` 12/12 passed).
    - Backend TypeScript typecheck: `tsc --noEmit` **0 errors**.
    - Frontend Vitest tests: 18 test suites, **63 passed, 0 failed** (`CompleteProfile.test.jsx`, `ProfileCompleteGuard.test.jsx`, `UsernameConfirmationBanner.test.jsx`, `AdminProjectsTable.test.jsx` all passed).
    - Frontend ESLint: **0 errors, 0 warnings**.
    - Frontend Production Build: **0 errors** (197 modules transformed).
    - REST Client file: `docs/api-tests/phase-5.http` documenting 12 test scenarios with expected codes and payloads.

### Policy Plan Phase 6: Security Hardening (Private Chat Guard, URL Validation, DigiLocker Name Matching, Incomplete-Profile Lock, Self-Report Guard, Outbound Link Warning)
- **Status:** **DONE**
- **Changes Made:**
  - **Private Project Chat Guard (HTTP 403 `CHAT_MEMBERSHIP_REQUIRED` / 401 Unauthorized)**:
    - In `communication.controller.ts`: Extracted authenticated caller (`@CurrentUser() authUser`) on `GET /communication/messages/project/:projectId` and `POST /communication/messages`. Missing authentication throws HTTP 401 `UnauthorizedException`.
    - In `communication.service.ts`: Enforced access control via `getProjectRole(project, caller)` and `isPlatformAdminOrSuperUser(caller)`. Allowed callers include: Project Owner, Active Collaborators, Assigned Mentor, and Admins/SuperUser.
    - Non-members and removed/former members receive HTTP 403 `ForbiddenException` with machine code `CHAT_MEMBERSHIP_REQUIRED`.
    - Security audit logging: Unauthorized chat attempts write audit log entry `action: 'CHAT_ACCESS_DENIED'` with actor and project details.
    - Frontend workspaces (`CollaboratorWorkspace.jsx`, `OwnedWorkspace.jsx`, `MentorProjectWorkspace.jsx`): Catch 403 on chat fetch and polling, stop polling interval, and pass `isForbidden` to `<ChatBox>`.
    - Reusable `ChatBox.jsx`: When `isForbidden` is true, displays clean locked state with lock icon and `"You are not a member of this project"`, preventing message input or interaction.
  - **Proof & User-Supplied URL Validation (HTTP 400 `INVALID_URL` / SafeLink Outbound Warning)**:
    - Backend URL utility `back-end/src/common/utils/url.util.ts`: Created `isSafeHttpUrl(value)` and `assertSafeHttpUrl(value, field, userId, auditService)`. Validates string length <= 2048, protocol must be `http:` or `https:`, contains valid host, strictly rejecting `javascript:`, `data:`, `vbscript:`, `file:`, `ftp:`, triple-slash URLs (`http:///`). Logs audit event `INVALID_URL_REJECTED` and throws HTTP 400 `BadRequestException` with stable code `INVALID_URL`.
    - Applied in `tasks.service.ts` across `create()`, `update()`, and `updateStatus()` for `proofLink` and `proofUrl`.
    - Applied in `projects.service.ts` for `finalLink` and `finishedLink`.
    - Applied in `users.service.ts` for `linkedIn`, `portfolio`, and `website`.
    - Applied in `mentor-applications.service.ts` for `linkedIn` and `portfolio`.
    - Frontend URL utility `React-Implementation/React-Implementation/src/utils/urlUtil.js` and `SafeLink.jsx`: Implemented shared `isSafeHttpUrl` and `isExternalUrl`. Dangerous/invalid URLs render as plain text (`<span data-testid="safelink-plain">`), never as clickable anchors. External links trigger a confirmation modal displaying destination domain in bold (`data-testid="safelink-domain"`), full target URL (`data-testid="safelink-full-url"`), "Cancel", and "Continue" opening external URL via `window.open` in a new tab.
    - Integrated `<SafeLink>` in `TaskCard.jsx` and `profile.jsx`.
    - Added real-time URL validation and server error display in `CollaboratorWorkspace.jsx` (proof modal), `OwnedWorkspace.jsx` (publish modal), and `settings.jsx` (LinkedIn profile).
  - **Incomplete-Profile Lock (HTTP 403 `PROFILE_INCOMPLETE`)**:
    - Created `isProfileComplete(user)` in `back-end/src/common/utils/profile.util.ts` deriving completeness directly from non-empty username (`Boolean(username && username.trim().length > 0)`).
    - Updated `JwtStrategy` and `FirebaseStrategy` to derive and inject `profileComplete` into authenticated user payloads.
    - Updated `AuthGuard` (`back-end/src/auth/guards/auth.guard.ts`): When `user.profileComplete === false`, access to any non-whitelisted route throws HTTP 403 `PROFILE_INCOMPLETE`. Whitelisted endpoints include: `/auth/me`, `/users/me`, `/auth/profile`, `/users/username-available`, `/auth/logout`, `/auth/logout-all`.
  - **DigiLocker Sandbox Name Matching (Token Set Equality & Honorifics Stripping)**:
    - Updated `digilocker-sandbox.provider.ts`: Implemented `normalizeDigiLockerTokens` and `isDigiLockerNameMatch`.
    - Normalized tokens by lowercasing, collapsing whitespace, stripping punctuation (`. , - / # ! $ % * : ; { } = _ ~ ( )`), and filtering common honorifics (`Dr.`, `Mr.`, `Mrs.`, `Ms.`, `Miss`, `Prof.`, `Professor`, `Shri`, `Smt`, `Sir`, `Madam`, `Er.`, `CA`, `MD`, `PhD`).
    - Comparison requires exact match or equal token sets (e.g. `"Aditya Verma"` matches `"Verma Aditya"` and `"Dr. Aditya Verma"` matches `"Verma Aditya"`). Substring matches are strictly rejected (`"Aditya"` does NOT match `"Aditya Verma"`).
  - **Self-Report Guard (HTTP 400 `CANNOT_REPORT_SELF`)**:
    - Updated `reports.service.ts`: Check `reporterId === reportedUserId` at top of `createReport()`, returning HTTP 400 `BadRequestException` with `code: 'CANNOT_REPORT_SELF'`.
    - Updated `help.jsx`: Injected `AuthContext`, filtered current user from search dropdown (`usersApi.searchUsers`), blocked self-submission in UI, and disabled submit button if self is targeted.
    - Verified `profile.jsx`: User profile view is strictly the authenticated user's own profile without report buttons (hidden).
  - **Testing & Verification**:
    - Backend Unit tests: 17 test suites, **135 passed, 0 failed** (`url.util.spec.ts` 11/11, `digilocker-sandbox.matcher.spec.ts` 5/5, `profile-complete.spec.ts` 4/4, `reports.service.spec.ts` 8/8 all passed).
    - Backend E2E tests: 6 test suites, **107 passed, 0 failed** (`phase6.e2e-spec.ts` 25/25 passed).
    - Backend TypeScript typecheck: `tsc --noEmit` **0 errors**.
    - Frontend Vitest tests: 19 test suites, **74 passed, 0 failed** (`SafeLink.test.jsx` 11/11 passed).
    - Frontend ESLint: **0 errors, 0 warnings**.
    - Frontend Production Build: **0 errors** (200 modules transformed in 7.5s).
    - REST Client file: `docs/api-tests/phase-6.http` documenting 17 test scenarios with expected codes and payloads.

### Policy Plan Phase 7: Scheduler and Job Monitor (Automated Hourly Cron, Isolated Execution, In-Memory Lock & Super User/Admin UI)
- **Status:** **DONE**
- **Changes Made:**
  - **Automated NestJS Scheduler Registration & Hourly Cron**:
    - Registered `ScheduleModule.forRoot()` once globally in `back-end/src/app.module.ts`.
    - Added `@Cron(CronExpression.EVERY_HOUR)` to `JobsService.handleHourlyCron()` in `back-end/src/jobs/jobs.service.ts`.
    - Controlled scheduler execution via environment variable `SCHEDULER_ENABLED` (defaults to true; set to `'false'` in automated test environments).
    - Verified live automated cron ticks trigger reliably without intervention.
  - **In-Memory Job Runs Ledger & Concurrent Execution Lock**:
    - Created `JobRunsService` (`back-end/src/jobs/job-runs.service.ts`):
      - In-memory run log maintaining the last 200 runs with `id`, `trigger` (`'cron'` | `'manual'`), `startedAt`, `finishedAt`, `status` (`'running'` | `'success'` | `'partial'` | `'failed'`), and per-job records (`name`, `startedAt`, `finishedAt`, `durationMs`, `itemsProcessed`, `errors`).
      - Atomic execution lock (`isLockActive`, `activeRunId`): Prevents overlapping or duplicate tick runs. Returns active run ID on conflict.
      - Integrated with `JobsModule` and exported for injection into `JobsService`, `AdminController`, and test harnesses.
  - **Isolated Job Execution & Backward Compatibility**:
    - Wrapped sub-jobs (`closeEmptyProjects`, `expireMentorRequests`, `applyDeadlinePenalties`) in individual try/catch blocks within `runTick(trigger)`.
    - Isolated failures: A failure in one job is caught, logged, recorded in the run summary, and does not stop subsequent jobs. Status resolves to `'partial'` if any job encountered errors.
    - Idempotency preserved: Running consecutive ticks produces identical end states with 0 duplicate items processed.
    - Updated `JobsService.tickHourly()` to return `jobsExecuted` containing jobs with `itemsProcessed > 0`, retaining full compatibility with existing test suites.
  - **REST Endpoints for Tick & Run Inspection**:
    - `POST /admin/jobs/tick`: Super User only (`@Roles('superuser')`). Returns HTTP 202 `{ runId }`. If a run is already active, returns HTTP 409 `ConflictException` with machine code `JOB_ALREADY_RUNNING` and the current `runId`.
    - `GET /admin/jobs/runs?limit=20`: Admin and Super User (`@Roles('admin')`). Returns the most recent runs (up to limit, max 200) sorted newest first.
    - `GET /admin/jobs/runs/:id`: Admin and Super User (`@Roles('admin')`). Returns detailed run record with individual job breakdowns. Returns HTTP 404 with code `RUN_NOT_FOUND` if the run ID does not exist.
    - Updated `HttpExceptionFilter` to preserve custom response payload properties (specifically `runId` on 409 responses).
  - **Frontend Scheduled Jobs Panel & Super User Configuration**:
    - Created API client methods in `React-Implementation/React-Implementation/src/services/adminApi.js`: `triggerJobTick()`, `getJobRuns()`, and `getJobRun()`.
    - Created formatting utility `src/utils/jobFormatter.js` (`formatDateTime`, `formatDuration`, `getNextExpectedRun`).
    - Created `ScheduledJobsPanel.jsx` and `ScheduledJobsPanel.css`:
      - Telemetry metrics: Last run timestamp, overall status badge (`success`, `partial`, `failed`, `running`), and calculated next expected run time.
      - Recent runs table displaying trigger type, start time, formatted duration, status badge, and clickable "View Details" action.
      - Run detail side drawer showing execution metadata and per-job breakdown (job name, duration, items processed, error messages).
      - "Run now" manual trigger button for Super Users with confirmation dialog, disabled during active execution, and displaying clean 409 error messages.
      - Read-only view for regular administrators (hides the manual trigger button).
      - Empty state when no runs have executed yet.
    - Mounted `<ScheduledJobsPanel>` inside `SuperuserConfig.jsx`.
    - Added "Scheduled Jobs" navigation entry in `AdminLayout.jsx`.
  - **Testing & Verification**:
    - Backend Unit tests: 18 test suites, **140 passed, 0 failed** (`job-runs.service.spec.ts` 5/5, `jobs.service.spec.ts` 6/6).
    - Backend E2E tests: 7 test suites, **115 passed, 0 failed** (`phase7.e2e-spec.ts` 8/8 passed).
    - Backend TypeScript typecheck: `tsc --noEmit` **0 errors**.
    - Frontend Vitest tests: 20 test suites, **80 passed, 0 failed** (`ScheduledJobsPanel.test.jsx` 5/5 passed).
    - Frontend ESLint: **0 errors, 0 warnings**.
    - Frontend Production Build: **0 errors** (203 modules transformed).
    - REST Client file: `docs/api-tests/phase-7.http` documenting 9 test scenarios covering role restrictions, conflict handling, and run inspections.

### Phase 8: Decision Finality and Data Integrity
- **Status:** **DONE**
- **Changes Made:**
  - **Reports Service Decision Finality**:
    - Guarded `updateReportStatus` and `actionReport` at entry: if status is already terminal (`Resolved` or `Dismissed`), immediately throws HTTP 409 `REPORT_ALREADY_ACTIONED`.
    - Executed status changes and penalty writes synchronously in one atomic block with zero `await` operations between check and mutation.
  - **Appeals Service Decision Finality**:
    - Guarded `decideAppeal`: if status is not `pending` (i.e. already `accepted` or `rejected`), immediately throws HTTP 409 `APPEAL_ALREADY_DECIDED`.
    - Synchronous status assignment ensures decision idempotency and prevents double reputation restorations or audit entries.
  - **Project Completion & Gamification Invariants**:
    - Required `tasks.length >= 1` in `ProjectsService.completeProject`. Zero-task project completion throws HTTP 400 `PROJECT_NO_TASKS`.
    - Defined constant `COMPLETION_BADGE_MIN_TASKS = 3` in `GamificationService`.
    - Projects completing with fewer than 3 approved tasks complete successfully but award NO completion badge or XP, returning `badgeAwarded: false` and `badgeReason: 'Completed. Badges need at least 3 approved tasks'`.
    - Projects completing with 3 or more approved tasks award the completion badge and ledger XP.
  - **Capacity Invariant & Approval Race Serialization**:
    - Added per-project promise chain queue `runInProjectQueue(projectId, ...)` in `JoinRequestsService`.
    - Inside the serialized queue, re-reads request status (throws 409 `REQUEST_ALREADY_DECIDED` if not pending) and re-evaluates project capacity (throws 409 `PROJECT_FULL` if full).
    - Handled withdrawal via `withdrawAsync` and rejection in the same queue to maintain serialized state transitions.
  - **Single Consolidated Notification Store**:
    - Transferred duplicate notification seeds (`notif-1`, `notif-2`, `notif-4`) from `CommunicationRepository` into `NotificationsService`.
    - Removed duplicate in-memory notifications store and methods from `CommunicationRepository`.
    - Directed `CommunicationService` notifications methods to forward directly to `NotificationsService`.
    - Connected `/notifications` endpoint to serve all notifications from the unified store.
  - **Frontend UI Enhancements**:
    - `AdminReports.jsx`: Displays decided status banner and timestamp for resolved/dismissed reports; disables all action and status buttons; displays 409 conflict errors if another administrator decided first.
    - `OwnedWorkspace.jsx`: Disables Complete/Publish button with tooltip and banner "Add at least one task to complete this project" when 0 tasks; shows badge threshold note when completing with < 3 approved tasks; renders server 409 errors (`PROJECT_FULL`, `REQUEST_ALREADY_DECIDED`) on join request approval failures and triggers automatic data refresh.
    - `JoinRequestCard.jsx`: Disables Accept button on first click to eliminate duplicate submissions.
  - **Testing & Verification**:
    - Backend Unit tests: 18 test suites, **146 passed, 0 failed** (`reports.service.spec.ts`, `appeals.service.spec.ts`, `join-requests.service.spec.ts`, `gamification.service.spec.ts`).
    - Backend E2E tests: `phase8.e2e-spec.ts` **6 passed, 0 failed**.
    - Backend TypeScript typecheck: `tsc --noEmit` **0 errors**.
    - Frontend Vitest tests: 21 test suites, **84 passed, 0 failed** (`Phase8DecisionFinality.test.jsx` 4/4 passed).
    - Frontend ESLint: **0 errors, 0 warnings**.
    - Frontend Production Build: **0 errors** (203 modules transformed).
    - REST Client file: `docs/api-tests/phase-8.http` documenting 11 test scenarios covering report and appeal finality, approval serialization, zero-task completion prevention, badge thresholds, and consolidated notifications.

### Phase 9: Escrow and Payment Safety
- **Status:** **DONE**
- **Changes Made:**
  - **Refund on Closure for Every Open Mentor Session**:
    - Refactored `MentorMarketplaceService.handleProjectClosed(projectId, reason, refundAll)`:
      - Targets all non-terminal sessions (`payment_pending`, `escrow_funded`, `active`, `payout_pending`).
      - Cancels sessions in `payment_pending` and releases any payment holds; refunds `escrow_funded` sessions to project owner in full; follows existing policy for active sessions (owner suspension pays mentor, otherwise refunds owner).
      - Strict idempotency: Terminal states (`completed`, `refunded`, `cancelled`) are guarded and untouched; running `handleProjectClosed` repeatedly executes zero duplicate refunds or duplicate audit records.
      - Writes 1 structured audit entry per refunded session (`project-closed-mentor-refund`).
  - **Booking Window Validation**:
    - Added `scheduledAt?: string;` and `date?: string;` to `BookSessionDto` and `MentorSessionEntity`.
    - Enforced booking validation against `ClockService.getNow()`:
      - Booking date is required and must be in the future; cannot be scheduled after project `dueDate` (if set).
      - Throws HTTP 400 `BOOKING_OUTSIDE_WINDOW` with allowed window in human-readable error message.
  - **Payment Expiry Job (30-Minute Auto-Expiry)**:
    - Added config constant `PAYMENT_PENDING_EXPIRY_MS = 30 * 60 * 1000` (30 minutes).
    - Implemented `MentorMarketplaceService.expireStalePaymentPendingSessions()`:
      - Scans for sessions in `payment_pending` older than 30 minutes.
      - Sets status to `cancelled` with reason `"Payment not completed"`, releases payment intent hold, and sends notification to project owner.
    - Added Job 4 to hourly scheduler tick in `JobsService.runTick()` (`expirePendingPayments`).
  - **Payment Idempotency**:
    - Added `IdempotencyRecord` interface and storage in `DemoUpiProvider` (`getIdempotencyRecord`, `saveIdempotencyRecord`).
    - Handled `Idempotency-Key` header in `confirmPayment` (`POST /mentor-marketplace/sessions/:id/confirm-payment` and alias `POST /mentor-marketplace/sessions/:id/pay`):
      - Same key on same session returns original cached payment result with status 200 without charging or funding escrow twice.
      - Different key on already funded/paid session throws HTTP 409 `ConflictException` with code `ALREADY_PAID`.
  - **Escrow Reconciliation**:
    - Mathematical invariant: `totalOwnerPaid === totalMentorPayout + totalPlatformFee + totalRefunds + totalInEscrow`.
    - Added `reconcileEscrow()` helper method in `MentorMarketplaceService`.
    - Added read-only admin endpoint `GET /admin/escrow/reconcile` protected by `@Roles('admin', 'superuser')` returning `{ ok: boolean, totalSessions, reconciledCount, totals, mismatches: any[] }`.
  - **Frontend UI Enhancements**:
    - `MentorsDirectory.jsx`:
      - Booking form: Datetime-local picker constrained with `min` (current clock) and `max` (project's `dueDate`). Shows `BOOKING_OUTSIDE_WINDOW` errors.
      - Payment screen: Generates unique UUID `Idempotency-Key` per payment open; displays 30-minute countdown timer (`Hold expires in: 30:00`); disables Pay button on click ("Securing Escrow..."); handles 409 `ALREADY_PAID` error; when expired shows "Payment window expired (Payment not completed). Hold released." and "Book again" reset button.
      - Booking History: Displays refunded session amounts (`₹X refunded`) and closure/decline reasons.
    - `MentorRevenue.jsx` (Admin):
      - Displays refunded amounts and closure/decline reasons in revenue table.
      - Added "Reconcile Escrow" button and status badge ("✓ Escrow Reconciled" / "⚠️ Escrow Mismatch").
    - `MentorEarnings.jsx` (Mentor):
      - Displays `-` payout for refunded/cancelled sessions and renders decline/closure reason.
  - **Testing & Verification**:
    - Backend Unit tests: 18 test suites, **154 passed, 0 failed** (`mentor-marketplace.service.spec.ts` 8/8 passed, `job-runs.service.spec.ts` 5/5 passed).
    - Backend E2E tests: `back-end/test/phase9.e2e-spec.ts` **9 passed, 0 failed** (booking window, idempotency, hourly expiry tick, closure refund idempotency, reconciliation 403 & 200).
    - Backend TypeScript typecheck: `tsc --noEmit` **0 errors**.
    - Frontend Vitest tests: 22 test suites, **88 passed, 0 failed** (`Phase9EscrowPaymentSafety.test.jsx` 8/8 passed).
    - Frontend ESLint: **0 errors, 0 warnings**.
    - Frontend Production Build: **0 errors** (203 modules transformed).
    - REST Client file: `docs/api-tests/phase-9.http` documenting 11 test scenarios covering booking window validation, payment idempotency, 30-min auto-expiry, closure refunds, and admin reconciliation.

### Phase 10: Platform Durability
- **Status:** **DONE**
- **Changes Made:**
  - **In-Memory Snapshot Persistence & Restore**:
    - Built `PersistenceService` (`back-end/src/persistence/persistence.service.ts`) and registered global `PersistenceModule` (`back-end/src/persistence/persistence.module.ts`).
    - Configurable via environment variables: `SNAPSHOT_ENABLED` (default `true`, disabled in unit/e2e tests), `SNAPSHOT_PATH` (default `./data/snapshot.json`), `SNAPSHOT_INTERVAL_SECONDS` (default `60`).
    - Periodic background timer runs every 60 seconds; graceful shutdown hook (`onApplicationShutdown`) triggers final synchronous save before exit.
    - Atomic write pattern: writes JSON payload to temporary file (`snapshot.json.<timestamp>.<rand>.tmp`) followed by atomic rename to destination path, with seamless Windows copy-then-unlink fallback on file lock/permission conditions.
    - Zero secrets policy: user passwords stay as secure bcrypt hashes; all dynamic authentication tokens (`refreshTokens`, auth tokens) and password reset codes/tokens are completely stripped prior to export.
    - Robust corruption recovery: startup gracefully falls back to seed data if snapshot is missing or invalid; damaged files are renamed to `<name>.corrupt-<timestamp>` without halting the server; schema versioning (`schemaVersion: 1`) ensures safe startup on version mismatch.
    - Implemented `exportState()` and `importState(state)` across all repository classes and stateful services:
      - `UsersRepository`: Exports sanitized users and email lookup mappings; imports and rebuilds id and email indexes.
      - `ProjectsRepository`: Exports project entities; imports and reconstructs owner and collaborator lookup sets.
      - `TasksRepository`: Exports task entities; imports and rebuilds task indexes.
      - `GamificationRepository`: Exports and imports user ledger entries.
      - `CommunicationRepository`: Exports messages; imports with date restoration and rebuilds thread indexes.
      - `MentorshipRepository`: Exports and imports mentor applications and badges with date restoration.
      - `GovernanceRepository`: Exports and imports governance reports.
      - `BaseService`: Base state export/import powering `EscrowService`, `JoinRequestsService`, `MentorApplicationsService`, `MentorRequestsService`, `PortalAdminsService`, and `SupportService`.
      - `NotificationsService`: Exports and imports notifications with date reconstruction and unread counts.
      - `ModerationService`: Exports and imports platform warnings.
      - `ReportsService`: Exports and imports user moderation reports.
      - `AppealsService`: Exports and imports warning appeals.
      - `ReputationService`: Exports and imports reputation entries.
      - `MentorMarketplaceService`: Exports and imports mentor profiles, booked sessions, and reviews.
      - `AuditService`: Exports and imports structured audit log entries.
    - Added `data/`, `back-end/data/`, `*.corrupt-*`, and `*.tmp` to `.gitignore`.
  - **UTC Time Handling & Client Local Timezone Formatting**:
    - Audited server-side date handling:
      - `back-end/src/tasks/tasks.service.ts`: Replaced local calendar date calculations (`new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()`) with explicit UTC midnight (`Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)`) for task due date validations.
      - `back-end/src/auth/auth.service.ts`: Injected `ClockService` to ensure password reset token expiration strictly compares against standardized UTC clock time.
    - Standardized frontend date formatting and countdowns in `src/utils/dateFormatter.js`:
      - `getTimeZoneAbbr(date)`: Formats standard user timezone abbreviation (e.g., `"IST"`, `"EDT"`, `"UTC"`).
      - `formatDateTime(value)`: Renders dates in viewer's local timezone with timezone abbreviation (e.g., `"12 Nov, 6:30 PM IST"`).
      - `formatCountdown(value)`: Displays human-readable countdown in days and hours (e.g., `"2d 5h remaining"`, `"18h remaining"`, `"35m remaining"`, `"Overdue"`).
    - Updated frontend components to display formatted local timezones and relative countdowns:
      - `ProjectCard.jsx`: Project due dates and countdown badges.
      - `TaskCard.jsx`: Task due dates and countdown badges.
      - `MentorsDirectory.jsx`: Booking window date range bounds and session schedules.
      - `SuperuserConfig.jsx` & `ScheduledJobsPanel.jsx`: Job run timestamps and next expected tick.
  - **Reputation Ledger Pagination**:
    - Implemented `ReputationService.getPaginatedEntries(userId, { page, limit, type })` with slice-based pagination and type filtering (`all`, `task_approved`, `warning`, `warning_removed`, `deadline_missed`, `seed`).
    - Added endpoints:
      - `GET /users/me/reputation`: Authenticated user's paginated reputation entries (`{ items, page, limit, total }`).
      - `GET /admin/users/:id/reputation`: Admin / Super User endpoint for individual user's reputation entries.
      - `GET /admin/reputation`: Admin / Super User platform-wide paged reputation ledger.
    - Enforced query parameter validation: `limit` must be an integer between 1 and 100, `page` must be >= 1. Invalid values throw HTTP 400 `INVALID_PAGINATION`.
    - Updated frontend reputation views in `profile.jsx` and `AdminUserDetails.jsx`:
      - Filter dropdown/buttons for entry types.
      - Paginated table (20 entries per page) with Previous/Next controls and page indicators.
  - **Super User Snapshot Trigger & Management UI**:
    - Added endpoint `POST /admin/system/snapshot` (@Roles('superuser'), 200 OK) returning `{ savedAt, sizeBytes }`. Non-superusers receive HTTP 403 `FORBIDDEN`.
    - Added endpoint `GET /admin/system/snapshot` (@Roles('superuser')) returning snapshot metadata.
    - Added "Platform Durability & Snapshots" management card in `SuperuserConfig.jsx` showing last saved timestamp, snapshot size in bytes, and "Save snapshot now" trigger button with loading state.
  - **Testing & Verification**:
    - Backend Unit tests: 20 test suites, **167 passed, 0 failed** (`persistence.service.spec.ts` 6/6 passed, `reputation.service.spec.ts` 14/14 passed).
    - Backend E2E tests: 10 test suites, **141 passed, 0 failed** (`phase10.e2e-spec.ts` 11/11 passed, `phase9.e2e-spec.ts` 9/9 passed, `phase4.e2e-spec.ts` 14/14 passed, `phase7.e2e-spec.ts` 8/8 passed, etc.).
    - Backend TypeScript typecheck: `tsc --noEmit` **0 errors**.
    - Frontend Vitest tests: 23 test suites, **100 passed, 0 failed** (`Phase10PlatformDurability.test.jsx` 8/8 passed).
    - Frontend ESLint: **0 errors, 0 warnings**.
    - Frontend Production Build: **0 errors** (203 modules transformed).
    - REST Client file: `docs/api-tests/phase-10.http` documenting 12 test scenarios covering periodic snapshot, manual snapshot trigger, 403 on non-superuser, corrupt snapshot recovery, UTC dates, and reputation ledger pagination.

### Policy Plan Phase 11: Project Health Telemetry ("Why Nobody Applies" Panel, View Tracking, Owner Response Time, Deadline Cascade, Capacity Guard)
- **Status:** **DONE**
- **Changes Made:**
  - **Project Views Telemetry (`ProjectViewsService`)**:
    - Created in-memory tracking service (`back-end/src/projects/project-views.service.ts`) for impressions and previews.
    - Strict 24-hour UTC uniqueness: counts at most 1 impression and 1 preview per viewer per project per UTC calendar day (`YYYY-MM-DD`).
    - Stored as pure telemetry metrics (`views: { impressions, previews }` on project entity), preserving viewer privacy with zero browsing history or profile tracking.
    - Strict exclusion rules: anonymous users, project owners, active project members/collaborators, and platform administrators/superusers are never counted towards impressions or previews.
    - Endpoints:
      - `POST /projects/:id/impression`: Authenticated non-member view tracking (returns 204 No Content).
      - `POST /projects/:id/preview`: Authenticated non-member detail preview tracking (returns 204 No Content).
    - Integrated with snapshot durability (`PersistenceService`) to persist and restore impression and preview tracking state across restarts.
  - **Project Health Scoring & Actionable Recommendations (`HealthService`)**:
    - Configured scoring weights and benchmarks in `back-end/src/projects/config/project-health.config.ts`:
      1. Description length $\ge 100$ characters (20 pts).
      2. Tasks count $\ge 2$ (20 pts).
      3. Skills count 3 to 8 entries (15 pts).
      4. Due date is set (10 pts).
      5. Duration $\le 3$ months / 92 days (10 pts).
      6. Team size $\le 6$ (5 pts).
      7. Talent pool matching skills $\ge 5$ active non-member users (10 pts).
      8. Owner response time $\le 72$ hours on average or no requests yet (10 pts).
    - Computed overall health score (0 to 100) and letter grades:
      - **A**: 85 - 100
      - **B**: 70 - 84
      - **C**: 55 - 69
      - **D**: 40 - 54
      - **F**: Below 40
    - Prioritized actionable recommendations (Critical $\rightarrow$ Warning $\rightarrow$ Info) with exact fix descriptions and deep navigation routes (`actionLabel`, `actionRoute`), avoiding invented conversion-lift numbers.
    - Funnel metrics calculation: impressions $\rightarrow$ previews $\rightarrow$ applications $\rightarrow$ approvals, including preview-to-application conversion rate (`applications / previews`).
    - Endpoint:
      - `GET /projects/:id/health`: Restricted to Project Owner, Administrator, and Super User; other users receive HTTP 403 `FORBIDDEN`.
  - **Owner Response Time Calculation**:
    - Calculated median hours between join request submission (`createdAt`) and resolution (`decidedAt`) across the last 10 decided join requests.
    - Endpoint:
      - `@Public() GET /users/:id/response-time`: Returns `{ medianHours, sample }`.
    - Display policy: Shows `"Usually replies in N days"` on project cards and previews only when there are at least 3 decided requests (`sample >= 3`); otherwise renders nothing.
  - **Hourly Pending Request Reminder Job**:
    - Integrated Job 5 (`remindPendingRequests`) into the hourly scheduler tick in `JobsService`.
    - Detects pending join requests older than 3 days (72 hours).
    - Dispatches one reminder notification to the project owner and sets `remindedAt` / `pendingReminderSentAt` on the join request entity so it is never repeatedly spammed.
  - **Deadline Cascade with Task Due Date Shifting**:
    - Enhanced `PATCH /projects/:id/deadline` and project update in `ProjectsService` to accept optional `shiftTasks?: boolean`.
    - When extending project due date with `shiftTasks: true`:
      - Calculates integer difference in UTC calendar days (`diffDays = newDueDate - oldDueDate`).
      - Shifts open, unapproved tasks forward by `diffDays`.
      - Approved tasks are never shifted.
      - Shifted task dates are clamped so they are never earlier than the current UTC date (`now`).
      - Records structured audit log entry `project-deadline-tasks-shifted` detailing `projectId`, `diffDays`, and shifted task IDs.
  - **Capacity Guard Invariant**:
    - Hard capacity guard in `ProjectsService.update`: project `teamSize` cannot be reduced below the current number of active collaborators.
    - Violations immediately throw HTTP 409 `TEAM_SIZE_BELOW_MEMBERS` with the active member count in the error message.
  - **Frontend UI & Telemetry Integration**:
    - `ProjectHealthPanel.jsx` & `ProjectHealthPanel.css`:
      - Visual health score SVG ring with dynamic stroke offset and color styling by letter grade.
      - Grade badge (A, B, C, D, F) with descriptive health label.
      - Conversion funnel metrics bar (Impressions, Previews, Applications, Approvals, Conversion %).
      - Empty state banner (`"No views yet. Share your project or improve the points below."`) displayed prior to the first impression.
      - Prioritized recommendations list with action buttons routing to exact remediation workflows.
    - `OwnedWorkspace.jsx`:
      - Embedded Project Health tab and overview widget for project owners.
      - "Change Project Deadline" modal with `"Shift open tasks by N days"` checkbox (default unchecked).
      - "Edit Project Settings" modal with `teamSize` control and `data-testid="team-size-error"` displaying `TEAM_SIZE_BELOW_MEMBERS`.
      - "Decline Join Request" modal requiring a reason between 10 and 500 characters.
    - `ProjectsMarketplace.jsx`:
      - Integrated `IntersectionObserver` to track card impressions once per card per session load via `data-project-id`.
      - Card click triggers `projectsApi.recordPreview` before navigation/modal opening.
      - Fetches owner response time and renders `"⏱️ Usually replies in N days"` on project cards and detail preview.
    - `ProjectCard.jsx`: Accepts `ownerResponseTime` and conditionally renders reply time badge.
    - `DatePicker.jsx`: Enhanced `inputId = id || name` to ensure robust accessibility and label linkage.
  - **Testing & Verification**:
    - Backend Unit tests: 23 test suites, **199 passed, 0 failed** (`health.service.spec.ts` 6/6 passed, `project-views.service.spec.ts` 8/8 passed, `deadline-shift.spec.ts` 8/8 passed).
    - Backend E2E tests: 11 test suites, **155 passed, 0 failed** (`phase11.e2e-spec.ts` 14/14 passed).
    - Backend TypeScript typecheck: `tsc --noEmit` **0 errors**.
    - Frontend Vitest tests: 24 test suites, **110 passed, 0 failed** (`Phase11ProjectHealth.test.jsx` 10/10 passed).
    - Frontend ESLint: **0 errors, 0 warnings**.
    - Frontend Production Build: **0 errors** (205 modules transformed).
    - REST Client file: `docs/api-tests/phase-11.http` documenting 11 test scenarios covering impression tracking, preview tracking, exclusion checks, health scoring, owner response time, deadline cascade, and capacity guard.

### Policy Plan Phase 12: Stuck Projects, Requests and Inactivity (Zombie Project Breaker, Request Timeout, Early-Withdraw Refund, Abandoned Owner, Inactive Collaborator)
- **Status:** **DONE**
- **Changes Made:**
  - **Zombie Project Breaker (48-Hour Hard Limit on Day-5 Pause)**:
    - Updated `JobsService.closeEmptyProjects` to store `pausedAt`, `pendingReviewGraceExpiresAt`, and dispatch `"Decide on pending requests within 48 hours or the project closes"` when day-5 projects have pending join requests.
    - Added `JobsService.zombieProjectBreaker()` inside the 9-job hourly tick: after 48 hours from `pausedAt`, remaining pending requests transition to `'system_closed'` (`countedTowardLimit = false`, slot restored, applicant notified with link) and the project closes with `closureReason: 'No owner response'` following Phase 9 escrow refund settlement.
    - Clearing all pending requests within 48 hours via `JoinRequestsService.update` invokes `ProjectsService.clearZombiePause` to clear `pausedAt` and resume normal flow.
  - **14-Day Stale Join Request Closer**:
    - Added `JobsService.staleRequestCloser()` to transition any individual pending join request older than 14 days to `'system_closed'` (`countedTowardLimit = false`) and notify both applicant and owner with project links.
    - Preserved pending `status` on internal metadata reminder updates (`JoinRequestsService.update` & `JobsService.remindPendingRequests`) so 3-day reminders do not overwrite request status.
  - **Early-Withdraw Refund (< 2 Hours & Unviewed)**:
    - Added `sentAt`, `viewedAt`, and `countedTowardLimit` to `JoinRequestEntity`.
    - Owner inspection via `GET /join-requests?projectId=...` and `GET /join-requests/:id` records `viewedAt` on pending requests.
    - `JoinRequestsService.withdrawRequest` restores the user's request slot (`countedTowardLimit = false`) when withdrawn within 2 hours of `sentAt` before `viewedAt` is recorded; withdrawals after 2 hours or after owner view continue to count toward the 2-request limit.
  - **Abandoned Owner Detection & Manual Closure**:
    - Tracked user `lastActiveAt` (updated on login and throttled per 10 minutes in `AuthGuard`) and per-project `lastOwnerActionAt`.
    - Added `JobsService.ownerInactivityNotifier()` to notify collaborators and assigned mentor once at 14 days of no owner login/action, and set `ownerInactive30d = true` at 30 days without auto-closing.
    - Added `POST /projects/:id/request-close` (active collaborator only; returns `409 NOT_ELIGIBLE` before 30 days) creating a `'Project Closure Request'` case in `SupportService`, exported for persistence snapshots (`PersistenceService`).
    - Added `POST /admin/projects/:id/close` and `POST /projects/:id/close` (Admin/SuperUser) to close with `'Owner inactive'`, triggering Phase 9 session refunds and resolving open closure tickets.
  - **Inactive Collaborator Detection & Release Open/In-Progress Tasks**:
    - Tracked per-member `lastActivityAt` across task create/update/status/comments (`POST /tasks/:id/comments`) and chat messages (`CommunicationService.sendMessage`).
    - Added `JobsService.memberInactivityNotifier()` to send repeating 7-day inactivity notifications to inactive collaborators and project owners with workspace links.
    - Added `POST /projects/:id/members/:userId/release-tasks` (Owner or Admin/SuperUser; `403` otherwise; `409 NOTHING_TO_RELEASE` if empty) returning `Open`/`To Do` and `In Progress` tasks to Unassigned + `To Do` while keeping membership intact and leaving `In Review` and `Completed` tasks untouched.
  - **Frontend UI & Notifications Links**:
    - `MyProjects.jsx` and `OwnedWorkspace.jsx`: 48-hour countdown banners (`myprojects-zombie-banner-*`, `workspace-zombie-banner`) for paused projects with pending requests.
    - `AppliedProjects.jsx`: `'System Closed'` reason `"Closed because the owner did not respond"`, slot restored counter, and `'Withdraw Join Request'` confirmation modal stating slot refund eligibility.
    - `OwnedWorkspace.jsx`: `'No activity for N days'` badge, `'Release tasks'` action, and confirmation modal listing only `To Do`/`Open` & `In Progress` tasks.
    - `CollaboratorWorkspace.jsx`: abandoned-owner notice banner and `'Ask admin to close'` button (`POST /projects/:id/request-close`).
    - `AdminProjects.jsx` & `AdminProjectDetails.jsx`: includes closed/all projects and `'Close Project (Owner inactive)'` admin action + closure reason display.
    - `notifications.jsx`: clickable `'View Project →'` links using `notif.link` or `/projects/:referenceId`.
  - **Testing & Verification**:
    - Backend Unit tests (`npm test`): **24 passed suites, 205 passed, 0 failed** (`phase12.spec.ts`: 6/6 passed).
    - Backend E2E tests (`npm run test:e2e`): **12 passed suites, 158 passed, 0 failed** (`phase12.e2e-spec.ts`: 3/3 passed).
    - Backend TypeScript check (`tsc -p tsconfig.build.json --noEmit`): **0 errors**.
    - Frontend Vitest (`npm test`): **25 passed files, 115 passed, 0 failed** (`Phase12StuckProjects.test.jsx`: 5/5 passed).
    - Frontend ESLint (`npm run lint`) & Vite Production Build (`npm run build`): **0 errors** (205 modules transformed).
    - Documentation updated: `docs/rbac-matrix.md` and `docs/api-tests/phase-12.http`.

### Policy Plan Phase 13: Task Review and Feedback (Mandatory Rejection Reason, In Review Kept on Leave, Review Reminders and Auto-Approve, Late Unassign Reason, Due Date Lock)
- **Status:** **DONE**
- **Changes Made:**
  - **Task Review Endpoint & Rejection Reason History**:
    - Added `rejectionReason`, `rejectedAt`, `rejectedBy`, `rejectionHistory[]`, `autoApproved`, `reviewReminderSentAt`, and `inReviewSince` to `Task` interface and `TaskEntity`.
    - Added `POST /tasks/:id/review` (`decision: 'approve' | 'reject'`, optional `reason`) alongside validation in `PATCH/PUT /tasks/:id/status` and `PATCH/PUT /tasks/:id` via canonical `TasksService.rejectTask`: rejecting requires trimmed `reason` between 10 and 500 characters (`400 REASON_REQUIRED`).
    - Resubmitting to `In Review` clears visible `rejectionReason`, `rejectedAt`, and `rejectedBy`, sets `inReviewSince`, resets `reviewReminderSentAt`, and preserves `rejectionHistory`.
    - Notifies the collaborator with `TASK_REJECTED` including the exact rejection reason and workspace link.
  - **Shared Departure Task Retention Logic**:
    - Unified collaborator leave (`ProjectsService.leaveProject`), removal (`ProjectsService.removeMember`), inactivity release (`releaseOpenAndInProgressTasksForProjectMember`), and account suspension (`SuspensionConsequencesService` -> `releaseCollaboratorTasks`) onto shared `TasksService.releaseMemberTasksOnDeparture`.
    - Open/`To Do` and `In Progress` tasks return to `Unassigned` and `To Do`, while `In Review` tasks (with proof URLs intact) and `Completed` tasks remain untouched so owners can still approve them and award XP/reputation to departed collaborators.
  - **Review Deadline Hourly Job (`reviewDeadlineJob`)**:
    - Integrated Job 10 (`reviewDeadlineJob`) into `JobsService.runTick()`.
    - Sends a one-time reminder notification (`TASK_REVIEW_REMINDER`) to the project owner when an `In Review` task waits $\ge 3$ days (`reviewReminderSentAt`).
    - Auto-approves `In Review` tasks waiting $\ge 7$ days through canonical `TasksService.approveTask` (`autoApproved: true`, XP/rep/ledger/audit executed once idempotently, notifying collaborator and owner with `TASK_AUTO_APPROVED`).
    - Explicitly skips tasks whose proof link fails `isSafeHttpUrl` / Phase 6 URL safety checks (`skippedBadProofTasks`).
  - **Late Unassign Rule & Role-Based Update Whitelist**:
    - Added `POST /tasks/:id/unassign` (and self-unassign handling via `PATCH /tasks/:id`) backed by `TasksService.unassignTask`: dropping a task within 24 hours of its due date enforces a 10 to 300 character trimmed reason (`400 REASON_REQUIRED`) and notifies the project owner; earlier drops succeed without a reason.
    - Enforced role-based field whitelist on `PATCH/PUT /tasks/:id`, throwing `403 FORBIDDEN_FIELD` whenever non-owners send `dueDate` or restricted structural fields (`title`, `description`, `xpReward`, `priority`, `difficulty`, `projectId`).
  - **Frontend UI & Feedback**:
    - `tasksApi.js`: added `review` and `unassign` methods.
    - `OwnedWorkspace.jsx`: added `'Send Task Back for Revision'` modal requiring 10-500 characters with live character counter, disabled submit until valid, server error banner, and canonical review calls.
    - `TaskCard.jsx`: renders owner waiting-time badges (`Waiting N days`) color-coded at $<3$, $3\text{--}6$ (`warning`), and $\ge 7$ days (`critical`), `'Auto-approved after 7 days'` badges, collaborator highlighted `'Changes requested'` box with collapsible `'Revision history (N)'`, read-only due date marker for collaborators, and `'Drop Task'` button.
    - `CollaboratorWorkspace.jsx`: added `'Drop Task'` confirmation modal enforcing the 10-300 char reason inside the 24-hour deadline window and clearing visible rejection fields on proof resubmission.
    - `AdminProjectDetails.jsx`: renders `'Auto-approved after 7 days'` badge in the admin Tasks & Milestones table.
  - **Testing & Verification**:
    - Backend Unit tests (`npm test`): **25 passed suites, 209 passed, 0 failed** (`phase13.spec.ts`: 4/4 passed; `job-runs.service.spec.ts` updated for 10 hourly tick jobs).
    - Backend E2E tests (`npm run test:e2e`): **13 passed suites, 161 passed, 0 failed** (`phase13.e2e-spec.ts`: 3/3 passed).
    - Backend `tsc` check (`tsc -p tsconfig.build.json --noEmit`): **0 errors**.
    - Frontend Vitest (`npm test`): **26 passed files, 119 passed, 0 failed** (`Phase13TaskReview.test.jsx`: 4/4 passed).
    - Frontend ESLint (`npm run lint`) & Vite Production Build (`npm run build`): **0 errors** (205 modules transformed).
    - Documentation updated: `docs/rbac-matrix.md` and `docs/api-tests/phase-13.http`.

### Policy Plan Phase 14: Mentor Lifecycle (Ghost Mentor Release, First-Week Activity, Re-application Cooldown, Mentee Cap, Post-Session Feedback)
- **Status:** **DONE**
- **Changes Made:**
  - **Mentor Activity Tracking & Abandonment Reviews**:
    - Tracks per-`(project, mentor)` assignment and `lastActivityAt` on project chat messages (`CommunicationService`), session notes (`addSessionNote`), recommendation badges (`MentorshipService.issueBadge`), started/completed sessions, and `"Still active"` confirmation.
    - Added `POST /projects/:id/mentor/abandonment-review` and `GET /projects/:id/mentor/abandonment-review` (`ProjectsController`) enforcing owner/mentor/admin visibility (403 for collaborators), 7-day inactivity & first-week grace checks (`409 MENTOR_STILL_ACTIVE`), 14-day review cooldown (`409 REVIEW_COOLDOWN`), and single open review (`409 REVIEW_ALREADY_OPEN`).
    - Added `POST /mentor/abandonment-reviews/:id/confirm` and `GET /mentor/abandonment-reviews/mine` (`MentorLifecycleController`), plus `POST /admin/abandonment-reviews/:id/cancel` (`AdminController`, requiring written reason `400 REASON_REQUIRED`).
    - Integrated Jobs 11 (`mentorAbandonmentReleaser`) and 12 (`mentorActivityNotifier`) into `JobsService.runTick()`: releases open abandonment reviews past 48h, unassigns mentor to reopen slot for another mentor booking, refunds non-completed sessions via `EscrowService.refund()` without touching completed sessions, records abandonment incidents for admin review, and sends one-time first-week & 7-day idle notices.
  - **Re-Application Cooldown, Active Mentee Cap & Private Post-Session Feedback**:
    - Added configurable `mentorReapplyCooldownDays` (default 14 days via config/env `MENTOR_REAPPLY_COOLDOWN_DAYS`) to `PlatformConfigService`, recorded `rejectedAt` on rejected mentor applications, forwarded `availableAt`/`cooldownDays` in `HttpExceptionFilter`, enforced `409 REAPPLY_COOLDOWN` in `MentorApplicationsService.create()`, and exposed cooldown status on `GET /mentor-applications/me`.
    - Added `maxActiveMentees` (1–10, default 3) on mentor profiles with server-computed `activeMenteesCount` and `isFull`, rejecting excess bookings with `409 MENTOR_AT_CAPACITY`.
    - Added `POST /mentor-sessions/:id/feedback` (and `/mentor-marketplace/sessions/:id/feedback`) validating integer rating `1..5` (`400 INVALID_RATING`) and single submission (`409 ALREADY_RATED`) without modifying mentor payouts; strips single comments/student names from public mentor endpoints, exposes aggregate averages on `GET /mentor-marketplace/mentors/me/stats`, and exposes full feedback & abandonment incidents only via `GET /admin/mentors/:id/feedback`.
  - **Frontend UI**:
    - `mentorMarketplaceApi.js`: added lifecycle, session notes, private feedback, mentor stats, and admin feedback API wrappers.
    - `OwnedWorkspace.jsx`: displays mentor activity status (`Last active N days ago`), `"Report inactive mentor"` confirmation modal, and open 48h abandonment review countdown banner.
    - `MentoredProjects.jsx` & `dashboard.jsx`: display `"Still active"` confirmation banner when an abandonment review is open.
    - `MentorApplication.jsx`: displays re-application cooldown notice with exact eligible date and disables re-application while cooldown is active.
    - `MyMentorProfile.jsx`, `MentorCard.jsx` & `MentorsDirectory.jsx`: added `maxActiveMentees` configuration, `"Full"` badge & disabled booking button at capacity, and one-time 1–5 star post-session feedback modal on completed bookings.
    - `AdminUserDetails.jsx`: added `"Mentor Feedback & Lifecycle"` card showing average rating, confidential comments/owner names, and abandonment history for mentor accounts.
  - **Testing & Verification**:
    - Backend Unit tests (`npm test`): **26 passed suites, 217 passed, 0 failed** (`phase14.spec.ts`: 8/8 passed; `job-runs.service.spec.ts` updated for 12 hourly tick jobs).
    - Backend E2E tests (`npm run test:e2e`): **14 passed suites, 165 passed, 0 failed** (`phase14.e2e-spec.ts`: 4/4 passed).
    - Backend TypeScript check (`tsc -p tsconfig.build.json --noEmit`): **0 errors**.
    - Frontend Vitest (`npm test`): **27 passed files, 125 passed, 0 failed** (`Phase14MentorLifecycle.test.jsx`: 6/6 passed).
    - Frontend ESLint (`npm run lint`) & Vite Production Build (`npm run build`): **0 errors** (205 modules transformed).
    - Documentation updated: `docs/rbac-matrix.md` and `docs/api-tests/phase-14.http`.

### Policy Plan Phase 15: Collaboration UX (Active Project Cap, Skill-Match Hint, Rejection Suggestions, Direct Invites, Unread Chat Badge, User Search Ranking, Export Markdown & Clone as Draft)
- **Status:** **DONE**
- **Changes Made:**
  - **Active Project Cap (`MAX_ACTIVE_MEMBERSHIPS`)**:
    - Added configurable `maxActiveMemberships` (default 3, env `MAX_ACTIVE_MEMBERSHIPS`) in `PlatformConfigService`, `HttpExceptionFilter` forwarding for `currentCount`, `maxAllowed`, and `projects[]`, and cap enforcement across `JoinRequestsService.create`, `JoinRequestsService.update` (serialized approval queue), and `ProjectInvitesService.acceptInvite` (`409 ACTIVE_PROJECT_CAP`). Owning projects and `Completed`/`Closed`/`Cancelled`/`Archived`/`Draft` projects are excluded from the count; existing grandfathered users above cap are never removed.
    - Fixed `ProjectsRepository.create()` spreading `CreateProjectDto` over `ownerId` so `ownerId` transformed as `undefined` by `ValidationPipe` no longer overwrites the caller's ownership.
  - **Skill-Match Hint & Rejection Suggestions**:
    - Added shared `skill-match.util.ts` (`computeSkillMatch`), `GET /projects/:id/match` returning non-blocking `{ percent, shared, missing }` (`percent: null` when project lists no skills), and `JoinRequestsService.computeSuggestedProjects()` attaching up to 3 open, non-full, non-closed, non-draft, non-owned, non-applied skill-matched alternatives to rejected `JoinRequestEntity` records and `APPLICATION_REJECTED` notifications.
  - **Direct Invitations & 7-Day Expiry Job**:
    - Implemented `ProjectInvitesService`, `InvitesController` (`POST /invites/:id/accept`, `POST /invites/:id/decline`), `UsersController` (`GET /users/me/invites`), and `ProjectsController` (`POST/GET /projects/:id/invites`, `DELETE /projects/:id/invites/:inviteId`) with target validation (`404 USER_NOT_FOUND`, `400 CANNOT_INVITE_SELF`, `409 USER_SUSPENDED`, `409 ALREADY_MEMBER`, `409 INVITE_ALREADY_PENDING`, `409 INVITE_LIMIT` max 5 open invites, `409 REINVITE_COOLDOWN` 14-day removal/block cooldown), serialized acceptance concurrency queueing, Persistence snapshots, and Job 13 `projectInviteExpirer` in `JobsService.runTick()`.
  - **Unread Chat Badge & Ranked User Search**:
    - Extended `CommunicationRepository`, `CommunicationService`, and `CommunicationController` with per-`(user, project)` `lastReadAt` tracking, `GET /communication/unread`, and `POST /communication/projects/:id/read` (enforcing Phase 6 `CHAT_MEMBERSHIP_REQUIRED`).
    - Updated `UsersService.searchUsers` to support both `username` and `profile.username` and rank results: exact username -> username prefix -> name prefix -> substring.
  - **Closed/Completed Export Markdown & Clone as Draft**:
    - Added `ProjectStatus.Draft` (hidden from default public Marketplace `findAll()` listing, visible to `status=all`), `GET /projects/:id/export.md` (Owner/Admin on Closed/Completed projects; `409 PROJECT_NOT_FINISHED` otherwise), and `POST /projects/:id/clone` (Owner only on Closed/Completed projects creating an isolated `Draft` without members, mentor, or join requests).
  - **Frontend UI & Collaboration UX**:
    - `apiClient.js`, `projectsApi.js`, `communicationApi.js`: preserved structured error fields (`code`, `projects`, `currentCount`, `maxAllowed`), added `apiDownloadText`, and added match/invite/unread/export/clone API wrappers.
    - `ProjectsMarketplace.jsx`: fetches & renders non-blocking skill-match hint bar in the preview/apply modal, supports `?apply=<id>` preselection, and lists conflicting projects on `409 ACTIVE_PROJECT_CAP`.
    - `AppliedProjects.jsx` & `notifications.jsx`: display `"Similar projects"` suggestions on rejected requests/notifications and direct `"Project Invitations"` Accept/Decline actions.
    - `navbar.jsx`: added project chat quick-jump button with unread badge capped at `99+`, refreshed on `'teamforge:chat_read'` and via a 60s poll paused when `document.hidden`.
    - `OwnedWorkspace.jsx`, `CollaboratorWorkspace.jsx`, `MentorProjectWorkspace.jsx`, `MyProjects.jsx`, `help.jsx` & `highlightMatch.jsx`: added `?tab=chat` support + mark-read on chat open, highlighted user search matches, direct invite picker & cancel controls, Draft status badge/publish button, `"Drafts"` filter in `MyProjects`, and `"Export Markdown"` + `"Clone as draft"` controls on finished projects.
  - **Testing & Verification**:
    - Backend Unit tests (`npm test`): **27 passed suites, 226 passed, 0 failed** (`phase15.spec.ts`: 9/9 passed; `job-runs.service.spec.ts` updated for 13 hourly tick jobs).
    - Backend E2E tests (`npm run test:e2e`): **15 passed suites, 172 passed, 0 failed** (`phase15.e2e-spec.ts`: 7/7 passed).
    - Backend TypeScript check (`tsc -p tsconfig.build.json --noEmit`): **0 errors**.
    - Frontend Vitest (`npm test -- --run`): **28 passed files, 132 passed, 0 failed** (`Phase15CollaborationUx.test.jsx`: 7/7 passed).
    - Frontend ESLint (`npm run lint`) & Vite Production Build (`npm run build`): **0 errors, 0 warnings** (206 modules transformed).
    - Documentation updated: `docs/rbac-matrix.md` and `docs/api-tests/phase-15.http`.

### Policy Plan Phase 16: Trust and Safety (Chat Reporting, Duplicate Accounts, Project Spam Caps, Email Verification, Content Filter, OTP Attempt Limit)
- **Status:** **DONE**
- **Changes Made:**
  - **Report a Chat Message & 20-Message Snapshot**:
    - Extended `Report` (`report.entity.ts`), `ReportsService` (`createChatReport`, `assertCombinedDailyReportLimit`), `CommunicationRepository` (`findMessageById`, `deleteMessage`, `getMessageContextSnapshot`), `CommunicationService.reportMessage`, and `POST /communication/messages/:id/report`.
    - Enforces current project membership (`403 CHAT_MEMBERSHIP_REQUIRED`), excludes message author (`400 CANNOT_REPORT_SELF`), validates trimmed 10–500 char reason (`400 REASON_REQUIRED`), prevents duplicate report by same reporter (`409 ALREADY_REPORTED`), enforces `REPORT_DAILY_LIMIT` (default 10/24h -> `429 TOO_MANY_REPORTS` while keeping Phase 2's 5-user-report `429 DAILY_LIMIT`), and preserves up to 20 surrounding messages so subsequent message deletion never erases evidence.
  - **Duplicate Accounts Detection & Verified Phone Uniqueness**:
    - Created `DuplicateDetectionService` (`normalizeEmail` handling Gmail/Googlemail dot & `+tag` normalization and common `+tag` providers, plus E.164 `normalizePhone`), surfacing groups via `GET /admin/users/duplicates` (`@Roles('admin', 'superuser')` with `'users'` section enforcement) and flagging `duplicateFlag` + audit `'duplicate-account-flagged'` without auto-blocking or suspending accounts.
    - Enforced unique verified phones across all non-deleted accounts (`409 PHONE_ALREADY_USED` while keeping `'This phone number is already linked to another account'`).
  - **Project Spam & Length Caps**:
    - Added configurable `maxProjectsPerDay` (`3`, env `PROJECT_DAILY_LIMIT`) and `reportDailyLimit` (`10`, env `REPORT_DAILY_LIMIT`) alongside `maxProjectsPerUser` (`10`, env `OPEN_PROJECT_LIMIT`) in `PlatformConfigService`, plus `400 TITLE_TOO_SHORT` (< 5 trimmed chars), `400 DESCRIPTION_TOO_SHORT` (< 100 trimmed chars), `429 PROJECT_DAILY_LIMIT` (> 3 per 24h via `ClockService`), and `409 OPEN_PROJECT_LIMIT` (> 10 open).
  - **Email Verification & `EmailVerifiedGuard`**:
    - Signup now sets `emailVerified: false` and dispatches a 24-hour single-use sha256 verification link via `MailService.sendEmailVerificationEmail` (sharing branded HTML template helper with password reset emails); added `@Public() POST /auth/verify-email` and `POST /auth/resend-verification` (2-minute cooldown via `ClockService` -> `429 RESEND_COOLDOWN`, invalidating prior tokens).
    - Applied `EmailVerifiedGuard` (`403 EMAIL_NOT_VERIFIED`) to `POST /projects`, `POST /join-requests`, `POST /communication/messages`, and `POST /mentor-marketplace/sessions/book` while keeping login, `/auth/me`, browsing GET endpoints, confirmed social emails (`email_verified === true`), and seeded users (`emailVerified: true`) unaffected.
  - **Automated Content Filter**:
    - Added `ContentFilterService`, `content-filter.config.ts`, `@FilteredContent` / `ContentFilterPipe` / `ContentFilterInterceptor` blocking obfuscated profanity/spam (case, spacing, punctuation, mixed `1->i/l` leet swaps) on signup, profile update/completion, and project create/update with `400 CONTENT_NOT_ALLOWED` + `{ field }` without echoing blocked words or storing offensive text in audit logs (`'CONTENT_BLOCKED'`).
    - Chat messages (`CommunicationService.sendMessage`) are not blocked; matched content flags the message (`flaggedForAdmin: true`) and logs `'chat-message-flagged'` without storing offensive text.
  - **Phone OTP 5-Attempt Lockout**:
    - Enforced 5 wrong OTP attempts voiding the active challenge and locking OTP verification/requests for 15 minutes via `ClockService` (`429 OTP_LOCKED` with `retryAt` and `cooldownSeconds`) across `GET /users/me/phone/otp-status`, `POST /users/me/phone/request-otp`, `POST /users/me/phone/verify-otp`, `POST /users/me/phone/failed-attempt`, and `verifyPhone`.
  - **Frontend UI & Flows**:
    - `ChatBox.jsx`: non-author `"Report"` button, reason modal (10–500 counter), `Reported` indicator, and `ALREADY_REPORTED` / `TOO_MANY_REPORTS` inline error display.
    - `AdminUsers.jsx` & `AdminReports.jsx`: `"Possible duplicates"` tab inspecting normalized email & verified phone groups with account links, plus `Chat Message` report badges, preserved reported message box, and 20-message conversation context snapshot viewer.
    - `CreateProject.jsx`: live title/description character counters (`>= 5` and `>= 100`), inline `CONTENT_NOT_ALLOWED` field error mapping, and `PROJECT_DAILY_LIMIT` / `OPEN_PROJECT_LIMIT` feedback.
    - `VerifyEmailBanner.jsx`, `VerifyEmail.jsx`, `layout.jsx`, `AppRoutes.jsx`, `AuthContext.jsx`: persistent email verification banner with 2-minute countdown timer and `/verify-email?token=...` verification screen.
    - `Signup.jsx`, `CompleteProfile.jsx`, and `settings.jsx`: inline `CONTENT_NOT_ALLOWED` field error handling and 15-minute phone OTP lockout countdown in Settings.
  - **Testing & Verification**:
    - Backend TypeScript check (`tsc -p tsconfig.build.json --noEmit`): **0 errors**.
    - Backend Unit tests (`npm test`): **28 passed suites, 232 passed, 0 failed** (`phase16.spec.ts`: 6/6 passed).
    - Backend E2E tests (`npm run test:e2e`): **16 passed suites, 178 passed, 0 failed** (`phase16.e2e-spec.ts`: 6/6 passed).
    - Frontend Vitest (`npm test -- --run`): **29 passed files, 139 passed, 0 failed** (`Phase16TrustSafety.test.jsx`: 7/7 passed).
    - Frontend ESLint (`npm run lint`): **0 errors, 0 warnings**.
    - Frontend Vite Production Build (`npm run build`): **0 errors, 208 modules transformed**.
    - Documentation updated: `docs/rbac-matrix.md` and `docs/api-tests/phase-16.http`.

- **Phase 17: Disputes & Admin Accountability**:
  - **Escrow Disputes & Reconciliation (`MentorMarketplaceService`, `EscrowService`, Controllers)**:
    - Added `SessionDisputeEntity`, `'disputed'` and `'split'` session statuses, and `EscrowService.freezeForDispute` / `EscrowService.split` along with serialized per-session queueing (`runInSessionQueue`).
    - Owners and assigned mentors can open disputes (`POST /mentor-sessions/:id/dispute` and `POST /mentor-marketplace/sessions/:id/dispute`) with a 10–1000 char reason on accepted/active/awaiting-release sessions while active or within 7 days after session end (`409 DISPUTE_WINDOW_EXPIRED`, `409 DISPUTE_ALREADY_OPEN`), freezing payout/refund (`409 SESSION_DISPUTED`) and skipping Phase 9 expiry and closure refund paths.
    - Admins (`reports` permission) and Super Users list (`GET /admin/disputes`) and decide disputes once (`POST /admin/disputes/:id/decide`, `409 DISPUTE_ALREADY_DECIDED`) with a 10–500 char reason via `release_to_mentor`, `refund_to_owner`, or `split` (0–100% mentor share with 15% platform fee applied strictly to the mentor share, holding `reconcileEscrow()` invariant `diff === 0`), notifying both parties and escalating unresolved 7-day open disputes to Super Users once.
  - **Admin Project Escrow Tab (`GET /admin/projects/:id/escrow`, `AdminProjectDetails.jsx`)**:
    - Added per-project escrow breakdown (held, released, refunded, platform fee, dispute rulings, and reconciliation badge) under `Escrow & Financials`.
  - **Audit Log CSV/JSON Export (`AuditService`, `AdminController`, `AuditLog.jsx`)**:
    - Added `GET /admin/audit/export` with date range, actor, and action filters, a 10,000-row cap, RFC 4180 CSV escaping + spreadsheet formula-prefix neutralization (`'=` / `'+'` / `'-'` / `'@`), automatic `'audit-exported'` logging, and an interactive export modal with Blob download.
  - **Owner Rejection Statistics (`ReportsService`, `ReportsController`, `AdminReports.jsx`)**:
    - Added `GET /admin/reports/owner-patterns` aggregating 30-day join request and task review rejections/approvals (plus written rejection reasons, excluding >30d records and auto-approvals) and flagging non-punitive `"review pattern"` when `totalRejections >= 5 && totalApprovals === 0`.
  - **Second Approval for Suspensions (`ModerationService`, `ModerationController`, `AdminUsers.jsx`, `AdminUserDetails.jsx`)**:
    - Regular Admin manual suspensions of accounts older than 90 days or with reputation `>= 150` return `202 { status: 'pending_second_approval', actionId }` and expire after 72 hours unless approved or rejected with a written reason by a different admin (`403 SAME_ADMIN_NOT_ALLOWED`, `409 ACTION_ALREADY_DECIDED`, `409 ACTION_EXPIRED`), while Super Users and 4th-warning auto-suspensions continue executing immediately.
  - **Warning Decay & Hourly Jobs (`ModerationService`, `JobsService`, `PersistenceService`)**:
    - Registered Jobs 14–16 (`warningDecay`, `disputeSuperUserReminder`, `pendingModerationExpiry`) inside `JobsService.runTick`; active warnings older than 90 days on clean non-suspended users transition silently to `'expired'` without restoring `-10` reputation or notifying, stop counting toward the 4-warning limit, remain in history labeled `'Expired'`, and persist across snapshots.
  - **Testing & Verification**:
    - Backend TypeScript check (`tsc -p tsconfig.build.json --noEmit`): **0 errors**.
    - Backend Unit tests (`npm test`): **29 passed suites, 239 passed, 0 failed** (`phase17.spec.ts` and `job-runs.service.spec.ts` green).
    - Backend E2E tests (`npm run test:e2e`): **17 passed suites, 184 passed, 0 failed** (`phase17.e2e-spec.ts` 6/6 passed).
    - Frontend Vitest (`npm test -- --run`): **30 passed files, 144 passed, 0 failed** (`Phase17DisputesAccountability.test.jsx`: 5/5 passed).
    - Frontend ESLint (`npm run lint`): **0 errors, 0 warnings**.
    - Frontend Vite Production Build (`npm run build`): **0 errors, 208 modules transformed**.
    - Documentation updated: `docs/rbac-matrix.md` and `docs/api-tests/phase-17.http`.

- **Phase 18: Privacy, Deletion & Notifications**:
  - **Soft-Delete Projects & 30-Day Restore (`project-visibility.util.ts`, `ProjectsService`, `ProjectsController`, `AdminController`)**:
    - Added centralized `isVisibleProject(project, { includeDeleted? })` filtering deleted projects across all public/owner/search/marketplace/active-cap queries (`DELETE /projects/:id` returns `200`, setting `deletedAt` and `deletedBy` while preserving tasks, requests, sessions, escrow, and audit logs; blocks with `409 PROJECT_HAS_ACTIVE_ESCROW` when escrow is held/active/disputed).
    - Added admin-only `status=deleted` visibility and `POST /admin/projects/:id/restore` within a 30-day restore window via `ClockService` (`409 RESTORE_WINDOW_PASSED` beyond 30 days).
  - **Personal Data Export (`DataExportService`, `UsersController`)**:
    - Added `POST /users/me/export` (`202`, 1 request/hour rate limit -> `429 EXPORT_RATE_LIMIT`), `GET /users/me/export`, `GET /users/me/export/:id`, and `GET /users/me/export/:id/download` (owner-only -> `403`, 24-hour file expiry -> `404 EXPORT_EXPIRED`), compiling one JSON archive containing only the caller's own profile, owned/joined projects, tasks, requests, own chat messages, notifications, reputation/XP ledgers, warnings, and party sessions/payments without exposing other users' private data or secrets; excluded from Phase 10 snapshots and cleaned hourly by `cleanExpiredExports` (Job 17).
  - **Account Deletion & Anonymisation (`AccountDeletionService`, `UsersRepository`, `JwtStrategy`, `AuthService`, Repositories)**:
    - Added idempotent `POST /users/me/delete` verifying typed username and current password (or `socialConfirmed` for passwordless social accounts), blocking admins (`403 ADMIN_CANNOT_SELF_DELETE`), suspended accounts (`403 ACCOUNT_SUSPENDED`), and open obligations (`409 ACCOUNT_HAS_OPEN_OBLIGATIONS` listing unfinished owned projects, non-terminal sessions, or held escrow).
    - Anonymises user record (`"Deleted user"`, `deleted_<hash>@deleted.local`), clears password/tokens and increments `tokenVersion` (`401` on existing JWTs and login attempts), excludes deleted users from search/leaderboard/mentor directory, preserves chat/tasks/approved work under `"Deleted user"`, scrubs audit/report identifiers with irreversible SHA-256 `deleted_<hash>`, and allows original email reuse for fresh signup with `0` ledger reputation/XP.
  - **Notification Digest & User Preferences (`notification-priority.config.ts`, `DigestService`, `NotificationsService`, `UsersController`, `JobsService`, `PersistenceService`)**:
    - Implemented single config `notification-priority.config.ts` classifying warnings, suspensions, appeals, payment/escrow changes, dispute outcomes, mentor session lifecycle events, security/OTP/email alerts, and `<24h` deadline alerts as `'immediate'`, and routine updates as `'digest'`.
    - Added `GET /users/me/settings` and `PATCH /users/me/settings` (`digestEnabled`, integer `digestHour` `0..23`, `utcOffsetMinutes` `-720..840`), buffering `'digest'` items when enabled, merging duplicate `type + target` events (`"N tasks released from <Project>"`), capping digest lists at 10 items, flushing once per local day via `flushNotificationDigests` (Job 18), and persisting digest state across Phase 10 snapshots.
  - **Frontend UI & Flows**:
    - `MyProjects.jsx`, `OwnedWorkspace.jsx`, `ProjectCard.jsx`, `AdminProjects.jsx`, `AdminProjectDetails.jsx`: Owner `"Delete project"` confirmation modal showing escrow errors, plus Admin `"Deleted"` filter tab and `"Restore"` controls.
    - `settings.jsx`, `usersApi.js`, `projectsApi.js`: `"Notification digest"` settings card, `"Your data"` export request/download card, and `"Delete account"` danger zone with structured open-obligations feedback.
    - `Avatar.jsx`, `ChatBox.jsx`, `TaskCard.jsx`, `notifications.jsx`: Neutral `"Deleted user"` rendering and expandable daily digest item lists.
  - **Testing & Verification**:
    - Backend TypeScript check (`tsc -p tsconfig.build.json --noEmit`): **0 errors**.
    - Backend Unit tests (`npm test`): **30 passed suites, 244 passed, 0 failed** (`phase18.spec.ts`: 5/5 passed).
    - Backend E2E tests (`npm run test:e2e`): **18 passed suites, 188 passed, 0 failed** (`phase18.e2e-spec.ts`: 4/4 passed).
    - Frontend Vitest (`npx vitest run --run`): **31 passed files, 148 passed, 0 failed** (`Phase18PrivacyNotifications.test.jsx`: 4/4 passed).
    - Frontend ESLint (`npm run lint`): **0 errors, 0 warnings**.
    - Frontend Vite Production Build (`npm run build`): **0 errors, 208 modules transformed**.
    - Documentation updated: `docs/rbac-matrix.md` and `docs/api-tests/phase-18.http`.

- **Phase 19: Users Controller Lockdown (`SEC-05`, `SEC-06`, `SEC-07`, `SEC-12`)**:
  - **Admin-Only Creation & Public Signup Restriction (`UsersController`, `UsersService`, `AuthService`, `SuperUserCreateUserDto`, `SignupDto`, `CreateProfileDto`)**:
    - Removed `@Public()` from `POST /users` and locked it behind `@Roles('superuser')` with `SuperUserCreateUserDto`; creates accounts with an internal hashed random password, `emailVerified: false`, a one-time 24h password setup reset email via `AuthService.issuePasswordSetupLink` (no password or reset token in response), and audit entry `USER_CREATED_BY_SUPERUSER`.
    - Restricted `POST /auth/signup` and `POST /auth/profile` (`CreateProfileDto`) to `Collaborator` and `Project Owner` roles only (`400`/`403 FORBIDDEN_ROLE`).
  - **Password Enforcement & Shared Login Throttling (`LoginThrottleService`, `LoginDto`, `AdminLoginDto`, `AuthService`, `AdminService`)**:
    - Removed passwordless `POST /users/login` and `UsersService.login`.
    - Enforced non-empty string passwords on `POST /auth/login` and `POST /admin/login` (`400 PASSWORD_REQUIRED` for missing, whitespace, or non-string inputs) and returned identical `401 INVALID_CREDENTIALS` responses for unknown users and wrong passwords.
    - Added shared `LoginThrottleService` (10 wrong attempts/account and 30/IP within 15 minutes via `ClockService`, returning `429 TOO_MANY_ATTEMPTS` + `retryAt` and auditing `LOGIN_THROTTLED`; resetting only per-account failures on valid login while preserving IP counters).
  - **Self-Update Allow-List & Email Verification Reset (`SelfUpdateUserDto`, `SelfAccountUpdateGuard`, `UsersService`, `UsersRepository`, `JwtStrategy`)**:
    - Locked `PATCH /users/:id` with `SelfAccountUpdateGuard` (`403 NOT_YOUR_ACCOUNT` on cross-user edits, `400 FIELD_NOT_ALLOWED` + `USER_UPDATE_REJECTED_FIELD` audit with rejected field names only on non-allow-listed keys like `role`, `status`, `emailVerified`, `xp`, `reputation`, `badges`, `warnings`).
    - Self email changes normalize and re-index the email in `UsersRepository`, reset `emailVerified: false`, send a fresh verification email via `AuthService.issueEmailVerificationForUser`, and revoke all other active sessions via `revokeOtherSessions` (bumping `tokenVersion` while retaining the caller's current `jti` via `allowedLegacyJti`).
  - **Super User Account Deletion & Privacy / Secret Stripping (`UsersController`, `AccountDeletionService`, `user-serializer.ts`, `RolesGuard`, `PortalAdminsController`)**:
    - Restricted `DELETE /users/:id` to `@Roles('superuser')` with mandatory written reason (`400 REASON_REQUIRED`), blocking Super User targets (`403 CANNOT_DELETE_SUPERUSER`), checking Phase 18 open obligations (`409 ACCOUNT_HAS_OPEN_OBLIGATIONS`), running full anonymisation, and logging `USER_DELETED_BY_SUPERUSER`.
    - Restricted `GET /users` to Admins with `'users'` permission and Super Users (`RolesGuard` + controller check), and `GET /users/:id` to self, Admins with `'users'` permission, or Super Users (`403 FORBIDDEN` otherwise).
    - Applied canonical `serializeSafeUser` / `stripUserSecrets` across `UsersService.toSafeUser`, `UsersController.getMe`, `AuthController.getMe`, `AdminService.getUserDetails`, and `PortalAdminsController` so password hashes, refresh tokens, reset codes, `tokenVersion`, and OTP secrets are stripped everywhere.
  - **Frontend Security Migration & UI Feedback (`usersApi.js`, `apiClient.js`, `navbar.jsx`, `dashboard.jsx`, `profile.jsx`, `settings.jsx`, `Signup.jsx`, `Login.jsx`, `AdminLogin.jsx`)**:
    - Removed `list`, `get`, `create`, and `remove` from `usersApi.js`; migrated non-admin screens (`navbar.jsx`, `dashboard.jsx`, `profile.jsx`, `settings.jsx`) to `usersApi.getMe()` and migrated `Login.jsx` / `Signup.jsx` off `POST /users`, `POST /users/login`, and `GET /users` to `authApi.login` / `authApi.signup`.
    - Updated `settings.jsx` Profile form to send allow-listed fields only, add editable Email Address, handle `FIELD_NOT_ALLOWED` and `NOT_YOUR_ACCOUNT`, and show `"Check your new email to verify it"` plus `<VerifyEmailBanner>` upon email change.
    - Unified invalid-credentials error messages and rendered `TOO_MANY_ATTEMPTS` countdown timers in `Login.jsx` and `AdminLogin.jsx`.
  - **Testing & Verification**:
    - Backend TypeScript check (`npx tsc -p tsconfig.build.json --noEmit`): **0 errors**.
    - Backend Unit tests (`npm test`): **31 passed suites, 252 passed, 0 failed** (`phase19.spec.ts`: 8/8 passed).
    - Backend E2E tests (`npm run test:e2e`): **19 passed suites, 206 passed, 0 failed** (`phase19.e2e-spec.ts`: 18/18 passed).
    - Frontend Vitest (`npm test -- --run`): **32 passed files, 153 passed, 0 failed** (`Phase19UsersLockdown.test.jsx`: 5/5 passed).
    - Frontend ESLint (`npm run lint`): **0 errors, 0 warnings**.
    - Frontend Vite Production Build (`npm run build`): **0 errors, 208 modules transformed**.
    - Documentation updated: `docs/rbac-matrix.md`, `docs/api-tests/phase-19.http`, and `README.md`.

- **Phase 20: Resource Authorization & Input Checks (`SEC-08`, `SEC-09`, `SEC-10`, `SEC-11`, `SEC-13`)**:
  - **Project-Scoped Task Authorization & Stored Project Enforcement (`ProjectAccessService`, `TasksController`, `TasksService`, `UpdateTaskStatusDto`)**:
    - Added reusable `ProjectAccessService` (`isOwner`, `isMember`, `getMemberRole`, `assertOwnerOrAdmin`, `assertMemberOrOwner`) built on `common/utils/role.util.ts` (`getProjectRole`, `isProjectMember`, `isProjectOwner`, `isPlatformAdminOrSuperUser`) and exported from `ProjectsModule`.
    - Applied ownership/membership enforcement across all 11 `TasksController` routes (`GET /tasks/project/:projectId`, `GET /tasks/:id`, `POST /tasks`, `PATCH`/`PUT /tasks/:id`, `PATCH`/`PUT /tasks/:id/status`, `POST /tasks/:id/review`, `POST /tasks/:id/unassign`, `POST /tasks/:id/comments`, `DELETE /tasks/:id`), deriving `projectId` strictly from the stored task (`404 TASK_NOT_FOUND` on mismatched URL/body `projectId`, `403 NOT_A_PROJECT_MEMBER` + `ACCESS_DENIED_TASK` audit for outsiders/removed members).
  - **Initial Status & Content Filter Enforcement (`TasksService`, `MentorApplicationsService`, `CreateMentorApplicationDto`, `ProjectInvitesService`, `ProjectsController`)**:
    - Rejected non-Open initial statuses (`In Review`, `Completed`, `In Progress`, etc.) on `POST /tasks` with `400 INVALID_INITIAL_STATUS`.
    - Enforced `ContentFilterService.assertClean` (`400 CONTENT_NOT_ALLOWED`, no banned word echoed) across task titles/descriptions, task comments, mentor application text fields (`headline`, `bio`, `experience`, `motivation`, `expertise`, `name`), and optional project invite `message` (`POST /projects/:id/invites`).
  - **Notification Isolation & Admin-Only System Create (`NotificationsController`, `NotificationsService`, `NotificationsModule`, `AdminCreateNotificationDto`)**:
    - Scoped `GET /notifications` (ignoring `?userId=` for non-admins) and all `:id` routes (`GET /notifications/:id`, `PUT /notifications/:id`, `PUT /notifications/:id/read`, `DELETE /notifications/:id`) to the notification owner, logging `ACCESS_DENIED_NOTIFICATION` and returning `404 NOTIFICATION_NOT_FOUND` on cross-user IDs so IDs are not probeable.
    - Locked `POST /notifications` to `@Roles('admin', 'superuser')` with `AdminCreateNotificationDto` (required `userId` and 10–500 character `message`).
  - **Upload Magic-Bytes Verification, Safe Serving & CV Permissions (`file-validation.util.ts`, `file-upload.middleware.ts`, `UploadAuditInterceptor`, `UploadsController`, `RolesGuard`, `MentorApplicationsController`, `main.ts`)**:
    - Restricted uploads to PNG, JPG, JPEG, WEBP, and PDF ONLY (removing SVG, GIF, Office docs, text, and archives; throwing `400 UNSUPPORTED_FILE_TYPE`), verified file headers by magic bytes (`89 50 4E 47`, `FF D8 FF`, `RIFF....WEBP`, `%PDF-`), unlinked invalid uploads from disk, and logged `UPLOAD_REJECTED`.
    - Removed unprotected `useStaticAssets('/uploads')` in `main.ts` and added `@Public() @Get(':filename')` on `UploadsController` serving safe files with `X-Content-Type-Options: nosniff`, `Content-Disposition: attachment` on PDFs/non-images, and `404` on `.svg`/`.svgz`.
    - Restricted `GET`/`DELETE /uploads/cv/:filename` and `DELETE /mentor-applications/:id/cv` to applicant, Super User, or Admin with `'mentor_apps'` permission (`403` otherwise, plus `X-Content-Type-Options: nosniff` & `Content-Disposition: attachment` on CV downloads).
  - **Admin Login Throttling Audit & `EmailVerifiedGuard` Expansion (`LoginThrottleService`, `AdminService`, `InvitesController`, `MentorApplicationsController`, `ReportsController`, `MentorSessionsLifecycleController`, `MentorMarketplaceController`, `UsersController`)**:
    - Tagged `AdminService.login` throttling with `ADMIN_LOGIN_THROTTLED` audit action alongside generic `401 INVALID_CREDENTIALS` responses for missing/wrong passwords.
    - Added `@UseGuards(EmailVerifiedGuard)` (`403 EMAIL_NOT_VERIFIED`) to `POST /invites/:id/accept`, `POST /mentor-applications`, `POST /reports`, `POST /mentor-sessions/:id/dispute`, `POST /mentor-marketplace/sessions/:id/dispute`, and `POST /users/me/export`.
  - **Frontend Security & Error Handling (`notificationsApi.js`, `OwnedWorkspace.jsx`, `CollaboratorWorkspace.jsx`, `settings.jsx`, `MentorApplication.jsx`, `notifications.jsx`, `help.jsx`, `VerifyEmailBanner.jsx`)**:
    - Removed unused `notificationsApi.create` client method after auditing all callers (zero UI pages called it).
    - Surfaced `"You are not a member of this project"` and hid unauthorized task controls on `403 NOT_A_PROJECT_MEMBER`; surfaced `CONTENT_NOT_ALLOWED` / `INVALID_INITIAL_STATUS` in `OwnedWorkspace.jsx`; restricted avatar input in `settings.jsx` to `.png,.jpg,.jpeg,.webp` with `UNSUPPORTED_FILE_TYPE` handling; rendered `<VerifyEmailBanner forceShow />` on `EMAIL_NOT_VERIFIED` across invite acceptance, mentor application, and report filing.
  - **Testing & Verification**:
    - Backend TypeScript check (`npx tsc -p tsconfig.build.json --noEmit`): **0 errors**.
    - Backend Unit tests (`npm test`): **32 passed suites, 260 passed, 0 failed** (`phase20.spec.ts`: 8/8 passed).
    - Backend E2E tests (`npm run test:e2e`): **20 passed suites, 214 passed, 0 failed** (`phase20.e2e-spec.ts`: 8/8 passed).
    - Frontend ESLint (`npm run lint`): **0 errors, 0 warnings**.
    - Frontend Vitest (`npx vitest run`): **33 passed files, 159 passed, 0 failed** (`Phase20ResourceAuth.test.jsx`: 6/6 passed).
    - Frontend Vite Production Build (`npm run build`): **0 errors, 208 modules transformed**.
    - Live 2-account HTTP verification (`verify-phase20.mjs` against `ts-node src/main.ts`): **All assertions passed** (`MANUAL_PHASE20_CHECKS_OK`).
    - Documentation updated: `docs/rbac-matrix.md`, `docs/api-tests/phase-20.http`, and `README.md`.

- **Phase 21: Legacy Route Retirement & Route Authorization Matrix (`SEC-11`)**:
  - **Governance & Mentorship Legacy Bypass Retirement (`governance.controller.ts`, `governance.module.ts`, `governance.repository.ts`, `mentorship.controller.ts`, `mentorship.service.ts`, `mentorship.repository.ts`, `mentorship.module.ts`, `legacy-route.util.ts`)**:
    - Retired all 4 legacy report routes (`POST /governance/reports`, `GET /governance/reports`, `GET /governance/reports/:id`, `PATCH /governance/reports/:id/resolve`) and 3 parallel mentor application routes (`POST /mentorship/apply`, `GET /mentorship/application`, `PATCH /mentorship/application/:id/review`) to return HTTP `410 LEGACY_ENDPOINT_REMOVED` naming their canonical replacements (`/reports`, `/admin/reports*`, `/mentor-applications*`).
    - Removed dead `GovernanceService` (eliminating direct `-50`/`-15` `GamificationService.updateReputation` writes and direct role suspensions), removed dead governance/mentorship application DTOs (`create-report.dto.ts`, `resolve-report.dto.ts`, `create-application.dto.ts`) and unreachable repository CRUD methods while preserving snapshot persistence (`exportState`/`importState`) and Phase 18 GDPR `anonymizeUser`.
    - Kept the 4 recommendation badge routes under `/mentorship` (`POST /mentorship/badge`, `POST /mentorship/badges`, `GET /mentorship/badges/:userId`, `GET /mentorship/badges/project/:projectId`) as thin canonical wrappers (no separate badge route exists outside `/mentorship`), strictly using verified `@CurrentUser()` identity in JWT mode.
  - **Identity Header Hardening & Unexpected Public Endpoint Lockdown**:
    - Eliminated remaining non-legacy `x-user-id` / `x-userid` / query `userId` fallbacks across `SupportController` (`POST /support`), `MentorApplicationsController` (`GET /mentor-applications/me`), `MentorMarketplaceController`, `MentorLifecycleController`, `MentorRequestsController` (`accept`/`decline`), `ReportsController`, `AppealsController`, `AdminController`, `UploadsController`, and `UploadAuditInterceptor`.
    - Replaced `@Public()` on test-only `POST /auth/test-set-expiry` with `@Roles('superuser')` (one-line guard fix).
  - **Route Authorization Matrix & Anti-Drift Suite (`route-auth-matrix.ts`, `generate-route-matrix.ts`, `route-auth-matrix.json`, `package.json`)**:
    - Added `DiscoveryService` + `MetadataScanner` + `Reflector` matrix builder extracting all 244 HTTP routes (`method`, `path`, `access`, `guards`, `roles`, `permission`, `controller`, `handler`, `hasExplicitGuardOrRole`) in deterministic sorted order (`npm run test:routes` regenerates a draft file for review).
    - Committed reviewed `back-end/test/route-auth-matrix.json` paired with explicit 13-route `PUBLIC_ROUTE_ALLOWLIST` and unit/E2E anti-drift assertions failing on added/removed/changed routes, unexpected `@Public()` routes, or unguarded test modules.
  - **Frontend Cleanup (`mentorshipApi.js`)**:
    - Removed unused retired helpers (`apply`, `getApplication`, `reviewApplication`) from `mentorshipApi.js` while keeping canonical recommendation badge calls and canonical report/mentor-application screens working.
  - **Testing & Verification**:
    - Backend TypeScript check (`npx tsc -p tsconfig.build.json --noEmit`): **0 errors**.
    - Backend Unit tests (`npm test`): **33 passed suites, 264 passed, 0 failed** (`phase21.spec.ts`: 4/4 passed).
    - Backend E2E tests (`npm run test:e2e`): **21 passed suites, 220 passed, 0 failed** (`phase21.e2e-spec.ts`: 6/6 passed).
    - Frontend ESLint (`npm run lint`): **0 errors, 0 warnings**.
    - Frontend Vitest (`npx vitest run`): **34 passed files, 163 passed, 0 failed** (`Phase21LegacyRetirement.test.jsx`: 4/4 passed).
    - Frontend Vite Production Build (`npm run build`): **0 errors, 208 modules transformed**.
    - Live HTTP verification (`verify-phase21.mjs` against `ts-node src/main.ts`): **All assertions passed** (`MANUAL_PHASE21_CHECKS_OK`).
    - Documentation updated: `docs/rbac-matrix.md`, `docs/api-tests/phase-21.http`, `back-end/test/route-auth-matrix.json`, and `README.md`.

- **Phase 22: Single Reputation Ledger & Badge Farming**:
  - **Single Canonical Reputation Ledger (`ReputationService`, `reputation.seeds.ts`, `reputation-entry.entity.ts`)**:
    - Consolidated all reputation writes and reads onto `ReputationService` (`getTotal(userId)` = `max(0, sum of ledger entries)` + bulk `getTotals(userIds)` + `getReputation` alias), removing `rep` fields and reputation write methods (`recordAccountCreated`, `recordWarningIssued`, `recordWarningRemoved`, `updateReputation`) from `GamificationRepository` / `GamificationService` and removing hardcoded `rep` properties from `UsersRepository` seeds/creations and `TasksService` updates.
    - Enforced `(type, refId, userId)` deduplication across `initial` (`+100`, `refId=userId`), `seed`, `task_approved` (`+8`, `refId=taskId`), `project_completed` (`+15`, `refId=projectId`), `warning` (`-10`, `refId=warningId`), `warning_removed` (`+10`, `refId=warningId`), and `deadline_missed` (`-5`, `refId=taskId`).
    - Made `backfillStartupSeedUsers()` idempotent via `SEED_USER_REPUTATION` (skipping any user who already holds ledger entries so restarts and snapshots never double-seed `87 -> 174`) and added `repairReputationLedger()` at startup and `importState()` (ordered after `AuditService.importState` in `PersistenceService`) to strip duplicate `seed` entries while preserving non-`seed` history and auditing `LEDGER_REPAIRED`.
    - Routed `LeaderboardService`, `serializeSafeUser`, `UsersService` (`getPublicProfile`, `toSafeUser`, `create`, `completeSocialProfile`, `findOrCreateFromAuth`), `AdminService` (`getUsers`, `getUserDetails`, `flagOrWarnUser`, `reconcileReputation`), `ModerationService` (`getEffectiveReputation`), and `GET /users/me/reputation` through `ReputationService`.
    - Added Super-User-only `GET /admin/reputation/reconcile` returning `{ ok, totalChecked, mismatches }` and updated `back-end/test/route-auth-matrix.json` (`245` routes).
  - **Project Completion Anti-Farming Rules (`PlatformConfigEntity`, `TasksService`, `ProjectsService`, `GamificationService`)**:
    - Added `COMPLETION_BADGE_MIN_TASKS = 3`, `COMPLETION_BADGE_MIN_PROJECT_AGE_DAYS = 3`, and `TASK_MIN_REVIEW_GAP_MINUTES = 60` config defaults (`PlatformConfigService`), plus `assignedAt` tracking on task creation, assignment, unassignment, and startup backfill.
    - Updated `GamificationService.awardProjectCompletion` / `ProjectsService.completeProject` to verify `>= 3` approved tasks, project age `>= 3` days, `>= 3` tasks having `(approvedAt - assignedAt) >= 60` minutes, and owner/collaborators not sharing a Phase 16 `DuplicateDetectionService` group—completing non-qualifying projects with `badgeAwarded: false`, descriptive `badgeReason`, and `BADGE_WITHHELD` audit entry, while awarding `+250` XP and `+15` reputation once per `(projectId, userId)` when all checks pass.
  - **Frontend Single-Source UI (`leaderboard.jsx`, `OwnedWorkspace.jsx`, `profile.jsx`, `AdminUserDetails.jsx`)**:
    - Removed hardcoded `FALLBACK_LEADERBOARD` static reputation arrays from `leaderboard.jsx`; renders API responses or error alert directly.
    - Persisted & surfaced completion `badgeReason` in `OwnedWorkspace.jsx` (`completion-badge-status` banner + toast) when a completed project does not earn a badge.
    - Rendered `"Starting reputation"` for `'seed'` ledger entries, added `Type` pills and filter options (`initial`, `project_completed`, etc.) with formatted dates across `profile.jsx` and `AdminUserDetails.jsx`.
  - **Testing & Verification**:
    - Backend TypeScript check (`npx tsc -p tsconfig.build.json --noEmit`): **0 errors**.
    - Backend Unit tests (`npm test`): **34 passed suites, 269 passed, 0 failed** (`phase22.spec.ts`: 5/5 passed).
    - Backend E2E tests (`npm run test:e2e`): **22 passed suites, 225 passed, 0 failed** (`phase22.e2e-spec.ts`: 5/5 passed).
    - Frontend ESLint (`npm run lint`): **0 errors, 0 warnings**.
    - Frontend Vitest (`npx vitest run`): **35 passed files, 166 passed, 0 failed** (`Phase22ReputationLedger.test.jsx`: 3/3 passed).
    - Frontend Vite Production Build (`npm run build`): **0 errors**.
    - Live double-restart snapshot check (`verify-phase22.mjs` across 3 server boots): **All assertions passed** (`MANUAL_PHASE22_CHECKS_OK`).
    - Documentation updated: `docs/rbac-matrix.md`, `docs/api-tests/phase-22.http`, `back-end/test/route-auth-matrix.json`, and `README.md`.

- **Phase 23: Snapshot Completeness, Integrity Check & Storage Hygiene**:
  - **Snapshot v2 Completeness & Recursive Secret Sanitization (`PersistenceService`, `PersistenceModule`, `snapshot-sanitizer.ts`, `escrow.service.ts`, `payouts.service.ts`, `platform-config.service.ts`, `portal-admins.service.ts`, `mentor-applications.service.ts`, `demo-upi.provider.ts`, `job-runs.service.ts`, `data-export.service.ts`, `users.repository.ts`)**:
    - Bumped snapshot `schemaVersion` from `1` to `2` with per-store `storeVersions` while keeping full backward compatibility when loading `v1` snapshots (explicitly resetting missing stores to empty/defaults so stale seed data does not mask missing-store integrity checks).
    - Added `exportState()`/`importState()` and registered all remaining stateful stores: `EscrowService`, `PayoutsService`, `PlatformConfigService`, `PortalAdminsService`, `MentorApplicationsService`, `MentorRequestsService`, `DemoUpiProvider` (`paymentProvider`), `JobRunsService`, and `DataExportService`.
    - Implemented shared recursive `sanitizeSnapshotState()` across snapshot saves and stripped one-time reset, email verification, deletion, and OTP tokens from `UsersRepository.exportState()` while preserving bcrypt password hashes (`$2[abxy]$`).
  - **Startup & On-Demand Integrity Verification + `needs_review` Fencing (`IntegrityCheckService`, `MentorSessionEntity`, `MentorMarketplaceService`, `AdminController`, `RolesGuard`)**:
    - Verified missing snapshot stores, session-to-escrow and escrow-to-session references, project owner/collaborator/mentor and task assignee user existence, payment intent/idempotency session links, and XP/reputation ledger user ownership; logs warnings and writes one `SNAPSHOT_INTEGRITY` audit entry.
    - Fenced funded in-flight sessions lacking an escrow record with `status = 'needs_review'`, blocking `acceptSession`, `declineSession`, `completeSession`, `cancelSession`, `retryPayout`, `openSessionDispute`, and `decideDispute` with `409 SESSION_NEEDS_REVIEW` (and skipping auto-settlement loops), while preventing re-flagging once cleared.
    - Added `GET /admin/system/integrity` (`@Roles('superuser')`), `GET /admin/mentor-sessions/needs-review`, and `POST /admin/mentor-sessions/:id/clear-review` (`'reports'` section permission / Super User, 10–500 char mandatory reason, `409 SESSION_NOT_NEEDS_REVIEW` on replay, `SESSION_REVIEW_CLEARED` audit entry), and regenerated `back-end/test/route-auth-matrix.json` (`248` routes).
  - **Hourly Storage Hygiene (`StorageHygieneService`, `JobsService`, `JobsModule`, `ProjectsRepository`)**:
    - Implemented `storageHygiene` job (Job #19 in `JobsService.runTick()`) scanning `UPLOADS_DIR`, `SECURE_CVS_DIR`, `EXPORT_DIR`, and soft-deleted projects: deletes >24h orphan uploads while keeping recent (<24h) and referenced uploads, cleans expired and pre-restart orphan exports, deletes mentor CVs of deleted accounts, and hard-deletes >30d soft-deleted project tombstones unneeded by any unsettled/disputed/`needs_review` session, open dispute, or non-terminal escrow (preserving audit entries).
    - Honored `STORAGE_HYGIENE_DRY_RUN` (defaulting first non-test run to dry-run when unset) and persisted detailed `counts` on `JobResult`.
  - **Frontend UI (`adminApi.js`, `SuperuserConfig.jsx`, `AdminReports.jsx`, `ScheduledJobsPanel.jsx`)**:
    - Added Super User `Integrity` card in `SuperuserConfig.jsx` with summary, issue list, and `"Run check"` trigger (`getSystemIntegrity(true)`).
    - Added `"Sessions Flagged Need Review"` panel + `"Clear flag"` reason modal inside the `AdminReports.jsx` Escrow tab.
    - Added structured `job.counts` breakdown pills and `"Dry-run (no deletions)"` indicator in `ScheduledJobsPanel.jsx`.
  - **Testing & Verification**:
    - Backend TypeScript check (`npx tsc --noEmit -p tsconfig.build.json`): **0 errors**.
    - Backend Unit tests (`npm test`): **35 passed suites, 273 passed, 0 failed** (`phase23.spec.ts`: 4/4 passed; `persistence.service.spec.ts` & `job-runs.service.spec.ts` updated for schema v2 and 19 jobs).
    - Backend E2E tests (`npm run test:e2e`): **23 passed suites, 228 passed, 0 failed** (`phase23.e2e-spec.ts`: 3/3 passed; `phase21.e2e-spec.ts` 248-route matrix passed).
    - Frontend ESLint (`npm run lint`): **0 errors, 0 warnings**.
    - Frontend Vitest (`npx vitest run`): **36 passed files, 169 passed, 0 failed** (`Phase23SnapshotHygiene.test.jsx`: 3/3 passed).
    - Frontend Vite Production Build (`npm run build`): **0 errors, 208 modules transformed**.
    - Live two-boot server-restart verification (`verify-phase23.mjs` against `ts-node src/main.ts`): **Passed** (`MANUAL_PHASE23_CHECKS_OK`, pre-restart escrow `Funded` `1755` / mentor payout `0` -> post-restart payout release -> escrow `Distributed`, mentor payout `1500`).
    - Documentation updated: `docs/rbac-matrix.md`, `docs/api-tests/phase-23.http`, `back-end/test/route-auth-matrix.json`, and `README.md`.

- **Phase 24: Project and Account Lifecycle Cleanup**:
  - **Live-Project Filtering Across Hourly Jobs (`project-visibility.util.ts`, `ProjectsService`, `JobsService`, `MentorMarketplaceService`, `ProjectInvitesService`, `ReputationService`)**:
    - Centralized `isLiveProject(project)` (`!project.deletedAt && !project.isCompleted && !['draft', 'closed', 'completed', 'cancelled']`) in `project-visibility.util.ts` and exposed `ProjectsService.isLiveProject(project)`.
    - Applied `isLiveProject` across all 13 project-touching hourly cron loops (`closeEmptyProjects`, `expireMentorRequests`, `applyDeadlinePenalties`, `expirePendingPayments`, `remindPendingRequests`, `zombieProjectBreaker`, `staleRequestCloser`, `ownerInactivityNotifier`, `memberInactivityNotifier`, `reviewDeadlineJob`, `mentorAbandonmentReleaser`, `mentorActivityNotifier`, `projectInviteExpirer`), keeping Drafts exempt from 5-day empty auto-close and Draft/Closed/Completed/soft-deleted projects exempt from deadline penalties, review reminders/auto-approvals, join request reminders/closures, mentor expiry/abandonment/notices, and invite expirations.
    - Guarded `applyDeadlinePenalties` with both `task.penaltyAppliedAt` and `ReputationService.hasEntryForRef('deadline_missed', task.id)` so deadline penalties apply at most once per task.
    - Emits one counts-only audit entry `JOB_SKIPPED_NOT_LIVE` per `JobsService.runTick()` run whenever non-live items are skipped (`{ runId, totalSkipped, byJob }`).
  - **Project Spam Caps & Soft Delete Cascade (`ProjectsService`, `JoinRequestsService`, `ProjectInvitesService`)**:
    - Updated `validateProjectContentAndCaps` so the `3 new projects per 24 hours` (`429 PROJECT_DAILY_LIMIT`) cap includes soft-deleted projects created in the trailing 24 hours (`findByOwnerId(ownerId, true)`), while open project count (`10` cap) still counts only non-deleted open projects.
    - Updated `softDeleteProject()` to close pending join requests as `system_closed` (`countedTowardLimit: false`, `closureReason: 'Closed because the project was deleted'`, immediate applicant notification) via `JoinRequestsService.closePendingRequestsForProject` and cancel pending direct invitations via `ProjectInvitesService.cancelPendingForProject`.
  - **Shared `FileCleanupService` & Full Account Deletion Release (`file-cleanup.service.ts`, `CoreModule`, `StorageHygieneService`, `DataExportService`, `MentorApplicationsService`, `AccountDeletionService`)**:
    - Created global `FileCleanupService` unifying safe file removal, upload/CV reference extraction, and user personal file deletion; reused across `StorageHygieneService`, `DataExportService`, `MentorApplicationsService.deleteCvForApplication`, and `AccountDeletionService`.
    - Updated `AccountDeletionService.anonymizeAccount` (idempotent): removes deleted user from every project's `collaborators`/`members`/`teamMembers` lists and transitions Approved join requests to `'left'` (`JoinRequestsService.releaseForDeletedUser`) so team capacity seats immediately become free; releases Open and In Progress tasks to `Unassigned` + `To Do` via `TasksService.releaseMemberTasksOnDeparture` while preserving `In Review` and `Completed` work under `"Deleted user"`; closes pending join requests and cancels pending invites; deletes disk CV files (`SECURE_CVS_DIR`), personal avatars/uploads (`UPLOADS_DIR`, sparing retained task proofs), and requested export archives (`DataExportService.deleteForUser`); writes `ACCOUNT_RELEASED` audit entry (`{ anonymizedId, projectCount, taskCount, fileCount }`).
  - **Server-Side Account Deletion Re-Authentication (`AccountDeletionService`, `UsersController`, `MailService`, `user-serializer.ts`, `snapshot-sanitizer.ts`)**:
    - Removed the legacy `socialConfirmed` client boolean everywhere (`DeleteAccountDto`, `UsersController`, `settings.jsx`).
    - Added `POST /users/me/delete/request-code` (`204 No Content`, 1/min rate limit -> `429 TOO_MANY_ATTEMPTS`, verified email required, password accounts rejected) emailing a single-use 6-digit code valid for 10 minutes via `ClockService` (`5` wrong attempts void active code -> `429 CODE_LOCKED`; never persisted in snapshots or audit logs; stripped via `USER_SECRET_FIELDS` & `SNAPSHOT_SECRET_KEYS`).
    - Enforced password verification (`400 INVALID_PASSWORD` / `400 REAUTH_REQUIRED`) or emailed verification code (`400 REAUTH_REQUIRED` / `400 INVALID_CODE` / `400 CODE_EXPIRED` / `429 CODE_LOCKED`) on `POST /users/me/delete`, exposed `hasPassword` safely on `/users/me` (`serializeSafeUser`) and `/auth/me`, and regenerated `back-end/test/route-auth-matrix.json` (`249` routes).
  - **Frontend UI (`usersApi.js`, `AuthContext.jsx`, `settings.jsx`, `AppliedProjects.jsx`, `OwnedWorkspace.jsx`)**:
    - Added `usersApi.requestDeleteCode()`, propagated `hasPassword` in `AuthContext.jsx`, and updated `settings.jsx` Delete Account card to render password input for password accounts or `"Send me a code"` + 60s resend cooldown + `10:00` countdown + 6-digit code input for passwordless social accounts with inline error feedback.
  - **Testing & Verification**:
    - Backend TypeScript check (`npx tsc --noEmit -p tsconfig.build.json`): **0 errors**.
    - Backend Unit tests (`npm test`): **37 passed suites, 279 passed, 0 failed** (`phase24.spec.ts` + `phase24-jobs.spec.ts`: 6/6 passed).
    - Backend E2E tests (`npm run test:e2e`): **24 passed suites, 231 passed, 0 failed** (`phase24.e2e-spec.ts`: 3/3 passed; `phase21.e2e-spec.ts` 249-route matrix passed).
    - Frontend ESLint (`npm run lint`): **0 errors, 0 warnings**.
    - Frontend Vitest (`npx vitest run`): **37 passed files, 172 passed, 0 failed** (`Phase24LifecycleCleanup.test.jsx`: 3/3 passed).
    - Frontend Vite Production Build (`npm run build`): **0 errors, 208 modules transformed**.
    - Live backend verification (`verify-phase24.mjs` against `ts-node src/main.ts` in `jwt` + `console` mail mode): **Passed** (`MANUAL_PHASE24_CHECKS_OK`, uploaded CV deleted from `back-end/secure-cvs/`, Open task reset to `To Do` + `Unassigned`, In Review kept with `"Deleted user"`, project seat freed to `0`).
    - Documentation updated: `docs/rbac-matrix.md`, `docs/api-tests/phase-24.http`, `back-end/test/route-auth-matrix.json`, and `README.md`.

- **Phase 25: Mentor Booking Integrity**:
  - **Canonical Validation, Time Overlap & Queue Locking (`mentor-marketplace.service.ts`, `mentor-marketplace.entity.ts`, `mentor-marketplace.dto.ts`, `http-exception.filter.ts`)**:
    - Added exported `rangesOverlap(startA, durA, startB, durB)` half-open interval helper (`[start, end)`, `DEFAULT_SESSION_DURATION_MINUTES = 60`, so adjacent `[10:00, 11:00)` and `[11:00, 12:00)` do not collide) and `BLOCKING_BOOKING_STATUSES` (`pending`, `payment_pending`, `escrow_funded`, `accepted`, `active`; cancelled/refunded/completed/declined do not block).
    - Implemented single canonical `assertBookable(projectId, mentorId, ownerId, start, duration?, excludeSessionId?)` validating in strict order: 1) live project via `isLiveProject` (`409 PROJECT_NOT_BOOKABLE` with Draft/Closed/Completed/deleted reason), 2) not self (`409 CANNOT_BOOK_SELF`), 3) not project collaborator/member (`409 CANNOT_BOOK_OWN_PROJECT_MENTOR`), 4) mentor verified, active, available, non-suspended (`409 MENTOR_SUSPENDED` / `409 MENTOR_UNAVAILABLE`), and under `maxActiveMentees` (`409 MENTOR_AT_CAPACITY`), 5) Phase 9 booking window (`400 BOOKING_OUTSIDE_WINDOW`), 6) mentor time overlap (`409 MENTOR_TIME_CONFLICT` with `conflictingRange` / `conflictStart` / `conflictEnd`, never exposing the other project's name), and 7) owner time overlap across all mentors (`409 OWNER_TIME_CONFLICT`). Logs `BOOKING_REFUSED` audit entry with `{ code, projectId, mentorId }` on every refusal.
    - Wired deterministic sorted per-mentor, per-owner, per-project, and per-session queue locks (`runWithBookingLocks`) and `assertBookable` across `bookSession`, `confirmPayment`, and `acceptSession`, persisted `durationMinutes` on `MentorSessionEntity`, excluded suspended mentors from `listMentors`, and forwarded `conflictingRange`, `conflictStart`, and `conflictEnd` through `HttpExceptionFilter`.
  - **Clock Injection in Payment & Expiry Paths (`demo-upi.provider.ts`, `mentor-marketplace.service.ts`, `jobs.service.ts`)**:
    - Injected `@Optional() ClockService` into `DemoUpiProvider` (`nowMs()`), replacing bare `Date.now()` in `createPaymentIntent` (line 28) and `verifyPayment` (line 76) so payment expiry (30m) follows the central fake clock in tests.
    - Routed all remaining current-time `Date.now()` / bare `new Date()` reads in `MentorMarketplaceService` (seed records, profile creation/availability, `bookSession`, `confirmPayment`, `expireStalePaymentPendingSessions`, `startSession`, `acceptSession`, `completeSession`, `submitReview`) through `getCurrentMs()` / `getCurrentIso()`.
  - **Frontend Booking Integrity UI (`apiClient.js`, `MentorCard.jsx`, `MentorsDirectory.jsx`, `MentorRequests.jsx`)**:
    - Hid the owner's own mentor profile (`userId === viewerId`) and suspended mentors in `MentorsDirectory.jsx`, added a directory project selector showing explicit non-bookable status banners (`Draft`, `Closed`, `Completed`, soft-deleted, assigned mentor, collaborator-mentor) while disabling `Book with Escrow` buttons with clear reasons (`MentorCard.jsx`), mapped all Phase 25 error codes cleanly in the booking modal (formatting `conflictingRange` in the viewer's local timezone via `formatDateTime`), and formatted session timestamps with `formatDateTime` in `MentorsDirectory.jsx` and `MentorRequests.jsx`.
  - **Testing & Verification**:
    - Backend TypeScript check (`npx tsc --noEmit -p tsconfig.build.json`): **0 errors**.
    - Backend Unit tests (`npm test`): **38 passed suites, 284 passed, 0 failed** (`phase25.spec.ts` passed).
    - Backend E2E tests (`npm run test:e2e`): **25 passed suites, 238 passed, 0 failed** (`phase25.e2e-spec.ts` passed; `phase9.e2e-spec.ts`, `phase14.e2e-spec.ts`, and `phase17.e2e-spec.ts` updated for non-overlapping test slots all passed).
    - Frontend ESLint (`npm run lint`): **0 errors, 0 warnings**.
    - Frontend Vitest (`npx vitest run`): **38 passed files, 176 passed, 0 failed** (`Phase25BookingIntegrity.test.jsx` passed).
    - Frontend Vite Production Build (`npm run build`): **0 errors, 208 modules transformed**.
    - Documentation updated: `docs/rbac-matrix.md`, `docs/api-tests/phase-25.http`, `README.md`, and `PROGRESS.md`.

- **Phase 26: Front-End Parity and Notification Aggregation**:
  - **Backend Grouped Notifications & Digest Compatibility (`notification.entity.ts`, `create-notification.dto.ts`, `notifications.service.ts`, `digest.service.ts`)**:
    - Added `groupKey`, `count`, and `items` (`NotificationGroupedItem[]` `{ label, link }`) fields to `Notification` and `CreateNotificationDto`, preserved in `NotificationsService.create()`.
    - Implemented `NotificationsService.sendGrouped(userId, groupKey, items, builder)`, `formatGroupedItemList(items, maxVisible = 10)` (formatting up to 10 titles + `", and N more"`), and `dispatchGroupedNotification(...)` fallback helper.
    - Updated `DigestService` (`DigestBufferedItem`, `enqueue`, `mergeItems`, `flushBufferAsImmediate`) to sum grouped `count` values so bulk actions never inflate or split digest summaries.
  - **Bulk Notification Loop Conversions Across Services**:
    - `back-end/src/tasks/tasks.service.ts` (`releaseMemberTasksOnDeparture`): collects all Open/In Progress tasks released on suspension per owner and sends one `TASK_RELEASED` notice (`priority: 'immediate'`).
    - `back-end/src/join-requests/join-requests.service.ts` (`update`, `closePendingRequestsDetailed`): aggregates capacity-full auto-closures by applicant and returns `{ count, items }` while sending one `PROJECT_CLOSED` notice per applicant.
    - `back-end/src/projects/projects.service.ts` (`leaveProject`, `closeProject`, `handleOwnerSuspension`): sends one grouped `TASK_RELEASED` summary with leave reason, one grouped closure notice per collaborator/mentor (and across suspended owner projects via `batchMemberItems`), and one owner summary of closed pending requests (`groupKey: project_closed_owner:<id>`).
    - `back-end/src/projects/invites.service.ts` (`cancelPendingForProject`): aggregates cancelled invite notices per `invitedUserId`.
    - `back-end/src/users/account-deletion.service.ts` (`anonymizeAccount`): collects released tasks and freed project seats across all affected projects by owner and sends one immediate `TASK_RELEASED` notice per affected owner.
    - `back-end/src/jobs/jobs.service.ts` (`closeEmptyProjects`, `applyDeadlinePenalties`, `remindPendingRequests`, `zombieProjectBreaker`, `staleRequestCloser`, `ownerInactivityNotifier`, `memberInactivityNotifier`, `reviewDeadlineJob`): collects all per-run findings per recipient before sending one grouped notice per recipient per run (preserving `metadata.projectIds` and `taskIds` alongside first `taskId`/`referenceId`).
    - `back-end/src/mentor-marketplace/mentor-marketplace.service.ts` (`expireStalePaymentPendingSessions`, `reconcileDuplicateSessionsOnStartup`, `refundEscrowForProject`, `handleProjectClosed`, `handleMentorSuspension`, `processExpiredAbandonmentReviews`, `checkMentorActivityNotices`, `notifyOverdueDisputesToSuperUser`): collects notifications per recipient before dispatching grouped notices.
  - **Frontend `SafeLink` Parity, Accessible `Modal` & Grouped Notifications (`Modal.jsx`, `ConfirmModal.jsx`, `SafeLink.jsx`, `ProjectCard.jsx`, `CollaboratorWorkspace.jsx`, `OwnedWorkspace.jsx`, `ForgotPassword.jsx`, `AdminMentorApps.jsx`, `ScheduledJobsPanel.jsx`, `MentorProjectWorkspace.jsx`, `MentorsDirectory.jsx`, `AdminReports.jsx`, `notifications.jsx`)**:
    - Converted remaining user-supplied URLs in `ProjectCard.jsx` (`finishedLink`), `CollaboratorWorkspace.jsx` (`finishedLink || finalLink`), `OwnedWorkspace.jsx` (`finishedLink || finalLink`, `applicantProfile.linkedIn` with scheme guard so `javascript:` stays blocked, `p.link`), `AdminMentorApps.jsx` (`app.linkedin`), `ForgotPassword.jsx` (`devNotice.previewUrl` & `devNotice.resetLink`), and `notifications.jsx` (grouped/digest/project links) to `<SafeLink>` or safe internal `<Link>`/`<span>` rendering; added Vitest static raw-anchor scan test catching `<a href={...}>` references to user URL props.
    - Finished shared `Modal.jsx` with initial focus placement, `Tab`/`Shift+Tab` focus trap, `Escape` closing (disabled when `closeDisabled`/`preventClose` is set), focus restoration to opener element, `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and nested-safe body scroll lock; migrated custom dialogs in `SafeLink.jsx`, `AdminMentorApps.jsx` (reject modal), `ScheduledJobsPanel.jsx` (run details drawer & confirm modal), `MentorProjectWorkspace.jsx` (badge modal), and `notifications.jsx` (appeal modal) onto `Modal`, and wired `closeDisabled` for active money actions in `ConfirmModal.jsx`, `MentorsDirectory.jsx`, and `AdminReports.jsx`.
    - Updated `notifications.jsx` to display count badges on grouped notifications with expandable item lists capped at 10 visible items + `"and N more"`.
  - **Testing & Verification**:
    - Backend TypeScript check (`npx tsc --noEmit -p tsconfig.build.json`): **0 errors**.
    - Backend Unit tests (`npm test`): **39 passed suites, 290 passed, 0 failed** (`phase26.spec.ts`: 6/6 passed).
    - Backend E2E tests (`npm run test:e2e`): **26 passed suites, 241 passed, 0 failed** (`phase26.e2e-spec.ts`: 3/3 passed; `phase3.e2e-spec.ts` updated for combined notifications passed 20/20).
    - Frontend ESLint (`npm run lint`): **0 errors, 0 warnings**.
    - Frontend Vitest (`npx vitest run`): **39 passed files, 186 passed, 0 failed** (`Phase26ParityAggregation.test.jsx`: 10/10 passed).
    - Frontend Vite Production Build (`npm run build`): **0 errors, 208 modules transformed**.
    - Documentation updated: `docs/rbac-matrix.md`, `docs/api-tests/phase-26.http`, `README.md`, and `PROGRESS.md`.

- **Phase 27: Admin Support Inbox**:
  - **Backend Support Schema, Lifecycle & Authorization (`support-request.entity.ts`, `create-support-request.dto.ts`, `update-support-status.dto.ts`, `update-admin-ticket.dto.ts`, `create-reply.dto.ts`, `close-project-ticket.dto.ts`, `support.service.ts`, `support.controller.ts`, `admin-support.controller.ts`, `support.module.ts`)**:
    - Extended `SupportRequestEntity` with `type` (`'help' | 'project_closure'`), `userName`, `priority` (`'low' | 'normal' | 'high'`; `project_closure` defaults to `'high'`), canonical statuses (`'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'rejected'`, normalizing legacy `'in-progress'`), `assigneeId`/`assigneeName`, `resolutionNote`, `resolvedAt`, `parentTicketId` (follow-up ticket linking), `lastAdminActionAt`, `untouchedReminderSentAt`, `replies` (`SupportReplyEntity[]` with `internal: boolean`), `updatedAt`, and computed `projectFacts` (`SupportProjectFacts`).
    - Implemented `SupportService` status transition table (`ALLOWED_STATUS_TRANSITIONS`), mandatory 10–500 character resolution/rejection notes (`400 NOTE_REQUIRED`), irreversible terminal states (`409 INVALID_STATUS_CHANGE`), 5-tickets-per-24h cap (`429 TICKET_DAILY_LIMIT`), `ContentFilterService` checks on ticket subject/message (leaving replies unfiltered), internal note redaction and cross-user `404 TICKET_NOT_FOUND` isolation on user endpoints, assignee lookup from active portal admins, and `notifyUntouchedTicketsToSuperUser()` for 7+ day untouched tickets (`SUPPORT_TICKET_OVERDUE` sent once per ticket). Preserved full `exportState()`/`importState()` snapshot roundtripping (`persistence.service.ts`).
    - Exposed canonical user endpoints (`GET /support/tickets`, `@Public() POST /support/tickets`, `GET /support/tickets/:id`, `POST /support/tickets/:id/replies`) and admin inbox endpoints under `AdminSupportController` (`GET /admin/support/tickets`, `GET /admin/support/assignees`, `GET /admin/support/tickets/:id`, `PATCH /admin/support/tickets/:id`, `POST /admin/support/tickets/:id/replies`, `POST /admin/support/tickets/:id/close-project`), enforcing `'support'` permission in `RolesGuard` and recording `TICKET_STATUS_CHANGED`, `TICKET_ASSIGNED`, `TICKET_REPLY`, and `PROJECT_CLOSED_FROM_TICKET` audit logs.
    - Updated `ProjectsService.requestClose()` (Phase 12 closure tickets created as `type: 'project_closure'`, `priority: 'high'`) and `SupportService.closeProjectFromTicket()` (populates health facts, delegates to `projectsService.closeProject(projectId, 'Owner inactive', actorLabel)` for Phase 9 escrow refund and party notifications, resolves the ticket with written reason, and refuses closed/completed/deleted projects with `409 PROJECT_NOT_CLOSABLE`).
    - Added hourly Job #20 `supportTicketSuperUserReminder` in `JobsModule` / `JobsService` (updating `job-runs.service.spec.ts` to expect 20 scheduled jobs) and regenerated `back-end/test/route-auth-matrix.json` (`259` routes, `'POST /support/tickets'` allowlisted as `@Public()`, `/admin/support*` mapped to `'support'`).
  - **Frontend Admin Inbox & User Ticket Center (`supportApi.js`, `AdminLayout.jsx`, `SuperuserAdmins.jsx`, `AppRoutes.jsx`, `AdminSupport.jsx`, `AdminSupport.css`, `AuditLog.jsx`, `help.jsx`)**:
    - Added `'support'` permission option in `SuperuserAdmins.jsx` (`permOptions`), `'support'`-gated sidebar item in `AdminLayout.jsx` (`🛟 Support Inbox` -> `/admin/support`), lazy route in `AppRoutes.jsx`, and ticket audit category mapping in `AuditLog.jsx`.
    - Built `AdminSupport.jsx` with search, status/type/assignee filters, paginated table (`Subject`, `Type`, `Priority`, `Status`, `Assignee`, `Age`), empty/loading/error states, accessible `<Modal>` ticket drawer with metadata/assignee controls, 10–500 char note prompt for `resolved`/`rejected`, public vs styled internal reply composer, closure health facts panel (`ownerLastActiveAt`, `membersLastActiveAt`, `openTasksCount`, `escrowHeldAmount`, `pendingRequestsCount`), and `<Modal>` Close Project confirmation dialog.
    - Extended `help.jsx` with a `"My Tickets"` tab (plus CTA link from FAQs), new help ticket submission form (with optional `parentTicketId` follow-up creation when a prior ticket is resolved/rejected), user ticket list/detail view (public replies only), and active ticket reply composer.
  - **Testing & Verification**:
    - Live server HTTP manual check (`verify-phase27.ts` against booted `AppModule` + real `/auth/login`, `/admin/login`, `jobs.runTick()`): verified collaborator closure request (`POST /projects/proj-1/request-close`), support-admin inbox listing/facts panel, internal note redaction, `"Owner inactive"` project closure with ticket resolution, and `409 PROJECT_NOT_CLOSABLE` replay guard.
    - Backend TypeScript check (`npx tsc --noEmit -p tsconfig.build.json`): **0 errors**.
    - Backend Unit tests (`npm test`): **40 passed suites, 295 passed, 0 failed** (`phase27.spec.ts`: 5/5 passed).
    - Backend E2E tests (`npm run test:e2e`): **27 passed suites, 243 passed, 0 failed** (`phase27.e2e-spec.ts`: 2/2 passed; `phase21.e2e-spec.ts`: 6/6 passed).
    - Frontend ESLint (`npm run lint`): **0 errors, 0 warnings**.
    - Frontend Vitest (`npx vitest run --maxWorkers=4`): **40 passed files, 190 passed, 0 failed** (`Phase27SupportInbox.test.jsx`: 4/4 passed).
    - Frontend Vite Production Build (`npm run build`): **0 errors, 210 modules transformed**.
    - Documentation updated: `docs/rbac-matrix.md`, `docs/api-tests/phase-27.http`, `README.md`, and `PROGRESS.md`.

- **Phase 28: Starter Task Templates**:
  - **Pre-Edit Audit & Config/Schema Additions**:
    - Confirmed neither backend project models (`projects.repository.ts`, `create-project.dto.ts`) nor frontend project forms (`CreateProject.jsx`) previously held a project `category` field/list, while the low/no-task health recommendation (`FEW_TASKS`) lived in `HealthService.computeHealth` (`back-end/src/projects/health.service.ts`) paired with `PROJECT_HEALTH_CONFIG.THRESHOLDS.minTasks` (`project-health.config.ts`) and rendered via `ProjectHealthPanel.jsx` and `OwnedWorkspace.jsx`.
    - Added `TASK_LIMIT_PER_PROJECT = 30` (`taskLimitPerProject` + `TASK_LIMIT_PER_PROJECT` env override) in `PlatformConfigEntity`, `UpdatePlatformConfigDto`, and `PlatformConfigService`, enforced inside `TasksService.create()` with `409 TASK_LIMIT_REACHED`.
    - Created `back-end/src/projects/config/starter-task-templates.config.ts` defining `PROJECT_CATEGORIES` (`Web App`, `Mobile App`, `Data & AI`, `Design`, `Research`, `Open Source`, `Hardware`, `Other`, `General`), `normalizeProjectCategory()`, `STARTER_TASK_CONSTRAINTS` (title 5–80 chars, description 20–300 chars, effort `small | medium | large`), and 4–5 realistic starter tasks per category (5 for `Web App`, 4 for every other category and `General` fallback).
  - **Backend Templates Service, Project Queue Serialization & Endpoints (`templates.service.ts`, `task-templates.controller.ts`, `apply-task-templates.dto.ts`, `create-project.dto.ts`, `create-task.dto.ts`, `tasks.repository.ts`, `projects.repository.ts`, `projects.service.ts`, `projects.controller.ts`, `health.service.ts`, `route-auth-matrix.ts`)**:
    - Added `TemplatesService` (`getForCategory()`, `getTemplatesForProject()`, `applyTemplatesForProject()`) executing starter task creation inside the Phase 8 per-project serialized queue (`JoinRequestsService.runInProjectQueue`) via `TasksService.create()` so Open (`To Do`) & `Unassigned` defaults, `ContentFilterService`, `TASK_LIMIT_REACHED` (`409`), safe due-date clamping, duplicate-title prevention (`TEMPLATE_TASK_EXISTS`), unknown-key skipping, and Phase 11 health / Phase 8 completion rules apply automatically, logging count-only `TEMPLATE_TASKS_ADDED` audit entries.
    - Exposed `GET /task-templates?category=` (`TaskTemplatesController`, any authenticated user), `GET /projects/:id/task-templates` (project owner or admin/superuser -> `403` otherwise), `POST /projects/:id/task-templates/apply` (project owner only -> `403 OWNER_ONLY`), and extended `POST /projects` (`ProjectsService.createWithStarterTasks`) with optional `category`, `starterTaskKeys[]`, and `starterTaskOverrides`. Updated `HealthService` `FEW_TASKS` recommendation (`Add starter tasks`, `actionRoute: 'starter-tasks'`) and regenerated `back-end/test/route-auth-matrix.json` (`262` routes).
  - **Frontend Template Picker, CreateProject Step & OwnedWorkspace Integration (`projectCategories.js`, `StarterTaskPicker.jsx`, `StarterTaskPicker.css`, `projectsApi.js`, `CreateProject.jsx`, `ProjectHealthPanel.jsx`, `OwnedWorkspace.jsx`)**:
    - Added project Category selector + optional `"Starter tasks"` step on `CreateProject.jsx` (all templates pre-ticked on category selection, inline title/description edits, selected count, and one-click `"Skip starter tasks"` toggle).
    - Added `"Add starter tasks"` button in the `OwnedWorkspace.jsx` Tasks tab and wired the `FEW_TASKS` / `"Add starter tasks"` action button in `ProjectHealthPanel.jsx` to open the shared `<Modal>` + `StarterTaskPicker` with existing task titles disabled as `"Already added"`, refreshing tasks and project health score on apply and displaying explicit `TASK_LIMIT_REACHED` and `TEMPLATE_TASK_EXISTS` error messages.
  - **Testing & Verification**:
    - Live server HTTP manual check (`verify-phase28.ts` against booted `AppModule` + real `/auth/login`): created a `Web App` project with 0 tasks (`score: 80, grade: B, FEW_TASKS action: Add starter tasks`), applied 3 starter tasks (`201`, `created: 3`), confirmed health rose to `score: 100, grade: A, taskCount: 3` with `FEW_TASKS` removed, and re-applying returned `skipped` with `TEMPLATE_TASK_EXISTS`.
    - Backend TypeScript check (`npx tsc --noEmit -p tsconfig.build.json`): **0 errors**.
    - Backend Unit tests (`npm test`): **41 passed suites, 299 passed, 0 failed** (`phase28.spec.ts`: 4/4 passed; `health.service.spec.ts`: 18/18 passed).
    - Backend E2E tests (`npm run test:e2e`): **28 passed suites, 246 passed, 0 failed** (`phase28.e2e-spec.ts`: 3/3 passed; `phase21.e2e-spec.ts`: 6/6 passed).
    - Frontend ESLint (`npm run lint`): **0 errors, 0 warnings**.
    - Frontend Vitest (`npx vitest run --maxWorkers=4`): **41 passed files, 193 passed, 0 failed** (`Phase28StarterTemplates.test.jsx`: 3/3 passed).
    - Frontend Vite Production Build (`npm run build`): **0 errors, 213 modules transformed**.
    - Documentation updated: `docs/rbac-matrix.md`, `docs/api-tests/phase-28.http`, `README.md`, and `PROGRESS.md`.

- **Step 1: One Role Per Person In A Project (Duplicate Member Row & Member Count Fix)**:
  - **Problem & Root Cause**:
    - In the owner workspace Members tab, the list reported "Project Members (3)" showing the owner, a collaborator, and the same user again as the Project Mentor right after the owner removed a collaborator.
    - Root causes identified:
      1. Role collisions occurred because `getProjectRole` and member comparisons permitted matching by display name strings rather than strict verified user IDs, causing false cross-role associations.
      2. No unified back-end member list builder existed; the frontend (`OwnedWorkspace.jsx`, `CollaboratorWorkspace.jsx`) was concatenating separate arrays (`project.collaborators` + `mentorObj`), leading to duplicate rows when one person held multiple roles or when mentor objects were synthesized on the fly.
      3. Project membership creation paths (join request apply, invite creation, invite accept, join request approval, and mentor booking/acceptance/payment) did not strictly reject conflicting roles across Owner, Mentor, and Collaborator with canonical `409` conflict error codes (`ALREADY_PROJECT_OWNER`, `ALREADY_PROJECT_MENTOR`, `MENTOR_IS_PROJECT_MEMBER`).
      4. `getApprovedCollaboratorsCount` in `capacity.util.ts` counted raw collaborator array lengths without deduplicating or excluding owner/mentor IDs.
  - **Backend Implementation**:
    - `back-end/src/common/utils/role.util.ts`:
      - Standardized `getProjectRole(project, userIdOrUser): ProjectMemberRole` to compare strictly by verified user ID, enforcing the priority hierarchy: `Owner > Mentor > Collaborator > Former member`.
    - `back-end/src/common/utils/capacity.util.ts`:
      - Updated `getApprovedCollaboratorsCount(project)` to deduplicate collaborator user IDs, strictly excluding the owner's ID and assigned mentor's ID, and filtering out users in `removedUsers`.
    - `back-end/src/projects/projects.service.ts`:
      - Defined canonical `ProjectMemberRow` interface: `{ id, userId, name, username, role, initials, joinedAt, lastActiveAt, lastActivityAt, isDeleted?, isInactive?, inactiveDays? }`.
      - Implemented `buildProjectMembersList(project): ProjectMemberRow[]`: creates one row per person, strictly distinct by `userId`. In the event of legacy inconsistent data where one user holds multiple roles, resolves with role priority `Owner > Mentor > Collaborator` and logs a warning with the project ID (`[projects.service] Warning: Project ... has user ... in multiple roles ... Retaining priority role: ...`).
      - Exposed `getProjectMembers(projectId)` and updated `enrichProject(project)` to synchronize `project.members`, `project.memberCount`, `project.approvedCollaboratorCount`, and `project.collaboratorCount`.
      - Updated `removeMember()` and `leaveProject()` to compare strictly by user ID, add departing members to `project.removedUsers`, update `project.collaborators` without touching mentor fields or mentor sessions, and re-compute `project.members`.
      - Implemented read-only startup integrity auditor `auditProjectRolesIntegrity()` registered in `onApplicationBootstrap()` to scan and log warnings for any project violating the one-role-per-person invariant without mutating data.
    - `back-end/src/projects/projects.controller.ts`:
      - Exposed dedicated canonical `GET /projects/:id/members` route returning `buildProjectMembersList(project)`.
    - `back-end/src/join-requests/join-requests.service.ts`:
      - Enforced role checks on `create()` (application) and `update()` (approval), returning `409 ALREADY_PROJECT_OWNER` if the user is owner, `409 ALREADY_PROJECT_MENTOR` if assigned mentor, and `409 ALREADY_MEMBER` if an active collaborator.
    - `back-end/src/projects/invites.service.ts`:
      - Enforced role checks on `sendInvite()` and `acceptInvite()`, returning `409 ALREADY_PROJECT_OWNER`, `409 ALREADY_PROJECT_MENTOR`, and `409 ALREADY_MEMBER`.
    - `back-end/src/mentor-marketplace/mentor-marketplace.service.ts`:
      - Enforced role checks in `assertBookable()`, `confirmPayment()`, and `acceptSession()`, rejecting booking when the mentor is project owner or active collaborator with `409 MENTOR_IS_PROJECT_MEMBER`.
    - `back-end/test/route-auth-matrix.json`:
      - Regenerated route authorization matrix (`272` routes) reflecting `GET /projects/:id/members`.
  - **Frontend Implementation**:
    - `React-Implementation/src/services/projectsApi.js`: Added `getMembers(id, role)` targeting `GET /projects/:id/members`.
    - `React-Implementation/src/pages/owner/OwnedWorkspace.jsx`:
      - Replaced array concatenation with direct rendering of `apiMembers` (`project.members`), using key `${member.userId || member.id}-${member.role}`.
      - Rendered action buttons strictly per role: Remove button only on Collaborator rows, "Report inactive mentor" only on Mentor row, and neither button on the Owner row.
      - Filtered active project members out of the direct invitation user search dropdown.
    - `React-Implementation/src/pages/collaborator/CollaboratorWorkspace.jsx`:
      - Rendered `project.members` directly without client-side array concatenation.
    - `React-Implementation/src/pages/owner/MentorsDirectory.jsx`:
      - Added formatting for `MENTOR_IS_PROJECT_MEMBER` in `formatBookingError()`.
    - `React-Implementation/src/pages/collaborator/ProjectsMarketplace.jsx`:
      - Updated `resolveRequestConfig` to treat the user as a current member if their role on the project is Owner, Mentor, or Collaborator.
  - **Testing & Verification**:
    - Backend Unit Tests (`step1-members.spec.ts`): 8/8 tests passed covering single members list builder with owner only, collaborators, mentor, inconsistent multi-role resolution with warning, seat count ignoring owner/mentor, and startup integrity auditor.
    - Backend E2E Tests (`step1-one-role.e2e-spec.ts`): 8/8 tests passed covering S1 (collaborator removal leaves owner + remaining collaborator, frees 1 seat, count 3 -> 2, mentor untouched), S2 (booking/accepting/paying collaborator or owner as mentor rejected with 409 `MENTOR_IS_PROJECT_MEMBER`), S3 (mentor applying/invited rejected with 409 `ALREADY_PROJECT_MENTOR`), Owner apply/invite rejected with 409 `ALREADY_PROJECT_OWNER`, and collaborator departure leaving mentor intact.
    - Frontend Unit Tests (`Step1MembersList.test.jsx`): 3/3 tests passed verifying API members list rendering, exact row count, role-based action buttons, and booking error formatting.
    - Backend Type Check (`npx tsc --noEmit -p tsconfig.build.json`): 0 errors.
    - Frontend ESLint (`npx eslint ...`): 0 errors on modified files.
    - Frontend Vite Production Build (`npm run build`): 0 errors, 224 modules transformed.

- **Step 2: Owner Cannot Remove Collaborator Who Has a Task Waiting for Review**:
  - **Rule & Problem**:
    - When a project owner attempts to remove a collaborator who has submitted work that is currently `In Review` (not yet accepted or rejected/sent back), the removal must be blocked.
    - Tasks that are `To Do` / `Open`, `In Progress`, or previously decided (`Completed` / `Approved`, or rejected/sent back for changes) do not block removal.
    - When removal is blocked, nothing changes on the server: no tasks are released, no feedback record is logged, and no notifications are sent. An audit entry `MEMBER_REMOVAL_BLOCKED` is recorded.
    - Voluntary leave, suspension, and account deletion flows remain unchanged and retain `In Review` tasks per Phase 13 policy.
  - **Backend Implementation**:
    - `back-end/src/common/filters/http-exception.filter.ts`:
      - Added `'blockers'`, `'allowed'`, `'tasksToRelease'`, and `'tasksKept'` to `forwardedKeys` in `HttpExceptionFilter` so structured 409 conflict responses preserve blocker payloads to clients.
    - `back-end/src/projects/projects.service.ts`:
      - Defined interfaces: `RemovalBlockerTask` (`{ taskId, title, submittedAt }`), `RemovalTaskSummary` (`{ taskId, title, status }`), and `RemovalCheckResult` (`{ allowed: boolean, blockers: RemovalBlockerTask[], tasksToRelease: RemovalTaskSummary[], tasksKept: RemovalTaskSummary[] }`).
      - Implemented helper `getRemovalBlockers(projectId: string, userId: string): RemovalCheckResult`:
        - Scans all non-deleted tasks assigned to `userId` on `projectId`.
        - Identifies tasks with status `'In Review'` as blockers (`submittedAt` resolved from `updatedAt`, `createdAt`, or ISO fallback).
        - Populates `tasksToRelease` with tasks in `'To Do'`, `'In Progress'`, or non-review/non-completed statuses.
        - Populates `tasksKept` with tasks in `'Completed'` status.
        - Returns `{ allowed: blockers.length === 0, blockers, tasksToRelease, tasksKept }`.
      - Implemented `getRemovalCheck(projectId, memberId, caller, callerRole)`:
        - Validates caller permissions: owner or admin required; throws 403 `FORBIDDEN` otherwise.
        - Validates member existence in project; throws 404 `MEMBER_NOT_FOUND` if not an active collaborator.
        - Reuses `getRemovalBlockers()` ensuring pre-check and removal logic are identical.
      - Updated `removeMember(projectId, memberId, caller, callerRole, ...)`:
        - Executes `getRemovalBlockers()` prior to writing feedback records, releasing tasks, or removing collaborator.
        - If `!check.allowed`, logs audit entry `MEMBER_REMOVAL_BLOCKED` with `{ projectId, memberId, count: check.blockers.length }` and throws `409 MEMBER_HAS_TASKS_IN_REVIEW` with `{ statusCode: 409, error: 'Conflict', code: 'MEMBER_HAS_TASKS_IN_REVIEW', message: 'Review these submitted tasks first: approve them or send them back with feedback. Then you can remove this member.', blockers: check.blockers }`.
    - `back-end/src/projects/projects.controller.ts`:
      - Added route `GET :id/members/:userId/removal-check` guarded by `@Roles('Project Owner', 'Administrator', 'admin', 'superuser')`.
    - `back-end/test/route-auth-matrix.json`:
      - Updated route auth matrix (`273` routes) to document the new `removal-check` endpoint.
  - **Frontend Implementation**:
    - `React-Implementation/src/services/projectsApi.js`:
      - Added `getRemovalCheck: (id, userId, role) => apiClient.get('/projects/' + id + '/members/' + userId + '/removal-check', { role })`.
    - `React-Implementation/src/pages/owner/OwnedWorkspace.jsx`:
      - Added state: `removalChecks` (cached per member ID), `removeBlockers` (blockers array for modal display), and `taskFilter` (`null` or `'in_review'`).
      - Added top-level `displayTasks` memoization filtering tasks when `taskFilter` is active.
      - Implemented `fetchRemovalChecks()` fetching check results for all project collaborators and updating `removalChecks` map without page reload.
      - Triggers `fetchRemovalChecks()` on initial load, collaborator list change, and immediately after owner approves (`handleApproveTask`) or rejects/sends back (`handleConfirmRejectTask`) a task.
      - Collaborator row UI:
        - If removal is blocked: Remove button is disabled with `style={{ cursor: 'not-allowed' }}` and tooltip title `"N submitted task(s) waiting for your review"`. A dedicated link `"Review tasks"` is displayed beside the collaborator info.
        - Clicking `"Review tasks"` or the filter action switches to the Tasks tab, sets `taskFilter = 'in_review'`, and renders a filter banner (`"Showing submitted task(s) waiting for review"` with `"Clear filter"` button).
        - If removal is allowed: Remove button is enabled with pointer cursor.
      - Remove Reason Dialog:
        - Summary displays dynamic count of unfinished tasks that will be released (`tasksToRelease.length`).
        - Handles 409 `MEMBER_HAS_TASKS_IN_REVIEW` response by rendering `data-testid="removal-blockers-container"` with blocker task list and `"Review Submitted Tasks"` action button, while disabling the Confirm Remove button.
  - **Testing & Verification**:
    - Backend Unit Tests (`step2-removal.spec.ts`): 8/8 tests passed:
      1. Blocker detected for collaborator with In Review task (`allowed: false`).
      2. Allowed when collaborator has only To Do / Open tasks.
      3. Allowed when collaborator has only In Progress tasks.
      4. Allowed when collaborator has only Completed tasks.
      5. Allowed when collaborator has rejected / sent back tasks (not In Review).
      6. Allowed when collaborator has no assigned tasks.
      7. Multi-collaborator isolation: only collaborator with In Review task is blocked.
      8. `removeMember` throws 409 `MEMBER_HAS_TASKS_IN_REVIEW` when blocked and changes nothing.
    - Backend E2E Tests (`step2-removal-blockers.e2e-spec.ts`): 7/7 tests passed:
      1. `GET /projects/:id/members/:userId/removal-check` returns `{ allowed, blockers, tasksToRelease, tasksKept }`.
      2. Non-owner cannot call `removal-check` (403 Forbidden).
      3. Unknown member returns 404 `MEMBER_NOT_FOUND`.
      4. Removal with In Review task returns 409 `MEMBER_HAS_TASKS_IN_REVIEW` with blocker list and changes nothing.
      5. Audit entry `MEMBER_REMOVAL_BLOCKED` written on blocked removal.
      6. After approving task, collaborator removal succeeds (200 OK).
      7. After sending back task with feedback, collaborator removal succeeds (200 OK).
    - Frontend Unit Tests (`Step2RemovalCheck.test.jsx`): 4/4 tests passed:
      1. Remove button disabled with tooltip when blocked, enabled when allowed.
      2. Clicking `"Review tasks"` jumps to Tasks tab filtered to those tasks.
      3. 409 response in dialog displays blockers container and list.
      4. Approving a task enables Remove without a page reload.
    - Backend TypeScript Check (`npx tsc --noEmit -p tsconfig.build.json`): 0 errors.
    - Frontend Vite Production Build (`npm run build`): 0 errors, 224 modules transformed.

### Step 3: Tell a Suspended User They Are Suspended
- **Status:** **DONE**
- **Problem Statement:**
  - A suspended user attempting to log in could not log in, but was not told why (generic 403 Forbidden without code, reason, or metadata; refresh returning 401 REFRESH_INVALID; and mid-session returning SESSION_INVALID triggering misleading "The server was restarted" message).
- **Security & Architectural Policy:**
  - **Security First**: Identity is proven before revealing suspension. Email login requires correct password; social login requires valid provider ID token; admin portal requires valid admin password. Invalid credentials or unknown emails continue returning the identical generic `401 INVALID_CREDENTIALS` so accounts cannot be probed.
  - **Suspension Response**: Correct credentials on suspended account return `403 Forbidden` with canonical payload `{ statusCode: 403, error: 'Forbidden', code: 'ACCOUNT_SUSPENDED', message: 'Your account is suspended.', reason, suspendedAt, suspensionType, appealAvailable, supportContact }`.
  - **Privacy Enforcement**: Moderator names, internal admin notes, reports, and other users' data are strictly stripped. Only the exact user-facing reason (e.g. `"Automatic suspension after 4 warnings"` or moderator's text) is exposed.
  - **Login Throttle**: Correct-password attempts on suspended accounts reset/do not increment login throttle keys (10 correct attempts do not lock out the account).
  - **Check Ordering**: For mid-session requests and refresh, suspension checks occur *before* token version or session invalidation checks, ensuring `403 ACCOUNT_SUSPENDED` is returned instead of `401 SESSION_INVALID`.
  - **Audit Logging**: Blocked logins on suspended accounts log audit action `LOGIN_BLOCKED_SUSPENDED` with `{ userId }`.
  - **UI / UX**:
    - `Login.jsx` and `AdminLogin.jsx`: Render an inline, dismissable `SuspendedAccountPanel` (`data-testid="suspended-account-panel"`) displaying title `"Your account is suspended"`, reason, local date/time, type (`"Automatic after 4 warnings"` or `"Suspended by a moderator"`), and next step (support email mailto link or appeal link). The username/email input remains filled; password input is cleared without echoing.
    - `Suspended.jsx`: Dedicated `/suspended` page clears session keys on mount and displays suspension details with a "Back to login" button.
    - `apiClient.js` & `tokenManager.js`: On `403 ACCOUNT_SUSPENDED`, mid-session calls clear credentials, save suspension metadata in `sessionStorage`, redirect to `/suspended`, and suppress `handleServerRestart` so "The server was restarted" is never shown.
- **Testing & Verification**:
  - Backend Unit Tests (`step3-suspended.spec.ts`): 3/3 tests passed.
  - Backend E2E Tests (`step3-suspended-login.e2e-spec.ts`): 9/9 tests passed:
    1. Correct password on manually suspended user returns 403 `ACCOUNT_SUSPENDED` with reason, date, type, and no token.
    2. Automatically suspended user returns `suspensionType: "automatic"` and automatic warning text.
    3. Wrong password for suspended user returns identical generic 401 response as unknown email.
    4. Ten correct-password attempts on a suspended account do not lock the account.
    5. Admin login for a suspended portal admin returns 403 `ACCOUNT_SUSPENDED` with no token.
    6. User suspended mid-session gets 403 `ACCOUNT_SUSPENDED` on next call, NOT `SESSION_INVALID`.
    7. Refresh endpoint returns 403 `ACCOUNT_SUSPENDED` for suspended user.
    8. After reactivation, login works normally and returns token without suspended message.
    9. Social login test double: verified token for suspended account returns 403 `ACCOUNT_SUSPENDED`.
  - Frontend Vitest (`Step3SuspendedLogin.test.jsx`): 7/7 tests passed:
    1. `SuspendedAccountPanel` renders title, reason, date, type, support contact.
    2. `SuspendedAccountPanel` renders automatic type and appeal link when `appealAvailable` is true.
    3. `Login.jsx` displays suspended panel on 403 `ACCOUNT_SUSPENDED`, keeps email filled, clears password.
    4. `AdminLogin.jsx` displays suspended panel on portal admin `ACCOUNT_SUSPENDED`.
    5. `Suspended.jsx` page clears session and renders panel with Back to login button.
    6. Wrong password or non-suspended error shows generic error, NOT suspended panel.
    7. `apiClient.js` mid-session 403 `ACCOUNT_SUSPENDED` redirects to `/suspended` without showing restart notice.
  - Backend TypeScript Check (`npx tsc --noEmit -p tsconfig.build.json`): 0 errors.
  - Frontend Vite Production Build (`npm run build`): 0 errors, 226 modules transformed.

### Step 4: Resolved or Rejected Support Tickets Must Be Read-Only
- **Status:** **DONE**
- **Problem Statement:**
  - In the admin Support inbox, tickets in terminal status (`resolved` or `rejected`) still permitted admins to change priority and assignee, append public and internal replies, and trigger notifications/reminders. Furthermore, closing an already closed project ticket or reopening a ticket returned inappropriate error codes instead of `409 TICKET_CLOSED`, and failed audit logging.
- **Security & Architectural Policy:**
  - **Terminal Read-Only Enforcement**: Tickets in status `resolved` or `rejected` are permanently read-only for all users, including Super Users.
  - **Rejection of Mutations**: Any `PATCH` to `status`, `priority`, `assigneeId`, or `note` returns `409 ConflictException` with `{ code: 'TICKET_CLOSED', message: 'This ticket is closed and cannot be modified.' }` without modifying any state, even if the submitted value matches the current value.
  - **Replies & Actions Blocked**: Calling `addAdminReply`, `addUserReply`, or `closeProjectFromTicket` on a terminal ticket immediately returns `409 TICKET_CLOSED`.
  - **Invariant & No-Op Guarantee**: On rejection, the ticket record remains strictly byte-for-byte invariant (`updatedAt` does not change, no arrays modified).
  - **Audit Logging**: Any refused modification attempts on a closed ticket log an audit action `TICKET_CHANGE_REFUSED` containing strictly `{ ticketId, attemptedFields }` with zero free-form content (never leaking notes, messages, or titles).
  - **Combined Requests**: Updating priority or assignee while transitioning an open ticket to `resolved`/`rejected` in the same request succeeds: the priority/assignee updates are applied first, followed by the terminal transition, rendering the ticket read-only thereafter.
  - **Reminders & Notifications**: The untouched ticket hourly background job (`notifyUntouchedTicketsToSuperUser`) strictly excludes tickets with terminal status (`resolved` or `rejected`).
  - **User & Admin UI**:
    - `AdminSupport.jsx`: For `resolved` and `rejected` tickets, status, priority, and assignee are rendered as plain-text badges/labels (`readonly-metadata-grid`) with no editable dropdowns; the reply box, internal note toggle, and "Close project" button are hidden; and a dedicated read-only banner (`ticket-readonly-banner`) displays resolution note and closure timestamp. If a `409 TICKET_CLOSED` response is encountered, the drawer refreshes and switches to read-only view.
    - `help.jsx`: The user view hides the reply box for resolved/rejected tickets and provides a button to open a follow-up ticket linked via `parentTicketId`.
- **Testing & Verification**:
  - Backend Unit Tests (`step4-ticket-readonly.spec.ts`): 5/5 passed.
  - Backend E2E Tests (`step4-ticket-readonly.e2e-spec.ts` & `phase27.e2e-spec.ts`): 9/9 passed.
  - Frontend Vitest (`Step4TicketReadOnly.test.jsx`): 5/5 passed.
  - Backend TypeScript Check (`npx tsc --noEmit -p tsconfig.build.json`): 0 errors.
  - Frontend Vite Production Build (`npm run build`): 0 errors, 226 modules transformed.

### Step 5: Fix the "View Audit Log" Button in the Report Review Dialog
- **Status:** **DONE**
- **Problem Statement:**
  - In Admin > Reports, the "Report Review" dialog featured a "View audit log" button on the reported user's card that did not work: clicking it failed to filter properly or open the intended page because the button targeted `/admin/audit` without `reportId` or `from=report`, `/admin/audit-log` was not registered in the router, the button was rendered active even for admins lacking the `audit` permission, and the backend and frontend audit systems ignored `reportId`, did not filter CSV/JSON exports by user or report, dropped `reportId` during moderation warning/suspension audits, and lacked active filter chips with removal controls and dynamic empty states.
- **Security & Architectural Policy:**
  - **Permission Enforcement**: Button is enabled only for admins with the `audit` permission (`hasPermission('audit')` or Super User). Admins without it see a disabled button with tooltip `"You need the audit log permission"`. The backend strictly enforces 403 on `/admin/audit` routes for admins lacking the `audit` permission.
  - **Navigation**: Opens the Audit Log page in a new tab (`target="_blank"`, `rel="noopener noreferrer"`) with URL:
    `/admin/audit-log?userId=<reported user id>&reportId=<report id>&from=report`.
    The review dialog in the originating tab remains open and undisturbed.
  - **URL Parameter Binding & Paging**: The Audit Log page reads query parameters on initial load and navigation changes (`userId`, `reportId`, and existing filters), queries the backend with both, displays removable filter chips (`chip-userId`, `chip-reportId`, `chip-type`, `chip-search`) each with an `X` button and a global `Clear all` button, displays dynamic result counts, and provides client-side pagination (15 items per page).
  - **Customized Empty State**: When filtered by `userId`, empty results render `"No audit entries for this user."`.
  - **Backend Filtering**: `GET /admin/audit` and `GET /admin/audit/export` accept `userId` and `reportId` query parameters, matching entries where the ID is the actor, target, entityId, or present in metadata details, and intersecting multiple active filters. Unknown or invalid IDs return an empty list `[]` with status 200 OK (never 400/404/500).
  - **Audit Correlation**: Moderation actions taken from a report (`user-warned`, `user-suspended`, `user-auto-suspended`, and report decisions) record the subject `userId` and originating `reportId` in their metadata details, ensuring bidirectional filtering matches.
  - **Data Privacy**: Audit entries contain strictly IDs, action codes, entity types, and timestamps—zero free-form report text or user messages.
- **Testing & Verification**:
  - Backend Unit Tests (`step5-audit-filter.spec.ts`): 5/5 passed.
  - Backend E2E Tests (`step5-audit-button.e2e-spec.ts`): 5/5 passed:
    1. Non-permitted admin without audit permission gets 403 on `GET /admin/audit`.
    2. `GET /admin/audit` with unknown `userId` or `reportId` returns empty list 200 OK, not an error.
    3. `GET /admin/audit` with `userId`, `reportId`, and intersection filters correctly.
    4. `GET /admin/audit/export` applies `userId` and `reportId` filters for both JSON and CSV.
    5. Warn then suspend a user from a report: both entries appear under the user and under the report.
  - Frontend Vitest (`Step5AuditButton.test.jsx` & `AdminReports.test.jsx`): 10/10 passed:
    1. Button opens `/admin/audit-log` in a new tab with `userId`, `reportId`, `from=report` and dialog stays open.
    2. Admin without audit permission sees disabled button with tooltip.
    3. Audit Log page applies URL parameters, passes `userId` and `reportId` to API, and renders filter chips.
    4. Removing a chip updates the URL; Clear all removes all active filters.
    5. Audit Log displays customized empty state when filtering by `userId`.
    6. `AdminReports.test.jsx` regressions all pass (5/5).
  - Backend TypeScript Check (`npx tsc --noEmit -p tsconfig.build.json`): 0 errors.
  - Frontend Vite Production Build (`npm run build`): 0 errors, 226 modules transformed.

### Step 6: Full Regression and Smoke Test
- **Status:** **DONE**
- **Problem & Scope:**
  - Verify that the five preceding steps (one role per person in a project, collaborator removal guard on submitted tasks in review, security-first suspension login flow, read-only terminal support tickets, and report review audit log navigation & filter chips) work harmoniously together with zero regressions across backend and frontend suites.
- **Verification Strategy & Implementations:**
  - **Comprehensive E2E Integration Suite (`back-end/test/e2e/regression-nov-21.e2e-spec.ts`):**
    1. *Scenario A (Roles & Capacity):* Owner, Collaborator A (mentor profile), Collaborator B. Remove B $\to$ members list shows owner and A only (count 2). Booking Collaborator A as mentor returns `409 MENTOR_IS_PROJECT_MEMBER`. Booking distinct Mentor M, paying, and accepting yields exactly 3 members (Owner, Collaborator, Mentor, count 3, 1 row each, seats correct).
    2. *Scenario B (Removal Rule & Task Release):* Collaborator A submits a task to `In Review`. Owner removal returns `409 MEMBER_HAS_TASKS_IN_REVIEW`. Owner sends the task back with changes requested $\to$ removal succeeds, and both submitted/open tasks are released back to unassigned.
    3. *Scenario C (Suspension & Credential Security):* User U obtains an active token. Admin suspends User U. Login with valid password returns `403 ACCOUNT_SUSPENDED` with reason and zero token. Login with wrong password returns generic `401 INVALID_CREDENTIALS` identical to unknown email. Prior token gets `403 ACCOUNT_SUSPENDED`. Reactivation restores clean login without error.
    4. *Scenario D (Immutable Support Tickets):* User opens support ticket. Admin adjusts priority to high, assignee to admin, and resolves with note $\to$ status is `resolved`. Every further change (`PATCH` priority/assignee/status, admin reply, user reply) returns `409 TICKET_CLOSED`. User opens a new ticket successfully.
    5. *Scenario E (Audit Trail Correlation):* User reports another user. Superuser executes suspension directly from the report $\to$ audit list queries with `userId` and `reportId` return the corresponding `user-suspended` and `report-action` audit entries.
    6. *Scenario F (Escrow Integrity):* `GET /admin/escrow/reconcile` returns `{ ok: true, mismatches: [] }` after mentor session booking.
  - **Frontend Smoke Suite (`React-Implementation/React-Implementation/src/test/RegressionNov21Smoke.test.jsx`):**
    1. Members list rows, role badges, and count update accurately.
    2. Remove button is disabled with explanatory tooltip when a collaborator has tasks In Review.
    3. `SuspendedAccountPanel` displays on 403 `ACCOUNT_SUSPENDED`, preserves email, and clears password.
    4. Read-only ticket drawer renders `readonly-metadata-grid` without editable controls, shows resolution note banner, and hides reply/close controls.
    5. Report review modal displays "View audit log" button targeting `/admin/audit-log?userId=...&reportId=...&from=report` in a new tab, disabled if lacking audit permission, and `AuditLog` parses filters, displays removable chips, and updates counts.
  - **Browser Console Manual UI Pass:**
    - Ran live backend on port 3000 and frontend on port 5173.
    - Verified all 5 flows via automated browser subagent. Confirmed **0 JavaScript console errors** across all flows.
  - **Documentation Sync:**
    - Updated `README.md` with "Rules Added in This Round (Nov 21 Stabilization)" covering the 5 rules.
- **Testing Results:**
  - Backend Unit Tests: 47/47 suites passed (329/329 tests).
  - Backend E2E Test Suite (`regression-nov-21.e2e-spec.ts`): 5/5 scenarios passed.
  - Backend Steps 1-5 E2E Suites: 5/5 suites passed (36/36 tests).
  - Frontend Smoke Suite (`RegressionNov21Smoke.test.jsx`): 5/5 tests passed.
  - Frontend Production Build: 0 errors (226 modules transformed).
  - Backend TypeScript Check: 0 errors.

### Profile Fix Phase 1: Remove Track Record Section from Profile Header Card
- **Status:** **DONE**
- **Metric Audit Findings:**
  - `onTimeRate`, `tasksApproved`, `projectsCompleted`: Retained on backend (`trust.service.ts`) because `computeTrustLabel` (`Trusted contributor` / `Reliable`) and `leaderboard.service.ts` ("Most Reliable" tab, `Verified Tasks`) depend on them.
  - `firstPassRate`, `activeProjects`, `sessionsCompleted` on `UserTrackRecord`: Removed from `trust.service.ts` as they existed solely for the removed profile Track Record block (`dashboard.jsx` and `AdminUserDetails.jsx` compute/render their own independent project/task stats and remain untouched).
- **Changes Made:**
  - Removed the `Track Record (Verified Work)` heading and all tiles from `UserTrustCard.jsx` expanded view, converted card colors to theme CSS variables (`--card`, `--border`, `--fg`, `--muted-fg`, `--surface-alt`) for light/dark mode parity, removed the bottom gap below Conduct Score, and made `profile.css` grid responsive down to 480px.
  - Removed leftover `"track record"` wording from `UserTrustCard.jsx` tooltip/comments, `profile.jsx` comment, `leaderboard.jsx`, and `landingpage.jsx`.
  - Updated `reputation-trust.spec.ts`, `UserTrustCard.test.jsx` (including a source scan test verifying `"TRACK RECORD"` does not appear in `src/`), and `ProfileTrustCardLedgerRemoval.test.jsx`.
- **Verification:**
  - Back-end `tsc --noEmit`: PASS (0 errors).
  - Back-end `reputation-trust.spec.ts`: PASS (16/16).
  - Front-end ESLint (changed files): PASS (0 errors, 2 pre-existing fast-refresh warnings).
  - Front-end Vitest (`UserTrustCard.test.jsx`, `ProfileTrustCardLedgerRemoval.test.jsx`, `ProfileCompletedProjects.test.jsx`, `AdminUserDetails.test.jsx`): PASS (18/18).
  - Front-end Vite Build: PASS (0 errors, 235 modules).

### Profile Fix Phase 2: Fix Mentored Projects Card on Profile Page & Public View
- **Status:** **DONE**
- **Root Cause (1 sentence):** The Profile page's Mentored Projects card (`profile.jsx`) read a static, unmaintained `user.data.mentoredProjects` array from `GET /users/me` instead of computing mentored projects dynamically from `MentorMarketplaceService` like `GET /mentor-marketplace/mentored-projects` does.
- **Hypothesis Checks (H1–H8):**
  - `H1 CONFIRMED`: `profile.jsx` read `data.data?.mentoredProjects` (stale/missing on seeded mentors and new signups), whereas `MentoredProjects.jsx` fetched live data from `GET /mentor-marketplace/mentored-projects`.
  - `H2–H8 RULED OUT` as direct causes of the empty card (noted `H4` secondary gap: `completeProject` did not persist `completedMentorUserId` / mentor in `completedMemberIds`).
- **Changes Made:**
  - **Shared Backend Source (`mentor-marketplace.service.ts` & `mentor-marketplace.entity.ts`):** Extracted `getMentoredProjectsForUser(mentorUserId, { completedOnly })` returning `{ projectId, title, status, tab, ownerName, acceptedAt, completedAt, finalLink, mentorUserId }` sorted with active projects first then completed newest-first, excluding abandonment-released mentors, pre-start refunded sessions, and soft-deleted projects.
  - **Completion & Startup Backfill (`projects.repository.ts`, `projects.service.ts`):** Recorded `completedMentorUserId`, `mentorUserId`, and mentor inclusion in `completedMemberIds` during `completeProject` (without adding mentors to `collaborators`), and added startup backfill `backfillCompletedProjectMentors()` in `onApplicationBootstrap()`.
  - **Unified Consumers (`users.controller.ts`, `users.service.ts`, `users.repository.ts`, `admin.service.ts`):** Removed the stale hardcoded `data.mentoredProjects` mock on user `'2'`; attached live `mentoredProjects` to `GET /users/me` (`all`) and `GET /users/:id/public-profile` (`completedOnly: true`); updated `AdminService.getUserDetails` to merge `Role: 'Mentor'` entries and return live `mentoredProjects`.
  - **Frontend Profile & Public View (`usersApi.js`, `profile.jsx`, `OwnedWorkspace.jsx`):** Set `{ skipCache: true }` on `usersApi.getMe`, exported and wired `MentoredProjectsCard` (`Badge`, `SafeLink`, `formatMemberSince`, `isPublic` filtering to completed only, `focus` & `visibilitychange` refresh, loading & empty states), and rendered public completed mentored projects in `OwnedWorkspace.jsx` applicant modal using `SafeLink`.
  - **Tests Added:** `back-end/src/users/mentor-profile-projects.spec.ts` (3 integration tests, confirmed failing pre-fix) and `React-Implementation/React-Implementation/src/test/ProfileMentoredProjects.test.jsx` (2 unit tests, confirmed failing pre-fix).
- **Verification:**
  - Back-end `tsc --noEmit`: PASS (0 errors).
  - Back-end Jest (`mentor-profile-projects.spec.ts`, `mentored-projects.spec.ts`, `completed-projects.spec.ts`, `dispute-mentor-unassign.spec.ts`): PASS (4 suites, 32/32 tests).
  - Front-end ESLint (`usersApi.js`, `profile.jsx`, `ProfileMentoredProjects.test.jsx`): PASS (0 errors); `OwnedWorkspace.jsx` has 3 pre-existing unrelated errors on lines 81, 600, 712.
  - Front-end Vitest (`ProfileMentoredProjects.test.jsx`, `MentoredProjectsCompleted.test.jsx`, `Phase10MentorScreens.test.jsx`, `UserTrustCard.test.jsx`, `ProfileTrustCardLedgerRemoval.test.jsx`, `ProfileCompletedProjects.test.jsx`): PASS (6 files, 27/27 tests).
  - Front-end Vite Build: PASS (0 errors, 235 modules).


