import { useEffect, useRef } from 'react';
import {
  fetchChatUnread,
  fetchProjectMessages,
} from '../store/thunks/communicationThunks';

// Single module-scoped polling handles & visibility listeners (no browser storage, zero double loops)
let unreadPollIntervalId = null;
let unreadVisibilityHandler = null;
let unreadPausedWhileHidden = false;
let unreadLastPollMs = 0;
const activeUnreadPollCallbacks = new Set();

let messagesPollIntervalId = null;
let messagesVisibilityHandler = null;
let messagesPausedWhileHidden = false;
let messagesLastPollMs = 0;
const activeMessagesPollCallbacks = new Set();

export function getActiveChatUnreadPollHandle() {
  return unreadPollIntervalId;
}

export function getActiveChatUnreadSubscribersCount() {
  return activeUnreadPollCallbacks.size;
}

export function getActiveChatMessagesPollHandle() {
  return messagesPollIntervalId;
}

export function getActiveChatMessagesSubscribersCount() {
  return activeMessagesPollCallbacks.size;
}

export function resetChatPollingForTests() {
  if (unreadPollIntervalId !== null) {
    clearInterval(unreadPollIntervalId);
    unreadPollIntervalId = null;
  }
  if (unreadVisibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', unreadVisibilityHandler);
  }
  unreadVisibilityHandler = null;
  unreadPausedWhileHidden = false;
  unreadLastPollMs = 0;
  activeUnreadPollCallbacks.clear();

  if (messagesPollIntervalId !== null) {
    clearInterval(messagesPollIntervalId);
    messagesPollIntervalId = null;
  }
  if (messagesVisibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', messagesVisibilityHandler);
  }
  messagesVisibilityHandler = null;
  messagesPausedWhileHidden = false;
  messagesLastPollMs = 0;
  activeMessagesPollCallbacks.clear();
}

function runSingleUnreadPollTick() {
  if (typeof document !== 'undefined' && document.hidden) {
    unreadPausedWhileHidden = true;
    return;
  }
  unreadPausedWhileHidden = false;
  unreadLastPollMs = Date.now();
  const primaryTick = activeUnreadPollCallbacks.values().next().value;
  if (typeof primaryTick === 'function') {
    primaryTick();
  }
}

function runSingleMessagesPollTick() {
  if (typeof document !== 'undefined' && document.hidden) {
    messagesPausedWhileHidden = true;
    return;
  }
  messagesPausedWhileHidden = false;
  messagesLastPollMs = Date.now();
  const primaryTick = activeMessagesPollCallbacks.values().next().value;
  if (typeof primaryTick === 'function') {
    primaryTick();
  }
}

/**
 * Single-loop visibility-aware navbar chat unread polling hook.
 * Dispatches `fetchChatUnread` on `intervalMs`, pauses while `document.hidden`,
 * resumes on visibility, and cleans up on unmount or disabled/logout state.
 */
export function useChatUnreadPolling(
  dispatch,
  {
    userId,
    role,
    enabled = true,
    intervalMs = 60000,
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
      const payload = { force: true };
      if (role !== undefined) payload.role = role;
      if (userId !== undefined) payload.userId = userId;
      dispatchRef.current(fetchChatUnread(payload));
    };

    const wasEmpty = activeUnreadPollCallbacks.size === 0;
    activeUnreadPollCallbacks.add(tick);

    if (immediate && wasEmpty) {
      runSingleUnreadPollTick();
    }

    if (unreadPollIntervalId === null) {
      unreadPollIntervalId = setInterval(runSingleUnreadPollTick, intervalMs);
    }

    if (!unreadVisibilityHandler && typeof document !== 'undefined') {
      unreadPausedWhileHidden = Boolean(document.hidden);
      unreadVisibilityHandler = () => {
        if (document.hidden) {
          unreadPausedWhileHidden = true;
          return;
        }
        if (
          unreadPausedWhileHidden ||
          Date.now() - unreadLastPollMs >= visibleCooldownMs
        ) {
          runSingleUnreadPollTick();
        }
      };
      document.addEventListener('visibilitychange', unreadVisibilityHandler);
    }

    return () => {
      isMounted = false;
      activeUnreadPollCallbacks.delete(tick);
      if (activeUnreadPollCallbacks.size === 0) {
        if (unreadPollIntervalId !== null) {
          clearInterval(unreadPollIntervalId);
          unreadPollIntervalId = null;
        }
        if (unreadVisibilityHandler && typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', unreadVisibilityHandler);
          unreadVisibilityHandler = null;
        }
        unreadPausedWhileHidden = false;
      }
    };
  }, [enabled, intervalMs, immediate, userId, role, visibleCooldownMs]);
}

/**
 * Single-loop visibility-aware workspace project messages polling hook.
 * Dispatches `fetchProjectMessages` on `intervalMs`, pauses while `document.hidden`,
 * resumes on visibility, and cleans up on unmount or tab change.
 */
export function useChatMessagesPolling(
  dispatch,
  {
    projectId,
    enabled = true,
    intervalMs = 6000,
    immediate = false,
    visibleCooldownMs = 2000,
  } = {},
) {
  const dispatchRef = useRef(dispatch);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    if (
      !enabled ||
      !projectId ||
      !dispatchRef.current ||
      !intervalMs ||
      intervalMs <= 0
    ) {
      return undefined;
    }

    let isMounted = true;
    const tick = () => {
      if (!isMounted || typeof dispatchRef.current !== 'function') return;
      dispatchRef.current(
        fetchProjectMessages({ projectId, force: true }),
      );
    };

    const wasEmpty = activeMessagesPollCallbacks.size === 0;
    activeMessagesPollCallbacks.add(tick);

    if (immediate && wasEmpty) {
      runSingleMessagesPollTick();
    }

    if (messagesPollIntervalId === null) {
      messagesPollIntervalId = setInterval(runSingleMessagesPollTick, intervalMs);
    }

    if (!messagesVisibilityHandler && typeof document !== 'undefined') {
      messagesPausedWhileHidden = Boolean(document.hidden);
      messagesVisibilityHandler = () => {
        if (document.hidden) {
          messagesPausedWhileHidden = true;
          return;
        }
        if (
          messagesPausedWhileHidden ||
          Date.now() - messagesLastPollMs >= visibleCooldownMs
        ) {
          runSingleMessagesPollTick();
        }
      };
      document.addEventListener('visibilitychange', messagesVisibilityHandler);
    }

    return () => {
      isMounted = false;
      activeMessagesPollCallbacks.delete(tick);
      if (activeMessagesPollCallbacks.size === 0) {
        if (messagesPollIntervalId !== null) {
          clearInterval(messagesPollIntervalId);
          messagesPollIntervalId = null;
        }
        if (messagesVisibilityHandler && typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', messagesVisibilityHandler);
          messagesVisibilityHandler = null;
        }
        messagesPausedWhileHidden = false;
      }
    };
  }, [enabled, projectId, intervalMs, immediate, visibleCooldownMs]);
}
