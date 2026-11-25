# Concrete Bugs Identified in TeamForge Codebase (Post-Phase 18 Re-Audit)

**Updated**: November 11, 2026  
This document tracks all confirmed **BUG** items: first summarizing which original Phase 5 bugs are now **DONE / PARTIAL**, followed by **12 newly discovered verified bugs** in the current codebase (`back-end/src` and `React-Implementation/React-Implementation/src`).

---

## Part A: Original Bugs Status (Phase 5 Audit -> Current Code)

| ID | Original Bug | Status | Fixed In | Remaining Note |
|---|---|---|---|---|
| **SEC-01** | Private chat exfiltration via unauthenticated GET | **DONE** | Phase 6 | Active guard `CHAT_MEMBERSHIP_REQUIRED` + `ChatBox.jsx` 403 UI. |
| **JOB-01** | Hourly jobs never trigger in production | **DONE** | Phase 7 | `@Cron(CronExpression.EVERY_HOUR)` + `JobRunsService` + `ScheduledJobsPanel`. |
| **FIN-01** | Escrow refund ignores `pending` / `payment_pending` | **DONE** | Phase 9 | All non-terminal statuses handled idempotently on closure. |
| **MOD-01** | Duplicate moderation report actioning | **DONE** | Phase 8 | Enforces terminal status check (`409 REPORT_ALREADY_ACTIONED`). |
| **MOD-02** | Appeal decision inversion (rejected -> accepted) | **DONE** | Phase 8 | Enforces `appeal.status === 'pending'` (`409 APPEAL_ALREADY_DECIDED`). |
| **PRJ-01** | Zero-task instant project completion | **DONE** | Phase 8 | Throws `400 PROJECT_NO_TASKS` when task count = 0. |
| **COM-01** | Orphaned seed notification store | **DONE** | Phase 8 | Single consolidated store in `NotificationsService`. |
| **SEC-03** | DigiLocker substring name matching bypass | **DONE** | Phase 6 | Token-set equality & honorific stripping in `digilocker-sandbox.provider.ts`. |
| **COL-01** | Join approval concurrency race overfills capacity | **DONE** | Phase 8 | Per-project queue (`runInProjectQueue`) serializes approvals. |
| **AUT-01** | Social incomplete profile URL bypass | **DONE** | Ph 5 & 6 | `403 PROFILE_INCOMPLETE` in `AuthGuard` + React redirect. |
| **SEC-02** | Proof & profile URI `javascript:` XSS | **PARTIAL** | Phase 6 | Backend `assertSafeHttpUrl` + `<SafeLink>` in `TaskCard`/`profile.jsx` done; **6 raw `<a href>` instances + SVG avatar XSS remain**. |

---

## Part B: 12 Newly Discovered Bugs (Verified in Live Code)

### 1. Unauthenticated Privileged User Creation (`POST /users`) & Passwordless Login (`POST /users/login`) — `SEC-05` (**Critical**)
- **Evidence**: `back-end/src/users/users.controller.ts:48-62`, `create-user.dto.ts:30-32, 80-83`, `users.service.ts:150-192, 523-583`.
- **Root Cause**: `@Public() POST /users` binds directly to `CreateUserDto` allowing `role: 'Super User'`/`'Administrator'` and `emailVerified: true`; `@Public() POST /users/login` only checks password inside `if (credentials.password) { ... }` (`users.service.ts:180`), returning `toSafeUser(user)` if password is omitted.
- **Minimal Fix**: Restrict `POST /users` to `@Roles('superuser')`; require non-empty password + rate limit on `/users/login` (or disable outside `AUTH_MODE=legacy`).

