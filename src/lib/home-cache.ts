import { storage } from 'wxt/utils/storage';
import { mgaRequest } from '@/mga/client';
import { parseHome } from '@/mga/parse';
import type { Home } from '@/mga/types';

const item = storage.defineItem<{ at: number; home: Home } | null>('local:homeCache', { fallback: null });
const MAX_AGE = 60 * 60 * 1000;

/** Called on the Home page, which already has the data, so no request is needed. */
export const rememberHome = (home: Home) => item.setValue({ at: Date.now(), home });

/** Home data for the auction switcher: cached for an hour, else one request for /default.aspx. */
export async function getHome(): Promise<Home> {
  const cached = await item.getValue();
  if (cached && Date.now() - cached.at < MAX_AGE) return cached.home;
  const home = parseHome(await mgaRequest('/default.aspx'));
  await rememberHome(home);
  return home;
}
