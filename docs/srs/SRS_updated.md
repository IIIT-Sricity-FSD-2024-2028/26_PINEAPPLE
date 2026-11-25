# Software Requirements Specification (SRS) - Non-Functional Performance Update

**Project**: TeamForge (26_PINEAPPLE)  
**Date**: November 2026  
**Document Version**: 2.1  
**Scope**: Section 4 - Non-Functional Requirements (Performance, Scalability, and Resource Efficiency)

---

## 1. Purpose & Scope

This specification updates the non-functional performance requirements (NFRs) for the TeamForge platform following the Phase 0–Phase 4 performance benchmarking and optimization audit. It defines measurable criteria for bundle sizes, response latencies, network payload constraints, memory limits, and polling behavior while guaranteeing that security, RBAC, data integrity, and audit logging remain uncompromised.

---

## 2. Updated Non-Functional Requirements (NFRs)

### NFR-1: Client Bundle Size & Code-Splitting
- **NFR-1.1**: The initial JavaScript entry bundle served to the browser on cold page load SHALL NOT exceed **300 kB** uncompressed (or **100 kB** gzipped).
  - *Verification*: Monitored via Vite production build (`npm run build`). Current achieved size: **288.39 kB** (90.51 kB gzipped), reduced from 857.72 kB baseline (-66.4%).
- **NFR-1.2**: All application route views outside the initial shell SHALL be partitioned into asynchronous, on-demand code chunks utilizing `React.lazy()` and `Suspense`.
  - *Verification*: `AppRoutes.jsx` outputs 42 independent route chunks loaded only when the user navigates to the respective role section.
- **NFR-1.3**: The initial CSS delivery SHALL NOT exceed **50 kB** uncompressed (or **10 kB** gzipped).
  - *Verification*: Main CSS bundle achieved size is **30.39 kB** (6.28 kB gzipped), reduced from 208.93 kB baseline (-85.5%).

### NFR-2: Backend API Latency & Server Timing
- **NFR-2.1**: All read (`GET`) endpoints serving in-memory repository data SHALL maintain a median server processing time of **< 10 ms** under local execution.
  - *Verification*: Measured via `Server-Timing: total;dur=<ms>` across 28 endpoints. All 27 read endpoints execute with median durations between 2.85 ms and 7.93 ms.
- **NFR-2.2**: Password verification on authentication (`POST /auth/login`) SHALL use bcrypt with a work factor of exactly **10** (median duration 130–165 ms) to preserve cryptanalytic hardness against brute-force attacks without blocking user logins.
  - *Verification*: Verified `bcrypt.compare` work factor 10 maintained without weakening security.

### NFR-3: Network Transfer & Compression
- **NFR-3.1**: The backend server SHALL compress HTTP response bodies greater than **1,024 bytes** using `gzip` compression when accepted by the client (`Accept-Encoding: gzip`).
  - *Verification*: Built-in zero-dependency `compression.middleware.ts` compresses responses > 1 KB, reducing transferred bytes by up to **86.0%** (`/admin/audit`: 8,654 B -> 1,208 B; `/admin/users`: 7,615 B -> 1,784 B).
- **NFR-3.2**: Cross-Origin Resource Sharing (CORS) preflight responses (`OPTIONS`) SHALL specify `Access-Control-Max-Age: 86400` (24 hours) to prevent redundant preflight network round-trips for authenticated client mutations.
  - *Verification*: Configured in `main.ts` CORS options.

### NFR-4: Bounded Data Growth & Memory Management
- **NFR-4.1**: In-memory event and message logs SHALL enforce strict retention caps to prevent unbounded heap memory growth over prolonged runtime.
  - Notifications store SHALL cap retention at **5,000 records**, evicting the oldest entries when capacity is exceeded.
  - Audit log store SHALL cap retention at **5,000 records**, evicting the oldest entries when capacity is exceeded.
  - *Verification*: Automated stress test (`test/stress-performance.spec.ts`) verified that inserting 6,000 notifications and 6,000 audit records maintained strict 5,000 ceilings.