### 2. Mass Assignment Privilege Escalation (`PATCH /users/:id`) & Unscoped Delete (`DELETE /users/:id`) — `SEC-06` (**Critical**)
- **Evidence**: `back-end/src/users/dto/update-user.dto.ts:4-7`, `users.controller.ts:508-542`, `users.service.ts:585-695`.
- **Root Cause**: `UpdateUserDto extends PartialType(CreateUserDto)` inherits `role`, `status`, `emailVerified`, `flags`, and arbitrary `profile: Record<string, any>`; `users.service.ts:667` only deletes `phoneVerified*`. Meanwhile `DELETE /users/:id` allows Collaborators to delete ANY user ID with zero ownership or obligation checks.
- **Minimal Fix**: Replace `UpdateUserDto` with strict field allowlist (`name`, `bio`, `skills`, `university`, `linkedIn`, `portfolio`, `website`); reset `emailVerified = false` on email change; lock `DELETE /users/:id` to `@Roles('superuser')`.

### 3. Dual Reputation Ledger Split-Brain & Startup Seed Double-Counting — `DAT-01` (**Critical**)
- **Evidence**: `back-end/src/moderation/reputation.service.ts:20-50, 158-174`, `gamification.service.ts:237-262`, `gamification.repository.ts:30-75`, `tasks.service.ts:692`, `users.service.ts:322, 567, 807`.
- **Root Cause**: `ReputationService.backfillStartupSeedUsers()` calls `recordSeed(uid, rep)` -> pushes duplicate seed rep into `GamificationRepository` even though `GamificationRepository.initSeeds()` already initialized seed entries (doubling Arjun's rep `87 -> 174` on Leaderboard!). Simultaneously, new signups (`+100`), task approvals (`+8`), and completion badges (`+15`) write ONLY to `GamificationRepository`, leaving `ReputationService.getReputation()` and `GET /users/me/reputation` completely stale.
- **Minimal Fix**: Unify onto one ledger repository with single-write routing and remove redundant startup backfill.

### 4. Snapshot Persistence Omits `EscrowService`, `PlatformConfig`, `PortalAdmins`, `MentorApps` & `DemoUpiProvider` — `DUR-01` (**Critical**)
- **Evidence**: `back-end/src/persistence/persistence.service.ts:73-94, 179-207`, `escrow.service.ts:6`, `mentor-applications.service.ts:26`, `platform-config.service.ts:6`, `demo-upi.provider.ts:9-10`.
- **Root Cause**: `PersistenceService` restores `sessions` containing `escrowId`, while `EscrowService` restarts empty—causing `release()`, `refund()`, and `freezeForDispute()` to fail with `NotFoundException('Escrow not found')`. Runtime mentor apps, raised minimum tenure, dynamic portal admins, payment idempotency records, and job run logs are similarly lost.
- **Minimal Fix**: Add `exportState()`/`importState()` to those services and register them in `PersistenceService`.

### 5. Cross-User PII & Warning Leak via `GET /users` and `GET /users/:id` — `SEC-07` (**High**)
- **Evidence**: `back-end/src/users/users.controller.ts:427-432, 500-506`.
- **Root Cause**: Endpoints return full `toSafeUser()` (including `email`, `phone`, `warnings`) to any signed-in user, bypassing `/users/:id/public-profile`.
- **Minimal Fix**: Restrict `GET /users` to `@Roles('admin', 'superuser')` and `GET /users/:id` to self or admin/superuser.

### 6. Cross-Project Task Injection, Unauthorized Deletion & Unfiltered Comments — `SEC-08` (**High**)
- **Evidence**: `back-end/src/tasks/tasks.controller.ts:30-44, 150-180`, `tasks.service.ts:456-535, 1489-1526`.
- **Root Cause**: `POST /tasks`, `DELETE /tasks/:id`, and `POST /tasks/:id/comments` perform zero check that `callerUserId` owns or belongs to `projectId`.
- **Minimal Fix**: Require `isProjectOwner` on `POST /tasks` and `DELETE /tasks/:id` (protecting `Completed` tasks); require `isProjectMember` + `ContentFilterService` on `POST /tasks/:id/comments`.

### 7. Notification IDOR Read/Delete & Fake Notification Forgery — `SEC-09` (**High**)
- **Evidence**: `back-end/src/notifications/notifications.controller.ts:74-197`.
- **Root Cause**: `GET :id`, `PUT :id/read`, `PATCH :id`, `DELETE :id` omit `notification.userId === callerId` checks, and `POST /notifications` grants role `'user'` permission to inject alerts into arbitrary user feeds.
- **Minimal Fix**: Restrict `POST /notifications` and global `GET /notifications` to admin/superuser; enforce owner check on single-item operations.

### 8. Stored XSS via SVG Uploads & Missing `'mentor_apps'` Admin Permission on CV Downloads — `SEC-10` (**High**)
- **Evidence**: `back-end/src/core/middleware/file-upload.middleware.ts:62-68`, `uploads.controller.ts:102, 165-280`.
- **Root Cause**: `IMAGE_MIMES` allows `'image/svg+xml'` without sanitization or magic bytes; `UploadsController` only checks `['admin', 'superuser']` for CV download/delete without checking `'mentor_apps'` permission.
- **Minimal Fix**: Drop `image/svg+xml`, check PNG/JPEG/GIF/WebP magic bytes, and verify `'mentor_apps'` permission for non-superuser admins.

### 9. Legacy Parallel Controllers Bypass Phases 2–16 Policies — `SEC-11` (**High**)
- **Evidence**: `back-end/src/governance/governance.controller.ts:14-54`, `governance.service.ts:57`, `mentorship.controller.ts:14-47`.
- **Root Cause**: Legacy `/governance/reports` & `/mentorship/apply` remain active in `AppModule`, sidestepping daily limits, cooldowns, CV/`DigiLocker` checks, report finality, and reading raw `x-user-id` headers (`GET /mentorship/application`).
- **Minimal Fix**: Retire or delegate legacy endpoints cleanly into `ReportsService` / `MentorApplicationsService` using `@CurrentUser()`.

### 10. Cron Jobs Auto-Close Drafts, Penalize Deleted/Closed Projects & Soft-Delete Cap Bypass — `PRJ-07` (**High**)
- **Evidence**: `back-end/src/jobs/jobs.service.ts:91-95, 274-311, 1384-1414`, `projects.service.ts:652, 2369-2395`.
- **Root Cause**: `closeEmptyProjects` does not skip `Draft` projects; `applyDeadlinePenalties` & `reviewDeadlineJob` do not check `deletedAt`/`Closed` parent projects; `createdInLast24h` ignores soft-deleted projects; `softDeleteProject` skips closing `pending` join requests.
- **Minimal Fix**: Filter out `Draft` and `deletedAt` projects in all cron tasks; include deleted projects in 24h spam window; close pending requests on soft-delete.

### 11. Incomplete Collaborator Cleanup & Orphaned CVs on Account Deletion — `PRJ-08` (**High**)
- **Evidence**: `back-end/src/users/account-deletion.service.ts:92-98, 293-305`, `tasks.repository.ts:272-295`, `data-export.service.ts:230-250, 316-317`.
- **Root Cause**: Deleted collaborators remain in `project.collaborators[]` consuming team capacity, retain `Open`/`In Progress` tasks as `'Deleted user'`, retain CV PDFs in `secure-cvs/`, accept unverified `socialConfirmed: true`, and `cleanExpiredExports` misses pre-restart files on disk.
- **Minimal Fix**: Invoke `releaseMemberTasksOnDeparture`, vacate active team slots, unlink user CVs & scrub mentor apps, and scan disk `EXPORT_DIR`.

### 12. Mentor Self-Booking, Closed/Deleted Project Booking & Time-Slot Collisions — `MEN-06` (**High**)
- **Evidence**: `back-end/src/mentor-marketplace/mentor-marketplace.service.ts:631-730`, `demo-upi.provider.ts:21, 64-69`.
- **Root Cause**: `bookSession` doesn't check `profile.userId === studentId`, allows `Closed`/`Draft`/`deletedAt` projects, doesn't detect overlapping `scheduledAt` + `durationMinutes` sessions, and `DemoUpiProvider` uses raw `Date.now()` while returning `true` if `intents` Map misses post-restart.
- **Minimal Fix**: Reject self-booking (`CANNOT_BOOK_SELF`), inactive/deleted projects, and overlapping mentor schedules; inject `ClockService` into `DemoUpiProvider`.
