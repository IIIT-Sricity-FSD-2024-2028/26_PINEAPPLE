import { createAsyncThunk } from '@reduxjs/toolkit';
import feedbackApi from '../../services/feedbackApi';
import { normalizeThunkError } from '../utils/thunkError';

export const FEEDBACK_HISTORY_STALE_MS = 30 * 1000;

export function makeFeedbackEntityKey(entityType, entityId) {
  if (!entityType || !entityId) return '';
  return `${String(entityType).trim().toUpperCase()}:${String(entityId).trim()}`;
}

/**
 * Fetches GET /feedback/reasons once and caches the configuration in actionFeedbackSlice,
 * replacing the module-level cache that used to live in feedbackApi.js.
 */
export const fetchFeedbackReasons = createAsyncThunk(
  'actionFeedback/fetchFeedbackReasons',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const force = Boolean(arg && typeof arg === 'object' && arg.force === true);
      const data = force
        ? await feedbackApi.getFeedbackReasons(true)
        : await feedbackApi.getFeedbackReasons();
      return data || {};
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      const force = Boolean(arg && typeof arg === 'object' && arg.force === true);
      if (force) return true;
      const slice = getState()?.actionFeedback;
      if (!slice) return true;
      if (slice.reasonsStatus === 'loading') return false;
      if (
        slice.reasonsLastFetchedAt != null &&
        slice.reasonsConfig &&
        Object.keys(slice.reasonsConfig).length > 0
      ) {
        return false;
      }
      return true;
    },
  },
);

/**
 * Fetches feedback audit history for a specific entity (`GET /feedback?entityType=&entityId=`).
 */
export const fetchEntityFeedback = createAsyncThunk(
  'actionFeedback/fetchEntityFeedback',
  async ({ entityType, entityId }, { rejectWithValue }) => {
    try {
      const res = await feedbackApi.getEntityFeedback(entityType, entityId);
      const items = Array.isArray(res) ? res : [];
      return {
        entityType: String(entityType || '').trim().toUpperCase(),
        entityId: String(entityId || '').trim(),
        key: makeFeedbackEntityKey(entityType, entityId),
        items,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg, { getState }) => {
      if (!arg?.entityType || !arg?.entityId) return false;
      if (arg.force === true) return true;
      const slice = getState()?.actionFeedback;
      if (!slice) return true;
      const key = makeFeedbackEntityKey(arg.entityType, arg.entityId);
      if (!key) return false;
      if (slice.entityStatusByKey?.[key] === 'loading') return false;
      const ts = slice.entityLastFetchedAtByKey?.[key];
      if (ts) {
        const parsed = Date.parse(ts);
        if (
          Number.isFinite(parsed) &&
          Date.now() - parsed < FEEDBACK_HISTORY_STALE_MS
        ) {
          return false;
        }
      }
      return true;
    },
  },
);
