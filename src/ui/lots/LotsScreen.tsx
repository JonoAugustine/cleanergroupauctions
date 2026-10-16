import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { exportFile } from '@/lib/download';
import { lotsCsv, watchlistText } from '@/lib/exporters';
import { activeChips, applyFilters, defaultFilters, type Filters } from '@/lib/filters';
import { plural } from '@/lib/format';
import { getHome } from '@/lib/home-cache';
import { rememberLots } from '@/lib/lots-source';
import { newLots } from '@/lib/new-lots';
import { isSaved, loadSearches, saveSearch } from '@/lib/searches';
import { seenItem } from '@/lib/stores';
import { highlightTerms } from '@/lib/search';
import { updateSettings, type Settings } from '@/lib/settings';
import { hidden, loadUserData, lotKey, toggleHidden, toggleWatch, watch } from '@/lib/userdata';
import { printSelected } from '@/mga/client';
import type { Auction } from '@/mga/types';
import { openSettings, Shell } from '../Chrome';
import { Icon } from '../Icon';
import { FilterPanel } from './FilterPanel';
import { LotDrawer, Lightbox } from './LotDrawer';
import { LotGrid } from './LotGrid';
import { LotList } from './LotList';
import { useLots } from './useLots';

type Props = { auctionId: string; settings: Settings };

