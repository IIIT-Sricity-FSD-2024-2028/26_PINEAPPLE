import { createSelector } from '@reduxjs/toolkit';
import { isProjectActive, isProjectLocked } from '../../utils/projectStatus';
import {
  mentorSessionsAdapter,
  createInitialMentorSessionsWorking,
} from '../slices/mentorSessionsSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const DEFAULT_COUNTS = { all: 0, active: 0, completed: 0 };
const FALLBACK_WORKING = createInitialMentorSessionsWorking();

export const selectMentorSessionsState = (state) => state?.mentorSessions;

export const mentorSessionsEntitySelectors = mentorSessionsAdapter.getSelectors(
  selectMentorSessionsState,
);

export const selectSessionEntities = (state) =>
  state?.mentorSessions?.entities || EMPTY_MAP;

export const selectMySessionIds = (state) =>
  state?.mentorSessions?.mySessionIds || EMPTY_IDS;

export const selectMentorSessionIds = (state) =>
  state?.mentorSessions?.mentorSessionIds || EMPTY_IDS;

export const selectMySessions = createSelector(
  [selectSessionEntities, selectMySessionIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectMentorViewSessions = createSelector(
  [selectSessionEntities, selectMentorSessionIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectMySessionsStatus = (state) =>
  state?.mentorSessions?.mySessionsStatus || 'idle';

export const selectMentorViewSessionsStatus = (state) =>
  state?.mentorSessions?.mentorSessionsStatus || 'idle';

export const selectMentoredProjectsMap = (state) =>
  state?.mentorSessions?.mentoredProjectsById || EMPTY_MAP;

export const selectMentoredProjectIds = (state) =>
  state?.mentorSessions?.mentoredProjectIds || EMPTY_IDS;

export const selectMentoredProjectsList = createSelector(
  [selectMentoredProjectsMap, selectMentoredProjectIds],
  (byId, ids) => ids.map((id) => byId[id]).filter(Boolean),
);

export const selectMentoredProjectsCounts = (state) =>
  state?.mentorSessions?.mentoredCounts || DEFAULT_COUNTS;

export const selectMentoredProjectsStatus = (state) =>
  state?.mentorSessions?.mentoredProjectsStatus || 'idle';

export const selectMentoredFilter = (state) =>
  state?.mentorSessions?.working?.mentoredFilter || 'all';

export const selectFilteredMentoredProjects = createSelector(
  [selectMentoredProjectsList, selectMentoredFilter],
  (projects, filter) => {
    if (filter === 'active') {
      return projects.filter(
        (p) =>
          p?.tab === 'active' ||
          (p?.tab !== 'completed' && isProjectActive(p)),
      );
    }
    if (filter === 'completed') {
      return projects.filter(
        (p) => p?.tab === 'completed' || isProjectLocked(p),
      );
    }
    return projects;
  },
);

export const selectSessionProcessingIds = (state) =>
  state?.mentorSessions?.processingIds || EMPTY_MAP;

export const selectMentorSessionsWorking = (state) =>
  state?.mentorSessions?.working || FALLBACK_WORKING;

export const selectAllSessionIds = (state) =>
  state?.mentorSessions?.allSessionIds || EMPTY_IDS;

export const selectAllSessionsAdmin = createSelector(
  [selectSessionEntities, selectAllSessionIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectAllSessionsAdminStatus = (state) =>
  state?.mentorSessions?.allSessionsStatus || 'idle';

export const selectAdminSessionStats = (state) =>
  state?.mentorSessions?.adminStats || null;
