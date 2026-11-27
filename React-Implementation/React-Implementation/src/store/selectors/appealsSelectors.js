import { createSelector } from '@reduxjs/toolkit';
import {
  appealsAdapter,
  createInitialAppealsWorking,
} from '../slices/appealsSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const FALLBACK_WORKING = createInitialAppealsWorking();

export const selectAppealsState = (state) => state?.appeals;

export const appealsEntitySelectors = appealsAdapter.getSelectors(selectAppealsState);

export const selectAppealEntities = (state) =>
  state?.appeals?.entities || EMPTY_MAP;

export const selectMyAppealIds = (state) =>
  state?.appeals?.myAppealIds || EMPTY_IDS;

export const selectAdminAppealIds = (state) =>
  state?.appeals?.adminAppealIds || EMPTY_IDS;

export const selectMyAppeals = createSelector(
  [selectAppealEntities, selectMyAppealIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectAdminAppeals = createSelector(
  [selectAppealEntities, selectAdminAppealIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectAdminAppealsStatus = (state) =>
  state?.appeals?.adminAppealsStatus || 'idle';

export const selectAppealsWorking = (state) =>
  state?.appeals?.working || FALLBACK_WORKING;
