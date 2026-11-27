import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import { reportChatMessage } from '../thunks/communicationThunks';
import {
  actionAdminReport,
  createUserReport,
  fetchAdminReportDetails,
  fetchAdminReports,
  fetchMyReports,
  fetchOpenReportsCount,
  fetchOwnerPatterns,
  updateAdminReportStatus,
} from '../thunks/reportsThunks';

function deriveReportId(report) {
  return String(report?.id || '');
}

/**
 * Reports Repository Slice (`reportsSlice`)
 * =========================================
 * Mirrors `ReportsService.reports` (including user `My reports`, chat reports,
 * admin reports queue, owner patterns, and shared navbar/dashboard `openCount`).
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`reportFilter`, `reportSearch`,
 *   `selectedReportId`, `selectedReportDetail`, `detailLoading`, `detailError`,
 *   `updatingStatus`, `actionSubmitting`, `actionError`, `submitSubmitting`,
 *   `submitError`, `submitSuccess`, `emailNotVerified`).
 * - STAYS across `routeChanged`: `entities`, `myReportIds`, `adminReportIds`,
 *   `openCount` (AdminLayout sidebar badge + AdminDashboard), and `ownerPatterns`.
 * - Full reset on `sessionReset`.
 */
export const reportsAdapter = createEntityAdapter({
  selectId: deriveReportId,
});

export function createInitialReportsWorking() {
  return {
    reportFilter: 'all',
    reportSearch: '',
    selectedReportId: null,
    selectedReportDetail: null,
    detailLoading: false,
    detailError: '',
    updatingStatus: false,
    actionSubmitting: false,
    actionError: '',
    submitSubmitting: false,
    submitError: '',
    submitSuccess: '',
    emailNotVerified: false,
  };
}

