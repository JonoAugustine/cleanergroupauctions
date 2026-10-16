import { useEffect, useRef } from 'preact/hooks';
import { setClassic } from '@/lib/settings';
import { cleanMax, formatMin } from '@/lib/format';
import { hidden, lotKey, toggleHidden, toggleWatch, updateWatch, watch } from '@/lib/userdata';
import type { Lot } from '@/mga/types';
import { Icon } from '../Icon';
import { Photo } from './Photo';
import { Title } from './Title';

type Props = {
  lot: Lot;
  auctionId: string;
  terms: string[];
  /** 1 based position in the current results, or 0 when the lot is no longer in them */
  position: number;
  total: number;
  step: (dir: 1 | -1) => void;
  close: () => void;
  enlarge: () => void;
  /** bumps when N is pressed, to focus the note */
  noteFocus: number;
  isNew: boolean;
};

export function LotDrawer({ lot, auctionId, terms, position, total, step, close, enlarge, noteFocus, isNew }: Props) {
  const key = lotKey(auctionId, lot.lot);
  const w = watch.value[key];
  const isHidden = !!hidden.value[key];
  const heading = useRef<HTMLHeadingElement>(null);
  const note = useRef<HTMLTextAreaElement>(null);

  useEffect(() => heading.current?.focus(), [lot.lot]);
  useEffect(() => void (noteFocus && note.current?.focus()), [noteFocus]);

  return (
    <aside class="drawer" aria-labelledby="cga-drawer-title">
      <div class="drawer-bar">
        <button type="button" class="icon-btn" onClick={() => step(-1)} aria-label="Previous lot" disabled={total < 2}>
          <Icon name="prev" />
        </button>
        <span class="small muted">{position ? `${position} of ${total}` : 'Not in results'}</span>
        <button type="button" class="icon-btn" onClick={() => step(1)} aria-label="Next lot" disabled={total < 2}>
          <Icon name="next" />
        </button>
        <span class="spacer" />
        <button type="button" class="icon-btn" onClick={close} aria-label="Close lot">
          <Icon name="close" />
        </button>
      </div>

      <div class="drawer-body">
        {lot.imageSrc ? (
          <button type="button" class="drawer-img" onClick={enlarge} aria-label="Enlarge photo" key={lot.lot}>
            <Photo src={lot.imageSrc} size={600} />
          </button>
        ) : (
          <div class="drawer-img no-photo">No photo</div>
        )}

        <p class="eyebrow">
          Lot {lot.lot} · Min {formatMin(lot.minCents)}
          {lot.donation && <span class="badge-info">Donation</span>}
          {isNew && <span class="new-badge inline">New</span>}
        </p>
        <h2 id="cga-drawer-title" class="drawer-title" tabIndex={-1} ref={heading}>
          <Title text={lot.title} terms={terms} />
        </h2>

        <div class="btn-row">
          <button type="button" class={`btn ${w ? 'btn-watch' : ''}`} aria-pressed={!!w} onClick={() => toggleWatch(key)}>
            <Icon name="star" filled={!!w} />
            {w ? 'Watching' : 'Watch'}
          </button>
          <button type="button" class="btn" aria-pressed={isHidden} onClick={() => toggleHidden(key)}>
            <Icon name="eyeOff" />
            {isHidden ? 'Unhide' : 'Hide'}
          </button>
        </div>

        <label class="field" key={`max-${lot.lot}`}>
          <span>My max bid</span>
          <span class="money">
            <span aria-hidden="true">$</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={w?.max ?? ''}
              placeholder="0"
              onChange={(e) => {
                const max = cleanMax(e.currentTarget.value);
                e.currentTarget.value = max;
                updateWatch(key, { max });
              }}
            />
          </span>
        </label>

        <label class="field" key={`note-${lot.lot}`}>
          <span>Private note</span>
          <textarea
            ref={note}
            rows={3}
            value={w?.note ?? ''}
            onChange={(e) => updateWatch(key, { note: e.currentTarget.value.trim() })}
          />
        </label>
        <p class="small muted">Notes and max bids stay in this browser. Adding one watches the lot.</p>

        <button type="button" class="link-btn small" onClick={() => setClassic(true)}>
          Open on MyGroupAuctions (Classic view)
        </button>
      </div>
    </aside>
  );
}

export function Lightbox({ lot, close }: { lot: Lot; close: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus(), []);
  return (
    <div class="lightbox" role="dialog" aria-modal="true" aria-label={`Photo of lot ${lot.lot}`} onClick={close}>
      <img src={lot.imageSrc!} alt="" />
      <button type="button" class="icon-btn lightbox-close" ref={btn} onClick={close} aria-label="Close photo">
        <Icon name="close" />
      </button>
    </div>
  );
}
