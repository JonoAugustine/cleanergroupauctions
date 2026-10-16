import type { Route } from '@/lib/routes';
import type { Settings } from '@/lib/settings';
import { Shell } from './Chrome';
import { DataCheck } from './DataCheck';
import { LotsScreen } from './lots/LotsScreen';

type Props = { route: Extract<Route, { kind: 'home' | 'lots' | 'selling' }>; settings: Settings };

export function App({ route, settings }: Props) {
  if (route.kind === 'lots') return <LotsScreen auctionId={route.auctionId} settings={settings} />;

  // Home and Selling get their real screens in milestones 5 and 6.
  const auctionId = route.kind === 'home' ? undefined : route.auctionId;
  return (
    <Shell screen={route.kind} auctionId={auctionId}>
      <main class="main">
        <h1>{route.kind === 'home' ? 'Home' : 'Selling'}</h1>
        <p class="muted">This screen is coming in a later version. The MGA page is hidden underneath and still works.</p>
        <h2>What CGA read</h2>
        <DataCheck route={route} />
      </main>
    </Shell>
  );
}
