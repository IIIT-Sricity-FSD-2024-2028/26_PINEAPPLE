# Codebase Cleanup & Route Canonicalization Log

## Overview
This log documents the comprehensive audit and safe removal of duplicate, unstructured, and leftover legacy artifacts from the TeamForge platform, executed in accordance with structured role conventions and zero-regression behavioral guarantees.

---

## 1. Phase 1: Duplicate Route Canonicalization
In `AppRoutes.jsx`, legacy and duplicate route aliases pointing to the same components were canonicalized into the app's structured role-prefixed convention (`/owner/...`, `/mentor/...`, `/admin/...`).

| Legacy Path (Removed) | Canonical Path (Retained) | Rendered Component | Route Guard | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `/mentors` (redirect) | `/owner/mentors` | `MentorsDirectory` | `OwnerProtectedRoute` | Old global redirect removed; canonical role-prefixed owner route preserved. |
| `/mentor-application` | `/mentor/apply` | `MentorApplication` | `ProtectedRoute` | Unstructured dash path removed; canonical slash-structured path preserved for pending/new applicants. |
| `/mentored-projects` | `/mentor/projects` | `MentoredProjects` | `MentorProtectedRoute` | Unstructured dash path removed; canonical `/mentor/...` path preserved. |
| `/mentor-requests` | `/mentor/requests` | `MentorRequests` | `MentorProtectedRoute` | Unstructured dash path removed; canonical `/mentor/...` path preserved. |
| `/mentor-earnings` | `/mentor/earnings` | `MentorEarnings` | `MentorProtectedRoute` | Unstructured dash path removed; canonical `/mentor/...` path preserved. |
| `/mentor-profile` | `/mentor/profile` | `MyMentorProfile` | `MentorProtectedRoute` | Unstructured dash path removed; canonical `/mentor/...` path preserved. |

### Additional Safeguards Added:
1. **Global 404 Catch-All**:
   - Created `src/pages/NotFound.jsx` rendering a styled "Page Not Found" screen with a home redirect link.
   - Added `<Route path="*" element={<NotFound />} />` to catch unmatched or obsolete paths cleanly.
2. **Session Storage State Normalization**:
   - Embedded `LEGACY_PATH_MAP` migration inside `AppRoutes.jsx` to map any stored `teamforge.viewState` or `teamforge.lastPath` to their canonical counterparts upon application mount.

---

## 2. Phase 2: Unstructured Leftovers Audit & Removals

### A. Frontend Removals (Proven Unused / Pure Duplicates)
1. **`React-Implementation/.../src/App.css`** (0 bytes)
   - *Status:* REMOVED.
   - *Evidence:* Completely empty file. Not imported anywhere.
2. **`React-Implementation/.../src/pages/theme.css`** (1,093 lines)
   - *Status:* REMOVED.
   - *Evidence:* Leftover stylesheet from legacy vanilla frontend (`front-end/theme.css`). Unimported by any component or stylesheet. Its theme tokens and glassmorphism rules are fully incorporated into `src/index.css`.
3. **`React-Implementation/.../src/pages/collaborator/CollaboratorDashboard.jsx`** (174 lines)
   - *Status:* REMOVED.
   - *Evidence:* Early prototype dashboard; never registered in `AppRoutes.jsx`, sidebar, or navbar. The canonical collaborator dashboard is `src/pages/dashboard.jsx`.
4. **`React-Implementation/.../src/components/common/TagInput.jsx` & `TagInput.css`** (160 lines total)
   - *Status:* REMOVED.
   - *Evidence:* Unimported component. Skill and tag inputs in forms throughout the application use custom badge pills and `FormInput`.
5. **`React-Implementation/.../src/utils/projectStatus.js`** (18 lines)
   - *Status:* REMOVED.
   - *Evidence:* Duplicate implementations of `isProjectLocked` and `isProjectActive`. Unimported; all components import the canonical implementations from `src/services/projectsApi.js`.
6. **`React-Implementation/.../src/assets/` (`hero.png`, `react.svg`, `vite.svg`)**
   - *Status:* REMOVED.
   - *Evidence:* Vite starter template placeholder assets and unused static graphic; zero references in codebase.

### B. Backend Removals (Proven Unused / Unregistered)
1. **`back-end/src/analytics/` (`analytics.controller.ts`, `analytics.service.ts`, `analytics.module.ts`)**
   - *Status:* REMOVED.
   - *Evidence:* Controller was never registered in `AppModule.imports`, had hardcoded dummy return data, zero frontend callers, and zero references across tests.
2. **`back-end/src/broadcast/` (`broadcast.service.ts`, `broadcast.module.ts`)**
   - *Status:* REMOVED.
   - *Evidence:* Unregistered in `AppModule.imports`, zero callers.
3. **`back-end/src/app.service.ts`**
   - *Status:* REMOVED.
   - *Evidence:* Unregistered in `AppModule.providers`, unreferenced by `AppController` or any other module.
4. **`back-end/src/auth/guards/firebase-auth.guard.ts`**
   - *Status:* REMOVED.
   - *Evidence:* An unused 8-line alias file (`export const FirebaseAuthGuard = AuthGuard;`) that was never imported.
5. **`back-end/src/config/validation.config.ts`**
   - *Status:* REMOVED.
   - *Evidence:* Helper function `getValidationPipeConfig()` inlined into `main.ts` with zero callers.
6. **`back-end/src/config/swagger.config.ts` & `back-end/src/common/utils/swagger-export.util.ts`**
   - *Status:* REMOVED.
   - *Evidence:* Standalone Swagger helpers superseded by `src/swagger.ts` and inlined setup in `main.ts`.

---

## 3. Items Kept for Decision / Retained with Evidence

| Item / Path | Status | Evidence & Reason for Retention |
| :--- | :--- | :--- |
| `back-end/src/swagger.ts` | **KEPT** | Entry point for the `"generate:swagger"` script declared in `back-end/package.json`. |
| `back-end/src/users/entities/user.entity.ts` | **KEPT** | OpenAPI / Swagger schema definition classes decorated with `@ApiProperty` and `@ApiPropertyOptional`. Actively updated with phone verification schema. |
| `back-end/src/projects/entities/project.entity.ts` | **KEPT** | OpenAPI / Swagger schema definition classes for project payload schemas. |
| `back-end/src/tasks/entities/task.entity.ts` | **KEPT** | OpenAPI / Swagger schema definition classes for task payload schemas. |
| `@nestjs/schedule` (Dependency) | **KEPT** | Actively imported by `ScheduleModule` in `core.module.ts`, `gamification.module.ts`, and `@Interval` in `log-manager.service.ts`. |
| `firebase`, `react`, `react-dom`, `react-router-dom` | **KEPT** | Core runtime dependencies in `React-Implementation/package.json`. |

---

## 4. Verification & Integrity Summary
1. **Type Checking & Linting**:
   - Backend `npx tsc --noEmit`: PASS (0 errors, 0 warnings).
   - Frontend `npm run lint`: PASS (0 errors, 0 warnings).
   - Frontend `npm run build`: PASS (0 errors, 186 modules transformed, JS bundle 855.38 kB).
2. **Reachability Analysis**:
   - Frontend: 152 / 152 active files reached (100% active graph from `main.jsx` and `AppRoutes.jsx`).
   - Backend: 164 / 164 active files reached (100% active graph from `main.ts` and `app.module.ts`).
3. **End-to-End Live Verification**:
   - Automated 16-check smoke test (`scratch/smoke_test_e2e.js`) PASSED across fresh Owner, Collaborator, and Mentor accounts.
