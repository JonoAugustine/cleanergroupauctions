import { clean } from './text';

export type GridRow = {
  tr: HTMLTableRowElement;
  /** Cell under the header with this text, e.g. "Lot #". Header text is matched case insensitively. */
  cell(header: string): HTMLTableCellElement | undefined;
};

/**
 * Reads a Telerik RadGrid table by id. Columns are looked up by header text rather than position,
 * so a column MGA adds or moves does not shift every field.
 */
export function readGrid(root: ParentNode, tableId: string): GridRow[] | null {
  const table = root.querySelector<HTMLTableElement>(`table#${tableId}`);
  if (!table) return null;
  // Plain child traversal instead of tHead/tBodies/cells: it works in every DOM, including test ones,
  // and never descends into the pager's nested tables.
  const kids = (el: Element | undefined, tag: string) => [...(el?.children ?? [])].filter((c) => c.tagName === tag);
  const headRow = kids(kids(table, 'THEAD')[0], 'TR').at(-1);
  const headers = kids(headRow, 'TH').map((th) => clean(th.textContent).toLowerCase());
  return kids(kids(table, 'TBODY')[0], 'TR')
    .filter((tr) => tr.classList.contains('record-grid-row') || tr.classList.contains('record-grid-alt'))
    .map((tr) => ({
      tr: tr as HTMLTableRowElement,
      cell(header: string) {
        const i = headers.indexOf(header.toLowerCase());
        return i < 0 ? undefined : (kids(tr, 'TD')[i] as HTMLTableCellElement | undefined);
      },
    }));
}

export const yesNo = (el: Element | undefined | null) => clean(el?.textContent).toLowerCase() === 'yes';

/** First number captured by `re` from any matching link's href inside `el`. */
export function idFromLinks(el: ParentNode, re: RegExp) {
  for (const a of el.querySelectorAll('a[href]')) {
    const m = a.getAttribute('href')!.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** The auction id a page posts back to, from <form action="...?id=N">. */
export function formQueryParam(doc: Document, name: string) {
  const action = doc.querySelector('form#aspnetForm, form')?.getAttribute('action') ?? '';
  const m = action.replace(/&amp;/g, '&').match(new RegExp(`[?&]${name}=(\\d+)`, 'i'));
  return m?.[1] ?? null;
}
