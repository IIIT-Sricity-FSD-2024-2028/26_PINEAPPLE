import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  fetchEntityFeedback,
  fetchFeedbackReasons,
  makeFeedbackEntityKey,
} from '../thunks/feedbackThunks';

function deriveFeedbackId(entry) {
  if (entry?.id) return String(entry.id);
  const type = String(entry?.entityType || 'ENTITY').trim().toUpperCase();
  const entityId = String(entry?.entityId || 'unknown').trim();
  const actionType = String(entry?.actionType || 'ACTION').trim().toUpperCase();
  const createdAt = String(entry?.createdAt || entry?.timestamp || '0');
  return `${type}:${entityId}:${actionType}:${createdAt}`;
}

export const actionFeedbackAdapter = createEntityAdapter({
  selectId: deriveFeedbackId,
});

export function createInitialFeedbackWorking() {
  return {
    activeActionType: null,
    activeEntityKey: null,
    draftError: null,
  };
}

export function createInitialActionFeedbackState() {
  return actionFeedbackAdapter.getInitialState({
    reasonsConfig: {},
    reasonCategories: {},
    reasonsStatus: 'idle',
    reasonsError: null,
    reasonsLastFetchedAt: null,
    historyIdsByEntity: {},
    entityStatusByKey: {},
    entityErrorByKey: {},
    entityLastFetchedAtByKey: {},
    working: createInitialFeedbackWorking(),
  });
}

function ensureFeedbackSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.reasonsConfig) state.reasonsConfig = {};
  if (!state.reasonCategories) state.reasonCategories = {};
  if (!state.reasonsStatus) state.reasonsStatus = 'idle';
  if (state.reasonsError === undefined) state.reasonsError = null;
  if (state.reasonsLastFetchedAt === undefined) state.reasonsLastFetchedAt = null;
  if (!state.historyIdsByEntity) state.historyIdsByEntity = {};
  if (!state.entityStatusByKey) state.entityStatusByKey = {};
  if (!state.entityErrorByKey) state.entityErrorByKey = {};
  if (!state.entityLastFetchedAtByKey) state.entityLastFetchedAtByKey = {};
  if (!state.working) state.working = createInitialFeedbackWorking();
}

function extractActionConfigsMap(payload) {
  if (!payload || typeof payload !== 'object') {
    return { actions: {}, categories: {} };
  }
  const categories =
    payload.categories && typeof payload.categories === 'object'
      ? payload.categories
      : {};
  const rawActions =
    payload.actions && typeof payload.actions === 'object'
      ? payload.actions
      : payload;

  const actions = {};
  for (const [key, value] of Object.entries(rawActions)) {
    if (key === 'categories' || key === 'actions') continue;
    if (value && typeof value === 'object') {
      actions[String(key).toUpperCase().trim()] = value;
    }
  }
  return { actions, categories };
}

function normalizeFeedbackEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  return { ...entry, id: deriveFeedbackId(entry) };
}

function appendHistoryKey(state, entry) {
  const key = makeFeedbackEntityKey(entry?.entityType, entry?.entityId);
  if (!key) return;
  const id = deriveFeedbackId(entry);
  const existing = state.historyIdsByEntity[key] || [];
  if (!existing.includes(id)) {
    state.historyIdsByEntity[key] = [id, ...existing];
  }
}

const initialState = createInitialActionFeedbackState();

