import { createSelector } from '@reduxjs/toolkit';
import {
  mentorProfilesAdapter,
  createInitialMentorProfilesWorking,
} from '../slices/mentorProfilesSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const FALLBACK_WORKING = createInitialMentorProfilesWorking();

export const selectMentorProfilesState = (state) => state?.mentorProfiles;

export const mentorProfilesEntitySelectors = mentorProfilesAdapter.getSelectors(
  selectMentorProfilesState,
);

export const selectMentorProfileEntities = (state) =>
  state?.mentorProfiles?.entities || EMPTY_MAP;

export const selectMentorListIds = (state) =>
  state?.mentorProfiles?.listIds || EMPTY_IDS;

export const selectAllDirectoryMentors = createSelector(
  [selectMentorProfileEntities, selectMentorListIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectMentorsListStatus = (state) =>
  state?.mentorProfiles?.listStatus || 'idle';

export const selectMyMentorProfile = (state) =>
  state?.mentorProfiles?.myProfile || null;

export const selectHasExistingMentorProfile = (state) =>
  Boolean(state?.mentorProfiles?.hasExistingProfile);

export const selectMyMentorProfileStatus = (state) =>
  state?.mentorProfiles?.myProfileStatus || 'idle';

export const selectIsSavingMentorProfile = (state) =>
  state?.mentorProfiles?.savingStatus === 'loading';

export const selectMyMentorStats = (state) =>
  state?.mentorProfiles?.myStats || null;

export const selectMentorProfilesWorking = (state) =>
  state?.mentorProfiles?.working || FALLBACK_WORKING;
