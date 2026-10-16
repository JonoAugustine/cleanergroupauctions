import type { Settings } from './settings';
import type { Hidden, Watch } from './userdata';

/**
 * storage.sync is small (about 100 KB in all, 8 KB per item on Chrome), so data is split into one item
 * per auction: "w:951" holds that auction's watch entries by lot, "h:951" its hidden lots.
 * Classic view and the sync switch itself stay per browser.
 */
export type SyncedSettings = Pick<Settings, 'accent' | 'bg' | 'watch' | 'newBadge' | 'donations' | 'view'>;
export const SYNCED_SETTINGS = ['accent', 'bg', 'watch', 'newBadge', 'donations', 'view'] as const;

export function toSyncItems(watch: Watch, hidden: Hidden, settings: Settings): Record<string, unknown> {
  const items: Record<string, unknown> = {};
  const put = (prefix: string, key: string, value: unknown) => {
    const [auction, lot] = splitKey(key);
    const bucket = ((items[`${prefix}:${auction}`] as Record<string, unknown>) ??= {});
    bucket[lot] = value;
  };
  for (const [k, v] of Object.entries(watch)) put('w', k, v);
  for (const k of Object.keys(hidden)) put('h', k, 1);
  items.settings = Object.fromEntries(SYNCED_SETTINGS.map((k) => [k, settings[k]]));
  return items;
}

export function fromSyncItems(items: Record<string, unknown>) {
  const watch: Watch = {};
  const hidden: Hidden = {};
  for (const [item, bucket] of Object.entries(items)) {
    const m = item.match(/^([wh]):(\d+)$/);
    if (!m || !bucket || typeof bucket !== 'object') continue;
    for (const [lot, v] of Object.entries(bucket as Record<string, unknown>)) {
      if (m[1] === 'w' && v && typeof v === 'object') watch[`${m[2]}:${lot}`] = v as Watch[string];
      if (m[1] === 'h') hidden[`${m[2]}:${lot}`] = true;
    }
  }
  const settings = (items.settings ?? null) as Partial<SyncedSettings> | null;
  return { watch, hidden, settings };
}

export const isDataItem = (key: string) => /^[wh]:\d+$/.test(key);

function splitKey(key: string): [string, string] {
  const i = key.indexOf(':');
  return [key.slice(0, i), key.slice(i + 1)];
}

/** Which sync items to write and remove so the remote matches `next`. Unchanged items are skipped. */
export function syncDiff(current: Record<string, unknown>, next: Record<string, unknown>) {
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next)) if (JSON.stringify(current[k]) !== JSON.stringify(v)) set[k] = v;
  const remove = Object.keys(current).filter((k) => isDataItem(k) && !(k in next));
  return { set, remove };
}
