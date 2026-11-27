import { createAsyncThunk } from '@reduxjs/toolkit';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import { normalizeThunkError } from '../utils/thunkError';

export const ABANDONMENT_STALE_MS = 15 * 1000;

/**
 * Fetches abandonment review & activity info for a project
 * (`GET /projects/:id/mentor/abandonment-review`).
 */
export const fetchProjectAbandonmentReview = createAsyncThunk(
  'abandonmentReviews/fetchProjectAbandonmentReview',
  async (arg, { rejectWithValue }) => {
    try {
      const opts =
        typeof arg === 'object' && arg !== null ? arg : { projectId: arg };
      const projectId = String(opts.projectId || '');
      if (
        !projectId ||
        typeof mentorMarketplaceApi?.getProjectAbandonmentReview !== 'function'
      ) {
        return { projectId, info: null };
      }
      let info = null;
      if (opts.userId !== undefined) {
        info = await mentorMarketplaceApi.getProjectAbandonmentReview(
          projectId,
          opts.role,
          opts.userId,
        );
      } else if (opts.role !== undefined) {
        info = await mentorMarketplaceApi.getProjectAbandonmentReview(
          projectId,
          opts.role,
        );
      } else {
        info = await mentorMarketplaceApi.getProjectAbandonmentReview(projectId);
      }
      return { projectId, info: info || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches mentor's open abandonment reviews (`GET /mentor/abandonment-reviews/mine`).
 */
export const fetchMyAbandonmentReviews = createAsyncThunk(
  'abandonmentReviews/fetchMyAbandonmentReviews',
  async (arg = {}, { rejectWithValue }) => {
    try {
      if (typeof mentorMarketplaceApi?.getMyAbandonmentReviews !== 'function') {
        return [];
      }
      const { role, userId } = arg || {};
      let res;
      if (userId !== undefined) {
        res = await mentorMarketplaceApi.getMyAbandonmentReviews(role, userId);
      } else if (role !== undefined) {
        res = await mentorMarketplaceApi.getMyAbandonmentReviews(role);
      } else {
        res = await mentorMarketplaceApi.getMyAbandonmentReviews();
      }
      return Array.isArray(res) ? res : [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      if (arg?.force === true) return true;
      const slice = getState()?.abandonmentReviews;
      if (!slice) return true;
      if (slice.myReviewsStatus === 'loading') return false;
      if (slice.myReviewsLastFetchedAt) {
        const parsed = Date.parse(slice.myReviewsLastFetchedAt);
        if (
          Number.isFinite(parsed) &&
          Date.now() - parsed < ABANDONMENT_STALE_MS
        ) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Owner opens a 48h mentor abandonment review
 * (`POST /projects/:id/mentor/abandonment-review`).
 */
export const openAbandonmentReview = createAsyncThunk(
  'abandonmentReviews/openAbandonmentReview',
  async ({ projectId, reason, role, userId }, { dispatch, rejectWithValue }) => {
    try {
      const pid = String(projectId);
      let res;
      if (userId !== undefined) {
        res = await mentorMarketplaceApi.openAbandonmentReview(
          pid,
          reason,
          role,
          userId,
        );
      } else if (role !== undefined) {
        res = await mentorMarketplaceApi.openAbandonmentReview(
          pid,
          reason,
          role,
        );
      } else {
        res = await mentorMarketplaceApi.openAbandonmentReview(pid, reason);
      }

      await dispatch(
        fetchProjectAbandonmentReview({
          projectId: pid,
          ...(role !== undefined ? { role } : {}),
          ...(userId !== undefined ? { userId } : {}),
        }),
      );

      return { projectId: pid, review: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Mentor confirms activity on an open abandonment review
 * (`POST /mentor/abandonment-reviews/:id/confirm`).
 */
export const confirmAbandonmentReview = createAsyncThunk(
  'abandonmentReviews/confirmAbandonmentReview',
  async (arg, { rejectWithValue }) => {
    try {
      const opts =
        typeof arg === 'object' && arg !== null ? arg : { reviewId: arg };
      const reviewId = String(opts.reviewId || opts.id);
      const { role, userId } = opts;

      let res;
      if (userId !== undefined) {
        res = await mentorMarketplaceApi.confirmAbandonmentReview(
          reviewId,
          role,
          userId,
        );
      } else if (role !== undefined) {
        res = await mentorMarketplaceApi.confirmAbandonmentReview(
          reviewId,
          role,
        );
      } else {
        res = await mentorMarketplaceApi.confirmAbandonmentReview(reviewId);
      }

      return {
        reviewId,
        review: res && typeof res === 'object' ? res : { id: reviewId, status: 'confirmed' },
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Admin cancels an open abandonment review (`POST /admin/abandonment-reviews/:id/cancel`).
 */
export const cancelAbandonmentReview = createAsyncThunk(
  'abandonmentReviews/cancelAbandonmentReview',
  async ({ reviewId, reason, role }, { rejectWithValue }) => {
    try {
      const rid = String(reviewId);
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.cancelAbandonmentReview(rid, reason, role)
          : await mentorMarketplaceApi.cancelAbandonmentReview(rid, reason);
      return {
        reviewId: rid,
        review: res && typeof res === 'object' ? res : { id: rid, status: 'cancelled' },
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
