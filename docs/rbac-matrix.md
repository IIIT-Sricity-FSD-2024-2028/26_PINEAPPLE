# Role-Based Access Control (RBAC) Matrix & Audit Report

**Generated on:** 2026-10-26  
**Status:** **DONE** (100% Enforced on Backend & Frontend)  
**Active Auth Modes:** `firebase` (Primary / Default with serviceAccountKey), `jwt` (Offline / Fallback), `legacy` (Header-based backward compatibility)

---

## 1. Authentication & RBAC Architecture Summary

| Property | Details |
| :--- | :--- |
| **Active Default Mode** | `firebase` (backend) / `firebase` (frontend `VITE_AUTH_MODE`) |
| **Token Verification** | **Firebase ID Token** verified via `firebase-admin.auth().verifyIdToken(token, checkRevoked)` with automatic dual-compatibility fallback to **HS256 JWT** verified via `JwtService` for offline test suites. |
| **Identity Extraction** | Verified token payload sets `request.user = { uid, email, role, permissions, claims, name, username }`. In non-legacy mode, headers `x-user-id` and `x-user-role` are completely ignored. |
| **Role Source** | Extracted from Firebase Custom User Claims (`decoded.role` or `decoded.claims.role`) and cross-checked with the server-side user repository. |
| **Role Switch** | Endpoint `POST /auth/switch-role` sets Firebase Custom User Claims via `setCustomUserClaims(userId, { role })` and re-issues refreshed tokens. Switching to `Admin` or `SuperUser` is strictly prohibited (HTTP 403). Switching to `Mentor` requires approved application (HTTP 403). |
| **Admin Permissions** | Dynamic portal admin permissions (`['users']`, `['projects']`, `['mentor_apps']`, `['revenue']`, `['audit']`, `['dashboard']`, `['manage_admins']`, `['config']`, `['reports']`) enforced per-route in `RolesGuard` (HTTP 403 on missing permission). Super User automatically holds wildcard `['*']` with full access to all sections. Moderation actions and reports/appeals handling strictly require the `reports` or `users` permission for Admin tokens. Mentor application approval and rejection strictly require the `mentor_apps` permission for Admin tokens. Project deletions by admins require the `projects` permission. Escrow and session statistics require `revenue`. |
| **Account Suspension** | Immediate suspension check in global `AuthGuard` and `RolesGuard` blocks requests with HTTP 403 Forbidden and revokes active tokens. |
| **Rate Limiter & Maintenance** | Keyed by verified `request.user.uid` (not spoofable client IP or header). Maintenance mode returns HTTP 503 to non-portal admins. |

---

## 2. Complete Backend Route RBAC Matrix

The following table lists every registered controller route, HTTP method, required roles, and enforcing guards:

