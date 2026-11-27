# Step 5: Standardized Redux Toolkit Thunk & Slice Pattern

> **Governing Requirements:**
> - **Req 3:** *"Create slices based on repositories and have CRUD operations using reducers."*
> - **Req 6 & 9:** *"Use THUNK to synchronise between front end and back end"* / *"Follow the THUNK pattern."*
> - **Constraint:** Use **Redux Toolkit** (`createSlice`, `createAsyncThunk`, `createEntityAdapter`, `createSelector`, `createListenerMiddleware`) wrapping existing `src/services/*Api.js` functions — **NO RTK Query or external fetching libraries**.

---

## 1. Shared Pattern Rules Across Every Repository Slice

### 1A. File Naming & Export Layout
- **Slice + Reducers:** `src/store/slices/<repo>Slice.js` — exports `default reducer`, synchronous CRUD actions (`setAll`, `addOne`, `updateOne`, `removeOne`), working-state helpers (`clearWorkingState`, `resetSlice`), and entity adapter selectors.
- **Thunks:** `src/store/thunks/<domain>Thunks.js` — exports `createAsyncThunk` functions using verbs (`fetch<EntityPlural>`, `fetch<Entity>ById`, `create<Entity>`, `update<Entity>`, `delete<Entity>`, plus named domain mutations like `completeProject`, `reviewTask`).
- **Selectors:** `src/store/selectors/<repo>Selectors.js` — memoized `createSelector` views.
- **Transport Reuse:** Every thunk delegates HTTP work directly to existing `src/services/*Api.js` functions (removing their `window.dispatchEvent(new CustomEvent('teamforge:*'))` side effects and `apiGetCache` bypasses during migration).

### 1B. Standard `*Api.js` Reuse & Missing Wrapper Inventory
Most endpoints already exist cleanly in `src/services/*Api.js`. Known mismatches/missing wrappers that must NOT be invented unless backend exposes routes:
1. **`adminApi.js` dead calls:** `getNeedsReviewSessions()` (`GET /admin/mentor-sessions/needs-review`) and `clearSessionReview()` (`POST /admin/mentor-sessions/:id/clear-review`) call routes missing from `AdminController` (only service method `MentorMarketplaceService.clearSessionReview` exists at `mentor-marketplace.service.ts:4677`). Keep disabled/guarded or add BE controller route explicitly before binding UI.
2. **Unused BE routes (no `*Api.js` wrapper):** `GET /payouts/transactions` (`PayoutsController`), `GET /logs/requests` & `GET /logs/errors` (`LogViewerController`), `POST /users` & `DELETE /users/:id` (`UsersController` superuser CRUD), `GET /tasks/:id` vs global `GET /tasks` (global task list intentionally omitted by BE).
3. **`leaderboardApi.js` vs `gamificationApi.js`:** `leaderboardApi.getLeaderboard` calls `GET /leaderboard`; `gamificationApi.js:getLeaderboard` & `getUserStats` exist in file (`gamificationApi.js:9-36`) but have zero UI callers.

