# Other Waste, Redundancy & Protected Code Audit (`React-Implementation/React-Implementation`)

> **Scope:** Services, dead exports, components/routes/CSS/assets, Redux slices/thunks/reducers/tests, nested folders, stray/debug artifacts, `package.json` dependencies, and false-positive protections. All findings cite exact search/script evidence produced by [`analyze-deps.mjs`](./tools/analyze-deps.mjs), [`inspect-report.mjs`](./tools/inspect-report.mjs), [`deep-audit.mjs`](./tools/deep-audit.mjs), [`extra-checks.mjs`](./tools/extra-checks.mjs), and [`extra-checks2.mjs`](./tools/extra-checks2.mjs).

---

## 1. Services, Dead Barrel Re-Exports & Retired Legacy Layers

### A. Circular Re-Export Barrel in `src/services/apiClient.js`
- **Evidence (`extra-checks.mjs` & `madge --circular`):**
  - `src/services/apiClient.js` lines `740–753` contain `export * from "./usersApi.js"` through `export * from "./authApi.js"` (`14` wildcard re-exports).
  - `madge --circular --extensions js,jsx src` flags **all 14** as circular dependencies (`services/apiClient.js > services/<name>Api.js`).
  - Searching every import from `apiClient.js` across `src/` shows **zero files** import any `*Api.js` helper through `apiClient.js`. Every thunk imports directly from its specific `../../services/*Api.js` module.
- **Verdict:** Lines `740–753` of `apiClient.js` are dead backward-compatibility barrel exports that can be safely deleted to eliminate all 14 circular dependencies.

### B. Unused & Duplicate `*Api.js` Methods

| Service File | Total Methods | Methods With Zero App Callers | Evidence & Why |
|---|---:|---|---|
| `communicationApi.js` | 7 | `getNotifications` (L24–30), `markNotificationRead` (L32–35) | **0 app callers, 0 test callers.** Duplicate legacy endpoints (`/communication/notifications`); notifications moved to `notificationsApi.js` (`/notifications`). |
| `authApi.js` | 15 | `getHealth` (L4–5), `logoutAll` (L14–15), `changePassword` (L18–19) | **0 app callers, 0 test callers.** Never called by any thunk or screen. |
| `uploadsApi.js` | 6 | `uploadTaskProof` (L18–24), `uploadResource` (L34–40), `uploadFile` (L42–48) | **0 app callers, 0 test callers.** Only `uploadCv`, `downloadCv`, and `uploadAvatar` are used. |
| `projectsApi.js` | 37 | `getMyRequestStatus`; pass-through re-exports `isProjectActive`, `isProjectLocked`, `isActive`, `isLocked` | `getMyRequestStatus` has **0 callers anywhere**; lines 2–8 re-export `isProjectLocked`/`isProjectActive` from `utils/projectStatus.js`, causing `mentorSessionsSelectors.js:2` to import from `services/projectsApi` instead of `utils/projectStatus`. |
| `usersApi.js` | 20 | `requestPhoneOtp` (L23–24), `verifyPhoneOtp` (L25–26) | **0 app callers; 1 legacy test (`Phase16TrustSafety.test.jsx`).** Phone verification in `settings.jsx` uses Firebase `verifyPhone` (`/users/me/phone/verify`). |
| `adminApi.js` | 34 | `getOwnerRejectionPatterns` (L148–149) | **0 app callers; 4 test mocks** (`Phase17DisputesAccountability`, `Phase23SnapshotHygiene`, `Step5AuditButton`, `ViewAuditLogAndAdminNavigation`). |
| `mentorMarketplaceApi.js` | 39 | Alias export `mentorMarketApi` (L275) | **0 app callers; 6 test files** use the old alias instead of `mentorMarketplaceApi` / `default`. |

### C. Legacy Layers Check (`apiGetCache`, Contexts, `storage.js`, `roleStore.js`, `teamforge:*`)
Verified across all non-test `.js`/`.jsx` files in `src/` via `deep-audit.mjs`:
- `apiGetCache`: **`0` code uses** — only mentioned in a comment in `src/store/slices/uiSlice.js:29`.
- `AuthContext` / `RoleContext` / `NotificationContext` / `UIContext`: **`0` code uses** (`src/context/` deleted). Stale comments/warn text mention `AuthContext` in `src/pages/settings.jsx:233,246,1040` and `RoleContext` in `src/store/slices/sessionSlice.js:14`.
- `storage.js` / `roleStore`: **`0` code uses** — only comments in `src/store/slices/platformConfigSlice.js:25` and `src/store/slices/sessionSlice.js:14,16`.
- `teamforge:*` custom DOM events, `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB`: **NO MATCHES** anywhere in non-test `src/`.

