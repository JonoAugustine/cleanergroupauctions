import './style.css';
import { render, type VNode } from 'preact';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { isTakeover, routeFor } from '@/lib/routes';
import { injectFonts } from '@/lib/fonts';
import { getSettings, watchSettings, type Settings } from '@/lib/settings';
import { applyTheme } from '@/lib/theme';
import { App } from '@/ui/App';
import { CgaBar, UseCgaPill } from '@/ui/Chrome';
import './lots.css';
import './home.css';

const HOST = 'cga-app';
const TAKEOVER_CLASS = 'cga-takeover';

export default defineContentScript({
  matches: ['https://mygroupauctions.com/*', 'https://www.mygroupauctions.com/*'],
  // Login, registration and password pages are never touched. routeFor() checks too, case insensitively.
  excludeMatches: [
    'https://mygroupauctions.com/account/*',
    'https://www.mygroupauctions.com/account/*',
    'https://mygroupauctions.com/Account/*',
    'https://www.mygroupauctions.com/Account/*',
  ],
  runAt: 'document_start',
  cssInjectionMode: 'ui',

  async main(ctx) {
    const route = routeFor(new URL(location.href));
    if (route.kind === 'untouched') return;

    // Hide MGA before it paints so there is no flash. The original form stays in the DOM for postbacks.
    const takeover = isTakeover(route);
    const hideStyle = takeover ? hideOriginalPage() : null;

    const settings = await getSettings();
    if (hideStyle) hideStyle.textContent = hideCss(settings.bg);

    await bodyReady();
    injectFonts(document);
    const host = settings.classic
      ? await mount(ctx, <UseCgaPill />, 'last')
      : await mount(ctx, takeover ? <App route={route} settings={settings} /> : <CgaBar />, takeover ? 'last' : 'first');
    if (settings.classic) {
      hideStyle?.remove();
      document.documentElement.classList.remove(TAKEOVER_CLASS);
    }
    applyTheme(host, settings);

    watchSettings((s) => {
      // Any Classic view change, from the footer, the pill or Settings, reloads into the right mode.
      if (s.classic !== settings.classic) return location.reload();
      // Colors preview live while Settings is open in another tab.
      applyTheme(host, s);
      if (hideStyle?.isConnected) hideStyle.textContent = hideCss(s.bg);
    });
  },
});

function hideOriginalPage() {
  document.documentElement.classList.add(TAKEOVER_CLASS);
  const style = document.createElement('style');
  style.textContent = hideCss('#141914');
  document.documentElement.append(style);
  return style;
}

const hideCss = (bg: Settings['bg']) => `
  html.${TAKEOVER_CLASS} body > :not(${HOST}) { display: none !important; }
  html.${TAKEOVER_CLASS}, html.${TAKEOVER_CLASS} body { background: ${bg} !important; margin: 0 !important; }
`;

function bodyReady() {
  if (document.body) return Promise.resolve();
  return new Promise<void>((r) => document.addEventListener('DOMContentLoaded', () => r(), { once: true }));
}

async function mount(ctx: ContentScriptContext, node: VNode, append: 'first' | 'last') {
  const ui = await createShadowRootUi<HTMLElement>(ctx, {
    name: HOST,
    position: 'inline',
    anchor: 'body',
    append,
    // Our host sits outside MGA's form, but keep key events from reaching MGA's own handlers anyway.
    isolateEvents: true,
    onMount(container) {
      render(node, container);
      return container;
    },
    onRemove(container) {
      if (container) render(null, container);
    },
  });
  ui.mount();
  return ui.shadowHost;
}
