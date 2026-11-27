import { createAsyncThunk } from '@reduxjs/toolkit';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import { normalizeThunkError } from '../utils/thunkError';

/**
 * Owner submits confidential 1-5 post-session feedback (`POST /mentor-sessions/:id/feedback`).
 */
export const submitSessionFeedback = createAsyncThunk(
  'sessionFeedback/submitSessionFeedback',
  async ({ sessionId, payload, role }, { rejectWithValue }) => {
    try {
      const sid = String(sessionId);
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.submitSessionFeedback(sid, payload, role)
          : await mentorMarketplaceApi.submitSessionFeedback(sid, payload);
      return {
        sessionId: sid,
        feedback:
          res && typeof res === 'object'
            ? { ...res, sessionId: res.sessionId || sid }
            : { id: sid, sessionId: sid, ...payload },
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Admin fetches confidential mentor feedback & abandonment history
 * (`GET /admin/mentors/:id/feedback`).
 */
export const fetchAdminMentorFeedback = createAsyncThunk(
  'sessionFeedback/fetchAdminMentorFeedback',
  async (arg, { rejectWithValue }) => {
    try {
      const opts =
        typeof arg === 'object' && arg !== null ? arg : { mentorId: arg };
      const mentorId = String(opts.mentorId || opts.id || '');
      if (
        !mentorId ||
        typeof mentorMarketplaceApi?.getAdminMentorFeedback !== 'function'
      ) {
        return { mentorId, data: null };
      }
      const res =
        opts.role !== undefined
          ? await mentorMarketplaceApi.getAdminMentorFeedback(mentorId, opts.role)
          : await mentorMarketplaceApi.getAdminMentorFeedback(mentorId);
      return { mentorId, data: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
