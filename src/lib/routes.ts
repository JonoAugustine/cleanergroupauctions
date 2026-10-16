export type Route =
  | { kind: 'home' }
  | { kind: 'lots'; auctionId: string }
  | { kind: 'selling'; auctionId: string }
  /** MGA pages CGA must never touch: login, account, profile, dialogs, reports. */
  | { kind: 'untouched' }
  /** Any other MGA page: leave it visible and add the thin CGA bar. */
  | { kind: 'other' };

const UNTOUCHED = [/^\/account(\/|$)/, /^\/dialogs(\/|$)/, /^\/profile\.aspx$/, /^\/openreportviewer\.aspx$/];

/** ASP.NET paths are case insensitive, so match on the lowercased path. */
export function routeFor(url: URL): Route {
  const path = url.pathname.toLowerCase();
  if (UNTOUCHED.some((re) => re.test(path))) return { kind: 'untouched' };
  if (path === '/' || path === '/default.aspx') return { kind: 'home' };

  const id = url.searchParams.get('id') ?? url.searchParams.get('ID') ?? '';
  if (/^\d+$/.test(id)) {
    if (path === '/preview-auction.aspx') return { kind: 'lots', auctionId: id };
    if (path === '/auction-items.aspx') return { kind: 'selling', auctionId: id };
  }
  return { kind: 'other' };
}

export const isTakeover = (r: Route) => r.kind === 'home' || r.kind === 'lots' || r.kind === 'selling';
