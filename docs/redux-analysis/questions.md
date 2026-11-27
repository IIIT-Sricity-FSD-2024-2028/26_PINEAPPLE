# Professor Clarification Questions & Recommended Defaults

> Present these **9 concise questions** before starting Phase 1 coding. Each item includes the exact TeamForge codebase evidence and our recommended default so implementation can proceed immediately upon sign-off.

---

### Q1. What exact count fixes `N` in `CRUD operations = N x 4`?
- **Context (`01-repositories-and-crud.md`):** The NestJS backend has **9** explicit `*Repository` classes (`Projects`, `Tasks`, `Users`, `Communication`, `LeaveRequests`, `ActionFeedback`, `Gamification`, `Mentorship` [active badges + retired apps], `Governance` [retired 410]), while **31** additional active domain collections (`Notifications`, `JoinRequests`, `MentorApplications`, `MentorProfiles`, `MentorSessions`, `Reports`, `Appeals`, `Warnings`, `PendingModerationActions`, `Reputation`, `Support`, `Escrow`, `PortalAdmins`, `PlatformConfig`, `ProjectInvites`, `AuditLogs`, `JobRuns`, `DataExports`, `AbandonmentReviews`, `SessionDisputes`, `SessionFeedbacks`, etc.) live in `BaseService<T>` subclasses or private service arrays (`41` total including internal-only stores).
- **Question:** Should `N` count **all 31 UI-consumed backend collections** (`4 x 31 = 124` CRUD operations, yielding 30 cohesive domain slices + `session` + `ui`), or only the **9 `*Repository` classes** (`4 x 9 = 36`)?
- **Recommended Default:** **31 FE-used collections (`N_ui = 31`, `30` domain slices + `session` + `ui`)**, because counting only 9 files leaves most screens outside Redux and would violate Requirement 4 (*"all displayed data must come from Redux"*).

### Q2. Do synchronous CRUD reducers (`setAll`, `addOne`, `updateOne`, `removeOne`) satisfy Requirement 2 & 3 when an append-only repository lacks backend `PUT` or `DELETE` endpoints?
- **Context (`01-repositories-and-crud.md`, `05-thunk-pattern.md`):** Append-only/immutable stores (`AuditLog`, `GamificationLedger`, `ReputationEntries`, `Reports`, `Appeals`, `ActionFeedback`, `JobRuns`, `EscrowAccounts`, `RecommendationBadges`) intentionally have no HTTP `DELETE` or `UPDATE` API on the backend.
- **Question:** May every repository slice define all **4 synchronous CRUD reducers** (`setAll`, `addOne`, `updateOne`, `removeOne`) while writing `createAsyncThunk` thunks **only for endpoints that actually exist** in NestJS (rather than inventing unused mock routes)?
- **Recommended Default:** **Yes** — 4 synchronous reducers per slice (`4 x N` reducer ops) + real-endpoint thunks (`05-thunk-pattern.md`).

### Q3. For Requirement 5 (*"When we move between components the state should clear"* — marked *"NOT SURE"*), which clearing policy do you want?
- **Context (`03-requirement-interpretation.md`):**
  - *Reading A:* Reset all slices belonging to a route group when leaving that route group.
  - *Reading B (Recommended):* Clear **page-level working state** (filters, search bars, selected row/tab/modal flags, errors, temporary chat buffers) on navigation, while preserving loaded normalized entities (`projects`, `tasks`, `users`) + `session`, active role, notifications, theme, and active payment checkout `idempotencyKey`.
  - *Reading C:* Wipe all slices except `session` on every route change, forcing full loading spinners & multi-API refetches on every click.
- **Question:** Do you approve **Reading B** (clear working state & errors on navigation while keeping normalized entity cache and global session/notifications)? *(Note: we can include a `resetSlice()` action per slice so Reading A is a 1-line switch if preferred.)*
- **Recommended Default:** **Reading B** — satisfies the UX/cleanup goal without re-introducing network waterfalls or breaking `Idempotency-Key` payment flows.

### Q4. Under Requirement 7 (*"No local storage"*), is `sessionStorage` and `document.cookie` also forbidden?
- **Context (`02-frontend-inventory.md`, `06-no-local-storage.md`):** Currently `utils/storage.js` writes **16 `localStorage` keys** and **19 `sessionStorage` keys** (plus 5 files directly access `sessionStorage` `'teamforge_suspended_info'`). The app does NOT touch `document.cookie`, while the browser automatically handles the backend's `httpOnly` `teamforge_refresh_token` cookie via `credentials: 'include'`.
- **Question:** Should our architectural scan test forbid **both `localStorage` and `sessionStorage` (plus `document.cookie` and `indexedDB` in `src/`)**, keeping state purely in Redux store variables while letting the browser handle the backend `httpOnly` cookie automatically?
- **Recommended Default:** **Yes — ban all Web Storage (`localStorage` + `sessionStorage` + JS cookie access)** in `NoBrowserStorageScan.test.jsx`.

