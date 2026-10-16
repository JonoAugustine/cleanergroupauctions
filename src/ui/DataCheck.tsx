import { useEffect, useState } from 'preact/hooks';
import type { Route } from '@/lib/routes';
import { rememberHome } from '@/lib/home-cache';
import { LoggedOutError } from '@/mga/client';
import { parseHome, parseSelling } from '@/mga/parse';

type State = { status: 'loading' } | { status: 'ok'; lines: string[] } | { status: 'error'; message: string; loginUrl?: string };

/** Milestone 2 check: shows what the parsers read from the live MGA page. Replaced by real screens in milestone 3. */
export function DataCheck({ route }: { route: Route }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    read(route)
      .then((lines) => setState({ status: 'ok', lines }))
      .catch((e: unknown) =>
        setState({
          status: 'error',
          message: e instanceof Error ? e.message : String(e),
          loginUrl: e instanceof LoggedOutError ? e.loginUrl : undefined,
        }),
      );
  }, []);

  if (state.status === 'loading') return <p class="muted">Reading MGA data…</p>;
  if (state.status === 'error')
    return (
      <p role="alert">
        {state.message}. {state.loginUrl && <a href={state.loginUrl}>Log in to MGA</a>}
      </p>
    );
  return (
    <ul class="check">
      {state.lines.map((l) => (
        <li>{l}</li>
      ))}
    </ul>
  );
}

const dollars = (c: number) => (c ? `$${(c / 100).toFixed(2)}` : '-');

async function read(route: Route): Promise<string[]> {
  if (route.kind === 'home') {
    const h = parseHome(document);
    void rememberHome(h);
    const up = h.auctions.filter((a) => a.upcoming);
    return [
      `${h.groups.length} clubs: ${h.groups.map((g) => `${g.shortName} (${g.role})`).join(', ')}`,
      `${h.auctions.length} auctions, ${up.length} upcoming`,
      ...up.map((a) => `Upcoming: ${a.name}, ${a.date} ${a.time}, min sale ${dollars(a.minSaleCents)}`),
    ];
  }
  if (route.kind === 'selling') {
    const s = parseSelling(document);
    return [
      `${s.items.length} of your items, add link ${s.canAdd ? 'shown' : 'hidden'}`,
      ...s.items.slice(0, 3).map((i) => `#${i.lot} ${i.title.split('\n')[0]} · min ${dollars(i.minCents)} · ${i.imageIds.length} photo${i.imageIds.length === 1 ? "" : "s"}`),
    ];
  }
  return [];
}
