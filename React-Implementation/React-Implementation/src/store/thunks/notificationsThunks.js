import { createAsyncThunk } from '@reduxjs/toolkit';
import notificationsApi from '../../services/notificationsApi';
import { normalizeThunkError } from '../utils/thunkError';

export const NOTIFICATIONS_STALE_MS = 60 * 1000;

/** Counts unread notifications currently held in the slice entity map. */
export function countUnreadEntities(notifState) {
  const ids = Array.isArray(notifState?.ids) ? notifState.ids : [];
  const entities = notifState?.entities || {};
  let count = 0;
  for (const id of ids) {
    const item = entities[id];
    if (item && !item.isRead) {
      count += 1;
    }
  }
  return count;
}

/**
 * Determines whether the notifications list should fetch from backend:
 * true when invalidated, unread count diverges from loaded entities,
 * status is idle/failed, or cached data exceeded NOTIFICATIONS_STALE_MS.
 */
export function shouldRefreshNotifications(notifState, nowMs = Date.now()) {
  if (!notifState) return true;
  if (notifState.status === 'loading') return false;
  if (notifState.invalidated === true) return true;
  if ((notifState.unreadCount ?? 0) !== countUnreadEntities(notifState)) {
    return true;
  }
  if (notifState.status === 'idle' || notifState.status === 'failed') {
    return true;
  }
  if (notifState.lastFetchedAt) {
    const fetchedAtMs = Date.parse(notifState.lastFetchedAt);
    if (!Number.isFinite(fetchedAtMs)) {
      return true;
    }
    return nowMs - fetchedAtMs >= NOTIFICATIONS_STALE_MS;
  }
  return false;
}

export function normalizeNotificationEntity(item) {
  if (!item || typeof item !== 'object') return item;
  const isRead = Boolean(item.isRead ?? item.readStatus ?? false);
  const title =
    item.title ||
    (item.type ? String(item.type).replace(/_/g, ' ') : 'Notification');
  return {
    ...item,
    isRead,
    readStatus: isRead,
    title,
  };
}

export function extractServerUnreadCount(res) {
  if (typeof res === 'number' && Number.isFinite(res)) {
    return Math.max(0, res);
  }
  if (!res || typeof res !== 'object') {
    return null;
  }
  const candidate = res.unreadCount ?? res.unread ?? res.count;
  return typeof candidate === 'number' && Number.isFinite(candidate)
    ? Math.max(0, candidate)
    : null;
}

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const { userId, isRead, role } =
        arg && typeof arg === 'object' ? arg : {};
      const params = {};
      if (userId) params.userId = userId;
      if (isRead !== undefined) params.isRead = isRead;
      const response = await notificationsApi.list(params, role);
      const rawList = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];
      return rawList.map(normalizeNotificationEntity);
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      const opts = arg && typeof arg === 'object' ? arg : {};
      if (opts.force === true) {
        return true;
      }
      return shouldRefreshNotifications(getState()?.notifications);
    },
  },
);

export const fetchNotificationById = createAsyncThunk(
  'notifications/fetchNotificationById',
  async (arg, { rejectWithValue }) => {
    try {
      const id = typeof arg === 'object' ? arg?.id : arg;
      const role = typeof arg === 'object' ? arg?.role : undefined;
      const res = await notificationsApi.get(id, role);
      return normalizeNotificationEntity(res);
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const { role, userId } = arg && typeof arg === 'object' ? arg : {};
      const res = await notificationsApi.getUnreadCount(role, userId);
      const count = extractServerUnreadCount(res);
      return count !== null ? count : 0;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const markRead = createAsyncThunk(
  'notifications/markRead',
  async (arg, { dispatch, rejectWithValue }) => {
    const id = typeof arg === 'object' ? arg?.id : arg;
    const role = typeof arg === 'object' ? arg?.role : undefined;
    const userId = typeof arg === 'object' ? arg?.userId : undefined;
    try {
      const res = await notificationsApi.markAsRead(id, role);
      let serverUnread = extractServerUnreadCount(res);
      if (serverUnread === null) {
        try {
          const refetched = await dispatch(
            fetchUnreadCount({ role, userId }),
          ).unwrap();
          if (typeof refetched === 'number') {
            serverUnread = refetched;
          }
        } catch {
          // Keep optimistic unreadCount when count refetch is unavailable
        }
      }
      return {
        id,
        notification:
          res && typeof res === 'object' && res.id
            ? normalizeNotificationEntity({ ...res, isRead: true, readStatus: true })
            : null,
        unreadCount: serverUnread,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const markAllRead = createAsyncThunk(
  'notifications/markAllRead',
  async (arg = {}, { dispatch, rejectWithValue }) => {
    const { role, userId } = arg && typeof arg === 'object' ? arg : {};
    try {
      const res = await notificationsApi.markAllAsRead(role, userId);
      let serverUnread = extractServerUnreadCount(res);
      if (serverUnread === null) {
        try {
          const refetched = await dispatch(
            fetchUnreadCount({ role, userId }),
          ).unwrap();
          if (typeof refetched === 'number') {
            serverUnread = refetched;
          }
        } catch {
          // Fallback to 0 only if server neither returned unread nor responded to refetch
        }
      }
      return {
        result: res,
        unreadCount: serverUnread !== null ? serverUnread : 0,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const deleteNotification = createAsyncThunk(
  'notifications/deleteNotification',
  async (arg, { dispatch, rejectWithValue }) => {
    const id = typeof arg === 'object' ? arg?.id : arg;
    const role = typeof arg === 'object' ? arg?.role : undefined;
    const userId = typeof arg === 'object' ? arg?.userId : undefined;
    try {
      const res = await notificationsApi.remove(id, role);
      let serverUnread = extractServerUnreadCount(res);
      if (serverUnread === null) {
        try {
          const refetched = await dispatch(
            fetchUnreadCount({ role, userId }),
          ).unwrap();
          if (typeof refetched === 'number') {
            serverUnread = refetched;
          }
        } catch {
          // Keep optimistic unreadCount when count refetch is unavailable
        }
      }
      return {
        id,
        unreadCount: serverUnread,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
