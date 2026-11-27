# 🍍 TeamForge (26_PINEAPPLE)
> A comprehensive student and developer project collaboration platform with Role-Based Access Control (RBAC), verified mentorship, real-time gamification ledger, and escrow-backed milestone governance.

---

## 📌 Problem Statement & Overview
Students and emerging developers frequently struggle to find high-impact, real-world project collaboration opportunities to showcase verified experience. Traditional platforms either focus purely on static code hosting (e.g. GitHub) or text-based networking (e.g. LinkedIn), lacking structured milestone governance, fair contribution tracking, and verified mentorship.

**TeamForge** bridges this divide by providing:
1. **Multi-Role Workspaces:** Project Owners, Collaborators, Mentors, Administrators, and Super Users.
2. **Double-Entry Gamification Ledger:** Immutable XP & Reputation tracking directly computed from verified task completions.
3. **Escrow & Mentorship Marketplace:** Single active mentor guarantee per project, transparent escrow breakdown, and NPCI UPI QR payment simulation.
4. **Credential Verification:** Secure CV upload with `%PDF-` magic byte validation and simulated DigiLocker educational credential verification.

---

## 🔐 Authentication & Role-Based Access Control (RBAC)

TeamForge features a unified, pluggable authentication architecture supporting three distinct operational modes controlled via environment variables:

| Auth Mode | Back-End (`AUTH_MODE`) | Front-End (`VITE_AUTH_MODE`) | Verification Mechanism | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **`firebase`** | `firebase` | `firebase` | Firebase Admin SDK (`verifyIdToken`) with custom role claims | Production / Cloud Firebase & Local Firebase Emulator |
| **`jwt`** (Default) | `jwt` | `jwt` | HMAC-SHA256 verified access tokens + httpOnly refresh cookie | 100% Offline Local Development & Testing |
| **`legacy`** | `legacy` | `legacy` | Header-based identity fallback (`x-user-id`, `x-user-role`) | Legacy Backward-Compatibility / Fallback Mode |

### 🛡️ Complete Controller RBAC Matrix
The platform's 123 backend API routes are strictly protected by a unified `AuthGuard` and `RolesGuard` combination. Every endpoint, its required roles, and guard enforcement are cataloged in:
👉 **[docs/rbac-matrix.md](docs/rbac-matrix.md)**

### 🧭 Canonical Route Conventions & Architecture
The frontend client enforces a structured, role-prefixed routing hierarchy (`/owner/...`, `/mentor/...`, `/admin/...`):
- `/owner/mentors`: Mentors marketplace directory for project owners (guarded by `OwnerProtectedRoute`).
- `/mentor/apply`: Mentor application portal (open to authenticated users applying for mentor status).
- `/mentor/projects`: Mentored projects workspace for approved mentors (guarded by `MentorProtectedRoute`).
- `/mentor/requests`: Mentorship requests and session management (guarded by `MentorProtectedRoute`).
- `/mentor/earnings`: Mentorship earnings and escrow ledger breakdown (guarded by `MentorProtectedRoute`).
- `/mentor/profile`: Mentor public profile configuration (guarded by `MentorProtectedRoute`).
- Global 404 handler (`NotFound.jsx`) catches unmatched or obsolete paths, and legacy session navigation states are automatically migrated.
For detailed audit notes, see **[docs/cleanup-log.md](docs/cleanup-log.md)**.

### 🔄 Dynamic Role Switching
Users with multiple personas (e.g., Collaborator applying to be Mentor, or switching between Owner and Collaborator views) invoke `POST /auth/switch-role`. In JWT/Firebase mode, the backend re-issues or updates the authenticated token claim with the requested role after validating eligibility.

### 🛑 Platform Governance & Account Security
- **Suspension Enforcement:** Suspended or banned accounts receive immediate `403 Forbidden` responses, their active tokens are revoked, and client sessions are cleared.
- **Maintenance Mode:** Administrators can activate global maintenance (`HTTP 503`), gracefully exempting admins, health checks, and auth recovery endpoints.

---

## 📋 Rules Added in This Round (Nov 21 Stabilization)
- **One Role Per Person in a Project (Step 1):** A user can hold at most one role (Owner, Collaborator, or Mentor) on any given project. The project members list reports exactly one row per unique person, member count reflects unique individuals, and cross-role booking, application, or invitation is blocked with `409 MENTOR_IS_PROJECT_MEMBER` or `409 ALREADY_PROJECT_MENTOR`.
- **Collaborator Removal Guard on Submitted Work (Step 2):** Project owners and admins cannot remove a collaborator who has submitted tasks waiting in review (`In Review`), returning `409 MEMBER_HAS_TASKS_IN_REVIEW`. Removal is permitted only after the owner decides (approves or sends back with feedback), whereupon unsubmitted and sent-back tasks are released to the backlog.
- **Security-First Suspension Notification & Login Flow (Step 3):** Account suspension is revealed only after credential verification (correct password or verified social token). Suspended accounts receive `403 ACCOUNT_SUSPENDED` with suspension reason, date, and type (issuing no tokens); invalid credentials return identical generic `401 INVALID_CREDENTIALS` as non-existent emails; and mid-session calls return `403 ACCOUNT_SUSPENDED` without showing a server restart message.
- **Terminal State Read-Only Support Tickets (Step 4):** Support tickets in status `resolved` or `rejected` are permanently immutable for all users, including Super Users. Any PATCH to priority, assignee, or status and any replies return `409 TICKET_CLOSED` leaving ticket records strictly invariant, while background reminder jobs skip terminal tickets.
- **Report Review Audit Log Filter & Navigation (Step 5):** The "View audit log" button in the Report Review dialog opens `/admin/audit-log` in a new tab (`target="_blank"`, `rel="noopener noreferrer"`) with `userId`, `reportId`, and `from=report`, requiring the `audit` permission. The Audit Log page renders removable filter chips with `Clear all`, dynamic result count, and ensures bidirectional correlation between moderation actions and report audit records.

---

## 🚀 Key Features by Implementation Phase

