/** "2026-10-17" to "Sat, Oct 17", in the viewer's locale. MGA dates have no time zone; they are the club's local date. */
export function formatDate(date: string | null, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

/** "09:00" to "9:00 AM". */
export function formatTime(time: string | null) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number) as [number, number];
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Soonest first, by date then time. */
export const byStart = (a: { date: string | null; time: string | null }, b: { date: string | null; time: string | null }) =>
  `${a.date ?? '9999'}T${a.time ?? '99'}`.localeCompare(`${b.date ?? '9999'}T${b.time ?? '99'}`);
