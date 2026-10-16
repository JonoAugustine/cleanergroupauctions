import type { Filters, Show, Sort } from '@/lib/filters';
import { plural } from '@/lib/format';
import { Icon } from '../Icon';

type Props = {
  filters: Filters;
  set: (patch: Partial<Filters>) => void;
  counts: Record<Show, number>;
  resultCount: number;
  labels: {
    count: number;
    selectShown: () => void;
    selectWatched: () => void;
    clear: () => void;
    print: () => void;
    copyWatchlist: () => void;
    csv: () => void;
  };
  /** Set when shown as a slide over or bottom sheet. */
  onClose?: () => void;
};

const SHOWS: [Show, string][] = [
  ['all', 'All lots'],
  ['watched', 'Watched'],
  ['hidden', 'Hidden'],
];
const SORTS: [Sort, string][] = [
  ['lot', 'Lot number'],
  ['name', 'Name'],
  ['min', 'Minimum bid'],
];

export function FilterPanel({ filters: f, set, counts, resultCount, labels, onClose }: Props) {
  return (
    <div class="panel">
      {onClose && (
        <div class="panel-head">
          <h2 id="cga-filters-title">Filters</h2>
          <button type="button" class="icon-btn" onClick={onClose} aria-label="Close filters">
            <Icon name="close" />
          </button>
        </div>
      )}

      <fieldset>
        <legend>Show</legend>
        {SHOWS.map(([value, label]) => (
          <label class="opt">
            <input type="radio" name="cga-show" checked={f.show === value} onChange={() => set({ show: value })} />
            <span>{label}</span>
            <span class="count">{counts[value]}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Only</legend>
        <label class="opt">
          <input type="checkbox" checked={f.photo} onChange={(e) => set({ photo: e.currentTarget.checked })} />
          <span>Has photo</span>
        </label>
        <label class="opt">
          <input type="checkbox" checked={f.noMin} onChange={(e) => set({ noMin: e.currentTarget.checked })} />
          <span>No minimum bid</span>
        </label>
        <label class="opt">
          <input type="checkbox" checked={f.donations} onChange={(e) => set({ donations: e.currentTarget.checked })} />
          <span>Include donated lots</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Sort by</legend>
        {SORTS.map(([value, label]) => (
          <label class="opt">
            <input type="radio" name="cga-sort" checked={f.sort === value} onChange={() => set({ sort: value })} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Labels</legend>
        <p class="small">
          Selected for labels: <strong>{labels.count}</strong>
        </p>
        <div class="btn-row">
          <button type="button" class="btn btn-sm" onClick={labels.selectShown}>
            Select shown
          </button>
          <button type="button" class="btn btn-sm" onClick={labels.selectWatched}>
            Select watched
          </button>
          {labels.count > 0 && (
            <button type="button" class="btn btn-sm" onClick={labels.clear}>
              Clear
            </button>
          )}
        </div>
        <button type="button" class="btn btn-primary btn-block" onClick={labels.print} disabled={!labels.count}>
          Print selected
        </button>
        <div class="btn-row">
          <button type="button" class="btn btn-sm" onClick={labels.copyWatchlist}>
            Copy watchlist
          </button>
          <button type="button" class="btn btn-sm" onClick={labels.csv}>
            Export CSV
          </button>
        </div>
      </fieldset>

      <details class="tips">
        <summary>Search tips</summary>
        <ul class="small">
          <li>
            <code>pleco cory</code> both words
          </li>
          <li>
            <code>-bristlenose</code> leaves out a word
          </li>
          <li>
            <code>"group of 6"</code> exact phrase
          </li>
          <li>
            <code>120-150</code> lot range, <code>#143</code> one lot
          </li>
        </ul>
      </details>

      {onClose && (
        <div class="panel-foot">
          <button type="button" class="btn btn-primary btn-block" onClick={onClose}>
            Show {plural(resultCount, 'lot')}
          </button>
        </div>
      )}
    </div>
  );
}
