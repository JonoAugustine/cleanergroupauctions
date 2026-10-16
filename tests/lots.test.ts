import { describe, expect, it } from 'vitest';
import { activeChips, applyFilters, defaultFilters } from '@/lib/filters';
import { lotsCsv, watchlistText } from '@/lib/exporters';
import { cleanMax, formatMin } from '@/lib/format';
import { highlight, highlightTerms, matchQuery, parseQuery } from '@/lib/search';
import type { Lot } from '@/mga/types';

const lot = (n: number, title: string, extra: Partial<Lot> = {}): Lot => ({
  lot: String(n),
  lotNum: n,
  title,
  minCents: 0,
  imageId: null,
  imageSrc: null,
  donation: /\bdonat(ion|ed)\b/i.test(title),
  selectName: null,
  ...extra,
});

const LOTS = [
  lot(100, 'Purple Vampire Crabs (1 male/2 female)', { imageId: '1' }),
  lot(120, 'Bristlenose pleco group of 6'),
  lot(121, 'L144 pleco, group of 6 juveniles', { minCents: 1000 }),
  lot(143, '10 gallon aquarium (donated)'),
  lot(150, 'Java fern\non driftwood', { imageId: '2', minCents: 500 }),
  lot(493, 'Lot of 143 snails'),
];

const search = (q: string) => LOTS.filter((l) => matchQuery(l, parseQuery(q))).map((l) => l.lotNum);

describe('search', () => {
  it('needs every word', () => {
    expect(search('pleco')).toEqual([120, 121]);
    expect(search('PLECO juveniles')).toEqual([121]);
  });
  it('excludes words', () => expect(search('pleco -bristlenose')).toEqual([121]));
  it('matches exact phrases', () => {
    expect(search('"group of 6"')).toEqual([120, 121]);
    expect(search('"of 6 juveniles"')).toEqual([121]);
    expect(search('"fern on"')).toEqual([150]);
  });
  it('matches lot ranges and single lots', () => {
    expect(search('120-150')).toEqual([120, 121, 143, 150]);
    expect(search('150-120')).toEqual([120, 121, 143, 150]);
    expect(search('#143')).toEqual([143]);
    expect(search('120-150 -#143')).toEqual([120, 121, 150]);
  });
  it('matches a bare number as a lot or in the title', () => expect(search('143')).toEqual([143, 493]));
  it('ignores stray minus signs and empty quotes', () => expect(search('- "" pleco')).toEqual([120, 121]));
  it('highlights words, phrases and numbers', () => {
    const q = parseQuery('pleco "group of" -bristle 120-130 6');
    expect(highlightTerms(q)).toEqual(['pleco', 'group of', '6']);
    expect(highlight('L144 Pleco, group  of 6', highlightTerms(q))).toEqual([
      { text: 'L144 ', hit: false },
      { text: 'Pleco', hit: true },
      { text: ', ', hit: false },
      { text: 'group  of', hit: true },
      { text: ' ', hit: false },
      { text: '6', hit: true },
    ]);
    expect(highlight('x', [])).toEqual([{ text: 'x', hit: false }]);
  });
});

describe('filters', () => {
  const ctx = { auctionId: '951', watch: { '951:121': { at: 1 }, '951:143': { at: 1 } }, hidden: { '951:150': true as const } };
  const run = (f: Partial<ReturnType<typeof defaultFilters>>) =>
    applyFilters(LOTS, { ...defaultFilters(), ...f }, ctx).lots.map((l) => l.lotNum);

  it('hides hidden lots from All and counts each view', () => {
    const r = applyFilters(LOTS, defaultFilters(), ctx);
    expect(r.lots.map((l) => l.lotNum)).toEqual([100, 120, 121, 143, 493]);
    expect(r.counts).toEqual({ all: 5, watched: 2, hidden: 1, new: 0 });
  });
  it('shows watched and hidden views', () => {
    expect(run({ show: 'watched' })).toEqual([121, 143]);
    expect(run({ show: 'hidden' })).toEqual([150]);
  });
  it('filters photo, minimum and donations', () => {
    expect(run({ photo: true })).toEqual([100]);
    expect(run({ noMin: true })).toEqual([100, 120, 143, 493]);
    expect(run({ donations: false })).toEqual([100, 120, 121, 493]);
  });
  it('shows only new lots', () => {
    const r = applyFilters(LOTS, { ...defaultFilters(), newOnly: true }, { ...ctx, isNew: new Set(['143', '150']) });
    expect(r.lots.map((l) => l.lotNum)).toEqual([143]);
    expect(r.counts.new).toBe(1);
  });
  it('sorts by name and minimum', () => {
    expect(run({ sort: 'name' })).toEqual([143, 120, 121, 493, 100]);
    expect(run({ sort: 'min' })).toEqual([100, 120, 143, 493, 121]);
  });
  it('lists active filters as chips', () => {
    const d = defaultFilters(true);
    expect(activeChips(d, d)).toEqual([]);
    expect(activeChips({ ...d, q: ' pleco ', show: 'watched', donations: false }, d).map((c) => c.label)).toEqual([
      '"pleco"',
      'Watched',
      'No donated lots',
    ]);
  });
});

describe('exports', () => {
  const watch = { '951:150': { at: 1, max: '30', note: 'for the 20 long' }, '951:100': { at: 1 } };
  it('writes CSV with quoted titles', () => {
    expect(lotsCsv([LOTS[0]!, LOTS[4]!], '951', watch)).toBe(
      'Lot,Item,Min bid,Photo,Watched,My max,Note\r\n' +
        '100,Purple Vampire Crabs (1 male/2 female),,yes,yes,,\r\n' +
        '150,"Java fern\non driftwood",5.00,yes,yes,30,for the 20 long\r\n',
    );
  });
  it('copies the watchlist as plain text', () => {
    expect(watchlistText(LOTS, '951', watch, 'Auction 951')).toBe(
      'Auction 951\nLot 100: Purple Vampire Crabs (1 male/2 female)\nLot 150: Java fern / on driftwood · min $5.00 · max $30 · for the 20 long',
    );
    expect(watchlistText(LOTS, '951', {}, 'x')).toBe('');
  });
});

describe('format', () => {
  it('formats minimums and cleans max bids', () => {
    expect(formatMin(0)).toBe('-');
    expect(formatMin(1000)).toBe('$10.00');
    expect(cleanMax(' $30 ')).toBe('30');
    expect(cleanMax('12.5')).toBe('12.5');
    expect(cleanMax('lots')).toBe('');
  });
});

describe('new lots', async () => {
  const { newLots } = await import('@/lib/new-lots');
  it('flags lots not seen last time, and nothing on a first visit', () => {
    expect([...newLots(LOTS, ['100', '120', '121'])]).toEqual(['143', '150', '493']);
    expect(newLots(LOTS, undefined).size).toBe(0);
  });
});

describe('lots links', async () => {
  const { lotsLink } = await import('@/lib/searches');
  it('puts search and lot in the hash', () => {
    expect(lotsLink('951')).toBe('/preview-auction.aspx?id=951');
    expect(lotsLink('951', { q: 'pleco "group of 6"' })).toBe('/preview-auction.aspx?id=951#q=pleco+%22group+of+6%22');
    expect(lotsLink('951', { lot: '143' })).toBe('/preview-auction.aspx?id=951#lot=143');
  });
});
