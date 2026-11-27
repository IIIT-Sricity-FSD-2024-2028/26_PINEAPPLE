# Phase 13 Redux Compliance Matrix (`SPEC 1–9`)

> **Branch:** `Redux-Conversion` | **Scope:** Front-end (`React-Implementation/React-Implementation/`) only (`back-end/` completely untouched).

---

## 1. Requirements 1–9 Compliance Matrix

| Spec # | Professor Requirement | Implemented Solution | Automated Test & Source Proof | Status |
|---|---|---|---|---|
| **1** | **Must have slices** | `configureStore` (`createAppStore`) in `src/store/index.js` mounts **`34` RTK `createSlice` reducers** (`32` domain slices + `sessionSlice` + `uiSlice`) wrapped by `<Provider store={store}>` in `src/main.jsx`. | `src/store/index.js`, `src/store/__tests__/complianceCrudProof.test.jsx` (`expect(Object.keys(rootReducers)).toHaveLength(34)`). | **PASS** |
| **2** | **CRUD operations = repositories × 4** | Every one of the `32` domain repository slices exports and registers all `4` explicit synchronous CRUD reducers/actions (`setAll`, `addOne`, `updateOne`, `removeOne`), totaling **`32 × 4 = 128` CRUD operations** (`>= 124` UI collection count & covering all `9 × 4 = 36` literal `*Repository` classes). | `src/store/__tests__/complianceCrudProof.test.jsx` + per-domain tests under `src/store/__tests__/*.test.jsx`. | **PASS** |
| **3** | **Slices based on repositories & CRUD via reducers** | Slices mirror backend repository/service stores (`createEntityAdapter` or normalized `{ ids, entities }` maps). Sync CRUD reducers (`setAll`, `addOne`, `updateOne`, `removeOne`) handle optimistic updates, SSE/polling merges, and normalized cache updates alongside `extraReducers`. | All `32` files in `src/store/slices/*.js`, proven across `src/store/__tests__/*.test.jsx`. | **PASS** |
| **4** | **All displayed data comes from Redux store** | Removed `apiGetCache`, `feedbackApi` module cache, `roleStore.js`, `storage.js`, all `4` React Context data providers (`AuthContext`, `RoleContext`, `NotificationContext`, `UIContext`), and all optional-store / `ReactReduxContext` migration shims (`withOptionalStore.jsx`, `useSafeStoreSelector.js`, `useContext` fallbacks in `ToastViewport`, `RouteResetListener`, `useReasonAction`). Components and pages read all displayed server values strictly via `useSelector` / `useDispatch` under the root `<Provider>`. | `docs/redux-analysis/10-display-audit.md`, `src/test/NoApiInComponentsScan.test.jsx` (`DIRECT_API_IMPORT_ALLOWLIST = []`), `src/test/NoContextUsageScan.test.jsx` (`CONTEXT_USAGE_ALLOWLIST = []`, **0 `useContext`/`createContext` usages in `src/`**), `src/test/RoleStoreScan.test.jsx`. | **PASS** |
| **5** | **State clears when moving between components *(Not sure)*** | `RouteResetListener` inside `<BrowserRouter>` dispatches `routeChanged({ from, to })`. `routeResetListener.js` and `addRouteReset(builder, fn)` reset every domain slice's `working` state (`filters`, active modal IDs, sort/search strings, draft errors) cleanly on pathname navigation (**Reading B**), with single-line **`RESET_SCOPE`** toggle supporting **Reading A**. | `src/store/utils/routeReset.js`, `src/store/middleware/routeResetListener.js`, `src/store/__tests__/routeReset.test.jsx`. | **PASS** |
| **6** | **Use THUNK to synchronize FE & BE** | Every API read and write goes through `createAsyncThunk` modules (`src/store/thunks/*.js`), imported exclusively by thunks. Mutations apply server responses via CRUD reducers or trigger cascading refetches (`fetchProjectById`, `fetchUnreadCount`, `fetchAdminUsers`, `refreshSessionUser`) to keep views synced. | `src/store/thunks/*.js` (`34` thunk modules), `src/test/NoApiInComponentsScan.test.jsx` (`DIRECT_API_IMPORT_ALLOWLIST = []` proves zero UI files import `*Api.js`, `apiClient.js`, or `tokenManager.js`). | **PASS** |
| **7** | **Do NOT use `localStorage`; store in Redux variables** | Deleted `src/utils/storage.js` and `src/utils/roleStore.js`; stripped every `localStorage`, `sessionStorage`, `document.cookie`, and `indexedDB` reference from `src/` (except scan tests). Sessions rely solely on the backend's `httpOnly` `teamforge_refresh_token` cookie + in-memory `state.session`. | `src/test/NoBrowserStorageScan.test.jsx` (`BROWSER_STORAGE_ALLOWLIST = []`, **0 violations**), `src/test/NoCustomDomEventsScan.test.jsx` (`CUSTOM_DOM_EVENTS_ALLOWLIST = []`). | **PASS** |
| **8** | **Store shows roles, controllers, CRUD slices & displayed data** | `sessionSlice` + `canAccess(session, sectionKey)` models roles (`Collaborator`, `Project Owner`, `Mentor`, `Admin`, `SuperUser`) and admin permissions (`users`, `projects`, `mentor_apps`, `revenue`, `reports`, `support`, `audit`, `*`). `34` `*Thunks.js` files map 1:1 to NestJS controllers (`04-roles-controllers-matrix.md`), feeding `32` CRUD slices -> selectors -> JSX. | `src/store/slices/sessionSlice.js`, `src/store/selectors/sessionSelectors.js`, `src/store/__tests__/sessionAccess.test.jsx`, `docs/redux-analysis/04-roles-controllers-matrix.md`. | **PASS** |
| **9** | **Follow the THUNK pattern** | Standardized `pending` / `fulfilled` / `rejected` lifecycle across all thunks, shared `normalizeThunkError` forwarding HTTP `statusCode`, `code`, `serverMessage`, `details`, `retryAfterSeconds`, `requiresEmailVerification`, plus `condition` guards and optimistic rollback snapshots (`notificationsSlice`, `communicationSlice`, `tasksSlice`). | `src/store/utils/thunkError.js`, `src/store/__tests__/profileSettingsGamification.test.jsx`, `communicationSlice.test.jsx`, `notificationsSlice.test.jsx`, `paymentsMoney.test.jsx`. | **PASS** |

