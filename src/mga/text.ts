/** One line, single spaces. */
export const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Keeps the seller's line breaks (lot titles are free text) but tidies each line. */
export function cleanMultiline(s: string | null | undefined) {
  return (s ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** "$1,234.50" to 123450. Anything unparseable is 0, which MGA shows as no minimum. */
export function moneyToCents(s: string | null | undefined) {
  const m = clean(s).replace(/[$,]/g, '').match(/^-?\d+(\.\d+)?$/);
  return m ? Math.round(parseFloat(m[0]) * 100) : 0;
}

/** MGA image URLs have a space before the id: imagehandler.ashx?type=item&id= 70408 */
export function imageIdFromSrc(src: string | null | undefined) {
  const m = (src ?? '').match(/imagehandler\.ashx\?[^#]*?\bid=(?:\s|%20|\+)*(\d+)/i);
  return m?.[1] ?? null;
}

/** "10/17/2026" and "9:00 AM" to "2026-10-17" and "09:00". */
export function parseDate(s: string) {
  const m = clean(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mo, d, y] = m as unknown as [string, string, string, string];
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function parseTime(s: string) {
  const m = clean(s).match(/^(\d{1,2}):(\d{2})\s*([AP])M$/i);
  if (!m) return null;
  const [, hh, mm, ap] = m as unknown as [string, string, string, string];
  let h = +hh % 12;
  if (ap.toUpperCase() === 'P') h += 12;
  return `${String(h).padStart(2, '0')}:${mm}`;
}

export const isDonationTitle = (title: string) => /\bdonat(ion|ed)\b/i.test(title);