- **NFR-4.2**: Repository entity lookups (Users by ID, Email, Username; Projects by ID, Owner ID; Tasks by ID, Project ID; Notifications by User ID) SHALL operate in **$O(1)$** or **$O(K)$** time using maintained Map indexes rather than $O(N)$ linear scans.
  - *Verification*: 1,000 entity lookups across 2,000 tasks executed in **0.117 ms** total.

### NFR-5: Request Deduplication & Visibility-Aware Polling
- **NFR-5.1**: Concurrent duplicate `GET` requests from multiple mounting components SHALL be deduplicated into a single in-flight Promise via client-side request pooling.
  - *Verification*: Verified in `src/services/apiClient.js` `inFlightRequests` Map.
- **NFR-5.2**: Background data polling (e.g., workspace chat) SHALL pause execution when the browser document is hidden (`document.hidden === true`) and resume immediately upon returning via `visibilitychange` event listeners.
  - *Verification*: Implemented in `CollaboratorWorkspace.jsx`, `OwnedWorkspace.jsx`, `MentorProjectWorkspace.jsx`, and `dashboard.jsx`.
- **NFR-5.3**: Rapid window focus events SHALL be throttled with a minimum cooldown of **10 to 15 seconds** to prevent request storms during OS task switching.

### NFR-6: Preservation of Security, RBAC & Business Rules
- **NFR-6.1**: No performance optimization SHALL weaken or bypass authentication guards (`AuthGuard`), role checks (`RolesGuard`), suspension checks, input sanitization (`xss-sanitizer`), rate limiting, or audit logging.
  - *Verification*: 100% of RBAC test specifications (`phase2.spec.ts` through `phase8.spec.ts`) pass with zero regressions.

---

## 3. Moderation, Reputation & Suspension Core (Phase 1 Requirements)

### FR-MOD-1: Warning Lifecycle & Threshold
- **FR-MOD-1.1**: Every administrative warning SHALL require a written explanation of at least 10 characters and deduct 10 reputation from the user's ledger.
- **FR-MOD-1.2**: Warnings SHALL generate a user notification titled with active progress (`Warning 1/4`, `2/4`, `3/4`, `4/4`) and send an email containing the explanation.
- **FR-MOD-1.3**: The 4th active warning SHALL automatically trigger account suspension with reason `"Automatic suspension after 4 warnings"` and send a suspension email.

### FR-MOD-2: Suspension Cascades & Closed Project Status
- **FR-MOD-2.1**: Suspending a collaborator SHALL release Open and In-Progress tasks back to Unassigned/Open, retain In-Review tasks for owner review, and notify the project owner.
- **FR-MOD-2.2**: Suspending a project owner SHALL immediately transition all owned projects to `Closed` status (`closureReason = 'Owner suspended'`), pay out active mentor sessions from escrow, refund unaccepted mentor sessions, close pending join requests by system without penalty, and notify collaborators and mentors.
- **FR-MOD-2.3**: `Closed` projects SHALL be read-only, locked from edits/applications, omitted from marketplace and completed lists, and display their closure reason.

### FR-MOD-3: Account Reactivation
- **FR-MOD-3.1**: Reactivation SHALL require a written explanation of $\ge 10$ characters, send an in-app notification only (no email), and reset `activeWarningsCount` to 0 while preserving historical warning records.
- **FR-MOD-3.2**: Reactivating an owner SHALL NOT reopen closed projects.

---

## 4. Appeals & Reporting System (Phase 2 Requirements)