### 1C. Error Serialization (`rejectWithValue`) Matching Real Backend Error Shape
Verified from `back-end/src/common/filters/http-exception.filter.ts:185-209`, every backend error returns:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "DUE_DATE_AFTER_PROJECT",
  "message": "...",
  "timestamp": "2026-...",
  "path": "/tasks",
  "correlationId": "..."
}
```
Plus optional forwarded metadata (`suspensionType`, `reason`, `appealAvailable`, `minProjectDueDate`, `currentProjectDueDate`, `newDueDate`, `reviewCreditMs`, `field`).

All thunks normalize caught errors via a shared helper `src/store/utils/thunkError.js`:
```js
export function normalizeThunkError(err) {
  const payload = err?.data || err?.response?.data || err || {};
  return {
    statusCode: err?.statusCode ?? payload?.statusCode ?? 0,
    error: payload?.error ?? 'Error',
    code: err?.code ?? payload?.code ?? 'UNKNOWN_ERROR',
    message:
      err?.serverMessage ||
      (Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message) ||
      err?.message ||
      'Request failed.',
    field: err?.field ?? payload?.field ?? null,
    details: payload?.details ?? null,
  };
}
```
And every async thunk calls `return rejectWithValue(normalizeThunkError(err))`.

### 1D. Slice Status & CRUD Reducers Convention (Satisfying Reqs 2, 3, 6 & 9)
Every repository slice uses `createEntityAdapter` plus structured lifecycle fields:
- **Normalized entities:** `ids: []`, `entities: {}`
- **Status per CRUD category:**
  - `fetchStatus`: `'idle' | 'loading' | 'succeeded' | 'failed'` (and optional `byIdStatus: Record<id, status>`)
  - `createStatus`, `updateStatus`, `deleteStatus`: `'idle' | 'loading' | 'succeeded' | 'failed'`
  - `error`: `{ statusCode, error, code, message } | null`
  - `lastFetchedAt`: ISO timestamp string or `null`
- **Four Synchronous CRUD Reducers (`slice.actions`)** on every repository slice:
  1. `setAll(state, action)` -> replaces entity collection (`adapter.setAll(state, action.payload)`) — **Read/Sync reducer**
  2. `addOne(state, action)` -> inserts entity (`adapter.addOne(state, action.payload)`) — **Create reducer**
  3. `updateOne(state, action)` -> patches `{ id, changes }` (`adapter.updateOne` / `upsertOne`) — **Update reducer**
  4. `removeOne(state, action)` -> removes entity by ID (`adapter.removeOne(state, action.payload)`) — **Delete reducer**
  *(Plus working-state cleanup reducers: `clearWorkingState(state)` and `resetSlice() -> initialState`.)*
- **Wiring Thunks to Reducers in `extraReducers`:** Each `createAsyncThunk` (`fetch*`, `create*`, `update*`, `delete*`) calls the **exact same adapter/CRUD logic** on `.fulfilled`, ensuring both direct CRUD reducers and async thunks share one state transition path. *(Append-only slices like `auditLogs`, `reputationEntries`, `reports`, `jobRuns` still expose all 4 synchronous reducers for Req 2/3 unit-test symmetry while exposing async thunks ONLY for existing HTTP endpoints!)*

### 1E. Store <-> Backend Synchronization After Writes
1. **Direct Response Reconciliation:** When `POST`/`PATCH`/`PUT` returns the updated entity (e.g. `createProject`, `updateTask`, `respondJoinRequest`, `updateAdminTicket`), `.fulfilled` immediately upserts that entity into the slice (`adapter.upsertOne`).
2. **Cascading Server-Derived Refetches:** When a mutation updates aggregates on the server across repositories (verified examples in TeamForge):
   - Approving a task (`tasksThunks/reviewTask` approve) changes backend **`project.progress`**, **`user.xp`**, **`user.reputation`**, and closes completion eligibility -> thunk listener (or thunk body) dispatches `fetchProjectById(projectId)` and `fetchMe()`.
   - Booking / confirming / cancelling / disputing a mentor session updates **`mentorSessions`**, **`escrowAccounts`**, **`mentorProfiles.activeMenteesCount`**, and **`mentoredProjects`** -> dispatches `fetchMySessions()` and admin `fetchDisputes()`/`reconcileEscrow()`.
   - Approving a join request / member leave / member removal updates **`project.collaborators`**, **`tasks`**, and sibling requests -> dispatches `fetchProjectById(projectId)` + `fetchProjectTasks(projectId)`.
   - Deciding an appeal or actioning a report updates **`warnings`**, **`reports`**, and **`openReportsCount`** -> dispatches `fetchOpenReportsCount()` / `fetchAdminWarnings()`.
   - Issuing a badge updates **`recommendationBadges`** and profile counts.

### 1F. Cross-Cutting Mechanics Inside Thunk Architecture

| Concern | How It Fits the Thunk Pattern | Replaces Today's Mechanism |
|---|---|---|
| **Idempotency Keys (`MentorsDirectory` payments)** | When booking a session enters payment step, `mentorSessionsSlice` stores `activeCheckout = { sessionId, paymentIntent, idempotencyKey: crypto.randomUUID(), startedAtIso }`. `confirmPaymentThunk` & `paySessionThunk` read `getState().mentorSessions.activeCheckout.idempotencyKey` and pass `{ headers: { 'Idempotency-Key': key } }`. Key is cleared ONLY on `.fulfilled` or `cancelPayment`. | Component `useState('')` `idempotencyKey` in `MentorsDirectory.jsx:146` |
| **`401 SESSION_INVALID`, `403 ACCOUNT_SUSPENDED`, `503 MAINTENANCE`** | HTTP transport (`apiClient`) notifies registered store dispatch hook (injected at startup in `store/setupInterceptors.js` to avoid circular imports): `401 SESSION_INVALID` dispatches `sessionInvalidated({ message })` which wipes auth & domain slices; `403 ACCOUNT_SUSPENDED` dispatches `accountSuspended(errData)` & routes to `/suspended`; `503 MAINTENANCE_MODE` dispatches `setMaintenanceMode({ active: true, message })`. | `window.dispatchEvent(new CustomEvent('teamforge:*'))` & `sessionStorage` `'teamforge_suspended_info'` |
| **Visibility-Aware Polling & Cleanup** | `useVisibilityPoll(callback, ms, opts)` stays as a timer hook calling `dispatch(fetchThunk(...))`. Inside `createAsyncThunk(..., { condition })`, skip dispatch if `status === 'loading'` or `document.hidden` or `authStatus !== 'authenticated'`. Hook `useEffect` cleanup calls `clearInterval` on route unmount OR logout (`!isAuthenticated`). | Polling + `teamforge:stop_polls` custom event + raw `setInterval` in `dashboard.jsx:170` |
| **Optimistic Updates (with Rollback)** | Used specifically for fast UI toggles like `notificationsThunks/markNotificationRead(id)`: in `.pending`, snapshot previous `item.isRead`/`readStatus` into `state.optimisticSnapshots[meta.requestId]` and flip `isRead = true` immediately; `.fulfilled` removes snapshot; `.rejected` restores original `isRead`/`readStatus` and sets `error` toast. | `NotificationContext.jsx:109-118` (which never rolled back on error!) |
| **Request Deduplication (Replacing `apiGetCache`)** | Remove `apiGetCache` (20s non-Redux cache in `apiClient.js:284`). Prevent duplicate fetches on mount using RTK `createAsyncThunk` `condition(arg, { getState })`: return `false` if already `'loading'` or (under Reading B) fresh within `STALE_MS` unless `{ force: true }`. | Non-Redux `apiGetCache` & `feedbackApi.cachedReasonsConfig` |

### 1G. Serializability & Derived Data Rules
1. **Strict Redux Serializability (`serializableCheck: true`):**
   - Store **ISO-8601 strings** (e.g., `createdAt: '2026-11-25T10:00:00.000Z'`) or integer epoch ms (`expiresAtMs`) — **never `Date` objects**. Convert `new Date(iso)` inside UI components or selectors at render time.
   - Store **`string[]` or `Record<string, true>`** instead of `new Set()` (`ChatBox.jsx:79` `reportedIds`, `MentorProjectWorkspace.jsx:60` `awardedMembers`, `notifications.jsx:59-60` `expandedDigestIds` / `expandedGroupIds`) and **`Record<id, entity>`** instead of `new Map()`.
   - **Never store `File` or `Blob`** in Redux (`MentorApplication.jsx`, `settings.jsx` file inputs, CSV/CV downloads): hold `File` in component ref/local input until upload thunk finishes and stores returned `{ avatarUrl }` or `{ cvFileName, cvUrl }` string fields.
2. **Server-Computed Truth (`createSelector` Rule):**
   - Selectors may filter, sort, group, or combine Redux entities (`selectProjectTasks`, `selectUnreadNotificationsCount`, `selectOwnedProjects`).
   - Selectors must **NEVER recompute** backend-owned metrics: read `project.progress`, `user.xp`, `user.reputation`, `user.trustScore`, `user.trustLabel`, `project.completedAt`, `mentorProfile.activeMenteesCount`, `mentorProfile.rating`, `adminStats.*`, and `completed` lists directly from server payloads!

### 1H. Loading & Error UI Conventions
- Initial list load: render skeleton/spinner when `fetchStatus === 'loading' && entities.length === 0`.
- Background refresh / poll: keep existing entities visible while `fetchStatus === 'loading'` (no flicker on 6s chat or 12s dashboard polls!).
- Mutation buttons (`Save`, `Approve`, `Pay`, `Delete`): disable when matching operation status is `'loading'` and show inline spinner.
- Errors: display normalized `error.message`; handle typed codes (`EMAIL_NOT_VERIFIED`, `PROFILE_INCOMPLETE`, `PROJECT_LOCKED`, `DUE_DATE_AFTER_PROJECT`, `REASON_REQUIRED`, `REQUEST_LIMIT_REACHED`, `USERNAME_TAKEN`) consistently in components.

---

## 2. Worked Illustrative Example: `projects` Repository Slice

> **ILLUSTRATIVE EXAMPLE ONLY** — Based on `ProjectsRepository` (`back-end/src/projects/projects.repository.ts`), `ProjectsController` (`back-end/src/projects/projects.controller.ts`), and `React-Implementation/React-Implementation/src/services/projectsApi.js`. Do NOT commit verbatim without project integration.

### 2A. Thunks (`src/store/thunks/projectsThunks.js` — Illustrative Example)
```js
import { createAsyncThunk } from '@reduxjs/toolkit';
import projectsApi from '../../services/projectsApi';
import { normalizeThunkError } from '../utils/thunkError';

