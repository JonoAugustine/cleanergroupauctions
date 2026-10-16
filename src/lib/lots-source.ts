import { storage } from 'wxt/utils/storage';
import { loadAllLots, mgaRequest } from '@/mga/client';
import { parsePreview, parseSelling } from '@/mga/parse';
import type { Lot } from '@/mga/types';

type Cached = { at: number; lots: Lot[] };
const MAX_AGE = 10 * 60 * 1000;
const item = (auctionId: string) => storage.defineItem<Cached | null>(`local:lots:${auctionId}`, { fallback: null });

/** The Lots screen shares what it loaded, so Home does not fetch it again. */
export const rememberLots = (auctionId: string, lots: Lot[]) => item(auctionId).setValue({ at: Date.now(), lots });

export async function cachedLots(auctionId: string) {
  return (await item(auctionId).getValue())?.lots ?? null;
}

/**
 * Every lot in another auction, for Home: the preview page, then one load all postback built from that
 * page's own form. Cached for 10 minutes. Callers loop over auctions one at a time (SPEC.md §3.6).
 */
export async function getAuctionLots(auctionId: string): Promise<Lot[]> {
  const cached = await item(auctionId).getValue();
  if (cached && Date.now() - cached.at < MAX_AGE) return cached.lots;
  const doc = await mgaRequest(`/preview-auction.aspx?id=${auctionId}`);
  let preview = parsePreview(doc);
  const form = doc.querySelector<HTMLFormElement>('form#aspnetForm');
  if (!preview.complete && form) preview = parsePreview(await loadAllLots(form));
  await rememberLots(auctionId, preview.lots);
  return preview.lots;
}

/** The count of your own listings for an auction, cached like the lots. */
const sellingItem = (auctionId: string) => storage.defineItem<{ at: number; count: number; canAdd: boolean } | null>(`local:selling:${auctionId}`, { fallback: null });

export async function getSellingSummary(auctionId: string) {
  const cached = await sellingItem(auctionId).getValue();
  if (cached && Date.now() - cached.at < MAX_AGE) return cached;
  const s = parseSelling(await mgaRequest(`/auction-items.aspx?id=${auctionId}`));
  const summary = { at: Date.now(), count: s.items.length, canAdd: s.canAdd };
  await sellingItem(auctionId).setValue(summary);
  return summary;
}
