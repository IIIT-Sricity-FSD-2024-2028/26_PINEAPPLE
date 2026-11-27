REDUX CONVERSION RULES (apply to every phase; Phase 0 also saves this text to
docs/redux-analysis/09-redux-rules.md)

SPEC (the professor's requirements, quote them in reports when relevant)
1 Have slices. 2 CRUD operations = repositories x 4. 3 Slices based on repositories with CRUD
using reducers. 4 Any data displayed in a component comes from the Redux store. 5 State clears
when moving between components (the professor is not sure). 6 Use THUNK to synchronise front
end and back end. 7 No local storage, state is kept in variables. 8 Stores with slices showing
roles and controllers, CRUD slices, all displayed data from the store. 9 Follow the THUNK
pattern. Use Redux Toolkit (createSlice, createAsyncThunk, createEntityAdapter). No RTK Query,
no redux-persist, no other state or fetching library.

DECISIONS ADOPTED (final unless a later phase prompt says otherwise)
D1 N_ui = 31 UI-consumed collections = 30 domain slices + sessionSlice + uiSlice (use the slice
   names in docs/redux-analysis/01 and 07).
D2 Every domain slice defines the four synchronous CRUD reducers setAll, addOne, updateOne,
   removeOne (explicit named wrappers around createEntityAdapter, so a student can point at each
   one). Thunks exist only for endpoints that really exist in the back end. Never invent routes.
D3 Requirement 5 = Reading B: on every route change clear page working state (filters, search
   text, selected id, open modal flags, errors, temporary chat buffers) and keep entities,
   session, roles and permissions, notifications, theme and the payment idempotency key. Each
   slice handles the shared routeChanged action. The scope is one constant so Reading A (reset a
   whole route group) is a one-line change.
D4 localStorage, sessionStorage, document.cookie and indexedDB are forbidden in src.
D5 The access token and user/admin claims live in memory. Standard users restore their session at startup
   through the httpOnly refresh cookie (`POST /auth/refresh`, `teamforge_refresh_token`), and portal admins /
   super users restore their session at startup on `/admin/*` through the separate httpOnly `SameSite=Strict`
   refresh cookie (`POST /admin/auth/refresh`, `teamforge_admin_refresh_token`, `Path=/admin/auth`), keeping
   admins signed in on the same page across browser refresh without Web Storage.
D6 Local useState is allowed only for keystroke drafts of controlled forms and open/close
   booleans. Every piece of server data, and every value shared between components, is read from
   the store with selectors.
D7 createEntityAdapter is used.
D8 No new screens, no new back end routes. Unwired calls (admin needs-review and clear-review)
   keep their current 404-tolerant handling. Unused controllers (Payouts, LogViewer) are not
   sliced.
D9 The 4 contexts, roleStore.js, storage.js, apiGetCache, the feedbackApi module cache and the
   teamforge:* DOM events are removed in Phase 13. Until then thin compatibility shims (same hook
   names, implemented with useSelector and dispatch) are allowed.

WORKING RULES
- Stay on the Redux-Conversion branch.
- Before editing, read docs/redux-analysis/00, 01, 03, 04, 05, 06, 07 and 09 (whatever exists),
  then the files you will change. Follow the file layout, names and the THUNK pattern in 05.
  If the code differs from the docs, trust the code and say so.
- Reuse the existing *Api.js functions inside thunks. Components never import *Api.js or the API
  client; only thunk files do.
- Slice pattern: createEntityAdapter, the four CRUD reducers, extraReducers for each thunk's
  pending, fulfilled and rejected, status (idle, loading, succeeded, failed) and error fields (the
  error body shape { statusCode, error, code, message } through rejectWithValue), lastFetchedAt
  (ISO string) per list. Writes apply the server response through the CRUD reducers, then refetch
  anything the server derives (progress, XP, escrow totals, counts). Use the thunk condition
  option with lastFetchedAt to replace the old 20 second apiGetCache (allow force: true). Optimistic
  updates apply in pending and roll back in rejected. Only ISO strings and plain data in the store.
- Components: fetch by dispatching thunks in useEffect or event handlers, read with selectors
  (createSelector for derived lists), show loading and error states from the slice. Values the
  server computes (reputation, progress, completed lists, counts) are read from server data, not
  recomputed. Do not change the look, texts or behaviour, except adding loading and error states
  where there were none.
- Preserve everything already built: security and permission checks, 401 and
  SESSION_INVALID handling, ACCOUNT_SUSPENDED screen, Idempotency-Key on payments, polling that
  pauses while the tab is hidden, safe links, the reason modal, one source for reputation, XP and
  notifications. A converted screen must behave exactly as before.
- Each slice registers its working-state reset for the shared routeChanged action (D3) and lists
  which fields clear and which stay.
- Remove the old code of every screen you convert (fetch code, useState copies of server data,
  context reads, storage use, cache use, DOM event listeners for that data). No second source of
  truth. Shrink the allowlists in the Phase 0 scan tests for every file you clean.
- Lint must not exceed the baseline recorded in docs/redux-analysis/08-progress.md; fix lint
  problems in files you touch.
- Tests per phase: reducer tests (all four CRUD reducers per slice, status transitions, working
  state reset), thunk tests with a mocked API (pending, fulfilled, rejected, condition skip,
  force), selector tests, component tests with renderWithStore and a preloaded store (loading,
  error, empty, data, the dispatch on click or submit), the route-leave test, and the scan tests.
  Run the full front end suite and lint. Existing tests that read old sources are updated to the
  store and the change is listed.
- Final report for every phase: the root findings, "Decisions made" (every choice you made on
  your own), slices and reducers and thunks added (counts), files changed grouped by owner
  student (from 07, with a suggested commit message and git add command per student), old code
  removed, tests and lint counts, the shrunken allowlists, anything skipped and why, other
  findings, and git status. Append a short section with the same facts to
  docs/redux-analysis/08-progress.md.