export const fetchProjects = createAsyncThunk(
  'projects/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await projectsApi.list(params);
      return Array.isArray(data) ? data : data?.projects || data?.items || [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (params, { getState }) => {
      if (params?.force) return true;
      const { fetchStatus } = getState().projects;
      return fetchStatus !== 'loading';
    },
  },
);

export const fetchProjectById = createAsyncThunk(
  'projects/fetchById',
  async (projectId, { rejectWithValue }) => {
    try {
      return await projectsApi.get(projectId);
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const createProject = createAsyncThunk(
  'projects/create',
  async ({ payload, userId }, { rejectWithValue }) => {
    try {
      return await projectsApi.create(payload, 'Project Owner', userId);
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const updateProject = createAsyncThunk(
  'projects/update',
  async ({ projectId, payload }, { rejectWithValue }) => {
    try {
      return await projectsApi.update(projectId, payload);
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const deleteProject = createAsyncThunk(
  'projects/delete',
  async ({ projectId, payload }, { dispatch, rejectWithValue }) => {
    try {
      const res = await projectsApi.softDelete(projectId, payload);
      // Sync updated scheduled deletion / tombstone state from server
      await dispatch(fetchProjectById(projectId));
      return { id: String(projectId), response: res };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
```

### 2B. Slice with Sync CRUD Reducers & `extraReducers` (`src/store/slices/projectsSlice.js` — Illustrative Example)
```js
import { createSlice, createEntityAdapter } from '@reduxjs/toolkit';
import {
  fetchProjects,
  fetchProjectById,
  createProject,
  updateProject,
  deleteProject,
} from '../thunks/projectsThunks';
import { routeChanged, sessionReset } from '../actions/appActions';

const projectsAdapter = createEntityAdapter({
  selectId: (project) => String(project.id),
  sortComparer: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
});

const initialWorkingState = {
  selectedProjectId: null,
  searchQuery: '',
  statusFilter: 'all',
  deletionCheckById: {},
  skillMatchById: {},
  tombstoneError: null,
};

const initialState = projectsAdapter.getInitialState({
  fetchStatus: 'idle',
  byIdStatus: {},
  createStatus: 'idle',
  updateStatus: 'idle',
  deleteStatus: 'idle',
  error: null,
  lastFetchedAt: null,
  working: initialWorkingState,
});

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    // ── Required 4 Synchronous CRUD Reducers (Req 2 & 3) ───────────────
    setAll(state, action) {
      projectsAdapter.setAll(state, action.payload || []);
    },
    addOne(state, action) {
      if (action.payload) projectsAdapter.addOne(state, action.payload);
    },
    updateOne(state, action) {
      if (action.payload?.id) {
        projectsAdapter.updateOne(state, {
          id: String(action.payload.id),
          changes: action.payload.changes ?? action.payload,
        });
      }
    },
    removeOne(state, action) {
      if (action.payload) projectsAdapter.removeOne(state, String(action.payload));
    },

    // ── Working UI State & Navigation Cleanup (Req 5) ──────────────────
    setSelectedProjectId(state, action) {
      state.working.selectedProjectId = action.payload ? String(action.payload) : null;
    },
    setProjectFilter(state, action) {
      const { searchQuery, statusFilter } = action.payload || {};
      if (searchQuery !== undefined) state.working.searchQuery = searchQuery;
      if (statusFilter !== undefined) state.working.statusFilter = statusFilter;
    },
    clearWorkingState(state) {
      state.working = initialWorkingState;
      state.createStatus = 'idle';
      state.updateStatus = 'idle';
      state.deleteStatus = 'idle';
      state.error = null;
    },
    resetSlice() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      // Read List
      .addCase(fetchProjects.pending, (state) => {
        state.fetchStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
        projectsAdapter.setAll(state, action.payload);
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.error = action.payload;
      })
      // Read Single
      .addCase(fetchProjectById.pending, (state, action) => {
        state.byIdStatus[String(action.meta.arg)] = 'loading';
      })
      .addCase(fetchProjectById.fulfilled, (state, action) => {
        const p = action.payload;
        if (p?.id) {
          state.byIdStatus[String(p.id)] = 'succeeded';
          projectsAdapter.upsertOne(state, p);
        }
      })
      .addCase(fetchProjectById.rejected, (state, action) => {
        state.byIdStatus[String(action.meta.arg)] = 'failed';
        if ([404, 410].includes(action.payload?.statusCode)) {
          state.working.tombstoneError = action.payload;
        }
        state.error = action.payload;
      })
      // Create
      .addCase(createProject.pending, (state) => {
        state.createStatus = 'loading';
        state.error = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        if (action.payload?.id) projectsAdapter.addOne(state, action.payload);
      })
      .addCase(createProject.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.error = action.payload;
      })
      // Update
      .addCase(updateProject.pending, (state) => {
        state.updateStatus = 'loading';
        state.error = null;
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        if (action.payload?.id) projectsAdapter.upsertOne(state, action.payload);
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.error = action.payload;
      })
      // Delete (Soft / Scheduled)
      .addCase(deleteProject.pending, (state) => {
        state.deleteStatus = 'loading';
        state.error = null;
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        if (action.payload?.response?.deletedImmediately) {
          projectsAdapter.removeOne(state, action.payload.id);
        }
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.error = action.payload;
      })
      // Global Navigation & Logout Resets
      .addCase(routeChanged, (state) => {
        state.working = initialWorkingState;
        state.error = null;
      })
      .addCase(sessionReset, () => initialState);
  },
});

export const projectsSelectors = projectsAdapter.getSelectors((state) => state.projects);
export const { setAll, addOne, updateOne, removeOne, clearWorkingState, resetSlice } =
  projectsSlice.actions;
export default projectsSlice.reducer;
```

### 2C. Memoized Selectors (`src/store/selectors/projectsSelectors.js` — Illustrative Example)
```js
import { createSelector } from '@reduxjs/toolkit';
import { projectsSelectors } from '../slices/projectsSlice';

export const selectAllProjects = projectsSelectors.selectAll;
export const selectProjectById = (id) => (state) =>
  projectsSelectors.selectById(state, String(id));

export const selectOwnedProjects = createSelector(
  [selectAllProjects, (state) => state.session.user?.id],
  (projects, userId) =>
    userId ? projects.filter((p) => String(p.ownerId) === String(userId)) : [],
);

// Server-derived field rule: progress, completedAt, and status are READ directly from project, never recomputed
export const selectFilteredOwnedProjects = createSelector(
  [selectOwnedProjects, (state) => state.projects.working.statusFilter],
  (owned, filter) => {
    if (filter === 'all') return owned;
    return owned.filter((p) => String(p.status || '').toLowerCase() === filter);
  },
);
```