### ⚖️ Phase 1 (Policy Plan): Moderation Core, Reputation Ledger & Suspension Cascades
- **Written Explanations (10 to 500 chars):** Mandatory written justification required on the backend and frontend for Warn, Suspend, and Reactivate actions (`HTTP 400 REASON_REQUIRED` on fewer than 10 or greater than 500 characters).
- **Self & Admin Target Moderation Shield:** Strict 403 Forbidden checks preventing moderators from moderating their own accounts (`CANNOT_MODERATE_SELF`) or moderating Administrator and Super User accounts (`CANNOT_MODERATE_ADMIN`).
- **Warning Progression & Notifications:** Active warnings increment $1/4 \to 2/4 \to 3/4 \to 4/4$. Each warning sends an email and an in-app notification titled with the count (e.g. `Warning 1/4`), deducting 10 reputation from the unified ledger (clamped at floor 0).
- **Automatic Suspension on 4th Warning:** The fourth active warning automatically suspends the user account (`"Automatic suspension after 4 warnings"`), restricts login, bumps token version, revokes refresh tokens, and sends a suspension email.
- **Manual Suspension & Reactivation:** Manual suspension sends an email only (user access blocked); Reactivation sends an in-app notification only, resets active warning count to 0 while keeping historical records, does not alter reputation, and never reopens closed projects.
- **Collaborator Suspension Cascade:** Open and In-Progress tasks return to Unassigned and Open (`status = TaskStatus.ToDo`); In-Review tasks remain intact for the project owner; project owner is notified with the released task titles.
- **Project Owner Suspension Cascade & Closed Status:** All owned projects immediately transition to `Closed` status (`closedReason = 'Owner suspended'`). Closed projects are locked and read-only, omitted from marketplace and completed lists. Active mentor sessions are paid out from escrow; unaccepted mentor sessions are refunded in full; pending join requests become `system_closed` without counting against applicants; collaborators and mentors receive notifications. Applying to a closed project returns `409 PROJECT_CLOSED`.
- **Dedicated Architecture & Endpoints:**
  - `POST /admin/users/:id/warn` { reason } -> 201 `{ warning, activeCount, autoSuspended }`
  - `POST /admin/users/:id/suspend` { reason } -> 200 `{ status: "suspended" }`
  - `POST /admin/users/:id/reactivate` { reason } -> 200 `{ status: "active", clearedWarnings }`
  - `GET /admin/users/:id/warnings` -> 200 `[warnings, newest first, with moderator name]`
  - `GET /users/me/warnings` -> 200 `[own warnings with N/4 label]`
- **Frontend Components:**
  - `ModerationModal.jsx`: Reusable modal reusing `Modal` and `FormInput` with live character counter (10-500 chars), disabled submit until valid, server error display, and result feedback.
  - `AdminUserDetails.jsx`: Integrated moderation actions, active warnings badge (`N/4`), and warning history records.
  - `ProjectCard.jsx`: Prominent `Closed` status badge and closure reason banner with disabled apply.
- **Test Commands:**
  - Backend Unit Tests: `cd back-end; npm.cmd test` (40/40 PASSED)
  - Backend E2E Tests: `cd back-end; npm.cmd run test:e2e` (16/16 PASSED)
  - Frontend Vitest Tests: `cd React-Implementation/React-Implementation; npm.cmd test` (11/11 PASSED)
  - REST Client Specifications: `docs/api-tests/phase-1.http` (14 endpoint scenarios)

### 🚩 Phase 2 (Policy Plan): Appeals and Reports
- **User Reporting Engine:**
  - Any signed-in user can report another user from Help & Support > "Report a User" tab.
  - Safe user search (`GET /users/search?q=`) requiring min. 2 letters, returning max 10 users, strictly limited to public fields (`{ id, name, username, university }`) and never exposing emails, hashes, or passwords.
  - Allowed reasons: `Harassment`, `Spam`, `Cheating or plagiarism`, `Fake proof`, `Abandoned work`, `Inappropriate content`, `Other`.
  - Report details bound between 20 and 1,000 characters.
  - Protection rules: Cannot report self (`CANNOT_REPORT_SELF` 403), cannot report admin or superuser accounts (`CANNOT_REPORT_ADMIN` 403), max 5 reports per day per reporter (`DAILY_LIMIT` 429), and no duplicate open report against the same target (`DUPLICATE_OPEN_REPORT` 409).
  - Reporter identity is strictly confidential; the reported user never learns who reported them.
  - "My Submitted Reports" list tracks submitted reports and outcome line.
- **Admin Reports Section (`/admin/reports`):**
  - Guarded by dedicated section permission `'reports'` (Super User has wildcard `*`).
  - Two tabs: `User Reports` and `Warning Appeals`.
  - Report Review: Displays confidential reporter, reported user details, prior warnings/reports count, status updater, direct link to `/admin/audit?userId=${reportedUser.id}`, and resolution actions: Warn, Suspend, Dismiss.
  - Resolving or dismissing a report automatically sends a one-line outcome notification to the reporter.
- **Warning Appeals Flow:**
  - Users can appeal each of their own active warnings once, within 7 days of warning issuance, providing a 20 to 1,000 character written explanation.
  - Suspended accounts cannot appeal in-app (`SUSPENDED` 403). Cannot appeal non-active warnings (`WARNING_NOT_ACTIVE` 409), expired warnings (`APPEAL_WINDOW_CLOSED` 409), or already appealed warnings (`ALREADY_APPEALED` 409).
  - Admin Decision: Requires a written note of at least 10 characters.
    - Accept: Removes the warning (`status: removed`), restores +10 reputation idempotently via the ledger, decrements active warning count, and notifies the user. Accepting never reactivates a suspended account.
    - Reject: Keeps the warning active, notifies the user with the rejection note, and blocks any secondary appeal.
- **Audit Log User Filter:**
  - `GET /admin/audit?userId=` filters log entries where the user was actor, target, entity, or involved in details.
  - Frontend `AuditLog.jsx` supports `?userId=` URL search parameter with an active filter chip and one-click clear button.
