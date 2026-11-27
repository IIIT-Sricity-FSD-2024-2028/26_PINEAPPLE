import { createSelector } from '@reduxjs/toolkit';
import {
  createInitialJobRunsWorking,
  jobRunsAdapter,
} from '../slices/jobRunsSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const FALLBACK_WORKING = createInitialJobRunsWorking();

export const selectJobRunsState = (state) => state?.jobRuns;

export const jobRunsEntitySelectors =
  jobRunsAdapter.getSelectors(selectJobRunsState);

export const selectJobRunEntities = (state) =>
  state?.jobRuns?.entities || EMPTY_MAP;

export const selectJobRunIds = (state) =>
  state?.jobRuns?.ids || EMPTY_IDS;

export const selectAllJobRuns = createSelector(
  [selectJobRunEntities, selectJobRunIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectJobRunsStatus = (state) =>
  state?.jobRuns?.status || 'idle';

export const selectJobRunsWorking = (state) =>
  state?.jobRuns?.working || FALLBACK_WORKING;

export const selectSelectedJobRun = createSelector(
  [selectJobRunEntities, selectJobRunsWorking],
  (entities, working) =>
    working.selectedRunId ? entities[String(working.selectedRunId)] || null : null,
);
