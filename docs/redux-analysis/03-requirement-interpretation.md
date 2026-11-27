# Step 3: Analysis of Requirement 5 & Other Spec Ambiguities

> **Target Uncertainty:** Professor Requirement 5 (*"When we move between components the state should clear (the professor is NOT SURE about this one)"*) plus six structural ambiguities between the verbal requirements and the real TeamForge codebase.

---

## 1. Deep Analysis of Requirement 5 ("State Clears When Moving Between Components")

### Three Concrete Interpretations Compared

#### Reading A — Feature Slices Reset When Leaving Their Route Group *(Session, Roles, Notifications & Global UI Excepted)*
- **Rule:** Group slices by route ownership (`/admin/*`, `/owner/*`, `/mentor/*`, Collaborator routes, Workspace routes `/workspace/:projectId` / `/owner/workspace/:projectId` / `/mentor/workspace/:projectId`, Help/Reports). Moving *within* a group keeps slice data; leaving the route group resets that group's feature slices back to `initialState`.
- **Screen-by-Screen Impact:**
  - *Workspaces (`OwnedWorkspace`, `CollaboratorWorkspace`, `MentorProjectWorkspace`):* Navigating away clears `tasks`, `chatMessages`, `leaveRequests`, `projectInvites`, `selectedProjectId`. Returning refetches cleanly from backend.
  - *Admin Portal (`/admin/*`):* Moving between `AdminUsers` -> `AdminUserDetails` -> `AdminProjects` keeps admin lists intact; exiting `/admin` resets `auditLogs`, `reports`, `supportTickets`, `portalAdmins`, `jobRuns`, `escrowAccounts`, `pendingModerationActions`.
  - *Cross-role flows (`/owner/mentors` -> `/notifications` or `/dashboard` -> `/my-projects`):* Clears `projects` and `mentorSessions` when leaving `/owner/*`, forcing `/dashboard` or `/owner/dashboard` to refetch.
- **UX, Performance & SRS Impact:**
  - Moderate refetch cost at domain boundaries; zero cross-route memory accumulation over long admin sessions.
  - Because `apiClient.js`'s 20s `apiGetCache` is removed under Req 4, cross-group switches always trigger real network calls (`~6` parallel calls when entering `OwnedWorkspace`, `~4` on `dashboard`). Under SRS `NFR-1`/`NFR-3`, backend `Map` indexes handle `<10ms` reads (`docs/srs/SRS_updated.md`), so server load stays within budget if thunks avoid duplicate calls.
- **Money & Chat Screens / Polling:**
  - **Danger on `/owner/mentors` Escrow Payment:** If a user leaves `/owner/mentors` during `bookingStep === 'payment'` while waiting for UPI confirmation, clearing `mentorSessionsSlice` wipes `activePaymentSession`, `activePaymentIntent`, and the generated `idempotencyKey`. If they return and retry booking/confirming, they risk starting a second payment attempt instead of resuming the pending session (`payment_pending`).
  - **Chat & Polling:** Leaving a workspace stops the 6s `useVisibilityPoll` and clears `messagesByProjectId`, preventing stale cross-project chat flash when opening another project.

#### Reading B — Working / Page-Scoped State Clears on Route Change; Normalized Entities Stay Cached *(Recommended)*
- **Rule:** Every domain slice splits into two sub-objects (or conventions):
  1. `entities` / `ids` (`createEntityAdapter` normalized records from server).
  2. `working` (`selectedId`, `detailItem`, `filters`, `searchQuery`, `sort`, `pagination`, `opStatus`, `opError`, `lastActionResult`, `chatMessagesByProject`, `formDraft`).
  Moving between routes **always dispatches `clearWorkingState()` (keeping `entities` intact unless expired/switched user)** while clearing volatile workspace subviews (`chatMessages` for previous project, `auditLogs` export feedback, `adminReportDetail`, `scheduledJobSelectedRun`).
- **Screen-by-Screen Impact:**
  - Moving `MyProjects` -> `OwnedWorkspace` -> `MyProjects` renders cached `projects` immediately with zero spinner flash (and optional background stale-check), while clearing old modal errors, search bars, and task rejection states.
  - Opening a second workspace `/owner/workspace/p2` after `p1` immediately clears `p1`'s `tasks`/`messages` working selection before loading `p2`, preventing accidental display of `p1`'s chat or tasks.
  - Leaving `AdminReports` clears `selectedReportId`, `reportDetail`, `dismissError`, while keeping the main report list available until invalidated/refetched.
