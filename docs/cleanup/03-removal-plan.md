# Safe Removal & Cleanup Plan (`React-Implementation/React-Implementation`)

> **Read-Only Analysis Output:** Zero files were deleted or modified during this audit. Each batch below contains at most **15 items** and includes exact verification commands so changes can be applied incrementally with full regression safety.

---

## 1. Totals & Summary Metrics

| Metric / Classification | Count | Scope Notes |
|---|---:|---|
| **Total Files Analyzed** | **454** | `435` under `src/` + `12` in `public/` + `5` FE root configs/entry (`index.html`, `package.json`, `vite.config.js`, `vitest.config.js`, `eslint.config.js`) + `1` stray `React-Implementation/package-lock.json` + `1` `scripts/verify-admin-project-details.mjs` |
| `KEEP-USED` | **328** | `314` app-reachable `src/` UI/route/service/slice/thunk/selector/util/constant files + `9` used `public/` assets + `5` root entry/config files (some contain intra-file dead exports listed in Batches 2–4) |
| `KEEP-SPEC` | **4** | `store/middleware/routeResetListener.js`, `store/utils/routeReset.js`, `store/utils/thunkError.js`, `store/README.md` (note: all `32` domain slices also carry `KEEP-SPEC` `setAll`/`addOne`/`updateOne`/`removeOne` reducers counted inside `KEEP-USED` slices) |
| `KEEP-TEST` | **114** | `113` Vitest spec/setup/helper files (`src/test/` + `src/store/__tests__/`) + `1` `scripts/verify-admin-project-details.mjs` |
| `WRAPPER` | **3** | `src/store/components/RouteResetObserver.jsx` (2L), `src/store/hooks/useSafeStoreSelector.js` (27L), `src/store/components/withOptionalStore.jsx` (33L) |
| `DEAD` | **4** | Whole files: `public/Assets/github_logo.png`, `public/Assets/google.svg`, `public/icons.svg` (25L), `React-Implementation/package-lock.json` (7L) |
| `DEAD-TEST-ONLY` | **0** | Zero whole files that only test deleted code *(3 test files do have legacy sub-cases referencing removed/wrapper symbols -> handled in Batches 3 & 4)* |
| `DUPLICATE` | **0** *(whole files)* | Zero duplicate whole files; intra-file duplicates & overlaps exist in `communicationApi` (`2` notification methods), `projectsApi` (`isProjectLocked`/`isProjectActive` pass-throughs), and `dateUtils.js` (relative dates alongside `dateFormatter.js`) |
| `EMPTY-OR-COMMENTED` | **0** | Confirmed zero empty or comment-only files across `src/` and `public/` |
| `UNCERTAIN` | **1** *(whole file)* | `src/components/common/RoleSyncProbe.jsx` (34L) — plus `2` `package.json` devDependencies (`@types/react`, `@types/react-dom`), `1` nested folder question, and `withOptionalStore`/`useSafeStoreSelector` timing |
| **Estimated Lines / Bytes Recoverable** | **~567+ lines & 15.1 KB assets** | Whole removable files (`98` lines across `RouteResetObserver`, `useSafeStoreSelector`, `withOptionalStore`, `package-lock.json`, `icons.svg`, plus `RoleSyncProbe` if approved) + **~460 lines** of dead intra-file blocks (unused `useReasonAction` handlers/`actionApi`, `apiClient` barrel lines, dead `*Api` methods, unused `paymentsThunks::fetchAdminRevenueOverview`, unused `appActions`/constants exports, unused CSS blocks) + `15,056 B` unused assets |

### Top 10 Largest Removals (by Lines, Including Intra-File Dead Blocks)

