import { createAsyncThunk } from '@reduxjs/toolkit';
import * as adminApiModule from '../../services/adminApi';
import * as trustApiModule from '../../services/trustApi';
import * as mentorshipApiModule from '../../services/mentorshipApi';
import { resolveApiModule } from '../utils/apiModule';
import { normalizeThunkError } from '../utils/thunkError';

/**
 * Fetches admin user directory (`GET /admin/users`), duplicate groups
 * (`GET /admin/users/duplicates`), and trust summaries (`POST /users/trust-summaries`).
 */
export const fetchAdminUsers = createAsyncThunk(
  'adminUsers/fetchAdminUsers',
  async (_arg, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const trustApi = resolveApiModule(trustApiModule, 'trustApi');

      const [usersRes, dupRes, countsRes] = await Promise.all([
        adminApi.listUsers(),
        typeof adminApi?.getDuplicateUsers === 'function'
          ? adminApi.getDuplicateUsers().catch(() => ({ groups: [] }))
          : Promise.resolve({ groups: [] }),
        typeof adminApi?.getUserCounts === 'function'
          ? adminApi.getUserCounts().catch(() => null)
          : Promise.resolve(null),
      ]);

      const users = Array.isArray(usersRes) ? usersRes : usersRes?.items || [];
      const duplicateGroups = Array.isArray(dupRes?.groups) ? dupRes.groups : [];

      let trustSummaries = [];
      if (users.length > 0 && typeof trustApi?.getTrustSummaries === 'function') {
        const userIds = users.map((u) => String(u?.id || '')).filter(Boolean).slice(0, 50);
        if (userIds.length > 0) {
          trustSummaries = await trustApi.getTrustSummaries(userIds).catch(() => []);
        }
      }

      return {
        users,
        duplicateGroups,
        userCounts: countsRes && typeof countsRes === 'object' ? countsRes : null,
        trustSummaries: Array.isArray(trustSummaries) ? trustSummaries : [],
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches single user details (`GET /admin/users/:id`) and recommendation badges.
 */
export const fetchAdminUserDetails = createAsyncThunk(
  'adminUsers/fetchAdminUserDetails',
  async (userId, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const mentorshipApi = resolveApiModule(mentorshipApiModule, 'mentorshipApi');
      const uid = String(userId);

      const [data, badgesData] = await Promise.all([
        adminApi.getUserDetails(uid),
        typeof mentorshipApi?.getBadges === 'function'
          ? mentorshipApi.getBadges(uid).catch(() => [])
          : Promise.resolve([]),
      ]);

      if (!data) return null;
      const rawBadges =
        Array.isArray(badgesData) && badgesData.length > 0
          ? badgesData
          : Array.isArray(data?.mentorRecommendations)
          ? data.mentorRecommendations
          : [];

      return {
        userId: uid,
        user: {
          ...data,
          id: String(data.id || uid),
          mentorRecommendations: rawBadges,
        },
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches paginated reputation ledger for a user (`GET /admin/users/:id/reputation`).
 */
export const fetchAdminUserReputation = createAsyncThunk(
  'adminUsers/fetchAdminUserReputation',
  async ({ userId, page = 1, limit = 20, type = 'all' }, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const uid = String(userId);
      if (typeof adminApi?.getUserReputation !== 'function') {
        return { userId: uid, items: [], total: 0, page, type };
      }
      const res = await adminApi.getUserReputation(uid, { page, limit, type });
      return {
        userId: uid,
        items: Array.isArray(res?.items) ? res.items : [],
        total: Number(res?.total) || 0,
        page,
        type,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Flags a user account (`PUT /admin/users/:id/flag`).
 */
export const flagAdminUser = createAsyncThunk(
  'adminUsers/flagAdminUser',
  async (userId, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const uid = String(userId);
      const res = await adminApi.flagUser(uid);
      return { userId: uid, result: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Updates a user's status (`PATCH /admin/users/:id/status`).
 */
export const updateAdminUserStatus = createAsyncThunk(
  'adminUsers/updateAdminUserStatus',
  async ({ userId, status }, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const uid = String(userId);
      const res = await adminApi.updateUserStatus(uid, { status });
      return { userId: uid, status, result: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches admin dashboard summary metrics (`GET /admin/stats`).
 */
export const fetchDashboardStats = createAsyncThunk(
  'adminUsers/fetchDashboardStats',
  async (_arg, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      if (typeof adminApi?.getStats !== 'function') return null;
      const stats = await adminApi.getStats();
      return stats || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
