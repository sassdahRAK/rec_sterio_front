/**
 * The app's single background-polling mechanism.
 *
 * Pages pass their loader (called with `silent = true` on every poll, so the
 * loader must skip the loading spinner in that mode) and get an interval that
 * also reacts to the tab becoming visible again and to the window regaining
 * focus — that is how a video the Telegram bot finished downloading shows up
 * without a manual Refresh.
 *
 * The callback is held in a ref and read at fire time, so callers do not need
 * useCallback or to include the loader in a dependency list; re-renders never
 * reset the interval timer.
 */
import { useEffect, useRef } from 'react';

export interface AutoRefreshOptions {
  /** Poll period in milliseconds. Default 15000. */
  intervalMs?: number;
  /** Set false to suspend polling entirely. Default true. */
  enabled?: boolean;
}

export function useAutoRefresh(
  refetch: (silent?: boolean) => unknown,
  { intervalMs = 15000, enabled = true }: AutoRefreshOptions = {},
): void {
  // Always the freshest closure; swapping it never restarts the timer.
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const fire = (): void => {
      void refetchRef.current(true);
    };
    const timer = window.setInterval(() => {
      // A hidden tab does not need updates; the visibilitychange handler
      // below refetches immediately once the user comes back.
      if (document.visibilityState === 'visible') fire();
    }, intervalMs);
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') fire();
    };
    const onFocus = (): void => {
      if (document.visibilityState === 'visible') fire();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [intervalMs, enabled]);
}

export default useAutoRefresh;
