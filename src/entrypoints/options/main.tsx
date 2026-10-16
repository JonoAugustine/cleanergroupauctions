import '@/ui/tokens.css';
import { browser } from 'wxt/browser';
import './style.css';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { getSettings, setClassic, watchSettings, type Settings } from '@/lib/settings';
import { CREDIT } from '@/ui/Chrome';

function Options() {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    getSettings().then(setS);
    return watchSettings(setS);
  }, []);
  if (!s) return null;

  return (
    <main>
      <h1>Settings</h1>
      <section>
        <h2>Behavior</h2>
        <label class="row">
          <input type="checkbox" checked={s.classic} onChange={(e) => setClassic(e.currentTarget.checked)} />
          <span>
            Classic view
            <small>Turn CGA off and use the original MyGroupAuctions pages.</small>
          </span>
        </label>
      </section>
      <section>
        <h2>About</h2>
        <p>Version {browser.runtime.getManifest().version}</p>
        <p>{CREDIT}</p>
        <p>
          <a href="https://github.com/JonoAugustine/cleanergroupauctions/issues">Report an issue</a>
        </p>
      </section>
    </main>
  );
}

render(<Options />, document.getElementById('app')!);
