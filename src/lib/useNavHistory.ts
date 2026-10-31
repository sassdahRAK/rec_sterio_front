import { useEffect, useRef, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom';

/**
 * In-app back / forward history for the console chrome.
 *
 * The browser's own back button can leave this app entirely (history.length
 * counts entries from other sites), so the header buttons track *in-app*
 * navigation only:
 *
 *  - PUSH  (every in-app link click / navigate()) — the page we just left
 *    goes on `past`, `future` is cleared (a new branch invalidates redo).
 *  - POP   (a back/forward) — only trusted when WE started it; a `pendingPop`
 *    flag moves entries between the stacks. An unsignalled POP means the user
 *    used the browser's own back/forward: the stacks can no longer be aligned
 *    with real history positions, so both are cleared and the buttons disabled
 *    until the next in-app PUSH. That is what makes `goForward()` safe: it
 *    only calls `navigate(1)` when our `future` stack proves an in-app entry
 *    exists ahead of us, so the button can never push the session out of the
 *    app into some other site's page.
 *  - REPLACE (auth redirects, login/logout) — history position is unchanged,
 *    so the stacks are left alone.
 *
 * On first mount both stacks start empty regardless of `history.length`, so
 * Back is disabled when the console is the deepest fresh entry.
 */

export interface NavHistory {
  goBack: () => void;
  goForward: () => void;
  canBack: boolean;
  canForward: boolean;
}

export function useNavHistory(): NavHistory {
  const navigate = useNavigate();
  const location = useLocation();
  const navType = useNavigationType();

  // Stacks hold location keys (unique per history entry, so re-visiting the
  // same URL still counts as a distinct step back).
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const prevKey = useRef<string | null>(null);
  const pendingPop = useRef<'back' | 'forward' | null>(null);
  // Mirror lengths into state so the disabled styling re-renders.
  const [counts, setCounts] = useState({ back: 0, fwd: 0 });

  useEffect(() => {
    const key = location.key;
    const from = prevKey.current;
    prevKey.current = key;

    if (from === null) {
      // First mount (or StrictMode/dev remount): fresh session, no in-app
      // history — even if the browser tab arrived here from other sites.
      past.current = [];
      future.current = [];
    } else if (navType === 'POP') {
      if (pendingPop.current === 'back') {
        past.current.pop();
        future.current.push(from);
      } else if (pendingPop.current === 'forward') {
        future.current.pop();
        past.current.push(from);
      } else {
        // Browser-native back/forward: desynced — distrust both stacks.
        past.current = [];
        future.current = [];
      }
      pendingPop.current = null;
    } else if (navType === 'PUSH') {
      past.current.push(from);
      future.current = [];
      // A push also settles any signalled-but-unconsumed POP (e.g. a
      // goBack() that a redirect swallowed) so the flag can't leak forward.
      pendingPop.current = null;
    }
    // REPLACE: same history slot, stacks unchanged.

    setCounts({ back: past.current.length, fwd: future.current.length });
  }, [location, navType]);

  const canBack = counts.back > 0;
  const canForward = counts.fwd > 0;

  return {
    goBack() {
      if (!canBack) return;
      pendingPop.current = 'back';
      navigate(-1);
    },
    goForward() {
      if (!canForward) return;
      pendingPop.current = 'forward';
      navigate(1);
    },
    canBack,
    canForward,
  };
}