---

## 2. Unused Exports, Components, Routes, CSS & Assets

### A. Notable Dead Code Inside Live Files
- **`src/hooks/useReasonAction.jsx` (467 LOC):** Exports `actionApi` (`L25–46`, **0 app callers**, only `Phase9CollaboratorScreens.test.jsx`) and returns 15 properties of which **only 4** (`handleDeclineInvite`, `handleAcceptInvite`, `renderModal`, `renderReasonModal` alias) are called in `ProjectsMarketplace.jsx` & `notifications.jsx` (`requestReason` is test-only in `Fix4UniversalFeedback.test.jsx`; **9 handlers + `closeModal` + `modalState` have 0 callers anywhere**: `handleWithdrawApplication`, `handleLeaveProject`, `handleDropTask`, `handleRejectWork`, `handleRemoveMember`, `handleCancelBooking`, `handleDeclineBooking`, `handleAcceptBooking`).
- **`src/store/actions/appActions.js` (8 LOC):** `sessionInvalidated` and `accountSuspended` have **0 callers anywhere** (app or tests).
- **`src/constants/credentialStatus.js` (23 LOC):** `CREDENTIAL_STATUS_LABELS`, `CREDENTIAL_STATUS_BADGES`, and `default` have **0 callers**.
- **Duplicate `default` + named exports across utils/hooks/services:** `dateFormatter.js`, `dateUtils.js`, `highlightMatch.jsx`, `progress.js`, `projectRole.js`, `workflow.js`, `projectCategories.js`, `useVisibilityPoll.js`, `useNotificationPolling.js`, `appealsApi.js`, `communicationApi.js`, `feedbackApi.js`, `reportsApi.js`, `tokenManager.js`, `firebase.js`, plus `RoleSyncProbe.jsx`, `ProgressBar.jsx`, `ToastViewport.jsx`, `RouteResetListener.jsx`.

### B. Unused Components, Pages & Routes
- **Pages (`src/pages/`):** Every `.jsx` page is referenced in `src/routes/AppRoutes.jsx` (41 lazy chunks). Zero orphan page files.
- **Route Audit (`AppRoutes.jsx`):** Every route path has an active link/navigation reference except **1 unused underscore alias**:
  - `AppRoutes.jsx:106`: `<Route path="/complete_profile" element={<CompleteProfile />} />` has **`0` references** anywhere in `src/` (everything links to `/complete-profile` on `L105`).
  - Note: `/admin/audit` (`AdminLayout.jsx:100` sidebar link) and `/admin/audit-log` (`AdminReports.jsx:1020` link) are **both actively used**!