- **UX, Performance & SRS Impact:**
  - Best alignment with SRS `docs/performance-findings.md`: prevents repetitive `projectsApi.list()`, `adminApi.getPublicConfig()`, and `feedbackApi.getFeedbackReasons()` waterfalls on every navigation without needing the banned non-Redux `apiGetCache`!
  - Preserves viva rubric clarity: students can explain *"normalized server cache in Redux vs transient page working state cleared on navigation."*
- **Money & Chat Screens / Polling:**
  - Safe for `/owner/mentors` escrow checkout: `mentorSessions.entities` retains the `payment_pending` session returned by `/sessions/mine` (`bookSession`), and `activeCheckout` (`sessionId`, `paymentIntent`, `idempotencyKey`) can either stay keyed by `sessionId` until payment succeeds/cancels or prompt before navigating away (`beforeunload` / modal guard).
  - Unmount cleanup stops 6s chat polls (`useVisibilityPoll` cleanup) and clears `activeChatProjectId`.

#### Reading C — Everything Except `session` (and Global App Config) Resets on Every Navigation
- **Rule:** Any route pathname change (`useLocation().pathname` / Router listener) dispatches `resetAllFeatureSlices()`, keeping **only** `sessionSlice` (user, token, roles, permissions), `uiSlice` (theme, sidebar), and optionally `notifications` unread count.
- **Screen-by-Screen Impact:**
  - Every click (`/dashboard` -> `/profile` -> `/leaderboard` -> `/dashboard`) triggers a full loading skeleton and refetches all page APIs from scratch (`dashboard`: 4+ calls; `profile`: 6+ calls; `OwnedWorkspace`: 6+ calls).
  - Moving from `ProjectsMarketplace` -> clicking a project -> returning loses filters, fetched list, invites, and match scores.
