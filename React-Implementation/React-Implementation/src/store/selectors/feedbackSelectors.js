import { createSelector } from '@reduxjs/toolkit';
import { FALLBACK_ACTION_CONFIGS } from '../../constants/feedbackConfig';
import { makeFeedbackEntityKey } from '../thunks/feedbackThunks';

const EMPTY_LIST = [];

export const selectActionFeedbackSlice = (state) => state?.actionFeedback;

export const selectReasonsConfigMap = (state) =>
  state?.actionFeedback?.reasonsConfig || {};

export const selectReasonsStatus = (state) =>
  state?.actionFeedback?.reasonsStatus || 'idle';

export const selectReasonsError = (state) =>
  state?.actionFeedback?.reasonsError || null;

export const selectReasonsLastFetchedAt = (state) =>
  state?.actionFeedback?.reasonsLastFetchedAt || null;

export const selectReasonConfigByAction = (state, actionType) => {
  const key = String(actionType || '').toUpperCase().trim();
  if (!key) return null;
  const fromStore = state?.actionFeedback?.reasonsConfig?.[key];
  if (fromStore) return fromStore;
  return FALLBACK_ACTION_CONFIGS[key] || null;
};

export const selectReasonsForAction = (state, actionType) => {
  const config = selectReasonConfigByAction(state, actionType);
  return Array.isArray(config?.reasons) ? config.reasons : EMPTY_LIST;
};

export const selectFeedbackEntityStatus = (state, entityType, entityId) => {
  const key = makeFeedbackEntityKey(entityType, entityId);
  if (!key) return 'idle';
  return state?.actionFeedback?.entityStatusByKey?.[key] || 'idle';
};

export const selectFeedbackEntityError = (state, entityType, entityId) => {
  const key = makeFeedbackEntityKey(entityType, entityId);
  if (!key) return null;
  return state?.actionFeedback?.entityErrorByKey?.[key] || null;
};

export const selectFeedbackByEntity = createSelector(
  [
    (state) => state?.actionFeedback?.entities,
    (state) => state?.actionFeedback?.historyIdsByEntity,
    (_state, entityType, entityId) =>
      makeFeedbackEntityKey(entityType, entityId),
  ],
  (entities, historyIdsByEntity, key) => {
    if (!key || !entities || !historyIdsByEntity) return EMPTY_LIST;
    const ids = historyIdsByEntity[key];
    if (!Array.isArray(ids) || ids.length === 0) return EMPTY_LIST;
    return ids.map((id) => entities[id]).filter(Boolean);
  },
);

export const selectFeedbackWorking = (state) =>
  state?.actionFeedback?.working || {
    activeActionType: null,
    activeEntityKey: null,
    draftError: null,
  };