### FR-REP-1: User Reporting Engine
- **FR-REP-1.1**: Any signed-in user SHALL be able to submit a report against another user via Help & Support with reason among: `Harassment`, `Spam`, `Cheating or plagiarism`, `Fake proof`, `Abandoned work`, `Inappropriate content`, `Other`.
- **FR-REP-1.2**: Report details SHALL be between 20 and 1,000 characters.
- **FR-REP-1.3**: The system SHALL reject self-reports with HTTP 403 `CANNOT_REPORT_SELF`.
- **FR-REP-1.4**: The system SHALL reject reports against administrator or superuser accounts with HTTP 403 `CANNOT_REPORT_ADMIN`.
- **FR-REP-1.5**: The system SHALL enforce a rate limit of maximum 5 reports per day per user with HTTP 429 `DAILY_LIMIT`.
- **FR-REP-1.6**: The system SHALL reject duplicate Open reports from the same reporter against the same target with HTTP 409 `DUPLICATE_OPEN_REPORT`.
- **FR-REP-1.7**: User search (`GET /users/search?q=`) SHALL require authenticated session, min. 2 query letters, max 10 results, and strictly return public fields `{ id, name, username, university }`, omitting email, password, and private data.
- **FR-REP-1.8**: The reporter identity SHALL remain confidential; the reported user SHALL never receive notification of who reported them.
- **FR-REP-1.9**: Upon report resolution or dismissal, the reporter SHALL receive an outcome notification without sensitive moderation details.

### FR-REP-2: Admin Reports Management
- **FR-REP-2.1**: Access to `/admin/reports` and `/admin/appeals` SHALL require the `reports` section permission (or Super User wildcard `*`).
- **FR-REP-2.2**: Report detail view SHALL display confidential reporter info, reported user details, prior active warnings, and prior reports received.
- **FR-REP-2.3**: Report actions SHALL allow status updates (`Under review`, `Open`) and resolutions (`warn`, `suspend`, `dismiss`).
- **FR-REP-2.4**: Actions on reports SHALL record an immutable audit entry and resolve the report.

### FR-REP-3: Warning Appeals & Reputation Reinstatement
- **FR-REP-3.1**: A user SHALL be permitted to appeal each of their own active warnings once within 7 calendar days with a written explanation of 20 to 1,000 characters.
- **FR-REP-3.2**: Suspended users SHALL NOT be permitted to appeal in-app (HTTP 403 `SUSPENDED`).
- **FR-REP-3.3**: Appealing an inactive warning, an already appealed warning, or a warning older than 7 days SHALL be rejected with HTTP 409.
- **FR-REP-3.4**: An administrator decision to accept an appeal SHALL remove the warning (`status: removed`), restore +10 reputation idempotently via the reputation ledger, decrement active warning count, and notify the user.
- **FR-REP-3.5**: Accepting an appeal SHALL NOT reactivate a suspended user account.
- **FR-REP-3.6**: An administrator decision to reject an appeal SHALL keep the warning active, record the rejection reason note ($\ge 10$ characters), notify the user, and forbid any subsequent appeal.

### FR-REP-4: Audit Log User Filtering
- **FR-REP-4.1**: `GET /admin/audit?userId=` SHALL filter audit records where the user was actor, target, entityId, or involved in details.
- **FR-REP-4.2**: The Admin Reports review modal SHALL provide a direct deep-link to `/admin/audit?userId=${reportedUser.id}`.

---

## 5. Joining & Leaving Policy (Phase 3 Requirements)

### FR-JOIN-1: Two-Request Limit & Counting Engine
- **FR-JOIN-1.1**: A collaborator SHALL be permitted to submit at most 2 join requests per project.
- **FR-JOIN-1.2**: Requests with status `pending`, `approved`, `rejected`, and `withdrawn` SHALL count against the 2-request limit.
- **FR-JOIN-1.3**: Requests with status `system_closed` (closed due to project full, project closed, or owner suspension) SHALL NOT count against the applicant.
- **FR-JOIN-1.4**: Submission of a join request after 2 requests have been used SHALL be rejected with HTTP 409 `REQUEST_LIMIT_REACHED`.
- **FR-JOIN-1.5**: Owners cannot apply to their own project (HTTP 403 `OWN_PROJECT`), removed users cannot re-apply (HTTP 403 `BANNED`), and closed/full/completed projects reject requests (HTTP 409).