- **Test Commands:**
  - Backend Unit Tests: `cd back-end; npm.cmd test` (55/55 PASSED across 8 suites)
  - Backend E2E Tests: `cd back-end; npm.cmd run test:e2e` (36/36 PASSED across 2 suites)
  - Frontend Vitest Tests: `cd React-Implementation/React-Implementation; npm.cmd test` (25/25 PASSED across 6 suites)
  - REST Client Specifications: `docs/api-tests/phase-2.http` (17 endpoint scenarios)

### 📅 Phase 3: Zero-Dependency Calendar DatePicker & Due Dates
- **Zero-Dependency Calendar:** Custom `DatePicker.jsx` with interactive month grid, previous/next navigation, keyboard accessibility, and outside-click dismiss.
- **Project Due Date Integrity:** Projects require a valid deadline at least tomorrow (`>= tomorrow`; `HTTP 400` on past or today dates).
- **Task Due Date Bounding:** Task due dates must fall between today and the project deadline (`HTTP 400` if out-of-range).
- **Dynamic Overdue Indicators:** Incomplete tasks past their deadline automatically render an overdue indicator (`⚠️ Overdue`) across workspaces.

### 🔍 Phase 4: Owner Applicant Profile Inspection & Profile Consistency
- **Secure Public Profile Endpoint:** `GET /users/:id/public-profile` grants read access strictly to self, platform admins, or project owners reviewing active applications.
- **Privacy Shield:** Sensitive applicant data (`email`, `phone`, warnings, moderation controls) is strictly redacted.
- **Rich Metric Showcase:** Displays applicant bio, university, member since date, ledger XP/Rep, completed project portfolio with live links, completed mentored projects via `SafeLink`, and contribution histories.
- **Profile Header & Mentored Projects Parity:**
  - `UserTrustCard` displays trust badges, Member Since, Experience Points, and Conduct Score (no separate Track Record summary block).
  - Own profile (`/profile` via `GET /users/me`) displays active and completed mentored projects sourced dynamically from `MentorMarketplaceService.getMentoredProjectsForUser(userId)` (matching `/mentor/projects` and `AdminService.getUserDetails`, excluding abandonment-released or pre-start refunded sessions and soft-deleted projects); public profile views (`GET /users/:id/public-profile`) return completed mentored projects only.

### 👥 Phase 5: Project Capacity & Collaborator Limit
- **Platform Clamping:** Project `maxCollaborators` is strictly clamped to the platform maximum (`maxCollaboratorCapacity`).
- **Capacity Counter:** Real-time capacity counter (e.g. `1/1 full`) and full badge indicators on marketplace and workspace cards.
- **Collision Protection:** Prevents over-subscription with `HTTP 409 Conflict` on application or approval attempts to full projects.
- **Cascading Rejection:** When the final collaborator slot is filled, remaining pending applications are automatically rejected with `"Project is full"` and applicant notifications are dispatched.

### 🏛️ Phase 6: Single Mentor per Project & Clean Escrow Ledger
- **Single Mentor Invariant:** A project can have at most one active or pending mentor session. Concurrent bookings are locked and rejected with `HTTP 409 Conflict`.
- **Automatic Startup Reconciliation:** System startup reconciliation identifies duplicate sessions, keeps the earliest confirmed session, and automatically refunds duplicates in full.
- **Double-Funding Guard:** Escrow service verifies existing funding records before creating any new ledger entry, preserving exact financial parity.

### 💳 Phase 7: Simulated UPI QR Payment Flow (Offline Demo)
- **Standard NPCI UPI Intent:** Generates authentic `upi://pay` URIs (`pa=teamforge@demo`) with 10-minute hold expiration.
- **Pure SVG Offline QR Generator:** Lightweight, zero-dependency SVG QR component (`QRCodeSvg.jsx`) rendering instantly without external CDNs or network calls.
- **Idempotent Confirmation:** Payment confirmation endpoint (`POST /mentor-marketplace/sessions/:id/confirm-payment`) moves session to `escrow_funded` and funds escrow exactly once; repeat requests return existing records without duplicate funding.
- **Hold Release:** Cancellation by the owner or automatic expiration releases the project hold immediately.

### 📄 Phase 8: Mentor CV Upload & DigiLocker Verification (Demo Sandbox)
- **Strict PDF Magic Byte Verification:** `POST /uploads/cv` accepts `.pdf` only (&le; 5MB) and inspects byte offset 0 for `%PDF-`. Renamed executables or non-PDF files are rejected with `HTTP 400` and erased from disk.
- **Secure File Storage:** Stored in `secure-cvs/` outside public web roots; served only to administrators and the applicant owner via authenticated `GET /uploads/cv/:filename`.
- **DigiLocker Sandbox Integration:** Pluggable integration with DigiLocker sandbox API. Simulates document retrieval and verifies holder names against the applicant, displaying green `✓ Verified` or amber `⚠️ Name Mismatch` badges.
- **Privacy Compliance:** Applicants or administrators can permanently erase uploaded CV files from disk and database records at any time.

### 🛡️ Admin Mentor Review, Leaderboard Integrity & Credential Statuses
- **Admin Mentor Review Flow & RBAC:**
  - Standardized role normalization (`role.util.ts` & `apiClient.js`) ensures Super User possesses all section permissions while Admin accounts enforce their specific `permissions` array (`mentor_apps`, `projects`, `revenue`). Normal users and collaborators receive `403 Forbidden`.
  - Buttons reset state in a `finally` block preventing stuck UI states, replace browser alerts with non-blocking toasts, and refresh application counts dynamically.
  - Non-destructive approval unlocks the applicant's Mentor persona (`mentorUnlocked: true`), assigns the role, delivers `MENTOR_APPLICATION_APPROVED` notification, and writes an audit log entry. Rejections require an optional reason and dispatch notification.
  - Approving an application with 0 verified credentials is strictly rejected by the backend (`HTTP 409 Conflict`) unless the administrator explicitly confirms "Approve without verification" with a mandatory justification note, which is logged to the audit trail.