---

## 2. CRUD & Slice Count Reconciliation

Two distinct ways of counting repositories in `back-end/` were cataloged in [`01-repositories-and-crud.md`](./01-repositories-and-crud.md), alongside the final Phase 13 store count proven by `src/store/__tests__/complianceCrudProof.test.jsx`:

| Counting Basis | Repositories / Slices | Calculation | Total CRUD Ops | Notes |
|---|---:|---|---:|---|
| **Lens A — Literal `*Repository` Classes** | `9` | `9 × 4` | **36** | Classes literally named `*Repository` on the backend (`Projects`, `Tasks`, `Users`, `Communication`, `LeaveRequests`, `ActionFeedback`, `Gamification`, `Mentorship`, `Governance`), mapped in `complianceCrudProof.test.jsx`. |
| **Lens B — D1 UI-Consumed Collections** | `31` | `31 × 4` | **124** | All backend repository/service data collections actively consumed by the React UI (`41` total backend stores including `10` FE-unused stores such as `DemoReset`, `AuditLog` vs `Payouts` noted in `01`). |
| **Final Phase 13 Implemented Store** | **`32` domain + `2` meta = `34` total** | `32 × 4` | **128** | Registered in `rootReducers` (`src/store/index.js`). Every one of the `32` domain slices exports & proves `{ setAll, addOne, updateOne, removeOne }` (`32 × 4 = 128 >= 124`). |

**Why `34` slices (`32` domain + `session` + `ui`) instead of `32` (`30` domain + `session` + `ui`) in `07-conversion-plan.md`:**
1. `users` in `07` was cleanly separated into `profilesSlice`, `settingsSlice`, and `adminUsersSlice` so self-settings drafts/deletion/OTP checks stay isolated from public trust cache and the `/admin/users` directory.
2. `projects` in `07` was paired with `adminProjectsSlice` so owner/collaborator marketplace lists and `/admin/projects` soft-delete/escrow moderation views keep separate list pagination & working filters without colliding.
3. `mentorSessions` checkout (`Idempotency-Key`, 30-minute timer, UPI confirm flow) was given a dedicated `paymentsSlice` to keep checkout resilience crystal clear across routes while refreshing `mentorSessionsSlice` and `escrowAccountsSlice` after payment.
4. `recommendationBadgesSlice` and `gamificationLedgerSlice` were consolidated into `gamificationSlice` (leaderboard + XP ledger + badges under one cohesive domain slice).

---

## 3. Route-Leave Clearing: Reading B vs Reading A (One-Line Switch)

Implemented in `src/store/utils/routeReset.js` (`L1–44`) and `src/store/middleware/routeResetListener.js`:

