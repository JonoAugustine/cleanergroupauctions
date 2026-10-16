import type { Lot } from '@/mga/types';
import { formatMax, formatMin } from './format';
import { lotKey, type Watch } from './userdata';

const csvCell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** CSV of the current results, one line per lot. Titles keep their line breaks inside quotes. */
export function lotsCsv(lots: Lot[], auctionId: string, watch: Watch) {
  const rows = [['Lot', 'Item', 'Min bid', 'Photo', 'Watched', 'My max', 'Note']];
  for (const l of lots) {
    const w = watch[lotKey(auctionId, l.lot)];
    rows.push([
      l.lot,
      l.title,
      l.minCents ? (l.minCents / 100).toFixed(2) : '',
      l.imageId ? 'yes' : 'no',
      w ? 'yes' : '',
      w?.max ?? '',
      w?.note ?? '',
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Plain text watchlist in lot order. */
export function watchlistText(lots: Lot[], auctionId: string, watch: Watch, heading: string) {
  const lines = lots
    .filter((l) => watch[lotKey(auctionId, l.lot)])
    .sort((a, b) => a.lotNum - b.lotNum)
    .map((l) => {
      const w = watch[lotKey(auctionId, l.lot)]!;
      const bits = [`Lot ${l.lot}: ${l.title.replace(/\s*\n\s*/g, ' / ')}`];
      if (l.minCents) bits.push(`min ${formatMin(l.minCents)}`);
      if (w.max) bits.push(`max ${formatMax(w.max)}`);
      if (w.note) bits.push(w.note);
      return bits.join(' · ');
    });
  return lines.length ? [heading, ...lines].join('\n') : '';
}
