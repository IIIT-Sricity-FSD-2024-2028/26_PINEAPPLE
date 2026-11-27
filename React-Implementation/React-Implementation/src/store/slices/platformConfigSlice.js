import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  fetchPlatformConfig,
  fetchPublicConfig,
  updatePlatformConfig,
} from '../thunks/platformConfigThunks';

export const DEFAULT_PLATFORM_CONFIG = {
  id: 'singleton',
  maxProjectsPerUser: 10,
  maxCollaboratorsPerProject: 20,
  mentorMinYearsExperience: 5,
  minimumTenure: 5,
  xpPerTaskCompletion: 100,
  maintenanceMode: false,
  platformVersion: '1.4.2',
};

/**
 * Platform Config Repository Slice (`platformConfigSlice`)
 * ========================================================
 * Mirrors `PlatformConfigService.config` singleton + public config subset.
 * Zero browser storage usage.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`saveError`, `saveSuccess`).
 * - STAYS across `routeChanged`: `entities`, `publicConfig`, `initialTenure`.
 * - Full reset on `sessionReset`.
 */
export const platformConfigAdapter = createEntityAdapter({
  selectId: (cfg) => String(cfg?.id || 'singleton'),
});

export function createInitialPlatformConfigWorking() {
  return {
    saving: false,
    saveError: '',
    saveSuccess: '',
  };
}

export function createInitialPlatformConfigState() {
  return platformConfigAdapter.getInitialState(
    {
      publicConfig: null,
      initialTenure: 5,
      status: 'idle',
      error: null,
      lastFetchedAt: null,
      working: createInitialPlatformConfigWorking(),
    },
    [DEFAULT_PLATFORM_CONFIG],
  );
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = { singleton: { ...DEFAULT_PLATFORM_CONFIG } };
  if (!Array.isArray(state.ids)) state.ids = ['singleton'];
  if (!state.working) state.working = createInitialPlatformConfigWorking();
}

function clearWorkingPlatformConfigState(state) {
  ensureSubstates(state);
  state.working = createInitialPlatformConfigWorking();
  state.error = null;
}

const platformConfigSlice = createSlice({
  name: 'platformConfig',
  initialState: createInitialPlatformConfigState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload)
        ? action.payload
        : action.payload
        ? [{ id: 'singleton', ...action.payload }]
        : [];
      platformConfigAdapter.setAll(state, items);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (!action.payload) return;
      platformConfigAdapter.addOne(state, {
        id: 'singleton',
        ...action.payload,
      });
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      platformConfigAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      platformConfigAdapter.removeOne(state, String(action.payload));
    },

    // ── Volatile Working State Reducers ──
    setConfigSaveError: (state, action) => {
      ensureSubstates(state);
      state.working.saveError = typeof action.payload === 'string' ? action.payload : '';
      state.working.saveSuccess = '';
    },
    clearConfigMessages: (state) => {
      ensureSubstates(state);
      state.working.saveError = '';
      state.working.saveSuccess = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPublicConfig.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload) {
          state.publicConfig = action.payload;
        }
      })

      .addCase(fetchPlatformConfig.pending, (state) => {
        ensureSubstates(state);
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPlatformConfig.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.status = 'succeeded';
        if (action.payload) {
          const prev = state.entities.singleton || DEFAULT_PLATFORM_CONFIG;
          const merged = { ...prev, ...action.payload, id: 'singleton' };
          platformConfigAdapter.upsertOne(state, merged);
          const tenure = Number(
            merged.minimumTenure ?? merged.mentorMinYearsExperience ?? 5,
          );
          if (!Number.isNaN(tenure)) {
            state.initialTenure = tenure;
          }
        }
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchPlatformConfig.rejected, (state, action) => {
        ensureSubstates(state);
        state.status = 'failed';
        state.error = action.payload || { message: action.error?.message };
      })

      .addCase(updatePlatformConfig.pending, (state) => {
        ensureSubstates(state);
        state.working.saving = true;
        state.working.saveError = '';
        state.working.saveSuccess = '';
      })
      .addCase(updatePlatformConfig.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.saving = false;
        const prev = state.entities.singleton || DEFAULT_PLATFORM_CONFIG;
        const merged = { ...prev, ...(action.payload || {}), id: 'singleton' };
        platformConfigAdapter.upsertOne(state, merged);
        const tenure = Number(
          merged.minimumTenure ?? merged.mentorMinYearsExperience ?? state.initialTenure,
        );
        if (!Number.isNaN(tenure)) {
          state.initialTenure = Math.max(state.initialTenure, tenure);
        }
        state.working.saveSuccess = 'Platform configuration committed successfully.';
      })
      .addCase(updatePlatformConfig.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.saving = false;
        const msg =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to save configuration.';
        state.working.saveError = `Failed to save configuration: ${msg}`;
      })

      .addCase(sessionReset, () => createInitialPlatformConfigState());

    addRouteReset(builder, clearWorkingPlatformConfigState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setConfigSaveError,
  clearConfigMessages,
} = platformConfigSlice.actions;

export default platformConfigSlice.reducer;
