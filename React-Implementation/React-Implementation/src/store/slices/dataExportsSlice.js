import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  downloadDataExport,
  fetchDataExports,
  fetchDataExportStatus,
  requestDataExport,
} from '../thunks/dataExportsThunks';
import { exportAuditLogs } from '../thunks/auditLogThunks';

function deriveExportId(item) {
  return String(item?.exportId || item?.id || '');
}

/**
 * Data Exports Repository Slice (`dataExportsSlice`)
 * ==================================================
 * Mirrors `DataExportService.exportsById` (`/users/me/export*`) and
 * records the latest audit export summary triggered by admins.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`requestingExport`, `downloadingExport`,
 *   `exportError`).
 * - STAYS across `routeChanged`: normalized `entities` / `ids` / `latestExportId` /
 *   `lastAuditExport`.
 * - Full reset on `sessionReset`.
 */
export const dataExportsAdapter = createEntityAdapter({
  selectId: deriveExportId,
});

export function createInitialDataExportsWorking() {
  return {
    requestingExport: false,
    downloadingExport: false,
    exportError: '',
  };
}

export function createInitialDataExportsState() {
  return dataExportsAdapter.getInitialState({
    latestExportId: null,
    lastAuditExport: null,
    status: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialDataExportsWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.working) state.working = createInitialDataExportsWorking();
}

function clearWorkingDataExportsState(state) {
  ensureSubstates(state);
  state.working = createInitialDataExportsWorking();
  state.error = null;
}

const dataExportsSlice = createSlice({
  name: 'dataExports',
  initialState: createInitialDataExportsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const list = Array.isArray(action.payload) ? action.payload : [];
      dataExportsAdapter.setAll(state, list);
      state.latestExportId = list.length > 0 ? deriveExportId(list[0]) : null;
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      const eid = deriveExportId(action.payload);
      if (!eid) return;
      dataExportsAdapter.addOne(state, action.payload);
      state.latestExportId = eid;
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      dataExportsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const eid = String(action.payload);
      dataExportsAdapter.removeOne(state, eid);
      if (state.latestExportId === eid) {
        state.latestExportId = state.ids[0] || null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDataExports.pending, (state) => {
        ensureSubstates(state);
        state.status = 'loading';
      })
      .addCase(fetchDataExports.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = (Array.isArray(action.payload) ? action.payload : []).filter(
          (e) => deriveExportId(e),
        );
        dataExportsAdapter.setAll(state, list);
        if (list.length > 0) {
          state.latestExportId = deriveExportId(list[0]);
        }
        state.status = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchDataExports.rejected, (state, action) => {
        ensureSubstates(state);
        state.status = 'failed';
        state.error =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to fetch data exports.';
      })

      .addCase(requestDataExport.pending, (state) => {
        ensureSubstates(state);
        state.working.requestingExport = true;
        state.working.exportError = '';
      })
      .addCase(requestDataExport.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.requestingExport = false;
        const res = action.payload;
        if (res && deriveExportId(res)) {
          dataExportsAdapter.upsertOne(state, res);
          state.latestExportId = deriveExportId(res);
        }
      })
      .addCase(requestDataExport.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.requestingExport = false;
        state.working.exportError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to request data export.';
      })

      .addCase(fetchDataExportStatus.fulfilled, (state, action) => {
        ensureSubstates(state);
        const res = action.payload;
        if (res && deriveExportId(res)) {
          dataExportsAdapter.upsertOne(state, res);
        }
      })

      .addCase(downloadDataExport.pending, (state) => {
        ensureSubstates(state);
        state.working.downloadingExport = true;
        state.working.exportError = '';
      })
      .addCase(downloadDataExport.fulfilled, (state) => {
        ensureSubstates(state);
        state.working.downloadingExport = false;
      })
      .addCase(downloadDataExport.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.downloadingExport = false;
        state.working.exportError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to download export.';
      })

      .addCase(exportAuditLogs.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.lastAuditExport = action.payload || null;
      })

      .addCase(sessionReset, () => createInitialDataExportsState());

    addRouteReset(builder, clearWorkingDataExportsState);
  },
});

export const { setAll, addOne, updateOne, removeOne } = dataExportsSlice.actions;

export default dataExportsSlice.reducer;
