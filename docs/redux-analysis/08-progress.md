# Redux Conversion Progress Log (`Redux-Conversion` Branch)

## Pre-Conversion Baseline (Before Phase 0 Edits)
- **ESLint (`npm run lint`):** `99 problems (89 errors, 10 warnings)` (`exit 1`)
- **Front-End Vitest (`npx vitest run`):** `84` test files (`71 passed, 13 failed`), `397` tests (`381 passed, 16 failed`), Duration `144.51s`
  - Pre-existing failing test files on `Redux-Conversion`: `AdminRejectMentorApp.test.jsx` (1), `AdminReports.test.jsx` (2), `Fix1RestartAndSession.test.jsx` (1), `Fix6Payment.test.jsx` (1), `LeaveProjectDialog.test.jsx` (2), `NotificationAppeal.test.jsx` (1), `Phase10PlatformDurability.test.jsx` (1), `Phase19UsersLockdown.test.jsx` (1), `Phase20ResourceAuth.test.jsx` (1), `Phase22ReputationLedger.test.jsx` (2), `Phase4MentorTimeRemoval.test.jsx` (1), `Phase9EscrowPaymentSafety.test.jsx` (1), `RoleSyncSingleClick.test.jsx` (1).
- **Back-End Typecheck (`npx tsc --noEmit`):** Exits `0` (verified in analysis pass; `back-end/` left untouched).

---

## Phase 0 — Store Foundation, Provider Wiring, `renderWithStore` & Scan Tests

### Summary & Root Findings
- Installed `@reduxjs/toolkit` (`^2.15.0`) and `react-redux` (`^9.3.1`) as the only new runtime dependencies (`package.json`).
- Built `src/store/` foundation matching [`05-thunk-pattern.md`](./05-thunk-pattern.md) and [`07-conversion-plan.md`](./07-conversion-plan.md) and wired `<Provider store={store}>` in `src/main.jsx` and `<RouteResetObserver />` in `src/App.jsx` while keeping all 4 existing React Contexts intact as planned for Phases 1–12.
- Added bidirectional Vitest architectural scan suites (`NoBrowserStorageScan`, `NoApiInComponentsScan`, `NoCustomDomEventsScan`) with exact Phase 0 allowlists so every cleanup PR must shrink its allowlist entries.

### Decisions Made
1. **Empty Root Reducer Placeholder (`src/store/index.js`):** Under Decision D1 (`30 domain slices + sessionSlice + uiSlice`), Phase 0 creates zero domain/session/ui slices yet, and Redux `combineReducers({})` rejects an empty map. *Decision:* Return a minimal fallback `(state = {}) => state` when `Object.keys(merged)` is empty and merge real reducers via `extraReducers` / `rootReducers` across Phases 1–10 (no dummy slice polluted into D1 count).
2. **`ReactReduxContext` Guard in `RouteResetObserver`:** `src/test/DemoReset.test.jsx:146-150` renders `<App />` inside `<MemoryRouter>` without `<Provider>`. *Decision:* Read `useContext(ReactReduxContext)` inside `RouteResetObserver.jsx` rather than calling bare `useDispatch()`, preserving `DemoReset.test.jsx` (`3/3` pass) without altering Phase 10 test mocks prematurely.
3. **ESM `__dirname` Avoidance in New Scan Tests:** Baseline lint fails on legacy test files that use undeclared CommonJS `__dirname`. *Decision:* Use `fileURLToPath(import.meta.url)` in new Phase 0 scan tests (`0` ESLint issues).
4. **D9 Cleanup Phase Numbering Note:** Decision D9 refers to the final deletion/cleanup phase as "Phase 13" (`14` total if 0-indexed), while [`07-conversion-plan.md`](./07-conversion-plan.md) numbers phases `0`–`12` (13 phases total). Keeping phases `0`–`12` with `Phase 12` (Cleanup & Hardening) matching D9's final cleanup milestone.

### Slices, Reducers & Thunks Added
- **Domain/App Slices added:** `0` (`sessionSlice`, `uiSlice`, and 30 domain slices begin in Phases 1–10).
- **CRUD Reducers added:** `0` (`store/index.js` exports empty `rootReducers = {}` placeholder + `createAppStore` factory).
- **Thunks added:** `0`.
- **Shared Store Actions / Utilities Added:**
  - `src/store/actions/appActions.js`: `ROUTE_RESET_SCOPE = 'reading_b'`, `routeChanged`, `resetRouteGroup`, `sessionReset`, `sessionInvalidated`, `accountSuspended`.
  - `src/store/utils/thunkError.js`: `normalizeThunkError()` forwarding HTTP status/code/message + `26` `apiClient.js` metadata fields.
  - `src/store/middleware/routeResetListener.js`: `getRouteGroup()`, `createRouteResetListener()`, `routeResetListener`.
  - `src/store/utils/setupInterceptors.js`: `setupInterceptors()`, `dispatchFromInterceptor()`, `getStateFromInterceptor()`.
  - `src/store/components/RouteResetObserver.jsx`: router pathname observer ignoring search-only changes (`?tab=...`).

### Files Changed (Grouped by Owner Student per `07-conversion-plan.md`)
- **Aditya Sai (Store Lead):**
  - Docs: `docs/redux-analysis/09-redux-rules.md`, `docs/redux-analysis/08-progress.md`
  - Dependencies: `React-Implementation/React-Implementation/package.json`, `React-Implementation/React-Implementation/package-lock.json`
  - Store Foundation: `src/store/index.js`, `src/store/actions/appActions.js`, `src/store/middleware/routeResetListener.js`, `src/store/utils/thunkError.js`, `src/store/utils/setupInterceptors.js`, `src/store/components/RouteResetObserver.jsx`
  - Wiring & Test Harness: `src/main.jsx`, `src/App.jsx`, `src/test/test-utils.jsx`
  - Phase 0 Tests: `src/store/__tests__/storeFoundation.test.jsx`, `src/test/NoBrowserStorageScan.test.jsx`, `src/test/NoApiInComponentsScan.test.jsx`, `src/test/NoCustomDomEventsScan.test.jsx`
- **Rithvik, Satwik, Jathin Surya, Kevin Gandham:** `0` files in Phase 0.

### Old Code Removed
- `0` removals in Phase 0 (existing Contexts, `roleStore.js`, `storage.js`, `apiGetCache`, and `teamforge:*` DOM events intentionally preserved behind scan allowlists until Phases 1–12).

### Phase 0 Verification Counts
- **ESLint (`npm run lint`):** `99 problems (89 errors, 10 warnings)` (`exit 1` — unchanged from baseline; **0 errors and 0 warnings** across all Phase 0 created/modified files via targeted ESLint).
- **Front-End Vitest (`npx vitest run`):** `88` test files (`79 passed, 9 failed`), `405` tests (`394 passed, 11 failed`).
  - All `4` new Phase 0 test files (**8/8** tests) passed (`NoBrowserStorageScan` 1/1, `NoApiInComponentsScan` 1/1, `NoCustomDomEventsScan` 1/1, `storeFoundation` 5/5), alongside `DemoReset.test.jsx` (3/3) and `RoleStoreScan.test.jsx` (2/2).
- **Production Build (`npm run build`):** Passed cleanly in `15.30s` (`dist/assets/index-*.js` gzipped `97.40 kB`).

### Initial Scan Allowlist Counts (`Phase 0 Baseline`)
- `BROWSER_STORAGE_ALLOWLIST` (`src/test/NoBrowserStorageScan.test.jsx`): **24** files.
- `DIRECT_API_IMPORT_ALLOWLIST` (`src/test/NoApiInComponentsScan.test.jsx`): **57** files.
- `CUSTOM_DOM_EVENTS_ALLOWLIST` (`src/test/NoCustomDomEventsScan.test.jsx`): **23** files.

### Skipped / Deferred & Other Findings
- `back-end/` untouched (strictly read-only).
- Note: 4 pre-existing baseline failures (`AdminReports`, `Fix6Payment`, `NotificationAppeal`, `Phase9EscrowPaymentSafety`) were timing-sensitive under initial run and passed in the post-Phase-0 run; `9` pre-existing test files (`11` tests) still fail independently of Phase 0 (`AdminRejectMentorApp`, `Fix1RestartAndSession`, `LeaveProjectDialog`, `Phase4MentorTimeRemoval`, `Phase10PlatformDurability`, `Phase19UsersLockdown`, `Phase20ResourceAuth`, `Phase22ReputationLedger`, `RoleSyncSingleClick`).


---

## Phase 2 — UI Slice, Theme Tokens, Global Toasts & Route-Leave Reset (`uiSlice`, `routeChanged`, Reading B)

### Summary & Root Findings
- Implemented `uiSlice` (`React-Implementation/React-Implementation/src/store/slices/uiSlice.js`) managing `theme` (strictly in memory; defaults via `window.matchMedia('(prefers-color-scheme: dark)')`), `sidebarOpen`, `toasts` queue, shared `openDropdowns`, `activeModal`/`modalProps`, `maintenance`, and `resettingBanner`.
- Implemented the Phase 2 route-leave reset mechanism: `RESET_SCOPE = 'page'` (`'page' | 'group'`, default Reading B) + `getPathGroup()` + `addRouteReset(builder, resetFn, scopeOverride?)` in `src/store/utils/routeReset.js`, `<RouteResetListener />` under the router root in `src/App.jsx` (`RouteResetObserver.jsx` kept as a thin re-export for backward compatibility), and `routeResetListener.js` middleware support for `'group'`.
- Replaced `UIContext.jsx` internals with `ReduxUIBridge` (+ pure React memory fallback for legacy tests that mount `<UIProvider>` without `<Provider>`), removed `useState` sidebar duplication in `src/pages/layout.jsx`, applied theme tokens to `document.documentElement` via one `useEffect` in `src/App.jsx`, added `<ToastViewport />`, and removed `LOCAL_KEYS.THEME` / `getTheme()` / `setTheme()` from `src/utils/storage.js`.
- Verified `15` `teamforge:*` DOM event names across `23` allowlisted non-test files before edits; only `teamforge:maintenance` (`src/App.jsx` & `src/services/apiClient.js`) was a pure UI-only custom event (`0` `teamforge:toast`, `teamforge:modal`, or `teamforge:theme` events existed in the codebase). Replaced `teamforge:maintenance` with `setResettingBanner` / `setMaintenance` dispatches via `dispatchFromInterceptor`.

### Decisions Made
1. **Consolidated Route-Reset Switch (`RESET_SCOPE = 'page'`):** Replaced Phase 0's `ROUTE_RESET_SCOPE = 'reading_b'` in `appActions.js` with `export const RESET_SCOPE = 'page'` (`'page' | 'group'`) and `addRouteReset(builder, resetFn, scopeOverride?)` in `src/store/utils/routeReset.js`, using first-segment `getPathGroup(pathname)` (`'/' -> 'root'`, `'/admin/users' -> 'admin'`).
2. **Scoped `UIProvider` & `Layout` Backward Compatibility for Standalone Legacy Tests:** 24 existing test files mount `<UIProvider>` without Redux `<Provider>` and 1 test (`RoleSyncSingleStore.test.jsx`) mounts `<Layout />` standalone; kept pure in-memory fallbacks inside `UIContext.jsx` (`MemoryFallbackUIProvider`) and `pages/layout.jsx` (`StandaloneLayout`) when `ReactReduxContext?.store` is absent, avoiding premature rewrites prior to Phase 12 cleanup.
3. **`ToastViewport` Mounted Outside `<Provider>` Guard & No New Theme Toast:** `<ToastViewport />` safely returns `null` if no Redux store exists in context (preserving standalone `<App />` render), and renders `ui.toasts` once when `enqueueToast` is dispatched.
4. **Route-Leave Policy (`STAYS` vs `CLEARS`) Documented in `uiSlice.js`:** Session (`user`, `accessToken`, `activeRole`, `allowedRoles`, `permissions`), notifications/chat unread summaries, `ui.theme`, `ui.sidebarOpen`, `ui.toasts`, `ui.maintenance`, `ui.resettingBanner`, payment checkout `idempotencyKey`, and domain repository entities stay across navigation; `ui.openDropdowns`, `ui.activeModal`, `ui.modalProps`, and domain `working` state clear on `routeChanged`.

### Slices, Reducers & Thunks Added
- **App/UI Slices added (`1`):** `uiSlice` (`name: 'ui'`, registered in `rootReducers` inside `src/store/index.js`).
- **Reducers added on `uiSlice` (`15`):** `setTheme`, `toggleTheme`, `setSidebarOpen`, `toggleSidebar`, `enqueueToast`, `dismissToast`, `clearToasts`, `setDropdownOpen`, `closeAllDropdowns`, `openGlobalModal`, `closeGlobalModal`, `setMaintenance`, `setResettingBanner`, `clearWorkingUI`, `resetUISlice` + `extraReducers` (`addRouteReset` + `sessionReset`).
- **Async Thunks added (`0`):** `uiSlice` holds pure client UI state; `fetchPublicConfig` (`platformConfigSlice`) remains scoped separately.

### Files Changed (Grouped by Student Owner per `07-conversion-plan.md`)
- **Aditya Sai (Store Core & UI Shim / App Chrome):**
  - Docs: `docs/redux-analysis/08-progress.md`
  - Store UI & Route-Reset: `src/store/slices/uiSlice.js`, `src/store/selectors/uiSelectors.js`, `src/store/utils/routeReset.js`, `src/store/utils/themeTokens.js`, `src/store/components/RouteResetListener.jsx`, `src/store/components/RouteResetObserver.jsx`, `src/store/actions/appActions.js`, `src/store/middleware/routeResetListener.js`, `src/store/index.js`
  - App Chrome & Intercepts: `src/components/common/ToastViewport.jsx`, `src/context/UIContext.jsx`, `src/App.jsx`, `src/services/apiClient.js`, `src/utils/storage.js`
  - Tests & Scans: `src/store/__tests__/uiSliceAndReset.test.jsx`, `src/store/__tests__/storeFoundation.test.jsx`, `src/test/DemoReset.test.jsx`, `src/test/NoBrowserStorageScan.test.jsx`, `src/test/NoCustomDomEventsScan.test.jsx`
- **Satwik (Shared App Shell):**
  - `src/pages/layout.jsx`
- **Rithvik, Jathin Surya, Kevin Gandham:** `0` files in Phase 2.

### Old Code Removed
- Removed `teamforge.theme` (`LOCAL_KEYS.THEME`), `getTheme()`, and `setTheme()` from `src/utils/storage.js`.
- Removed browser `storage` dependency and persisted theme writes/reads from `src/context/UIContext.jsx`.
- Removed `window.addEventListener('teamforge:maintenance', ...)` and local `maintenance` / `resettingBanner` `useState` hooks from `src/App.jsx`, and removed all 3 `window.dispatchEvent(new CustomEvent('teamforge:maintenance', ...))` calls from `src/services/apiClient.js`.
- Removed local duplicate `useState(true)` sidebar state from `ReduxConnectedLayout` in `src/pages/layout.jsx`.

### Remaining `teamforge:*` DOM Events (14 Events Across 22 Allowlisted Files)
- **Phase 1 (Session / Auth / Roles):** `teamforge:session_invalid`, `teamforge:token_refreshed`, `teamforge:account_suspended`, `teamforge:force_logout`, `teamforge:stop_polls`, `teamforge:role_switched`.
- **Phase 3 (Notifications / Unread Badges):** `teamforge:notification_updated` (plus `teamforge:chat_read` unread summary in `navbar.jsx`).
- **Phase 4 (Projects Lifecycle):** `teamforge:project_updated`.
- **Phase 5 (Tasks & Workspaces):** `teamforge:task_updated`, `teamforge:chat_read`.
- **Phase 7 (Profile & Badges):** `teamforge:user_updated`, `teamforge:badge_awarded`.
- **Phase 9 (Admin Moderation & Reports):** `teamforge:report_updated`.
- **Phase 10 (Mentor Applications & Approvals):** `teamforge:mentor_status_updated`.

### Phase 2 Verification Counts
- **ESLint (`npm run lint`):** `99 problems (89 errors, 10 warnings)` (`exit 1` — unchanged from baseline; **0 errors and 0 warnings** across the `19` non-legacy-interceptor Phase 2 files, while `src/services/apiClient.js` retains only pre-existing line 84 unused `refreshTokenPromise` pending Phase 1).
- **Front-End Vitest (`npx vitest run`):** `89` test files (`79 passed, 10 failed`), `410` tests (`397 passed, 13 failed`) in full run (`141.20s`), plus targeted Phase 2 & UI suite `8/8` files (`30/30` tests passed) and solo re-run of timing-sensitive baseline file `AdminReports.test.jsx` (`5/5` tests passed). Zero new test regressions (`9` pre-existing failing test files = `11` tests remain independent of Phase 2).
- **Production Build (`npm run build`):** Passed cleanly in `16.76s` (`vite build` exit `0`, `dist/assets/index-*.js` gzipped `93.74 kB`).

### Updated Scan Allowlist Counts
- `BROWSER_STORAGE_ALLOWLIST` (`src/test/NoBrowserStorageScan.test.jsx`): **24 -> 23** files (removed `context/UIContext.jsx`).
- `DIRECT_API_IMPORT_ALLOWLIST` (`src/test/NoApiInComponentsScan.test.jsx`): **57 -> 57** files (unchanged in Phase 2).
- `CUSTOM_DOM_EVENTS_ALLOWLIST` (`src/test/NoCustomDomEventsScan.test.jsx`): **23 -> 22** files (removed `App.jsx`).

### Skipped / Deferred & Other Findings
- `back-end/` and `platformConfigSlice` untouched (`platformConfig` deferred to admin/config cleanup since current UI routes already hydrate maintenance through `ui.maintenance`/`ui.resettingBanner`).
- Browser refresh resets `ui.theme` to OS `prefers-color-scheme` (accepted per Decision D4/D5 — no browser storage).


---

## Phase 3 — Notifications (`notificationsSlice`, Polling, Optimistic Rollback & Mark Read)

