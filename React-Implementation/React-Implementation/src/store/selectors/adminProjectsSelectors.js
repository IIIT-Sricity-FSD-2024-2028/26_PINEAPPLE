import { createSelector } from '@reduxjs/toolkit';
import {
  adminProjectsAdapter,
  createInitialAdminProjectsWorking,
} from '../slices/adminProjectsSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const FALLBACK_WORKING = createInitialAdminProjectsWorking();

export const selectAdminProjectsState = (state) => state?.adminProjects;

export const adminProjectsEntitySelectors =
  adminProjectsAdapter.getSelectors(selectAdminProjectsState);

export const selectAdminProjectEntities = (state) =>
  state?.adminProjects?.entities || EMPTY_MAP;

export const selectAdminProjectIds = (state) =>
  state?.adminProjects?.ids || EMPTY_IDS;

export const selectAllAdminProjects = createSelector(
  [selectAdminProjectEntities, selectAdminProjectIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectAdminProjectById = (projectId) => (state) =>
  state?.adminProjects?.entities?.[String(projectId)] || null;

export const selectAdminProjectEscrowById = (projectId) => (state) =>
  state?.adminProjects?.escrowByProjectId?.[String(projectId)] || null;

export const selectAdminProjectsStatus = (state) =>
  state?.adminProjects?.status || 'idle';

export const selectAdminProjectsError = (state) =>
  state?.adminProjects?.error || null;

export const selectAdminProjectsWorking = (state) =>
  state?.adminProjects?.working || FALLBACK_WORKING;
