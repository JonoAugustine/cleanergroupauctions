import { storage } from 'wxt/utils/storage';

/** Last sync result, shown in Settings. */
export const syncStatus = storage.defineItem<{ at: number; error: string | null } | null>('local:syncStatus', { fallback: null });