export function LotsScreen({ auctionId, settings }: Props) {
  const { state, refresh } = useLots();
  const defaults = useMemo(() => defaultFilters(settings.donations), [settings.donations]);
  // Home links here with #q=… or #lot=… (SPEC.md §4.2).
  const hash = useMemo(() => new URLSearchParams(location.hash.slice(1)), []);
  const [filters, setFilters] = useState<Filters>(() => ({ ...defaults, q: hash.get('q') ?? '' }));
  const [isNew, setIsNew] = useState<Set<string>>(new Set());
  const [view, setView] = useState(settings.view);
  const [current, setCurrent] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [noteFocus, setNoteFocus] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [toast, setToast] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => void (loadUserData(), loadSearches()), []);

  // New since last visit: compare with the lots seen last time, then remember this visit's lots.
  const firstLoad = useRef(true);
  useEffect(() => {
    if (state.status !== 'ready') return;
    const lots = state.preview.lots;
    void rememberLots(auctionId, lots);
    void (async () => {
      const seen = await seenItem.getValue();
      if (firstLoad.current) {
        firstLoad.current = false;
        if (settings.newBadge) setIsNew(newLots(lots, seen[auctionId]));
        const fromHash = hash.get('lot');
        if (fromHash && lots.some((l) => l.lot === fromHash)) open(fromHash);
      }
      await seenItem.setValue({ ...(await seenItem.getValue()), [auctionId]: lots.map((l) => l.lot) });
    })();
  }, [state.status === 'ready' && state.preview]);
  useEffect(() => {
    getHome()
      .then((h) => setAuctions(h.auctions))
      .catch(() => {}); // the switcher just shows the id
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const all = state.status === 'ready' ? state.preview.lots : [];
  const result = useMemo(
    () => applyFilters(all, filters, { auctionId, watch: watch.value, hidden: hidden.value, isNew }),
    [all, filters, auctionId, watch.value, hidden.value, isNew],
  );
  const terms = useMemo(() => highlightTerms(result.query), [result.query]);
  const chips = activeChips(filters, defaults);
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  // Keys can arrive faster than renders (J then W), so handlers read the open lot from a ref.
  const currentRef = useRef(current);
  currentRef.current = current;

  const lot = current ? all.find((l) => l.lot === current) : undefined;
  const index = lot ? result.lots.indexOf(lot) : -1;
  const auction = auctions.find((a) => a.id === auctionId);

  const open = (n: string) => {
    currentRef.current = n;
    setCurrent(n);
    setEnlarged(false);
  };
  const close = () => {
    const n = currentRef.current;
    currentRef.current = null;
    setCurrent(null);
    setEnlarged(false);
    // Return focus to the card or row that opened the drawer.
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-open-lot="${CSS.escape(n ?? '')}"]`)?.focus());
  };
  const step = (dir: 1 | -1) => {
    if (!result.lots.length) return;
    const index = result.lots.findIndex((l) => l.lot === currentRef.current);
    const i = index < 0 ? (dir > 0 ? 0 : result.lots.length - 1) : (index + dir + result.lots.length) % result.lots.length;
    open(result.lots[i]!.lot);
    root.current?.querySelector(`[data-open-lot="${CSS.escape(result.lots[i]!.lot)}"]`)?.scrollIntoView({ block: 'nearest' });
  };
  const toggleView = () => {
    const next = view === 'grid' ? 'list' : 'grid';
    setView(next);
    void updateSettings({ view: next });
  };

  const labels = {
    count: selected.size,
    selectShown: () => setSelected(new Set([...selected, ...result.lots.filter((l) => l.selectName).map((l) => l.lot)])),
    selectWatched: () =>
      setSelected(new Set([...selected, ...all.filter((l) => l.selectName && watch.value[lotKey(auctionId, l.lot)]).map((l) => l.lot)])),
    clear: () => setSelected(new Set()),
    print: () => {
      const form = document.querySelector<HTMLFormElement>('form#aspnetForm');
      if (!form) return setToast('Could not find the MGA form. Try Classic view.');
      const names = new Set(all.filter((l) => selected.has(l.lot) && l.selectName).map((l) => l.selectName!));
      printSelected(form, names);
    },
    copyWatchlist: async () => {
      const text = watchlistText(all, auctionId, watch.value, auction?.name ?? `Auction ${auctionId}`);
      if (!text) return setToast('Your watchlist is empty.');
      try {
        await navigator.clipboard.writeText(text);
        setToast(`Copied ${plural(text.split('\n').length - 1, 'lot')}.`);
      } catch {
        setToast('Could not copy. Try the CSV instead.');
      }
    },
    csv: () => exportFile(`auction-${auctionId}-lots.csv`, lotsCsv(result.lots, auctionId, watch.value), 'text/csv'),
  };
  const toggleSelected = (n: string) => {
    const next = new Set(selected);
    if (!next.delete(n)) next.add(n);
    setSelected(next);
  };

  // Keyboard (SPEC.md §4.1). Listens in the capture phase so it sees keys whether focus is in CGA or not.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  onKeyRef.current = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.composedPath()[0] as HTMLElement | undefined;
      const typing = !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
      if (e.key === 'Escape') {
        if (enlarged) setEnlarged(false);
        else if (typing) target!.blur();
        else if (filtersOpen) setFiltersOpen(false);
        else if (currentRef.current) close();
        else return;
        e.preventDefault();
        return;
      }
      if (typing) return;
      const key = currentRef.current ? lotKey(auctionId, currentRef.current) : null;
      const k = e.key.toLowerCase();
      if (e.key === '/') search.current?.focus();
      else if (k === 'j') step(1);
      else if (k === 'k') step(-1);
      else if (k === 'v') toggleView();
      else if (k === 'w' && key) toggleWatch(key);
      else if (k === 'h' && key) toggleHidden(key);
      else if (k === 'n' && key) setNoteFocus((n) => n + 1);
      else return;
      e.preventDefault();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const filterCount = chips.filter((c) => c.id !== 'q').length;
  const overlayOpen = filtersOpen || !!lot;

  const header = (
    <>
      <label class="switcher">
        <span class="sr-only">Auction</span>
        <select value={auctionId} onChange={(e) => (location.href = `/preview-auction.aspx?id=${e.currentTarget.value}`)}>
          {!auction && <option value={auctionId}>Auction {auctionId}</option>}
          {auctions
            .filter((a) => a.upcoming || a.id === auctionId)
            .map((a) => (
              <option value={a.id}>
                {a.name} · {a.date}
              </option>
            ))}
        </select>
      </label>
      <label class="search">
        <Icon name="search" />
        <span class="sr-only">Search lots</span>
        <input
          ref={search}
          type="search"
          placeholder="Search lots"
          value={filters.q}
          onInput={(e) => set({ q: e.currentTarget.value })}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          autoComplete="off"
          spellcheck={false}
        />
      </label>
      <button type="button" class="icon-btn" onClick={toggleView} aria-label={view === 'grid' ? 'Show as list' : 'Show as grid'}>
        <Icon name={view === 'grid' ? 'list' : 'grid'} />
      </button>
      <button type="button" class="icon-btn hide-phone" onClick={openSettings} aria-label="Settings">
        <Icon name="settings" />
      </button>
    </>
  );

  return (
    <Shell screen="lots" auctionId={auctionId} header={header}>
      <div class={`lots${lot ? ' has-drawer' : ''}`} ref={root}>
        <aside
          class={`rail${filtersOpen ? ' open' : ''}`}
          aria-label="Filters"
          role={filtersOpen ? 'dialog' : undefined}
          aria-modal={filtersOpen || undefined}
        >
          <FilterPanel
            filters={filters}
            set={set}
            counts={result.counts}
            flagNew={settings.newBadge}
            resultCount={result.lots.length}
            labels={labels}
            onClose={filtersOpen ? () => setFiltersOpen(false) : undefined}
          />
        </aside>

        <main class="results" aria-busy={state.status === 'loading' || (state.status === 'ready' && state.refreshing)}>
          <div class="results-bar">
            <button type="button" class="btn btn-sm filters-btn" onClick={() => setFiltersOpen(true)}>
              <Icon name="filter" />
              Filters{filterCount ? ` (${filterCount})` : ''}
            </button>
            <p class="small muted" aria-live="polite">
              {state.status === 'ready'
                ? `${plural(result.lots.length, 'lot')}${result.lots.length !== all.length ? ` of ${all.length}` : ''}`
                : state.status === 'loading'
                  ? 'Loading every lot…'
                  : ''}
            </p>
            <span class="spacer" />
            {state.status === 'ready' && (
              <button type="button" class="btn btn-sm" onClick={refresh} disabled={state.refreshing}>
                <Icon name="refresh" size={16} />
                {state.refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            )}
          </div>

          {chips.length > 0 && (
            <ul class="chips" aria-label="Active filters">
              {chips.map((c) => (
                <li>
                  <button type="button" class="chip" onClick={() => set(c.clear)} aria-label={`Remove filter ${c.label}`}>
                    {c.label}
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" class="link-btn small" onClick={() => setFilters(defaults)}>
                  Clear all
                </button>
              </li>
              {filters.q.trim() && (
                <li>
                  {isSaved(filters.q) ? (
                    <span class="small muted">Search saved</span>
                  ) : (
                    <button type="button" class="link-btn small" onClick={() => saveSearch(filters.q)}>
                      Save this search
                    </button>
                  )}
                </li>
              )}
            </ul>
          )}

          {state.status === 'error' ? (
            <div class="empty" role="alert">
              <p>{state.message}.</p>
              {state.loginUrl ? (
                <a class="btn btn-primary" href={state.loginUrl}>
                  Log in to MGA
                </a>
              ) : (
                <button type="button" class="btn" onClick={refresh}>
                  Try again
                </button>
              )}
            </div>
          ) : state.status === 'loading' ? (
            <ul class="cards skeleton" aria-hidden="true">
              {Array.from({ length: 12 }, () => (
                <li class="card" />
              ))}
            </ul>
          ) : !result.lots.length ? (
            <div class="empty">
              <p>No lots match.</p>
              {chips.length > 0 && (
                <button type="button" class="btn" onClick={() => setFilters(defaults)}>
                  Clear filters
                </button>
              )}
            </div>
          ) : view === 'grid' ? (
            <LotGrid lots={result.lots} auctionId={auctionId} terms={terms} current={current} open={open} isNew={isNew} />
          ) : (
            <LotList
              lots={result.lots}
              auctionId={auctionId}
              terms={terms}
              current={current}
              open={open}
              selected={selected}
              toggleSelected={toggleSelected}
              isNew={isNew}
            />
          )}
        </main>

        {lot && (
          <LotDrawer
            lot={lot}
            auctionId={auctionId}
            terms={terms}
            position={index + 1}
            total={result.lots.length}
            step={step}
            close={close}
            enlarge={() => setEnlarged(true)}
            noteFocus={noteFocus}
            isNew={isNew.has(lot.lot)}
          />
        )}
        {overlayOpen && <div class="scrim" onClick={() => (filtersOpen ? setFiltersOpen(false) : close())} />}
        {enlarged && lot?.imageSrc && <Lightbox lot={lot} close={() => setEnlarged(false)} />}
        {toast && (
          <div class="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </Shell>
  );
}