### FR-JOIN-2: Owner Rejection & Transparency
- **FR-JOIN-2.1**: Rejecting a join request SHALL require a written explanation between 10 and 500 characters (HTTP 400 `REASON_REQUIRED` when missing or out of bounds).
- **FR-JOIN-2.2**: Only the verified owner of the project SHALL be permitted to reject requests (HTTP 403 `FORBIDDEN` otherwise).
- **FR-JOIN-2.3**: The applicant SHALL receive a notification containing the owner's rejection explanation and the reason SHALL be displayed in the Applied Projects status row.
- **FR-JOIN-2.4**: After the first rejection, Apply SHALL remain available with the hint `"1 request left"`. After the second rejection, Apply SHALL be replaced with a disabled `"Request rejected"` tag across card, preview, and Applied Projects.

### FR-LEAVE-1: Collaborator Leaving Policy
- **FR-LEAVE-1.1**: Leaving a project (`POST /projects/:id/leave`) SHALL require a reason category among: `Too busy`, `Project not as described`, `Conflict with the team`, `Personal reasons`, `Other`, and a written explanation between 10 and 500 characters.
- **FR-LEAVE-1.2**: The project owner SHALL NOT leave their own project (HTTP 403 `OWNER_CANNOT_LEAVE`), mentors SHALL NOT leave (HTTP 403 `MENTOR_CANNOT_LEAVE`), non-members SHALL NOT leave (HTTP 403 `NOT_A_MEMBER`), and locked projects (Completed/Closed) SHALL NOT permit leaving (HTTP 409 `PROJECT_LOCKED`).
- **FR-LEAVE-1.3**: Upon leaving, unapproved tasks (Open or In Progress) assigned to the collaborator SHALL be reset to Unassigned and To Do; approved tasks, earned XP, and reputation SHALL remain intact on the user profile.
- **FR-LEAVE-1.4**: The project owner SHALL be notified with the collaborator's category and explanation, the collaborator slot SHALL be freed, and re-applying later SHALL consume 1 of the 2 allowed requests.

### FR-AUTO-1: 5-Day Auto-Closure for Inactive Projects
- **FR-AUTO-1.1**: Projects with 0 approved collaborators and 0 pending join requests 5 calendar days after creation SHALL automatically close with `closureReason = 'No applicants within 5 days'`.
- **FR-AUTO-1.2**: A reminder notification SHALL be dispatched to the owner on Day 4 exactly once (`day4ReminderSentAt`).
- **FR-AUTO-1.3**: If pending join requests exist on Day 5, project closure SHALL be paused and a reminder SHALL be sent to the owner to review the pending requests (`pendingReviewReminderSentAt`).
- **FR-AUTO-1.4**: Upon auto-closure, any active or unaccepted mentor sessions on the project SHALL be refunded in full from escrow, the mentor notified, and the project permanently locked in read-only status.

### FR-MENTOR-1: Mentor Experience & Platform Minimum Tenure Policy
- **FR-MENTOR-1.1**: Mentor application years of professional experience SHALL be an integer between 5 and 40, verified on form input and server DTO validation.
- **FR-MENTOR-1.2**: Platform configuration `minimumTenure` (alias `mentorMinYearsExperience`) SHALL default to 5 and can only be raised (between 5 and 40). Lowering the minimum tenure SHALL be rejected with HTTP 400.
- **FR-MENTOR-1.3**: Application submission and administrative approval checks SHALL evaluate against the active platform configuration `minimumTenure`.

