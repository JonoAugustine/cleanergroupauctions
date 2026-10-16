import type { Route } from '@/lib/routes';
import { Footer } from './Chrome';
import { DataCheck } from './DataCheck';

type Props = { route: Extract<Route, { kind: 'home' | 'lots' | 'selling' }> };

const TITLES = { home: 'Home', lots: 'Lots', selling: 'Selling' } as const;

export function App({ route }: Props) {
  const auctionId = route.kind === 'home' ? undefined : route.auctionId;
  const nav = [
    { kind: 'home', href: '/default.aspx' },
    auctionId && { kind: 'lots', href: `/preview-auction.aspx?id=${auctionId}` },
    auctionId && { kind: 'selling', href: `/auction-items.aspx?id=${auctionId}` },
  ].filter(Boolean) as { kind: keyof typeof TITLES; href: string }[];

  return (
    <div class="cga-root app">
      <header class="header">
        <a class="wordmark" href="/default.aspx">
          CGA
        </a>
        <nav class="nav" aria-label="Main">
          {nav.map((n) => (
            <a href={n.href} aria-current={n.kind === route.kind ? 'page' : undefined}>
              {TITLES[n.kind]}
            </a>
          ))}
        </nav>
      </header>
      <main class="main">
        <h1>Hello CGA</h1>
        <p class="muted">
          {TITLES[route.kind]}
          {auctionId && ` for auction ${auctionId}`}. The MGA page is hidden underneath and still works.
        </p>
        <h2>What CGA read</h2>
        <DataCheck route={route} />
      </main>
      <Footer />
    </div>
  );
}
