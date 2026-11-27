import { useEffect, useRef } from 'react';
import { fetchUnreadCount } from '../store/thunks/notificationsThunks';

// Single module-scoped polling handle & visibility listener (no browser storage, zero double loops)
let activePollIntervalId = null;
let activeVisibilityHandler = null;
let pausedWhileHidden = false;
let moduleLastPollMs = 0;
const activePollCallbacks = new Set();

export function getActiveNotificationPollHandle() {
  return activePollIntervalId;
}

export function getActiveNotificationPollSubscribersCount() {
  return activePollCallbacks.size;
}

export function resetNotificationPollingForTests() {
  if (activePollIntervalId !== null) {
    clearInterval(activePollIntervalId);
    activePollIntervalId = null;
  }
  if (activeVisibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', activeVisibilityHandler);
  }
  activeVisibilityHandler = null;
  pausedWhileHidden = false;
  moduleLastPollMs = 0;
  activePollCallbacks.clear();
}

function runSingleActivePollTick() {
  if (typeof document !== 'undefined' && document.hidden) {
    pausedWhileHidden = true;
    return;
  }
  pausedWhileHidden = false;
  moduleLastPollMs = Date.now();
  const primaryTick = activePollCallbacks.values().next().value;
  if (typeof primaryTick === 'function') {
    primaryTick();
  }
}

/**
 * Single-loop visibility-aware notification unread polling hook.
 * Dispatches `fetchUnreadCount` via Redux store dispatch on an interval,
 * pauses while `document.hidden`, resumes cleanly on becoming visible,
 * and cleans up on unmount or disabled/logout state.
 */
export function useNotificationPolling(
  dispatch,
  {
    userId,
    enabled = true,
    intervalMs = 300000,
    immediate = true,
    visibleCooldownMs = 5000,
  } = {},
) {
  const dispatchRef = useRef(dispatch);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    if (!enabled || !dispatchRef.current || !intervalMs || intervalMs <= 0) {
      return undefined;
    }

    let isMounted = true;
    const tick = () => {
      if (!isMounted || typeof dispatchRef.current !== 'function') return;
      dispatchRef.current(fetchUnreadCount({ userId }));
    };

    const wasEmpty = activePollCallbacks.size === 0;
    activePollCallbacks.add(tick);

    if (immediate && wasEmpty) {
      runSingleActivePollTick();
    }

    if (activePollIntervalId === null) {
      activePollIntervalId = setInterval(runSingleActivePollTick, intervalMs);
    }

    if (!activeVisibilityHandler && typeof document !== 'undefined') {
      pausedWhileHidden = Boolean(document.hidden);
      activeVisibilityHandler = () => {
        if (document.hidden) {
          pausedWhileHidden = true;
          return;
        }
        if (
          pausedWhileHidden ||
          Date.now() - moduleLastPollMs >= visibleCooldownMs
        ) {
          runSingleActivePollTick();
        }
      };
      document.addEventListener('visibilitychange', activeVisibilityHandler);
    }

    return () => {
      isMounted = false;
      activePollCallbacks.delete(tick);
      if (activePollCallbacks.size === 0) {
        if (activePollIntervalId !== null) {
          clearInterval(activePollIntervalId);
          activePollIntervalId = null;
        }
        if (activeVisibilityHandler && typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', activeVisibilityHandler);
          activeVisibilityHandler = null;
        }
        pausedWhileHidden = false;
      }
    };
  }, [enabled, userId, intervalMs, immediate, visibleCooldownMs]);
}