- **Components (`src/components/`):** Zero unreachable component files. One dev-only probe component [`src/components/common/RoleSyncProbe.jsx`](file:///c:/Users/adity/OneDrive/Desktop/26_PINEAPPLE-1/React-Implementation/React-Implementation/src/components/common/RoleSyncProbe.jsx) (`34` lines) renders `null` and only calls `console.error` on attribute mismatches inside `layout.jsx` (see `UNCERTAIN` in Removal Plan because `RoleSyncSingleStore.test.jsx` imports it).

### C. CSS Files & Potentially Unused CSS Classes
- **Zero unimported `.css` files:** All `45` CSS files in `src/` are imported by their corresponding JSX page/component (`imp >= 1`).
- **Largest blocks of potentially unused class selectors** (checked via `deep-audit.mjs` against all non-test JS/JSX source):
  1. `src/index.css` (`1,109` LOC): **76 / 148** top-level selectors unreferenced in JSX (e.g. legacy modal/shell classes `.app-shell`, `.content-area`, `.modal-overlay`, `.tf-glass`, `.modal-box`, `.sidebar-top`, `.sidebar-trigger`, `.sidebar-group` — verify before removing since some `.tf-*` or global element selectors may cascade).
  2. `src/pages/collaborator/myWork.css` (`432` LOC): **38 / 52** selectors unreferenced (`tf-mywork-*` classes likely replaced by `StatCard`/`ProjectCard` shared components).
  3. `src/pages/collaborator/collaboratorWorkspace.css` (`405` LOC): **26 / 46** selectors unreferenced (`tf-collab-ws-*` task/progress/tab styles replaced by shared components).
  4. `src/pages/settings.css` (`809` LOC): **26 / 72** selectors unreferenced (`settings-avatar-img`, `section-highlight`, `danger-card`, digest/legacy form classes).
  5. `src/pages/owner/ownedWorkspace.css` (`335` LOC): **17 / 37** selectors unreferenced (`tf-owned-ws-*`).
  6. `src/pages/mentor/mentorProjectWorkspace.css` (`480` LOC): **16 / 54** selectors unreferenced (`tf-mentor-ws-*`).
  7. *False-positive note on `Badge.css` (`29 / 30` flagged), `AdminSupport.css` (`8 / 29`), `ScheduledJobsPanel.css` (`10 / 40`), `Avatar.css` (`8 / 18`):* these use **dynamic template-literal class names** like `` `tf-badge--${variant}` ``, `` `tf-avatar--${size}` ``, `` `support-status-${status}` ``, `` `status-${run.status}` `` and **MUST NOT** be treated as dead!

### D. `public/` and `src/` Assets
- Checked all `12` files in `public/` against all text references in `src/`, CSS `url()`, and `index.html`:
  - **9 used:** `favicon.svg` (`index.html`), `login_sin.jpg` (`Login`, `Signup`, `ForgotPassword`, `ResetPassword`), `Contribution_Report.jpg`, `Expert-Mentorship.jpg`, `Planning_and_Scheduling.jpg`, `Project-Collaboration.jpg`, `Real_time_com.jpg`, `XP-System.png`, `Video Project 9 (2).mp4` (all `landingpage.jsx`).
  - **3 unused (`DEAD`):**
    1. `public/Assets/github_logo.png` (`8,640 B`, `0` refs)
    2. `public/Assets/google.svg` (`1,361 B`, `0` refs)
    3. `public/icons.svg` (`5,055 B`, `25` lines, `0` refs — Vite template artifact)

---

## 3. Redux-Specific Waste (`src/store/`)

- **Slices (`34` implemented vs `32` planned in `docs/redux-analysis/07-conversion-plan.md`):**
  - Implemented `32` domain slices + `sessionSlice` + `uiSlice` = **`34`** reducers in `rootReducers` (`src/store/index.js`). As documented in `docs/redux-analysis/11-compliance-matrix.md` §2, this splits `users` into `profiles` / `settings` / `adminUsers` and `projects` into `projects` / `adminProjects`, adds `payments`, and merges `gamificationLedger` + `recommendationBadges` into `gamificationSlice`.
  - **Zero duplicate slices for the same repository**, **zero empty reducer handlers**, and **zero domain slices missing the 4 CRUD reducers** (`setAll`, `addOne`, `updateOne`, `removeOne` — all 32 domain slices export them per `SPEC 2`/`D2`).
  - **Slices with zero direct component imports outside `store/index.js`:** `actionFeedbackSlice.js` and `projectInvitesSlice.js` — **both are actively consumed** indirectly via `feedbackSelectors.js` / `invitesSelectors.js` and dispatched thunks. **0 slices lack UI consumers.**
- **Unused Thunk (`1`):**
  - `src/store/thunks/paymentsThunks.js::fetchAdminRevenueOverview` (`L288–304`): **`0` app callers and `0` test callers**. `MentorRevenue.jsx` dispatches `fetchAllSessionsAdmin` and `fetchSessionAdminStats` individually instead.
  - Also `14` exported `*_STALE_MS` constants plus `extractServerUnreadCount` (`notificationsThunks.js`) and `mapMeToUser` (`sessionThunks.js`) are exported from thunk files with `0` external callers (only used internally in those files).
- **Selectors:** **`0` unused files** (`34/34` have component callers), but **`148` unused exports** (mainly redundant entity-adapter boilerplate) and **`25` test-only exports**.
- **Action Creators:** **19 slices** export custom UI/working-state action creators (`setSelectedAdminUserId`, `clearJobMessages`, `setAuditFilterField`, etc.) used only in unit tests (`0` app callers), while `appActions.js` has `2` completely unused actions (`sessionInvalidated`, `accountSuspended`).
- **Middleware:** `routeResetListener.js` **is** registered in `store/index.js` (`L136–147`), though at runtime its effect exits early on `L14–16` under `RESET_SCOPE = 'page'` and `resetRouteGroup` has no real slice listeners (`KEEP-SPEC` per Req 5).
- **Tests Touching Removed/Legacy Code:**
  - `src/store/__tests__/storeFoundation.test.jsx` imports `RouteResetObserver` (legacy alias) and tests `resetRouteGroup` / `getRouteGroup`.
  - `src/test/Phase9CollaboratorScreens.test.jsx` imports legacy `actionApi` from `useReasonAction.jsx`.
  - `src/test/Phase16TrustSafety.test.jsx` tests removed `usersApi.requestPhoneOtp` / `verifyPhoneOtp` endpoints.
  - *Note:* Regression removal guards (`PlatformConfigRemoval.test.jsx`, `NotificationDigestRemoval.test.jsx`, `AdminUsersWarnedFilterRemoval.test.jsx`, `Phase2..5*Removal.test.jsx`) guard **real feature removals** against re-introduction and are **`KEEP-TEST`**.

---

## 4. Nested Folders, Stray Files, Debug/Console & TODOs

- **Path Doubling:** The frontend app lives at `React-Implementation/React-Implementation/` (nested folder) alongside an **orphaned `React-Implementation/package-lock.json` (`105` bytes, `7` lines)** sitting in the outer `React-Implementation/` folder from commit `49c8152c` (`Rithvik`, `2026-09-21`).
- **Stray Copy-Style Names / Generated Folders:**
  - `public/Assets/Video Project 9 (2).mp4` (`14.07 MB`) has `(2)` in its filename, **but is actively used** in `src/pages/landingpage.jsx` (do not delete).
  - `React-Implementation/React-Implementation/dist/` (`vite build` output, gitignored).
  - Zero `*.old`, `*.bak`, `*-v2`, or empty/commented-only `.js`/`.jsx`/`.css` files exist.
- **`TODO` / `FIXME` / `XXX`:** `0` `TODO`/`FIXME` matches in non-test `src/` (`settings.jsx:402` `XXX` is `+91XXXXXXXXXX` E.164 phone placeholder).
- **`console.log` Debug Calls in App Code (`5` lines):** `src/services/apiClient.js:424,594,667` (`3`) and `src/services/firebase.js:28,47` (`2`). Plus `RoleSyncProbe.jsx:20` calls `console.error` exclusively as a DOM debug probe.

---

## 5. `package.json` Dependencies Audit (Report Only)

- **`dependencies` (`6/6` actively imported in `src/`):** `@reduxjs/toolkit`, `firebase`, `react`, `react-dom`, `react-redux`, `react-router-dom`. Zero unused runtime dependencies.
- **`devDependencies` (`16` total):**
  - **Actively used via imports/scripts/configs (`14`):** `vite`, `@vitejs/plugin-react`, `@babel/core`, `@rolldown/plugin-babel`, `babel-plugin-react-compiler`, `eslint`, `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`.
  - **Unused in build/lint/test (`2`):** `@types/react` (`^19.2.18`) and `@types/react-dom` (`^19.2.7`) — zero `.ts`/`.tsx` files and no `tsconfig.json` / `jsconfig.json`. (`UNCERTAIN`: safe to remove if VS Code JSDoc/React autocomplete does not rely on them).

---

## 6. Looks Unused But Protected (Do Not Flag or Delete)

| Item | Why Tools Flagged It | Why It Is Protected (`KEEP`) |
|---|---|---|
| **All `41` page files in `src/pages/**`** | `analyze-deps.mjs` static edge only | Loaded dynamically via `React.lazy(() => import(...))` in `AppRoutes.jsx:10–65`. |
| **`/admin/audit` & `/admin/audit-log` dual routes** | Looks like duplicate alias | `AdminLayout.jsx:100` links `/admin/audit` while `AdminReports.jsx:1020` navigates to `/admin/audit-log?...`. Both active. |
| **`public/Assets/Video Project 9 (2).mp4` & `public/Assets/*.jpg\|png` & `favicon.svg`** | Name has `(2)` or loaded by URL string | Referenced by `src/pages/landingpage.jsx`, auth pages, and `index.html`. |
| **Dynamic CSS modifiers in `Badge.css`, `Avatar.css`, `AdminSupport.css`, `ScheduledJobsPanel.css`** | Literal class string missing in JSX | Constructed dynamically via template literals (`tf-badge--${...}`, `support-status-${...}`, `status-${...}`). |
| **`devDependencies`: `@babel/core`, `@rolldown/plugin-babel`, `babel-plugin-react-compiler`, `eslint-plugin-react-refresh`, `globals`, `jsdom`** | `npx knip` failed loading configs | Directly invoked by `vite.config.js`, `vitest.config.js`, and `eslint.config.js`. |
| **Test infrastructure & security/regression scan tests** | Only reachable in tests (`knip` unused) | `vitest.config.js` (`src/test/setup.js`, `test-utils.jsx`, Phase 0–28 & removal-guard tests) + `scripts/verify-admin-project-details.mjs`. |
| **`KEEP-SPEC` Redux artifacts (`32x4` CRUD reducers, `routeResetListener.js`, `routeReset.js`, `RouteResetListener.jsx`, `thunkError.js`)** | Some exports (`setAll`, `addOne`, `updateOne`, `removeOne`, `resetRouteGroup`) have few/no UI callers | Required by Professor Spec `1–9` and `docs/redux-analysis/11-compliance-matrix.md`. |
