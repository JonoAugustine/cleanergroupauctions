import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { loadAllLots, LoggedOutError } from '@/mga/client';
import { parsePreview } from '@/mga/parse';
import type { Preview } from '@/mga/types';

export type LotsState =
  | { status: 'loading' }
  | { status: 'ready'; preview: Preview; at: number; refreshing: boolean }
  | { status: 'error'; message: string; loginUrl?: string };

const STALE = 10 * 60 * 1000;

/**
 * Every lot for this auction: the page's own rows, then one load all request (SPEC.md §3.6).
 * Kept in memory for the visit. Refreshes on demand, or when the tab comes back after 10+ minutes.
 */
export function useLots() {
  const [state, setState] = useState<LotsState>({ status: 'loading' });
  const busy = useRef(false);
  const at = useRef(0);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState((s) => (s.status === 'ready' ? { ...s, refreshing: true } : { status: 'loading' }));
    try {
      const form = document.querySelector<HTMLFormElement>('form#aspnetForm');
      let preview = parsePreview(document);
      if (form && (!preview.complete || at.current)) preview = parsePreview(await loadAllLots(form));
      at.current = Date.now();
      setState({ status: 'ready', preview, at: at.current, refreshing: false });
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : String(e),
        loginUrl: e instanceof LoggedOutError ? e.loginUrl : undefined,
      });
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    const onVisible = () => document.visibilityState === 'visible' && at.current && Date.now() - at.current > STALE && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  return { state, refresh: load };
}
