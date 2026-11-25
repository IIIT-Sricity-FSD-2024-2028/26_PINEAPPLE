import { useEffect, useRef } from 'react';

/**
 * Single-loop visibility-aware polling hook.
 * - Ensures at most one interval exists per component mount.
 * - Pauses automatically when document.hidden is true.
 * - Optionally invokes callback when tab returns to visible after cooldownMs.
 * - Cleans up both interval and visibilitychange listener on unmount.
 */
export function useVisibilityPoll(
  callback,
  intervalMs,
  { enabled = true, immediate = false, triggerOnVisible = false, visibleCooldownMs = 5000 } = {},
) {
  const callbackRef = useRef(callback);
  const lastRunRef = useRef(0);
  const intervalIdRef = useRef(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !intervalMs || intervalMs <= 0) {
      return undefined;
    }

    let isActive = true;

    const invoke = () => {
      if (!isActive) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      lastRunRef.current = Date.now();
      callbackRef.current?.();
    };

    if (immediate) {
      invoke();
    }

    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    intervalIdRef.current = setInterval(invoke, intervalMs);

    const onVisibilityChange = () => {
      if (!isActive || typeof document === 'undefined' || document.hidden) return;
      if (triggerOnVisible && Date.now() - lastRunRef.current >= visibleCooldownMs) {
        invoke();
      }
    };

    const onStopPolls = () => {
      isActive = false;
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('teamforge:stop_polls', onStopPolls);
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      isActive = false;
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('teamforge:stop_polls', onStopPolls);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [enabled, intervalMs, immediate, triggerOnVisible, visibleCooldownMs]);
}

export default useVisibilityPoll;
