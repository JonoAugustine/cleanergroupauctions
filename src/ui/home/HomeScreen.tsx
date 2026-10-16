import { useEffect, useMemo, useState } from 'preact/hooks';
import { byStart, formatDate, formatTime } from '@/lib/dates';
import { applyFilters, defaultFilters } from '@/lib/filters';
import { formatMin, plural } from '@/lib/format';
import { newLots } from '@/lib/new-lots';
import { loadSearches, lotsLink, removeSearch, saveSearch, searches } from '@/lib/searches';
import type { Settings } from '@/lib/settings';
import { hidden, loadUserData, lotKey, watch } from '@/lib/userdata';
import type { Auction, Lot } from '@/mga/types';
import { Shell } from '../Chrome';
import { Icon } from '../Icon';
import { Title } from '../lots/Title';
import { highlightTerms, parseQuery } from '@/lib/search';
import { useHomeData, type LotsLoad } from './useHomeData';

export function HomeScreen({ settings }: { settings: Settings }) {
  const { home, upcoming, lots, selling, seen, loginUrl } = useHomeData();
  useEffect(() => void (loadUserData(), loadSearches()), []);
  const next = upcoming[0];
  const recent = useMemo(() => home.auctions.filter((a) => !a.upcoming).sort(byStart).reverse().slice(0, 5), [home]);

  return (
    <Shell screen="home" auctionId={next?.id}>
      <main class="home">
        {loginUrl && (
          <p class="banner" role="alert">
            Your MGA session ended. <a href={loginUrl}>Log in to MGA</a>
          </p>
        )}
        <div class="home-main">
          {next ? (
            <NextAuction auction={next} load={lots[next.id]} seen={seen[next.id]} flagNew={settings.newBadge} />
          ) : (
            <section class="card-panel">
              <p class="eyebrow">Next auction</p>
              <h1 class="display">No upcoming auctions</h1>
              <p class="muted">When one of your clubs schedules an auction it shows up here.</p>
            </section>
          )}
          {upcoming.length > 1 && <OtherUpcoming auctions={upcoming.slice(1)} lots={lots} />}
          {upcoming.length > 0 && <SearchAll auctions={upcoming} lots={lots} donations={settings.donations} />}
          {next && <SavedSearches auction={next} load={lots[next.id]} donations={settings.donations} />}
        </div>

        <div class="home-side">
          {next?.canAddItems && (
            <section class="card-panel" aria-labelledby="h-selling">
              <h2 id="h-selling">Selling at the next auction</h2>
              <p>
                {selling ? (selling.count ? `You have ${plural(selling.count, 'listing')}.` : 'Nothing listed yet.') : 'Checking your listings…'}
              </p>
              <a class="btn" href={`/auction-items.aspx?id=${next.id}`}>
                {selling?.count ? 'Manage listings' : 'List an item'}
              </a>
            </section>
          )}

          <section class="card-panel" aria-labelledby="h-clubs">
            <h2 id="h-clubs">My clubs</h2>
            <ul class="plain">
              {home.groups.map((g) => (
                <li>
                  <strong>{g.shortName}</strong> <span class="muted small">· {g.role}</span>
                  <span class="small muted block">
                    {g.fullName}, {g.location} · min sale {formatMin(g.minSaleCents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {recent.length > 0 && (
            <section class="card-panel" aria-labelledby="h-recent">
              <h2 id="h-recent">Recent auctions</h2>
              <ul class="plain">
                {recent.map((a) => (
                  <li>
                    <span class="small muted block">
                      {formatDate(a.date, { month: 'short', day: 'numeric', year: 'numeric' })} · {a.group}
                    </span>
                    {a.name}
                    <a class="small block" href={`/auction-items.aspx?id=${a.id}`}>
                      What you listed
                    </a>
                  </li>
                ))}
              </ul>
              <p class="small muted">Buy and sell history comes in a later version.</p>
            </section>
          )}
        </div>
      </main>
    </Shell>
  );
}

function NextAuction({ auction: a, load, seen, flagNew }: { auction: Auction; load: LotsLoad | undefined; seen?: string[]; flagNew: boolean }) {
  const ready = load?.status === 'ready' ? load.lots : null;
  const fresh = ready && flagNew ? newLots(ready, seen).size : 0;
  const watching = ready ? ready.filter((l) => watch.value[lotKey(a.id, l.lot)]).length : 0;
  return (
    <section class="card-panel next" aria-labelledby="h-next">
      <p class="eyebrow">Next auction</p>
      <h1 id="h-next" class="display">
        {a.name}
      </h1>
      <p class="muted">
        {formatDate(a.date)} · {formatTime(a.time)} · {a.group} · {a.role}
      </p>
      <dl class="stats">
        <div>
          <dt>Lots</dt>
          <dd>
            {ready ? ready.length : '…'}
            {fresh > 0 && <span class="new-badge inline">+{fresh} new</span>}
          </dd>
        </div>
        <div>
          <dt>With photos</dt>
          <dd>{ready ? ready.filter((l) => l.imageId).length : '…'}</dd>
        </div>
        <div>
          <dt>You're watching</dt>
          <dd>{ready ? watching : '…'}</dd>
        </div>
        <div>
          <dt>Min sale price</dt>
          <dd>{formatMin(a.minSaleCents)}</dd>
        </div>
      </dl>
      {load?.status === 'error' && <p class="small warn-text">Could not load lots: {load.message}</p>}
      <a class="btn btn-primary" href={lotsLink(a.id)}>
        {ready ? `Browse ${plural(ready.length, 'lot')}` : 'Browse lots'}
      </a>
    </section>
  );
}

function OtherUpcoming({ auctions, lots }: { auctions: Auction[]; lots: Record<string, LotsLoad> }) {
  return (
    <section class="card-panel" aria-labelledby="h-upcoming">
      <h2 id="h-upcoming">Also coming up</h2>
      <ul class="plain">
        {auctions.map((a) => {
          const l = lots[a.id];
          return (
            <li class="row-link">
              <a href={lotsLink(a.id)}>{a.name}</a>
              <span class="small muted">
                {formatDate(a.date)} · {formatTime(a.time)} · {a.group}
                {l?.status === 'ready' && ` · ${plural(l.lots.length, 'lot')}`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const PER_AUCTION = 8;

function SearchAll({ auctions, lots, donations }: { auctions: Auction[]; lots: Record<string, LotsLoad>; donations: boolean }) {
  const [q, setQ] = useState('');
  const terms = useMemo(() => highlightTerms(parseQuery(q)), [q]);
  const groups = useMemo(() => {
    if (!q.trim()) return [];
    return auctions.map((a) => {
      const l = lots[a.id];
      const found =
        l?.status === 'ready' ? applyFilters(l.lots, { ...defaultFilters(donations), q }, { auctionId: a.id, watch: watch.value, hidden: hidden.value }).lots : null;
      return { auction: a, found };
    });
  }, [q, auctions, lots, donations, watch.value, hidden.value]);

  return (
    <section class="card-panel" aria-labelledby="h-search-all">
      <h2 id="h-search-all">Search every upcoming auction</h2>
      <label class="search">
        <Icon name="search" />
        <span class="sr-only">Search all upcoming lots</span>
        <input type="search" placeholder="Search lots" value={q} onInput={(e) => setQ(e.currentTarget.value)} autoComplete="off" spellcheck={false} />
      </label>
      {groups.map(({ auction: a, found }) => (
        <div class="search-group">
          <h3>
            {a.name} <span class="small muted">{found ? plural(found.length, 'match', 'matches') : 'loading…'}</span>
          </h3>
          {found && found.length > 0 && (
            <ul class="plain results-mini">
              {found.slice(0, PER_AUCTION).map((l: Lot) => (
                <li>
                  <a href={lotsLink(a.id, { lot: l.lot })}>
                    <span class="lot-num">#{l.lot}</span> <Title text={l.title.replace(/\s*\n\s*/g, ' ')} terms={terms} />
                  </a>
                  <span class="small muted"> · min {formatMin(l.minCents)}</span>
                </li>
              ))}
            </ul>
          )}
          {found && found.length > PER_AUCTION && (
            <a class="small" href={lotsLink(a.id, { q })}>
              See all {found.length} in Lots
            </a>
          )}
        </div>
      ))}
    </section>
  );
}

function SavedSearches({ auction, load, donations }: { auction: Auction; load: LotsLoad | undefined; donations: boolean }) {
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const ready = load?.status === 'ready' ? load.lots : null;
  const count = (q: string) =>
    ready ? applyFilters(ready, { ...defaultFilters(donations), q }, { auctionId: auction.id, watch: watch.value, hidden: hidden.value }).lots.length : null;

  return (
    <section class="card-panel" aria-labelledby="h-saved">
      <h2 id="h-saved">Saved searches</h2>
      {searches.value.length === 0 && !adding && <p class="muted small">Save a search to see how many lots match in each auction.</p>}
      <ul class="plain saved">
        {searches.value.map((s) => {
          const n = count(s.q);
          return (
            <li>
              <a href={lotsLink(auction.id, { q: s.q })}>{s.q}</a>
              <span class="small muted">{n == null ? '…' : plural(n, 'match', 'matches')}</span>
              <button type="button" class="icon-btn" aria-label={`Remove saved search ${s.q}`} onClick={() => removeSearch(s.id)}>
                <Icon name="close" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <form
          class="save-form"
          onSubmit={(e) => {
            e.preventDefault();
            saveSearch(draft);
            setDraft('');
            setAdding(false);
          }}
        >
          <label class="search">
            <span class="sr-only">Search to save</span>
            <input type="search" value={draft} onInput={(e) => setDraft(e.currentTarget.value)} placeholder='e.g. pleco -bristlenose' autoFocus />
          </label>
          <button type="submit" class="btn btn-primary" disabled={!draft.trim()}>
            Save
          </button>
          <button type="button" class="btn" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" class="btn btn-sm" onClick={() => setAdding(true)}>
          + Save a search
        </button>
      )}
    </section>
  );
}
