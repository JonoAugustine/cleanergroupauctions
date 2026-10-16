import { formatMax, formatMin } from '@/lib/format';
import { lotKey, watch } from '@/lib/userdata';
import type { Lot } from '@/mga/types';
import { StarButton } from './LotGrid';
import { Title } from './Title';

type Props = {
  lots: Lot[];
  auctionId: string;
  terms: string[];
  current: string | null;
  open: (lot: string) => void;
  selected: Set<string>;
  toggleSelected: (lot: string) => void;
};

/** Dense list. On phones the same rows fold into two lines. */
export function LotList({ lots, auctionId, terms, current, open, selected, toggleSelected }: Props) {
  return (
    <div class="list" role="table" aria-label="Lots">
      <div class="list-row list-head" role="row">
        <span role="columnheader" class="c-sel">
          <span class="sr-only">Label</span>
        </span>
        <span role="columnheader" class="c-lot">
          Lot
        </span>
        <span role="columnheader" class="c-img">
          <span class="sr-only">Photo</span>
        </span>
        <span role="columnheader" class="c-title">
          Item
        </span>
        <span role="columnheader" class="c-min">
          Min bid
        </span>
        <span role="columnheader" class="c-max">
          My max
        </span>
        <span role="columnheader" class="c-star">
          <span class="sr-only">Watch</span>
        </span>
      </div>
      {lots.map((l) => {
        const w = watch.value[lotKey(auctionId, l.lot)];
        return (
          <div class="list-row" role="row" key={l.lot} data-watched={w ? '' : undefined} data-current={current === l.lot ? '' : undefined}>
            <span role="cell" class="c-sel">
              <input
                type="checkbox"
                checked={selected.has(l.lot)}
                onChange={() => toggleSelected(l.lot)}
                aria-label={`Select lot ${l.lot} for labels`}
                disabled={!l.selectName}
              />
            </span>
            <span role="cell" class="c-lot">
              {l.lot}
            </span>
            <span role="cell" class="c-img">
              {l.imageSrc ? <img src={l.imageSrc} alt="" loading="lazy" width={48} height={48} /> : <span class="no-photo" />}
            </span>
            <span role="cell" class="c-title">
              <button type="button" class="link-btn" data-open-lot={l.lot} onClick={() => open(l.lot)}>
                <Title text={l.title} terms={terms} />
              </button>
              {w?.note && <span class="row-note">{w.note}</span>}
              <span class="row-meta">
                Min {formatMin(l.minCents)}
                {l.imageSrc && ' · photo'}
                {w?.max && ` · max ${formatMax(w.max)}`}
              </span>
            </span>
            <span role="cell" class="c-min">
              {formatMin(l.minCents)}
            </span>
            <span role="cell" class="c-max">
              {formatMax(w?.max) || '-'}
            </span>
            <span role="cell" class="c-star">
              <StarButton lot={l} auctionId={auctionId} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
