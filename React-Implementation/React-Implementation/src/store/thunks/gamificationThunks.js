import { createAsyncThunk } from '@reduxjs/toolkit';
import * as leaderboardApiModule from '../../services/leaderboardApi';
import * as gamificationApiModule from '../../services/gamificationApi';
import * as mentorshipApiModule from '../../services/mentorshipApi';
import { resolveApiForMethod } from '../utils/apiModule';
import { normalizeThunkError } from '../utils/thunkError';

/**
 * Fetches community leaderboard rows (`GET /leaderboard`).
 */
export const fetchLeaderboard = createAsyncThunk(
  'gamification/fetchLeaderboard',
  async ({ period = 'alltime', tab = 'xp', limit, role } = {}, { rejectWithValue }) => {
    try {
      const leaderboardApi = resolveApiForMethod(leaderboardApiModule, 'leaderboardApi', 'getLeaderboard');
      const res = await leaderboardApi.getLeaderboard(
        { period, tab, ...(limit ? { limit } : {}) },
        role,
      );
      const items = Array.isArray(res) ? res : res?.items || res?.data || [];
      return { items, period, tab };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches a specific user's leaderboard standing (`GET /leaderboard/:userId`).
 */
export const fetchUserRank = createAsyncThunk(
  'gamification/fetchUserRank',
  async ({ userId, period, role } = {}, { rejectWithValue }) => {
    try {
      const leaderboardApi = resolveApiForMethod(leaderboardApiModule, 'leaderboardApi', 'getUserRank');
      const uid = String(userId || '').trim();
      if (!uid || typeof leaderboardApi?.getUserRank !== 'function') return null;
      const res = await leaderboardApi.getUserRank(uid, { period }, role);
      return { userId: uid, rank: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches a user's gamification stats (`GET /gamification/:userId/stats`).
 */
export const fetchGamificationStats = createAsyncThunk(
  'gamification/fetchGamificationStats',
  async ({ userId, period, role } = {}, { rejectWithValue }) => {
    try {
      const gamificationApi = resolveApiForMethod(gamificationApiModule, 'gamificationApi', 'getUserStats');
      const uid = String(userId || '').trim();
      if (!uid || typeof gamificationApi?.getUserStats !== 'function') {
        return { userId: uid, stats: null };
      }
      const res = await gamificationApi.getUserStats(uid, { period }, role);
      return { userId: uid, stats: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches a user's XP ledger (`GET /gamification/:userId/ledger`).
 */
export const fetchGamificationLedger = createAsyncThunk(
  'gamification/fetchGamificationLedger',
  async (arg, { rejectWithValue }) => {
    try {
      const gamificationApi = resolveApiForMethod(gamificationApiModule, 'gamificationApi', 'getUserLedger');
      const userId = typeof arg === 'object' ? arg?.userId : arg;
      const role = typeof arg === 'object' ? arg?.role : undefined;
      const uid = String(userId || '').trim();
      if (!uid || typeof gamificationApi?.getUserLedger !== 'function') {
        return { userId: uid, items: [] };
      }
      const res = await gamificationApi.getUserLedger(uid, role);
      const items = Array.isArray(res) ? res : res?.items || res?.data || [];
      return { userId: uid, items };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches mentorship recommendation badges for a user (`GET /mentorship/badges/:userId`).
 */
export const fetchUserBadges = createAsyncThunk(
  'gamification/fetchUserBadges',
  async (arg, { rejectWithValue }) => {
    try {
      const mentorshipApi = resolveApiForMethod(mentorshipApiModule, 'mentorshipApi', 'getBadges');
      const userId = typeof arg === 'object' ? arg?.userId : arg;
      const role = typeof arg === 'object' ? arg?.role : undefined;
      const uid = String(userId || '').trim();
      if (!uid || typeof mentorshipApi?.getBadges !== 'function') {
        return { userId: uid, badges: [] };
      }
      const res = await mentorshipApi.getBadges(uid, role);
      const badges = Array.isArray(res) ? res : res?.items || res?.data || [];
      return { userId: uid, badges };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches mentorship recommendation badges awarded for a specific project (`GET /mentorship/badges/project/:projectId`).
 */
export const fetchBadgesByProject = createAsyncThunk(
  'gamification/fetchBadgesByProject',
  async (arg, { rejectWithValue }) => {
    try {
      const mentorshipApi = resolveApiForMethod(mentorshipApiModule, 'mentorshipApi', 'getBadgesByProject');
      const projectId = typeof arg === 'object' ? arg?.projectId : arg;
      const role = typeof arg === 'object' ? arg?.role : undefined;
      const pid = String(projectId || '').trim();
      if (!pid || typeof mentorshipApi?.getBadgesByProject !== 'function') {
        return { projectId: pid, badges: [] };
      }
      const res = await mentorshipApi.getBadgesByProject(pid, role);
      const badges = Array.isArray(res) ? res : res?.items || res?.data || [];
      return { projectId: pid, badges };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Issues a mentor recommendation badge (`POST /mentorship/badge`).
 */
export const issueMentorBadge = createAsyncThunk(
  'gamification/issueMentorBadge',
  async ({ payload, role } = {}, { rejectWithValue }) => {
    try {
      const mentorshipApi = resolveApiForMethod(mentorshipApiModule, 'mentorshipApi', 'issueBadge');
      const res = await mentorshipApi.issueBadge(payload, role);
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
