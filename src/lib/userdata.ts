import { signal } from '@preact/signals';
import { hiddenItem, watchItem, type Hidden, type LotKey, type Watch, type WatchEntry } from './stores';

export { hiddenItem, lotKey, watchItem, type Hidden, type LotKey, type Watch, type WatchEntry } from './stores';

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
  const entry: WatchEntry = { ...watch.value[key], ...patch, at: Date.now() };
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