- **Default — Reading B (`export const RESET_SCOPE = 'page';`):**
  - `<RouteResetListener />` dispatches `routeChanged({ from, to })` only when `location.pathname` changes (ignoring query-string tab changes like `?tab=tasks` → `?tab=chat`).
  - Every domain slice handles `routeChanged` via `addRouteReset(builder, clearWorkingFn)` to wipe `working` state (`filters`, open modals/drawers, transient errors, unread scroll flags) while preserving normalized entity caches (`entities`, `ids`) and `payments.checkout.idempotencyKey` (Decision D3 safety exception until payment completes/cancels) as well as global badge counts (`notifications`, `communication.unread`, `reports.openCount`).
- **Switching to Reading A (Group-Scope Reset):**
  - Change line `8` of `src/store/utils/routeReset.js` from `export const RESET_SCOPE = 'page';` to **`export const RESET_SCOPE = 'group';`** (or pass `{ routeResetScope: 'group' }` to `createAppStore()`).
  - `addRouteReset` then inspects `getPathGroup(from) !== getPathGroup(to)` (first URL segment, e.g. `'owner'` vs `'admin'`) and preserves working filters while navigating inside the same portal section, resetting only when crossing route groups. `resetSlice()` is also exported by every domain slice if full entity teardown on route group exit (Reading C) is requested in viva.

---

## 4. Reload (F5), Session Recovery & Theme Behavior

1. **Standard Users on F5 Refresh (`App.jsx` + `sessionThunks.js`):**
   - `App.jsx` runs a startup effect dispatching `bootstrapSession()`, which calls `POST /auth/refresh` with `credentials: 'include'`.
   - Because the backend sets the `httpOnly` cookie `teamforge_refresh_token` (`back-end/src/auth/`), **zero `localStorage` tokens exist** and valid logged-in users silently rehydrate `state.session` (`accessToken`, `user`, `activeRole`, `allowedRoles`, `mentorApproved`) and stay signed in on F5.
   - If the cookie is missing or expired (`401`), `ProtectedRoute` cleanly routes unauthenticated requests to `/login`.
2. **`/admin` Portal Admins on F5 Refresh (Decision D5 — Updated):**
   - `AdminService.login` + `AdminRefreshService` (`back-end/src/admin/admin-refresh.service.ts`) now issue an opaque, SHA-256-hashed `httpOnly` (`SameSite=Strict`, `Path=/admin/auth`) refresh cookie `teamforge_admin_refresh_token` with strict single-use rotation, reuse revocation (`401 REFRESH_REUSED`), and live admin permission/status checks, while keeping Decision D5's zero-browser-storage invariant intact.
   - On F5 inside `/admin/*`, `App.jsx` runs single-flight `restoreAdminSession()` (`POST /admin/auth/refresh` with `credentials: 'include'`) and `AdminProtectedRoute` renders `data-testid="auth-loading-screen"` without login flash until restore completes, keeping valid admins signed in on the exact `/admin/*` URL or cleanly redirecting unauthenticated requests to `/admin/login?next=...`.
3. **Theme Persistence on F5 vs Route Navigation (Decision D4):**
   - `uiSlice.theme` initializes to `'light'` in Redux memory (no `localStorage` read/write). Switching `'light' | 'dark'` via `settings.jsx` updates `<html data-theme="...">` across all pages during the session (`App.jsx` theme effect) and resets to `'light'` on full browser F5 reload.

---

## 5. Deviations from Professor's Exact Literal Wording

1. **`sessionSlice` and `uiSlice` do not implement 4-op `setAll/addOne/updateOne/removeOne` entity CRUD:** Both are singleton client/session state slices (`user`, `theme`, `toasts`, `sidebarOpen`), whereas all `32` server-backed domain repository slices implement all `4` entity CRUD reducers (`32 × 4 = 128`).
2. **`actionFeedbackSlice` & `platformConfigSlice` store singleton config objects + CRUD:** In addition to entity adapter/map records supporting `setAll/addOne/updateOne/removeOne` (`128` CRUD proof passes), `reasonsConfig` and `publicConfig` hold configuration objects cached once per session and kept across `routeChanged`.
3. **In-session `routeChanged` uses Reading B (clear `working`, keep entity cache) rather than wiping fetched arrays on every click:** Prevents redundant re-fetches of `/feedback/reasons`, `/notifications`, and project catalogs while strictly clearing filters, selected IDs, and transient dialog state—while offering the `RESET_SCOPE = 'group'` / `resetSlice` single-line switch.
4. **D8 Unwired Backend Helpers (`needs-review` / `clear-review`):** `AdminReports.jsx` retains 404-tolerant API helpers for `/admin/mentor-sessions/needs-review` and `/clear-review` without adding dead slices because those controller endpoints do not exist in `back-end/src/admin/admin.controller.ts`.
