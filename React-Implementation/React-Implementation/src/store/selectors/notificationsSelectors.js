import { createSelector } from '@reduxjs/toolkit';
import { notificationsAdapter } from '../slices/notificationsSlice';
import { shouldRefreshNotifications } from '../thunks/notificationsThunks';

const adapterSelectors = notificationsAdapter.getSelectors(
  (state) => state?.notifications || { ids: [], entities: {} },
);

export const selectAllNotifications = adapterSelectors.selectAll;
export const selectNotificationById = adapterSelectors.selectById;
export const selectNotificationIds = adapterSelectors.selectIds;
export const selectTotalNotificationsCount = adapterSelectors.selectTotal;

export const selectUnreadNotificationsCount = (state) =>
  state?.notifications?.unreadCount ?? 0;

export const selectNotificationsStatus = (state) =>
  state?.notifications?.status ?? 'idle';

export const selectNotificationsError = (state) =>
  state?.notifications?.error ?? null;

export const selectNotificationsLastFetchedAt = (state) =>
  state?.notifications?.lastFetchedAt ?? null;

export const selectNotificationsInvalidated = (state) =>
  Boolean(state?.notifications?.invalidated);

export const selectNotificationsNeedsRefresh = (state) =>
  shouldRefreshNotifications(state?.notifications);

const EMPTY_NOTIFICATION_WORKING = Object.freeze({
  readFilter: 'all',
  filterType: 'all',
  selectedNotificationId: null,
  expandedGroupIds: {},
  isMarkingAllRead: false,
  markAllError: null,
});

export const selectNotificationWorking = (state) =>
  state?.notifications?.working || EMPTY_NOTIFICATION_WORKING;

export const selectFilteredNotifications = createSelector(
  [selectAllNotifications, selectNotificationWorking],
  (items, working) => {
    const readFilter = working?.readFilter || 'all';
    const filterType = working?.filterType || 'all';
    return items.filter((item) => {
      if (readFilter === 'unread' && item.isRead) return false;
      if (readFilter === 'read' && !item.isRead) return false;
      if (
        filterType !== 'all' &&
        String(item.type || '').toLowerCase() !== String(filterType).toLowerCase()
      ) {
        return false;
      }
      return true;
    });
  },
);

export const selectSelectedNotificationId = (state) =>
  state?.notifications?.working?.selectedNotificationId ?? null;

export const selectExpandedGroupIds = (state) =>
  state?.notifications?.working?.expandedGroupIds || {};

export const selectIsMarkingAllRead = (state) =>
  Boolean(state?.notifications?.working?.isMarkingAllRead);

export const selectMarkAllError = (state) =>
  state?.notifications?.working?.markAllError ?? null;