| Rank | Target (File or Intra-File Block) | Est. Lines / Size | Classification / Scope | Batch |
|---:|---|---:|---|---|
| 1 | Unused CSS blocks in `src/pages/collaborator/myWork.css` (`38/52` unused `.tf-mywork-*` classes) & `collaboratorWorkspace.css` (`26/46`) | ~350–450L *(after manual CSS grep)* | `DEAD` (intra-file unused classes) | Batch 5 |
| 2 | `src/hooks/useReasonAction.jsx` (`actionApi` L25–46 + 9 unused handlers L173–432) | ~265L | `DEAD` / `DEAD-TEST-ONLY` block | Batch 4 |
| 3 | `src/services/communicationApi.js` (`getNotifications`, `markNotificationRead`), `authApi.js` (3), `uploadsApi.js` (3), `projectsApi.js` (1) | ~65L | `DEAD` / `DUPLICATE` methods | Batch 2 |
| 4 | `src/utils/dateUtils.js` (merge `formatRelativeTime` into `dateFormatter.js`) | 39L | Merge / overlap cleanup | Batch 4 |
| 5 | `src/components/common/RoleSyncProbe.jsx` | 34L | `UNCERTAIN` (dev probe) | Needs Human Decision |
| 6 | `src/store/components/withOptionalStore.jsx` | 33L | `WRAPPER` (migration shim) | Batch 4 |
| 7 | `src/store/hooks/useSafeStoreSelector.js` | 27L | `WRAPPER` (migration shim) | Batch 4 |
| 8 | `public/icons.svg` (+ `github_logo.png` 8.6 KB, `google.svg` 1.4 KB) | 25L (+10 KB) | `DEAD` assets | Batch 1 |
| 9 | `src/store/thunks/paymentsThunks.js` (`fetchAdminRevenueOverview` L285–304) | 20L | `DEAD` exported thunk | Batch 2 |
| 10 | `src/services/apiClient.js` (`export * from ...` circular barrel lines 739–753) | 15L | `DEAD` barrel (fixes 14 cycles) | Batch 2 |

---

## 2. Ordered Removal Batches (`<= 15` Items per Batch)

### Batch 1 — Zero-Risk Dead Assets, Stray Outer Lockfile & Unused Alias Route
- **Items (5):**
  1. `public/Assets/github_logo.png` (`8,640 B`) — `DEAD`, `0` references anywhere.
  2. `public/Assets/google.svg` (`1,361 B`) — `DEAD`, `0` references anywhere.
  3. `public/icons.svg` (`25L`, `5,055 B`) — `DEAD` Vite starter artifact, `0` references anywhere.
  4. `React-Implementation/package-lock.json` (`7L`, `105 B`) — `DEAD` stray lockfile outside nested project root.
  5. `src/routes/AppRoutes.jsx:106` (`/complete_profile` duplicate `<Route>`) — `0` navigation/link references anywhere (everything uses `/complete-profile`).
- **Risk:** **Low** (zero runtime JS imports depend on these).
- **Checks:** `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd test`.

### Batch 2 — Circular Barrel Removal, Dead Service Methods, Dead Thunk & Unused Exports
- **Items (11):**
  1. `src/services/apiClient.js:739–753` — Delete 14 `export * from "./*Api.js"` barrel re-exports (**resolves all 14 `madge` circular dependencies**).
  2. `src/services/communicationApi.js:24–35` — Delete duplicate `getNotifications` and `markNotificationRead` (`0` callers; `notificationsApi.js` owns `/notifications`).
  3. `src/services/authApi.js` — Delete `getHealth`, `logoutAll`, `changePassword` (`0` callers).
  4. `src/services/uploadsApi.js` — Delete `uploadTaskProof`, `uploadResource`, `uploadFile` (`0` callers).
  5. `src/services/projectsApi.js` — Delete `getMyRequestStatus` (`0` callers), switch `mentorSessionsSelectors.js:2` to `../../utils/projectStatus`, and drop pass-through `isProjectLocked`/`isProjectActive` exports (`L2–8`).
  6. `src/store/thunks/paymentsThunks.js:285–304` — Delete `fetchAdminRevenueOverview` (`0` app or test callers).
  7. `src/store/actions/appActions.js:6–7` — Delete `sessionInvalidated` and `accountSuspended` (`0` callers).
  8. `src/constants/credentialStatus.js:8–22` — Remove unused exports `CREDENTIAL_STATUS_LABELS`, `CREDENTIAL_STATUS_BADGES`, `default`.
  9. `src/store/utils/setupInterceptors.js:16–18` — Remove unused `getBoundStore` export.
  10. `src/store/utils/roleHelpers.js:7–11` — Keep internal `ROLE_HOMES` constant unexported (0 external callers).
  11. `src/components/common/ProgressBar.jsx`, `ToastViewport.jsx`, `useNotificationPolling.js`, `useVisibilityPoll.js`, `utils/*.js` — Clean up redundant `default`/named duplicate exports where only one style is imported.
- **Risk:** **Low** (`0` callers verified in both app and test suites).
- **Checks:** `npx.cmd madge --circular --extensions js,jsx src` (expect `0` cycles), `npm.cmd run lint`, `npm.cmd test`.

