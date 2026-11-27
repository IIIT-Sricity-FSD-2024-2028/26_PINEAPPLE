import { createSelector } from '@reduxjs/toolkit';
import {
  createInitialDataExportsWorking,
  dataExportsAdapter,
} from '../slices/dataExportsSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const FALLBACK_WORKING = createInitialDataExportsWorking();

export const selectDataExportsState = (state) => state?.dataExports;

export const dataExportsEntitySelectors =
  dataExportsAdapter.getSelectors(selectDataExportsState);

export const selectDataExportEntities = (state) =>
  state?.dataExports?.entities || EMPTY_MAP;

export const selectDataExportIds = (state) =>
  state?.dataExports?.ids || EMPTY_IDS;

export const selectAllDataExports = createSelector(
  [selectDataExportEntities, selectDataExportIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectLatestDataExport = createSelector(
  [selectDataExportEntities, selectAllDataExports, (state) => state?.dataExports?.latestExportId],
  (entities, list, latestId) => {
    if (latestId && entities[String(latestId)]) return entities[String(latestId)];
    return list[0] || null;
  },
);

export const selectDataExportsWorking = (state) =>
  state?.dataExports?.working || FALLBACK_WORKING;

export const selectLastAuditExport = (state) =>
  state?.dataExports?.lastAuditExport || null;
