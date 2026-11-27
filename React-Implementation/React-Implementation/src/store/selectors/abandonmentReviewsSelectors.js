import { createSelector } from '@reduxjs/toolkit';
import {
  abandonmentReviewsAdapter,
  createInitialAbandonmentWorking,
} from '../slices/abandonmentReviewsSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const FALLBACK_WORKING = createInitialAbandonmentWorking();

export const selectAbandonmentReviewsState = (state) =>
  state?.abandonmentReviews;

export const abandonmentReviewsEntitySelectors =
  abandonmentReviewsAdapter.getSelectors(selectAbandonmentReviewsState);

export const selectAbandonmentEntities = (state) =>
  state?.abandonmentReviews?.entities || EMPTY_MAP;

export const selectMyOpenAbandonmentIds = (state) =>
  state?.abandonmentReviews?.myOpenReviewIds || EMPTY_IDS;

export const selectMyOpenAbandonmentReviews = createSelector(
  [selectAbandonmentEntities, selectMyOpenAbandonmentIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectProjectAbandonmentInfo = (state, projectId) =>
  (projectId && state?.abandonmentReviews?.byProjectInfo?.[String(projectId)]) ||
  null;

export const selectAbandonmentConfirmingIds = (state) =>
  state?.abandonmentReviews?.confirmingIds || EMPTY_MAP;

export const selectIsOpeningAbandonmentForProject = (state, projectId) =>
  Boolean(
    projectId &&
      state?.abandonmentReviews?.openingByProject?.[String(projectId)],
  );

export const selectAbandonmentWorking = (state) =>
  state?.abandonmentReviews?.working || FALLBACK_WORKING;
