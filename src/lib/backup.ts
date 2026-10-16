import { DEFAULT_SETTINGS, type Settings } from './settings';
import { isHex } from './theme';
import type { Hidden, SavedSearch, Watch, WatchEntry } from './stores';

export const BACKUP_APP = 'CleanerGroupAuctions';

export type Backup = {
  app: typeof BACKUP_APP;
  version: 1;
  exportedAt: string;
  settings: Settings;
  watch: Watch;
  hidden: Hidden;
  searches: SavedSearch[];
};

export const makeBackup = (settings: Settings, watch: Watch, hidden: Hidden, searches: SavedSearch[] = []): Backup => ({
  app: BACKUP_APP,
  version: 1,
  exportedAt: new Date().toISOString(),
  settings,
  watch,
  hidden,
  searches,
});

const LOT_KEY = /^\d+:[^:\s]+$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);

/** Reads a backup file. Keeps only fields CGA knows, so a hand edited file cannot inject anything else. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not a CGA backup');
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP || raw.version !== 1) throw new Error('That file is not a CGA backup');

  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const k of ['accent', 'bg', 'watch'] as const) if (isHex(s[k])) settings[k] = s[k];
  for (const k of ['classic', 'sync', 'newBadge', 'donations'] as const) if (typeof s[k] === 'boolean') settings[k] = s[k];
  if (s.view === 'grid' || s.view === 'list') settings.view = s.view;

  const watch: Watch = {};
  for (const [k, v] of Object.entries(isObj(raw.watch) ? raw.watch : {})) {
    if (!LOT_KEY.test(k) || !isObj(v)) continue;
    const e: WatchEntry = { at: typeof v.at === 'number' && Number.isFinite(v.at) ? v.at : 0 };
    const note = str(v.note, 2000);
    const max = str(v.max, 12);
    if (note) e.note = note;
    if (max && /^\d+(\.\d{1,2})?$/.test(max)) e.max = max;
    watch[k] = e;
  }

  const hidden: Hidden = {};
  for (const [k, v] of Object.entries(isObj(raw.hidden) ? raw.hidden : {})) if (LOT_KEY.test(k) && v === true) hidden[k] = true;

  const searches: SavedSearch[] = [];
  for (const v of Array.isArray(raw.searches) ? raw.searches : []) {
    const q = isObj(v) ? str(v.q, 200)?.trim() : undefined;
    if (!q || searches.some((s) => s.q === q)) continue;
    searches.push({
      id: str((v as Record<string, unknown>).id, 64) || crypto.randomUUID(),
      q,
      createdAt: Number((v as Record<string, unknown>).createdAt) || 0,
    });
  }

  return { app: BACKUP_APP, version: 1, exportedAt: str(raw.exportedAt, 40) ?? '', settings, watch, hidden, searches };
}

/** Union of two watchlists; where both have a lot, the more recently changed entry wins. */
export function mergeWatch(a: Watch, b: Watch): Watch {
  const out: Watch = { ...a };
  for (const [k, v] of Object.entries(b)) if (!out[k] || v.at > out[k]!.at) out[k] = v;
  return out;
}

export const mergeHidden = (a: Hidden, b: Hidden): Hidden => ({ ...a, ...b });

/** Saved searches from both, one per query text. */
export const mergeSearches = (a: SavedSearch[], b: SavedSearch[]) => [...a, ...b.filter((s) => !a.some((x) => x.q === s.q))];