| Method | Route Path | Controller | Allowed Roles | Enforcing Guard |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-test` | `app.controller.ts` | Administrator | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/admin/audit` | `admin.controller.ts` | admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/admin/audit` | `admin.controller.ts` | user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/admin/config` | `admin.controller.ts` | admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/admin/config` | `admin.controller.ts` | superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/admin/config/public` | `admin.controller.ts` | Public (Any / Unauthenticated) | AuthGuard (Global APP_GUARD) |
| `POST` | `/admin/jobs/tick` | `admin.controller.ts` | superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/admin/jobs/runs` | `admin.controller.ts` | admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/admin/jobs/runs/:id` | `admin.controller.ts` | admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/admin/login` | `admin.controller.ts` | Public (Any / Unauthenticated) | AuthGuard (Global APP_GUARD) |
| `GET` | `/admin/stats` | `admin.controller.ts` | admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/admin/system/integrity` | `admin.controller.ts` | SuperUser ONLY | AuthGuard + RolesGuard (Returns or refreshes `IntegrityCheckService` report across persisted stores) |
| `POST` | `/admin/system/snapshot` | `admin.controller.ts` | SuperUser ONLY | AuthGuard + RolesGuard (Saves atomic schema v2 snapshot stripping secrets/tokens/OTPs) |
| `GET` | `/admin/mentor-sessions/needs-review` | `admin.controller.ts` | admin (requires `'reports'` section), superuser | AuthGuard + RolesGuard (Lists mentor sessions flagged `needs_review` by snapshot integrity check) |
| `POST` | `/admin/mentor-sessions/:id/clear-review` | `admin.controller.ts` | admin (requires `'reports'` section), superuser | AuthGuard + RolesGuard (`400 REASON_REQUIRED`, `409 SESSION_NOT_NEEDS_REVIEW`, logs `SESSION_REVIEW_CLEARED`) |
| `GET` | `/admin/users` | `admin.controller.ts` | admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/admin/users/duplicates` | `admin.controller.ts` | admin (requires `'users'` section), superuser | AuthGuard + RolesGuard (Returns normalized email & verified phone duplicate groups) |
| `GET` | `/admin/reputation/reconcile` | `admin.controller.ts` | SuperUser ONLY | AuthGuard + RolesGuard (Reconciles single `ReputationService` ledger sums against profile & leaderboard views) |
| `GET` | `/admin/users/:id` | `admin.controller.ts` | admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/admin/users/:id/flag` | `admin.controller.ts` | admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PATCH` | `/admin/users/:id/status` | `admin.controller.ts` | admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/admin/users/:id/status` | `admin.controller.ts` | admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/admin/users/:id/status` | `admin.controller.ts` | admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/admin/users/:id/warn` | `moderation.controller.ts` | admin, superuser (requires 'users' section) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/admin/users/:id/warn` | `moderation.controller.ts` | admin, superuser (requires 'users' section) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/admin/users/:id/suspend` | `moderation.controller.ts` | admin, superuser (requires 'users' section) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/admin/users/:id/suspend` | `moderation.controller.ts` | admin, superuser (requires 'users' section) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/admin/users/:id/reactivate` | `moderation.controller.ts` | admin, superuser (requires 'users' section) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/admin/users/:id/reactivate` | `moderation.controller.ts` | admin, superuser (requires 'users' section) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/admin/users/:id/warnings` | `moderation.controller.ts` | admin, superuser (requires 'users' section) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/users/me/warnings` | `moderation.controller.ts` | user (authenticated user) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/users/search` | `users.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `POST` | `/reports` | `reports.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/reports/mine` | `reports.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/admin/reports` | `reports.controller.ts` | admin, superuser (requires 'reports' section) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/admin/reports/:id` | `reports.controller.ts` | admin, superuser (requires 'reports' section) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PATCH` | `/admin/reports/:id/status` | `reports.controller.ts` | admin, superuser (requires 'reports' section) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/admin/reports/:id/action` | `reports.controller.ts` | admin, superuser (requires 'reports' section) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/warnings/:id/appeal` | `appeals.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/users/me/appeals` | `appeals.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/admin/appeals` | `appeals.controller.ts` | admin, superuser (requires 'reports' section) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/admin/appeals/:id/decision` | `appeals.controller.ts` | admin, superuser (requires 'reports' section) | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/auth/change-password` | `auth.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `POST` | `/auth/forgot-password` | `auth.controller.ts` | Public (Any / Unauthenticated) | AuthGuard (Global APP_GUARD) |
| `POST` | `/auth/login` | `auth.controller.ts` | Public (Any / Unauthenticated) | AuthGuard (`400 PASSWORD_REQUIRED`; `429 TOO_MANY_ATTEMPTS` via `LoginThrottleService` 10/acct & 30/IP per 15m; identical `401 INVALID_CREDENTIALS`) |
| `POST` | `/auth/logout` | `auth.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `POST` | `/auth/logout-all` | `auth.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/auth/me` | `auth.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `POST` | `/auth/profile` | `auth.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `POST` | `/auth/refresh` | `auth.controller.ts` | Public (Any / Unauthenticated) | AuthGuard (Global APP_GUARD) |
| `POST` | `/auth/reset-password` | `auth.controller.ts` | Public (Any / Unauthenticated) | AuthGuard (Global APP_GUARD) |
| `GET` | `/auth/resolve-identifier` | `auth.controller.ts` | Public (Any / Unauthenticated) | AuthGuard (Global APP_GUARD) |
| `POST` | `/auth/signup` | `auth.controller.ts` | Public (Any / Unauthenticated) | AuthGuard (`Collaborator` / `Project Owner` only -> `400`/`403` for elevated roles; ContentFilterService; sets `emailVerified: false`, sends 24h verification email, scans duplicates) |
| `POST` | `/auth/verify-email` | `auth.controller.ts` | Public (Any / Unauthenticated) | AuthGuard (Single-use 24h verification token via ClockService) |
| `POST` | `/auth/resend-verification` | `auth.controller.ts` | Authenticated User (Any role) | AuthGuard (2-minute cooldown -> 429 `RESEND_COOLDOWN`) |
| `POST` | `/auth/switch-role` | `auth.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `POST` | `/auth/test-set-expiry` | `auth.controller.ts` | SuperUser ONLY | AuthGuard + RolesGuard (Locked from `@Public()` to `@Roles('superuser')` in Phase 21) |
| `POST` | `/communication/messages` | `communication.controller.ts` | Authenticated Verified Project Member / Admin | AuthGuard + EmailVerifiedGuard (403 `EMAIL_NOT_VERIFIED`, `CHAT_MEMBERSHIP_REQUIRED`; flags content matches without blocking) |
| `POST` | `/communication/messages/:id/report` | `communication.controller.ts` | Project Member except author / Admin | AuthGuard (403 `CHAT_MEMBERSHIP_REQUIRED`, 400 `CANNOT_REPORT_SELF`, 409 `ALREADY_REPORTED`, 429 `TOO_MANY_REPORTS`; preserves 20-msg snapshot) |
| `GET` | `/communication/messages/project/:projectId` | `communication.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/communication/notifications` | `communication.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `PATCH` | `/communication/notifications/:id/read` | `communication.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/communication/unread` | `communication.controller.ts` | Authenticated User (Any role) | AuthGuard (Returns unread counts across caller's active memberships) |
| `POST` | `/communication/projects/:id/read` | `communication.controller.ts` | Project Member (Owner/Mentor/Collaborator), Admin | AuthGuard (403 `CHAT_MEMBERSHIP_REQUIRED` for non-members/former members) |
| `GET` | `/escrow` | `escrow.controller.ts` | admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/escrow/:id` | `escrow.controller.ts` | admin, superuser, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/gamification/:userId/ledger` | `gamification.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/gamification/leaderboard` | `gamification.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| ~~`GET`~~ | ~~`/governance/reports`~~ | `governance.controller.ts` | *Retired (`410 LEGACY_ENDPOINT_REMOVED`)* | AuthGuard (Replaced by `GET /admin/reports`) |
| ~~`POST`~~ | ~~`/governance/reports`~~ | `governance.controller.ts` | *Retired (`410 LEGACY_ENDPOINT_REMOVED`)* | AuthGuard (Replaced by `POST /reports`) |
| ~~`GET`~~ | ~~`/governance/reports/:id`~~ | `governance.controller.ts` | *Retired (`410 LEGACY_ENDPOINT_REMOVED`)* | AuthGuard (Replaced by `GET /admin/reports/:id`) |
| ~~`PATCH`~~ | ~~`/governance/reports/:id/resolve`~~ | `governance.controller.ts` | *Retired (`410 LEGACY_ENDPOINT_REMOVED`)* | AuthGuard (Replaced by `PATCH /admin/reports/:id/status` & `POST /admin/reports/:id/action`) |
| `GET` | `/join-requests` | `join-requests.controller.ts` | admin, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/join-requests/mine` | `join-requests.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `POST` | `/join-requests` | `join-requests.controller.ts` | admin, user (verified email) | AuthGuard + RolesGuard + EmailVerifiedGuard (403 `EMAIL_NOT_VERIFIED` if unverified) |
| `DELETE` | `/join-requests/:id` | `join-requests.controller.ts` | admin, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/join-requests/:id` | `join-requests.controller.ts` | admin, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/join-requests/:id` | `join-requests.controller.ts` | admin, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PATCH` | `/join-requests/:id` | `join-requests.controller.ts` | Project Owner, Admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/join-requests/:id/status` | `join-requests.controller.ts` | admin, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PATCH` | `/join-requests/:id/status` | `join-requests.controller.ts` | Project Owner, Admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/mentor-applications` | `mentor-applications.controller.ts` | admin, project-owner, collaborator, mentor, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/mentor-applications` | `mentor-applications.controller.ts` | admin, project-owner, collaborator, mentor, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `DELETE` | `/mentor-applications/:id` | `mentor-applications.controller.ts` | admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/mentor-applications/:id` | `mentor-applications.controller.ts` | admin, project-owner, collaborator, mentor, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/mentor-applications/:id` | `mentor-applications.controller.ts` | admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/mentor-applications/:id/approve` | `mentor-applications.controller.ts` | admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/mentor-applications/:id/reject` | `mentor-applications.controller.ts` | admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/mentor-marketplace/mentors` | `mentor-marketplace.controller.ts` | user, admin, project-owner, collaborator, mentor, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/mentor-marketplace/mentors/:id` | `mentor-marketplace.controller.ts` | user, admin, project-owner, collaborator, mentor, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PATCH` | `/mentor-marketplace/mentors/availability` | `mentor-marketplace.controller.ts` | mentor, admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PATCH` | `/mentor-marketplace/mentors/confirm-role` | `mentor-marketplace.controller.ts` | mentor, admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/mentor-marketplace/mentors/me` | `mentor-marketplace.controller.ts` | mentor, admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PATCH` | `/mentor-marketplace/mentors/profile` | `mentor-marketplace.controller.ts` | mentor, admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/mentor-marketplace/mentors/profile` | `mentor-marketplace.controller.ts` | mentor, admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/mentor-marketplace/sessions` | `mentor-marketplace.controller.ts` | admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/mentor-marketplace/sessions/:id/accept` | `mentor-marketplace.controller.ts` | mentor, admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/mentor-marketplace/sessions/:id/cancel` | `mentor-marketplace.controller.ts` | admin, superuser, project-owner | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/mentor-marketplace/sessions/:id/complete` | `mentor-marketplace.controller.ts` | project-owner, admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/mentor-marketplace/sessions/:id/decline` | `mentor-marketplace.controller.ts` | mentor, admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/mentor-marketplace/sessions/:id/retry-payout` | `mentor-marketplace.controller.ts` | admin, superuser, project-owner, mentor | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/mentor-marketplace/sessions/:id/review` | `mentor-marketplace.controller.ts` | user, project-owner, collaborator, admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/mentor-marketplace/sessions/:id/start` | `mentor-marketplace.controller.ts` | admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/mentor-marketplace/sessions/admin-stats` | `mentor-marketplace.controller.ts` | admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/mentor-marketplace/sessions/book` | `mentor-marketplace.controller.ts` | project-owner, admin, superuser (verified email) | AuthGuard + RolesGuard + EmailVerifiedGuard (403 `EMAIL_NOT_VERIFIED` if unverified) |
| `GET` | `/mentor-marketplace/sessions/mentor-view` | `mentor-marketplace.controller.ts` | mentor, admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/mentor-marketplace/sessions/mine` | `mentor-marketplace.controller.ts` | user, project-owner, collaborator, admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/mentor-requests` | `mentor-requests.controller.ts` | admin, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/mentor-requests` | `mentor-requests.controller.ts` | admin, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `DELETE` | `/mentor-requests/:id` | `mentor-requests.controller.ts` | admin, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/mentor-requests/:id` | `mentor-requests.controller.ts` | admin, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/mentor-requests/:id` | `mentor-requests.controller.ts` | admin, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/mentor-requests/:id/accept` | `mentor-requests.controller.ts` | admin, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/mentor-requests/:id/decline` | `mentor-requests.controller.ts` | admin, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| ~~`GET`~~ | ~~`/mentorship/application`~~ | `mentorship.controller.ts` | *Retired (`410 LEGACY_ENDPOINT_REMOVED`)* | AuthGuard (Replaced by `GET /mentor-applications/me`) |
| ~~`PATCH`~~ | ~~`/mentorship/application/:id/review`~~ | `mentorship.controller.ts` | *Retired (`410 LEGACY_ENDPOINT_REMOVED`)* | AuthGuard (Replaced by `PUT /mentor-applications/:id/approve` & `reject`) |
| ~~`POST`~~ | ~~`/mentorship/apply`~~ | `mentorship.controller.ts` | *Retired (`410 LEGACY_ENDPOINT_REMOVED`)* | AuthGuard (Replaced by `POST /mentor-applications`) |
| `POST` | `/mentorship/badge` | `mentorship.controller.ts` | Mentor, Administrator, SuperUser | AuthGuard + RolesGuard (Thin canonical badge issuer using verified JWT identity) |
| `POST` | `/mentorship/badges` | `mentorship.controller.ts` | Mentor, Administrator, SuperUser | AuthGuard + RolesGuard (Alias for `POST /mentorship/badge`) |
| `GET` | `/mentorship/badges/:userId` | `mentorship.controller.ts` | Authenticated User (`user`, `project-owner`, `collaborator`, `mentor`, `admin`, `superuser`) | AuthGuard + RolesGuard (Kept: no badge route outside `/mentorship`) |
| `GET` | `/mentorship/badges/project/:projectId` | `mentorship.controller.ts` | Authenticated User (`user`, `project-owner`, `collaborator`, `mentor`, `admin`, `superuser`) | AuthGuard + RolesGuard (Kept: no badge route outside `/mentorship`) |
| `GET` | `/payouts/transactions` | `payouts.controller.ts` | user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/ping` | `app.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/portal-admins` | `portal-admins.controller.ts` | superuser, portal_admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/portal-admins` | `portal-admins.controller.ts` | superuser, portal_admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `DELETE` | `/portal-admins/:id` | `portal-admins.controller.ts` | superuser, portal_admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/portal-admins/:id` | `portal-admins.controller.ts` | superuser, portal_admin | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/projects` | `projects.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `POST` | `/projects` | `projects.controller.ts` | ProjectOwner, Administrator (verified email) | AuthGuard + RolesGuard + EmailVerifiedGuard (403 `EMAIL_NOT_VERIFIED`; 400 min length/content filter; 429 `PROJECT_DAILY_LIMIT` counts deleted projects in 24h; 409 `OPEN_PROJECT_LIMIT`) |
| `DELETE` | `/projects/:id` | `projects.controller.ts` | ProjectOwner (target project), Admin, SuperUser | AuthGuard + RolesGuard (Soft delete setting `deletedAt`/`deletedBy`, closing pending requests as `system_closed` & cancelling pending invites; `409 PROJECT_HAS_ACTIVE_ESCROW` if session escrow active) |
| `POST` | `/admin/projects/:id/restore` | `admin.controller.ts` | Admin (`projects` permission), SuperUser | AuthGuard + RolesGuard (Restores soft-deleted project within 30 days; `409 RESTORE_WINDOW_PASSED` after 30 days) |
| `POST` | `/users/me/export` | `users.controller.ts` | Authenticated User (Self) | AuthGuard (`202` JSON archive ready 24h; `429 EXPORT_RATE_LIMIT` over 1/hour) |
| `GET` | `/users/me/export` | `users.controller.ts` | Authenticated User (Self) | AuthGuard (Lists caller's personal data export requests) |
| `GET` | `/users/me/export/:id` | `users.controller.ts` | Authenticated User (Owner only) | AuthGuard (`403` cross-user; `404 EXPORT_NOT_FOUND`) |
| `GET` | `/users/me/export/:id/download` | `users.controller.ts` | Authenticated User (Owner only) | AuthGuard (`200` JSON file; `403` cross-user; `404 EXPORT_EXPIRED` after 24h) |
| `POST` | `/users/me/delete/request-code` | `users.controller.ts` | Non-Admin Active Passwordless User (Self) | AuthGuard (`204 No Content`; emails single-use 6-digit code valid 10m via `ClockService`; 1/min rate limit -> `429 TOO_MANY_ATTEMPTS`) |
| `POST` | `/users/me/delete` | `users.controller.ts` | Non-Admin Active User (Self) | AuthGuard (Requires current password or emailed 6-digit code -> `400 REAUTH_REQUIRED` / `INVALID_PASSWORD` / `INVALID_CODE` / `CODE_EXPIRED`, `429 CODE_LOCKED` after 5 attempts; `409 ACCOUNT_HAS_OPEN_OBLIGATIONS`; releases project seats/tasks/CVs/exports/invites & writes `ACCOUNT_RELEASED`) |
| `GET` | `/users/me/settings` | `users.controller.ts` | Authenticated User (Self) | AuthGuard (Returns `{ digestEnabled, digestHour, utcOffsetMinutes }`) |
| `PATCH` | `/users/me/settings` | `users.controller.ts` | Authenticated User (Self) | AuthGuard (`400 INVALID_DIGEST_HOUR` outside `0..23` integer; flushes buffered digest when toggled off) |
| `GET` | `/projects/:id` | `projects.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/projects/:id/my-request-status` | `projects.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `PATCH` | `/projects/:id` | `projects.controller.ts` | ProjectOwner, Administrator | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PATCH` | `/projects/:id/deadline` | `projects.controller.ts` | ProjectOwner (Owner of project only) | AuthGuard + RolesGuard (Enforces future date, task bounds, 10+ char reason) |
| `POST` | `/projects/:id/complete` | `projects.controller.ts` | ProjectOwner, Administrator | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/projects/:id/leave` | `projects.controller.ts` | Collaborator (member) | AuthGuard (Requires category and 10-500 char reason) |
| `DELETE` | `/projects/:id/members/:memberId` | `projects.controller.ts` | ProjectOwner, Administrator | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/projects/:id/members/:userId/release-tasks` | `projects.controller.ts` | ProjectOwner (target project), Admin, SuperUser | AuthGuard + RolesGuard (403 non-owner/collab; 409 `NOTHING_TO_RELEASE`; preserves In Review & Completed) |
| `POST` | `/projects/:id/request-close` | `projects.controller.ts` | Active Collaborator (project member) | AuthGuard (403 `NOT_A_MEMBER`; 409 `NOT_ELIGIBLE` unless `ownerInactive30d`) |
| `POST` | `/projects/:id/close` | `projects.controller.ts` | Admin, SuperUser | AuthGuard + RolesGuard (Manual admin closure; runs Phase 9 refund settlement) |
| `POST` | `/admin/projects/:id/close` | `admin.controller.ts` | Admin (`projects` permission), SuperUser | AuthGuard + RolesGuard (`projects` section permission; runs Phase 9 refund settlement) |
| `POST` | `/projects/:id/publish` | `projects.controller.ts` | ProjectOwner, Administrator | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/projects/owner/:ownerId` | `projects.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/projects/:id/match` | `projects.controller.ts` | Authenticated User (Any role) | AuthGuard (Computes skill match % and missing skills without blocking apply) |
| `GET` | `/projects/:id/export.md` | `projects.controller.ts` | ProjectOwner (target project), Admin | AuthGuard (403 non-owner/non-admin; 409 `PROJECT_NOT_FINISHED` if active) |
| `POST` | `/projects/:id/clone` | `projects.controller.ts` | ProjectOwner (target project) | AuthGuard (403 non-owner; 409 `PROJECT_NOT_FINISHED` if active) |
| `POST` | `/projects/:id/invites` | `projects.controller.ts` | ProjectOwner (target project), Admin | AuthGuard (Max 5 open invites; 14d cooldown; 403 non-owner) |
| `GET` | `/projects/:id/invites` | `projects.controller.ts` | ProjectOwner (target project), Admin | AuthGuard (403 non-owner/non-admin) |
| `DELETE` | `/projects/:id/invites/:inviteId` | `projects.controller.ts` | ProjectOwner (target project), Admin | AuthGuard (403 non-owner/non-admin) |
| `POST` | `/invites/:id/accept` | `invites.controller.ts` | Invited User | AuthGuard (403 non-recipient; 409 `PROJECT_FULL` / `ACTIVE_PROJECT_CAP` / `INVITE_EXPIRED`) |
| `POST` | `/invites/:id/decline` | `invites.controller.ts` | Invited User | AuthGuard (403 non-recipient; optional `block: true` sets 14d cooldown) |
| `GET` | `/users/me/invites` | `users.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/users/me/phone/otp-status` | `users.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `POST` | `/users/me/phone/request-otp` | `users.controller.ts` | Authenticated User (Any role) | AuthGuard (409 `PHONE_ALREADY_USED`, 429 `OTP_LOCKED`) |
| `POST` | `/users/me/phone/verify-otp` | `users.controller.ts` | Authenticated User (Any role) | AuthGuard (5 wrong attempts -> voids code & 429 `OTP_LOCKED` 15m via ClockService) |
| `POST` | `/users/me/phone/failed-attempt` | `users.controller.ts` | Authenticated User (Any role) | AuthGuard (Records failed client OTP attempt; voids & locks on 5th) |
| `GET` | `/support` | `support.controller.ts` | admin, superuser, user, project-owner, collaborator, mentor | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/support` | `support.controller.ts` | admin, project-owner, collaborator, mentor, superuser, user | AuthGuard + RolesGuard (Global APP_GUARD) |
| `DELETE` | `/support/:id` | `support.controller.ts` | admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/support/:id` | `support.controller.ts` | admin, superuser, user, project-owner, collaborator, mentor | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/support/:id/status` | `support.controller.ts` | admin, superuser | AuthGuard + RolesGuard (Global APP_GUARD) |
| `POST` | `/tasks` | `tasks.controller.ts` | ProjectOwner, Collaborator, Mentor, Administrator | AuthGuard + RolesGuard (Global APP_GUARD) |
| `DELETE` | `/tasks/:id` | `tasks.controller.ts` | ProjectOwner, Collaborator, Administrator | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/tasks/:id` | `tasks.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `PATCH` | `/tasks/:id` | `tasks.controller.ts` | ProjectOwner, Collaborator (whitelisted fields only; `dueDate` returns 403 `FORBIDDEN_FIELD`), Mentor, Administrator | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PUT` | `/tasks/:id` | `tasks.controller.ts` | ProjectOwner, Collaborator (whitelisted fields only; `dueDate` returns 403 `FORBIDDEN_FIELD`), Mentor, Administrator | AuthGuard + RolesGuard (Global APP_GUARD) |
| `PATCH` | `/tasks/:id/status` | `tasks.controller.ts` | ProjectOwner, Collaborator, Mentor, Administrator | AuthGuard + RolesGuard (Rejection from `In Review` enforces 10-500 char reason) |
| `PUT` | `/tasks/:id/status` | `tasks.controller.ts` | ProjectOwner, Collaborator, Mentor, Administrator | AuthGuard + RolesGuard (Rejection from `In Review` enforces 10-500 char reason) |
| `POST` | `/tasks/:id/review` | `tasks.controller.ts` | ProjectOwner (target project), Admin, SuperUser | AuthGuard + RolesGuard (400 `REASON_REQUIRED` on reject without 10-500 char reason) |
| `POST` | `/tasks/:id/unassign` | `tasks.controller.ts` | Assigned Collaborator, ProjectOwner, Mentor, Administrator | AuthGuard + RolesGuard (400 `REASON_REQUIRED` if assignee drops within 24h of dueDate without 10-300 char reason) |
| `POST` | `/tasks/:id/comments` | `tasks.controller.ts` | ProjectOwner, Collaborator, Mentor, Administrator | AuthGuard + RolesGuard (Global APP_GUARD) |
| `GET` | `/tasks/project/:projectId` | `tasks.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/users` | `users.controller.ts` | Admin (`users` permission), SuperUser | AuthGuard + RolesGuard (Section check `'users'`; `stripUserSecrets` serializer) |
| `POST` | `/users` | `users.controller.ts` | SuperUser ONLY | AuthGuard + RolesGuard (`SuperUserCreateUserDto`; random internal password + password setup email, no password returned; `USER_CREATED_BY_SUPERUSER` audit) |
| `DELETE` | `/users/:id` | `users.controller.ts` | SuperUser ONLY | AuthGuard + RolesGuard (`403 CANNOT_DELETE_SUPERUSER` on Super User; `400 REASON_REQUIRED`; `409 ACCOUNT_HAS_OPEN_OBLIGATIONS`; Phase 18 anonymisation; `USER_DELETED_BY_SUPERUSER` audit) |
| `GET` | `/users/:id` | `users.controller.ts` | Account Owner (Self), Admin (`users` permission), SuperUser | AuthGuard (`403` otherwise; `stripUserSecrets` serializer; public users use `GET /users/:id/public-profile`) |
| `PATCH` | `/users/:id` | `users.controller.ts` | Authenticated Owner (Self only) | AuthGuard + RolesGuard + `SelfAccountUpdateGuard` (`403 NOT_YOUR_ACCOUNT`; `400 FIELD_NOT_ALLOWED` + `USER_UPDATE_REJECTED_FIELD`; email change resets `emailVerified`, sends verification mail, revokes other sessions) |
| `GET` | `/users/:id/badges` | `users.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| ~~`POST`~~ | ~~`/users/login`~~ | *(Removed in Phase 19)* | *Removed (`404`)* | Passwordless legacy login route removed; use `POST /auth/login` |
| `POST` | `/users/switch-role` | `users.controller.ts` | Authenticated User (Any role) | AuthGuard (Global APP_GUARD) |
| `GET` | `/users/username-available` | `users.controller.ts` | Public (Any / Unauthenticated) | AuthGuard (Global APP_GUARD) |

---

## 3. Security Verification Test Results

All verification tests were executed against the live NestJS backend running in `AUTH_MODE=firebase`:

| Test ID | Test Scenario | Request Under Test | Expected HTTP | Observed HTTP | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Missing / No token | `GET /auth/me` without header | 401 Unauthorized | **401 Unauthorized** | **PASS** |
| **SEC-02** | Expired access token | `GET /auth/me` with expired JWT | 401 Unauthorized | **401 Unauthorized** | **PASS** |
| **SEC-03** | Tampered token payload | `GET /auth/me` with payload modified to SuperUser | 401 Unauthorized | **401 Unauthorized** | **PASS** |
| **SEC-04** | Alg: none unsigned token | `GET /auth/me` with `{"alg":"none"}` header | 401 Unauthorized | **401 Unauthorized** | **PASS** |
| **SEC-05** | Invalid token signature | `GET /auth/me` signed with wrong secret key | 401 Unauthorized | **401 Unauthorized** | **PASS** |
| **SEC-06** | Valid access token | `GET /auth/me` with valid Bearer token | 200 OK | **200 OK** | **PASS** |
| **SEC-07** | Refresh token rotation | `POST /auth/refresh` with valid cookie | 200 OK + Rotated Cookie | **200 OK** | **PASS** |
| **SEC-08** | Invalid refresh token | `POST /auth/refresh` with invalid cookie | 401 Unauthorized | **401 Unauthorized** | **PASS** |
| **SEC-09** | Refresh token replay (theft detection) | Replaying consumed refresh token | 401 (All sessions revoked) | **401 Unauthorized** | **PASS** |
| **SEC-10** | Immediate suspension enforcement | Suspended user calling `GET /projects` | 403 Forbidden | **403 Forbidden** | **PASS** |
| **SEC-11** | Logout single session | `POST /auth/logout` | 200 OK then 401 on refresh | **200 OK / 401** | **PASS** |
| **SEC-12** | Logout all active sessions | `POST /auth/logout-all` (tokenVersion bump) | 401 Unauthorized on old token | **401 Unauthorized** | **PASS** |
| **SEC-13** | Privilege Escalation via Role Switch | Collaborator calling `POST /users/switch-role` for Admin | 403 Forbidden | **403 Forbidden** | **PASS** |
| **SEC-14** | Forged Header Impersonation | Collaborator sending `x-user-role: Project Owner` on `POST /projects` | 403 Forbidden (Header ignored) | **403 Forbidden** | **PASS** |
| **SEC-15** | Collaborator calling Mentor route | Collaborator calling `GET /mentor-marketplace/sessions/mentor-view` | 403 Forbidden | **403 Forbidden** | **PASS** |
| **SEC-16** | Collaborator calling Admin route | Collaborator calling `GET /admin/users` | 403 Forbidden | **403 Forbidden** | **PASS** |
| **SEC-17** | Admin calling SuperUser-only route | Admin calling `PUT /admin/config` | 403 Forbidden | **403 Forbidden** | **PASS** |
| **SEC-18** | SuperUser calling SuperUser-only route | SuperUser calling `PUT /admin/config` | 200 OK | **200 OK** | **PASS** |
| **SEC-19** | Scoped Admin without section permission | Admin with `['audit']` calling `GET /admin/users` | 403 Forbidden | **403 Forbidden** | **PASS** |
| **SEC-20** | Scoped Admin with section permission | Admin with `['audit']` calling `GET /admin/audit` | 200 OK | **200 OK** | **PASS** |

---

## 4. Final Verdict

- **Audit Status:** **DONE**
- **Vulnerabilities Resolved:** 0 remaining. Header spoofing blocked, owner checks restricted to verified UID, token manipulation rejected, role elevation blocked, section-level permissions enforced.

---

## 5. Change Log

- **Phase 2 (Project Suspend and Delete Removal):**
  - Removed endpoint `DELETE /projects/:id` (now returns 404 Not Found).
  - Deprecated and removed project-level `Suspended` status. Any existing suspended projects are repaired to `Open` or `In Progress` based on tasks.
  - Admin Project Details and Admin Projects list updated to read-only views.
  - User-level moderation (`PUT /admin/users/:id/suspend`, etc.) remains strictly preserved.

- **Phase 3 (Per-Project Chat and Membership Role Governance):**
  - Project chat (`POST /communication/messages`) enforces strict membership validation: requests from non-members and former members are rejected with `HTTP 403 Forbidden`.
  - Roles returned in chat and workspaces (`GET /communication/messages/project/:projectId`, etc.) are computed server-side via `getProjectRole` based on actual project membership (Owner, Mentor, Collaborator, or Former member), discarding client-supplied `x-user-role` headers or global claims.
  - Stored `role` attributes in existing message records purged on startup and dynamically evaluated on query.
- **Policy Plan Phase 12 (Stuck Projects, Requests & Inactivity):**
  - Added `POST /projects/:id/members/:userId/release-tasks` restricted to project owners, Admins, and SuperUsers (non-owners/collaborators receive 403; empty releasable set returns 409 `NOTHING_TO_RELEASE`).
  - Added `POST /projects/:id/request-close` restricted to active collaborators (returns 403 for non-members/owners and 409 `NOT_ELIGIBLE` before 30 days of owner inactivity; creates a `'Project Closure Request'` admin case).
  - Added `POST /projects/:id/close` and `POST /admin/projects/:id/close` restricted to Admins (`projects` permission) and SuperUsers for manual `"Owner inactive"` closure with Phase 9 escrow settlement.
- **Policy Plan Phase 13 (Task Review & Feedback):**
  - Added `POST /tasks/:id/review` restricted to project owners, Admins, and SuperUsers; rejecting requires 10-500 char reason (`400 REASON_REQUIRED`).
  - Added `POST /tasks/:id/unassign` allowing assignees/owners to drop open/in-progress tasks, enforcing a 10-300 char reason when dropped within 24 hours of due date (`400 REASON_REQUIRED`).
  - Enforced role-based field whitelist on `PATCH/PUT /tasks/:id`, returning `403 FORBIDDEN_FIELD` when non-owners submit `dueDate` or restricted structural task fields.
- **Policy Plan Phase 14 (Mentor Lifecycle):**
  - Added `POST /projects/:id/mentor/abandonment-review` restricted to the project owner (collaborators and non-owners receive `403 Forbidden`; active <7d throws `409 MENTOR_STILL_ACTIVE`; cooldown <14d throws `409 REVIEW_COOLDOWN`).
  - Added `GET /projects/:id/mentor/abandonment-review` restricted to project owner, assigned mentor, Admins, and SuperUsers (collaborators receive `403 Forbidden`).
  - Added `GET /mentor/abandonment-reviews/mine` and `POST /mentor/abandonment-reviews/:id/confirm` restricted to the assigned mentor (or Admins/SuperUsers), logging activity and restarting the 7-day clock.
  - Added `POST /admin/abandonment-reviews/:id/cancel` restricted to Admins (`mentor_apps` permission) and SuperUsers, requiring a written reason (`400 REASON_REQUIRED`).
  - Added `POST /mentor-sessions/:id/feedback` (and `/mentor-marketplace/sessions/:id/feedback`) restricted to the project owner of a completed session (`400 INVALID_RATING`, `409 ALREADY_RATED`), with single comments and student identities hidden from collaborators and public `GET /mentor-marketplace/mentors/:id` and accessible in full only via `GET /admin/mentors/:id/feedback` (Admins/SuperUsers; `403` for collaborators) and aggregate-only via `GET /mentor-marketplace/mentors/me/stats`.
  - Added `POST /mentor-sessions/:id/notes` (and `/mentor-marketplace/sessions/:id/notes`) restricted to session mentor, owner, or Admins/SuperUsers to save session notes and record mentor activity.
- **Policy Plan Phase 15 (Collaboration UX):**
  - Enforced active membership cap (`maxActiveMemberships`, default 3) across `POST /join-requests`, `PATCH /join-requests/:id` (Approval), and `POST /invites/:id/accept` (`409 ACTIVE_PROJECT_CAP` with `currentCount`, `maxAllowed`, and `projects[]`; owning projects and Completed/Closed/Draft projects excluded).
  - Added `GET /projects/:id/match` returning non-blocking `{ percent, shared, missing }` skill match details.
  - Attached up to 3 skill-matched open `suggestedProjects` to rejected join requests and `APPLICATION_REJECTED` notifications.
  - Added direct project invitations (`POST/GET /projects/:id/invites`, `DELETE /projects/:id/invites/:inviteId`, `GET /users/me/invites`, `POST /invites/:id/accept`, `POST /invites/:id/decline`) with 7-day expiry, 5 open invite cap, 14-day removal/block cooldown, and serialized acceptance queueing.
  - Added per-user unread project chat tracking (`GET /communication/unread` and `POST /communication/projects/:id/read`) enforcing Phase 6 `CHAT_MEMBERSHIP_REQUIRED`.
  - Ranked `GET /users/search` results (exact username -> username prefix -> name prefix -> substring).
  - Added `GET /projects/:id/export.md` (owner/admin on Closed/Completed projects; `409 PROJECT_NOT_FINISHED` otherwise) and `POST /projects/:id/clone` (owner on Closed/Completed projects creating an isolated `Draft`).
- **Policy Plan Phase 16 (Trust & Safety):**
  - Added `POST /communication/messages/:id/report` restricted to current project members excluding message author (`403 CHAT_MEMBERSHIP_REQUIRED`, `400 CANNOT_REPORT_SELF`, `409 ALREADY_REPORTED`, `429 TOO_MANY_REPORTS` over `REPORT_DAILY_LIMIT` 10/day), saving a 20-message conversation snapshot (`messageSnapshot`) that persists after original message deletion.
  - Added `DuplicateDetectionService` and `GET /admin/users/duplicates` (`@Roles('admin', 'superuser')` requiring `'users'` permission -> 403 otherwise) to surface normalized Gmail/email and verified-phone groups without auto-blocking; enforced `409 PHONE_ALREADY_USED` across non-deleted accounts.
  - Added project creation caps (`maxProjectsPerDay` 3/24h -> `429 PROJECT_DAILY_LIMIT`, `maxProjectsPerUser` 10 open -> `409 OPEN_PROJECT_LIMIT`, title >= 5 `TITLE_TOO_SHORT`, description >= 100 `DESCRIPTION_TOO_SHORT`).
  - Added `EmailVerifiedGuard` enforcing verified email (`403 EMAIL_NOT_VERIFIED`) on `POST /projects`, `POST /join-requests`, `POST /communication/messages`, and `POST /mentor-marketplace/sessions/book`, paired with `@Public() POST /auth/verify-email` (24h single-use sha256 token) and `POST /auth/resend-verification` (2-min cooldown -> `429 RESEND_COOLDOWN`).
  - Added `ContentFilterService` blocking profanity/spam obfuscations on signup/profile/project inputs (`400 CONTENT_NOT_ALLOWED` + `{ field }`, audit `'CONTENT_BLOCKED'` without storing or echoing offensive text) and flagging matched chat messages without blocking send (`flaggedForAdmin: true`, audit `'chat-message-flagged'`).
  - Enforced 5-wrong-attempt phone OTP voiding & 15-minute `ClockService` lockout (`429 OTP_LOCKED`) across `/users/me/phone/request-otp`, `/users/me/phone/verify-otp`, `/users/me/phone/failed-attempt`, and `/users/me/phone/otp-status`.
- **Policy Plan Phase 17 (Disputes & Admin Accountability):**
  - Added `POST /mentor-sessions/:id/dispute` and `POST /mentor-marketplace/sessions/:id/dispute` restricted to the session owner or assigned mentor (collaborators/non-parties receive `403 NOT_SESSION_PARTY`) on `escrow_funded`/`active`/`payout_pending` sessions while active or within 7 days after session end (`409 DISPUTE_WINDOW_EXPIRED` / `SESSION_NOT_DISPUTABLE`), freezing session payout/refund (`409 SESSION_DISPUTED`).
  - Added `GET /admin/disputes` and `POST /admin/disputes/:id/decide` restricted to Admins (`reports` section permission) and SuperUsers, enforcing single-decision finality (`409 DISPUTE_ALREADY_DECIDED`), written reason 10-500 chars (`400 REASON_REQUIRED`), and validated `release_to_mentor` / `refund_to_owner` / `split` (0-100%, fee only on mentor part).
  - Added `GET /admin/projects/:id/escrow` restricted to Admins (`projects` section permission) and SuperUsers returning held/released/refunded/platform-fee totals and per-session dispute state.
  - Added `GET /admin/audit/export` restricted to Admins (`audit` section permission) and SuperUsers supporting CSV/JSON filters capped at 10,000 rows, CSV formula-prefix protection (`'=`, `'+`, `'-`, `'@`), and audit-logged exports.
  - Added `GET /admin/reports/owner-patterns` restricted to Admins (`reports` section permission) and SuperUsers summarizing 30-day join request and task review rejections/approvals per owner with non-punitive `"review pattern"` flags (`>= 5` rejections and `0` approvals).
  - Updated `POST /admin/users/:id/suspend` (and report suspension) for regular Admins to queue manual suspensions (`202 pending_second_approval`) when target account age `> 90` days or reputation `>= 150`, with `GET /admin/moderation-actions`, `POST /admin/moderation-actions/:id/approve`, and `POST /admin/moderation-actions/:id/reject` restricted to Admins (`users` permission) and SuperUsers and blocking self-approval (`403 SAME_ADMIN_NOT_ALLOWED`). SuperUsers and 4th-warning auto-suspensions continue executing immediately.
- **Policy Plan Phase 18 (Privacy, Deletion & Notifications):**
  - Reintroduced `DELETE /projects/:id` exclusively as a reversible **soft delete** for project owners, Admins, and SuperUsers (`deletedAt`/`deletedBy` stored; `isVisibleProject` hides across all non-admin lists/counts; `409 PROJECT_HAS_ACTIVE_ESCROW` blocks active/funded sessions), paired with `POST /admin/projects/:id/restore` (`409 RESTORE_WINDOW_PASSED` beyond 30 days).
  - Added personal data export (`POST /users/me/export`, `GET /users/me/export`, `GET /users/me/export/:id`, `GET /users/me/export/:id/download`) with 1/hour rate limit, 24h file expiry, owner-only access, and strict exclusion of other users' private data or secrets.
  - Added self-service account deletion (`POST /users/me/delete`) blocked for admins/suspended users (`403`) and accounts with unfinished owned projects, active/pending sessions, or held escrow (`409 ACCOUNT_HAS_OPEN_OBLIGATIONS`), revoking active JWTs/refresh tokens immediately (`401` on reuse), freeing original email for fresh signup (`0` ledger rep/XP), preserving chat/work as `"Deleted user"`, and replacing audit/report identifiers with irreversible SHA-256 hashed IDs.
- **Policy Plan Phase 19 (Users Controller Lockdown):**
  - Locked `POST /users` behind `@Roles('superuser')` with `SuperUserCreateUserDto`, internal random password hashing, one-time password setup link email via `AuthService.issuePasswordSetupLink`, no password/token returned in responses, and `USER_CREATED_BY_SUPERUSER` audit; restricted `/auth/signup` and `/auth/profile` to `Collaborator` and `Project Owner`.
  - Removed passwordless `POST /users/login` and `UsersService.login`; added shared `LoginThrottleService` (10 failures/account, 30 failures/IP per 15-minute `ClockService` window -> `429 TOO_MANY_ATTEMPTS` + `retryAt` + `LOGIN_THROTTLED` audit, per-account reset on valid login preserving IP count) and `400 PASSWORD_REQUIRED` + identical `401 INVALID_CREDENTIALS` across `POST /auth/login` and `POST /admin/login`.
  - Locked `PATCH /users/:id` via `SelfAccountUpdateGuard` + `SelfUpdateUserDto` (`403 NOT_YOUR_ACCOUNT` on cross-user edits, `400 FIELD_NOT_ALLOWED` + `USER_UPDATE_REJECTED_FIELD` audit on protected/unknown fields such as `role`/`status`/`emailVerified`/`xp`/`reputation`, and email change resetting `emailVerified = false`, dispatching verification mail, and revoking other sessions via `revokeOtherSessions` while preserving the caller's session `jti`).
  - Restricted `DELETE /users/:id` to `@Roles('superuser')` with mandatory written reason (`400 REASON_REQUIRED`), blocking Super User targets (`403 CANNOT_DELETE_SUPERUSER`), checking open obligations (`409 ACCOUNT_HAS_OPEN_OBLIGATIONS`), running Phase 18 anonymisation, and auditing `USER_DELETED_BY_SUPERUSER`.
  - Locked `GET /users` (Super User or Admin with `'users'` section) and `GET /users/:id` (self, Super User, or Admin with `'users'` section), applied `serializeSafeUser` / `stripUserSecrets` across user and admin responses, and migrated non-admin frontend routes off `/users`, `/users/:id`, and `/users/login`.
- **Policy Plan Phase 20 (Resource Authorization & Input Checks):**
  - Added reusable `ProjectAccessService` (`isOwner`, `isMember`, `assertOwnerOrAdmin`, `assertMemberOrOwner`) built on `common/utils/role.util.ts` and applied it across all `TasksController` routes (`POST /tasks`, `GET /tasks/project/:projectId`, `GET /tasks/:id`, `PATCH`/`PUT /tasks/:id`, `PATCH`/`PUT /tasks/:id/status`, `POST /tasks/:id/review`, `POST /tasks/:id/unassign`, `POST /tasks/:id/comments`, `DELETE /tasks/:id`), deriving `projectId` strictly from the stored task (`404 TASK_NOT_FOUND` on mismatched `projectId`, `403 NOT_A_PROJECT_MEMBER` + `ACCESS_DENIED_TASK` audit for non-members/removed users).
  - Enforced Open-only initial status (`400 INVALID_INITIAL_STATUS`) on `POST /tasks` and `ContentFilterService` (`400 CONTENT_NOT_ALLOWED`, no word echoed) on task titles/descriptions, task comments, mentor application text fields (`headline`, `bio`, `experience`, `motivation`, `expertise`, `name`), and project invite messages (`POST /projects/:id/invites`).
  - Locked `NotificationsController` `:id` routes to notification owners only (`404 NOTIFICATION_NOT_FOUND` + `ACCESS_DENIED_NOTIFICATION` audit on cross-user access), prevented non-admin `?userId=` leakage on `GET /notifications`, and restricted `POST /notifications` to Admins and Super Users with `AdminCreateNotificationDto` (10–500 character body).
  - Hardened uploads (`file-upload.middleware.ts`, `file-validation.util.ts`, `UploadsController`, `UploadAuditInterceptor`) to allow only PNG, JPG, JPEG, WEBP, and PDF verified by magic bytes (`400 UNSUPPORTED_FILE_TYPE` + `UPLOAD_REJECTED` audit on SVGs, empty files, or mismatched content), serve files through `UploadsController` with `X-Content-Type-Options: nosniff`, force `Content-Disposition: attachment` on PDFs/non-images, refuse `.svg` with `404`, and restrict `GET`/`DELETE /uploads/cv/:filename` and `DELETE /mentor-applications/:id/cv` to applicant, Admins with `'mentor_apps'`, and Super Users.
  - Attached `ADMIN_LOGIN_THROTTLED` audit action to `AdminService.login` throttling (`LoginThrottleService`) with identical `401 INVALID_CREDENTIALS` responses for missing and wrong passwords, and applied `EmailVerifiedGuard` (`403 EMAIL_NOT_VERIFIED`) to `POST /invites/:id/accept`, `POST /mentor-applications`, `POST /reports`, `POST /mentor-sessions/:id/dispute`, `POST /mentor-marketplace/sessions/:id/dispute`, and `POST /users/me/export`.
- **Policy Plan Phase 21 (Legacy Route Retirement & Route Authorization Matrix):**
  - Retired all 4 legacy `/governance` report endpoints (`POST /governance/reports`, `GET /governance/reports`, `GET /governance/reports/:id`, `PATCH /governance/reports/:id/resolve`) and 3 parallel `/mentorship` application endpoints (`POST /mentorship/apply`, `GET /mentorship/application`, `PATCH /mentorship/application/:id/review`) with HTTP `410 LEGACY_ENDPOINT_REMOVED` naming the canonical replacements (`/reports`, `/admin/reports*`, `/mentor-applications*`). Removed dead `GovernanceService` (eliminating legacy `-50`/`-15` `GamificationService.updateReputation` writes), dead governance/mentorship application DTOs and repo CRUD methods, and retired frontend wrappers (`apply`, `getApplication`, `reviewApplication`) in `mentorshipApi.js`.
  - Kept the 4 recommendation badge routes under `/mentorship` (`POST /mentorship/badge`, `POST /mentorship/badges`, `GET /mentorship/badges/:userId`, `GET /mentorship/badges/project/:projectId`) as thin canonical wrappers (no separate badge route exists outside `/mentorship`), strictly using verified `@CurrentUser()` identity in JWT mode.
  - Eliminated remaining non-legacy `x-user-id` / `x-userid` / query `userId` trust fallbacks across `SupportController`, `MentorApplicationsController` (`GET /mentor-applications/me`), `MentorMarketplaceController`, `MentorLifecycleController`, `MentorRequestsController`, `ReportsController`, `AppealsController`, `AdminController`, `UploadsController`, and `UploadAuditInterceptor`; locked unintended `@Public()` test endpoint `POST /auth/test-set-expiry` behind `@Roles('superuser')`.
  - Generated and committed `back-end/test/route-auth-matrix.json` via `DiscoveryService` + `MetadataScanner` + `Reflector` (`npm run test:routes`), paired with an explicit `PUBLIC_ROUTE_ALLOWLIST` (13 public routes) and E2E/unit anti-drift assertions that fail when routes are added, removed, made unexpectedly public, or left unguarded.
- **Policy Plan Phase 24 (Project & Account Lifecycle Cleanup):**
  - Centralized `isLiveProject(project)` (`!deletedAt && !isCompleted && !['draft', 'closed', 'completed', 'cancelled']`) across all 13 project-touching hourly jobs in `JobsService`, `MentorMarketplaceService`, and `ProjectInvitesService`, emitting one `JOB_SKIPPED_NOT_LIVE` counts-only audit entry per run and ensuring deadline penalties execute at most once per task (`penaltyAppliedAt` + `ReputationService.hasEntryForRef`).
  - Updated 24-hour project creation cap (`429 PROJECT_DAILY_LIMIT`) to include soft-deleted projects, and updated `DELETE /projects/:id` soft delete to close pending join requests (`system_closed`, `countedTowardLimit: false`, applicants notified `"Closed because the project was deleted"`) and cancel pending invites.
  - Added shared `FileCleanupService` (`StorageHygieneService`, `DataExportService`, `MentorApplicationsService`, `AccountDeletionService`) and full idempotent resource release on account deletion: removes user from project `collaborators`/`members` and transitions Approved join requests to `'left'` so seats clear, returns Open/In Progress tasks to `Unassigned` + `To Do` while preserving In Review/Completed as `"Deleted user"`, closes pending requests/invites, deletes disk CVs/personal uploads/exports (keeping retained task proof uploads), and audits `ACCOUNT_RELEASED` counts.
  - Replaced client-side `socialConfirmed` checkbox with `POST /users/me/delete/request-code` (`204 No Content`, 1/min rate limit, 6-digit single-use code valid 10m via `ClockService`, 5-attempt lockout -> `429 CODE_LOCKED`, verified email required, never in snapshots/audit) and enforced password verification (`400 INVALID_PASSWORD`) or emailed code (`400 REAUTH_REQUIRED` / `INVALID_CODE` / `CODE_EXPIRED`) on `POST /users/me/delete`; updated `route-auth-matrix.json` (`249` routes).
- **Policy Plan Phase 25 (Mentor Booking Integrity):**
  - Centralized `assertBookable(projectId, mentorId, ownerId, start, duration?, excludeSessionId?)` in `MentorMarketplaceService` validating in strict order: 1) live project via `isLiveProject` (`409 PROJECT_NOT_BOOKABLE` with Draft/Closed/Completed/deleted reason), 2) not self (`409 CANNOT_BOOK_SELF`), 3) not project collaborator/member (`409 CANNOT_BOOK_OWN_PROJECT_MENTOR`), 4) mentor verified, active, available, non-suspended (`409 MENTOR_SUSPENDED` / `MENTOR_UNAVAILABLE`), and under `maxActiveMentees` (`409 MENTOR_AT_CAPACITY`), 5) Phase 9 booking window via `ClockService` (`400 BOOKING_OUTSIDE_WINDOW`), 6) mentor time-range conflict (`409 MENTOR_TIME_CONFLICT` with `conflictingRange` and no other project's name), and 7) owner time-range conflict (`409 OWNER_TIME_CONFLICT`); logs `BOOKING_REFUSED` audit entry on every refusal.
  - Applied `assertBookable` with deterministic sorted per-mentor, per-owner, per-project, and per-session queue locks (`runWithBookingLocks`) across `POST /mentor-marketplace/sessions/book`, `POST /mentor-marketplace/sessions/:id/confirm-payment`, `POST /mentor-marketplace/sessions/:id/pay`, and `POST /mentor-marketplace/sessions/:id/accept`.
  - Injected `@Optional() ClockService` into `DemoUpiProvider` and routed all booking, payment expiry (`30m`), accept, and completion timestamps in `MentorMarketplaceService` and `DemoUpiProvider` through `ClockService`, forwarding `conflictingRange`, `conflictStart`, and `conflictEnd` in `HttpExceptionFilter`.
- **Policy Plan Phase 26 (Front-End Parity & Notification Aggregation):**
  - Added `NotificationsService.sendGrouped(userId, groupKey, items, builder)`, `formatGroupedItemList(items, 10)`, and `dispatchGroupedNotification` so bulk task releases, project closures, suspension cascades, account deletion releases, invite cancellations, and hourly scheduled jobs emit ONE combined notification per affected user carrying `count`, `groupKey`, and `items` (`{ label, link }[]`, formatted up to 10 entries + `"and N more"`), while keeping `DigestService` count aggregation accurate and preserving original notification types.
  - Enforced `<SafeLink>` parity across all user-supplied URLs (`ProjectCard`, `CollaboratorWorkspace`, `OwnedWorkspace`, `AdminMentorApps`, `ForgotPassword`, and `notifications.jsx`) paired with a Vitest static `<a href={...}>` scan test; unified all dialogs and drawers (`SafeLink` confirmation, `AdminMentorApps` reject modal, `ScheduledJobsPanel` run drawer & confirm dialog, `MentorProjectWorkspace` badge dialog, `notifications` appeal dialog, and `closeDisabled` during active `MentorsDirectory` / `AdminReports` money actions) onto shared accessible `Modal.jsx` (focus-on-open, Tab/Shift+Tab trap, Escape guard, focus return, body scroll lock, `role="dialog"`, `aria-modal="true"`, `aria-labelledby`), and rendered expandable grouped notification lists in `notifications.jsx`.
- **Policy Plan Phase 27 (Admin Support Inbox):**
  - Added the `'support'` admin section permission in `RolesGuard` (`path.startsWith('/admin/support')`), `route-auth-matrix.ts` (`resolveAdminSectionPermission`, `'POST /support/tickets'` in `PUBLIC_ROUTE_ALLOWLIST`), `AdminLayout.jsx` (`🛟 Support Inbox` sidebar link -> `/admin/support`), `SuperuserAdmins.jsx` (`permOptions`), and `AdminSupport.jsx` (Super User always permitted; ordinary users and admins without `'support'` receive `403 FORBIDDEN`).
  - Added canonical user routes (`GET /support/tickets`, `@Public() POST /support/tickets`, `GET /support/tickets/:id`, `POST /support/tickets/:id/replies`) and admin routes (`GET /admin/support/tickets`, `GET /admin/support/assignees`, `GET /admin/support/tickets/:id`, `PATCH /admin/support/tickets/:id`, `POST /admin/support/tickets/:id/replies`, `POST /admin/support/tickets/:id/close-project`) backed by `SupportService` transition validation (`open` -> `in_progress`/`waiting_user`/`resolved`/`rejected`, terminal lock -> `409 INVALID_STATUS_CHANGE`, 10–500 char note -> `400 NOTE_REQUIRED`), 5-tickets/day cap (`429 TICKET_DAILY_LIMIT`), `ContentFilterService` on ticket subjects/messages (replies unfiltered), internal admin note redaction + cross-user `404 TICKET_NOT_FOUND`, Phase 12 `project_closure` health facts + `"Owner inactive"` project closure with Phase 9 escrow refund (`409 PROJECT_NOT_CLOSABLE` when closed/completed/deleted), audit logs (`TICKET_STATUS_CHANGED`, `TICKET_ASSIGNED`, `TICKET_REPLY`, `PROJECT_CLOSED_FROM_TICKET`), and Job #20 `supportTicketSuperUserReminder` notifying Super Users once after 7 days untouched (`SUPPORT_TICKET_OVERDUE`). Updated `back-end/test/route-auth-matrix.json` (`259` routes).
- **Policy Plan Phase 28 (Starter Task Templates):**
  - Added `GET /task-templates?category=` (`TaskTemplatesController`, any authenticated user), `GET /projects/:id/task-templates` (project owner or admin/superuser -> `403` otherwise), and `POST /projects/:id/task-templates/apply` (project owner only -> `403 OWNER_ONLY` for non-owners and admins), plus optional `category`, `starterTaskKeys[]`, and `starterTaskOverrides` on `POST /projects`.
  - Enforced `TASK_LIMIT_PER_PROJECT` (`30` default, `409 TASK_LIMIT_REACHED`) in `TasksService.create`, serialized batch creation inside the Phase 8 per-project queue via `TasksService.create` (guaranteeing Open & Unassigned initial state, `ContentFilterService` validation, due-date bounds, `409 TEMPLATE_TASK_EXISTS` duplicate-title prevention, and task completion counting), logged count-only `TEMPLATE_TASKS_ADDED` audit entries, and regenerated `back-end/test/route-auth-matrix.json`.
- **Phase 1 Removal (Project Health Completely Removed):**
  - Completely removed Project Health Telemetry: deleted `HealthService`, `ProjectViewsService`, `GET /projects/:id/health`, `POST /projects/:id/impression`, `POST /projects/:id/preview`, `project-health.config.ts`, frontend `ProjectHealthPanel`, `ProjectHealthSummary`, `useProjectHealth.js`, and projectsApi health helpers.
  - Kept owner response time telemetry (`GET /users/:id/response-time`), 3-day pending join request reminder (`remindPendingRequests`), deadline task shifting, and capacity guard. Regenerated `back-end/test/route-auth-matrix.json` (275 routes).
