import { highlight } from '@/lib/search';

/** Lot title with search matches marked. Line breaks the seller typed are kept. */
export function Title({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlight(text, terms).map((s) => (s.hit ? <mark>{s.text}</mark> : s.text))}
    </>
  );
}
