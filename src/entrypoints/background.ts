import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  // Content scripts cannot open the options page themselves.
  browser.runtime.onMessage.addListener((msg: unknown) => {
    if ((msg as { type?: string })?.type === 'cga:open-options') browser.runtime.openOptionsPage();
  });
});
