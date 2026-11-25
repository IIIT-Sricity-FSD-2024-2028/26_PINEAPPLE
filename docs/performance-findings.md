# Performance Findings & Baseline Measurement Report

**Date:** 05 November 2026  
**Environment:**
- **OS:** Windows 11
- **CPU:** Intel(R) Core(TM) Ultra 7 155U (12 cores, 14 logical processors)
- **RAM:** 31.45 GB Total (~16.18 GB Free)
- **Node.js:** v22.16.0 | **npm:** 10.9.2
- **Auth Mode:** `firebase` (with JWT fallback)
- **Mail Mode:** `ethereal`
- **DigiLocker Mode:** `sandbox`
- **In-Memory Data Counts:** Users: 13, Projects: 6, Tasks: 7, Messages: 5, Notifications: 0, Audit Entries: 9, Sessions: 3, XP Ledger Entries: 33.

---

## 1. Baseline Backend Timing (Phase 1 Part A)

All endpoints instrumented via global NestJS `TimingInterceptor` returning `Server-Timing: total;dur=<ms>` and logging under `PERF_LOG=true`. Measured across 3 runs (cold, warm 1, warm 2) using authenticated tokens.

| Rank | Operation / Endpoint | Method | Status | Payload (Bytes) | Cold (ms) | Median (ms) | Worst (ms) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `auth: login` (`/auth/login`) | POST | 200 | 1,298 | 155.49 | 137.99 | 155.49 |
| 2 | `users: public profile` (`/users/1/public-profile`) | GET | 200 | 603 | 5.22 | 5.97 | 7.54 |
| 3 | `auth: refresh` (`/auth/refresh`) | POST | 200 | 1,298 | 5.90 | 5.90 | 6.45 |
| 4 | `gamification: leaderboard alltime` (`/leaderboard?period=alltime`) | GET | 200 | 922 | 5.30 | 5.33 | 6.42 |
| 5 | `projects: get by id` (`/projects/proj-1`) | GET | 200 | 869 | 4.93 | 5.16 | 6.27 |
| 6 | `gamification: leaderboard monthly` (`/leaderboard?period=monthly`) | GET | 200 | 922 | 6.33 | 5.03 | 6.33 |
| 7 | `notifications: communication unread` (`/communication/notifications`) | GET | 200 | 174 | 4.90 | 4.90 | 5.39 |
| 8 | `gamification: user stats` (`/gamification/1/stats`) | GET | 200 | 80 | 6.79 | 4.89 | 6.79 |
| 9 | `projects: list` (`/projects`) | GET | 200 | 4,417 | 4.88 | 4.88 | 4.92 |
| 10 | `mentor applications: list` (`/mentor-applications`) | GET | 200 | 2 | 4.62 | 4.87 | 5.84 |
| 11 | `chat: project messages` (`/communication/messages/project/proj-1`) | GET | 200 | 686 | 6.54 | 4.83 | 6.54 |
| 12 | `auth: me` (`/auth/me`) | GET | 200 | 341 | 5.37 | 4.78 | 5.37 |
| 13 | `gamification: user ledger` (`/gamification/1/ledger`) | GET | 200 | 177 | 5.25 | 4.77 | 5.25 |
| 14 | `admin: audit log` (`/admin/audit`) | GET | 200 | 8,654 | 4.70 | 4.75 | 5.87 |
| 15 | `tasks: by project` (`/tasks/project/proj-1`) | GET | 200 | 1,033 | 4.69 | 4.69 | 5.22 |
| 16 | `mentor marketplace: list mentors` (`/mentor-marketplace/mentors`) | GET | 200 | 1,805 | 4.91 | 4.69 | 4.91 |
| 17 | `join requests: list` (`/join-requests`) | GET | 200 | 2 | 4.81 | 4.68 | 4.81 |
| 18 | `projects: my projects (owner)` (`/projects/owner/1`) | GET | 200 | 1,630 | 4.35 | 4.55 | 4.77 |
| 19 | `mentor marketplace: sessions mine` (`/mentor-marketplace/sessions/mine`) | GET | 200 | 464 | 4.41 | 4.43 | 4.71 |
| 20 | `users: user profile (id)` (`/users/1`) | GET | 200 | 817 | 6.04 | 4.36 | 6.04 |
| 21 | `notifications: list` (`/notifications`) | GET | 200 | 2 | 4.99 | 4.32 | 4.99 |
| 22 | `mentor marketplace: admin stats` (`/mentor-marketplace/sessions/admin-stats`) | GET | 200 | 202 | 4.31 | 4.31 | 4.67 |
| 23 | `mentor marketplace: sessions` (`/mentor-marketplace/sessions`) | GET | 200 | 1,319 | 4.28 | 4.28 | 5.80 |
| 24 | `admin: users list` (`/admin/users`) | GET | 200 | 7,615 | 3.82 | 4.22 | 4.23 |
| 25 | `mentor marketplace: mentor view` (`/mentor-marketplace/sessions/mentor-view`) | GET | 200 | 464 | 4.13 | 4.17 | 4.40 |
| 26 | `escrow: list all` (`/escrow`) | GET | 200 | 761 | 4.35 | 4.07 | 4.35 |
| 27 | `admin: dashboard stats` (`/admin/stats`) | GET | 200 | 367 | 2.53 | 3.26 | 6.09 |
| 28 | `platform: config` (`/admin/config/public`) | GET | 200 | 161 | 3.00 | 3.00 | 4.21 |

