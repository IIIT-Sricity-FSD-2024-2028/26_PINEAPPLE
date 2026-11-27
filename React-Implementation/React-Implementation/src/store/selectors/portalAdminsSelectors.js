import { createSelector } from '@reduxjs/toolkit';
import {
  createInitialPortalAdminsWorking,
  portalAdminsAdapter,
} from '../slices/portalAdminsSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const FALLBACK_WORKING = createInitialPortalAdminsWorking();

export const selectPortalAdminsState = (state) => state?.portalAdmins;

export const portalAdminsEntitySelectors =
  portalAdminsAdapter.getSelectors(selectPortalAdminsState);

export const selectPortalAdminEntities = (state) =>
  state?.portalAdmins?.entities || EMPTY_MAP;

export const selectPortalAdminIds = (state) =>
  state?.portalAdmins?.ids || EMPTY_IDS;

export const selectAllPortalAdmins = createSelector(
  [selectPortalAdminEntities, selectPortalAdminIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectPortalAdminsStatus = (state) =>
  state?.portalAdmins?.status || 'idle';

export const selectPortalAdminsError = (state) =>
  state?.portalAdmins?.error || null;

export const selectPortalAdminsWorking = (state) =>
  state?.portalAdmins?.working || FALLBACK_WORKING;

export const selectEditingPortalAdmin = createSelector(
  [selectPortalAdminEntities, selectPortalAdminsWorking],
  (entities, working) =>
    working.editingAdminId ? entities[String(working.editingAdminId)] || null : null,
);

export const selectErasePortalAdmin = createSelector(
  [selectPortalAdminEntities, selectPortalAdminsWorking],
  (entities, working) =>
    working.adminToEraseId ? entities[String(working.adminToEraseId)] || null : null,
);
