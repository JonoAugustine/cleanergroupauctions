import type { Lot } from '@/mga/types';

/**
 * Lots added since the last visit. Nothing is new on a first visit, so a fresh install does not flag
 * the whole catalog.
 */
export function newLots(lots: Pick<Lot, 'lot'>[], seen: string[] | undefined): Set<string> {
  if (!seen) return new Set();
  const before = new Set(seen);
  return new Set(lots.filter((l) => !before.has(l.lot)).map((l) => l.lot));
}
