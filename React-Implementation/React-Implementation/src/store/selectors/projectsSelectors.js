import { createSelector } from '@reduxjs/toolkit';
import { projectsAdapter } from '../slices/projectsSlice';
import { isProjectLocked } from '../../utils/projectStatus';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

const selectProjectsSlice = (state) => state?.projects;

const adapterSelectors = projectsAdapter.getSelectors(
  (state) => state?.projects || { ids: [], entities: {} },
);

export const selectAllProjects = adapterSelectors.selectAll;
export const selectProjectEntities = adapterSelectors.selectEntities;
export const selectProjectIds = adapterSelectors.selectIds;
export const selectProjectById = (state, id) =>
  adapterSelectors.selectById(state, String(id ?? ''));

const selectMarketplaceIds = (state) =>
  state?.projects?.marketplaceIds || EMPTY_ARRAY;
const selectMyProjectIds = (state) =>
  state?.projects?.myProjectIds || EMPTY_ARRAY;
const selectMyWorkOngoingIds = (state) =>
  state?.projects?.myWorkOngoingIds || EMPTY_ARRAY;
const selectMyWorkCompletedIds = (state) =>
  state?.projects?.myWorkCompletedIds || EMPTY_ARRAY;

/**
 * Returns Marketplace projects in exact server-stored `marketplaceIds` order.
 */
export const selectMarketplaceProjects = createSelector(
  [selectMarketplaceIds, selectProjectEntities],
  (ids, entities) => ids.map((id) => entities[id]).filter(Boolean),
);

/**
 * Returns My Projects in exact server-stored `myProjectIds` order.
 */
export const selectMyProjects = createSelector(
  [selectMyProjectIds, selectProjectEntities],
  (ids, entities) => ids.map((id) => entities[id]).filter(Boolean),
);

/**
 * Splits My Projects into active / completed / closed views matching UI tabs.
 */
export const selectMyProjectsBuckets = createSelector(
  [selectMyProjects],
  (projects) => {
    const isClosed = (p) => String(p.status || '').toLowerCase() === 'closed';
    const isCompleted = (p) =>
      !isClosed(p) && (p.isCompleted === true || isProjectLocked(p));
    const active = projects.filter((p) => !isClosed(p) && !isCompleted(p));
    const completed = projects
      .filter(isCompleted)
      .sort(
        (a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0),
      );
    const closed = projects.filter(isClosed);
    return {
      all: projects,
      active,
      completed,
      closed,
    };
  },
);

/**
 * Returns Collaborator Ongoing work projects in exact `myWorkOngoingIds` order.
 */
export const selectMyWorkOngoingProjects = createSelector(
  [selectMyWorkOngoingIds, selectProjectEntities],
  (ids, entities) => ids.map((id) => entities[id]).filter(Boolean),
);

/**
 * Returns Collaborator Completed/Closed work projects in exact `myWorkCompletedIds` order.
 */
export const selectMyWorkCompletedProjects = createSelector(
  [selectMyWorkCompletedIds, selectProjectEntities],
  (ids, entities) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectProjectSummaryCounts = (state) =>
  state?.projects?.summary || EMPTY_OBJECT;

export const selectProjectsStatus = (state) => state?.projects?.status ?? 'idle';
export const selectMyProjectsStatus = (state) =>
  state?.projects?.myProjectsStatus ?? 'idle';
export const selectMyWorkStatus = (state) =>
  state?.projects?.myWorkStatus ?? 'idle';
export const selectProjectDetailStatus = (state) =>
  state?.projects?.detailStatus ?? 'idle';
export const selectCreateProjectStatus = (state) =>
  state?.projects?.createStatus ?? 'idle';
export const selectUpdateProjectStatus = (state) =>
  state?.projects?.updateStatus ?? 'idle';
export const selectDeleteProjectStatus = (state) =>
  state?.projects?.deleteStatus ?? 'idle';
export const selectDeletionCheckStatus = (state) =>
  state?.projects?.deletionCheckStatus ?? 'idle';
export const selectProjectMatchStatus = (state) =>
  state?.projects?.matchStatus ?? 'idle';
export const selectProjectsError = (state) => state?.projects?.error ?? null;

export const selectProjectsWorking = (state) =>
  selectProjectsSlice(state)?.working || EMPTY_OBJECT;

export const selectProjectMembersById = (state, projectId) => {
  const key = String(projectId ?? '');
  return (
    state?.projects?.membersByProjectId?.[key] ||
    state?.projects?.entities?.[key]?.members ||
    EMPTY_ARRAY
  );
};

export const selectProjectTombstoneById = (state, projectId) =>
  state?.projects?.tombstoneById?.[String(projectId ?? '')] || null;

export const selectProjectDeletionCheck = (state, projectId) =>
  state?.projects?.deletionChecksById?.[String(projectId ?? '')] || null;

export const selectProjectRemovalChecks = (state, projectId) =>
  state?.projects?.removalChecksById?.[String(projectId ?? '')] || EMPTY_OBJECT;

export const selectProjectSkillMatch = (state, projectId) =>
  state?.projects?.skillMatchById?.[String(projectId ?? '')] || null;

export const selectMyLeaveRequestByProject = (state, projectId) =>
  state?.projects?.myLeaveRequestByProjectId?.[String(projectId ?? '')] || null;

export const selectProjectTaskTemplatesById = (state, projectId) =>
  state?.projects?.projectTaskTemplatesById?.[String(projectId ?? '')] || null;
