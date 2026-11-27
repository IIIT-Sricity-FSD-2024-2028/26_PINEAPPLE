# TeamForge Redux Store (`src/store/`)

## Overview & Rules
- Uses **Redux Toolkit** (`createSlice`, `createAsyncThunk`, `createEntityAdapter`, `createSelector`, `createListenerMiddleware`) wrapping `src/services/*Api.js` modules — no RTK Query and no external state/persistence libraries.
- **No browser storage (`localStorage`, `sessionStorage`, `document.cookie`, `indexedDB`)** inside `src/`: all Redux state stays in memory, and user sessions rely solely on the backend's `httpOnly` refresh cookie (`POST /auth/refresh`).
- **Four synchronous CRUD reducers (`setAll`, `addOne`, `updateOne`, `removeOne`)** are exported by every repository slice, with `createAsyncThunk` handlers driving all backend synchronization.
- **Route-leave reset (`Reading B`, `RESET_SCOPE = 'page'`):** [`RouteResetListener`](./components/RouteResetListener.jsx) dispatches `routeChanged` on `location.pathname` transitions. Slices register `addRouteReset(builder, clearWorkingFn)` so transient working state clears on navigation while cached entities, counts, theme, and session stay intact.

---

## Worked example: `projectsSlice`

Use [`projectsSlice.js`](./slices/projectsSlice.js) (owned by Rithvik) as the reference template for Phases 5–11.

1. **Normalized Entities + Server View ID Lists (`projectsSlice.js`):**
   - `projectsAdapter = createEntityAdapter({ selectId: (p) => String(p.id) })` stores deduplicated project records in `ids` and `entities`.
   - Server-driven view order lists stay separate (`marketplaceIds`, `myProjectIds`, `myWorkOngoingIds`, `myWorkCompletedIds`) alongside server summary counts (`summary.myWorkOngoingCount`, `summary.myWorkCompletedCount`, `summary.myProjectsTotalCount`, etc.).
   - Incoming records from different endpoints merge via `mergeUpsertProject` without duplicates and without dropping previously fetched detail fields such as `members` or `deadlineHistory`.

2. **Four Explicit CRUD Reducers + Working State (`projectsSlice.js`):**
   - Exports `setAll`, `addOne`, `updateOne`, `removeOne` directly on `projectsSlice.actions`.
   - `removeOne` removes the entity and purges the project `id` from `marketplaceIds`, `myProjectIds`, `myWorkOngoingIds`, `myWorkCompletedIds`, and auxiliary maps (`tombstoneById`, `deletionChecksById`, `membersByProjectId`).
   - Transient page filters/errors (`searchQuery`, `myProjectsFilter`, `myWorkFilter`, `selectedProjectId`, `selectedTab`, `marketplacePreviewId`, `summaryProjectId`, error banners) live in `working` and register `addRouteReset(builder, clearWorkingProjectsState)`.

3. **Standardized Async Thunks (`src/store/thunks/projectsThunks.js`):**
   - See [`projectsThunks.js`](./thunks/projectsThunks.js):
     - List thunks (`fetchProjects`, `fetchMyProjects`, `fetchMyWork`, `fetchProjectById`) implement `condition` checks (`loading` deduplication and `PROJECTS_STALE_MS` = 60s) with `{ force: true }` override support.
     - Mutations (`createProject`, `updateProject`, `changeProjectDeadline`, `completeProject`, `deleteProject`, `cancelProjectDeletion`, `removeProjectMember`) catch errors with `rejectWithValue(normalizeThunkError(err))`, apply the server response to Redux entities/lists, and refetch authoritative details when the server computes aggregates.

4. **Order-Preserving Selectors (`src/store/selectors/projectsSelectors.js`):**
   - See [`projectsSelectors.js`](./selectors/projectsSelectors.js):
     - `selectMarketplaceProjects`, `selectMyProjects`, `selectMyWorkOngoingProjects`, and `selectMyWorkCompletedProjects` map stored ID lists directly to entities in server order without recomputing backend classifications client-side.

5. **Verification Blueprint (`src/store/__tests__/projectsSliceAndThunks.test.jsx`):**
   - See [`projectsSliceAndThunks.test.jsx`](./__tests__/projectsSliceAndThunks.test.jsx) for unit tests covering the 4 CRUD reducers, duplicate-free entity merging, `pending`/`fulfilled`/`rejected` thunk outcomes, `condition` + `{ force: true }`, route-reset clearing filters while preserving entities, delete purging every view list, and preloaded-store screen tests.
