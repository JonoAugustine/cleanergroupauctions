import { signal } from '@preact/signals';
import { storage } from 'wxt/utils/storage';

/** `${auctionId}:${lotNumber}`. Lot numbers are stable within an auction once assigned. */
export type LotKey = string;
export type WatchEntry = { note?: string; max?: string; at: number };
export type Watch = Record<LotKey, WatchEntry>;
export type Hidden = Record<LotKey, true>;

export const lotKey = (auctionId: string, lot: string): LotKey => `${auctionId}:${lot}`;

const watchItem = storage.defineItem<Watch>('local:watch', { fallback: {} });
const hiddenItem = storage.defineItem<Hidden>('local:hidden', { fallback: {} });

export const watch = signal<Watch>({});
export const hidden = signal<Hidden>({});

let loaded: Promise<void> | null = null;

/** Loads once and follows changes made in other tabs or in Settings. */
export function loadUserData() {
  loaded ??= (async () => {
    [watch.value, hidden.value] = await Promise.all([watchItem.getValue(), hiddenItem.getValue()]);
    watchItem.watch((v) => (watch.value = v ?? {}));
    hiddenItem.watch((v) => (hidden.value = v ?? {}));
  })();
  return loaded;
}

function saveWatch(next: Watch) {
  watch.value = next;
  void watchItem.setValue(next);
}

export function toggleWatch(key: LotKey) {
  const next = { ...watch.value };
  if (next[key]) delete next[key];
  else next[key] = { at: Date.now() };
  saveWatch(next);
}

/** Adding a note or max bid watches the lot. Empty values are dropped. */
export function updateWatch(key: LotKey, patch: { note?: string; max?: string }) {
  const entry: WatchEntry = { ...(watch.value[key] ?? { at: Date.now() }), ...patch };
  if (!entry.note) delete entry.note;
  if (!entry.max) delete entry.max;
  saveWatch({ ...watch.value, [key]: entry });
}

export function toggleHidden(key: LotKey) {
  const next = { ...hidden.value };
  if (next[key]) delete next[key];
  else next[key] = true;
  hidden.value = next;
  void hiddenItem.setValue(next);
}