### FR-MENTOR-2: Mentor Booking Decline & Auto-Decline Policy
- **FR-MENTOR-2.1**: A mentor who declines a session booking SHALL provide a written reason between 10 and 500 characters (`POST /mentor-marketplace/sessions/:id/decline`). Omission or insufficient length SHALL be rejected with HTTP 400 `REASON_REQUIRED`.
- **FR-MENTOR-2.2**: Declining a booking SHALL issue an immediate full refund from escrow to the project owner, store `declineReason` and `declinedBy = 'mentor'`, and notify the project owner with the mentor's written reason.
- **FR-MENTOR-2.3**: A funded session booking waiting for mentor acceptance SHALL automatically decline after 3 days (`respondBy = now + 3 days`), refunding the owner in full with reason `"No response within 3 days"` (`declinedBy = 'system'`) and notifying both parties.

### FR-TASK-1: Task Due Dates & Moving Constraints
- **FR-TASK-1.1**: Every task creation (`POST /tasks`) SHALL require a valid due date (`DUE_DATE_REQUIRED` 400).
- **FR-TASK-1.2**: A task due date SHALL NOT be in the past (`DUE_DATE_PAST` 400) and SHALL NOT exceed the project's due date (`DUE_DATE_AFTER_PROJECT` 400).
- **FR-TASK-1.3**: The project owner may move a task due date only until that date has passed and the task is not approved. Attempting to adjust the due date of a passed or approved task SHALL return HTTP 409 `DUE_DATE_LOCKED`.
- **FR-TASK-1.4**: On startup bootstrap, existing tasks without a due date SHALL be backfilled with their project's due date.

### FR-DEADLINE-1: Missed Deadline Penalties & Project Deadline Changes
- **FR-DEADLINE-1.1**: An automated hourly background job SHALL evaluate tasks whose due date has passed (from midnight server time the day after). If a task remains Open (`To Do`) or In Progress, the assignee SHALL receive **-5 reputation** once per task (ledger entry `deadline_missed`, flag `penaltyAppliedAt`, floored at 0). Unassigned, submitted (`In Review`), and completed tasks SHALL NOT incur penalties.
- **FR-DEADLINE-1.2**: The project owner may change the project deadline (`PATCH /projects/:id/deadline`) until the project is Completed or Closed (`PROJECT_LOCKED` 409).
- **FR-DEADLINE-1.3**: Project deadline changes SHALL require a written reason of at least 10 characters (`REASON_REQUIRED` 400), a new date in the future (`DEADLINE_NOT_FUTURE` 400), and a date no earlier than the latest active task due date (`DEADLINE_BEFORE_TASKS` 400).
- **FR-DEADLINE-1.4**: Collaborators and the assigned mentor SHALL be notified of the deadline update with old date, new date, and written reason, and an audit log entry SHALL be recorded. Already applied penalties SHALL stay.

---

## 5. Profile Header & Mentored Projects Requirements (Profile Fixes)

### FR-PROF-1: Profile Header Card Streamlining
- **FR-PROF-1.1**: The Profile page header card (`UserTrustCard`) SHALL display verification/standing badges, `Member since`, `Experience Points`, and the `Conduct Score` row, without a `Track Record (Verified Work)` tile block.

### FR-PROF-2: Dynamic Mentored Projects Parity
- **FR-PROF-2.1**: Mentored projects across `GET /users/me`, `GET /users/:id/public-profile`, `GET /mentor-marketplace/mentored-projects`, and `GET /admin/users/:id` SHALL derive from a single shared backend computation (`getMentoredProjectsForUser`).
- **FR-PROF-2.2**: A mentor's own `/profile` view SHALL display all active and completed mentored projects with project title, status badge (`Active` or `Completed`), project owner name, acceptance/completion date, and clickable `Final Link` via `SafeLink` for completed projects.
- **FR-PROF-2.3**: Public profile responses SHALL expose completed mentored projects only, and completed project completion/backfill metadata SHALL record the mentor (`completedMentorUserId`) without mixing mentors into project `collaborators`.
- **FR-PROF-2.4**: Projects whose mentor was released upon abandonment review, whose session was refunded before start, or that are soft-deleted SHALL NOT appear in mentored projects lists.

