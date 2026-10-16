import { formatMax, formatMin } from '@/lib/format';
import { lotKey, toggleWatch, watch } from '@/lib/userdata';
import type { Lot } from '@/mga/types';
import { Icon } from '../Icon';
import { Title } from './Title';

type Props = { lots: Lot[]; auctionId: string; terms: string[]; current: string | null; open: (lot: string) => void };

export function LotGrid({ lots, auctionId, terms, current, open }: Props) {
  return (
    <ul class="cards">
      {lots.map((l) => {
        const w = watch.value[lotKey(auctionId, l.lot)];
        return (
          <li class="card" data-watched={w ? '' : undefined} data-current={current === l.lot ? '' : undefined} key={l.lot}>
            <button type="button" class="card-open" data-open-lot={l.lot} onClick={() => open(l.lot)}>
              <span class="card-img">
                {l.imageSrc ? <img src={l.imageSrc} alt="" loading="lazy" width={600} height={600} /> : <span class="no-photo">No photo</span>}
                <span class="lot-badge">{l.lot}</span>
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
