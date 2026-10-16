import { formatMax, formatMin } from '@/lib/format';
import { lotKey, toggleWatch, watch } from '@/lib/userdata';
import type { Lot } from '@/mga/types';
import { Icon } from '../Icon';
import { Photo } from './Photo';
import { Title } from './Title';

type Props = { lots: Lot[]; auctionId: string; terms: string[]; current: string | null; open: (lot: string) => void; isNew: Set<string> };

export function LotGrid({ lots, auctionId, terms, current, open, isNew }: Props) {
  return (
    <ul class="cards">
      {lots.map((l) => {
        const w = watch.value[lotKey(auctionId, l.lot)];
        return (
          <li class="card" data-watched={w ? '' : undefined} data-current={current === l.lot ? '' : undefined} key={l.lot}>
            <button type="button" class="card-open" data-open-lot={l.lot} onClick={() => open(l.lot)}>
              <span class="card-img">
                <Photo src={l.imageSrc} size={600} />
                <span class="lot-badge">{l.lot}</span>
                {isNew.has(l.lot) && <span class="new-badge">New</span>}
              </span>
              <span class="card-body">
                <span class="card-title">
                  <Title text={l.title} terms={terms} />
                </span>
                <span class="card-meta">
                  <span>Min {formatMin(l.minCents)}</span>
                  {w?.max && <span class="max">max {formatMax(w.max)}</span>}
                  {l.donation && <span class="badge-info">Donation</span>}
                </span>
                {w?.note && <span class="card-note">{w.note}</span>}
              </span>
            </button>
            <StarButton lot={l} auctionId={auctionId} />
          </li>
        );
      })}
    </ul>
  );
}

export function StarButton({ lot, auctionId }: { lot: Lot; auctionId: string }) {
  const on = !!watch.value[lotKey(auctionId, lot.lot)];
  return (
    <button
      type="button"
      class="star"
      aria-pressed={on}
      aria-label={`Watch lot ${lot.lot}`}
      onClick={() => toggleWatch(lotKey(auctionId, lot.lot))}
    >
      <Icon name="star" filled={on} />
    </button>
  );
}
