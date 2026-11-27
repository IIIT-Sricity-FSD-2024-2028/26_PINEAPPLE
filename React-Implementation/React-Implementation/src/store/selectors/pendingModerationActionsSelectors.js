import { createSelector } from '@reduxjs/toolkit';
import {
  createInitialModerationWorking,
  pendingModerationActionsAdapter,
} from '../slices/pendingModerationActionsSlice';
import { selectCurrentAdminUid } from './sessionSelectors';

const FALLBACK_WORKING = createInitialModerationWorking();

export const selectPendingModerationActionsState = (state) =>
  state?.pendingModerationActions;

export const pendingModerationActionsEntitySelectors =
  pendingModerationActionsAdapter.getSelectors(selectPendingModerationActionsState);

export const selectAllModerationActions =
  pendingModerationActionsEntitySelectors.selectAll;

export const selectPendingModerationActionsCount = createSelector(
  [selectAllModerationActions],
  (items) => items.filter((a) => a?.status === 'pending').length,
);

export const selectModerationActionsAnnotated = createSelector(
  [selectAllModerationActions, selectCurrentAdminUid],
  (items, adminUid) =>
    items.map((act) => ({
      ...act,
      isOwnRequest: Boolean(
        adminUid && act?.requestedBy && String(act.requestedBy) === String(adminUid),
      ),
    })),
);

export const selectModerationWorking = (state) =>
  state?.pendingModerationActions?.working || FALLBACK_WORKING;