- **UX, Performance & SRS Impact:**
  - Noticeable UI flicker (`loading = true` spinners on every navigation) and **highest network traffic** (3x–6x more requests per minute than today's 20s `apiGetCache` architecture).
  - Partially defeats the optimization work recorded in `docs/performance-findings.md`, unless stale-while-revalidate were kept (which conflicts with full wipe).
- **Money & Chat Screens / Polling:**
  - **High Risk on `/owner/mentors`:** Navigating away mid-UPI payment wipes `activePaymentIntent` and `idempotencyKey`; user must rely on server `/sessions/mine` refetch to rediscover pending payment session and generate a *new* `idempotencyKey` (safe only because `paymentIntent` is already server-persisted once `bookSession` resolves; dangerous if double-clicked before navigation).
  - Ensures 100% fresh server truth on Admin moderation, Escrow reconciliation, and Support tickets upon every entry.

---

### Side-by-Side Comparison & Implementation Blueprint

| Dimension | Reading A (Route-Group Reset) | Reading B (Working State Reset, Keep Entities) — **Recommended** | Reading C (Full Non-Session Reset on Every Route) |
|---|---|---|---|
| **Flicker & UX** | Medium (only at role/section switches) | **Low (instant back/forward navigation)** | High (loading spinner on every route click) |
| **Network Traffic / SRS Perf** | Moderate (section boundary refetches) | **Lowest (replaces banned `apiGetCache` inside Redux)** | Highest (refetches `projects`, `users`, config on every page) |
| **Stale Data Risk** | Low–Medium | Requires invalidation/refetch after writes + focus refresh | Minimal (always refetches on mount) |
| **Escrow Checkout Safety** | Must guard `/owner/mentors` checkout | Preserves active session & `idempotencyKey` cleanly | Loses in-flight payment UI state on accidental click |
| **Professor Satisfied?** | Strongly if scoped per feature module | Best engineering balance; **needs professor OK** on keeping entities | Satisfies literal *"everything clears"* reading literally |

#### How Route-Leave Clearing Would Be Implemented (Code Design)
1. **Shared `resettable` Slice Pattern / ExtraReducer:**
   - Every feature slice defines **both** `clearWorkingState(state)` (resets `filters`, `selectedId`, `error`, `mutationStatus`, `activeModal`, volatile buffers) AND `resetSlice()` (`return initialState`).
   - Add a typed route-change action: `export const routeChanged = createAction('app/routeChanged'); // payload: { from, to }`.
2. **Router Listener (`RouteResetObserver.jsx` inside `<BrowserRouter>`):**
   - Tracks `prevPathRef.current` with `useLocation().pathname`.
   - When `pathname` changes:
     - **Reading B (Default):** Dispatches `routeChanged({ from, to })` -> every slice handles `extraReducers` `builder.addCase(routeChanged, clearWorkingState)`.
     - **Reading A (If professor wants feature clearing):** Helper `getRouteGroup(pathname)` returns `'admin' | 'owner' | 'mentor' | 'collaborator' | 'workspace' | 'shared'`; `listenerMiddleware` dispatches `slice.actions.resetSlice()` whenever leaving a group.
     - **Reading C (If professor insists on total reset):** `builder.addCase(routeChanged, () => initialState)` across all non-global slices (ignoring query-param-only changes so `?tab=chat` in `OwnedWorkspace` does NOT wipe the workspace!).
   - *Unmount `useEffect` alternative:* Component `useEffect(() => () => dispatch(resetSlice()), [])` is simpler for student viva explanation, **but fails** when React Router renders two sibling components in the same layout (parent cleanup ordering / nested routes), whereas a `routeChanged` listener or `useRouteReset(slice.actions.resetWorking)` hook on top-level page components is deterministic! **Recommended:** Page unmount `useEffect(() => () => dispatch(clearWorking()), [])` for modal/filter state + `routeChanged` listener for cross-route cleanup, because students already understand `useEffect` cleanup for course evaluation!

#### Tests That Prove Each Reading
- **Test for Reading B:** Render `<AppRoutes />` with `renderWithStore`, navigate `/projects`, dispatch mock fetch (`projects: [p1]`, `searchQuery: 'react'`), navigate to `/dashboard`, assert `store.getState().projects.working.searchQuery === ''` AND `store.getState().projects.entities['p1']` is still populated.
- **Test for Reading A:** Navigate `/admin/users` (populated `users`), navigate `/admin/projects` (`admin` group preserved -> `users.ids.length > 0`), navigate `/dashboard` (exited `admin` group -> `auditLogs.ids === []`, `portalAdmins.ids === []`).
- **Test for Reading C:** Populate `projects`, `tasks`, `reports`; navigate `/projects` -> `/dashboard`; assert `projects.ids === []`, `tasks.ids === []`, `session.user !== null`, `notifications.unreadCount === 3`, `ui.theme === 'dark'`.

---

## 2. State That Must NEVER Clear Between Components

| State Key (In-Memory Redux) | Reason It Must Survive Navigation |
|---|---|
| `session.user`, `session.accessToken`, `session.expiresAtMs`, `session.authStatus` | Logging in must persist across `/dashboard`, `/projects`, `/settings`, etc.; clearing drops auth headers and logs user out (`ProtectedRoute`). |
| `session.activeRole`, `session.allowedRoles`, `session.portalRole`, `session.permissions`, `session.isSuperUser` | Drives `Navbar` switcher, `Sidebar` menu, and `OwnerProtectedRoute` / `MentorProtectedRoute` / `AdminProtectedRoute` across every route. |
| `notifications.items` / `notifications.unreadCount` & `chatMessages.unreadSummary` | Displayed persistently in global `Navbar` (`unreadCount` badge & `chatUnread` badge) regardless of active page. |
| `ui.theme`, `ui.isSidebarOpen` | Global chrome preferences; clearing would flash light/dark theme or snap the sidebar open/closed on every link click. |
| `platformConfig.public` & `actionFeedback.reasonsConfig` | Immutable/rarely changing app dictionaries (`maintenanceMode`, `mentorMinYearsExperience`, reason radio lists); clearing causes redundant fetches on every modal or form open. |
| `session.flashNotices` (`sessionEnded`, `suspendedInfo`, `demoReset`, `accountDeleted`) | Consumed on the destination page *immediately after* a redirect (`/login`, `/admin/login`, `/suspended`, `/`). Clearing inside route middleware would erase the notice before the target page reads it; clear explicitly upon consumption instead! |
| `mentorSessions.activeCheckout` *(until completed/cancelled or user leaves checkout flow intentionally)* | Holds `activePaymentSessionId`, `activePaymentIntent`, and `idempotencyKey` (`MentorsDirectory.jsx:140-146`) so retrying confirmation never sends a duplicate charge without an `Idempotency-Key`. |

---

## 3. Analysis of Other Specification Ambiguities

| Professor Line / Topic | Interpretation Options | What It Means in TeamForge | Risk | Question for Professor (`questions.md`) |
|---|---|---|---|---|
| **1. `"Number of CRUD operations = number of repositories x 4"`** & **`"Create slices based on repositories and have CRUD operations using reducers"`** (Reqs 2, 3) | **Opt A:** 1 `createAsyncThunk` + 4 sync reducers (`setAll`, `addOne`, `updateOne`, `removeOne`) per repo (`N_ui` active domain slices).<br>**Opt B:** Literal 4 HTTP thunks (`fetch`, `create`, `update`, `delete`) x 9 `*Repository` files = 36.<br>**Opt C:** 4 operations per all 31 FE-used stores (`124`) or 41 total collections (`164`). | Only `Projects`, `Tasks`, `Users`, `JoinRequests`, `MentorApps`, `MentorRequests`, `Support`, `PortalAdmins`, `Notifications`, `LeaveRequests`, `Invites` even have all 4 HTTP operations. Append-only stores (`AuditLogs`, `GamificationLedger`, `ReputationEntries`, `JobRuns`, `Escrow`, `Reports`, `Appeals`) lack DELETE or UPDATE endpoints intentionally. **Recommended Rule:** Define all **4 synchronous CRUD reducers** on every repository slice (giving exact `4 x N` reducer operations), and create **`createAsyncThunk` thunks only for endpoints that actually exist on the back end**. Count **`N` on active FE-used repositories (`31` collections / `29` cohesive slices; or `9` if literal `*Repository` only)**. | Counting 4 *HTTP endpoints* per repository fails for immutable ledgers/audit logs and risks students inventing unused mock endpoints. Counting only 9 `*Repository` classes leaves 20+ screens outside Redux, violating Req 4. | **Q1 & Q2:** Should `N` count only the 9 explicit `*Repository` classes (`4x9=36`) or all 31 FE-used in-memory domain collections (`4x31=124`), and do 4 synchronous CRUD reducers (`setAll`/`addOne`/`updateOne`/`removeOne`) satisfy `4 x N` when the backend lacks `DELETE`/`UPDATE` routes (e.g., `AuditLog`)? |
| **2. `"When we move between components the state should clear"`** (Req 5) | Reading A (route-group reset), Reading B (working state resets, entities kept), Reading C (full reset except session). | Working/UI/draft state clears on navigation (`clearWorkingState`), while session, roles, global config, notifications, and normalized entity caches survive (Reading B). *(Optionally wire route-group reset via one middleware flag if desired.)* | Full reset (Reading C) causes flicker on every page switch, spikes backend load, and conflicts with `performance-findings.md` optimizations. | **Q3:** Since Req 5 was marked *"NOT SURE"*, do you approve **Reading B** (clear filters/modals/selected items on page leave while keeping loaded entity cache + session), or do you require a full slice wipe on every route change? |
| **3. `"No local storage. State must be maintained in variables."`** (Req 7) — **`sessionStorage` & `document.cookie`** | **Assume Strict:** Ban `localStorage`, `sessionStorage`, `indexedDB`, and JS `document.cookie` reads/writes (`storage.js` removed/emptied). Keep browser `httpOnly` cookie handled strictly by the HTTP stack (`credentials: 'include'`). | Removes all **16 `localStorage` keys** + **19 `sessionStorage` keys** + **direct `teamforge_suspended_info`** `sessionStorage` calls across 5 files. | Ambiguity over whether `sessionStorage` counts as "local storage" or if `httpOnly` cookie counts; failing to clarify could cost viva marks. | **Q4:** Does *"No local storage"* also prohibit `sessionStorage` and client-side `document.cookie`, while still allowing the browser to send the backend's `httpOnly` `teamforge_refresh_token` cookie via `credentials: 'include'`? |
| **4. In-Memory Auth Token & Page Reload** (Req 7 trade-off) | **Standard Users (JWT mode):** `AuthService` sets `httpOnly` cookie `teamforge_refresh_token` (`auth.service.ts`), so `App` boot calls `POST /auth/refresh` silently with `credentials: 'include'`.<br>**Admin Portal Users (JWT mode):** **Updated:** `AdminService.login` / `AdminRefreshService` now issues `httpOnly` `SameSite=Strict` (`Path=/admin/auth`) cookie `teamforge_admin_refresh_token` and exposes `POST /admin/auth/refresh` + `POST /admin/auth/logout`, so `App` boot runs `restoreAdminSession()` on `/admin/*` and stays logged in across F5 refresh with zero `localStorage`/`sessionStorage`. | Both standard users and portal admins stay logged in across F5 refresh via separate `httpOnly` cookies while access tokens remain strictly in Redux memory; Firebase mode relies on `inMemoryPersistence` unless using JWT cookies. | Previously logout-on-refresh on `/admin/*` was a temporary Req 7 trade-off; superseded by `teamforge_admin_refresh_token` opaque rotating `httpOnly` cookie. | **Q5 (Resolved):** Added backend `httpOnly` admin refresh cookie (`teamforge_admin_refresh_token`) + `POST /admin/auth/refresh` so portal admins survive F5 reload cleanly without Web Storage. |
| **5. UI-only local state & Controlled Form Inputs** (Reqs 4, 8 + course rubric) | **Allowed local `useState`:** Purely visual toggles (`modalOpen`, `dropdownOpen`, `hover`, `showPassword`, `isDescExpanded`) and **controlled form input buffers** (`email`, `password`, `taskForm`, `editProjectForm`) prior to submission.<br>**Forbidden local `useState`:** Any server-fetched lists, profiles, counts, badges, stats, errors from server entities. | Directly honors **both** Req 4 (*displayed server/app data comes from Redux*) AND the **course grading rubric** (*React props, local event handling, controlled forms, `useEffect`*). Wait: derived server data (`maxCapacityLimit`, pre-populated `settings` profile values) comes from Redux selectors, copied/initialized only on explicit edit start! | Moving every keystroke (`<input onChange>` in 20+ forms) into Redux creates massive boilerplate, lags typing on 4,173-line `OwnedWorkspace.jsx`, and removes classic React controlled-form evidence from students' code. | **Q6:** May individual form input values (typing drafts) and ephemeral UI toggles (open/close dropdown/modal) stay in React `useState` until submit, while all fetched/saved data is read and displayed strictly from the Redux store? |
| **6. `createEntityAdapter` Usage** (Reqs 1, 3) | Normalized `{ ids: [], entities: {} }` state via RTK `createEntityAdapter` inside `createSlice` vs plain arrays `[...]`. | `createEntityAdapter` provides built-in `setAll`, `addOne`, `updateOne`, `removeOne`, `upsertMany` (literal 4 CRUD reducers!) + O(1) lookup (`selectById`), zero duplicate ID bugs when merging `/projects` & `/projects/my-work`. | Some professors prefer plain array slices (`state.items = []`) for beginner viva readability (`filter`/`map`/`findIndex`). | **Q7:** Is `createEntityAdapter` (`{ ids, entities }`) approved inside our slices (it maps cleanly to `addOne`/`updateOne`/`removeOne`/`setAll`), or do you prefer plain array state? |

---

## 4. Recommended Defaults Summary (If Ambiguities Remain Open at Implementation Time)

1. **Repository Count Baseline:** Implement **`N_ui = 31` UI-consumed backend collections** mapped into **cohesive repository slices (`28` domain slices + `sessionSlice` + `uiSlice` = `30` slice files)**, with all **4 synchronous CRUD reducers** (`setAll`, `addOne`, `updateOne`, `removeOne`) on every domain slice + real API thunks only (never fabricating fake HTTP routes). Document `N_class = 9` (`4 x 9 = 36`) and `N_all = 41` (`4 x 41 = 164`) side-by-side in viva slides.
2. **Navigation Clearing Baseline:** Implement **Reading B** (`clearWorkingState` on route navigation) via a unified listener + `resetSlice` action ready to toggle Reading A in one switch.
3. **Storage & Refresh Baseline:** Remove **all** `localStorage` and `sessionStorage` (`storage.js` replaced by in-memory store/variables); keep standard user `httpOnly` cookie silent refresh (`teamforge_refresh_token`) AND portal admin `httpOnly` `SameSite=Strict` cookie silent refresh (`teamforge_admin_refresh_token` via `POST /admin/auth/refresh` with `credentials: 'include'`).
4. **Local State Rule:** Server/shared/role/notification/config data -> **100% Redux**; ephemeral hover/modal toggle & keystroke buffers prior to submit -> **React `useState`**.
