import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { mergeHidden, mergeWatch } from '@/lib/backup';
import { getSettings, updateSettings } from '@/lib/settings';
import { fromSyncItems, SYNCED_SETTINGS, syncDiff, toSyncItems } from '@/lib/sync-items';
import { syncStatus } from '@/lib/sync-status';
import { hiddenItem, watchItem } from '@/lib/stores';

export default defineBackground(() => {
  // Content scripts cannot open the options page themselves.
  browser.runtime.onMessage.addListener((msg: unknown) => {
    if ((msg as { type?: string })?.type === 'cga:open-options') browser.runtime.openOptionsPage();
  });

  // Sync across browsers (SPEC.md §6): storage.local is the source of truth; a compact copy goes to
  // storage.sync while the switch is on. Both directions compare before writing, so echoes stop.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queued: 'push' | 'pull' | 'join' | null = null;
  const schedule = (job: 'push' | 'pull' | 'join') => {
    if (queued !== 'join') queued = job;
    clearTimeout(timer);
    timer = setTimeout(run, 800);
  };

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      const before = changes.settings.oldValue as { sync?: boolean } | undefined;
      const after = changes.settings.newValue as { sync?: boolean } | undefined;
      if (after?.sync && !before?.sync) return schedule('join');
    }
    if (area === 'local' && (changes.watch || changes.hidden || changes.settings)) schedule('push');
    if (area === 'sync') schedule('pull');
  });

  async function run() {
    const job = queued;
    queued = null;
    const settings = await getSettings();
    if (!settings.sync || !job) return;
    try {
      const remote = await browser.storage.sync.get(null);
      const theirs = fromSyncItems(remote);
      let watch = await watchItem.getValue();
      let hidden = await hiddenItem.getValue();

      if (job === 'join') {
        // First sync on this browser: keep both sides, newest entry wins.
        watch = mergeWatch(watch, theirs.watch);
        hidden = mergeHidden(hidden, theirs.hidden);
      } else if (job === 'pull') {
        // Another browser wrote; its copy already includes everything it had merged.
        watch = theirs.watch;
        hidden = theirs.hidden;
        const patch = Object.fromEntries(
          SYNCED_SETTINGS.filter((k) => theirs.settings?.[k] !== undefined && theirs.settings[k] !== settings[k]).map((k) => [k, theirs.settings![k]]),
        );
        if (Object.keys(patch).length) await updateSettings(patch);
      }

      if (JSON.stringify(watch) !== JSON.stringify(await watchItem.getValue())) await watchItem.setValue(watch);
      if (JSON.stringify(hidden) !== JSON.stringify(await hiddenItem.getValue())) await hiddenItem.setValue(hidden);

      const { set, remove } = syncDiff(remote, toSyncItems(watch, hidden, await getSettings()));
      if (remove.length) await browser.storage.sync.remove(remove);
      if (Object.keys(set).length) await browser.storage.sync.set(set);
      await syncStatus.setValue({ at: Date.now(), error: null });
    } catch (e) {
      // Usually the sync quota. Local data is untouched.
      await syncStatus.setValue({ at: Date.now(), error: e instanceof Error ? e.message : String(e) });
    }
  }

});
