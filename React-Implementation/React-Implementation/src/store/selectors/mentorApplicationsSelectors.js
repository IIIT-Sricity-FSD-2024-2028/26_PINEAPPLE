import { createSelector } from '@reduxjs/toolkit';
import {
  createInitialMentorApplicationsWorking,
  mentorApplicationsAdapter,
} from '../slices/mentorApplicationsSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const EMPTY_LIST = [];
const FALLBACK_WORKING = createInitialMentorApplicationsWorking();

export const selectMentorApplicationsState = (state) =>
  state?.mentorApplications;

export const mentorApplicationsEntitySelectors =
  mentorApplicationsAdapter.getSelectors(selectMentorApplicationsState);

export const selectMentorApplicationEntities = (state) =>
  state?.mentorApplications?.entities || EMPTY_MAP;

export const selectAdminMentorAppIds = (state) =>
  state?.mentorApplications?.adminListIds || EMPTY_IDS;

export const selectAdminMentorApplications = createSelector(
  [selectMentorApplicationEntities, selectAdminMentorAppIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectMentorApplicationsListStatus = (state) =>
  state?.mentorApplications?.listStatus || 'idle';

export const selectMentorApplicationsListError = (state) =>
  state?.mentorApplications?.listError || null;

export const selectMyMentorStatusData = (state) =>
  state?.mentorApplications?.myStatusData || null;

export const selectMyMentorApplication = (state) =>
  state?.mentorApplications?.myStatusData?.application || null;

export const selectMyMentorCooldownInfo = createSelector(
  [selectMyMentorStatusData],
  (data) => {
    if (!data || (!data.inCooldown && !data.cooldownAvailableAt)) return null;
    return {
      inCooldown: Boolean(data.inCooldown),
      availableAt: data.cooldownAvailableAt || null,
      cooldownDays: data.cooldownDays || 14,
    };
  },
);

export const selectMyApplicationLoadStatus = (state) =>
  state?.mentorApplications?.myStatus || 'idle';

export const selectMinYearsRequired = (state) =>
  state?.mentorApplications?.minYearsRequired ?? 5;

const selectRawCvData = (state) => state?.mentorApplications?.cvData || null;
const selectRawCvUploading = (state) =>
  Boolean(state?.mentorApplications?.cvUploading);

export const selectMentorCvState = createSelector(
  [selectRawCvData, selectRawCvUploading],
  (cvData, cvUploading) => ({ cvData, cvUploading }),
);

const selectRawDigiLockerDocs = (state) =>
  state?.mentorApplications?.digiLockerDocs || EMPTY_LIST;
const selectRawDigiLockerConnected = (state) =>
  Boolean(state?.mentorApplications?.digiLockerConnected);
const selectRawDigiLockerLoading = (state) =>
  Boolean(state?.mentorApplications?.digiLockerLoading);

export const selectDigiLockerState = createSelector(
  [
    selectRawDigiLockerDocs,
    selectRawDigiLockerConnected,
    selectRawDigiLockerLoading,
  ],
  (docs, connected, loading) => ({ docs, connected, loading }),
);

export const selectMentorApplicationsWorking = (state) =>
  state?.mentorApplications?.working || FALLBACK_WORKING;
