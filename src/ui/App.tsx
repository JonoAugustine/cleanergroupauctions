import type { Route } from '@/lib/routes';
import type { Settings } from '@/lib/settings';
import { HomeScreen } from './home/HomeScreen';
import { LotsScreen } from './lots/LotsScreen';
import { SellingScreen } from './selling/SellingScreen';

type Props = { route: Extract<Route, { kind: 'home' | 'lots' | 'selling' }>; settings: Settings };

export function App({ route, settings }: Props) {
  if (route.kind === 'lots') return <LotsScreen auctionId={route.auctionId} settings={settings} />;
  if (route.kind === 'home') return <HomeScreen settings={settings} />;
  return <SellingScreen auctionId={route.auctionId} />;
}