- **Leaderboard Rules & Deduplication (Phase 1):**
  - **Role-Free Leaderboard:** Contributor column renders clean display names with no role badges or suffixes (XP and reputation are role-independent). The signed-in user's row is highlighted with a small `<span className="leaderboard-you">You</span>` tag.
  - **Account Audit (Aditya Sai vs Aditya):** Verified that `id: '6'` ("Aditya Sai", VIT Vellore, 850 XP) and `id: 'u-collab'` ("Aditya", Anna University, 450 XP) are two distinct real accounts, not duplicates, and both are preserved on the leaderboard.
  - **Single Source of Truth & Dense Ranking:** All-Time, Monthly (30d), and Weekly (7d) tabs derive scores strictly from the gamification ledger, matching Profile metrics identically with dense 1..n ranking. Admin and Super User accounts are strictly excluded.

- **University / Institution Field in Settings (Phase 2):**
  - **Settings Field & Validation:** Controlled `<FormInput>` in Settings > Profile Information for "University / Institution" placed after Bio, with character whitelist validation (`. , & - ' ( )`), 2–100 character length bounding, and whitespace trimming.
  - **Datalist Suggestions:** Autocomplete suggestions (`<datalist id="university-suggestions">`) for consistent institutional spelling.
  - **Harmonized Display:** Synchronized across Profile page, Admin Users list, Admin User Details (`AdminUserDetails.jsx`), Applicant Public Profile (`OwnedWorkspace.jsx`), and Mentor Cards (`MentorCard.jsx`, `MentorsDirectory.jsx`, `MyMentorProfile.jsx`).

- **Phone Number Verification with Firebase Phone Auth OTP (Phase 3):**
  - **Security & Integrity Invariant:** Phone numbers in Settings can only be added or changed after the user proves ownership via an SMS one-time password through Firebase Phone Authentication. Direct `PATCH /users/:id` calls attempting to change phone or set `phoneVerified` directly are rejected (`HTTP 400 Bad Request`).
  - **Isolated Auth Instance:** Verification uses a dedicated, isolated Firebase app instance (`"phone-verify"`) so the OTP flow never alters the main application session. The verify instance signs out immediately after the ID token is obtained.
  - **Settings Phone UI:** Indian 10-digit number normalized to E.164 (`+91XXXXXXXXXX`), green `Verified` or grey `Not verified` Badge, and dynamic `Verify` (when not verified) or `Change number` (when verified) actions. Editing clears verified status and blocks saving unverified numbers (`"Verify your new phone number to save it"`).
  - **2-Step OTP Modal:**
    - Step 1: Shows E.164 number, renders invisible `RecaptchaVerifier` on a dedicated container element with clean lifecycle destruction, and "Send OTP" button.
    - Step 2: 6-digit numeric input with auto-focus and clipboard paste support, 30-second resend countdown timer, "Change number" back link, and 5 wrong attempts limit per send.
    - Friendly error mapping for quota exhaustion, expired codes, invalid tokens, network errors, and server configuration errors without exposing internal token traces.
  - **Backend Verification (`POST /users/me/phone/verify`):**
    - Verifies token via `firebase-admin`, confirms `phone` sign-in provider, reads `phone_number` claim.
    - Rejects duplicate phone numbers across accounts with `HTTP 409 Conflict` (`"This phone number is already linked to another account"`).
    - Persists `phone`, `phoneVerified: true`, and `phoneVerifiedAt` without altering other stats, writes audit log entry (`phone-verified`), and dispatches notification.
    - Enforces rate limiting of at most 5 verification attempts per user per hour (`HTTP 429 Too Many Requests`).
    - Returns `HTTP 503 "Phone verification is not configured"` if `firebase-admin` lacks credentials or emulator host.
  - **Phone Removal (`DELETE /users/me/phone`):** Securely removes the phone number and resets `phoneVerified: false` with audit trail recording.
  - **Testing Strategy & Test Numbers:**
    - Due to the ~10 SMS per day limit on Firebase free plans and default SMS region policy, use pre-configured test phone numbers in the Firebase Console (**Authentication > Sign-in method > Phone > Phone numbers for testing**). Test numbers bypass region restrictions, consume 0 SMS quota, and verify immediately.
    - Pre-configured test numbers for instant evaluation:
      - `+91 9494221549` &rarr; Code: `123456`
      - `+91 9876543210` &rarr; Code: `123456`
      - `+91 7981538727` &rarr; Code: `890634`
      - `+91 9999999999` &rarr; Code: `123456`
    - For local offline development, set `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` on the backend and `VITE_USE_AUTH_EMULATOR=true` on the frontend to run against the Firebase Local Emulator Suite.
    - When deploying to production with real SMS delivery, ensure `localhost` (or the production domain) is listed under **Authentication > Settings > Authorized domains**, India (+91) is enabled under **Authentication > Settings > SMS Region Policy**, and the project has an active SMS quota or Blaze billing plan.

