import type { ComponentChildren } from 'preact';
import { browser } from 'wxt/browser';
import { setClassic } from '@/lib/settings';
import { Icon, type IconName } from './Icon';

export const CREDIT = 'CleanerGroupAuctions by @JonoAugustine · not affiliated with MyGroupAuctions';

export const openSettings = () => browser.runtime.sendMessage({ type: 'cga:open-options' });

export type Screen = 'home' | 'lots' | 'selling';

const homeHref = '/default.aspx';
const lotsHref = (id: string) => `/preview-auction.aspx?id=${id}`;
const sellingHref = (id: string) => `/auction-items.aspx?id=${id}`;

function navItems(auctionId?: string): { screen: Screen; label: string; href: string; icon: IconName }[] {
  return [
    { screen: 'home', label: 'Home', href: homeHref, icon: 'home' },
    ...(auctionId
      ? ([
          { screen: 'lots', label: 'Lots', href: lotsHref(auctionId), icon: 'lots' },
          { screen: 'selling', label: 'Selling', href: sellingHref(auctionId), icon: 'tag' },
        ] as const)
      : []),
  ];
}

type ShellProps = { screen: Screen; auctionId?: string; header?: ComponentChildren; children: ComponentChildren };

/** Header, footer and the phone tab bar shared by every CGA screen. */
export function Shell({ screen, auctionId, header, children }: ShellProps) {
  const items = navItems(auctionId);
  return (
    <div class="cga-root app">
      <header class="header">
        <a class="wordmark" href={homeHref}>
          CGA
        </a>
        <nav class="nav" aria-label="Main">
          {items.map((n) => (
            <a href={n.href} aria-current={n.screen === screen ? 'page' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        {header}
      </header>
      {children}
      <Footer />
      <nav class="tabbar" aria-label="Main">
        {items.map((n) => (
          <a href={n.href} aria-current={n.screen === screen ? 'page' : undefined}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </a>
        ))}
        <button type="button" onClick={openSettings}>
          <Icon name="settings" />
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}

/** Footer shown on every CGA screen. Classic view must always be reachable from here. */
export function Footer() {
  return (
    <footer class="footer">
      <span>
        {CREDIT} · v{browser.runtime.getManifest().version}
      </span>
      <span class="spacer" />
      <button type="button" class="btn" onClick={openSettings}>
        Settings
      </button>
      <button type="button" class="btn" onClick={() => setClassic(true)}>
        Classic view
      </button>
    </footer>
  );
}

/** Thin bar on MGA pages CGA does not take over. */
export function CgaBar() {
  return (
    <div class="cga-root bar" role="navigation" aria-label="CleanerGroupAuctions">
      <a class="wordmark" href={homeHref}>
        CGA
      </a>
      <a href={homeHref}>Back to CGA home</a>
      <span class="spacer" />
      <button type="button" class="btn" onClick={() => setClassic(true)}>
        Classic view
      </button>
    </div>
  );
}

/** The only thing CGA shows while Classic view is on. */
export function UseCgaPill() {
  return (
    <button type="button" class="cga-root btn btn-primary pill" onClick={() => setClassic(false)}>
      Use CGA
    </button>
  );
}
