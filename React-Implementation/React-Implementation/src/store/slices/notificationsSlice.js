import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  countUnreadEntities,
  deleteNotification,
  fetchNotificationById,
  fetchNotifications,
  fetchUnreadCount,
  markAllRead,
  markRead,
  normalizeNotificationEntity,
} from '../thunks/notificationsThunks';

export const notificationsAdapter = createEntityAdapter({
  selectId: (notification) => String(notification.id),
});

export function createInitialNotificationWorking() {
  return {
    readFilter: 'all', // 'all' | 'unread' | 'read'
    filterType: 'all',
    selectedNotificationId: null,
    expandedGroupIds: {},
    isMarkingAllRead: false,
    markAllError: null,
  };
}

function createInitialNotificationsState() {
  return notificationsAdapter.getInitialState({
    unreadCount: 0,
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
    lastFetchedAt: null,
    invalidated: false,
    working: createInitialNotificationWorking(),
    optimisticSnapshots: {},
  });
}

function syncServerUnreadCount(state, serverCount, invalidateOnTransition = false) {
  if (typeof serverCount !== 'number' || !Number.isFinite(serverCount)) {
    return;
  }
  const nextUnread = Math.max(0, serverCount);
  const loadedUnread = countUnreadEntities(state);
  if (
    nextUnread !== loadedUnread ||
    (invalidateOnTransition && nextUnread !== state.unreadCount)
  ) {
    state.invalidated = true;
  }
  state.unreadCount = nextUnread;
}