### Summary & Root Findings
- Implemented `notificationsSlice` (`React-Implementation/React-Implementation/src/store/slices/notificationsSlice.js`) using `createEntityAdapter`, storing normalized `entities`, `ids`, `unreadCount`, `status`, `error`, `lastFetchedAt`, `working` (`readFilter`, `filterType`, `selectedNotificationId`, `expandedGroupIds`, `expandedDigestIds`, `isMarkingAllRead`, `markAllError`), and `optimisticSnapshots`.
- Implemented all existing backend notification routes via `createAsyncThunk` in `src/store/thunks/notificationsThunks.js`: `fetchNotifications` (`GET /notifications` with `condition` skipping concurrent loads and fresh caches within `NOTIFICATIONS_STALE_MS` = 60s unless `{ force: true }`), `fetchNotificationById` (`GET /notifications/:id`), `fetchUnreadCount` (`GET /notifications/unread-count`), `markRead` (`PUT /notifications/:id/read`), `markAllRead` (`PATCH /notifications/read-all`), and `deleteNotification` (`DELETE /notifications/:id`).
- Verified backend return shapes (`back-end/src/notifications/notifications.service.ts`): `markAllAsRead` returns `{ updated, unread: 0 }`, whereas `markAsRead` returns a `Notification` and `remove` returns `void`. `markRead` and `deleteNotification` update optimistically in `.pending`, consume server unread counts when returned or refetch `fetchUnreadCount` on `.fulfilled`, and roll back entities + `unreadCount` cleanly on `.rejected` (`markAllRead` also rolls back all flipped entities, restores `unreadCount`, and sets `working.markAllError`).
- Implemented single-loop visibility-aware polling in `src/hooks/useNotificationPolling.js` using module-level singleton handles (`activePollIntervalId`, `activeVisibilityHandler`, `activePollCallbacks`) so polling runs at most once across mounts/navigation, pauses on `document.hidden`, resumes on `visibilitychange`, and cleans up on unmount or logout.
- Converted `src/context/NotificationContext.jsx` into a thin Redux shim (`ReduxNotificationBridge` + isolated `Provider` fallback for legacy non-Redux test wrappers), removed `teamforge:notification_updated` across `services/notificationsApi.js`, `NotificationContext.jsx`, and `pages/dashboard.jsx`, and connected the Navbar bell (`src/components/navbar.jsx`), `src/pages/notifications.jsx`, `src/pages/dashboard.jsx`, and `src/pages/owner/OwnerDashboard.jsx` to the shared selectors in `src/store/selectors/notificationsSelectors.js`.

### Decisions Made
1. **Isolated Fallback Store Wrapper in `NotificationContext.jsx`:** Existing integration test `Fix7NotificationsReports.test.jsx` mounts `<NotificationProvider><Navbar /><Notifications /></NotificationProvider>` without an outer Redux `<Provider>`. Wrapping `ReduxNotificationBridge` inside an `IsolatedStoreNotificationProvider` when `ReactReduxContext?.store` is absent allowed deleting both `notificationsApi` and `storage` imports from `NotificationContext.jsx` right away (`DIRECT_API_IMPORT_ALLOWLIST` and `BROWSER_STORAGE_ALLOWLIST` shrank immediately) without rewriting Phase 12 tests early.
2. **Safe Selector Subscription via `useSafeStoreSelector` (`src/store/hooks/useSafeStoreSelector.js`):** Uses `useSyncExternalStore` + `ReactReduxContext` so `Navbar`, `Notifications`, `Dashboard`, and `OwnerDashboard` read live Redux selectors identically in production and preloaded-store tests while falling back gracefully ONLY when legacy unit tests pass `<NotificationContext.Provider value={mockObj}>`.
3. **Temporary Phase 10 Mentor Approval Bridge Preserved:** `NotificationContext.jsx` retains only the `teamforge:mentor_status_updated` trigger for `MENTOR_APPLICATION_APPROVED` until `RoleContext` & `MentorApplication` migrate in Phase 10, while all `teamforge:notification_updated` and `teamforge:stop_polls` code in notifications is removed now.
4. **Serializable Expand/Filter Maps:** Replaced `new Set()` (`expandedGroupIds` / `expandedDigestIds`) in `src/pages/notifications.jsx` with Redux `working` record maps and `readFilter`/`selectedNotificationId` cleared on `routeChanged` via `addRouteReset`.

### Slices, Reducers & Thunks Added
- **Repository Slices added (`1`):** `notificationsSlice` (`name: 'notifications'`, registered in `rootReducers` inside `src/store/index.js`).
- **CRUD & Working Reducers (`11`):**
  - **4 Explicit CRUD Reducers:** `setAll`, `addOne`, `updateOne`, `removeOne` (keeping `isRead`/`readStatus` and `unreadCount` synchronized).
  - **Working / Reset Reducers:** `setNotificationFilter`, `setSelectedNotificationId`, `toggleGroupExpanded`, `toggleDigestExpanded`, `clearMarkAllError`, `clearWorkingState`, `resetSlice` + `extraReducers` (`addRouteReset`, `sessionReset`, and thunk lifecycles).
- **Async Thunks added (`6`):** `fetchNotifications`, `fetchNotificationById`, `fetchUnreadCount`, `markRead`, `markAllRead`, `deleteNotification` (`src/store/thunks/notificationsThunks.js`).

### Files Changed (Grouped by Student Owner per `07-conversion-plan.md`)
- **Aditya Sai (Store Core, Notifications & Navbar):**
  - Docs: `docs/redux-analysis/08-progress.md`
  - Redux Notifications & Polling: `src/store/thunks/notificationsThunks.js`, `src/store/slices/notificationsSlice.js`, `src/store/selectors/notificationsSelectors.js`, `src/store/hooks/useSafeStoreSelector.js`, `src/hooks/useNotificationPolling.js`, `src/store/index.js`
  - API, Shim & UI Bell/Page: `src/services/notificationsApi.js`, `src/context/NotificationContext.jsx`, `src/components/navbar.jsx`, `src/pages/notifications.jsx`
  - Tests & Scans: `src/store/__tests__/notificationsSliceAndPolling.test.jsx`, `src/test/NoBrowserStorageScan.test.jsx`, `src/test/NoApiInComponentsScan.test.jsx`, `src/test/NoCustomDomEventsScan.test.jsx`
- **Jathin Surya (`dashboard.jsx` Notification Consumer):**
  - `src/pages/dashboard.jsx`
- **Rithvik (`OwnerDashboard.jsx` Notification Consumer):**
  - `src/pages/owner/OwnerDashboard.jsx`
- **Satwik, Kevin Gandham:** `0` files in Phase 3.

### Old Code Removed
- Removed all 3 `window.dispatchEvent(new CustomEvent('teamforge:notification_updated'))` side effects from `src/services/notificationsApi.js`.
- Removed `teamforge:notification_updated`, `teamforge:stop_polls`, direct `notificationsApi` fetching, `storage.getBackendUserId()`, and manual `setInterval` / `lastFetchTime` polling state from `src/context/NotificationContext.jsx`.
- Removed `teamforge:notification_updated` listener/cleanup from `src/pages/dashboard.jsx`.
- Removed `new Set()` `expandedDigestIds` / `expandedGroupIds`, local `isMarkingAllRead`, and local `markAllError` primary state from `src/pages/notifications.jsx` in Redux mode.

### Phase 3 Verification Counts
- **ESLint (`npm run lint`):** `99 problems (89 errors, 10 warnings)` (`exit 1` — unchanged from baseline; **0 errors and 0 warnings** across all `15` modified/created Phase 3 files other than pre-existing warnings/unused var in `src/pages/dashboard.jsx`).
- **Front-End Vitest (`npx vitest run`):** `90` test files (`81 passed, 9 failed`), `416` tests (`405 passed, 11 failed`), Duration `129.18s`. Targeted Phase 3 & notification suite passed **`10/10` files (`44/44` tests)** (`notificationsSliceAndPolling` `6/6`, `Fix7NotificationsReports` `7/7`, `NotificationAppeal` `4/4`, `Phase18PrivacyNotifications` `4/4`, `Phase26ParityAggregation` `10/10`, 3 scan tests, `storeFoundation`, `uiSliceAndReset`).
- **Production Build (`npm run build`):** Passed cleanly in `12.30s` (`vite build` exit `0`, `259` modules, `dist/assets/index-*.js` gzipped `98.77 kB`).

### Updated Scan Allowlist Counts
- `BROWSER_STORAGE_ALLOWLIST` (`src/test/NoBrowserStorageScan.test.jsx`): **23 -> 22** files (removed `context/NotificationContext.jsx`).
- `DIRECT_API_IMPORT_ALLOWLIST` (`src/test/NoApiInComponentsScan.test.jsx`): **57 -> 56** files (removed `context/NotificationContext.jsx`).
- `CUSTOM_DOM_EVENTS_ALLOWLIST` (`src/test/NoCustomDomEventsScan.test.jsx`): **22 -> 21** files (removed `services/notificationsApi.js`).

### Skipped / Deferred & Other Findings
- `back-end/` left untouched. Chat unread badge (`navbar.jsx` `chatUnread`) remains in local state pending Phase 5 (`chatMessagesSlice`).
- `context/NotificationContext.jsx` stays in `CUSTOM_DOM_EVENTS_ALLOWLIST` solely for its temporary `teamforge:mentor_status_updated` trigger until Phase 10; `pages/notifications.jsx` stays in `DIRECT_API_IMPORT_ALLOWLIST` for `appealsApi`, `adminApi`, and `projectsApi` until Phases 6 & 9.


---

## Phase 4 — Projects (`projectsSlice`, Reference Implementation of the Pattern)

### Summary & Root Findings
- Audited `back-end/src/projects/projects.controller.ts` and `src/services/projectsApi.js`: confirmed all existing routes used by FE (`list`, `getMyWork`, `get`, `getMembers`, `create`, `update`, `changeDeadline` + `deadlineHistory`, `complete`, `checkDeletion`, `softDelete`, `cancelDeletion`, `getRemovalCheck`, `removeMember`, `releaseMemberTasks`, `getMyLeaveRequest`, `submitLeaveRequest`, `withdrawLeaveRequest`, `requestClose`, `getMatch`, `getTaskTemplatesByCategory`, `getProjectTaskTemplates`, `applyProjectTaskTemplates`). No `/export` or `/clone` routes exist on the backend (`Decision D8`: never invent routes).
- Built `projectsSlice` (`src/store/slices/projectsSlice.js`), `projectsThunks.js`, `projectsSelectors.js`, and `src/store/README.md` (`"Worked example: projectsSlice"`) as the documented template for Phases 5–11.
- Normalized all project entities via `createEntityAdapter` so records from Marketplace, My Projects, My Work, and Workspaces merge without duplicates and preserve detail fields (`members`, `deadlineHistory`), while storing server-returned view order ID lists (`marketplaceIds`, `myProjectIds`, `myWorkOngoingIds`, `myWorkCompletedIds`) and `summary` counts verbatim.
- Converted `ProjectsMarketplace`, `MyProjects`, `MyWork`, `CreateProject`, `CollaboratorWorkspace`, `OwnedWorkspace` (Overview/Members project sources and project write handlers without restructuring the 4,173-line file), `DeleteProjectDialog`, and `ProjectTombstone` to Redux; removed all `12` `teamforge:project_updated` dispatches and `clearApiCache()` calls in `projectsApi.js` and listeners in `navbar.jsx` and `dashboard.jsx`.

### Decisions Made
1. **Defensive Substate Guards for Partial Preloaded Store (`ensureProjectsSubstates`):** Added `ensureProjectsSubstates(state)` in `projectsSlice.js` so unit/integration tests that pass partial `preloadedState.projects` fixtures (`ids`, `entities`, view lists) never fail when actions mutate `working`, `summary`, or `viewLastFetchedAt`.
2. **Preserve Single/Exact Optional Spy Arguments (`projectsThunks.js`):** Existing Vitest assertions (`Fix5ProjectHealthAndMyWork` expecting `getMyWork('u-collab')`, `EnhancedProjectDeletion` expecting `checkDeletion('proj-100')`, etc.) pass strict single-argument checks; thunks omit trailing `role`/`userId` args whenever `undefined`.
3. **Pure Lifecycle Utilities Split (`src/utils/projectStatus.js`):** Moved `isProjectLocked` and `isProjectActive` into `src/utils/projectStatus.js` (re-exported by `services/projectsApi.js`) so converted components like `MyProjects.jsx` need zero imports from `src/services/projectsApi.js`.
4. **Scoped Legacy Store Fallback (`withOptionalStore.jsx`):** Wrapped exported page/dialog components with `withOptionalStore` so production renders use the shared root `<Provider store={store}>` identically while 20+ existing non-`<Provider>` Vitest files continue passing via real Redux `projectsSlice` without premature test rewrites.

### Slices, Reducers & Thunks Added
- **Repository Slices added (`1`):** `projectsSlice` (`name: 'projects'`, registered in `rootReducers` inside `src/store/index.js`).
- **CRUD & Working Reducers (`15`):**
  - **4 Explicit CRUD Reducers:** `setAll`, `addOne`, `updateOne`, `removeOne` (`removeOne` also purges IDs from `marketplaceIds`, `myProjectIds`, `myWorkOngoingIds`, `myWorkCompletedIds`, and auxiliary detail maps).
  - **Working / Reset Reducers:** `setSearchQuery`, `setMyProjectsFilter`, `setMyWorkFilter`, `setSelectedProjectId`, `setSelectedTab`, `setMarketplacePreviewId`, `setSummaryProjectId`, `clearStarterTemplates`, `setStarterError`, `setProjectUiError`, `setRemovalCheckEntry`, `clearWorkingState`, `resetSlice` + `extraReducers` (`addRouteReset`, `sessionReset`, and thunk lifecycles).
- **Async Thunks added (`21`):** `fetchProjects`, `fetchMyProjects`, `fetchMyWork`, `fetchProjectById`, `fetchProjectMembers`, `fetchProjectMatch`, `createProject`, `updateProject`, `changeProjectDeadline`, `completeProject`, `checkProjectDeletion`, `deleteProject`, `cancelProjectDeletion`, `fetchRemovalCheck`, `removeProjectMember`, `releaseMemberTasks`, `fetchMyProjectLeaveRequest`, `submitProjectLeaveRequest`, `withdrawProjectLeaveRequest`, `requestCloseProject`, `fetchTaskTemplatesByCategory`, `fetchProjectTaskTemplates`, `applyProjectTaskTemplates` (`23` exported thunks in `projectsThunks.js`).

### Files Changed (Grouped by Student Owner per `07-conversion-plan.md`)
- **Rithvik (`projectsSlice` Reference Model & Owner/Collab Project Screens):**
  - Redux Core: `src/store/slices/projectsSlice.js`, `src/store/thunks/projectsThunks.js`, `src/store/selectors/projectsSelectors.js`, `src/utils/projectStatus.js`
  - Screens & Dialogs: `src/pages/owner/MyProjects.jsx`, `src/pages/owner/CreateProject.jsx`, `src/pages/owner/OwnedWorkspace.jsx` (Overview & Members project data sources + project write handlers), `src/components/features/DeleteProjectDialog.jsx`, `src/pages/ProjectTombstone.jsx`
  - Tests: `src/store/__tests__/projectsSliceAndThunks.test.jsx`
- **Satwik (`ProjectsMarketplace`, `MyWork`, `CollaboratorWorkspace`):**
  - `src/pages/collaborator/ProjectsMarketplace.jsx`, `src/pages/collaborator/MyWork.jsx`, `src/pages/collaborator/CollaboratorWorkspace.jsx`
- **Aditya Sai (Store Wiring, Docs, Services & Scans):**
  - Docs: `src/store/README.md` (`Worked example: projectsSlice`), `docs/redux-analysis/08-progress.md`
  - Store & Event Cleanup: `src/store/index.js`, `src/store/components/withOptionalStore.jsx`, `src/services/projectsApi.js`, `src/components/navbar.jsx`
  - Scans: `src/test/NoBrowserStorageScan.test.jsx`, `src/test/NoApiInComponentsScan.test.jsx`
- **Jathin Surya (`dashboard.jsx` Event Cleanup):**
  - `src/pages/dashboard.jsx` (removed `teamforge:project_updated` listener)
- **Kevin Gandham:** `0` files in Phase 4 (admin project screens are scoped to Phase 11).

### Old Code Removed
- Removed all `12` `window.dispatchEvent(new CustomEvent('teamforge:project_updated'))` dispatches and `clearApiCache()` calls in `src/services/projectsApi.js`.
- Removed `teamforge:project_updated` listeners/cleanups in `src/components/navbar.jsx` and `src/pages/dashboard.jsx`.
- Removed `storage` (`storage.getBackendUserId()`) import from `src/pages/collaborator/ProjectsMarketplace.jsx`.
- Removed `projectsApi` imports and local project `useState`/`useEffect` fetching from `MyProjects.jsx`, `MyWork.jsx`, `CreateProject.jsx`, `ProjectsMarketplace.jsx`, `CollaboratorWorkspace.jsx`, `DeleteProjectDialog.jsx`, and Overview/Members project state setters in `OwnedWorkspace.jsx`.

### Phase 4 Verification Counts
- **Targeted Phase 4 & Project UI Vitest (`15` files):** **`15 passed (15)`**, **`64 passed (64)`** tests (`projectsSliceAndThunks` `7/7`, 3 scan tests, `Fix5ProjectHealthAndMyWork` `1/1`, `MyProjectsCompletedDeleteRemoval` `3/3`, `Phase28StarterTemplates` `3/3`, `EnhancedProjectDeletion` `8/8`, `ChangeDeadlineModal` `1/1`, `Phase12StuckProjects` `5/5`, `Phase3ProjectCompletionFinality` `8/8`, `Phase8OwnerWorkspace` `6/6`, `Phase9CollaboratorScreens` `12/12`, `Step1MembersList` `3/3`, `Step2RemovalCheck` `4/4`).
- **Full Vitest (`npx vitest run`):** `91` test files (`79 passed, 12 failed`), `423` tests (`408 passed, 15 failed`), Duration `144.98s`. Solo re-run of the 3 timing-sensitive `userEvent` test files (`AdminReports` `5/5`, `AdminUserDetails` `4/4`, `HelpReport` `5/5`) passed **`3/3` (`14/14` tests)**, confirming all **`9` remaining failing files (`11` tests)** match the pre-conversion baseline.
- **ESLint (`npm run lint`):** Improved from baseline `99 problems (89 errors, 10 warnings)` down to **`93 problems (83 errors, 10 warnings)`** (`-6` legacy errors removed; **0 errors and 0 warnings** across the `19` targeted Phase 4 files).
- **Production Build (`npm run build`):** Passed cleanly in `13.72s` (`vite build` exit `0`, `264` modules, `dist/assets/index-*.js` gzipped `103.99 kB`).