export function createInitialReportsState() {
  return reportsAdapter.getInitialState({
    myReportIds: [],
    myReportsStatus: 'idle',
    adminReportIds: [],
    adminReportsStatus: 'idle',
    openCount: 0,
    ownerPatterns: [],
    ownerPatternsStatus: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialReportsWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!Array.isArray(state.myReportIds)) state.myReportIds = [];
  if (!Array.isArray(state.adminReportIds)) state.adminReportIds = [];
  if (!Array.isArray(state.ownerPatterns)) state.ownerPatterns = [];
  if (!state.working) state.working = createInitialReportsWorking();
}

function clearWorkingReportsState(state) {
  ensureSubstates(state);
  state.working = createInitialReportsWorking();
  state.error = null;
}

const reportsSlice = createSlice({
  name: 'reports',
  initialState: createInitialReportsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload) ? action.payload : [];
      reportsAdapter.setAll(state, items);
      state.adminReportIds = items.map(deriveReportId).filter(Boolean);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      const rid = deriveReportId(action.payload);
      if (!rid) return;
      reportsAdapter.addOne(state, action.payload);
      if (!state.adminReportIds.includes(rid)) {
        state.adminReportIds.unshift(rid);
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      reportsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const rid = String(action.payload);
      reportsAdapter.removeOne(state, rid);
      state.myReportIds = state.myReportIds.filter((id) => id !== rid);
      state.adminReportIds = state.adminReportIds.filter((id) => id !== rid);
    },

    // ── Volatile Working State Reducers ──
    setReportFilter: (state, action) => {
      ensureSubstates(state);
      state.working.reportFilter = action.payload || 'all';
    },
    setReportSearch: (state, action) => {
      ensureSubstates(state);
      state.working.reportSearch =
        typeof action.payload === 'string' ? action.payload : '';
    },
    closeReportDetail: (state) => {
      ensureSubstates(state);
      state.working.selectedReportId = null;
      state.working.selectedReportDetail = null;
      state.working.detailError = '';
      state.working.detailLoading = false;
    },
    clearReportSubmitFeedback: (state) => {
      ensureSubstates(state);
      state.working.submitError = '';
      state.working.submitSuccess = '';
      state.working.emailNotVerified = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createUserReport.pending, (state) => {
        ensureSubstates(state);
        state.working.submitSubmitting = true;
        state.working.submitError = '';
        state.working.submitSuccess = '';
        state.working.emailNotVerified = false;
      })
      .addCase(createUserReport.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.submitSubmitting = false;
        state.working.submitSuccess =
          'Thank you. Your report has been submitted and will be reviewed by an administrator.';
        const created = action.payload;
        const rid = deriveReportId(created);
        if (rid) {
          reportsAdapter.upsertOne(state, created);
          if (!state.myReportIds.includes(rid)) {
            state.myReportIds.unshift(rid);
          }
        }
      })
      .addCase(createUserReport.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.submitSubmitting = false;
        const err = action.payload || {};
        const msg =
          err.serverMessage ||
          err.message ||
          action.error?.message ||
          'Failed to submit report. Please try again.';
        if (
          err.code === 'EMAIL_NOT_VERIFIED' ||
          /verify your email/i.test(String(msg))
        ) {
          state.working.emailNotVerified = true;
        }
        state.working.submitError = msg;
      })

      // Sync chat reports created in Communication view into My Reports store
      .addCase(reportChatMessage.fulfilled, (state, action) => {
        ensureSubstates(state);
        const created = action.payload?.report;
        const rid = deriveReportId(created);
        if (rid) {
          reportsAdapter.upsertOne(state, created);
          if (!state.myReportIds.includes(rid)) {
            state.myReportIds.unshift(rid);
          }
        }
      })

      .addCase(fetchMyReports.pending, (state) => {
        ensureSubstates(state);
        state.myReportsStatus = 'loading';
      })
      .addCase(fetchMyReports.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = (Array.isArray(action.payload) ? action.payload : []).filter(
          (r) => deriveReportId(r),
        );
        reportsAdapter.upsertMany(state, list);
        state.myReportIds = list.map(deriveReportId);
        state.myReportsStatus = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchMyReports.rejected, (state, action) => {
        ensureSubstates(state);
        state.myReportsStatus = 'failed';
        state.error = action.payload || { message: action.error?.message };
      })

      .addCase(fetchOpenReportsCount.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.openCount =
          typeof action.payload === 'number' ? action.payload : 0;
      })

      .addCase(fetchAdminReports.pending, (state) => {
        ensureSubstates(state);
        state.adminReportsStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchAdminReports.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = (Array.isArray(action.payload) ? action.payload : []).filter(
          (r) => deriveReportId(r),
        );
        reportsAdapter.upsertMany(state, list);
        state.adminReportIds = list.map(deriveReportId);
        state.adminReportsStatus = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchAdminReports.rejected, (state, action) => {
        ensureSubstates(state);
        state.adminReportsStatus = 'failed';
        state.error = action.payload || { message: action.error?.message };
      })

      .addCase(fetchAdminReportDetails.pending, (state, action) => {
        ensureSubstates(state);
        state.working.selectedReportId = String(action.meta.arg);
        state.working.detailLoading = true;
        state.working.detailError = '';
      })
      .addCase(fetchAdminReportDetails.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.detailLoading = false;
        const data = action.payload;
        if (data && deriveReportId(data)) {
          reportsAdapter.upsertOne(state, data);
          state.working.selectedReportId = deriveReportId(data);
          state.working.selectedReportDetail = data;
        }
      })
      .addCase(fetchAdminReportDetails.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.detailLoading = false;
        state.working.detailError =
          action.payload?.message ||
          action.error?.message ||
          'Failed to load report details';
      })

      .addCase(updateAdminReportStatus.pending, (state) => {
        ensureSubstates(state);
        state.working.updatingStatus = true;
        state.working.detailError = '';
      })
      .addCase(updateAdminReportStatus.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.updatingStatus = false;
        const { reportId, report } = action.payload || {};
        if (report && deriveReportId(report)) {
          reportsAdapter.upsertOne(state, report);
          if (String(state.working.selectedReportId) === String(reportId)) {
            state.working.selectedReportDetail = report;
          }
        }
      })
      .addCase(updateAdminReportStatus.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.updatingStatus = false;
        state.working.detailError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to update report status';
      })

      .addCase(actionAdminReport.pending, (state) => {
        ensureSubstates(state);
        state.working.actionSubmitting = true;
        state.working.actionError = '';
      })
      .addCase(actionAdminReport.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.actionSubmitting = false;
        const { reportId, action: actType, reason, result } = action.payload || {};
        const nextStatus =
          result?.report?.status ||
          (actType === 'dismiss' ? 'Dismissed' : 'Resolved');
        if (reportId && state.entities[reportId]) {
          reportsAdapter.updateOne(state, {
            id: reportId,
            changes: {
              ...(result?.report || {}),
              status: nextStatus,
              adminNote: result?.report?.adminNote || reason,
            },
          });
        }
        state.working.selectedReportId = null;
        state.working.selectedReportDetail = null;
      })
      .addCase(actionAdminReport.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.actionSubmitting = false;
        const msg =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to action report';
        state.working.actionError = msg;
        state.working.detailError = msg;
      })

      .addCase(fetchOwnerPatterns.pending, (state) => {
        ensureSubstates(state);
        state.ownerPatternsStatus = 'loading';
      })
      .addCase(fetchOwnerPatterns.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.ownerPatternsStatus = 'succeeded';
        state.ownerPatterns = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchOwnerPatterns.rejected, (state) => {
        ensureSubstates(state);
        state.ownerPatternsStatus = 'failed';
        state.ownerPatterns = [];
      })

      .addCase(sessionReset, () => createInitialReportsState());

    addRouteReset(builder, clearWorkingReportsState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setReportFilter,
  setReportSearch,
  closeReportDetail,
  clearReportSubmitFeedback,
} = reportsSlice.actions;

export default reportsSlice.reducer;
