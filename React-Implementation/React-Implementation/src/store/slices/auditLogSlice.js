import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  exportAuditLogs,
  fetchAuditLogs,
  normalizeAuditLogEntry,
  recordAuditEntry,
} from '../thunks/auditLogThunks';

/**
 * Audit Log Repository Slice (`auditLogSlice`)
 * ============================================
 * Mirrors `AuditService.auditLog` (`GET /admin/audit`, `GET /admin/audit/export`)
 * and stores URL-synchronized filter state (`userId`, `reportId`, `actor`,
 * `action`, `range`, `from`, `to`), pagination, search, and export dialog state.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (URL/search/type filters, `page`,
 *   `exportOpen`, `exportSubmitting`, `exportFeedback`).
 * - STAYS across `routeChanged`: normalized audit `entities` / `ids` /
 *   `recentEventIds`.
 * - Full reset on `sessionReset`.
 */
export const auditLogAdapter = createEntityAdapter({
  selectId: (entry) => String(entry?.id || ''),
});

export function createInitialAuditFilters() {
  return {
    userId: '',
    reportId: '',
    actor: '',
    action: '',
    range: '',
    from: '',
    to: '',
  };
}

export function createInitialAuditLogWorking() {
  return {
    filters: createInitialAuditFilters(),
    typeFilter: 'all',
    search: '',
    page: 1,
    exportOpen: false,
    exportFormat: 'csv',
    exportSubmitting: false,
    exportFeedback: null,
  };
}

export function createInitialAuditLogState() {
  return auditLogAdapter.getInitialState({
    recentEventIds: [],
    status: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialAuditLogWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!Array.isArray(state.recentEventIds)) state.recentEventIds = [];
  if (!state.working) state.working = createInitialAuditLogWorking();
  if (!state.working.filters) state.working.filters = createInitialAuditFilters();
}

function clearWorkingAuditLogState(state) {
  ensureSubstates(state);
  state.working = createInitialAuditLogWorking();
  state.error = null;
}

const auditLogSlice = createSlice({
  name: 'auditLog',
  initialState: createInitialAuditLogState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const list = (Array.isArray(action.payload) ? action.payload : []).map(
        (item, idx) => normalizeAuditLogEntry(item, idx),
      );
      auditLogAdapter.setAll(state, list);
      state.recentEventIds = list.slice(0, 5).map((e) => e.id);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (!action.payload) return;
      const norm = normalizeAuditLogEntry(action.payload, state.ids.length);
      auditLogAdapter.addOne(state, norm);
      state.recentEventIds = [norm.id, ...state.recentEventIds].slice(0, 5);
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      auditLogAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const aid = String(action.payload);
      auditLogAdapter.removeOne(state, aid);
      state.recentEventIds = state.recentEventIds.filter((id) => id !== aid);
    },

    // ── Volatile Working State Reducers ──
    syncAuditFiltersFromUrl: (state, action) => {
      ensureSubstates(state);
      const next = action.payload || {};
      state.working.filters = {
        userId: String(next.userId || ''),
        reportId: String(next.reportId || ''),
        actor: String(next.actor || ''),
        action: String(next.action || ''),
        range: String(next.range || ''),
        from: String(next.from || ''),
        to: String(next.to || ''),
      };
      state.working.page = 1;
    },
    setAuditFilterField: (state, action) => {
      ensureSubstates(state);
      const { field, value } = action.payload || {};
      if (field && Object.prototype.hasOwnProperty.call(state.working.filters, field)) {
        state.working.filters[field] = String(value || '');
        state.working.page = 1;
      }
    },
    clearAuditFilterField: (state, action) => {
      ensureSubstates(state);
      const field = String(action.payload || '');
      if (Object.prototype.hasOwnProperty.call(state.working.filters, field)) {
        state.working.filters[field] = '';
        state.working.page = 1;
      }
    },
    clearAllAuditFilters: (state) => {
      ensureSubstates(state);
      state.working.filters = createInitialAuditFilters();
      state.working.typeFilter = 'all';
      state.working.search = '';
      state.working.page = 1;
    },
    setAuditTypeFilter: (state, action) => {
      ensureSubstates(state);
      state.working.typeFilter = action.payload || 'all';
      state.working.page = 1;
    },
    setAuditSearch: (state, action) => {
      ensureSubstates(state);
      state.working.search = typeof action.payload === 'string' ? action.payload : '';
      state.working.page = 1;
    },
    setAuditPage: (state, action) => {
      ensureSubstates(state);
      state.working.page = Math.max(1, Number(action.payload) || 1);
    },
    setAuditExportOpen: (state, action) => {
      ensureSubstates(state);
      state.working.exportOpen = Boolean(action.payload);
      if (action.payload) {
        state.working.exportFeedback = null;
      }
    },
    setAuditExportFormat: (state, action) => {
      ensureSubstates(state);
      state.working.exportFormat = action.payload === 'json' ? 'json' : 'csv';
    },
    clearAuditExportFeedback: (state) => {
      ensureSubstates(state);
      state.working.exportFeedback = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuditLogs.pending, (state) => {
        ensureSubstates(state);
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = Array.isArray(action.payload) ? action.payload : [];
        auditLogAdapter.setAll(state, list);
        state.recentEventIds = list.slice(0, 5).map((e) => e.id);
        state.status = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        ensureSubstates(state);
        state.status = 'failed';
        state.error =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to fetch audit log.';
      })

      .addCase(exportAuditLogs.pending, (state) => {
        ensureSubstates(state);
        state.working.exportSubmitting = true;
        state.working.exportFeedback = null;
      })
      .addCase(exportAuditLogs.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.exportSubmitting = false;
        state.working.exportFeedback = {
          type: 'success',
          message: action.payload?.message || 'Audit export completed.',
        };
      })
      .addCase(exportAuditLogs.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.exportSubmitting = false;
        state.working.exportFeedback = {
          type: 'error',
          message:
            action.payload?.serverMessage ||
            action.payload?.message ||
            action.error?.message ||
            'Audit export failed.',
        };
      })

      .addCase(recordAuditEntry.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload && typeof action.payload === 'object' && action.payload.id) {
          const norm = normalizeAuditLogEntry(action.payload, state.ids.length);
          auditLogAdapter.upsertOne(state, norm);
        }
      })

      .addCase(sessionReset, () => createInitialAuditLogState());

    addRouteReset(builder, clearWorkingAuditLogState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  syncAuditFiltersFromUrl,
  setAuditFilterField,
  clearAuditFilterField,
  clearAllAuditFilters,
  setAuditTypeFilter,
  setAuditSearch,
  setAuditPage,
  setAuditExportOpen,
  setAuditExportFormat,
  clearAuditExportFeedback,
} = auditLogSlice.actions;

export default auditLogSlice.reducer;
