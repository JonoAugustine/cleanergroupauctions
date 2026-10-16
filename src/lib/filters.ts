import type { Lot } from '@/mga/types';
import { isEmptyQuery, matchQuery, parseQuery, type Query } from './search';
import { lotKey, type Hidden, type Watch } from './userdata';

export type Show = 'all' | 'watched' | 'hidden';
export type Sort = 'lot' | 'name' | 'min';

export type Filters = {
  q: string;
  show: Show;
  photo: boolean;
  noMin: boolean;
  donations: boolean;
  sort: Sort;
};

export const defaultFilters = (donations = true): Filters => ({
  q: '',
  show: 'all',
  photo: false,
  noMin: false,
  donations,
  sort: 'lot',
});

export type Ctx = { auctionId: string; watch: Watch; hidden: Hidden };

export type Result = {
  lots: Lot[];
  query: Query;
  counts: Record<Show, number>;
};

const byLot = (a: Lot, b: Lot) => a.lotNum - b.lotNum || a.lot.localeCompare(b.lot);
const SORTS: Record<Sort, (a: Lot, b: Lot) => number> = {
  lot: byLot,
  name: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || byLot(a, b),
  min: (a, b) => a.minCents - b.minCents || byLot(a, b),
};

export function applyFilters(all: Lot[], f: Filters, ctx: Ctx): Result {
  const query = parseQuery(f.q);
  const isWatched = (l: Lot) => !!ctx.watch[lotKey(ctx.auctionId, l.lot)];
  const isHidden = (l: Lot) => !!ctx.hidden[lotKey(ctx.auctionId, l.lot)];

  const counts = { all: 0, watched: 0, hidden: 0 };
  for (const l of all) {
    if (isHidden(l)) counts.hidden++;
    else counts.all++;
    if (isWatched(l)) counts.watched++;
  }

  const empty = isEmptyQuery(query);
  const lots = all
    .filter(
      (l) =>
        (f.show === 'all' ? !isHidden(l) : f.show === 'watched' ? isWatched(l) : isHidden(l)) &&
        (!f.photo || !!l.imageId) &&
        (!f.noMin || l.minCents === 0) &&
        (f.donations || !l.donation) &&
        (empty || matchQuery(l, query)),
    )
    .sort(SORTS[f.sort]);

  return { lots, query, counts };
}

export type Chip = { id: string; label: string; clear: Partial<Filters> };

/** Active filters as removable chips. Sort is not a filter, so it has no chip. */
export function activeChips(f: Filters, defaults: Filters): Chip[] {
  const chips: Chip[] = [];
  if (f.q.trim()) chips.push({ id: 'q', label: `"${f.q.trim()}"`, clear: { q: '' } });
  if (f.show === 'watched') chips.push({ id: 'show', label: 'Watched', clear: { show: 'all' } });
  if (f.show === 'hidden') chips.push({ id: 'show', label: 'Hidden', clear: { show: 'all' } });
  if (f.photo) chips.push({ id: 'photo', label: 'Has photo', clear: { photo: false } });
  if (f.noMin) chips.push({ id: 'noMin', label: 'No minimum', clear: { noMin: false } });
  if (f.donations !== defaults.donations)
    chips.push({
      id: 'donations',
      label: f.donations ? 'Donated lots included' : 'No donated lots',
      clear: { donations: defaults.donations },
    });
  return chips;
}
