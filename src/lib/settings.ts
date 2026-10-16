import { storage } from 'wxt/utils/storage';

export type Settings = {
  accent: string;
  bg: string;
  watch: string;
  classic: boolean;
  sync: boolean;
  newBadge: boolean;
  donations: boolean;
  view: 'grid' | 'list';
};

export const DEFAULT_SETTINGS: Settings = {
  accent: '#4E9A5B',
  bg: '#141914',
  watch: '#E9B949',
  classic: false,
  sync: false,
  newBadge: true,
  donations: true,
  view: 'grid',
};

const item = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS });

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await item.getValue()) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await item.setValue(next);
  return next;
}

export function watchSettings(cb: (s: Settings) => void) {
  return item.watch((s) => cb({ ...DEFAULT_SETTINGS, ...s }));
}

export const setClassic = (classic: boolean) => updateSettings({ classic });