function clearWorkingNotificationsState(state) {
  state.working = {
    ...createInitialNotificationWorking(),
    isMarkingAllRead: state.working?.isMarkingAllRead ?? false,
  };
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: createInitialNotificationsState(),
  reducers: {
    // 4 Required Repository CRUD Reducers (Requirements 2 & 3, Decision D2)
    setAll(state, action) {
      const items = Array.isArray(action.payload)
        ? action.payload.map(normalizeNotificationEntity)
        : [];
      notificationsAdapter.setAll(state, items);
      state.invalidated = false;
      state.unreadCount = countUnreadEntities(state);
    },
    addOne(state, action) {
      const normalized = normalizeNotificationEntity(action.payload);
      if (!normalized || normalized.id === undefined) return;
      const key = String(normalized.id);
      const existed = Boolean(state.entities[key]);
      notificationsAdapter.addOne(state, normalized);
      if (!existed && !normalized.isRead) {
        state.unreadCount += 1;
      }
    },
    updateOne(state, action) {
      const payload = action.payload || {};
      const key = payload.id !== undefined ? String(payload.id) : null;
      if (!key || !state.entities[key]) return;
      const prevUnread = !state.entities[key].isRead;
      const rawChanges = payload.changes || {};
      const nextChanges = { ...rawChanges };
      if (
        rawChanges.isRead !== undefined ||
        rawChanges.readStatus !== undefined
      ) {
        const nextRead = Boolean(
          rawChanges.isRead ?? rawChanges.readStatus ?? false,
        );
        nextChanges.isRead = nextRead;
        nextChanges.readStatus = nextRead;
      }
      notificationsAdapter.updateOne(state, { id: key, changes: nextChanges });
      const nowUnread = !state.entities[key].isRead;
      if (prevUnread && !nowUnread) {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      } else if (!prevUnread && nowUnread) {
        state.unreadCount += 1;
      }
    },
    removeOne(state, action) {
      const rawId =
        typeof action.payload === 'object' ? action.payload?.id : action.payload;
      if (rawId === undefined || rawId === null) return;
      const key = String(rawId);
      const existing = state.entities[key];
      notificationsAdapter.removeOne(state, key);
      if (existing && !existing.isRead) {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },

    // Page working-state reducers (cleared automatically on routeChanged)
    setNotificationFilter(state, action) {
      const { readFilter, filterType } = action.payload || {};
      if (readFilter !== undefined) {
        state.working.readFilter = readFilter;
      }
      if (filterType !== undefined) {
        state.working.filterType = filterType;
      }
    },
    setSelectedNotificationId(state, action) {
      state.working.selectedNotificationId =
        action.payload !== undefined && action.payload !== null
          ? String(action.payload)
          : null;
    },
    toggleGroupExpanded(state, action) {
      const key = String(action.payload ?? '');
      if (!key) return;
      if (!state.working) state.working = createInitialNotificationWorking();
      if (!state.working.expandedGroupIds) state.working.expandedGroupIds = {};
      if (state.working.expandedGroupIds[key]) {
        delete state.working.expandedGroupIds[key];
      } else {
        state.working.expandedGroupIds[key] = true;
      }
    },
    clearMarkAllError(state) {
      state.working.markAllError = null;
    },
    clearWorkingState: clearWorkingNotificationsState,
    invalidateNotifications(state) {
      state.invalidated = true;
    },
    resetSlice() {
      return createInitialNotificationsState();
    },
  },
  extraReducers: (builder) => {
    addRouteReset(builder, clearWorkingNotificationsState);
    builder.addCase(sessionReset, () => createInitialNotificationsState());

    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        notificationsAdapter.setAll(state, action.payload || []);
        state.status = 'succeeded';
        state.error = null;
        state.lastFetchedAt = new Date().toISOString();
        state.invalidated = false;
        state.unreadCount = countUnreadEntities(state);
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.status = 'failed';
        state.invalidated = false;
        state.error = action.payload || {
          message: action.error?.message || 'Failed to load notifications.',
        };
      })
      .addCase(fetchNotificationById.fulfilled, (state, action) => {
        if (action.payload?.id !== undefined) {
          notificationsAdapter.upsertOne(state, action.payload);
        }
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        syncServerUnreadCount(state, action.payload, true);
      })

      // Optimistic markRead with full rollback on reject
      .addCase(markRead.pending, (state, action) => {
        const rawId =
          typeof action.meta.arg === 'object'
            ? action.meta.arg?.id
            : action.meta.arg;
        const key = String(rawId ?? '');
        const existing = state.entities[key];
        state.optimisticSnapshots[action.meta.requestId] = {
          type: 'markRead',
          id: key,
          prevEntity: existing ? { ...existing } : null,
          prevUnreadCount: state.unreadCount,
        };
        if (existing && !existing.isRead) {
          notificationsAdapter.updateOne(state, {
            id: key,
            changes: { isRead: true, readStatus: true },
          });
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markRead.fulfilled, (state, action) => {
        delete state.optimisticSnapshots[action.meta.requestId];
        if (action.payload?.notification?.id !== undefined) {
          notificationsAdapter.upsertOne(state, action.payload.notification);
        }
        syncServerUnreadCount(state, action.payload?.unreadCount);
      })
      .addCase(markRead.rejected, (state, action) => {
        const snap = state.optimisticSnapshots[action.meta.requestId];
        delete state.optimisticSnapshots[action.meta.requestId];
        if (snap) {
          if (snap.prevEntity) {
            notificationsAdapter.upsertOne(state, snap.prevEntity);
          }
          state.unreadCount = snap.prevUnreadCount;
        }
        state.error = action.payload || {
          message: action.error?.message || 'Failed to mark notification as read.',
        };
      })

      // Optimistic markAllRead with full rollback on reject
      .addCase(markAllRead.pending, (state, action) => {
        const prevReadById = {};
        for (const id of state.ids) {
          const item = state.entities[id];
          if (item) {
            prevReadById[id] = {
              isRead: Boolean(item.isRead),
              readStatus: Boolean(item.readStatus),
            };
          }
        }
        state.optimisticSnapshots[action.meta.requestId] = {
          type: 'markAllRead',
          prevReadById,
          prevUnreadCount: state.unreadCount,
        };
        state.working.isMarkingAllRead = true;
        state.working.markAllError = null;
        for (const id of state.ids) {
          if (state.entities[id]) {
            state.entities[id].isRead = true;
            state.entities[id].readStatus = true;
          }
        }
        state.unreadCount = 0;
      })
      .addCase(markAllRead.fulfilled, (state, action) => {
        delete state.optimisticSnapshots[action.meta.requestId];
        state.working.isMarkingAllRead = false;
        state.working.markAllError = null;
        for (const id of state.ids) {
          if (state.entities[id]) {
            state.entities[id].isRead = true;
            state.entities[id].readStatus = true;
          }
        }
        syncServerUnreadCount(
          state,
          typeof action.payload?.unreadCount === 'number'
            ? action.payload.unreadCount
            : 0,
        );
      })
      .addCase(markAllRead.rejected, (state, action) => {
        const snap = state.optimisticSnapshots[action.meta.requestId];
        delete state.optimisticSnapshots[action.meta.requestId];
        if (snap) {
          for (const [id, prevFlags] of Object.entries(snap.prevReadById || {})) {
            if (state.entities[id]) {
              state.entities[id].isRead = prevFlags.isRead;
              state.entities[id].readStatus = prevFlags.readStatus;
            }
          }
          state.unreadCount = snap.prevUnreadCount;
        }
        state.working.isMarkingAllRead = false;
        const errObj = action.payload || {
          message:
            action.error?.message ||
            'Failed to mark all notifications as read. Please try again.',
        };
        state.working.markAllError = errObj.message;
        state.error = errObj;
      })

      // Optimistic deleteNotification with full rollback on reject
      .addCase(deleteNotification.pending, (state, action) => {
        const rawId =
          typeof action.meta.arg === 'object'
            ? action.meta.arg?.id
            : action.meta.arg;
        const key = String(rawId ?? '');
        const existing = state.entities[key];
        const prevIndex = state.ids.indexOf(key);
        state.optimisticSnapshots[action.meta.requestId] = {
          type: 'delete',
          id: key,
          prevEntity: existing ? { ...existing } : null,
          prevIndex,
          prevUnreadCount: state.unreadCount,
        };
        if (existing) {
          notificationsAdapter.removeOne(state, key);
          if (!existing.isRead) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
        }
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        delete state.optimisticSnapshots[action.meta.requestId];
        syncServerUnreadCount(state, action.payload?.unreadCount);
      })
      .addCase(deleteNotification.rejected, (state, action) => {
        const snap = state.optimisticSnapshots[action.meta.requestId];
        delete state.optimisticSnapshots[action.meta.requestId];
        if (snap) {
          if (snap.prevEntity) {
            notificationsAdapter.upsertOne(state, snap.prevEntity);
            if (snap.prevIndex >= 0) {
              const filtered = state.ids.filter((itemId) => itemId !== snap.id);
              filtered.splice(snap.prevIndex, 0, snap.id);
              state.ids = filtered;
            }
          }
          state.unreadCount = snap.prevUnreadCount;
        }
        state.error = action.payload || {
          message: action.error?.message || 'Failed to delete notification.',
        };
      });
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setNotificationFilter,
  setSelectedNotificationId,
  toggleGroupExpanded,
  clearMarkAllError,
  clearWorkingState,
  invalidateNotifications,
  resetSlice,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
