import { storage } from 'wxt/utils/storage';

/** Watch and hidden lots in storage.local, with no UI dependencies so the background can use them. */
/** `${auctionId}:${lotNumber}`. Lot numbers are stable within an auction once assigned. */
export type LotKey = string;
/** `at` is when the entry last changed, so sync and import can keep the newest copy. */
export type WatchEntry = { note?: string; max?: string; at: number };
export type Watch = Record<LotKey, WatchEntry>;
export type Hidden = Record<LotKey, true>;

export const lotKey = (auctionId: string, lot: string): LotKey => `${auctionId}:${lot}`;

export const watchItem = storage.defineItem<Watch>('local:watch', { fallback: {} });
export const hiddenItem = storage.defineItem<Hidden>('local:hidden', { fallback: {} });

export type SavedSearch = { id: string; q: string; createdAt: number };

/** Saved searches, synced and backed up with the watchlist. */
export const searchesItem = storage.defineItem<SavedSearch[]>('local:searches', { fallback: [] });

/** Lot numbers seen at the last visit to each auction's Lots screen, for "new" flags. Per browser. */
export const seenItem = storage.defineItem<Record<string, string[]>>('local:seen', { fallback: {} });
