import { createAsyncThunk } from '@reduxjs/toolkit';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import * as adminApiModule from '../../services/adminApi';
import { resolveApiModule } from '../utils/apiModule';
import { normalizeThunkError } from '../utils/thunkError';

/**
 * Opens an escrow dispute on a mentor session (`POST /mentor-sessions/:id/dispute`).
 * Freezes escrow payout/refund on the server and updates both `sessionDisputes`
 * and `mentorSessions` stores on fulfillment.
 */
export const openSessionDispute = createAsyncThunk(
  'sessionDisputes/openSessionDispute',
  async ({ sessionId, reason, role, userId }, { rejectWithValue }) => {
    try {
      const sid = String(sessionId);
      const trimmed = String(reason || '').trim();
      const res =
        role !== undefined || userId !== undefined
          ? await mentorMarketplaceApi.openDispute(sid, trimmed, role, userId)
          : await mentorMarketplaceApi.openDispute(sid, trimmed);
      return {
        sessionId: sid,
        dispute: res && typeof res === 'object' ? res : { sessionId: sid, status: 'open', reason: trimmed },
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Lists escrow disputes for admin review (`GET /admin/disputes`).
 */
export const fetchAdminDisputes = createAsyncThunk(
  'sessionDisputes/fetchAdminDisputes',
  async ({ status = '', role, source = 'marketplace' } = {}, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const useAdmin = source === 'admin' && typeof adminApi?.getDisputes === 'function';
      const fn = useAdmin ? adminApi.getDisputes : mentorMarketplaceApi.listDisputes;
      const res = role !== undefined ? await fn(status, role) : await fn(status);
      return Array.isArray(res) ? res : res?.items || res?.data || [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Submits an administrator dispute settlement ruling (`POST /admin/disputes/:id/decide`).
 */
export const decideSessionDispute = createAsyncThunk(
  'sessionDisputes/decideSessionDispute',
  async ({ disputeId, payload, role, source = 'marketplace' }, { rejectWithValue }) => {
    try {
      const did = String(disputeId);
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const useAdmin = source === 'admin' && typeof adminApi?.decideDispute === 'function';
      const fn = useAdmin ? adminApi.decideDispute : mentorMarketplaceApi.decideDispute;
      const res = role !== undefined ? await fn(did, payload, role) : await fn(did, payload);
      return {
        disputeId: did,
        dispute: res?.dispute || (res && typeof res === 'object' ? res : { id: did, status: 'decided' }),
        session: res?.session || null,
        escrow: res?.escrow || null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Unwired endpoint helper (`GET /admin/mentor-sessions/needs-review`, Decision D8):
 * preserves 404-tolerant handling without creating a dedicated slice.
 */
export const fetchNeedsReviewSessions = createAsyncThunk(
  'sessionDisputes/fetchNeedsReviewSessions',
  async () => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      if (typeof adminApi?.getNeedsReviewSessions !== 'function') return [];
      const res = await adminApi.getNeedsReviewSessions();
      return Array.isArray(res) ? res : res?.data || [];
    } catch {
      return [];
    }
  },
);

/**
 * Unwired endpoint helper (`POST /admin/mentor-sessions/:id/clear-review`, Decision D8):
 * preserves 404-tolerant handling without creating a dedicated slice.
 */
export const clearNeedsReviewSession = createAsyncThunk(
  'sessionDisputes/clearNeedsReviewSession',
  async ({ sessionId, reason }, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      if (typeof adminApi?.clearSessionReview !== 'function') {
        return { sessionId: String(sessionId), cleared: false };
      }
      const res = await adminApi.clearSessionReview(String(sessionId), reason);
      return { sessionId: String(sessionId), res };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