### Batch 3 — Remove `RouteResetObserver.jsx` Wrapper & Test-Only API Leftovers
- **Items (5, includes test updates):**
  1. `src/store/components/RouteResetObserver.jsx` (`2L`) — Delete `WRAPPER` shim (`export { default } from './RouteResetListener'`).
  2. Update `src/store/__tests__/storeFoundation.test.jsx:20` to import `RouteResetListener` directly.
  3. `src/services/usersApi.js:23–26` — Remove `requestPhoneOtp` & `verifyPhoneOtp` (`0` app callers; legacy Firebase-replaced OTP endpoints) and update `src/test/Phase16TrustSafety.test.jsx` OTP assertions to match current `verifyPhone` flow (verify with owner first if backward-compat tests are kept intentionally).
  4. `src/services/adminApi.js:148–149` — Remove `getOwnerRejectionPatterns` (`0` app callers; update 4 test mock stubs in `Phase17`, `Phase23`, `Step5AuditButton`, `ViewAuditLogAndAdminNavigation`).
  5. `src/services/mentorMarketplaceApi.js:275` — Remove `mentorMarketApi` alias (`0` app callers; update 6 test imports to `mentorMarketplaceApi`).
- **Risk:** **Medium** (requires synchronized updates in existing Vitest files).
- **Checks:** `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`.

### Batch 4 — Trim `useReasonAction.jsx`, Merge `dateUtils.js`, Unwrap Legacy Store Shims
*(Depends on updating the 11 raw-`render` tests first so `useSafeStoreSelector` and `withOptionalStore` become unused!)*
- **Items (6 groups):**
  1. Migrate the **11** legacy test files calling raw RTL `render()` (`AdminProjectDetailsCleanUI`, `AdminProjectDetailsLayout`, `AdminRejectMentorApp`, `EnhancedProjectDeletion`, `FeedbackHistory`, `Fix4UniversalFeedback`, `ProjectCard`, `SafeLink`, `ScheduledJobsPanel`, `TaskDueDateValidation`, `UniversalReasonModal`) to `renderWithStore()`.
  2. `src/store/hooks/useSafeStoreSelector.js` (`27L`) — Replace imports in the **12** caller files with standard `useSelector` and delete `useSafeStoreSelector.js`.
  3. `src/store/components/withOptionalStore.jsx` (`33L`) — Unwrap the **62** components/pages using `withOptionalStore(...)` and delete `withOptionalStore.jsx`.
  4. `src/hooks/useReasonAction.jsx` (`~265L` trimmed) — Delete `actionApi` (`L25–46`) and the 9 unused handlers (`handleWithdrawApplication`..`handleAcceptBooking`, `closeModal`, `modalState`); update `Phase9CollaboratorScreens.test.jsx` to dispatch Redux thunks directly.
  5. `src/utils/dateUtils.js` (`39L`) — Merge `formatRelativeTime` into `src/utils/dateFormatter.js`, update 3 callers (`dashboard`, `notifications`, `OwnerDashboard`), and delete `dateUtils.js`.
  6. Remove stale `"AuthContext"` / `"RoleContext"` / `"storage.js"` / `"apiGetCache"` comments & console fallback wording in `settings.jsx`, `sessionSlice.js`, `platformConfigSlice.js`, `uiSlice.js`.
- **Risk:** **Medium–High** (touches 62+ component exports + 11 test files; execute carefully with `renderWithStore` test verification).
- **Checks:** `npm.cmd run lint`, `npm.cmd test` (full 112-file suite), `npm.cmd run build`.

### Batch 5 — Unused Selector Exports & Verified CSS Class Pruning (Optional Hygiene)
- **Items (3 groups):**
  1. `src/store/selectors/*.js` (`148` unused boilerplate exports across 34 files) — Optionally remove unreferenced `select*State` / `*EntitySelectors` exports only if not planned for future screens.
  2. `src/pages/collaborator/myWork.css`, `collaboratorWorkspace.css`, `src/pages/settings.css`, `src/pages/owner/ownedWorkspace.css`, `src/index.css` — Manually verify and prune confirmed dead `.tf-mywork-*`, `.tf-collab-ws-*`, `.tf-owned-ws-*`, `.settings-*` selectors (never delete dynamically interpolated `.tf-badge--*`, `.tf-avatar--*`, `.support-*`, `.status-*` classes).
  3. Clean 5 leftover `console.log` statements in `src/services/apiClient.js:424,594,667` and `src/services/firebase.js:28,47` (or switch to `console.debug`).
- **Risk:** **Low–Medium** (visual CSS regression check recommended after pruning styles).
- **Checks:** `npm.cmd run lint`, `npm.cmd run build`, visual check on affected pages.

---

## 3. Do Not Remove (`KEEP-SPEC`)

These items may appear redundant or only partially active at runtime, **but must remain** to satisfy Professor Specification `1–9` and `docs/redux-analysis/11-compliance-matrix.md`:

