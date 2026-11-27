import { createSelector } from '@reduxjs/toolkit';
import {
  settingsAdapter,
  createInitialSettingsWorking,
} from '../slices/settingsSlice';

const DEFAULT_WORKING = createInitialSettingsWorking();
const EMPTY_LIST = [];

const adapterSelectors = settingsAdapter.getSelectors(
  (state) => state?.settings || { ids: [], entities: {} },
);

export const selectAllSettingsEntities = adapterSelectors.selectAll;
export const selectSettingsById = (state, id = 'me') =>
  adapterSelectors.selectById(state, String(id));

export const selectDeletionCheck = (state) =>
  state?.settings?.deletionCheck || null;

export const selectPhoneOtpStatus = (state) =>
  state?.settings?.phoneOtpStatus || null;

export const selectSettingsWorking = (state) =>
  state?.settings?.working || DEFAULT_WORKING;

export const selectSettingsStatus = (state) =>
  state?.settings?.status || 'idle';

export const selectDeletionBlockersSummary = createSelector(
  [selectDeletionCheck],
  (deletionCheck) => {
    const taskBlockers = Array.isArray(deletionCheck?.taskBlockers)
      ? deletionCheck.taskBlockers
      : EMPTY_LIST;
    const obligations = Array.isArray(deletionCheck?.obligations)
      ? deletionCheck.obligations
      : EMPTY_LIST;
    const isBlocked = Boolean(
      deletionCheck &&
        deletionCheck.canDelete === false &&
        (taskBlockers.length > 0 || obligations.length > 0),
    );
    return {
      canDelete: deletionCheck ? Boolean(deletionCheck.canDelete) : true,
      isBlocked,
      taskBlockers,
      obligations,
    };
  },
);