---

## 2. Baseline Frontend Metrics (Phase 1 Part B)

### Bundle Sizes (Production Build Baseline)
- **Monolithic JavaScript Bundle:** `dist/assets/index-CIxwhvSc.js` — **857.72 kB** (gzip: **236.59 kB**). Exceeds 500 kB limit warning.
- **Monolithic CSS Bundle:** `dist/assets/index-twyBo3V_.css` — **208.93 kB** (gzip: **33.27 kB**).
- **HTML Shell:** `dist/index.html` — **1.04 kB** (gzip: **0.56 kB**).

### Page Load Profile (Dev Mode vs Production Preview)

| Page | Dev Requests | Dev Data Visible (s) | Prod Requests | Prod Data Visible (s) | Main Bottleneck |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Landing Page** (`/`) | 192 | 1.82 s | 8 | 0.42 s | Monolithic bundle (857 kB), 6 unoptimized hero images (XP-System.png 746 KB) |
| **Login** (`/login`) | 194 | 1.85 s | 8 | 0.44 s | Monolithic bundle download, bcrypt verification (138 ms) |
| **Dashboard** (`/dashboard`) | 204 | 2.30 s | 12 | 0.95 s | Sequential auth waterfall + 4 parallel API fetches + duplicate user fetch |
| **Projects Marketplace** (`/projects`) | 200 | 2.15 s | 10 | 0.88 s | Uncached projects list, duplicate auth sync, unpaginated response |
| **Owner Workspace** (`/owner/workspace/:id`) | 208 | 2.40 s | 11 | 1.05 s | 4 API queries + 3s chat polling loop |
| **Collaborator Workspace** (`/workspace/:id`) | 206 | 2.35 s | 10 | 1.02 s | 3 API queries + 3s chat polling loop without visibility check |
| **Leaderboard** (`/leaderboard`) | 198 | 2.10 s | 9 | 0.82 s | Entire ledger scan per user for period stats; dense ranking recomputed on every call |
| **Notifications** (`/notifications`) | 196 | 1.95 s | 9 | 0.78 s | Duplicate `/notifications` query from NotificationContext and page |
| **Profile** (`/profile`) | 202 | 2.20 s | 10 | 0.92 s | 4 queries (user, stats, ledger, badges) without client caching |
| **Settings** (`/settings`) | 196 | 2.05 s | 8 | 0.81 s | Full profile fetched without client-side stale-while-revalidate |
| **Admin Dashboard** (`/admin`) | 198 | 2.15 s | 9 | 0.85 s | Full unpaginated audit log (8.6 KB) downloaded just to show 5 entries |
| **Admin Users** (`/admin/users`) | 197 | 2.25 s | 8 | 0.88 s | N+1 lookups in `ProjectsService.findByOwnerId` for every user row |
| **Admin Projects** (`/admin/projects`) | 196 | 2.05 s | 8 | 0.80 s | Unpaginated project list |
| **Mentor Revenue** (`/admin/mentor-revenue`) | 199 | 2.20 s | 10 | 0.90 s | 3 unpaginated session/escrow calls with N+1 enrichments |

---

## 3. The 25 Slowest Operations & Root Causes

Ranked by **Impact Score** = $(Time\ Saved \times Number\ of\ Pages\ Affected)$.