- **Password Reset & Mail Delivery Architecture:**
  - **Overview & Dual-Mode Support:**
    - The password reset flow is fully operational end-to-end across all authentication modes (`jwt`, `legacy`, and `firebase`).
    - **Anti-Enumeration Invariant:** Submitting any identifier (email or username) returns the identical generic message: `"If an account with that email or username exists, password reset instructions have been sent."` whether or not the account exists. Suspended or banned accounts receive the generic response and no email is dispatched.
  - **Back-End Mail Service (`back-end/src/mail`):**
    - Driven by `MAIL_MODE` in `back-end/.env`:
      - `MAIL_MODE=ethereal` (Default in development): Automatically initializes a zero-config test account with `nodemailer.createTestAccount()`. Dispatches HTML & plain-text emails and generates an instant web preview URL (`https://ethereal.email/message/...`) printed to the console and attached to dev-mode responses (`response.previewUrl`).
      - `MAIL_MODE=smtp`: Delivers real emails via Nodemailer using verified SMTP transport (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`). Transporter is verified on start-up.
      - `MAIL_MODE=console`: Prints email subject, recipient, plain text, and reset link directly to `stdout` (DEV ONLY).
      - **Production Protection:** If `MAIL_MODE` is omitted in production (`NODE_ENV=production`), the application refuses to start with an explicit configuration error.
  - **Rate Limiting & Token Invalidation:**
    - At most 5 reset requests per identifier per hour (`HTTP 429 Too Many Requests`).
    - At most 20 reset requests per client IP per hour (`HTTP 429 Too Many Requests` with `retryAfter: 3600`).
    - Reset tokens are 32 cryptographically random bytes (`crypto.randomBytes(32)`), stored hashed via SHA-256, valid for exactly 15 minutes, strictly single-use, and invalidate all previous tokens for that user.
    - Successfully resetting a password marks the token used, updates the password hash, revokes active refresh tokens/sessions across other devices, writes an audit event (`password-reset-completed`), and issues a security alert notification.
  - **Firebase Auth Flow (`AUTH_MODE=firebase`):**
    - The client calls `sendPasswordResetEmail(auth, email, { url: FRONTEND_URL + "/login", handleCodeInApp: false })`.
    - If a username without `@` is supplied, the frontend safely resolves it via `GET /auth/resolve-identifier?identifier=...`.

- **Mentor Application Lifecycle & Instant Role Unlock:**
  - Mentor status is derived server-side from the applicant's latest application (`GET /mentor-applications/me`).
  - Users may have only one pending application at a time (`HTTP 409 Conflict` on duplicate submission), and approved mentors cannot re-apply (`HTTP 409 Conflict`).
  - Administrator approval sets `mentorUnlocked: true` immediately without logout, clears prior rejection data, and unlocks the Mentor workspace via real-time events. Rejection of a later application never revokes an earlier approval.
  - Startup data repair reconciles historical records, fixes user flags, and marks older duplicate applications as superseded.

- **Removal of Project Suspend & Delete:**
  - Project-level suspend and delete features are completely removed across UI controls, API clients, and backend routes (`DELETE /projects/:id` returns `HTTP 404 Not Found`).
  - User-level moderation (warn, suspend, reactivate, flag) remains intact and operational.
  - Admin project views are strictly read-only. Any stored suspended projects are repaired to `Open` or `In Progress` on startup.

- **Per-Project Chat & Member Roles:**
  - In-project roles (`Owner`, `Mentor`, `Collaborator`, `Former member`) are strictly computed from project membership via the canonical `getProjectRole` helper, never from global role claims or navbar role selectors.
  - Project chat enforces access control: non-members and former members are barred from posting (`HTTP 403 Forbidden`). Stored message role fields are purged on startup and computed dynamically on fetch.
    - The reset page (`/reset-password`) supports both JWT tokens (`?token=...`) and Firebase action codes (`?oobCode=...`), verifying the code via `verifyPasswordResetCode(auth, oobCode)` and submitting via `confirmPasswordReset(auth, oobCode, newPassword)` with real-time password strength metering.
  - **Environment Variables (`back-end/.env`):**
    ```env
    # Mail Service Configuration
    MAIL_MODE=ethereal                                  # "ethereal" (default), "smtp", or "console"
    FRONTEND_URL=http://localhost:5173                  # Base URL for reset links (must point to client app)
    MAIL_FROM="TeamForge <no-reply@teamforge.io>"

    # SMTP Configuration (required only when MAIL_MODE=smtp)
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=465
    SMTP_SECURE=true
    SMTP_USER=your_email@gmail.com
    SMTP_PASS=your_16_char_app_password
    ```
  - **Real Gmail SMTP Setup Guide:**
    1. Log in to your Google Account at [myaccount.google.com](https://myaccount.google.com/).
    2. Go to **Security** and ensure **2-Step Verification** is turned ON.
    3. Navigate to **App passwords** (or search "App passwords" in the search bar).
    4. Create a new app password: Name it `TeamForge Backend`.
    5. Copy the generated 16-character code (e.g. `abcd efgh ijkl mnop`).
    6. In `back-end/.env`, set:
       ```env
       MAIL_MODE=smtp
       SMTP_HOST=smtp.gmail.com
       SMTP_PORT=465
       SMTP_SECURE=true
       SMTP_USER=your_gmail_address@gmail.com
       SMTP_PASS=abcdefghijklmnop
       MAIL_FROM=TeamForge <your_gmail_address@gmail.com>
       ```
    7. Start the backend (`npm run dev`) &rarr; confirm console logs: `mail transport ready (SMTP host: smtp.gmail.com:465, secure: true)`.
  - **Firebase Console Setup Guide:**
    1. Go to [Firebase Console](https://console.firebase.google.com/) &rarr; select `team-forge-auth` &rarr; **Authentication**.
    2. Under **Templates** &rarr; click **Password reset**: customize sender display name (`TeamForge`) and subject line.
    3. Under **Settings** &rarr; **Authorized domains**: verify `localhost` is listed.
    4. Note: Automated emails sent by Google Firebase Spark tier may land in the recipient's **Spam / Junk** folder.
  - **Troubleshooting:**
    * *Email not in inbox*: Check Spam / Junk folder. If using Ethereal, click the generated preview link in the UI notice or terminal.
    * *Reset link points to port 3000*: Ensure `FRONTEND_URL=http://localhost:5173` is set in `back-end/.env`.
    * *SMTP 501 / 535 Error*: Check `SMTP_USER` and `SMTP_PASS`. For Gmail, you must use a 16-character App Password, not your standard Google login password.
    * *Too Many Requests*: Identifier rate limit is 5/hour; IP limit is 20/hour. Wait 1 hour or test with a different test identifier.
- **Credential Statuses & Verification Authority:**
  - **Canonical Statuses:** `verified`, `name_mismatch`, `unverified`, `failed`.
  - **Credential Schema:** `issuer`, `documentType`, `documentNumber`, `holderName`, `issueDate`, `status`, `verifiedAt`, `verificationId`, `mismatchReason`.
  - **Server-Side Re-evaluation:** Client-provided statuses are never trusted; the server recomputes holder name matching against the applicant's profile name. Submissions with 0 verified credentials return `HTTP 400 Bad Request`.
  - **Client & Admin Consistency:** Applicant form displays summary line (`"2 verified, 1 not verified"`), excludes unverified documents on submit, and disables submit until 1 credential is verified and CV is attached. Admin portal displays summary chip (`"2 of 3 verified"`), verified credentials list, excluded credentials list, CV download, experience vs platform minimum, and verification FilterTabs (`All`, `Fully verified`, `Has unverified`, `No verified`).

- **Collaborator Removal Governance & Project Owner Rules:**
  - **Single Ownership Authority (`isProjectOwner`):** Verified user ID comparison in `isProjectOwner(project, user)` used by all owner-exclusive actions. Only the exact verified owner of the project (or platform admin / super user) may remove collaborators (`HTTP 403 Forbidden` for non-owners). One-time startup migration populates canonical `ownerId` across all projects.
  - **Removal Rules & Validation:**
    - Mandatory removal reason of &ge; 10 characters (`HTTP 400 Bad Request` if shorter).
    - Self-removal by the project owner is strictly blocked (`HTTP 400 Bad Request`).
    - Project mentor cannot be removed once the project is active (`HTTP 403 Forbidden`).
    - Removals are strictly rejected on locked/completed projects (`HTTP 400 Bad Request`).
  - **Post-Removal Integrity:**
    - Unapproved tasks of the removed member revert to `Unassigned` and `Open` (To Do) with proof links wiped clean.
    - Approved work, awarded XP, and reputation remain untouched in the ledger.
    - Collaborator's join request / application row is marked `Removed` with the reason stored.
    - Removed user is recorded in project `removedUsers` and banned from re-applying (`HTTP 400 Bad Request`).
    - Only the removed collaborator receives a notification with the removal reason.
    - Project capacity count drops to reopen the collaborator slot, and an audit trail event (`member-removed`) is logged.
  - **Modal & Workspace UI:** Displays server error messages in the modal, disables "Confirm Remove" during submission with safe reset in a `finally` block, keeps modal open on failure, refreshes members list, counts, tasks, and displays a success toast.

- **Seed Data & Marketplace Integrity Rules:**
  - **Active-Only Seed Data:** Project repository seed data contains active projects only (`proj-1`, `proj-2`, `proj-4`, `proj-5`, `proj-6`, `proj-7`; Open and In Progress). Demo projects with Completed status (`proj-3`, `proj-8`), `isCompleted: true`, `completedAt`, or `finalLink` are not seeded.
  - **Marketplace Applicability Rule:** Completed and locked projects are filtered out of the collaborator Projects marketplace and recommendations (`ProjectsMarketplace.jsx`). Applying to a completed project fails on the backend with `HTTP 409 Conflict: "This project is completed"`.
  - **Legitimate Views:** Completed projects appear in designated contexts: Owner My Projects (Completed filter), Collaborator My Work (Completed tab), Mentor Mentored Projects, Admin Projects (Completed filter), and public user portfolio profiles.
  - **Gamification & Ledger Parity:** XP and reputation from removed seed projects are consolidated into users' primary "Seed data" entries, preserving exact user stats, totals, and leaderboard ranks.

### 🔒 Phase 19: Users Controller Lockdown & Shared Login Throttling
- **Privileged Creation & Public Signup Lockdown:** `POST /users` requires `@Roles('superuser')` (anonymous requests receive `401`, non-Super Users `403`), hashes an internal random password, dispatches a one-time password setup email without returning secrets, and logs `USER_CREATED_BY_SUPERUSER`. Public `/auth/signup` and `/auth/profile` permit only `Collaborator` and `Project Owner`.
- **Single Authenticated Login Path & Throttling:** Removed passwordless `POST /users/login`. Both `POST /auth/login` and `POST /admin/login` enforce non-empty string passwords (`400 PASSWORD_REQUIRED`), share `LoginThrottleService` (10 failures/account & 30/IP per 15-minute window -> `429 TOO_MANY_ATTEMPTS` + `retryAt` + `LOGIN_THROTTLED` audit; per-account counter reset on valid login), and return identical `401 INVALID_CREDENTIALS` responses for missing users or wrong passwords.
- **Admin Portal Refresh Cookie & Session Persistence (`POST /admin/auth/refresh`, `POST /admin/auth/logout`):** Successful `POST /admin/login` issues a separate `httpOnly`, `SameSite=Strict`, `Path=/admin/auth` opaque refresh cookie (`teamforge_admin_refresh_token`, SHA-256 hashed in `AdminRefreshService`, strict single-use rotation with `REFRESH_REUSED` chain revocation, 12h idle TTL capped at 24h max session lifetime, plus suspension/role/`tokenVersion` checks and `POST /portal-admins/:id/revoke-sessions`). The React app keeps all admin access tokens and claims strictly in memory and restores `/admin/*` sessions across browser refreshes via single-flight `restoreAdminSession()`.
- **Self-Update Allow-List & Session Revocation:** `PATCH /users/:id` enforces own-account access (`403 NOT_YOUR_ACCOUNT`) and `SelfUpdateUserDto` + `SelfAccountUpdateGuard` allow-lists (`400 FIELD_NOT_ALLOWED` + `USER_UPDATE_REJECTED_FIELD` audit). Changing email resets `emailVerified: false`, sends a new verification link, and revokes other active sessions while retaining the caller's session.
- **Super User Account Deletion & Privacy:** `DELETE /users/:id` is Super User-only with a mandatory reason (`400 REASON_REQUIRED`), never allowed on Super Users (`403 CANNOT_DELETE_SUPERUSER`), checks open obligations (`409 ACCOUNT_HAS_OPEN_OBLIGATIONS`), runs full anonymisation, and logs `USER_DELETED_BY_SUPERUSER`. `GET /users` and cross-user `GET /users/:id` are restricted to Admins with `'users'` permission or Super Users, and `serializeSafeUser` / `stripUserSecrets` strips password hashes, tokens, reset codes, and OTP secrets across all responses.

### 🛡️ Phase 21: Legacy Route Retirement & Route Authorization Matrix
- **Retired Bypass Endpoints (`410 LEGACY_ENDPOINT_REMOVED`):** Retired all 4 legacy `/governance` report endpoints and 3 parallel `/mentorship` mentor-application endpoints, removed `GovernanceService` legacy reputation writes, deleted dead DTOs and client wrappers (`mentorshipApi.apply`/`getApplication`/`reviewApplication`), and kept only the 4 `/mentorship` badge routes as thin verified-token wrappers.
- **Verified Token Identity Only:** Removed remaining non-legacy `x-user-id` / `x-userid` / query `userId` fallbacks across support, mentor-applications, mentor-marketplace, mentor-lifecycle, mentor-requests, reports, appeals, admin, and uploads; locked `POST /auth/test-set-expiry` behind `@Roles('superuser')`.
- **Committed Route Matrix & Drift Guard:** Added `npm run test:routes` (`back-end/scripts/generate-route-matrix.ts`) using `DiscoveryService` + `Reflector` to maintain `back-end/test/route-auth-matrix.json` and enforce explicit public-route allow-list and unguarded-route checks in CI (`test/phase21.e2e-spec.ts`).

### 🔄 In-Memory Storage & Clean Restart Lifecycle (Fix 1)
- **No Disk Snapshots (In-Memory Only):** All backend stores run strictly **in memory** and always boot cleanly from seed (mock) data on every server start or restart (`src/persistence` and `snapshot.json` have been removed). Data created during a run is intentionally ephemeral until restart.
- **Boot Identity & Automatic Stale-Session Detection (`GET /health`, `X-Boot-Id`):** Every server start generates a fresh random `bootId` (`BootService`) returned in `GET /health` (`{ status: 'ok', bootId, startedAt }`) and stamped on every response header (`X-Boot-Id`). Access and refresh JWTs embed `bootId`; tokens from an earlier server boot or deleted accounts return `401 SESSION_INVALID`, prompting the frontend (`apiClient.js` + `AuthContext.jsx` + `src/utils/storage.js`) to clear stale browser storage and redirect once to `/login` with `"The server was restarted. Please log in again."`.
- **Upload Hygiene on Startup (`StartupCleanupService`):** When `CLEAN_UPLOADS_ON_START=true` (the default), startup automatically clears leftover files under `uploads/` and `secure-cvs/` not referenced by seed records so disk state stays aligned with in-memory seed data. Hourly runtime hygiene (`StorageHygieneService`, `STORAGE_HYGIENE_DRY_RUN`) cleans expired exports, orphan uploads, and deleted-account CVs while the server is running.

---

## ⚡ Performance & Optimization Benchmarks

Following a comprehensive audit and measurement cycle across all frontend routes and backend endpoints, targeted optimizations were implemented to eliminate bottlenecks, cut payload transfers, and guarantee bounded memory and query times.

### 📊 Before vs After Performance Summary

| Metric / Endpoint | Baseline | Optimized | Improvement | Fix Applied |
| :--- | :--- | :--- | :--- | :--- |
| **Initial Client JS Bundle** | 857.72 kB (Monolithic) | **288.39 kB** (`index.js`) | **-66.4%** | `React.lazy()` route-level code splitting across 40+ pages |
| **Initial Client CSS Bundle** | 208.93 kB (Monolithic) | **30.39 kB** (`index.css`) | **-85.5%** | Split per-route CSS chunks with shared fallback |
| **Audit Log Payload** | 8,654 B | **1,208 B** | **-86.0%** | Pagination slicing, retention caps & gzip compression |
| **Admin Users Payload** | 7,615 B | **1,784 B** | **-76.6%** | Eliminated N+1 project queries & enabled response gzip |
| **Projects List Payload** | 4,417 B | **1,123 B** | **-74.6%** | Built-in compression & pagination parameters |
| **Tasks by Project Payload** | 1,033 B | **429 B** | **-58.5%** | $O(1)$ `tasksByProjectId` Map index + compression |
| **Mentors Directory Payload** | 1,805 B | **758 B** | **-58.0%** | Selective DTO projection & response compression |
| **Idle Chat Polling Chatter** | Every 3s continuous | **Every 6s, paused when hidden** | **-83.3%** | Page visibility detection (`document.hidden`, `visibilitychange`) |
| **Concurrent Duplicate Fetches**| Redundant HTTP requests | **1 shared Promise** | **100% deduplicated** | In-flight request deduplication & 20s client cache |
| **1,000 Repository Queries (2k tasks)** | Array scans $O(N)$ | **0.117 ms total** | **$O(1)$ Bounded** | Repository Map indexes maintained on mutations |
| **In-Memory Retention Cap** | Unbounded memory growth | **Capped at 5,000 items** | **Bounded Memory** | Hard retention caps on notifications & audit log |

### 🔍 Verification Commands

```bash
# 1. Run in-memory repository stress test & retention check (200 users, 100 projects, 2k tasks, 6k notifs):
cd back-end
npx ts-node test/stress-performance.spec.ts

# 2. Verify frontend production bundle sizes and code-splitting:
cd React-Implementation/React-Implementation
npm run build

# 3. View comprehensive findings & benchmark reports:
# - docs/performance-findings.md
# - docs/performance-results.md
```

---

## 👥 Seeded Demo Accounts & Credentials

| Persona | Email / Identifier | Password | Suggested Test Scenarios |
| :--- | :--- | :--- | :--- |
| **Super User** | `superuser@teamforge.io` | `Super@123` | Full system portal access, manage administrator permissions, system audit logs |
| **Administrator** | `admin@teamforge.io` | `admin123` | Review mentor applications (CV inspection, DigiLocker credentials, rejection with reason), dispute resolution |
| **Project Owner** | `jathin@example.com` | `password123` | Create projects with DatePicker deadlines, review applicant profiles, book mentor with UPI QR code |
| **Collaborator** | `arjun.sharma@teamforge.io` | `password123` | Apply to projects, complete tasks, apply for Mentor role (upload CV & connect DigiLocker sandbox) |
| **Mentor** | `kiran.bose@teamforge.io` | `password123` | Review mentor session requests, guide projects, award recommendation badges |

---

## 🛠️ Quick Start & Running Locally

### 1. Back-End Setup
> **Note:** Back-end data is held **in memory only** and resets to the seeded mock data on every restart (`CLEAN_UPLOADS_ON_START=true` clears unseeded local upload/export artifacts on start). Uploaded files and CVs default to `UPLOAD_DIR` (`back-end/.runtime/uploads` and `back-end/.runtime/uploads/secure-cvs`), which is gitignored and excluded from NestJS, TypeScript, Nodemon, and Vite file watchers so dev servers never restart on upload.

```bash
cd back-end
npm install

# Start offline / local JWT server
npm start

# Start offline development server without watch restarts (stable testing)
npm run start:dev:stable
```

### 2. Front-End Setup
```bash
cd React-Implementation/React-Implementation
npm install

# Start Vite development server
npm run dev
```

### 3. Running Automated Test Suites
```bash
# Back-end: TypeScript compile check, unit tests, and Supertest E2E tests
cd back-end
npx tsc --noEmit
npm test          # Runs Jest unit tests (ClockService, GamificationService, AdminService)
npm run test:e2e  # Runs Supertest E2E tests (Phase 1 moderation & suspension cascades)

# Front-end: Linting, Vitest tests, and production build
cd ../React-Implementation/React-Implementation
npm run lint      # ESLint verification (--max-warnings 0)
npm test          # Vitest suite (AdminUserDetails, ProjectCard)
npm run build     # Production bundle build

# API Tests (REST Client format)
# Open docs/api-tests/phase-1.http in VS Code / IDE with REST Client extension
```

### Before you push
Run the verification scripts in both projects before pushing any commit:

```bash
# Front end (ESLint with --max-warnings 0 + Vitest)
cd React-Implementation/React-Implementation
npm run lint
npm run check

# Back end (TypeScript typecheck + lint + Jest)
cd back-end
npm run lint
npm run typecheck
npm run check
```

### Code quality rules
- Never add `eslint-disable` comments or `@ts-ignore` without a short written reason explaining why the rule is wrong for that exact line.
- Run `npm run check` in both `React-Implementation/React-Implementation` and `back-end` before pushing.
- Fix warnings immediately when you see them (`--max-warnings 0` is enforced on `npm run lint`).
- Fix React hooks dependency warnings with stable callbacks, refs, or effect-local helpers instead of suppressing them or creating fetch loops.
- Remove unused imports, variables, parameters, and dead code as soon as they become unused.

#### Legacy Test Suites (ts-node):
```bash
cd back-end

# Phase 0: RBAC & Auth Security Matrix (20 checks)
npx ts-node test/rbac-security.spec.ts

# Phase 2: Gamification Ledger (10 checks)
npx ts-node test/phase2.spec.ts

# Phase 3: DatePicker & Due Dates (9 checks)
npx ts-node test/phase3.spec.ts

# Phase 4: Owner Public Profile Inspection (7 checks)
npx ts-node test/phase4.spec.ts

# Phase 5: Project Capacity & Collaborator Limit (9 checks)
npx ts-node test/phase5.spec.ts

# Phase 6: Single Mentor & Clean Escrow (12 checks)
npx ts-node test/phase6.spec.ts

# Phase 7: Demo UPI QR Payment & Escrow (10 checks)
npx ts-node test/phase7.spec.ts

# Phase 8: Mentor CV Upload & DigiLocker (14 checks)
npx ts-node test/phase8.spec.ts

# Phase 20: Resource Authorization, Uploads Magic-Bytes, Notifications & Content Filter
node --experimental-vm-modules ./node_modules/jest/bin/jest.js src/tasks/phase20.spec.ts
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config test/jest-e2e.json test/phase20.e2e-spec.ts --runInBand

# Phase 21: Legacy Route Retirement & Route Authorization Matrix
npm run test:routes
node --experimental-vm-modules ./node_modules/jest/bin/jest.js src/common/utils/phase21.spec.ts
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config test/jest-e2e.json test/phase21.e2e-spec.ts --runInBand

# Phase 22: Single Reputation Ledger & Completion Anti-Farming
node --experimental-vm-modules ./node_modules/jest/bin/jest.js src/moderation/phase22.spec.ts
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config test/jest-e2e.json test/phase22.e2e-spec.ts --runInBand

# Phase 24: Project & Account Lifecycle Cleanup
node --experimental-vm-modules ./node_modules/jest/bin/jest.js src/jobs/phase24-jobs.spec.ts
node --experimental-vm-modules ./node_modules/jest/bin/jest.js src/users/phase24.spec.ts
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config test/jest-e2e.json test/phase24.e2e-spec.ts --runInBand

# Phase 25: Mentor Booking Integrity
node --experimental-vm-modules ./node_modules/jest/bin/jest.js src/mentor-marketplace/phase25.spec.ts
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config test/jest-e2e.json test/phase25.e2e-spec.ts --runInBand

# Phase 26: Front-End Parity & Notification Aggregation
node --experimental-vm-modules ./node_modules/jest/bin/jest.js src/notifications/phase26.spec.ts
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config test/jest-e2e.json test/phase26.e2e-spec.ts --runInBand

# Phase 27: Admin Support Inbox
node --experimental-vm-modules ./node_modules/jest/bin/jest.js src/support/phase27.spec.ts
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config test/jest-e2e.json test/phase27.e2e-spec.ts --runInBand

# Phase 28: Starter Task Templates
node --experimental-vm-modules ./node_modules/jest/bin/jest.js src/projects/phase28.spec.ts
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config test/jest-e2e.json test/phase28.e2e-spec.ts --runInBand
```