| Artifact | Spec Requirement / Doc Proof | Why Keep |
|---|---|---|
| All `128` CRUD reducers (`setAll`, `addOne`, `updateOne`, `removeOne` across `32` domain slices) | **SPEC 2 & 3, Decision D2** (`11-compliance-matrix.md`, `complianceCrudProof.test.jsx`) | Every repository slice must expose all 4 synchronous CRUD reducers (`32 x 4 = 128`), even when UI reads selectors and writes via thunks. |
| `src/store/middleware/routeResetListener.js` & `appActions.resetRouteGroup` | **SPEC 5, Decision D3** (`11-compliance-matrix.md` §1 Req 5, `07-conversion-plan.md`, `storeFoundation.test.jsx`) | Registered in `store/index.js` as the Reading A route-group reset middleware; must stay unless Requirement 5 Reading A support is formally dropped. |
| `src/store/utils/routeReset.js` (`RESET_SCOPE = 'page'`, `addRouteReset`) | **SPEC 5, Decision D3** (`11-compliance-matrix.md` §3) | Single-line switch between Reading B (`'page'`) and Reading A (`'group'`). |
| `src/store/components/RouteResetListener.jsx` | **SPEC 5** (`App.jsx`, `11-compliance-matrix.md`) | Dispatches `routeChanged` on pathname transitions. |
| `src/store/utils/thunkError.js` (`normalizeThunkError`) | **SPEC 9** (`11-compliance-matrix.md` §1 Req 9) | Standardized error normalization across all 33 domain thunk files. |
| `src/store/README.md` | Internal store rubric guide | Worked example of `projectsSlice` + store compliance rules (keep or relocate to `docs/redux-analysis/`). |
| Removal-guard tests (`PlatformConfigRemoval`, `NotificationDigestRemoval`, `AdminUsersWarnedFilterRemoval`, `NoApiInComponentsScan`, `NoBrowserStorageScan`, `NoCustomDomEventsScan`, `RoleStoreScan`) | **SPEC 4, 6, 7 & feature removal regression guards** | Protect against accidental re-introduction of localStorage, direct API calls, DOM events, demo reset card, digest, or warned filter. |

---

## 4. Needs a Human Decision (`UNCERTAIN`)

| Item | Evidence & Ambiguity | Question for You & Recommendation |
|---|---|---|
| **1. [`src/components/common/RoleSyncProbe.jsx`](file:///c:/Users/adity/OneDrive/Desktop/26_PINEAPPLE-1/React-Implementation/React-Implementation/src/components/common/RoleSyncProbe.jsx) (`34L`)** | Mounted in `src/pages/layout.jsx`; renders `null` and only runs a `setTimeout(..., 0)` DOM check calling `console.error('ROLE OUT OF SYNC: ...')`. No visible UI; imported by `src/test/RoleSyncSingleStore.test.jsx` (and named export `RoleSyncProbe` is unused). | **Question:** Should this runtime console debug probe stay active in production `layout.jsx` / `RoleSyncSingleStore.test.jsx`, or be removed (or gated behind `import.meta.env.DEV`)? **Recommendation:** Gate behind `import.meta.env.DEV` or remove once role-sync consistency is covered purely by `sessionSlice` Redux assertions. |
| **2. `@types/react` & `@types/react-dom` in `package.json`** | `devDependencies` (`^19.2.18`, `^19.2.7`) with zero TypeScript files, zero `tsconfig.json`, and zero imports anywhere. | **Question:** Are these kept intentionally for VS Code JSX type inference / autocomplete, or should they be removed? **Recommendation:** Remove if unused by team editors; keep if editors rely on them for React 19 JSX hints. |
| **3. Nested `React-Implementation/React-Implementation/` Folder Doubling** | Entire Vite project sits one directory deeper (`React-Implementation/React-Implementation/`) with `React-Implementation/package-lock.json` outside. | **Question:** Do you want to flatten `React-Implementation/React-Implementation/` up to `React-Implementation/` in a dedicated chore later (requires careful git rename & script path updates)? **Recommendation:** Keep path for now to avoid breaking docs/CI/scripts mid-semester; only delete the stray `105 B` outer `React-Implementation/package-lock.json`. |
| **4. `src/store/selectors/*.js` (`148` Unused Boilerplate Exports) & `useSafeStoreSelector`/`withOptionalStore`** | Removing `withOptionalStore` and `useSafeStoreSelector` touches 62 components and 11 working tests (`Batch 4`); keeping them is safe runtime-wise (`0` bugs), just extra wrapper boilerplate. | **Question:** Do you want to pay the refactor churn of migrating those 11 legacy tests to `renderWithStore()` now, or keep the shims untouched until post-viva cleanup? **Recommendation:** Keep shims (`Batch 4` deferred) if stability before evaluation is top priority; apply `Batches 1–3` immediately as safe, low-risk cleanup. |