### Updated Scan Allowlist Counts
- `BROWSER_STORAGE_ALLOWLIST` (`src/test/NoBrowserStorageScan.test.jsx`): **22 -> 21** files (removed `pages/collaborator/ProjectsMarketplace.jsx`).
- `DIRECT_API_IMPORT_ALLOWLIST` (`src/test/NoApiInComponentsScan.test.jsx`): **56 -> 54** files (removed `components/features/DeleteProjectDialog.jsx`, `pages/owner/MyProjects.jsx`).
- `CUSTOM_DOM_EVENTS_ALLOWLIST` (`src/test/NoCustomDomEventsScan.test.jsx`): **21 -> 21** files (`services/projectsApi.js`, `components/navbar.jsx`, `pages/dashboard.jsx` cleared `teamforge:project_updated` while keeping Phase 5/1 events).

### Skipped / Deferred & Other Findings
- Admin project pages (`AdminProjects`, `AdminProjectDetails`) remain in Phase 11; Tasks remain in Phase 5; Join/Leave/Invite tabs remain in Phase 6 (`OwnedWorkspace.jsx` still holds tasks/invites/leaveRequests API calls for Phases 5–6). `back-end/` left untouched.

---

## Phase 5 — Tasks and Action Feedback (`tasksSlice`, `actionFeedbackSlice`)

### Summary & Root Findings
- Converted task board/list/review/unassign workflows and universal action-feedback reasons/history to Redux Toolkit (`tasksSlice`, `actionFeedbackSlice`) following the [`projectsSlice`](./05-thunk-pattern.md) reference model.
- Audited every backend route in [`back-end/src/tasks/tasks.controller.ts`](../../back-end/src/tasks/tasks.controller.ts) and [`back-end/src/feedback/feedback.controller.ts`](../../back-end/src/feedback/feedback.controller.ts); added missing `addComment` transport wrapper on [`tasksApi.js`](../../React-Implementation/React-Implementation/src/services/tasksApi.js) for existing `POST /tasks/:id/comments` so all task endpoints have real thunks (`tasksThunks.js`).
- Removed the module-level `cachedReasonsConfig` / `pendingConfigRequest` cache in [`feedbackApi.js`](../../React-Implementation/React-Implementation/src/services/feedbackApi.js) in favor of single-fetch caching inside `actionFeedbackSlice` via `fetchFeedbackReasons`'s `condition` guard (`force: true` supported).
- Eliminated every `teamforge:task_updated` dispatch in [`tasksApi.js`](../../React-Implementation/React-Implementation/src/services/tasksApi.js) (`6` dispatches) and [`projectsApi.js`](../../React-Implementation/React-Implementation/src/services/projectsApi.js) (`4` dispatches) as well as all `teamforge:task_updated` window listeners in [`dashboard.jsx`](../../React-Implementation/React-Implementation/src/pages/dashboard.jsx) and [`leaderboard.jsx`](../../React-Implementation/React-Implementation/src/pages/leaderboard.jsx).

### Decisions Made
1. **Slice Naming (`actionFeedbackSlice` / `state.actionFeedback`):** Followed Decision D1 in `01-repositories-and-crud.md` and `07-conversion-plan.md` using `actionFeedback` (`actionFeedbackSlice.js`, paired with `feedbackThunks.js` and `feedbackSelectors.js`) rather than an alternate `feedback` key.
2. **Extracted Fallback Reason Constants (`src/constants/feedbackConfig.js`):** Extracted `OTHER_REASON_ID` and `FALLBACK_ACTION_CONFIGS` out of `UniversalReasonModal.jsx` so both `feedbackSelectors.js` and `UniversalReasonModal.jsx` share fallback metadata without circular dependencies and `UniversalReasonModal.jsx` triggers `0` `react-refresh/only-export-components` warnings.
3. **Hook Fallback in `useReasonAction.jsx`:** Kept exported `actionApi` object intact (preserving legacy `Phase9CollaboratorScreens.test.jsx` imports/spies) while routing `handleDropTask` and `handleRejectWork` through `reduxStore.dispatch(unassignTask / reviewTask)` via `ReactReduxContext` whenever mounted under `<Provider>`.
4. **Optimistic Status Transition + Safe Rejections:** `updateTaskStatus` supports `{ optimistic: true }` with snapshot save in `.pending` and automatic rollback in `.rejected` (used for collaborator Start Task); `reviewTask` applies changes only in `.fulfilled` so rejected `409` or validation responses leave the task untouched in store and surface `working.reviewError` (`minProjectDueDate`, `reviewCreditMs`, `statusCode`).
5. **Cross-Slice Synchronization (`removeProjectMember` & `releaseMemberTasks`):** `tasksSlice` listens to `projectsThunks` member-removal and release-tasks `.fulfilled` actions in `extraReducers` so task ownership/status stays consistent across workspaces without DOM events.

### Slices, Reducers & Thunks Added
- **Slices added (`2`):**
  - `src/store/slices/tasksSlice.js` (`tasks` — `createEntityAdapter`, `taskIdsByProject`, `byProjectStatus`, `byProjectError`, `byProjectLastFetchedAt`, `forbiddenByProject`, `optimisticSnapshots`, `working`)
  - `src/store/slices/actionFeedbackSlice.js` (`actionFeedback` — `createEntityAdapter`, `reasonsConfig`, `reasonCategories`, `reasonsStatus`, `reasonsError`, `reasonsLastFetchedAt`, `historyIdsByEntity`, `entityStatusByKey`, `entityErrorByKey`, `entityLastFetchedAtByKey`, `working`)
- **4 Explicit CRUD Reducers per Slice (`8` total):** `setAll`, `addOne`, `updateOne`, `removeOne` on both `tasksSlice` and `actionFeedbackSlice` (plus helper `upsertMany` on `tasksSlice`).
- **Working / Reset Handlers:** Both slices register `addRouteReset` (`routeChanged` clears `working` selection, filters, active entity/action keys, and API error fields while keeping loaded entities, `taskIdsByProject`, `reasonsConfig`, and `historyIdsByEntity`) and `sessionReset`.
- **Thunks added (`11`):**
  - `src/store/thunks/tasksThunks.js` (`9`): `fetchTasksByProject`, `fetchTasksForProjects`, `fetchTaskById`, `createTask`, `updateTask`, `updateTaskStatus`, `reviewTask` (cascades `fetchProjectById` on `extendedProjectDueDate`), `unassignTask`, `addTaskComment`, `deleteTask` (`10` exported thunks).
  - `src/store/thunks/feedbackThunks.js` (`2`): `fetchFeedbackReasons` (fetched once & reused unless `{ force: true }`), `fetchEntityFeedback`.

### Files Changed (Grouped by Student Owner per `07-conversion-plan.md`)
- **Satwik (`tasksSlice`, Collaborator Workspaces & Task Components):**
  - `src/store/slices/tasksSlice.js`, `src/store/thunks/tasksThunks.js`, `src/store/selectors/tasksSelectors.js`
  - `src/pages/collaborator/MyWork.jsx`, `src/pages/collaborator/CollaboratorWorkspace.jsx`
  - `src/pages/profile.jsx` (task list fan-out via `fetchTasksForProjects`)
- **Rithvik (`actionFeedbackSlice`, Reason Modals, History & Owner Task Board):**
  - `src/constants/feedbackConfig.js`, `src/store/slices/actionFeedbackSlice.js`, `src/store/thunks/feedbackThunks.js`, `src/store/selectors/feedbackSelectors.js`
  - `src/components/common/UniversalReasonModal.jsx`, `src/components/features/FeedbackHistory.jsx`, `src/hooks/useReasonAction.jsx`
  - `src/pages/owner/OwnedWorkspace.jsx`, `src/pages/owner/OwnerDashboard.jsx`
- **Jathin Surya (Mentor Screens & Shared Page Cleanup):**
  - `src/pages/mentor/MentorProjectWorkspace.jsx`, `src/pages/mentor/MentorRequests.jsx`, `src/pages/dashboard.jsx`, `src/pages/leaderboard.jsx`
- **Kevin Gandham (Admin Project Task Details):**
  - `src/pages/admin/AdminProjectDetails.jsx`
- **Aditya Sai (Store Wiring, Services, Tests & Scan Allowlists):**
  - `src/store/index.js`, `src/services/tasksApi.js`, `src/services/feedbackApi.js`, `src/services/projectsApi.js`
  - `src/store/__tests__/tasksAndFeedback.test.jsx`, `src/test/NoApiInComponentsScan.test.jsx`, `src/test/NoCustomDomEventsScan.test.jsx`
  - `docs/redux-analysis/08-progress.md`

### Old Code Removed
- Deleted `cachedReasonsConfig` and `pendingConfigRequest` module cache variables and caching logic from `src/services/feedbackApi.js`.
- Removed all `6` `window.dispatchEvent(new CustomEvent('teamforge:task_updated'))` dispatches from `src/services/tasksApi.js` and all `4` `teamforge:task_updated` dispatches from `src/services/projectsApi.js`.
- Removed `teamforge:task_updated` `addEventListener`/`removeEventListener` hooks from `src/pages/dashboard.jsx` and `src/pages/leaderboard.jsx`.
- Removed `tasksApi` / `feedbackApi` imports and local `tasks`/`dropReasons`/`configs` fetch state from `UniversalReasonModal.jsx`, `FeedbackHistory.jsx`, `MyWork.jsx`, `CollaboratorWorkspace.jsx`, `OwnedWorkspace.jsx`, `OwnerDashboard.jsx`, `MentorProjectWorkspace.jsx`, `MentorRequests.jsx`, `profile.jsx`, and `AdminProjectDetails.jsx`.

### Phase 5 Verification Counts
- **Targeted Phase 5 & Scan Vitest (`15` files):** **`15 passed (15)`**, **`61 passed (61)`** tests (`tasksAndFeedback.test.jsx` `14/14`, `NoApiInComponentsScan` `1/1`, `NoCustomDomEventsScan` `1/1`, `NoBrowserStorageScan` `1/1`, `UniversalReasonModal` `4/4`, `FeedbackHistory` `3/3`, `Fix4UniversalFeedback` `2/2`, `Fix5ProjectHealthAndMyWork` `1/1`, `ProfileMentoredProjects` `2/2`, `ProfileCompletedProjects` `3/3`, `Phase9CollaboratorScreens` `12/12`, `ReviewCredit` `3/3`, `Phase13TaskReview` `4/4`, `Step2RemovalCheck` `4/4`, `Phase8OwnerWorkspace` `6/6`).
- **Full Vitest (`npx vitest run`):** `92` test files (`80 passed, 12 failed`), `437` tests (`421 passed, 16 failed`), Duration `151.89s`. Solo re-run of the 3 parallel-contention timeout suites (`AdminReports` `5/5`, `HelpReport` `5/5`, `Phase9EscrowPaymentSafety` `5/5`) passed **`3/3` (`15/15` tests)**, leaving **`9` pre-existing baseline failing files (`11` tests)** with `0` regressions.
- **ESLint (`npm run lint`):** Improved from `93 problems (83 errors, 10 warnings)` down to **`88 problems (79 errors, 9 warnings)`** (`0` errors and `0` warnings across the `22` Phase 5 files linted cleanly; remaining `3` errors / `6` warnings across touched legacy files are pre-existing issues in `OwnedWorkspace.jsx`, `dashboard.jsx`, and `profile.jsx`).
- **Production Build (`npm run build`):** Passed cleanly in `34.29s` (`vite build` exit `0`, `271` modules, main chunk `dist/assets/index-*.js` gzipped `108.06 kB`).

### Updated Scan Allowlist Counts
- `BROWSER_STORAGE_ALLOWLIST` (`src/test/NoBrowserStorageScan.test.jsx`): **21** files (unchanged in Phase 5).
- `DIRECT_API_IMPORT_ALLOWLIST` (`src/test/NoApiInComponentsScan.test.jsx`): **54 -> 51** files (removed `components/common/UniversalReasonModal.jsx`, `components/features/FeedbackHistory.jsx`, `pages/collaborator/MyWork.jsx`).
- `CUSTOM_DOM_EVENTS_ALLOWLIST` (`src/test/NoCustomDomEventsScan.test.jsx`): **21 -> 18** files (removed `pages/leaderboard.jsx`, `services/projectsApi.js`, `services/tasksApi.js`).

### Skipped / Deferred & Other Findings
- `hooks/useReasonAction.jsx` retains non-task API imports (`projectsApi`, `joinRequestsApi`, `mentorMarketplaceApi`) for Phases 6 and 8; workspaces retain `joinRequestsApi` / `communicationApi` / `mentorMarketplaceApi` for later phases (`Chat` & `Requests`). `back-end/` left untouched.

---

## Phase 6 — Join Requests, Project Invitations, and Leave Requests

