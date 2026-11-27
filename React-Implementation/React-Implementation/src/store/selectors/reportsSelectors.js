import { createSelector } from '@reduxjs/toolkit';
import {
  createInitialReportsWorking,
  reportsAdapter,
} from '../slices/reportsSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const EMPTY_LIST = [];
const FALLBACK_WORKING = createInitialReportsWorking();

export const selectReportsState = (state) => state?.reports;

export const reportsEntitySelectors = reportsAdapter.getSelectors(selectReportsState);

export const selectReportEntities = (state) =>
  state?.reports?.entities || EMPTY_MAP;

export const selectMyReportIds = (state) =>
  state?.reports?.myReportIds || EMPTY_IDS;

export const selectAdminReportIds = (state) =>
  state?.reports?.adminReportIds || EMPTY_IDS;

export const selectMyReports = createSelector(
  [selectReportEntities, selectMyReportIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectAdminReports = createSelector(
  [selectReportEntities, selectAdminReportIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectOpenReportsCount = (state) => state?.reports?.openCount || 0;

export const selectMyReportsStatus = (state) =>
  state?.reports?.myReportsStatus || 'idle';

export const selectAdminReportsStatus = (state) =>
  state?.reports?.adminReportsStatus || 'idle';

export const selectOwnerPatterns = (state) =>
  state?.reports?.ownerPatterns || EMPTY_LIST;

export const selectOwnerPatternsStatus = (state) =>
  state?.reports?.ownerPatternsStatus || 'idle';

export const selectReportsWorking = (state) =>
  state?.reports?.working || FALLBACK_WORKING;
