import { browser } from 'wxt/browser';
import { setClassic } from '@/lib/settings';

export const CREDIT = 'CleanerGroupAuctions by @JonoAugustine · not affiliated with MyGroupAuctions';

export const openSettings = () => browser.runtime.sendMessage({ type: 'cga:open-options' });

/** Footer shown on every CGA screen. Classic view must always be reachable from here. */
export function Footer() {
  return (
    <footer class="footer">
      <span>{CREDIT}</span>
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
      <a class="wordmark" href="/default.aspx">
        CGA
      </a>
      <a href="/default.aspx">Back to CGA home</a>
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
