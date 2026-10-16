import { useEffect, useMemo, useState } from 'preact/hooks';
import { byStart } from '@/lib/dates';
import { rememberHome } from '@/lib/home-cache';
import { getAuctionLots, getSellingSummary } from '@/lib/lots-source';
import { seenItem } from '@/lib/stores';
import { LoggedOutError } from '@/mga/client';
import { parseHome } from '@/mga/parse';
import type { Home, Lot } from '@/mga/types';

export type LotsLoad = { status: 'loading' } | { status: 'ready'; lots: Lot[] } | { status: 'error'; message: string };
export type Selling = { count: number; canAdd: boolean } | null;

/**
 * Home reads its own page for clubs and auctions, then loads each upcoming auction's lots one at a
 * time (cached 10 minutes) and the selling count for the next one. Nothing runs in parallel.
 */
export function useHomeData() {
  const home: Home = useMemo(() => parseHome(document), []);
  const upcoming = useMemo(() => home.auctions.filter((a) => a.upcoming).sort(byStart), [home]);
  const [lots, setLots] = useState<Record<string, LotsLoad>>(() => Object.fromEntries(upcoming.map((a) => [a.id, { status: 'loading' }])));
  const [selling, setSelling] = useState<Selling>(null);
  const [seen, setSeen] = useState<Record<string, string[]>>({});
  const [loginUrl, setLoginUrl] = useState<string | null>(null);

  useEffect(() => {
    void rememberHome(home);
    // Read before the Lots screen updates it, so "new" counts match what Lots will flag.
    seenItem.getValue().then(setSeen);
    let stop = false;
    void (async () => {
      for (const a of upcoming) {
        if (stop) return;
        try {
          const l = await getAuctionLots(a.id);
          setLots((s) => ({ ...s, [a.id]: { status: 'ready', lots: l } }));
        } catch (e) {
          if (e instanceof LoggedOutError) return setLoginUrl(e.loginUrl);
          setLots((s) => ({ ...s, [a.id]: { status: 'error', message: e instanceof Error ? e.message : String(e) } }));
        }
      }
      const next = upcoming[0];
      if (next?.canAddItems && !stop) {
        try {
          setSelling(await getSellingSummary(next.id));
        } catch (e) {
          if (e instanceof LoggedOutError) setLoginUrl(e.loginUrl);
        }
      }
    })();
    return () => void (stop = true);
  }, []);

  return { home, upcoming, lots, selling, seen, loginUrl };
}
