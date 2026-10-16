import type { Route } from '@/lib/routes';
import type { Settings } from '@/lib/settings';
import { Shell } from './Chrome';
import { DataCheck } from './DataCheck';
import { HomeScreen } from './home/HomeScreen';
import { LotsScreen } from './lots/LotsScreen';

type Props = { route: Extract<Route, { kind: 'home' | 'lots' | 'selling' }>; settings: Settings };

export function App({ route, settings }: Props) {
  if (route.kind === 'lots') return <LotsScreen auctionId={route.auctionId} settings={settings} />;
  if (route.kind === 'home') return <HomeScreen settings={settings} />;

  // Selling gets its real screen in milestone 6.
  return (
    <Shell screen="selling" auctionId={route.auctionId}>
      <main class="main">
        <h1>Selling</h1>
        <p class="muted">This screen is coming in a later version. The MGA page is hidden underneath and still works.</p>
        <h2>What CGA read</h2>
        <DataCheck route={route} />
      </main>
    </Shell>
  );
}
