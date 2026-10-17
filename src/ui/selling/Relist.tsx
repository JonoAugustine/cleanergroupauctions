import { useEffect, useRef, useState } from 'preact/hooks';
import { formatDate } from '@/lib/dates';
import { minLabel, plural } from '@/lib/format';
import { photoSrc } from '@/lib/photos';
import { LoggedOutError, mgaRequest } from '@/mga/client';
import { parseSelling } from '@/mga/parse';
import type { Auction, SellItem } from '@/mga/types';
import { Icon } from '../Icon';
import type { Prefill } from './ItemForm';
import { Modal } from './Modal';

type Props = { past: Auction[]; onPick: (p: Prefill) => void; onClose: () => void; onLoggedOut: (loginUrl: string) => void };

const STEP = 5;

/**
 * Your items from earlier auctions, newest auction first. Each Selling page lists only your own items;
 * they load one auction at a time, five per click.
 */
export function Relist({ past, onPick, onClose, onLoggedOut }: Props) {
  const [found, setFound] = useState<{ auction: Auction; items: SellItem[] }[]>([]);
  const [checked, setChecked] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  async function more(from: number) {
    setLoading(true);
    setError(null);
    for (const a of past.slice(from, from + STEP)) {
      if (stop.current) return;
      try {
        const s = parseSelling(await mgaRequest(`/auction-items.aspx?id=${a.id}`));
        if (s.items.length) setFound((f) => [...f, { auction: a, items: s.items }]);
        setChecked((n) => n + 1);
      } catch (e) {
        if (e instanceof LoggedOutError) onLoggedOut(e.loginUrl);
        setError(e instanceof Error ? e.message : String(e));
        break;
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    void more(0);
    return () => void (stop.current = true);
  }, []);

  return (
    <Modal labelledBy="cga-relist-title" onCancel={onClose} class="relist-modal">
      <div class="modal-bar">
        <h2 id="cga-relist-title">Relist from a past auction</h2>
        <button type="button" class="icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div class="modal-body">
        {found.map(({ auction: a, items }) => (
          <section class="relist-group" aria-label={a.name}>
            <h3>
              {a.name}
              <span class="small muted block">
                {formatDate(a.date, { month: 'short', day: 'numeric', year: 'numeric' })} · {a.group} · {plural(items.length, 'item')}
              </span>
            </h3>
            <ul class="plain relist-list">
              {items.map((i) => (
                <li class="relist-row">
                  <span class="thumb">{i.imageIds[0] ? <img src={photoSrc(i.imageIds[0])} alt="" loading="lazy" /> : <span class="no-photo">No photo</span>}</span>
                  <span class="relist-text">
                    <span class="title">{i.title}</span>
                    <span class="small muted block">
                      {minLabel(i.minCents)}
                      {i.imageIds.length > 0 && ` · ${plural(i.imageIds.length, 'photo')}`}
                      {i.donated && ' · donated'}
                    </span>
                  </span>
                  <button
                    type="button"
                    class="btn btn-sm"
                    onClick={() => onPick({ description: i.title, minCents: i.minCents, donation: i.donated, imageIds: i.imageIds })}
                  >
                    Relist
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!loading && checked > 0 && found.length === 0 && <p class="muted">No items in the last {plural(checked, 'auction')}.</p>}
        {error && (
          <p role="alert" class="form-error">
            {error}
          </p>
        )}
        <p class="status small muted" role="status">
          {loading ? 'Looking…' : `Checked ${plural(checked, 'past auction')} of ${past.length}.`}
        </p>
        {!loading && checked < past.length && (
          <button type="button" class="btn" onClick={() => more(checked)}>
            Look further back
          </button>
        )}
      </div>
    </Modal>
  );
}