### Q5. Should Portal Admins survive browser page refresh (F5) without browser storage (Resolution Update)?
- **Context (`06-no-local-storage.md`):** Standard JWT users stay logged in across F5 refresh because `AuthService` sets `teamforge_refresh_token`. Initially `AdminService.login` returned only an in-body JWT without a refresh cookie, which was overridden by adding a dedicated backend `httpOnly` `SameSite=Strict` (`Path=/admin/auth`) opaque rotating cookie `teamforge_admin_refresh_token` plus `POST /admin/auth/refresh` and `POST /admin/auth/logout`.
- **Resolution:** **Implemented `httpOnly` admin cookie refresh (`teamforge_admin_refresh_token`) + single-flight `restoreAdminSession()` on `/admin/*`**. Both standard users and Portal Admins / Super Users now survive F5 refresh in-memory with zero `localStorage`, `sessionStorage`, or JS `document.cookie` usage.

### Q6. May controlled form input typing state (`<input value={...}>`) and purely visual toggles (`modalOpen`, `dropdownOpen`) remain in React `useState`?
- **Context (`02-frontend-inventory.md`, `03-requirement-interpretation.md`):** The course rubric evaluates students on *"controlled forms"* and *"React state management"*, while `settings.jsx` (`2,124L`) and `OwnedWorkspace.jsx` (`4,173L`) have dozens of interactive form inputs and modal toggles.
- **Question:** Under Requirement 4 (*"Any data being displayed in a component must be displayed from the Redux store"*), may local `useState` still hold transient keystroke drafts prior to Submit and local UI open/close booleans, as long as **all fetched/saved/shared server data is stored in and displayed strictly from Redux**?
- **Recommended Default:** **Yes** — server data & cross-component state live 100% in Redux; keystroke form buffers & modal open toggles stay local until dispatched on submit.

### Q7. Is `createEntityAdapter` (`{ ids, entities }`) approved inside our slices?
- **Context (`05-thunk-pattern.md`):** `createEntityAdapter` generates `setAll`, `addOne`, `updateOne`, `removeOne` directly and eliminates duplicate items when merging `/projects`, `/projects/my-work`, and `/projects/:id`.
- **Question:** Are we allowed to use `createEntityAdapter` inside `createSlice`, or do you expect plain arrays (`state.items = []`) for viva inspection?
- **Recommended Default:** **Use `createEntityAdapter`**, with explicit named CRUD reducer wrappers (`setAll`, `addOne`, `updateOne`, `removeOne`) so students can point directly to each CRUD reducer in viva.

### Q8. How should we handle the 2 unwired `adminApi` calls (`needs-review` / `clear-review`) and 2 unused backend controllers (`Payouts`, `LogViewer`)?
- **Context (`01-repositories-and-crud.md`, `04-roles-controllers-matrix.md`):**
  1. `AdminReports.jsx:153,193` calls `GET /admin/mentor-sessions/needs-review` and `POST /admin/mentor-sessions/:id/clear-review`, which have **no controller route** (`MentorMarketplaceService.clearSessionReview` exists unexposed at `L4677`).
  2. `GET /payouts/transactions` and `GET /logs/requests|errors` exist on the backend with zero callers in `React-Implementation`.
- **Question:** Should we remove/ignore those unwired endpoints on the frontend during Redux conversion, or should backend routes/admin screens be wired for them?
- **Recommended Default:** **Do not invent new screens or unapproved backend routes** — keep existing `404`-tolerant handling on `needs-review`/`clear-review` and exclude unused `Payouts`/`LogViewer` collections from the UI slice list (`N_ui = 31`).

### Q9. Should the conversion also replace `AuthContext`, `RoleContext`, `NotificationContext`, and `UIContext` completely by final submission?
- **Context (`02-frontend-inventory.md`, `07-conversion-plan.md`):** Contexts can serve as temporary compatibility shims during incremental student PRs (`Phases 1–11`) and be completely deleted in `Phase 12`.
- **Question:** Confirm that in final submission (`Phase 12`), zero `React.createContext` data providers and zero `window.dispatchEvent('teamforge:*')` custom events should remain?
- **Recommended Default:** **Yes — delete all 4 data/UI Contexts, `roleStore.js`, `storage.js`, `apiGetCache`, and all `teamforge:*` DOM events in Phase 12.**