const actionFeedbackSlice = createSlice({
  name: 'actionFeedback',
  initialState,
  reducers: {
    /**
     * 4 explicit synchronous CRUD reducers (SPEC 2 & 3 / Decision D2).
     */
    setAll: (state, action) => {
      ensureFeedbackSubstates(state);
      const raw = Array.isArray(action.payload) ? action.payload : [];
      const normalized = raw.filter(Boolean).map(normalizeFeedbackEntry);
      actionFeedbackAdapter.setAll(state, normalized);
      state.historyIdsByEntity = {};
      for (const item of normalized) {
        const key = makeFeedbackEntityKey(item.entityType, item.entityId);
        if (!key) continue;
        if (!state.historyIdsByEntity[key]) state.historyIdsByEntity[key] = [];
        state.historyIdsByEntity[key].push(item.id);
      }
    },
    addOne: (state, action) => {
      ensureFeedbackSubstates(state);
      if (!action.payload) return;
      const item = normalizeFeedbackEntry(action.payload);
      actionFeedbackAdapter.upsertOne(state, item);
      appendHistoryKey(state, item);
    },
    updateOne: (state, action) => {
      ensureFeedbackSubstates(state);
      actionFeedbackAdapter.updateOne(state, action);
    },
    removeOne: (state, action) => {
      ensureFeedbackSubstates(state);
      const removedId = String(action.payload);
      actionFeedbackAdapter.removeOne(state, removedId);
      for (const key of Object.keys(state.historyIdsByEntity)) {
        state.historyIdsByEntity[key] = (
          state.historyIdsByEntity[key] || []
        ).filter((id) => String(id) !== removedId);
      }
    },

    setFeedbackWorking: (state, action) => {
      ensureFeedbackSubstates(state);
      Object.assign(state.working, action.payload || {});
    },
    clearFeedbackWorking: (state) => {
      state.working = createInitialFeedbackWorking();
    },
  },
  extraReducers: (builder) => {
    builder
      // Reason catalog (`GET /feedback/reasons`)
      .addCase(fetchFeedbackReasons.pending, (state) => {
        ensureFeedbackSubstates(state);
        state.reasonsStatus = 'loading';
        state.reasonsError = null;
      })
      .addCase(fetchFeedbackReasons.fulfilled, (state, action) => {
        ensureFeedbackSubstates(state);
        const { actions, categories } = extractActionConfigsMap(action.payload);
        state.reasonsConfig = actions;
        state.reasonCategories = categories;
        state.reasonsStatus = 'succeeded';
        state.reasonsError = null;
        state.reasonsLastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchFeedbackReasons.rejected, (state, action) => {
        ensureFeedbackSubstates(state);
        state.reasonsStatus = 'failed';
        state.reasonsError =
          action.payload || { message: action.error?.message || 'Failed to load reasons.' };
      })

      // Entity feedback history (`GET /feedback?entityType=&entityId=`)
      .addCase(fetchEntityFeedback.pending, (state, action) => {
        ensureFeedbackSubstates(state);
        const key = makeFeedbackEntityKey(
          action.meta.arg?.entityType,
          action.meta.arg?.entityId,
        );
        if (!key) return;
        state.entityStatusByKey[key] = 'loading';
        state.entityErrorByKey[key] = null;
      })
      .addCase(fetchEntityFeedback.fulfilled, (state, action) => {
        ensureFeedbackSubstates(state);
        const { key, items } = action.payload || {};
        if (!key) return;
        const normalized = (Array.isArray(items) ? items : [])
          .filter(Boolean)
          .map(normalizeFeedbackEntry);
        actionFeedbackAdapter.upsertMany(state, normalized);
        state.historyIdsByEntity[key] = normalized.map((item) => item.id);
        state.entityStatusByKey[key] = 'succeeded';
        state.entityErrorByKey[key] = null;
        state.entityLastFetchedAtByKey[key] = new Date().toISOString();
      })
      .addCase(fetchEntityFeedback.rejected, (state, action) => {
        ensureFeedbackSubstates(state);
        const key = makeFeedbackEntityKey(
          action.meta.arg?.entityType,
          action.meta.arg?.entityId,
        );
        if (!key) return;
        state.entityStatusByKey[key] = 'failed';
        state.entityErrorByKey[key] =
          action.payload || { message: action.error?.message || 'Unable to load feedback history.' };
      })

      // Route-leave reset clears modal/working flags while keeping cached reasons & histories
      .addCase(sessionReset, () => createInitialActionFeedbackState());

    addRouteReset(builder, (state) => {
      state.working = createInitialFeedbackWorking();
    });
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setFeedbackWorking,
  clearFeedbackWorking,
} = actionFeedbackSlice.actions;

export const actionFeedbackCrudSelectors = actionFeedbackAdapter.getSelectors(
  (state) => state?.actionFeedback || initialState,
);

export default actionFeedbackSlice.reducer;
