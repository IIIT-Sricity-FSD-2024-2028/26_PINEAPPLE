import { createAsyncThunk } from '@reduxjs/toolkit';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import mentorRequestsApi from '../../services/mentorRequestsApi';
import projectsApi from '../../services/projectsApi';
import { isProjectActive, isProjectLocked } from '../../utils/projectStatus';
import { normalizeThunkError } from '../utils/thunkError';

export const MENTOR_SESSIONS_STALE_MS = 15 * 1000;

/**
 * Fetches owner's booked sessions (`GET /mentor-marketplace/sessions/mine`).
 */
export const fetchMySessions = createAsyncThunk(
  'mentorSessions/fetchMySessions',
  async (arg = {}, { rejectWithValue }) => {
    try {
      if (typeof mentorMarketplaceApi?.mySessions !== 'function') {
        return [];
      }
      const res =
        arg?.role !== undefined
          ? await mentorMarketplaceApi.mySessions(arg.role)
          : await mentorMarketplaceApi.mySessions();
      return Array.isArray(res) ? res : [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      if (arg?.force === true) return true;
      const slice = getState()?.mentorSessions;
      if (!slice) return true;
      if (slice.mySessionsStatus === 'loading') return false;
      if (slice.mySessionsLastFetchedAt) {
        const parsed = Date.parse(slice.mySessionsLastFetchedAt);
        if (
          Number.isFinite(parsed) &&
          Date.now() - parsed < MENTOR_SESSIONS_STALE_MS
        ) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Fetches mentor's incoming/assigned sessions (`GET /mentor-marketplace/sessions/mentor-view`).
 */
export const fetchMentorSessions = createAsyncThunk(
  'mentorSessions/fetchMentorSessions',
  async (arg = {}, { rejectWithValue }) => {
    try {
      if (typeof mentorMarketplaceApi?.mentorSessions !== 'function') {
        return [];
      }
      const res =
        arg?.role !== undefined
          ? await mentorMarketplaceApi.mentorSessions(arg.role)
          : await mentorMarketplaceApi.mentorSessions();
      return Array.isArray(res)
        ? res
        : res && typeof res === 'object'
        ? res
        : [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      if (arg?.force === true) return true;
      const slice = getState()?.mentorSessions;
      if (!slice) return true;
      if (slice.mentorSessionsStatus === 'loading') return false;
      if (slice.mentorSessionsLastFetchedAt) {
        const parsed = Date.parse(slice.mentorSessionsLastFetchedAt);
        if (
          Number.isFinite(parsed) &&
          Date.now() - parsed < MENTOR_SESSIONS_STALE_MS
        ) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Fetches mentored projects (`GET /mentor-marketplace/mentored-projects`).
 * Stores server `items` and `counts` directly without recomputing; retains partial-mock
 * fallback for legacy test environments where `getMentoredProjects` is omitted.
 */
export const fetchMentoredProjects = createAsyncThunk(
  'mentorSessions/fetchMentoredProjects',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const { user, role } = arg || {};

      let backendRes = null;
      if (typeof mentorMarketplaceApi?.getMentoredProjects === 'function') {
        try {
          backendRes =
            role !== undefined
              ? await mentorMarketplaceApi.getMentoredProjects(role)
              : await mentorMarketplaceApi.getMentoredProjects();
        } catch {
          backendRes = null;
        }
      }

      if (backendRes && Array.isArray(backendRes.items)) {
        const items = backendRes.items;
        const counts = backendRes.counts || {
          all: items.length,
          active: items.filter((p) => p?.tab === 'active').length,
          completed: items.filter((p) => p?.tab === 'completed').length,
        };
        return {
          items,
          counts,
          fromServer: true,
        };
      }

      // Fallback for partial-mock legacy suites
      const [allProjects, mentorReqs, marketplaceSessions] = await Promise.all([
        typeof projectsApi?.list === 'function'
          ? projectsApi.list().catch(() => [])
          : [],
        typeof mentorRequestsApi?.list === 'function'
          ? mentorRequestsApi.list().catch(() => [])
          : [],
        typeof mentorMarketplaceApi?.mentorSessions === 'function'
          ? mentorMarketplaceApi.mentorSessions().catch(() => [])
          : [],
      ]);

      const currentUserName = (user?.name || user?.username || '')
        .trim()
        .toLowerCase();
      const currentUserId = String(user?.id || '').trim();
      const currentUserEmail = String(user?.email || '')
        .trim()
        .toLowerCase();

      const approvedProjectIds = new Set();

      if (Array.isArray(mentorReqs)) {
        mentorReqs.forEach((req) => {
          const reqStatus = String(req?.status || '').toLowerCase();
          const reqMentorId = String(req?.mentorId || '').trim();
          const reqMentorEmail = String(req?.mentorEmail || '')
            .trim()
            .toLowerCase();
          const reqMentorName = String(req?.mentorName || '')
            .trim()
            .toLowerCase();

          const isMyMentorReq =
            (currentUserId && reqMentorId === currentUserId) ||
            (currentUserEmail && reqMentorEmail === currentUserEmail) ||
            (currentUserName && reqMentorName === currentUserName);

          if (
            (reqStatus === 'accepted' || reqStatus === 'approved') &&
            isMyMentorReq &&
            req?.projectId
          ) {
            approvedProjectIds.add(String(req.projectId));
          }
        });
      }

      if (Array.isArray(marketplaceSessions)) {
        marketplaceSessions.forEach((s) => {
          const sStatus = String(s?.status || '').toLowerCase();
          const sessionMentorId = String(s?.mentorId || '').trim();
          const sessionMentorEmail = String(s?.mentorEmail || '')
            .trim()
            .toLowerCase();

          const isMySession =
            (currentUserId && sessionMentorId === currentUserId) ||
            (currentUserEmail && sessionMentorEmail === currentUserEmail);

          if (
            ['active', 'completed', 'in_progress', 'accepted'].includes(
              sStatus,
            ) &&
            isMySession &&
            s?.projectId
          ) {
            approvedProjectIds.add(String(s.projectId));
          }
        });
      }

      const projectsList = Array.isArray(allProjects) ? allProjects : [];
      const filtered = projectsList.filter((project) => {
        const projId = String(project?.id || '');
        if (approvedProjectIds.has(projId)) return true;

        if (Array.isArray(project?.members)) {
          const isMemberMentor = project.members.some((member) => {
            const memberRole = String(member?.role || '')
              .trim()
              .toLowerCase();
            if (memberRole !== 'mentor') return false;

            const memberId = String(member?.userId || member?.id || '').trim();
            const memberEmail = String(member?.email || '')
              .trim()
              .toLowerCase();
            const memberName = String(member?.name || '')
              .trim()
              .toLowerCase();

            return (
              (currentUserId && memberId === currentUserId) ||
              (currentUserEmail && memberEmail === currentUserEmail) ||
              (currentUserName && memberName === currentUserName)
            );
          });
          if (isMemberMentor) return true;
        }

        if (project?.mentor) {
          const mentorObj =
            typeof project.mentor === 'object' ? project.mentor : null;
          const mentorName = String(mentorObj?.name || project.mentor)
            .trim()
            .toLowerCase();
          const mentorId = String(
            mentorObj?.userId || mentorObj?.id || '',
          ).trim();
          const mentorEmail = String(mentorObj?.email || '')
            .trim()
            .toLowerCase();

          return (
            (currentUserId && mentorId === currentUserId) ||
            (currentUserEmail && mentorEmail === currentUserEmail) ||
            (currentUserName && mentorName === currentUserName)
          );
        }

        return false;
      });

      const activeCount = filtered.filter((p) => isProjectActive(p)).length;
      const completedCount = filtered.filter((p) => isProjectLocked(p)).length;

      return {
        items: filtered,
        counts: {
          all: filtered.length,
          active: activeCount,
          completed: completedCount,
        },
        fromServer: false,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches all sessions (Admin: `GET /mentor-marketplace/sessions`).
 */
export const fetchAllSessionsAdmin = createAsyncThunk(
  'mentorSessions/fetchAllSessionsAdmin',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const res =
        arg?.role !== undefined
          ? await mentorMarketplaceApi.allSessions(arg.role)
          : await mentorMarketplaceApi.allSessions();
      return Array.isArray(res) ? res : [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches session revenue stats (Admin: `GET /mentor-marketplace/sessions/admin-stats`).
 */
export const fetchSessionAdminStats = createAsyncThunk(
  'mentorSessions/fetchSessionAdminStats',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const res =
        arg?.role !== undefined
          ? await mentorMarketplaceApi.adminStats(arg.role)
          : await mentorMarketplaceApi.adminStats();
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Books a mentor session (`POST /mentor-marketplace/sessions/book`).
 */
export const bookMentorSession = createAsyncThunk(
  'mentorSessions/bookMentorSession',
  async ({ payload, role }, { dispatch, rejectWithValue }) => {
    try {
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.bookSession(payload, role)
          : await mentorMarketplaceApi.bookSession(payload);
      if (typeof mentorMarketplaceApi?.mySessions === 'function') {
        await dispatch(fetchMySessions({ force: true, ...(role !== undefined ? { role } : {}) }));
      }
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Mentor accepts an escrow-funded booking (`POST /mentor-marketplace/sessions/:id/accept`).
 */
export const acceptMentorSession = createAsyncThunk(
  'mentorSessions/acceptMentorSession',
  async (arg, { dispatch, rejectWithValue }) => {
    try {
      const opts =
        typeof arg === 'object' && arg !== null ? arg : { sessionId: arg };
      const sessionId = String(opts.sessionId || opts.id);
      const res =
        opts.role !== undefined
          ? await mentorMarketplaceApi.acceptSession(sessionId, opts.role)
          : await mentorMarketplaceApi.acceptSession(sessionId);

      if (typeof mentorMarketplaceApi?.getMentoredProjects === 'function') {
        await dispatch(fetchMentoredProjects({ force: true }));
      }
      return {
        sessionId,
        session: res && typeof res === 'object' ? res : null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Mentor declines an escrow-funded booking (`POST /mentor-marketplace/sessions/:id/decline`).
 */
export const declineMentorSession = createAsyncThunk(
  'mentorSessions/declineMentorSession',
  async ({ sessionId, payload, role }, { dispatch, rejectWithValue }) => {
    try {
      const sid = String(sessionId);
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.declineSession(sid, payload, role)
          : await mentorMarketplaceApi.declineSession(sid, payload);

      if (typeof mentorMarketplaceApi?.getMentoredProjects === 'function') {
        await dispatch(fetchMentoredProjects({ force: true }));
      }
      return {
        sessionId: sid,
        payload,
        session: res && typeof res === 'object' ? res : null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Owner/Admin cancels a session (`POST /mentor-marketplace/sessions/:id/cancel`).
 */
export const cancelMentorSession = createAsyncThunk(
  'mentorSessions/cancelMentorSession',
  async ({ sessionId, payload, role }, { dispatch, rejectWithValue }) => {
    try {
      const sid = String(sessionId);
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.cancelSession(sid, payload, role)
          : payload !== undefined
            ? await mentorMarketplaceApi.cancelSession(sid, payload)
            : await mentorMarketplaceApi.cancelSession(sid);

      if (typeof mentorMarketplaceApi?.getMentoredProjects === 'function') {
        await dispatch(fetchMentoredProjects({ force: true }));
      }
      return {
        sessionId: sid,
        session: res && typeof res === 'object' ? res : null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Owner/Admin completes a session (`POST /mentor-marketplace/sessions/:id/complete`).
 */
export const completeMentorSession = createAsyncThunk(
  'mentorSessions/completeMentorSession',
  async ({ sessionId, role }, { dispatch, rejectWithValue }) => {
    try {
      const sid = String(sessionId);
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.completeSession(sid, role)
          : await mentorMarketplaceApi.completeSession(sid);
      if (typeof mentorMarketplaceApi?.getMentoredProjects === 'function') {
        await dispatch(fetchMentoredProjects({ force: true }));
      }
      return {
        sessionId: sid,
        session: res && typeof res === 'object' ? res : null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Admin starts an escrow-funded session (`POST /mentor-marketplace/sessions/:id/start`).
 */
export const startMentorSession = createAsyncThunk(
  'mentorSessions/startMentorSession',
  async ({ sessionId, role }, { rejectWithValue }) => {
    try {
      const sid = String(sessionId);
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.startSession(sid, role)
          : await mentorMarketplaceApi.startSession(sid);
      return {
        sessionId: sid,
        session: res && typeof res === 'object' ? res : null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Submits legacy star review on completed session (`POST /mentor-marketplace/sessions/:id/review`).
 */
export const reviewMentorSession = createAsyncThunk(
  'mentorSessions/reviewMentorSession',
  async ({ sessionId, payload, role }, { dispatch, rejectWithValue }) => {
    try {
      const sid = String(sessionId);
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.submitReview(sid, payload, role)
          : await mentorMarketplaceApi.submitReview(sid, payload);
      if (typeof mentorMarketplaceApi?.getMentoredProjects === 'function') {
        await dispatch(fetchMentoredProjects({ force: true }));
      }
      return {
        sessionId: sid,
        review: res || null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Retries escrow payout for payout_pending session (`POST /mentor-marketplace/sessions/:id/retry-payout`).
 */
export const retrySessionPayout = createAsyncThunk(
  'mentorSessions/retrySessionPayout',
  async ({ sessionId, role }, { rejectWithValue }) => {
    try {
      const sid = String(sessionId);
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.retryPayout(sid, role)
          : await mentorMarketplaceApi.retryPayout(sid);
      return {
        sessionId: sid,
        session: res && typeof res === 'object' ? res : null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Saves session note and records mentor activity (`POST /mentor-sessions/:id/notes`).
 */
export const addMentorSessionNote = createAsyncThunk(
  'mentorSessions/addMentorSessionNote',
  async ({ sessionId, note, role }, { rejectWithValue }) => {
    try {
      const sid = String(sessionId);
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.addSessionNote(sid, note, role)
          : await mentorMarketplaceApi.addSessionNote(sid, note);
      return {
        sessionId: sid,
        session: res && typeof res === 'object' ? res : null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
