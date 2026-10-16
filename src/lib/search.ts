/**
 * Lot search syntax (SPEC.md §4.1):
 *   words       all must match (case insensitive substring of the title)
 *   -word       excludes
 *   "a phrase"  exact phrase
 *   120-150     lot range
 *   #143        one lot
 *   143         lot 143, or a title containing "143"
 */
export type Term =
  | { kind: 'text'; value: string }
  | { kind: 'range'; from: number; to: number }
  | { kind: 'lot'; value: string }
  | { kind: 'number'; value: string };

export type Query = { include: Term[]; exclude: Term[] };

export type Searchable = { lot: string; lotNum: number; title: string };

export function parseQuery(q: string): Query {
  const include: Term[] = [];
  const exclude: Term[] = [];
  const re = /(-?)"([^"]*)"?|(-?)(\S+)/g;
  for (let m; (m = re.exec(q)); ) {
    const neg = !!(m[1] || m[3]);
    const raw = m[2] ?? m[4] ?? '';
    const term = m[2] != null ? textTerm(raw) : tokenTerm(raw);
    if (term) (neg ? exclude : include).push(term);
  }
  return { include, exclude };
}

function textTerm(raw: string): Term | null {
  const value = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  return value ? { kind: 'text', value } : null;
}

function tokenTerm(raw: string): Term | null {
  if (!raw || raw === '-') return null;
  const range = raw.match(/^(\d+)-(\d+)$/);
  if (range) {
    const a = +range[1]!;
    const b = +range[2]!;
    return { kind: 'range', from: Math.min(a, b), to: Math.max(a, b) };
  }
  const lot = raw.match(/^#(\d+)$/);
  if (lot) return { kind: 'lot', value: String(+lot[1]!) };
  if (/^\d+$/.test(raw)) return { kind: 'number', value: raw };
  return textTerm(raw);
}

const norm = (s: string) => s.replace(/\s+/g, ' ').toLowerCase();

export function matchTerm(l: Searchable, t: Term, titleLC = norm(l.title)) {
  switch (t.kind) {
    case 'range':
      return l.lotNum >= t.from && l.lotNum <= t.to;
    case 'lot':
      return l.lotNum === +t.value;
    case 'number':
      return l.lotNum === +t.value || titleLC.includes(t.value);
    case 'text':
      return titleLC.includes(t.value);
  }
}

export function matchQuery(l: Searchable, q: Query) {
  const titleLC = norm(l.title);
  return q.include.every((t) => matchTerm(l, t, titleLC)) && !q.exclude.some((t) => matchTerm(l, t, titleLC));
}

export const isEmptyQuery = (q: Query) => !q.include.length && !q.exclude.length;

/** Strings to highlight in titles: included words, phrases and bare numbers. */
export const highlightTerms = (q: Query) =>
  q.include.flatMap((t) => (t.kind === 'text' || t.kind === 'number' ? [t.value] : []));

export type Segment = { text: string; hit: boolean };

/** Splits a title into plain and highlighted runs. Whitespace in terms matches any whitespace. */
export function highlight(title: string, terms: string[]): Segment[] {
  const parts = terms.filter(Boolean).map((t) => t.split(' ').map(escapeRe).join('\\s+'));
  if (!parts.length) return [{ text: title, hit: false }];
  const re = new RegExp(`(${parts.sort((a, b) => b.length - a.length).join('|')})`, 'gi');
  // split() with a capturing group puts the matches at odd indexes.
  return title
    .split(re)
    .map((text, i) => ({ text, hit: i % 2 === 1 }))
    .filter((seg) => seg.text !== '');
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