### Summary & Root Findings
- Created three domain repository slices per [01-repositories-and-crud.md](file:///c:/Users/adity/OneDrive/Desktop/26_PINEAPPLE-1/docs/redux-analysis/01-repositories-and-crud.md) and [07-conversion-plan.md](file:///c:/Users/adity/OneDrive/Desktop/26_PINEAPPLE-1/docs/redux-analysis/07-conversion-plan.md): `joinRequestsSlice`, `projectInvitesSlice`, and `leaveRequestsSlice`.
- Verified backend routes in `back-end/src/join-requests/join-requests.controller.ts` (`findByProjectDetailed` combining `Applied` and `Invited` items with `filterGroup` tags), `back-end/src/projects/invites.controller.ts`, and `back-end/src/projects/projects.controller.ts` (leave requests & project invites).
- Wired combined requests and chip counts (`All`, `Pending`, `Approved`, `Rejected`) through `selectCombinedProjectRequests` and `selectFilteredCombinedProjectRequests` while moving `requestStatusFilter` and `membersSubSection` into `joinRequestsSlice.working` (reset on `routeChanged`).
- Removed `AppliedProjects.jsx`'s remaining `storage.getBackendUserId()`, `storage.clearLegacyInviteKeys()`, `joinRequestsApi`, and `projectsApi` calls, shrinking both `DIRECT_API_IMPORT_ALLOWLIST` and `BROWSER_STORAGE_ALLOWLIST`.

### Decisions Made
1. **Combined Server List + Separate Invite Merge (`selectCombinedProjectRequests`):** Stored both server-returned `{ items, counts }` (when present) and raw `JoinRequestEntity[]` / `ProjectInvite[]` arrays, deduplicating by ID so both real backend `GET /join-requests?projectId=...` responses and unit-test mocks returning separate `list` + `listInvites` arrays agree 100%.
2. **Double-Click Idempotency Guard in Both Slice & Card:** `respondJoinRequest`, `acceptProjectInvite`, `declineProjectInvite`, `approveLeaveRequest`, and `rejectLeaveRequest` all guard against concurrent in-flight calls via `condition` checks on `respondingIds` / `actingIds` / `processingIds`, and `JoinRequestCard` disables Approve / Reject / Cancel from `selectIsJoinRequestResponding` and `selectIsInviteActing`.
3. **Cross-Slice Synchronization (`joinRequests` <-> `projectInvites` & `leaveRequests` <-> `projects`):** `joinRequestsSlice` listens to `cancelProjectInvite.fulfilled`, `acceptProjectInvite.fulfilled`, `declineProjectInvite.fulfilled`, `completeProject.fulfilled`, and `removeProjectMember.fulfilled`; `leaveRequestsSlice` stays synchronized with both `leaveRequestsThunks` and Phase 4 `projectsThunks` leave actions (`fetchMyProjectLeaveRequest`, `submitProjectLeaveRequest`, `withdrawProjectLeaveRequest`).
4. **Unified Invite Actions in `useReasonAction.jsx`:** Routed `handleDeclineInvite`, `handleAcceptInvite`, and `handleWithdrawApplication` through Redux thunks via `ReactReduxContext` whenever `<Provider>` is mounted while preserving exported `actionApi` compatibility for standalone legacy specs.

### Slices, Reducers & Thunks Added
- **Slices added (`3`):**
  - `src/store/slices/joinRequestsSlice.js` (`joinRequests`)
  - `src/store/slices/projectInvitesSlice.js` (`projectInvites`)
  - `src/store/slices/leaveRequestsSlice.js` (`leaveRequests`)
- **Explicit CRUD Reducers (`12` total — `4` per slice):** `setAll`, `addOne`, `updateOne`, `removeOne` on `joinRequestsSlice`, `projectInvitesSlice`, and `leaveRequestsSlice`.
- **Thunks added (`19`):**
  - `src/store/thunks/joinRequestsThunks.js` (`7`): `fetchJoinRequests`, `fetchMyJoinRequests`, `fetchJoinRequestById`, `createJoinRequest`, `updateJoinRequest`, `respondJoinRequest`, `deleteJoinRequest`.
  - `src/store/thunks/invitesThunks.js` (`6`): `fetchProjectInvites`, `fetchMyInvites`, `sendProjectInvite`, `cancelProjectInvite`, `acceptProjectInvite`, `declineProjectInvite`.
  - `src/store/thunks/leaveRequestsThunks.js` (`6`): `fetchProjectLeaveRequests`, `fetchMyLeaveRequest`, `createLeaveRequest`, `withdrawLeaveRequest`, `approveLeaveRequest`, `rejectLeaveRequest`.

### Files Changed (Grouped by Student Owner per `07-conversion-plan.md`)
- **Rithvik (`joinRequestsSlice`, `projectInvitesSlice`, `leaveRequestsSlice`, Owner/Collab Request Flows):**
  - Redux Modules: `src/store/slices/joinRequestsSlice.js`, `src/store/thunks/joinRequestsThunks.js`, `src/store/selectors/joinRequestsSelectors.js`, `src/store/slices/projectInvitesSlice.js`, `src/store/thunks/invitesThunks.js`, `src/store/selectors/invitesSelectors.js`, `src/store/slices/leaveRequestsSlice.js`, `src/store/thunks/leaveRequestsThunks.js`, `src/store/selectors/leaveRequestsSelectors.js`
  - UI & Hooks: `src/components/features/JoinRequestCard.jsx`, `src/hooks/useReasonAction.jsx`, `src/pages/collaborator/AppliedProjects.jsx`, `src/pages/owner/OwnedWorkspace.jsx`, `src/pages/owner/OwnerDashboard.jsx`
- **Satwik (`ProjectsMarketplace`, `CollaboratorWorkspace`):**
  - `src/pages/collaborator/ProjectsMarketplace.jsx`, `src/pages/collaborator/CollaboratorWorkspace.jsx`
- **Jathin Surya (`profile.jsx` Join Requests):**
  - `src/pages/profile.jsx`
- **Aditya Sai (Store Wiring, `notifications.jsx` Invites, Scans & Tests):**
  - `src/store/index.js`, `src/pages/notifications.jsx`, `src/store/__tests__/requestsInvitesAndLeave.test.jsx`, `src/test/NoApiInComponentsScan.test.jsx`, `src/test/NoBrowserStorageScan.test.jsx`, `docs/redux-analysis/08-progress.md`
- **Kevin Gandham:** `0` files in Phase 6.

### Old Code Removed
- Removed `joinRequestsApi`, `projectsApi`, and `storage` imports, `localStorage` invite cleanup call, and local `applications` state from `src/pages/collaborator/AppliedProjects.jsx`.
- Removed `joinRequestsApi` import and local `myApplications`/`myInvites` fetch loops from `src/pages/collaborator/ProjectsMarketplace.jsx` (added card Withdraw dispatch).
- Removed `joinRequestsApi` import, local `joinRequests`/`projectInvites`/`leaveRequests`/`requestStatusFilter` states, inline combined-items builder, and direct `listInvites`/`sendInvite`/`cancelInvite`/`approveLeaveRequest`/`rejectLeaveRequest` calls from `src/pages/owner/OwnedWorkspace.jsx`.
- Removed `projectsApi` import and local `invites` state/fetch from `src/pages/notifications.jsx`.
- Removed `joinRequestsApi` imports and calls from `src/pages/owner/OwnerDashboard.jsx` and `src/pages/profile.jsx`.

### Phase 6 Verification Counts
- **Targeted Phase 6 & Scan Vitest (`17` suites):** **`17 passed (17)`**, **`78 passed (78)`** tests across `requestsInvitesAndLeave.test.jsx` (`12/12`), `NoApiInComponentsScan`, `NoBrowserStorageScan`, `NoCustomDomEventsScan`, `Fix3JoinRequestsAndInvites`, `AppliedProjectsReason`, `OwnerRejectModal`, `LeaveRequestAndDeletionCheck`, `Phase8OwnerWorkspace`, `Phase9CollaboratorScreens`, `Phase12StuckProjects`, `Phase15CollaborationUx`, `Phase24LifecycleCleanup`, `notificationsSliceAndPolling`, `projectsSliceAndThunks`, `Step1MembersList`, and `Step2RemovalCheck`.
- **Full Vitest (`npx vitest run`):** `93` test files (`83 passed, 10 failed`), `449` tests (`437 passed, 12 failed`), Duration `120.53s`. Solo re-run of `Fix2AccountAndProfile.test.jsx` passed **`5/5`**, leaving only the **`9` pre-existing baseline failing files (`11` tests)** with `0` regressions.
- **ESLint (`npm run lint`):** **`88 problems (79 errors, 9 warnings)`** (unchanged vs Phase 5 baseline; **`0` errors and `0` warnings** across all `20` Phase 6 files linted directly).
- **Production Build (`npm run build`):** Passed cleanly in `40.47s` (`vite build` exit `0`, `280` modules, main chunk `dist/assets/index-*.js` gzipped `112.94 kB`).

### Updated Scan Allowlist Counts
- `BROWSER_STORAGE_ALLOWLIST` (`src/test/NoBrowserStorageScan.test.jsx`): **21 -> 20** files (removed `pages/collaborator/AppliedProjects.jsx`).
- `DIRECT_API_IMPORT_ALLOWLIST` (`src/test/NoApiInComponentsScan.test.jsx`): **51 -> 50** files (removed `pages/collaborator/AppliedProjects.jsx`).
- `CUSTOM_DOM_EVENTS_ALLOWLIST` (`src/test/NoCustomDomEventsScan.test.jsx`): **18** files (unchanged in Phase 6).

### Skipped / Deferred & Other Findings
- `ProjectsMarketplace.jsx` keeps `usersApi` (response time) until Phase 7 and `projectsApi` for `typeof projectsApi.getMatch === 'function'` guard; `useReasonAction.jsx` retains fallback imports inside exported `actionApi` for legacy non-store specs; `notifications.jsx` retains `appealsApi`/`adminApi` until Phase 9; `OwnerDashboard.jsx` and `profile.jsx` retain user/projects/gamification/mentorship APIs until Phase 7. `back-end/` left untouched.

---

## Phase 7 — Chat (`communicationSlice`, Unread Counts, Polling, and Message Reports)

### Summary & Root Findings
- Verified backend routes in `back-end/src/communication/communication.controller.ts` (`GET /communication/messages/project/:projectId`, `POST /communication/messages`, `POST /communication/messages/:id/report`, `GET /communication/unread`, `POST /communication/projects/:id/read`) and confirmed Help & Support "My reports" (`GET /reports/mine`) belongs to `ReportsController` (Phase 10, `src/pages/help.jsx` imports `reportsApi` only).
- Created `communicationSlice` (`state.communication`), `communicationThunks.js`, `communicationSelectors.js`, and single-loop polling hooks (`useChatUnreadPolling` & `useChatMessagesPolling` in `src/hooks/useChatPolling.js`).
- Removed local chat `useState` copies, direct `communicationApi` calls, `useVisibilityPoll` chat timers, and all `teamforge:chat_read` DOM events across `ChatBox.jsx`, `navbar.jsx`, `OwnedWorkspace.jsx`, `CollaboratorWorkspace.jsx`, and `MentorProjectWorkspace.jsx`.

### Decisions Made
1. **Slice Name Override (`communicationSlice` / `state.communication`):** Phase 7 instructions specified `communicationSlice`, overriding the earlier `chatMessagesSlice` draft name in `01-repositories-and-crud.md` and `07-conversion-plan.md` per the Precedence Rule in `09-redux-rules.md`.
2. **Serializable Reported Map (`reportedIdsById`):** Replaced `ChatBox.jsx`'s local `useState(() => new Set())` with plain serializable object map `reportedIdsById: { [id]: true }` inside `communicationSlice` so RTK `serializableCheck` passes cleanly.
3. **Dual-Channel Single-Loop Polling (`src/hooks/useChatPolling.js`):** Separated navbar unread polling (`useChatUnreadPolling`, 60s) and active workspace chat polling (`useChatMessagesPolling`, 6s) with module-scoped interval handles and `visibilitychange` handlers so each loop runs at most once, pauses while `document.hidden === true`, resumes on visibility, and cleans up on unmount.
4. **Optimistic Send Lifecycle (`temp-${requestId}`):** `sendProjectMessage.pending` inserts a temporary message entity and flags `shouldScrollByProject[pid]`; `.fulfilled` swaps the temp entry for the returned server message (deduping `messageIdsByProject`); `.rejected` removes the temp entry, records `working.sendErrorByProject[pid]` (and sets `forbiddenByProject[pid]` if 403 / `CHAT_MEMBERSHIP_REQUIRED`).
5. **Reading B Route Reset vs Persisted State:** `addRouteReset` clears `working` (`draftByProject`, `shouldScrollByProject`, `sendErrorByProject`, `markReadError`, `reportTarget`, `reportReason`, `reportError`, `reportSuccessMsg`) on `routeChanged` while keeping loaded message `entities`, `messageIdsByProject`, `unreadTotal`, `unreadByProject`, `reportedIdsById`, and `forbiddenByProject` until `sessionReset`.
6. **Legacy Test Update (`src/test/Phase15CollaborationUx.test.jsx`):** Updated test #4 (`Navbar` 99+ unread badge check) from dispatching removed `window.dispatchEvent(new CustomEvent('teamforge:chat_read'))` to rendering via `<Provider store={store}>` and dispatching `store.dispatch(fetchChatUnread({ force: true }))` per `09-redux-rules.md`.

### Slices, Reducers & Thunks Added
- **Slice added (`1`):** `src/store/slices/communicationSlice.js` (`communication`).
- **Explicit CRUD Reducers (`4`):** `setAll`, `addOne`, `updateOne`, `removeOne` (plus volatile working-state actions `setChatDraft`, `setChatScrollFlag`, `openReportDialog`, `closeReportDialog`, `setReportReason`, `setReportError`, `clearChatReportFeedback`).
- **Thunks added (`5`):** `fetchProjectMessages`, `sendProjectMessage`, `fetchChatUnread`, `markProjectChatRead`, `reportChatMessage` (`src/store/thunks/communicationThunks.js`).

### Files Changed (Grouped by Student Owner per `07-conversion-plan.md`)
- **Satwik (`communicationSlice`, `ChatBox`, `CollaboratorWorkspace`):**
  - `src/store/slices/communicationSlice.js`, `src/store/thunks/communicationThunks.js`, `src/store/selectors/communicationSelectors.js`
  - `src/components/features/ChatBox.jsx`, `src/pages/collaborator/CollaboratorWorkspace.jsx`
- **Rithvik (`OwnedWorkspace` Chat Conversion):**
  - `src/pages/owner/OwnedWorkspace.jsx`
- **Jathin Surya (`MentorProjectWorkspace` Chat Conversion):**
  - `src/pages/mentor/MentorProjectWorkspace.jsx`
- **Aditya Sai (Store Wiring, Polling Hook, `Navbar`, Scans & Tests):**
  - `src/store/index.js`, `src/hooks/useChatPolling.js`, `src/components/navbar.jsx`
  - `src/store/__tests__/communicationSliceAndChat.test.jsx`, `src/test/Phase15CollaborationUx.test.jsx`
  - `src/test/NoApiInComponentsScan.test.jsx`, `src/test/NoCustomDomEventsScan.test.jsx`, `docs/redux-analysis/08-progress.md`
- **Kevin Gandham:** `0` files in Phase 7.

### Old Code Removed
- Removed `communicationApi` imports from `src/components/features/ChatBox.jsx`, `src/components/navbar.jsx`, `src/pages/owner/OwnedWorkspace.jsx`, `src/pages/collaborator/CollaboratorWorkspace.jsx`, and `src/pages/mentor/MentorProjectWorkspace.jsx`.
- Removed `useVisibilityPoll` chat intervals and all `teamforge:chat_read` DOM event listeners/dispatches from `navbar.jsx`, `OwnedWorkspace.jsx`, `CollaboratorWorkspace.jsx`, and `MentorProjectWorkspace.jsx`.
- Removed local `useState` copies of `messages`, `sendingMsg`, `chatForbidden`, `chatUnread`, `inputText`, `reportTarget`, `reportReason`, `reportSubmitting`, `reportError`, `reportSuccessMsg`, and `reportedIds` (`new Set()`).

### Phase 7 Verification Counts
- **Targeted Phase 7 & Scan Vitest (`9` files):** **`9 passed (9)`**, **`42 passed (42)`** tests (`communicationSliceAndChat.test.jsx` `8/8`, `NoApiInComponentsScan` `1/1`, `NoBrowserStorageScan` `1/1`, `NoCustomDomEventsScan` `1/1`, `notificationsSliceAndPolling` `6/6`, `Fix7NotificationsReports` `7/7`, `Phase15CollaborationUx` `7/7`, `Phase16TrustSafety` `7/7`, `Phase18PrivacyNotifications` `4/4`).
- **Full Vitest (`npx vitest run`):** `94` test files (**`85 passed, 9 failed`**), `457` tests (**`446 passed, 11 failed`**), Duration `140.19s` — only the `9` pre-existing baseline failing files (`11` tests): `AdminRejectMentorApp`, `Fix1RestartAndSession`, `LeaveProjectDialog` (`2`), `Phase10PlatformDurability`, `Phase19UsersLockdown`, `Phase20ResourceAuth`, `Phase22ReputationLedger` (`2`), `Phase4MentorTimeRemoval`, `RoleSyncSingleClick`; `0` regressions.
- **ESLint (`npm run lint`):** **`88 problems (79 errors, 9 warnings)`** (unchanged vs Phase 5/6 baseline; **`0` errors and `0` warnings** across the `13` clean/new Phase 7 files, and no new issues added to `OwnedWorkspace.jsx`).
- **Production Build (`npm run build`):** Passed cleanly in `17.44s` (`vite build` exit `0`, `284` modules transformed).

### Updated Scan Allowlist Counts
- `BROWSER_STORAGE_ALLOWLIST` (`src/test/NoBrowserStorageScan.test.jsx`): **20** files (unchanged in Phase 7).
- `DIRECT_API_IMPORT_ALLOWLIST` (`src/test/NoApiInComponentsScan.test.jsx`): **50 -> 47** files (removed `components/features/ChatBox.jsx`, `components/navbar.jsx`, `pages/collaborator/CollaboratorWorkspace.jsx`).
- `CUSTOM_DOM_EVENTS_ALLOWLIST` (`src/test/NoCustomDomEventsScan.test.jsx`): **18 -> 15** files (removed `pages/collaborator/CollaboratorWorkspace.jsx`, `pages/mentor/MentorProjectWorkspace.jsx`, `pages/owner/OwnedWorkspace.jsx`).

### Skipped / Deferred & Other Findings
- `navbar.jsx` remains in `CUSTOM_DOM_EVENTS_ALLOWLIST` solely because of `teamforge:user_updated` (`AuthContext` session listener, deferred until legacy `teamforge:*` context events are removed).
- Help & Support "My reports" (`src/pages/help.jsx`) is served by `ReportsController` (`reportsApi.getMyReports`), not `CommunicationController`, and remains scoped for Phase 10. `back-end/` left untouched.

---

## Phase 8 — Mentor Marketplace (Profiles, Applications, Sessions, Abandonment, Feedback)

### Summary & Root Findings
- Audited `MentorMarketplaceController` (`back-end/src/mentor-marketplace/mentor-marketplace.controller.ts`), `MentorLifecycleController` / `MentorSessionsLifecycleController` (`mentor-lifecycle.controller.ts`), `MentorApplicationsController` (`mentor-applications.controller.ts`), and `MentorRequestsController` (`mentor-requests.controller.ts`).
- Created all 5 Phase 8 domain slices (`mentorProfilesSlice`, `mentorApplicationsSlice`, `mentorSessionsSlice`, `abandonmentReviewsSlice`, `sessionFeedbackSlice`), their thunks (`41` exported thunks across 5 files) and memoized selectors (`createSelector`), wired into `src/store/index.js`.
- Converted `MyMentorProfile.jsx`, `MentoredProjects.jsx`, `MentorRequests.jsx`, `MentorApplication.jsx`, `MentorEarnings.jsx`, `MentorsDirectory.jsx` (directory list, project selector, booking creation up to payment step, post-session 1–5 feedback modal), `dashboard.jsx` (abandonment review banners), `OwnedWorkspace.jsx` (open abandonment review & 48h countdown banner), `AdminUserDetails.jsx` (mentor feedback & abandonment summary), and `useReasonAction.jsx` booking helpers.

### Decisions Made
1. **Slice Name (`sessionFeedbackSlice` / `state.sessionFeedback`):** Followed the Phase 8 prompt (`sessionFeedbackSlice`), overriding the plural draft `sessionFeedbacksSlice` in docs `01`/`07` per `09-redux-rules.md`.
2. **Local Form Keystroke Inputs + `uiSlice` Save Toast (`MyMentorProfile.jsx`):** Kept controlled input keystrokes (`name`, `title`, `bio`, `skillsInput`, `experienceYears`, `sessionPrice`, `isAvailable`, `maxActiveMentees`) in local React state until Save per Decision D6, hydrating via a render-time `hydratedKey` reset when `myProfileStatus` transitions to `'succeeded'` (zero `set-state-in-effect` lint issues). Dispatches `saveMentorProfile` (sending numeric `sessionPrice`) and `enqueueToast` / `dismissToast` from `uiSlice` to render `data-testid="toast"`.
3. **Server Canonical Mentored Projects (`mentorSessionsSlice`):** `fetchMentoredProjects` stores server `{ items, counts }` directly into `mentoredProjectsById`, `mentoredProjectIds`, and `mentoredCounts` without client recomputation, retaining the partial-mock fallback (`projectsApi.list`, `mentorRequestsApi.list`, `mentorMarketplaceApi.mentorSessions`) for legacy test suites where `getMentoredProjects` is omitted.
4. **Serializability on CV Downloads & Request View Persistence:** Triggered CV `Blob` downloads inside `downloadMentorCv` returning serializable `{ filename, downloaded: true }`, and tracked `requestsViewIds` in `mentorSessionsSlice.working` (populated from `escrow_funded` sessions on `fetchMentorSessions.fulfilled`) so accepted/refunded rows remain visible on `MentorRequests` during a visit and reset cleanly on `routeChanged`.
5. **Phase 9 Boundary (`MentorsDirectory.jsx` & `MentorEarnings.jsx`):** Left payment confirmation (`confirmPayment`, `cancelPayment`, `idempotencyKey`), `retryPayout`, and `openDispute` scoped to Phase 9 while syncing `mySessions` / `mentorSessions` through `mentorSessionsSlice`.

### Slices, Reducers & Thunks Added
- **Slices added (`5`):** `mentorProfiles`, `mentorApplications`, `mentorSessions`, `abandonmentReviews`, `sessionFeedback`.
- **Explicit CRUD Reducers (`20` total — `4` per slice):** `setAll`, `addOne`, `updateOne`, `removeOne` on all 5 slices, plus `addRouteReset` (`routeChanged` clears filters, search queries, modal flags, and errors while preserving loaded `sessions`, `activeCheckout`, `myProfile`, `mentoredProjectsById`, `mentoredCounts`, `byProjectInfo`, and `adminSummaryByMentorId`) and `sessionReset`.
- **Thunks added (`41`):**
  - `mentorProfilesThunks.js` (`7`): `fetchMentors`, `fetchMentorById`, `fetchMyMentorProfile`, `fetchMyMentorStats`, `saveMentorProfile`, `toggleMentorAvailability`, `confirmMentorRole`.
  - `mentorApplicationsThunks.js` (`13`): `fetchMyMentorApplicationStatus`, `fetchMentorApplications`, `fetchMentorApplicationById`, `submitMentorApplication`, `updateMentorApplication`, `approveMentorApplication`, `rejectMentorApplication`, `deleteMentorApplication`, `fetchDigiLockerStatus`, `pullDigiLockerDocuments`, `fetchMentorMinYearsConfig`, `uploadMentorCv`, `downloadMentorCv`.
  - `mentorSessionsThunks.js` (`14`): `fetchMySessions`, `fetchMentorSessions`, `fetchMentoredProjects`, `fetchAllSessionsAdmin`, `fetchSessionAdminStats`, `bookMentorSession`, `acceptMentorSession`, `declineMentorSession`, `cancelMentorSession`, `completeMentorSession`, `startMentorSession`, `reviewMentorSession`, `retrySessionPayout`, `addMentorSessionNote`.
  - `abandonmentReviewsThunks.js` (`5`): `fetchProjectAbandonmentReview`, `fetchMyAbandonmentReviews`, `openAbandonmentReview`, `confirmAbandonmentReview`, `cancelAbandonmentReview`.
  - `sessionFeedbackThunks.js` (`2`): `submitSessionFeedback`, `fetchAdminMentorFeedback`.

### Files Changed (Grouped by Student Owner per `07-conversion-plan.md`)
- **Jathin Surya (Mentor Marketplace Slices & Screens):**
  - Redux Modules: `src/store/slices/mentorProfilesSlice.js`, `src/store/thunks/mentorProfilesThunks.js`, `src/store/selectors/mentorProfilesSelectors.js`, `src/store/slices/mentorSessionsSlice.js`, `src/store/thunks/mentorSessionsThunks.js`, `src/store/selectors/mentorSessionsSelectors.js`, `src/store/slices/abandonmentReviewsSlice.js`, `src/store/thunks/abandonmentReviewsThunks.js`, `src/store/selectors/abandonmentReviewsSelectors.js`, `src/store/slices/sessionFeedbackSlice.js`, `src/store/thunks/sessionFeedbackThunks.js`, `src/store/selectors/sessionFeedbackSelectors.js`
  - Screens: `src/pages/mentor/MyMentorProfile.jsx`, `src/pages/mentor/MentoredProjects.jsx`, `src/pages/mentor/MentorRequests.jsx`, `src/pages/mentor/MentorEarnings.jsx`, `src/pages/owner/MentorsDirectory.jsx`, `src/pages/dashboard.jsx`
- **Kevin Gandham (`mentorApplicationsSlice` Applicant Side & Admin Feedback Read):**
  - `src/store/slices/mentorApplicationsSlice.js`, `src/store/thunks/mentorApplicationsThunks.js`, `src/store/selectors/mentorApplicationsSelectors.js`
  - `src/pages/mentor/MentorApplication.jsx`, `src/pages/admin/AdminUserDetails.jsx`
- **Rithvik (Owner Abandonment Review Flow & Reason Hook):**
  - `src/pages/owner/OwnedWorkspace.jsx`, `src/hooks/useReasonAction.jsx`
- **Aditya Sai (Store Registration, Scans, Tests & Progress Log):**
  - `src/store/index.js`, `src/store/__tests__/mentorMarketplaceAndSlices.test.jsx`, `src/test/NoApiInComponentsScan.test.jsx`, `src/test/NoCustomDomEventsScan.test.jsx`, `docs/redux-analysis/08-progress.md`
- **Satwik:** `0` files in Phase 8.

### Old Code Removed
- Removed `mentorApplicationsApi`, `uploadsApi`, `adminApi` imports, `teamforge:mentor_status_updated` event listener, and local application/CV/DigiLocker server state copies from `src/pages/mentor/MentorApplication.jsx`.
- Removed `mentorMarketplaceApi`, `mentorRequestsApi`, and `projectsApi` imports plus local `mentoredProjects`/`counts`/`openAbandonmentReviews` state from `src/pages/mentor/MentoredProjects.jsx`.
- Removed `mentorMarketplaceApi` and `projectsApi` imports and local `requests`/`declineModalOpen` server state copies from `src/pages/mentor/MentorRequests.jsx`.
- Removed `mentorMarketplaceApi` import and local `myProfile`/`toast` state from `src/pages/mentor/MyMentorProfile.jsx` (`uiSlice` now owns toasts).
- Removed `mentorMarketplaceApi` import and local `mentorAbandonmentInfo`/`reportMentorModalOpen` states from `src/pages/owner/OwnedWorkspace.jsx` (`dashboard.jsx` & `AdminUserDetails.jsx` also dropped `mentorMarketplaceApi`).
- Removed `projectsApi` import and local `mentors`/`mySessions`/`ownedProjects` states from `src/pages/owner/MentorsDirectory.jsx`.

### Phase 8 Verification Counts
- **Targeted Phase 8 & Scan Vitest (`12` files):** **`12 passed (12)`**, **`50 passed (50)`** tests (`mentorMarketplaceAndSlices.test.jsx` `6/6`, `NoApiInComponentsScan` `1/1`, `NoBrowserStorageScan` `1/1`, `NoCustomDomEventsScan` `1/1`, `MentorApplicationYears` `3/3`, `DeclineSessionModal` `1/1`, `Phase25BookingIntegrity` `2/2`, `MentoredProjectsCompleted` `5/5`, `MentorProfilePrice` `10/10`, `Phase10MentorScreens` `6/6`, `Fix6Payment` `8/8`, `Phase14MentorLifecycle` `6/6`).
- **Full Vitest (`npx vitest run`):** `95` test files (**`86 passed, 9 failed`**), `463` tests (**`452 passed, 11 failed`**), Duration `106.01s` — only the `9` pre-existing baseline failing files (`11` tests): `AdminRejectMentorApp`, `Fix1RestartAndSession`, `LeaveProjectDialog` (`2`), `Phase10PlatformDurability`, `Phase19UsersLockdown`, `Phase20ResourceAuth`, `Phase22ReputationLedger` (`2`), `Phase4MentorTimeRemoval`, `RoleSyncSingleClick`; `0` regressions.
- **ESLint (`npm run lint`):** Improved from `88 problems (79 errors, 9 warnings)` down to **`84 problems (75 errors, 9 warnings)`** (`0` errors and `0` warnings across the `24` clean/new Phase 8 files linted directly).
- **Production Build (`npm run build`):** Passed cleanly in `9.34s` (`vite build` exit `0`, `299` modules transformed).

### Updated Scan Allowlist Counts
- `BROWSER_STORAGE_ALLOWLIST` (`src/test/NoBrowserStorageScan.test.jsx`): **20** files (unchanged in Phase 8).
- `DIRECT_API_IMPORT_ALLOWLIST` (`src/test/NoApiInComponentsScan.test.jsx`): **47 -> 43** files (removed `pages/mentor/MentorApplication.jsx`, `pages/mentor/MentorRequests.jsx`, `pages/mentor/MentoredProjects.jsx`, `pages/mentor/MyMentorProfile.jsx`).
- `CUSTOM_DOM_EVENTS_ALLOWLIST` (`src/test/NoCustomDomEventsScan.test.jsx`): **15 -> 14** files (removed `pages/mentor/MentorApplication.jsx`).

### Skipped / Deferred & Other Findings
- Payment confirmation/cancellation/idempotency (`confirmPayment`, `cancelPayment`, `retryPayout`) and escrow disputes (`openDispute`) in `MentorsDirectory.jsx` & `MentorEarnings.jsx` stay scoped for Phase 9 (`AdminMentorApps.jsx` review queue is scoped for Phase 11). `NotificationContext.jsx` -> `RoleContext.jsx` `teamforge:mentor_status_updated` bridge stays until `sessionSlice` replaces `RoleContext`. `back-end/` left untouched.

---

## Phase 9 — Payments, Escrow & Disputes (Checkout, Idempotency-Key & Money Screens)

### Summary & Root Findings
- Audited `EscrowController` (`back-end/src/escrow/escrow.controller.ts`), `EscrowService` (`escrow.service.ts`), `PayoutsController` (`payouts/payouts.controller.ts`), `MentorMarketplaceController` (`mentor-marketplace.controller.ts` payment, retry-payout, admin-stats, reconcile, dispute routes), `AdminController.reconcileEscrow` (`admin.controller.ts`), and money screens (`MentorsDirectory.jsx`, `MentorEarnings.jsx`, `MentorRevenue.jsx`).
- Created all 3 Phase 9 domain slices (`paymentsSlice`, `escrowAccountsSlice`, `sessionDisputesSlice`), thunks (`12` exported thunks across 3 files), and memoized selectors (`createSelector`), registered in `src/store/index.js`.
- Migrated Demo Payment checkout & `Idempotency-Key` lifecycle (`MentorsDirectory.jsx`), owner/mentor money screens (`MentorsDirectory.jsx` booking history & breakdown, `MentorEarnings.jsx` server-stored earnings & `retryPayout`, `MentorRevenue.jsx` `adminStats` & `reconcileEscrow`), and escrow dispute modals (`MentorsDirectory.jsx` & `MentorEarnings.jsx`) completely to Redux.
- Removed `calculateEscrowBreakdown` client arithmetic from `MentorsDirectory.jsx` and `.reduce(...)` total calculations from `MentorEarnings.jsx` and `MentorRevenue.jsx`, reading totals directly from server responses stored in `paymentsSlice` and `mentorSessionsSlice`.

### Decisions Made
1. **Canonical Slice Names (`paymentsSlice`, `escrowAccountsSlice`, `sessionDisputesSlice`):** Used `escrowAccounts` (`src/store/slices/escrowAccountsSlice.js`, also re-exporting `escrowSlice`) and `sessionDisputes` (`src/store/slices/sessionDisputesSlice.js`) per docs `01`/`07` (Decision D1), alongside `payments` (`src/store/slices/paymentsSlice.js`) for checkout state, `Idempotency-Key`, and server revenue/earnings totals.
2. **Decision D3 Exception for Checkout & `Idempotency-Key` (`paymentsSlice`):** `checkout.idempotencyKey` is generated once when opening the checkout dialog (`openPaymentCheckout`), reused identically across retries (`confirmSessionPayment` / `payMentorSession`, guarded against double-clicks via `condition`), **preserved across `routeChanged`**, and cleared only on payment confirmation success (`confirmSessionPayment.fulfilled` / `payMentorSession.fulfilled`), payment cancellation (`cancelSessionPayment`), explicit dialog close (`closePaymentCheckout`), or `sessionReset`.
3. **`NETWORK_ERROR` Guard & `ALREADY_PAID` Message Preservation (`formatPaymentError`):** `formatPaymentError` returns the network-error message ONLY when there is no HTTP response (`!statusCode && !status && !serverMessage` with `isNetworkError` / `TypeError` / `NETWORK_ERROR`), preserving HTTP 4xx/5xx `serverMessage` values and both `'already paid for'` and `'already been paid for'` messages on `409 ALREADY_PAID`.
4. **Admin Escrow Tab & Admin Disputes Tab Boundary:** Added full thunks (`fetchProjectEscrow`, `fetchEscrowAccounts`, `fetchAdminDisputes`, `decideSessionDispute`) in the Phase 9 slices while leaving `AdminProjectDetails.jsx` (Escrow tab) and `AdminReports.jsx` (Admin Disputes tab) scoped to Phase 11 as directed.

### Slices, Reducers & Thunks Added
- **Slices added (`3`):** `payments` (`paymentsSlice.js`), `escrowAccounts` (`escrowAccountsSlice.js`), `sessionDisputes` (`sessionDisputesSlice.js`).
- **Explicit CRUD Reducers (`12` total — `4` per slice):** `setAll`, `addOne`, `updateOne`, `removeOne` on all 3 slices, plus `addRouteReset` (`routeChanged` resets `working` UI flags across all 3 slices while keeping `payments.checkout` + `idempotencyKey`, `escrowAccounts.entities`/`byProjectId`/`reconciliation`, and `sessionDisputes.entities`) and `sessionReset` (full wipe).
- **Cross-slice synchronization (`mentorSessionsSlice` & `escrowAccountsSlice`):** `confirmSessionPayment.fulfilled`, `payMentorSession.fulfilled`, `cancelSessionPayment.fulfilled`, `retryPayoutAndRefresh.fulfilled`, `openSessionDispute.fulfilled` (`{ status: 'disputed', disputed: true, dispute }`), and `decideSessionDispute.fulfilled` keep `mentorSessions` and `escrowAccounts` (`status: 'frozen', disputed: true` on dispute open) synchronized without FE recomputation.
- **Thunks added (`12`):**
  - `paymentsThunks.js` (`5`): `confirmSessionPayment`, `payMentorSession`, `cancelSessionPayment`, `retryPayoutAndRefresh`, `fetchAdminRevenueOverview`.
  - `escrowAccountsThunks.js` (`4`): `fetchEscrowAccounts`, `fetchEscrowById`, `fetchProjectEscrow`, `reconcileEscrowLedger`.
  - `sessionDisputesThunks.js` (`3`): `openSessionDispute`, `fetchAdminDisputes`, `decideSessionDispute`.
- **Reused Phase 8 Thunks (`3`):** `bookMentorSession`, `fetchAllSessionsAdmin`, `fetchSessionAdminStats` (`mentorSessionsThunks.js`).

### Files Changed (Grouped by Student Owner per `07-conversion-plan.md`)
- **Jathin Surya (Payments, Escrow, Disputes & Money Screens):**
  - Service wrapper: `src/services/mentorMarketplaceApi.js` (added `listEscrows`, `getEscrowById`)
  - Redux Modules: `src/store/slices/paymentsSlice.js`, `src/store/thunks/paymentsThunks.js`, `src/store/selectors/paymentsSelectors.js`, `src/store/slices/escrowAccountsSlice.js`, `src/store/thunks/escrowAccountsThunks.js`, `src/store/selectors/escrowAccountsSelectors.js`, `src/store/slices/sessionDisputesSlice.js`, `src/store/thunks/sessionDisputesThunks.js`, `src/store/selectors/sessionDisputesSelectors.js`
  - Sync & Selectors: `src/store/slices/mentorSessionsSlice.js`, `src/store/thunks/mentorSessionsThunks.js`, `src/store/selectors/mentorSessionsSelectors.js`
  - Converted Money Screens: `src/pages/owner/MentorsDirectory.jsx`, `src/pages/mentor/MentorEarnings.jsx`, `src/pages/admin/MentorRevenue.jsx`
- **Aditya Sai (Store Registration, Scans, Tests & Progress Log):**
  - `src/store/index.js`, `src/store/__tests__/paymentsEscrowDisputes.test.jsx`, `src/test/NoApiInComponentsScan.test.jsx`, `docs/redux-analysis/08-progress.md`
- **Kevin Gandham / Rithvik / Satwik:** `0` files in Phase 9.

### Old Code Removed
- Removed `mentorMarketplaceApi` and `calculateEscrowBreakdown` imports plus local checkout/payment states (`bookingStep`, `activePaymentSession`, `activePaymentIntent`, `idempotencyKey`, `confirmingPayment`, `copiedUpi`, `disputeTargetSession`, `disputeSubmitting`, `disputeModalError`) from `src/pages/owner/MentorsDirectory.jsx`.
- Removed `mentorMarketApi` import, local dispute state, and `.reduce(...)` money calculations (`totalEarned`, `pendingInEscrow`) from `src/pages/mentor/MentorEarnings.jsx`.
- Removed `mentorMarketApi` import, local `sessions`/`stats`/`mentorMap`/`reconciliation` state, and `.reduce(...)` platform fee fallback from `src/pages/admin/MentorRevenue.jsx`.

### Phase 9 Verification Counts
- **Targeted Phase 9 & Scan Vitest (`8` files):** **`8 passed (8)`**, **`36 passed (36)`** tests (`paymentsEscrowDisputes.test.jsx` `10/10`, `Fix6Payment.test.jsx` `8/8`, `Phase9EscrowPaymentSafety.test.jsx` `5/5`, `Phase17DisputesAccountability.test.jsx` `5/5`, `storeFoundation.test.jsx` `5/5`, `NoApiInComponentsScan.test.jsx` `1/1`, `NoBrowserStorageScan.test.jsx` `1/1`, `NoCustomDomEventsScan.test.jsx` `1/1`).
- **Full Vitest (`npx vitest run`):** `96` test files (**`87 passed, 9 failed`**), `473` tests (**`462 passed, 11 failed`**), Duration `123.44s` — only the `9` pre-existing baseline failing files (`11` tests): `AdminRejectMentorApp`, `Fix1RestartAndSession`, `LeaveProjectDialog` (`2`), `Phase10PlatformDurability`, `Phase19UsersLockdown`, `Phase20ResourceAuth`, `Phase22ReputationLedger` (`2`), `Phase4MentorTimeRemoval`, `RoleSyncSingleClick`; `0` regressions.
- **ESLint (`npx eslint` on Phase 9 files + `npm run lint`):** `0` errors across all Phase 9 files (only `1` pre-existing `react-refresh/only-export-components` warning on `formatBookingError` export in `MentorsDirectory.jsx`); full repo `84 problems (75 errors, 9 warnings)`.
- **Production Build (`npm run build`):** Passed cleanly (`vite build` exit `0`, `308` modules transformed).
- **Back End Reconcile Jest Check (read-only manual check):** `npm test -- src/mentor-marketplace/mentor-marketplace.service.spec.ts src/moderation/phase17.spec.ts --no-coverage` in `back-end/` -> **`2 passed (2)`** suites, **`12 passed (12)`** tests (`Time: 14.856 s`), confirming `reconcileEscrow()` invariant holds across paid, refunded, disputed, and 70/30 split states with `back-end/` left unmodified.

### Updated Scan Allowlist Counts
- `BROWSER_STORAGE_ALLOWLIST` (`src/test/NoBrowserStorageScan.test.jsx`): **20** files (unchanged).
- `DIRECT_API_IMPORT_ALLOWLIST` (`src/test/NoApiInComponentsScan.test.jsx`): **43 -> 41** files (removed `pages/mentor/MentorEarnings.jsx`, `pages/admin/MentorRevenue.jsx`; `pages/owner/MentorsDirectory.jsx` remains listed solely for Phase 10 `trustApi`).
- `CUSTOM_DOM_EVENTS_ALLOWLIST` (`src/test/NoCustomDomEventsScan.test.jsx`): **14** files (unchanged).

### Skipped / Deferred
- `AdminProjectDetails.jsx` Escrow tab (`getProjectEscrow`) and `AdminReports.jsx` Admin Escrow Disputes tab (`listDisputes`, `decideDispute`) remain scoped to Phase 11 (`admin` portal conversion) while their slices/thunks are ready. `trustApi` in `MentorsDirectory.jsx` remains scoped to Phase 10 (`reputationEntriesSlice`). `back-end/` left untouched.

---

## Phase 10 — Moderation, Reports, Appeals & Support (`reportsSlice`, `appealsSlice`, `warningsSlice`, `pendingModerationActionsSlice`, `supportTicketsSlice`, `sessionSlice`)

### Summary & Root Findings
- Created `sessionSlice` (`src/store/slices/sessionSlice.js`, `src/store/selectors/sessionSelectors.js`) exposing `canAccess(sessionState, section)` and `selectCanAccess` for admin permission-based visibility across `AdminLayout.jsx`, `AdminReports.jsx`, and `AdminSupport.jsx`.
- Built all 5 Phase 10 domain slices (`reportsSlice`, `appealsSlice`, `warningsSlice`, `pendingModerationActionsSlice`, `supportTicketsSlice`) with normalized `createEntityAdapter` state, the 4 explicit CRUD reducers (`setAll`, `addOne`, `updateOne`, `removeOne`), volatile `working` state cleared on `routeChanged` (Reading B, Decision D3), full reset on `sessionReset`, `30` async thunks (`reportsThunks.js`, `appealsThunks.js`, `warningsThunks.js`, `pendingModerationActionsThunks.js`, `supportTicketsThunks.js`), and memoized selectors.
- Migrated user reporting & support tickets (`help.jsx`), user warnings & appeals (`notifications.jsx`), shared `ModerationModal.jsx`, `AdminLayout.jsx` (`openReportsCount` badge + `canAccess`), `AdminDashboard.jsx` (`openReportsCount`), `AdminReports.jsx` (reports, owner patterns, appeals, decided read-only guards, `target="_blank"` `/admin/audit-log?userId=...&reportId=...&from=report` link), `AdminSupport.jsx` (Support Inbox filters, drawer, internal/public replies, `closeProject`, read-only resolved/rejected tickets, `409 TICKET_CLOSED`), `AdminUsers.jsx` (Approvals second-approval queue & moderation actions), and `AdminUserDetails.jsx` (warnings count & warn/suspend/reactivate actions) to Redux.
- Eliminated all `teamforge:report_updated` custom DOM events (`AdminDashboard.jsx`, `AdminLayout.jsx`, `AdminReports.jsx` — also removing them cleanly from `CUSTOM_DOM_EVENTS_ALLOWLIST`).

### Decisions Made
1. **RBAC `sessionSlice` Legacy Test Compatibility Guard:** Full user/admin login migration runs in Phase 1/11 (`storage.js` still holds admin session for unmigrated routes). `sessionSelectors.js` reads `permissions` / `isSuperUser` / `adminUid` from `state.session`, and UI guards fall back to legacy `storage.getAdminSession()` ONLY when `!selectIsSessionConfigured` (`session.initialized === false`), keeping zero `storage` imports inside `sessionSlice.js` or `sessionSelectors.js`.
2. **`adminApi` Dual-Export Safe Resolution in Thunks:** Existing test suites mock `services/adminApi` differently (`ModerationModal.test.jsx` exports named `{ adminApi }`, while `AdminUserDetails.test.jsx` exports `{ default }`). `warningsThunks.js` and `pendingModerationActionsThunks.js` inspect `Object.keys(adminApiModule)` via `getAdminApi()` so Vitest's mock namespace proxy never throws when one export style is absent.
3. **`TICKET_CLOSED` (`409`) Read-Only Preservation:** On `409 TICKET_CLOSED` during `updateAdminSupportTicket` or `replyAdminSupportTicket`, the thunk fetches fresh detail via `supportApi.getAdminTicket(tid)` and stores `refreshedTicket` into `supportTicketsSlice.entities` + sets `working.drawerError = 'This ticket is closed and read-only.'` without firing a racing list refetch that could overwrite the read-only detail entity.
4. **`warningsSlice` Partial Mock Guard:** When `typeof adminApi?.getWarnings !== 'function'` (e.g., `AdminUserDetails.test.jsx`), `fetchUserWarningsAdmin` returns `{ userId, items: null }` and `warningsSlice` skips overwriting `activeWarningsCountByUserId[userId]`, preserving fallback count display from `user.activeWarningsCount`.
5. **`AdminLayout.jsx` & `apiClient.js` Deferral Note:** `AdminLayout.jsx` removed `reportsApi` (`fetchOpenReportsCount` now reads from `reportsSlice`), but keeps `services/apiClient.js` (`getAuthMode`, `setAccessToken`) for sign-out until Admin Auth moves to `sessionSlice`, so `pages/admin/AdminLayout.jsx` remains in `DIRECT_API_IMPORT_ALLOWLIST` until Phase 11/12.

### Slices, Reducers & Thunks Added
- **Slices added (`6`):** `session` (`sessionSlice.js`), `reports` (`reportsSlice.js`), `appeals` (`appealsSlice.js`), `warnings` (`warningsSlice.js`), `pendingModerationActions` (`pendingModerationActionsSlice.js`), `supportTickets` (`supportTicketsSlice.js`).
- **Explicit CRUD Reducers (`20` across the 5 domain slices — `4` per slice):** `setAll`, `addOne`, `updateOne`, `removeOne` on `reports`, `appeals`, `warnings`, `pendingModerationActions`, and `supportTickets`, plus `setSession`/`setAdminSession`/`clearSession` on `sessionSlice`, volatile `working` reducers, `addRouteReset` (`routeChanged`), and `sessionReset`.
- **Async Thunks added (`30` across 5 files):**
  - `reportsThunks.js` (`8`): `createUserReport`, `fetchMyReports`, `fetchOpenReportsCount`, `fetchAdminReports`, `fetchAdminReportDetails`, `updateAdminReportStatus`, `actionAdminReport`, `fetchOwnerPatterns`.
  - `appealsThunks.js` (`4`): `submitWarningAppeal`, `fetchMyAppeals`, `fetchAdminAppeals`, `decideAdminAppeal`.
  - `warningsThunks.js` (`3`): `fetchMyWarnings`, `fetchUserWarningsAdmin`, `issueUserWarning`.
  - `pendingModerationActionsThunks.js` (`5`): `fetchModerationActions`, `suspendUserModeration`, `reactivateUserModeration`, `approveModerationAction`, `rejectModerationAction`.
  - `supportTicketsThunks.js` (`10`): `fetchMySupportTickets`, `fetchMySupportTicketById`, `createSupportTicket`, `replyToMySupportTicket`, `fetchSupportAssignees`, `fetchAdminSupportTickets`, `fetchAdminSupportTicketById`, `updateAdminSupportTicket`, `replyAdminSupportTicket`, `closeProjectFromSupportTicket`.

### Files Changed (Grouped by Student Owner per `07-conversion-plan.md`)
- **Kevin Gandham (Reports, Appeals, Support Tickets & Admin Portal Screens):**
  - Redux Modules: `src/store/slices/reportsSlice.js`, `src/store/thunks/reportsThunks.js`, `src/store/selectors/reportsSelectors.js`, `src/store/slices/appealsSlice.js`, `src/store/thunks/appealsThunks.js`, `src/store/selectors/appealsSelectors.js`, `src/store/slices/supportTicketsSlice.js`, `src/store/thunks/supportTicketsThunks.js`, `src/store/selectors/supportTicketsSelectors.js`
  - Screens: `src/pages/help.jsx`, `src/pages/admin/AdminLayout.jsx`, `src/pages/admin/AdminDashboard.jsx`, `src/pages/admin/AdminReports.jsx`, `src/pages/admin/AdminSupport.jsx`
- **Satwik (Warnings, Second-Approval Moderation Queue & Modal):**
  - Redux Modules: `src/store/slices/warningsSlice.js`, `src/store/thunks/warningsThunks.js`, `src/store/selectors/warningsSelectors.js`, `src/store/slices/pendingModerationActionsSlice.js`, `src/store/thunks/pendingModerationActionsThunks.js`, `src/store/selectors/pendingModerationActionsSelectors.js`
  - Screens & Components: `src/components/common/ModerationModal.jsx`, `src/pages/admin/AdminUsers.jsx`, `src/pages/admin/AdminUserDetails.jsx`
- **Aditya Sai (Session RBAC Slice, Store Registration, Notifications Warnings/Appeals, Scans, Tests & Log):**
  - Redux & Helper Modules: `src/store/slices/sessionSlice.js`, `src/store/selectors/sessionSelectors.js`, `src/store/index.js`, `src/services/apiClient.js` (safe optional chaining on `storage?.getApiBaseUrl`)
  - Screen: `src/pages/notifications.jsx` (warnings & appeals wired to `warningsSlice`/`appealsSlice`)
  - Tests, Scans & Docs: `src/store/__tests__/moderationReportsAppealsSupport.test.jsx`, `src/test/NoApiInComponentsScan.test.jsx`, `src/test/NoCustomDomEventsScan.test.jsx`, `docs/redux-analysis/08-progress.md`
- **Jathin Surya / Rithvik:** `0` files in Phase 10.

### Old Code Removed
- Removed `reportsApi` and `supportApi` imports plus local report/ticket state fetching from `src/pages/help.jsx`.
- Removed `appealsApi` and `adminApi` imports from `src/pages/notifications.jsx`.
- Removed `supportApi` import and manual ticket/drawer/closure API state from `src/pages/admin/AdminSupport.jsx`.
- Removed `reportsApi` and `appealsApi` imports plus `teamforge:report_updated` custom events from `src/pages/admin/AdminReports.jsx`.
- Removed `reportsApi` imports and `teamforge:report_updated` listeners from `src/pages/admin/AdminLayout.jsx` and `src/pages/admin/AdminDashboard.jsx`.
- Removed `adminApi` import from `src/components/common/ModerationModal.jsx`, and moved moderation/warning/second-approval queue fetches/actions in `src/pages/admin/AdminUsers.jsx` & `src/pages/admin/AdminUserDetails.jsx` onto Redux thunks.

### Phase 10 Verification Counts
- **Targeted Phase 10 & Scan Vitest (`--maxWorkers=2`, `15` files):** **`15 passed (15)`**, **`64 passed (64)`** tests (`moderationReportsAppealsSupport.test.jsx` `8/8`, `NoApiInComponentsScan` `1/1`, `NoBrowserStorageScan` `1/1`, `NoCustomDomEventsScan` `1/1`, `AdminReports` `5/5`, `AdminUserDetails` `4/4`, `AdminUsersWarnedFilterRemoval` `5/5`, `Fix7NotificationsReports` `7/7`, `HelpReport` `5/5`, `ModerationModal` `5/5`, `NotificationAppeal` `4/4`, `Phase18PrivacyNotifications` `4/4`, `Phase27SupportInbox` `4/4`, `Step4TicketReadOnly` `5/5`, `Step5AuditButton` `5/5`).
- **Full Vitest (`npx vitest run`):** `97` test files (**`88 passed, 9 failed`**), `481` tests (**`470 passed, 11 failed`**), Duration `118.25s` — only the `9` pre-existing baseline failing files (`11` tests): `AdminRejectMentorApp`, `Fix1RestartAndSession`, `LeaveProjectDialog` (`2`), `Phase10PlatformDurability`, `Phase19UsersLockdown`, `Phase20ResourceAuth`, `Phase22ReputationLedger` (`2`), `Phase4MentorTimeRemoval`, `RoleSyncSingleClick`; `0` regressions.
- **ESLint:** **`0` errors and `0` warnings** across all `28` targeted Phase 10 store/UI/test/scan files (`npx eslint ...` exit `0`); full repo improved from `84 problems (75 errors, 9 warnings)` down to **`76 problems (69 errors, 7 warnings)`**.
- **Production Build (`npm run build`):** Passed cleanly in `23.77s` (`vite build` exit `0`, `325` modules transformed).

### Updated Scan Allowlist Counts
- `BROWSER_STORAGE_ALLOWLIST` (`src/test/NoBrowserStorageScan.test.jsx`): **20** files (unchanged).
- `DIRECT_API_IMPORT_ALLOWLIST` (`src/test/NoApiInComponentsScan.test.jsx`): **41 -> 38** files (removed `components/common/ModerationModal.jsx`, `pages/admin/AdminSupport.jsx`, `pages/notifications.jsx`).
- `CUSTOM_DOM_EVENTS_ALLOWLIST` (`src/test/NoCustomDomEventsScan.test.jsx`): **14 -> 11** files (removed `pages/admin/AdminDashboard.jsx`, `pages/admin/AdminLayout.jsx`, `pages/admin/AdminReports.jsx`).

### Skipped / Deferred
- Audit Log page (`AuditLog.jsx`), Admin Projects/Escrow tabs (`AdminProjects.jsx`, `AdminProjectDetails.jsx`), Admin Escrow Disputes tab (`AdminReports.jsx` `adminApi.getDisputes`), Admin Mentor Applications (`AdminMentorApps.jsx`), Admin Config/Superuser (`SuperuserAdmins.jsx`, `SuperuserConfig.jsx`, `ScheduledJobsPanel.jsx`), and Admin user list/details read routes (`adminApi` user/reputation/trust endpoints in `AdminUsers.jsx`, `AdminUserDetails.jsx`, `AdminDashboard.jsx`) remain scoped to Phase 11 as directed. `back-end/` left untouched.

---

## Phase 11 — Admin Data (`adminUsersSlice`, `auditLogSlice`, `jobRunsSlice`, `platformConfigSlice`, `portalAdminsSlice`, `adminProjectsSlice`, `dataExportsSlice`)

### Summary & Root Findings
- Built all 7 Phase 11 slices (`adminUsersSlice`, `auditLogSlice`, `jobRunsSlice`, `platformConfigSlice`, `portalAdminsSlice`, `adminProjectsSlice`, `dataExportsSlice`), registered in `src/store/index.js` (`30` total slices in store: `28` domain slices + `session` + `ui`).
- Every slice implements `createEntityAdapter`, the 4 explicit CRUD reducers (`setAll`, `addOne`, `updateOne`, `removeOne`), Reading B `addRouteReset` (clearing filters, search text, modals, drawers, errors while preserving loaded lists/config/escrow caches), `sessionReset` full wipe, and normalized thunk error handling.
- Converted all remaining admin data & Super User screens (`AdminDashboard.jsx`, `AdminUsers.jsx`, `AdminUserDetails.jsx`, `AdminProjects.jsx`, `AdminProjectDetails.jsx`, `ProjectDetailsCard.jsx`, `AdminMentorApps.jsx`, `AdminReports.jsx` Disputes tab, `AuditLog.jsx`, `ScheduledJobsPanel.jsx`, `SuperuserAdmins.jsx`, `SuperuserConfig.jsx`, `AdminLogin.jsx` `setAdminSession` sync) and `settings.jsx` data export section onto Redux thunks and selectors.
- Preserved Decision D8 for the 2 unwired session review endpoints (`GET /admin/mentor-sessions/needs-review`, `POST /admin/mentor-sessions/:id/clear-review`) via 404-tolerant thunks (`fetchNeedsReviewSessions`, `clearNeedsReviewSession` in `sessionDisputesThunks.js`) with **no** extra slice, allowing `AdminReports.jsx` to remove its final `adminApi` import cleanly.

### Decisions Made
1. **Shared Mock-Safe Module Resolver (`src/store/utils/apiModule.js`):** Centralized `resolveApiModule(mod, namedKey)` so thunks resolve `{ default }`, `{ named }`, and ES modules cleanly across legacy Vitest mocks without duplicating `Object.keys()` boilerplate.
2. **Audit Log URL Parameter Synchronization & `from=report` Compatibility:** `AuditLog.jsx` uses a single `useEffect` to sync `userId`, `reportId`, `actor`, `action`, `range`, `from`, `to` from URL `searchParams` into `auditLogSlice.working.filters` while treating non-date `from=report` strictly as navigation referrer so existing `Step5AuditButton` exact-argument checks and multi-filter CSV/JSON `exportAuditLogs` both work cleanly.
3. **Dual-Source Admin Disputes Compatibility (`sessionDisputesThunks.js`):** Existing Phase 17/23/4 `AdminReports` tests mock `adminApi.getDisputes` & `adminApi.decideDispute` while Phase 9 tests mock `mentorMarketplaceApi`. Passing `source: 'admin'` from `AdminReports.jsx` routes cleanly through `adminApi` without breaking Phase 9 callers.
4. **Super User Control Gating via `sessionSelectors.canAccess`:** Added `SUPERUSER_ONLY_SECTIONS` (`'superuser'`, `'jobs_tick'`, `'config_write'`, `'demo_reset'`) in `sessionSelectors.js` so non-superuser admins see disabled `Commit Changes` / inputs / `+ New Admin` / `Run Now` controls when `sessionSlice` is configured, while unconfigured legacy tests (`ScheduledJobsPanel.test.jsx` Test 3 & `DemoReset.test.jsx`) retain exact prior behavior until Phase 12 deletes `storage.js`.
5. **Dual Named/Default Export Wrapper Fix (`settings.jsx`):** Wrapped `SettingsContent` with `withOptionalStore` and exposed `export const Settings = (props) => <ConnectedSettings {...props} />;` to satisfy `react-refresh/only-export-components` with zero new ESLint warnings.

### Slices, Reducers & Thunks Added
- **Slices added (`7`):** `adminUsers`, `auditLog`, `jobRuns`, `platformConfig`, `portalAdmins`, `adminProjects`, `dataExports`.
- **Explicit CRUD Reducers (`28` across the 7 slices — `4` per slice):** `setAll`, `addOne`, `updateOne`, `removeOne` on every Phase 11 slice, plus `addRouteReset` (`routeChanged`) and `sessionReset`.
- **Async Thunks added (`31` new thunks across 7 files + `2` D8 helpers):**
  - `adminUsersThunks.js` (`6`): `fetchAdminUsers`, `fetchAdminUserDetails`, `fetchAdminUserReputation`, `flagAdminUser`, `updateAdminUserStatus`, `fetchDashboardStats`.
  - `auditLogThunks.js` (`3`): `fetchAuditLogs`, `exportAuditLogs`, `recordAuditEntry`.
  - `jobRunsThunks.js` (`3`): `fetchJobRuns`, `fetchJobRunById`, `triggerJobTick`.
  - `platformConfigThunks.js` (`5`): `fetchPublicConfig`, `fetchPlatformConfig`, `fetchDemoResetStatus`, `updatePlatformConfig`, `resetDemoData`.
  - `portalAdminsThunks.js` (`4`): `fetchPortalAdmins`, `createPortalAdmin`, `updatePortalAdmin`, `deletePortalAdmin`.
  - `adminProjectsThunks.js` (`6`): `fetchAdminProjects`, `fetchAdminProjectDetails`, `fetchAdminProjectEscrow`, `restoreAdminProject`, `cancelAdminProjectDeletion`, `closeAdminProject`.
  - `dataExportsThunks.js` (`4`): `fetchDataExports`, `requestDataExport`, `fetchDataExportStatus`, `downloadDataExport`.
  - `sessionDisputesThunks.js` (`+2` D8 404-tolerant helpers, no slice): `fetchNeedsReviewSessions`, `clearNeedsReviewSession`.

### Files Changed (Grouped by Student Owner per `07-conversion-plan.md`)
- **Aditya Sai (Store Core, Audit Log, Platform Config, Data Exports, Scans, Tests & Log):**
  - Utilities, RBAC & Registration: `src/store/index.js`, `src/store/utils/apiModule.js`, `src/store/selectors/sessionSelectors.js`
  - Redux Modules: `src/store/slices/platformConfigSlice.js`, `src/store/thunks/platformConfigThunks.js`, `src/store/selectors/platformConfigSelectors.js`, `src/store/slices/auditLogSlice.js`, `src/store/thunks/auditLogThunks.js`, `src/store/selectors/auditLogSelectors.js`, `src/store/slices/dataExportsSlice.js`, `src/store/thunks/dataExportsThunks.js`, `src/store/selectors/dataExportsSelectors.js`
  - UI Exports & Auth Session Sync: `src/pages/settings.jsx` (data export flows), `src/pages/admin/AdminLogin.jsx` (syncs `setAdminSession` on login)
  - Tests, Scans & Docs: `src/store/__tests__/adminDataPortal.test.jsx`, `src/test/NoApiInComponentsScan.test.jsx`, `docs/redux-analysis/08-progress.md`
- **Kevin Gandham (Jobs, Portal Admins, Mentor Apps Review, Dashboard, Config, Disputes & Audit UI):**
  - Redux Modules: `src/store/slices/jobRunsSlice.js`, `src/store/thunks/jobRunsThunks.js`, `src/store/selectors/jobRunsSelectors.js`, `src/store/slices/portalAdminsSlice.js`, `src/store/thunks/portalAdminsThunks.js`, `src/store/selectors/portalAdminsSelectors.js`, `src/store/slices/mentorApplicationsSlice.js`, `src/store/thunks/mentorApplicationsThunks.js`, `src/store/selectors/mentorApplicationsSelectors.js`, `src/store/thunks/sessionDisputesThunks.js`
  - Admin Screens: `src/pages/admin/AdminDashboard.jsx`, `src/pages/admin/AdminMentorApps.jsx`, `src/pages/admin/AdminReports.jsx`, `src/pages/admin/AuditLog.jsx`, `src/pages/admin/ScheduledJobsPanel.jsx`, `src/pages/admin/SuperuserAdmins.jsx`, `src/pages/admin/SuperuserConfig.jsx`
- **Satwik (Admin Users, Admin Projects & Project Details/Escrow Tab):**
  - Redux Modules: `src/store/slices/adminUsersSlice.js`, `src/store/thunks/adminUsersThunks.js`, `src/store/selectors/adminUsersSelectors.js`, `src/store/slices/adminProjectsSlice.js`, `src/store/thunks/adminProjectsThunks.js`, `src/store/selectors/adminProjectsSelectors.js`
  - Admin Screens: `src/pages/admin/AdminUsers.jsx`, `src/pages/admin/AdminUserDetails.jsx`, `src/pages/admin/AdminProjects.jsx`, `src/pages/admin/AdminProjectDetails.jsx`, `src/pages/admin/ProjectDetailsCard.jsx`
- **Jathin Surya / Rithvik:** `0` files in Phase 11.

### Old Code Removed
- Removed `adminApi`, `portalAdminsApi`, `projectsApi`, `mentorApplicationsApi`, `uploadsApi`, `trustApi`, and `mentorshipApi` imports plus local server-data `useState` / `useEffect` fetch blocks across all `11` admin files exited from `DIRECT_API_IMPORT_ALLOWLIST` (`AdminDashboard`, `AdminMentorApps`, `AdminProjectDetails`, `AdminProjects`, `AdminReports`, `AdminUserDetails`, `AdminUsers`, `AuditLog`, `ProjectDetailsCard`, `ScheduledJobsPanel`, `SuperuserAdmins`).
- Removed `adminApi`, `portalAdminsApi`, and `storage.getPlatformConfig()` / `storage.setPlatformConfig()` from `SuperuserConfig.jsx`.
- Replaced `usersApi.listExports`/`requestExport`/`downloadExport` local state calls in `settings.jsx` with `dataExportsSlice` dispatches.

### Phase 11 Verification Counts
- **Targeted Phase 11 & Scan Vitest (`--maxWorkers=2`, `18` files):** **`18 passed (18)`**, **`83 passed (83)`** tests (`adminDataPortal.test.jsx` `8/8`, `NoApiInComponentsScan` `1/1`, `NoBrowserStorageScan` `1/1`, `NoCustomDomEventsScan` `1/1`, `AdminProjectsTable` `2/2`, `AdminProjectDetailsCleanUI` `5/5`, `ScheduledJobsPanel` `5/5`, `DemoReset` `3/3`, `Step5AuditButton` `5/5`, `AdminUsersWarnedFilterRemoval` `5/5`, `AdminUserDetails` `4/4`, `AdminReports` `5/5`, `Phase16TrustSafety` `7/7`, `Phase17DisputesAccountability` `5/5`, `Phase18PrivacyNotifications` `4/4`, `Phase23SnapshotHygiene` `3/3`, `Phase26ParityAggregation` `10/10`, `Phase5CvDeleteRemoval` `6/6`).
- **Full Vitest (`npx vitest run --maxWorkers=4`, `98` files):** **`89 passed, 9 failed (98)`** files and **`478 passed, 11 failed (489)`** tests (`Duration 196.45s`) — only the `9` pre-existing baseline failing files (`11` tests): `AdminRejectMentorApp`, `Fix1RestartAndSession`, `LeaveProjectDialog` (`2`), `Phase10PlatformDurability`, `Phase19UsersLockdown`, `Phase20ResourceAuth`, `Phase22ReputationLedger` (`2`), `Phase4MentorTimeRemoval`, `RoleSyncSingleClick`; `0` regressions.
- **ESLint:** **`0` errors and `0` warnings** across all `41` Phase 11 store/UI/scan/test files (`npx eslint ...` exit `0`); full repo improved from `76 problems (69 errors, 7 warnings)` down to **`75 problems (68 errors, 7 warnings)`**.
- **Production Build (`npm run build`):** Passed cleanly in `28.61s` (`vite build` exit `0`, **`347`** modules transformed).

### Updated Scan Allowlist Counts
- `DIRECT_API_IMPORT_ALLOWLIST` (`src/test/NoApiInComponentsScan.test.jsx`): **38 -> 27** files (removed `11` admin files: `AdminDashboard.jsx`, `AdminMentorApps.jsx`, `AdminProjectDetails.jsx`, `AdminProjects.jsx`, `AdminReports.jsx`, `AdminUserDetails.jsx`, `AdminUsers.jsx`, `AuditLog.jsx`, `ProjectDetailsCard.jsx`, `ScheduledJobsPanel.jsx`, `SuperuserAdmins.jsx`; `SuperuserConfig.jsx`, `AdminLayout.jsx`, and `AdminLogin.jsx` remain solely for portal auth/signout cleanup in Phase 1/12).
- `BROWSER_STORAGE_ALLOWLIST` (`src/test/NoBrowserStorageScan.test.jsx`): **20** files (unchanged pending Phase 12/13 removal of `storage.js` admin-session fallback).
- `CUSTOM_DOM_EVENTS_ALLOWLIST` (`src/test/NoCustomDomEventsScan.test.jsx`): **11** files (unchanged in Phase 11).

### Skipped / Deferred
- `storage.getAdminSession()` fallback for unconfigured legacy tests (`AdminLayout.jsx`, `AdminUsers.jsx`, `AdminReports.jsx`, `AdminSupport.jsx`, `SuperuserConfig.jsx`), `AdminLogin.jsx` portal credential auth & `SuperuserConfig.jsx` / `AdminLayout.jsx` `apiClient` logout helpers remain scoped for Phase 1 / Phase 12 auth/cleanup (`D9`). `back-end/` left untouched.

---

## Phase 12 — Profile, Settings & Gamification (`profilesSlice`, `reputationSlice`, `gamificationSlice`, `settingsSlice`, `sessionSlice.userUpdated`)

### Summary & Root Findings
- Built all 4 Phase 12 domain slices (`profilesSlice`, `reputationSlice`, `gamificationSlice`, `settingsSlice`) and registered them in `src/store/index.js` (`34` total slices in store: `32` domain slices + `session` + `ui`).
- Added `userUpdated` reducer to `sessionSlice` and `selectEmailVerified` / `selectNeedsUsernameConfirmation` selectors to `sessionSelectors.js` so saving profile settings, confirming auto-generated usernames, or verifying email updates `navbar.jsx`, `profile.jsx`, `VerifyEmailBanner.jsx`, and `UsernameConfirmationBanner.jsx` directly from Redux state without custom `teamforge:*` DOM events.
- Replaced bulk `trustApi.getTrustSummaries` calls in `OwnedWorkspace.jsx` and `MentorsDirectory.jsx` (and `usersApi.searchUsers` / `usersApi.getPublicProfile` in `OwnedWorkspace.jsx`) with `profilesSlice` bulk thunks (`fetchTrustSummaries` caching by `userId` and skipping already-cached IDs unless `force: true`) and selectors, while enforcing viewer privacy guards so non-self/non-admin viewers never see private `reputation` or `needsAttention` fields.
- Converted `profile.jsx`, `leaderboard.jsx`, `settings.jsx` (digest, phone OTP, profile save, deletion eligibility/blockers, soft delete), `UserTrustCard.jsx`, `VerifyEmailBanner.jsx`, `UsernameConfirmationBanner.jsx`, `VerifyEmail.jsx`, and `navbar.jsx` onto Redux thunks and selectors; removed `teamforge:user_updated` and `teamforge:badge_awarded` DOM events and `storage.*` calls from those screens.

### Decisions Made
1. **Named-vs-Default Dual-Mock Resolver (`src/store/utils/apiModule.js`):** Added `resolveApiForMethod(mod, namedKey, methodName)` so thunks transparently pick the configured Vitest mock when legacy tests define distinct `default` and named objects and stub only one (e.g. `UsernameConfirmationBanner.test.jsx`, `UserTrustCard.test.jsx`).
2. **Memoized Leaderboard Tab Sorting & React 19 Snapshot Stability (`gamificationSelectors.js`, `UserTrustCard.jsx`):** `selectLeaderboardForTab` sorts stored leaderboard rows across `Top by XP`, `Most Reliable`, and `Highest Standing` via `createSelector` without extra server fetches on tab switches; `UserTrustCard` subscribes to stable `selectTrustSummaryById` references and applies privacy filtering inside `useMemo` to prevent `useSyncExternalStore` snapshot loops.
3. **Keystroke Drafts Stay Local in Settings (`settings.jsx`):** Draft form inputs (`fullName`, `email`, `bio`, `university`, `phone`, `linkedin`, `skills`, `digestEnabled`, `digestHour`) stay local while typing and dispatch on save via `saveProfileSettings` / `saveUserSettings`.

### Slices, Reducers & Thunks Added
- **Slices added (`4`) + `sessionSlice` update:** `profiles`, `reputation`, `gamification`, `settings`, plus `sessionSlice.userUpdated`.
- **Explicit CRUD Reducers (`16` across the 4 slices — `4` per slice):** `setAll`, `addOne`, `updateOne`, `removeOne` on `profilesSlice`, `reputationSlice`, `gamificationSlice`, `settingsSlice`, plus `addRouteReset` (`routeChanged`) and `sessionReset`.
- **Async Thunks added (`28` new thunks across 4 files):**
  - `profilesThunks.js` (`5`): `fetchMyProfile`, `fetchPublicProfile`, `fetchTrustSummaries`, `fetchUserResponseTime`, `searchUsers`.
  - `reputationThunks.js` (`3`): `fetchMyReputation`, `fetchMyTrust`, `fetchUserTrust`.
  - `gamificationThunks.js` (`6`): `fetchLeaderboard`, `fetchUserRank`, `fetchGamificationStats`, `fetchGamificationLedger`, `fetchUserBadges`, `issueMentorBadge`.
  - `settingsThunks.js` (`14`): `fetchUserSettings`, `saveUserSettings`, `checkUsernameAvailability`, `confirmUsername`, `uploadUserAvatar`, `saveProfileSettings`, `deleteUserPhone`, `verifyUserPhone`, `fetchPhoneOtpStatus`, `recordFailedPhoneOtpAttempt`, `checkAccountDeletionEligibility`, `deleteMyAccount`, `resendEmailVerification`, `verifyEmailWithToken`.

### Files Changed (Grouped by Student Owner per `07-conversion-plan.md`)
- **Aditya Sai (`settingsSlice`, `sessionSlice`, `settings`, Banners, Navbar, Scans, Tests & Log):**
  - Store Core & Settings: `src/store/index.js`, `src/store/utils/apiModule.js`, `src/store/utils/thunkError.js`, `src/store/slices/sessionSlice.js`, `src/store/selectors/sessionSelectors.js`, `src/store/slices/settingsSlice.js`, `src/store/thunks/settingsThunks.js`, `src/store/selectors/settingsSelectors.js`
  - UI & Auth Components: `src/pages/settings.jsx`, `src/components/common/VerifyEmailBanner.jsx`, `src/components/common/UsernameConfirmationBanner.jsx`, `src/pages/VerifyEmail.jsx`, `src/components/navbar.jsx`
  - Tests, Scans & Docs: `src/store/__tests__/profileSettingsGamification.test.jsx`, `src/test/NoApiInComponentsScan.test.jsx`, `src/test/NoBrowserStorageScan.test.jsx`, `src/test/NoCustomDomEventsScan.test.jsx`, `docs/redux-analysis/08-progress.md`
- **Jathin Surya (`gamificationSlice`, `profile`, `leaderboard`):**
  - Store Modules: `src/store/slices/gamificationSlice.js`, `src/store/thunks/gamificationThunks.js`, `src/store/selectors/gamificationSelectors.js`
  - UI Screens: `src/pages/profile.jsx`, `src/pages/leaderboard.jsx`
- **Satwik (`profilesSlice`, `reputationSlice`, `UserTrustCard` & bulk trust callers):**
  - Store Modules: `src/store/slices/profilesSlice.js`, `src/store/thunks/profilesThunks.js`, `src/store/selectors/profilesSelectors.js`, `src/store/slices/reputationSlice.js`, `src/store/thunks/reputationThunks.js`, `src/store/selectors/reputationSelectors.js`
  - UI Components & Workspaces: `src/components/features/UserTrustCard.jsx`, `src/pages/owner/MentorsDirectory.jsx`, `src/pages/owner/OwnedWorkspace.jsx`
- **Rithvik / Kevin Gandham:** `0` files in Phase 12.

### Old Code Removed
- Removed direct `usersApi`, `uploadsApi`, `leaderboardApi`, `gamificationApi`, `mentorshipApi`, `trustApi`, `authApi`, `projectsApi`, and `apiClient` imports from `settings.jsx`, `profile.jsx`, `leaderboard.jsx`, `VerifyEmailBanner.jsx`, `UsernameConfirmationBanner.jsx`, `VerifyEmail.jsx`, and `MentorsDirectory.jsx`, plus `usersApi` and `trustApi` from `OwnedWorkspace.jsx`.
- Removed `storage.js` usage from `leaderboard.jsx`, `profile.jsx`, and `settings.jsx`.
- Removed `teamforge:user_updated` and `teamforge:badge_awarded` custom DOM event dispatches/listeners from `navbar.jsx`, `profile.jsx`, and `settings.jsx`.

### Phase 12 Verification Counts
- **Targeted Phase 12 & Scan Vitest (`--maxWorkers=4`, `11` files):** **`11 passed (11)`**, **`43 passed (43)`** tests (`profileSettingsGamification.test.jsx` `11/11`, `NoApiInComponentsScan` `1/1`, `NoBrowserStorageScan` `1/1`, `NoCustomDomEventsScan` `1/1`, `Fix2AccountAndProfile` `5/5`, `UserTrustCard` `8/8`, `UsernameConfirmationBanner` `4/4`, `ProfileCompletedProjects` `3/3`, `ProfileMentoredProjects` `2/2`, `ProfileTrustCardLedgerRemoval` `3/3`, `Phase18PrivacyNotifications` `4/4`).
- **Full Vitest (`npx vitest run --maxWorkers=4`, `99` files):** **`90 passed, 9 failed (99)`** files and **`489 passed, 11 failed (500)`** tests (`Duration 174.47s`) — only the `9` pre-existing baseline failing files (`11` tests), `0` regressions.
- **ESLint:** **`0` errors** across all `30` targeted Phase 12 store/UI/scan/test files (`npx eslint ... --quiet` exit `0`); repo-wide improved to **`76 problems (67 errors, 9 warnings)`**.
- **Production Build (`npm run build`):** Passed cleanly in `21.13s` (`vite build` exit `0`, **`359`** modules transformed).

### Updated Scan Allowlist Counts
- `DIRECT_API_IMPORT_ALLOWLIST` (`src/test/NoApiInComponentsScan.test.jsx`): **27 -> 20** files (removed `components/common/UsernameConfirmationBanner.jsx`, `components/common/VerifyEmailBanner.jsx`, `pages/VerifyEmail.jsx`, `pages/leaderboard.jsx`, `pages/owner/MentorsDirectory.jsx`, `pages/profile.jsx`, `pages/settings.jsx`).
- `BROWSER_STORAGE_ALLOWLIST` (`src/test/NoBrowserStorageScan.test.jsx`): **20 -> 17** files (removed `pages/leaderboard.jsx`, `pages/profile.jsx`, `pages/settings.jsx`).
- `CUSTOM_DOM_EVENTS_ALLOWLIST` (`src/test/NoCustomDomEventsScan.test.jsx`): **11 -> 8** files (removed `components/navbar.jsx`, `pages/profile.jsx`, `pages/settings.jsx`).

### Skipped / Deferred
- `AuthContext.jsx`, `RoleContext.jsx`, `App.jsx`, login/signup/reset/dashboard/help/marketplace/create/owner-dashboard/workspace remaining API/storage/event entries remain outside Phase 12 scope (auth/cleanup phases). `back-end/` left untouched.


---

## Phase 13 — Cleanup, Display Audit, Compliance Proof & Final Verification (FINAL)

### Summary & Root Findings
- **Legacy Layers Deleted:** Permanently deleted `src/context/AuthContext.jsx`, `src/context/RoleContext.jsx`, `src/context/NotificationContext.jsx`, `src/context/UIContext.jsx` (and removed empty `src/context/` directory), `src/utils/roleStore.js`, and `src/utils/storage.js`. Removed `apiGetCache`, `feedbackApi` module cache, and every `teamforge:*` custom DOM event across all source files. Replaced React Context consumers in `App.jsx`, auth pages, `notifications.jsx`, `profile.jsx`, `leaderboard.jsx`, `settings.jsx`, and `/admin/*` pages directly with Redux `useSelector` / `useDispatch` and `sessionSlice` / `uiSlice`.
- **Bugs Caught & Fixed During Cleanup:**
  - `src/components/navbar.jsx:191`: restored `const mentorAppStatus = useSelector(selectMentorAppStatus);` to eliminate runtime `ReferenceError` when rendering the role switcher dropdown (`RoleSyncSingleClick.test.jsx` fixed & passing).
  - `src/store/slices/notificationsSlice.js:137,148`: fixed typo `createInitialWorkingState()` -> `createInitialNotificationWorking()` inside `toggleGroupExpanded` / `toggleDigestExpanded` (`Phase26ParityAggregation` & `Phase18PrivacyNotifications` group/digest tests fixed & passing).
  - `src/store/selectors/notificationsSelectors.js:25`: replaced inline fallback object literal with module-constant `EMPTY_NOTIFICATION_WORKING` to eliminate Reselect reference instability warnings.
  - `src/services/apiClient.js`: restored active-session boot mismatch check (`handleServerRestart(bootId)`) for in-memory session state (`Fix1RestartAndSession.test.jsx` fixed & passing), and removed dead `refreshTokenPromise`.
  - `src/store/slices/sessionSlice.js`: marked `initialized = true` inside `setActiveRole` so preloaded `activeRole` persists across profile refreshes.
- **Display Audit Fixes (`docs/redux-analysis/10-display-audit.md`):** Audited all `46` page files in `src/pages/**` for server state copied into local `useState`. Refactored six pages (`dashboard.jsx`, `OwnerDashboard.jsx`, `profile.jsx`, `MentorProjectWorkspace.jsx`, `CreateProject.jsx`, `ProjectsMarketplace.jsx`) to derive displayed server entities/metrics via `useMemo` from Redux selectors (`selectOwnProfile`, `selectAllProjects`, `selectAllJoinRequests`, `selectTasksMapByProject`, `selectUserBadges`, `selectProjectById`, `selectProjectTombstoneById`, `selectProjectBadges`, `selectPublicConfig`, `selectResponseTimeMap`).
- **Proof & Documentation Delivered:**
  - `src/store/__tests__/complianceCrudProof.test.jsx`: programmatically proves `rootReducers` mounts `34` slices (`32` domain slices + `sessionSlice` + `uiSlice`), every domain slice exports `{ setAll, addOne, updateOne, removeOne }` (`32 × 4 = 128 >= 124` D1/Lens B count), and the `9` literal `*Repository`-backed slices expose `9 × 4 = 36` CRUD reducers (Lens A).
  - `docs/redux-analysis/10-display-audit.md` (complete page-by-page selector mapping).
  - `docs/redux-analysis/11-compliance-matrix.md` (`SPEC 1–9` compliance table, dual count reconciliation `36` vs `124` vs `128`, Reading B vs Reading A one-line `RESET_SCOPE` toggle in `src/store/utils/routeReset.js`, standard user F5 vs `/admin` D5 F5 reload behavior, D4 theme reset, and exact wording variances).
  - `docs/redux-analysis/12-viva-pack.md` (student-specific owned modules, `8` Viva Q&As, and `3` live-change coding tasks per student across all 5 members).

### Decisions Made
- **In-memory session & F5 behavior (D5 — Updated):** Removed all `localStorage`/`sessionStorage`/`document.cookie`/`indexedDB` usage in `src/`. Standard users rehydrate F5 reload silently via `App.jsx` `bootstrapSession()` (`POST /auth/refresh` with `credentials: 'include'` using `teamforge_refresh_token`), and Portal Admins / Super Users rehydrate F5 reload silently via `App.jsx` `restoreAdminSession()` (`POST /admin/auth/refresh` with `credentials: 'include'` using the separate `httpOnly`, `SameSite=Strict`, `Path=/admin/auth` `teamforge_admin_refresh_token` opaque rotating cookie) while `AdminProtectedRoute` displays the loading gate until restore settles.
- **Theme reset (D4):** `uiSlice.theme` defaults to `'light'` on fresh boot/F5 reload and persists in memory across route changes.
- **Route-leave clearing (D3):** Default Reading B (`RESET_SCOPE = 'page'`) clears `working` substate on `location.pathname` changes while keeping normalized entity caches, notification/chat unread counts, and active `payments.checkout.idempotencyKey`.
- **Admin unwired helpers (D8):** Retained 404-tolerant fallbacks in `AdminReports.jsx` for `needs-review` / `clear-review` with no invented backend endpoints or slices.

### Files Changed in Phase 13 (Grouped by Student Owner per `07-conversion-plan.md`)
- **Aditya Sai (Store Core, Auth/App Bootstrap, Settings, Notifications, Scans, Proofs & Docs):**
  - Deleted: `src/context/AuthContext.jsx`, `src/context/RoleContext.jsx`, `src/context/NotificationContext.jsx`, `src/context/UIContext.jsx`, `src/utils/roleStore.js`, `src/utils/storage.js`
  - Source/Core: `src/App.jsx`, `src/components/navbar.jsx`, `src/services/apiClient.js`, `src/store/slices/sessionSlice.js`, `src/store/slices/notificationsSlice.js`, `src/store/selectors/notificationsSelectors.js`, `src/pages/Login.jsx`, `src/pages/Signup.jsx`, `src/pages/CompleteProfile.jsx`, `src/pages/ForgotPassword.jsx`, `src/pages/ResetPassword.jsx`, `src/pages/Suspended.jsx`, `src/pages/notifications.jsx`, `src/pages/settings.jsx`
  - Tests, Scans & Docs: `src/test/test-utils.jsx`, `src/test/NoApiInComponentsScan.test.jsx`, `src/test/NoBrowserStorageScan.test.jsx`, `src/test/NoCustomDomEventsScan.test.jsx`, `src/test/RoleStoreScan.test.jsx`, `src/store/__tests__/complianceCrudProof.test.jsx`, migrated context/auth/notification specs, `docs/redux-analysis/10-display-audit.md`, `docs/redux-analysis/11-compliance-matrix.md`, `docs/redux-analysis/12-viva-pack.md`, `docs/redux-analysis/08-progress.md`
  - *Suggested Commit:* `feat(redux): complete phase 13 cleanup, empty scan allowlists, and add compliance docs`
- **Rithvik (Owner Dashboard, Create Project, Workspaces & Legacy Tests):**
  - Source/Tests: `src/pages/owner/OwnerDashboard.jsx`, `src/pages/owner/CreateProject.jsx`, migrated owner/project legacy tests (`LeaveRequestAndDeletionCheck.test.jsx`, `MyProjectsCompletedDeleteRemoval.test.jsx`, `Phase14MentorLifecycle.test.jsx`, `Phase5CvDeleteRemoval.test.jsx`)
  - *Suggested Commit:* `refactor(owner): derive OwnerDashboard and CreateProject limits strictly from Redux selectors`
- **Satwik (Marketplace, ProjectCard & Collab/Admin Tests):**
  - Source/Tests: `src/pages/collaborator/ProjectsMarketplace.jsx`, `src/components/features/ProjectCard.jsx`, migrated collab/task/admin legacy tests (`Phase15CollaborationUx.test.jsx`, `Phase17DisputesAccountability.test.jsx`, `Phase18PrivacyNotifications.test.jsx`, `RoleSyncSingleClick.test.jsx`)
  - *Suggested Commit:* `refactor(marketplace): read owner response times from profilesSlice and migrate collab tests`
- **Jathin Surya (Dashboard, Profile, Mentor Workspace & Mentor/Escrow Tests):**
  - Source/Tests: `src/pages/dashboard.jsx`, `src/pages/profile.jsx`, `src/pages/leaderboard.jsx`, `src/pages/mentor/MentorProjectWorkspace.jsx`, migrated mentor/profile/escrow tests (`Phase9EscrowPaymentSafety.test.jsx`, `Phase10MentorScreens.test.jsx`, `ProfileCompletedProjects.test.jsx`, `ProfileMentoredProjects.test.jsx`, `ProfileTrustCardLedgerRemoval.test.jsx`)
  - *Suggested Commit:* `refactor(mentor-profile): replace local server state in dashboard, profile, and MentorProjectWorkspace with Redux selectors`
- **Kevin Gandham (Admin Portal Auth/RBAC & Report/Support/Audit Tests):**
  - Source/Tests: `src/pages/admin/AdminLayout.jsx`, `src/pages/admin/AdminLogin.jsx`, `src/pages/admin/AdminReports.jsx`, `src/pages/admin/AdminSupport.jsx`, `src/pages/admin/AdminUsers.jsx`, `src/pages/admin/SuperuserConfig.jsx`, migrated admin specs (`AdminReports.test.jsx`, `Phase27SupportInbox.test.jsx`, `Step5AuditButton.test.jsx`, `RegressionNov21Smoke.test.jsx`, `Phase26ParityAggregation.test.jsx`)
  - *Suggested Commit:* `refactor(admin): bind admin portal layout and RBAC checks directly to sessionSlice and migrate admin specs`

### Final Phase 13 Verification Counts (Executed After Final Code Edit)
- **Full Vitest (`npx.cmd vitest run --maxWorkers=4`, `100` files):** **`93 passed, 7 failed (100)`** files; **`495 passed, 9 failed (504)`** tests (`Duration 174.51s`).
  - Only pre-existing failing files remain (`0` regressions; `Fix1RestartAndSession` and `RoleSyncSingleClick` fixed from the Phase 12 baseline of `9` failing files): `AdminRejectMentorApp.test.jsx` (`1`), `LeaveProjectDialog.test.jsx` (`2`), `Phase10PlatformDurability.test.jsx` (`1`), `Phase19UsersLockdown.test.jsx` (`1`), `Phase20ResourceAuth.test.jsx` (`1`), `Phase22ReputationLedger.test.jsx` (`2`), `Phase4MentorTimeRemoval.test.jsx` (`1`).
- **Architectural Scans & CRUD Proof:** `NoApiInComponentsScan.test.jsx` (`2/2`, incl. `createContext` check), `NoBrowserStorageScan.test.jsx` (`1/1`), `NoCustomDomEventsScan.test.jsx` (`1/1`), `RoleStoreScan.test.jsx` (`2/2`), `complianceCrudProof.test.jsx` (`3/3` — `34` slices, `32 × 4 = 128` CRUD action creators, `9 × 4 = 36` literal repo CRUD ops).
- **Updated Scan Allowlist Counts:**
  - `DIRECT_API_IMPORT_ALLOWLIST`: **`0`** (`[]`)
  - `BROWSER_STORAGE_ALLOWLIST`: **`0`** (`[]`)
  - `CUSTOM_DOM_EVENTS_ALLOWLIST`: **`0`** (`[]`)
- **ESLint (`npm.cmd run lint`):** **`55 problems (49 errors, 6 warnings)`** (down from **`76 problems (67 errors, 9 warnings)`** entering Phase 13; `0` errors across all `src/store/**` files).
- **Production Build (`npm.cmd run build`):** Succeeded in `19.21s` (`355` modules transformed; main bundle `dist/assets/index-mD19zGIG.js` `205.53 kB` gzipped, within `< 300 kB` budget).
- **Cleared-Storage Live Browser Verification:** Started `back-end` (`http://localhost:3000`, `AUTH_MODE=firebase`) and `React-Implementation` (`http://localhost:5173`) and launched browser verification with cleared storage; paused during login check due to manual user browser takeover (`Stop`), so interactive end-to-end flows remain covered by the `93` passing integration/store test files until a manual browser walkthrough completes. `back-end/` remains completely untouched (`git status` clean under `back-end/`).


---

## Post-Phase-13 Context & Optional-Store Shim Removal

- **Zero Context Usage in `src/`:** Removed every `useContext` and `ReactReduxContext` import/call across `ToastViewport.jsx`, `RouteResetListener.jsx`, and `useReasonAction.jsx` (replacing `actionApi` fallback with `useDispatch()` + Redux thunks).
- **Deleted Optional-Store Fallbacks:** Deleted `src/store/components/withOptionalStore.jsx` (unwrapped all 62 caller components/pages/route guards) and `src/store/hooks/useSafeStoreSelector.js` (replaced all 36 calls across 12 files with standard `useSelector`). Added `makeStore` alias alongside `createAppStore` in `src/store/index.js` and hardened `uiSelectors.js` optional chaining (`state?.ui?.theme`).
- **Migrated Provider-Less Tests & Added Guard Scan:** Migrated all 21 non-Provider test files to `renderWithStore` / `renderWithProviders`, updated `Phase9CollaboratorScreens.test.jsx` (`actionApi` removal) and `NoApiInComponentsScan.test.jsx`, and added `src/test/NoContextUsageScan.test.jsx` (`CONTEXT_USAGE_ALLOWLIST = []`) plus a `ToastViewport` fails-loudly test outside `<Provider>`.

---

## Dead-Code Cleanup Batches 1–5 (`docs/cleanup/04-removal-log.md`)

- **Whole Files Removed (`6` files):** `public/Assets/github_logo.png`, `public/Assets/google.svg`, `public/icons.svg`, `React-Implementation/package-lock.json`, `src/store/components/RouteResetObserver.jsx` (migrated `storeFoundation.test.jsx` to `RouteResetListener`), and `src/utils/dateUtils.js` (merged `formatRelativeTime` into `src/utils/dateFormatter.js` + added `Phase10PlatformDurability.test.jsx` unit coverage).
- **Intra-File & Circular Barrel Cleanup:** Removed the `14` wildcard `export *` lines in `src/services/apiClient.js` (`14 -> 0` `madge` circular dependencies), unused service helpers (`communicationApi`, `authApi`, `uploadsApi`, `projectsApi`, `usersApi`, `adminApi`, `mentorMarketplaceApi` alias `mentorMarketApi`), dead thunk `paymentsThunks::fetchAdminRevenueOverview`, unused `appActions`/`credentialStatus`/`setupInterceptors`/`roleHelpers`/duplicate exports, `8` unused handlers in `useReasonAction.jsx`, stale comments, `5` `console.log` -> `console.debug` notices, and `107` dead scoped CSS classes across `myWork.css`, `collaboratorWorkspace.css`, `ownedWorkspace.css`, and `settings.css` (`-1,453` net LOC in `src/`, `-35.15 KB` `dist/` build size).
- **Protected & Kept:** Preserved all `KEEP-SPEC` Redux artifacts (`34` slices, `32 x 4 = 128` CRUD reducers, `routeResetListener`, `routeReset`, `RouteResetListener`, `thunkError`, `store/README.md`) and `UNCERTAIN` items (`148` selector boilerplate exports, `RoleSyncProbe.jsx`, `@types/*`, nested folder layout).