| Rank | Operation / Bottleneck | File & Line | Root Cause | Proposed Fix | Expected Gain | Risk |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Monolithic Frontend JS Bundle** (857.72 kB) | `src/routes/AppRoutes.jsx:3-46` | All 40+ route pages statically imported. No route-level code splitting or lazy loading. | Implement `React.lazy()` and `Suspense` with shared `Skeleton` fallback for role-based chunks. | **Main chunk reduced from 857 kB to < 280 kB** (>65% reduction in initial JS). | Low: Standard React pattern. |
| **2** | **CORS Preflight Round-Trips** | `back-end/src/main.ts:68-80` | `Access-Control-Max-Age` header omitted. Browsers execute `OPTIONS` preflight before every mutation or custom header. | Set `maxAge: 86400` (24h) in `app.enableCors()`. | Eliminates ~5-15ms preflight round-trip on every POST/PUT/PATCH/DELETE. | None: Standard CORS config. |
| **3** | **Uncompressed HTTP Responses** | `back-end/src/main.ts:60` | Express `compression()` middleware not registered. Large JSON responses (8.6 KB audit, 7.6 KB users, 4.4 KB projects) sent uncompressed. | Add `compression()` middleware for responses > 1 KB. | **60–80% reduction in transferred payload sizes** across all list endpoints. | Low: Lightweight, standard middleware. |
| **4** | **Uncached Client-Side Data (Refetch on Every Route)** | `src/services/apiClient.js:172-207` | Zero client-side request deduplication or stale-while-revalidate caching. Navigating back and forth re-triggers all API calls. | Implement lightweight in-memory cache with 15-60s TTL and in-flight promise deduplication. | **Zero network round trips** on repeated tab/page visits within TTL. | Low: Invalidate cache on mutations. |
| **5** | **Duplicate User Profile API Calls on Mount** | `src/context/AuthContext.jsx:108`, `src/pages/dashboard.jsx:72` | Both `AuthContext` and `Dashboard` fire concurrent `GET /users/:uid` requests on initial render. | Deduplicate in-flight requests in API client; reuse AuthContext user state where valid. | Saves 1 redundant network call on every dashboard load. | None. |
| **6** | **Full Audit Log Download for 5 Recent Items** | `back-end/src/admin/admin.service.ts:154`, `src/pages/admin/AdminDashboard.jsx:26` | `adminApi.getAuditLog()` fetches entire unpaginated audit log array (8.6 KB) to slice 5 items in React. | Add pagination `limit=5` and `offset` support to `/admin/audit` and `/audit`. | Payload drops from 8.6 KB to < 800 bytes; query time drops. | None: Backward-compatible query params. |
| **7** | **Admin Users N+1 Project Count Scans** | `back-end/src/admin/admin.service.ts:77` | For each user row in `getUsers()`, scans the entire projects repository with `findByOwnerId(u.id)`. | Pre-aggregate project counts once per request using a Map before mapping users. | $O(U \times P) \to O(U + P)$ lookup complexity. | None. |
| **8** | **Unindexed User Repository Lookups** | `back-end/src/users/users.repository.ts:577-614` | `findById`, `findByEmail`, `findByUsername` scan `this.users` array sequentially ($O(N)$). | Maintain internal `Map<string, User>` indexes (`byId`, `byEmail`, `byUsername`) on writes. | Lookups become $O(1)$ constant time. | Low: Keep indexes synced on inserts/updates. |
| **9** | **Unindexed Project Repository Lookups** | `back-end/src/projects/projects.repository.ts:145-151` | `findById` and `findByOwnerId` linearly scan `this.projects` array ($O(N)$). | Maintain `Map<string, Project>` (`byId`) and `Map<string, Set<string>>` (`byOwnerId`) indexes. | Lookups become $O(1)$ / $O(K)$. | Low. |
| **10** | **Unindexed Task Repository Lookups** | `back-end/src/tasks/tasks.repository.ts:60-120` | `findByProjectId` scans all tasks across all projects linearly. | Maintain `Map<string, Task[]>` by `projectId` inside `TasksRepository`. | Lookups become $O(1)$ per project. | Low. |
| **11** | **Leaderboard Full-Ledger Recalculation** | `back-end/src/leaderboard/leaderboard.service.ts:59-120` | On every request, iterates all users, filters all ledger entries for weekly/monthly, and re-sorts all users. | Cache computed period leaderboards; invalidate only upon task approval or ledger writes. | Response time drops from ~5.3ms to < 1ms on warm requests. | Low: Dirty flag on ledger write. |
| **12** | **Admin Stats Full Repository Scans** | `back-end/src/admin/admin.service.ts:465-510` | Computes 15+ filter passes over users, projects, tasks, and audit logs on every dashboard request. | Cache computed `AdminStatsEntity` with dirty flag invalidation on entity mutations. | Drops response time from ~3.3ms to < 0.5ms. | Low. |
| **13** | **Heavy Unoptimized Hero Image** | `public/Assets/XP-System.png`, `src/pages/landingpage.jsx:303` | `XP-System.png` is 746 KB; 6 images loaded on landing page without `loading="lazy"` or explicit dimensions. | Add `loading="lazy"`, explicit dimensions, and compress raster assets. | **Saves > 600 KB transferred** on landing page; prevents layout shift (CLS). | None. |
| **14** | **Render-Blocking Web Font Link** | `index.html:8-9` | External Google Fonts link blocks initial render; missing `preconnect` to `https://fonts.gstatic.com`. | Add `dns-prefetch` & `preconnect` for `gstatic.com`; use `font-display: swap`. | Eliminates ~50–100ms font blocking delay on first paint. | None. |
| **15** | **Aggressive Real-Time Chat Polling** | `src/pages/collaborator/CollaboratorWorkspace.jsx:17` | Polls every 3 seconds continuously, even when browser tab is inactive/hidden. | Increase interval to 5–10s only when chat tab is active; pause on `document.hidden` (`visibilitychange`). | Eliminates hundreds of background HTTP requests per user session. | None. |
| **16** | **Redundant Notifications Query on Window Focus** | `src/context/NotificationContext.jsx:55` | Window focus event immediately triggers full `/notifications` list fetch. | Deduplicate focus triggers with throttle/cache and use unread count where possible. | Eliminates unnecessary spikes of API calls on tab switching. | None. |
| **17** | **Bcrypt Password Hash Verification on Login** | `back-end/src/users/users.service.ts:155` | `bcrypt.compareSync` cost factor 10 takes ~130ms. | Ensure cost factor remains at standard 10 (do not increase); optimize identifier matching to $O(1)$ map lookup. | Stabilizes login at ~120-130ms. | None. |
| **18** | **Firebase Strategy Network Revocation Check** | `back-end/src/auth/strategies/firebase.strategy.ts:44` | In cloud Firebase mode, `checkRevoked=true` calls Google APIs per request. | Rely on standard Firebase token expiration (1 hour) or cache verification results for short TTL. | Avoids 150–400ms external network call to Google. | Medium: Check auth security rules. |
| **19** | **Unpaginated Projects List Payload** | `back-end/src/projects/projects.service.ts:40` | `GET /projects` returns all projects in memory. As data grows, payload increases unbounded. | Add `limit` & `offset` query parameters with defaults (20 items). | Prevents payload explosion as projects grow. | Low: Default returns backward compatible. |
| **20** | **Unpaginated Notifications List Payload** | `back-end/src/notifications/notifications.service.ts:50` | `GET /notifications` returns full history with no cap. | Add pagination (`limit=30`) and cap in-memory retention to latest 5,000 entries. | Prevents memory leaks and heavy list scans. | None. |
| **21** | **Unpaginated Audit Log Retention** | `back-end/src/audit/audit.service.ts:17` | Audit entries stored in unbounded array. | Add retention cap (e.g. latest 5,000 entries) and paginated endpoint. | Bounds memory growth and scan times. | None. |
| **22** | **Mentor Marketplace Sessions Enrichment Scans** | `back-end/src/mentor-marketplace/mentor-marketplace.service.ts:1222` | Scans user and project arrays linearly per session. | Use Map index lookups for user and project resolution during session enrichment. | Reduces session listing duration. | Low. |
| **23** | **Unused Heavy Bundled Dependencies** | `package.json` | Bundling datepicker, QR code generator, and full SVG icon sets into main bundle. | Split into dynamic chunks loaded only on `/owner/workspace` and `/create-project`. | Keeps main bundle well below 300 kB gzipped. | Low. |
| **24** | **Unmemoized Context Values Causing Cascade Re-renders** | `src/context/UIContext.jsx`, `src/context/RoleContext.jsx` | Object literals recreated on every render in context provider values. | Wrap provider values in `useMemo`. | Prevents unnecessary full-app re-renders on minor state shifts. | None. |
| **25** | **Synchronous Storage Parsing in Hot Path** | `src/services/apiClient.js:8-14` | Multiple calls to `localStorage.getItem` and `JSON.parse` during request creation. | Cache resolved API base URL and role in module variables. | Microsecond savings on every client request. | None. |
