import { signal } from '@preact/signals';
import { searchesItem, type SavedSearch } from './stores';

export type { SavedSearch };

export const searches = signal<SavedSearch[]>([]);

let loaded: Promise<void> | null = null;
export function loadSearches() {
  loaded ??= (async () => {
    searches.value = await searchesItem.getValue();
    searchesItem.watch((v) => (searches.value = v ?? []));
  })();
  return loaded;
}

const norm = (q: string) => q.trim().replace(/\s+/g, ' ');

export const isSaved = (q: string) => searches.value.some((s) => s.q === norm(q));

export function saveSearch(q: string) {
  const query = norm(q);
  if (!query || isSaved(query)) return;
  const next = [...searches.value, { id: crypto.randomUUID(), q: query, createdAt: Date.now() }];
  searches.value = next;
  void searchesItem.setValue(next);
}

export function removeSearch(id: string) {
  const next = searches.value.filter((s) => s.id !== id);
  searches.value = next;
  void searchesItem.setValue(next);
}

/** Links into the Lots screen. The hash never reaches MGA's server. */
export const lotsLink = (auctionId: string, params: { q?: string; lot?: string } = {}) => {
  const h = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return `/preview-auction.aspx?id=${auctionId}${h ? `#${h}` : ''}`;
};
