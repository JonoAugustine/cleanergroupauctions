import '@/ui/tokens.css';
import './style.css';
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { makeBackup, mergeHidden, mergeWatch, parseBackup } from '@/lib/backup';
import { exportFile } from '@/lib/download';
import { injectFonts } from '@/lib/fonts';
import { plural } from '@/lib/format';
import { DEFAULT_SETTINGS, getSettings, updateSettings, watchSettings, type Settings } from '@/lib/settings';
import { syncStatus } from '@/lib/sync-status';
import { applyTheme, contrast } from '@/lib/theme';
import { hiddenItem, watchItem } from '@/lib/userdata';
import { CREDIT } from '@/ui/Chrome';
import { Icon } from '@/ui/Icon';
import { ColorField } from './ColorField';

injectFonts(document);

function Options() {
  const [s, setS] = useState<Settings | null>(null);
  const [sync, setSync] = useState<{ at: number; error: string | null } | null>(null);
  useEffect(() => {
    getSettings().then(setS);
    syncStatus.getValue().then(setSync);
    const a = watchSettings(setS);
    const b = syncStatus.watch(setSync);
    return () => (a(), b());
  }, []);
  // The whole page previews color changes as they are picked.
  useEffect(() => void (s && applyTheme(document.documentElement, s)), [s?.accent, s?.bg, s?.watch]);
  if (!s) return null;

  const set = (patch: Partial<Settings>) => {
    setS({ ...s, ...patch });
    void updateSettings(patch);
  };
  const ratio = contrast(s.accent, s.bg);
  const isDefault = s.accent === DEFAULT_SETTINGS.accent && s.bg === DEFAULT_SETTINGS.bg && s.watch === DEFAULT_SETTINGS.watch;

  return (
    <main>
      <h1>Settings</h1>

      <section aria-labelledby="h-colors">
        <h2 id="h-colors">Colors</h2>
        <div class="colors">
          <div>
            <ColorField role="accent" label="Accent" value={s.accent} onChange={(accent) => set({ accent })} />
            <ColorField role="bg" label="Background" value={s.bg} onChange={(bg) => set({ bg })} />
            <ColorField role="watch" label="Watched" value={s.watch} onChange={(watch) => set({ watch })} />
            {ratio < 3 && (
              <p class="warn" role="status">
                The accent is hard to see on this background ({ratio.toFixed(1)}:1, aim for 3:1). Pick a lighter accent or a darker
                background.
              </p>
            )}
            <button
              type="button"
              class="btn"
              disabled={isDefault}
              onClick={() => set({ accent: DEFAULT_SETTINGS.accent, bg: DEFAULT_SETTINGS.bg, watch: DEFAULT_SETTINGS.watch })}
            >
              Reset to defaults
            </button>
          </div>
          <Preview />
        </div>
      </section>

      <section aria-labelledby="h-behavior">
        <h2 id="h-behavior">Behavior</h2>
        <Switch label="Classic view" hint="Turn CGA off and use the original MyGroupAuctions pages." checked={s.classic} onChange={(classic) => set({ classic })} />
        <Switch
          label="Sync across browsers"
          hint="Copies your watchlist, notes, max bids and colors through your browser's own sync. Space is small, about 100 KB."
          checked={s.sync}
          onChange={(v) => set({ sync: v })}
        />
        {s.sync && sync && (
          <p class={sync.error ? 'warn' : 'small muted'} role="status">
            {sync.error ? `Last sync failed: ${sync.error}` : `Last synced ${new Date(sync.at).toLocaleString()}`}
          </p>
        )}
        <Switch
          label="Show donated lots"
          hint="Include donated lots in the catalog by default."
          checked={s.donations}
          onChange={(donations) => set({ donations })}
        />
        <fieldset class="row-group">
          <legend>Default view</legend>
          {(['grid', 'list'] as const).map((v) => (
            <label class="opt">
              <input type="radio" name="cga-view" checked={s.view === v} onChange={() => set({ view: v })} />
              <Icon name={v} />
              <span>{v === 'grid' ? 'Grid' : 'List'}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <YourData settings={s} />

      <section aria-labelledby="h-about">
        <h2 id="h-about">About</h2>
        <p>Version {browser.runtime.getManifest().version}</p>
        <p>{CREDIT}</p>
        <p>
          <a href="https://github.com/JonoAugustine/cleanergroupauctions/issues">Report an issue</a>
        </p>
      </section>
    </main>
  );
}

function Switch({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span class="track" aria-hidden="true" />
      <span>
        {label}
        <small>{hint}</small>
      </span>
    </label>
  );
}

function YourData({ settings }: { settings: Settings }) {
  const [msg, setMsg] = useState('');
  const [confirming, setConfirming] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    const b = makeBackup(settings, await watchItem.getValue(), await hiddenItem.getValue());
    exportFile(`cga-backup-${b.exportedAt.slice(0, 10)}.json`, JSON.stringify(b, null, 2), 'application/json');
  };

  const doImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const b = parseBackup(await f.text());
      // Merge, never wipe: newest entry wins for lots in both. Classic view and sync stay as they are here.
      await watchItem.setValue(mergeWatch(await watchItem.getValue(), b.watch));
      await hiddenItem.setValue(mergeHidden(await hiddenItem.getValue(), b.hidden));
      const { classic, sync, ...rest } = b.settings;
      await updateSettings(rest);
      setMsg(`Imported ${plural(Object.keys(b.watch).length, 'watched lot')} and ${plural(Object.keys(b.hidden).length, 'hidden lot')}.`);
    } catch (e) {
      setMsg(e instanceof Error ? `${e.message}.` : 'Could not read that file.');
    } finally {
      if (file.current) file.current.value = '';
    }
  };

  const clearAll = async () => {
    if (settings.sync) await browser.storage.sync.clear();
    await browser.storage.local.clear();
    setConfirming(false);
    setMsg('All CGA data is cleared.');
  };

  return (
    <section aria-labelledby="h-data">
      <h2 id="h-data">Your data</h2>
      <p class="muted">
        Watchlist, notes, max bids and saved searches live in your browser. CGA never sends them anywhere and never sees your MGA
        password.
      </p>
      <div class="btn-row">
        <button type="button" class="btn" onClick={doExport}>
          Export as file
        </button>
        <label class="btn">
          Import
          <input ref={file} type="file" accept=".json,application/json" class="sr-only" onChange={(e) => doImport(e.currentTarget.files?.[0])} />
        </label>
        {!confirming && (
          <button type="button" class="btn btn-danger" onClick={() => setConfirming(true)}>
            Clear all CGA data
          </button>
        )}
      </div>
      {confirming && (
        <div class="confirm" role="alertdialog" aria-labelledby="cga-clear-q">
          <p id="cga-clear-q">
            Remove your watchlist, notes, max bids, hidden lots and settings from this browser{settings.sync ? ' and from sync' : ''}? This
            cannot be undone.
          </p>
          <div class="btn-row">
            <button type="button" class="btn btn-danger" onClick={clearAll}>
              Clear everything
            </button>
            <button type="button" class="btn" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p class="small" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}

/** A small slice of the Lots screen so color picks can be judged in place. */
function Preview() {
  return (
    <div class="preview" aria-label="Preview" role="img">
      <div class="p-bar">
        <span class="p-word">CGA</span>
        <span class="p-tab on">Lots</span>
        <span class="p-tab">Selling</span>
      </div>
      <div class="p-body">
        <span class="chip">Has photo</span>
        <div class="p-cards">
          <div class="p-card watched">
            <div class="p-img">
              <span class="p-badge">143</span>
              <span class="p-star on">
                <Icon name="star" filled />
              </span>
            </div>
            <div class="p-text">
              <span>Bristlenose pleco, group of 6</span>
              <span class="p-meta">
                Min $3.00 <span class="p-max">max $12</span>
              </span>
            </div>
          </div>
          <div class="p-card">
            <div class="p-img">
              <span class="p-badge">144</span>
              <span class="p-star">
                <Icon name="star" />
              </span>
            </div>
            <div class="p-text">
              <span>Java fern on driftwood</span>
              <span class="p-meta">Min -</span>
            </div>
          </div>
        </div>
        <span class="btn btn-primary">Print selected</span>
      </div>
    </div>
  );
}

render(<Options />, document.getElementById('app')!);
