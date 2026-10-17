import { useEffect, useMemo, useState } from 'preact/hooks';
import { byStart, formatDate } from '@/lib/dates';
import { minLabel, plural } from '@/lib/format';
import { getHome } from '@/lib/home-cache';
import { rememberSelling } from '@/lib/lots-source';
import { photoSrc } from '@/lib/photos';
import { LoggedOutError, submitPostBack } from '@/mga/client';
import { copyItem, deleteItem, PRINT_TARGETS, reloadList } from '@/mga/items';
import { parseSelling } from '@/mga/parse';
import type { Auction, Home, SellItem, Selling } from '@/mga/types';
import { Shell } from '../Chrome';
import { ItemForm, type Prefill } from './ItemForm';
import { Relist } from './Relist';

type Editing = { auctionItemId: string; lot?: string; prefill?: Prefill };
type Confirm = { kind: 'copy' | 'delete'; item: SellItem };

/**
 * Your listings for one auction. Edits go through MGA's own item dialog page; Copy and Delete post
 * MGA's hidden form on this page. Every write is one click by the user, confirmed where MGA confirms.
 */
export function SellingScreen({ auctionId }: { auctionId: string }) {
  const form = useMemo(() => document.querySelector<HTMLFormElement>('form#aspnetForm'), []);
  const [selling, setSelling] = useState<Selling>(() => parseSelling(document));
  const [home, setHome] = useState<Home | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [relisting, setRelisting] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);

  useEffect(() => {
    void rememberSelling(auctionId, selling);
    getHome()
      .then(setHome)
      .catch((e) => e instanceof LoggedOutError && setLoginUrl(e.loginUrl));
  }, []);

  const auction: Auction | undefined = home?.auctions.find((a) => a.id === auctionId);
  // Adding to a past auction is unverified, so CGA only writes to auctions Home lists as upcoming.
  const open = !!auction?.upcoming && !!form;
  const past = useMemo(() => (home?.auctions ?? []).filter((a) => !a.upcoming && a.id !== auctionId).sort(byStart).reverse(), [home]);

  const update = (s: Selling) => {
    setSelling(s);
    void rememberSelling(auctionId, s);
  };

  const fail = (e: unknown) => {
    if (e instanceof LoggedOutError) setLoginUrl(e.loginUrl);
    setError(e instanceof Error ? e.message : String(e));
  };

  async function run(c: Confirm) {
    if (!form || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (c.kind === 'copy') {
        const s = await copyItem(form, c.item.copyName!, selling.items.length);
        update(s);
        const added = s.items.find((i) => !selling.items.some((o) => o.auctionItemId === i.auctionItemId));
        setNotice(`Copied as lot ${added?.lot ?? ''}.`);
      } else {
        update(await deleteItem(form, c.item.deleteName!, c.item.auctionItemId));
        setNotice(`Deleted lot ${c.item.lot}.`);
      }
    } catch (e) {
      fail(e);
      // Show what MGA really has, whatever happened.
      reloadList(form).then(update, () => {});
    }
    setConfirm(null);
    setBusy(false);
  }

  async function closeForm(changed: boolean) {
    setEditing(null);
    if (!changed || !form) return;
    try {
      update(await reloadList(form));
      setNotice('Saved to MyGroupAuctions.');
    } catch (e) {
      fail(e);
    }
  }

  const items = selling.items;

  return (
    <Shell screen="selling" auctionId={auctionId}>
      <main class="main selling">
        {loginUrl && (
          <p class="banner" role="alert">
            Your MGA session ended. <a href={loginUrl}>Log in to MGA</a>
          </p>
        )}
        <div class="selling-head">
          <div>
            <p class="eyebrow">Selling</p>
            <h1>{auction?.name ?? 'Your listings'}</h1>
            {auction && (
              <p class="muted">
                {formatDate(auction.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {auction.group} · {plural(items.length, 'item')}
              </p>
            )}
          </div>
          {open && (
            <div class="btn-row">
              <button type="button" class="btn btn-primary" onClick={() => setEditing({ auctionItemId: '0' })}>
                Add item
              </button>
              {past.length > 0 && (
                <button type="button" class="btn" onClick={() => setRelisting(true)}>
                  Relist from a past auction
                </button>
              )}
            </div>
          )}
        </div>

        {home && !open && (
          <p class="note">This auction is not open for listing in CGA. You can still view your items here, or use Classic view.</p>
        )}

        <p class="status" role="status">
          {notice}
        </p>
        {error && (
          <p class="form-error" role="alert">
            {error}
          </p>
        )}

        {items.length === 0 ? (
          <p class="sell-empty">Nothing listed yet. Add an item, or relist something you sold at an earlier auction.</p>
        ) : (
          <ul class="sell-list">
            {items.map((i) => (
              <li class="sell-row">
                <span class="thumb">{i.imageIds[0] ? <img src={photoSrc(i.imageIds[0])} alt="" loading="lazy" /> : <span class="no-photo">No photo</span>}</span>
                <span class="sell-lot">Lot {i.lot}</span>
                <span class="sell-text">
                  <span class="title">{i.title}</span>
                  <span class="small muted block">
                    {minLabel(i.minCents)} · {plural(i.imageIds.length, 'photo')}
                    {i.donated && ' · donated'}
                  </span>
                </span>
                {confirm?.item.auctionItemId === i.auctionItemId ? (
                  <span class="sell-actions confirm">
                    <span class="small">{confirm.kind === 'copy' ? `Copy lot ${i.lot} as a new item?` : `Delete lot ${i.lot}?`}</span>
                    <button
                      type="button"
                      class={`btn btn-sm ${confirm.kind === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                      onClick={() => run(confirm)}
                      disabled={busy}
                    >
                      {busy ? (confirm.kind === 'copy' ? 'Copying…' : 'Deleting…') : confirm.kind === 'copy' ? 'Copy' : 'Delete'}
                    </button>
                    <button type="button" class="btn btn-sm" onClick={() => setConfirm(null)} disabled={busy}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  open && (
                    <span class="sell-actions">
                      <button type="button" class="btn btn-sm" onClick={() => setEditing({ auctionItemId: i.auctionItemId, lot: i.lot })} disabled={busy}>
                        Edit
                      </button>
                      {i.copyName && (
                        <button type="button" class="btn btn-sm" onClick={() => setConfirm({ kind: 'copy', item: i })} disabled={busy}>
                          Copy
                        </button>
                      )}
                      {i.deleteName && (
                        <button type="button" class="btn btn-sm btn-danger-quiet" onClick={() => setConfirm({ kind: 'delete', item: i })} disabled={busy}>
                          Delete
                        </button>
                      )}
                    </span>
                  )
                )}
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && form && (
          <section class="labels" aria-labelledby="h-labels">
            <h2 id="h-labels">Labels</h2>
            <p class="muted small">Opens MGA's own label sheet for your items.</p>
            <div class="btn-row">
              <button type="button" class="btn" onClick={() => submitPostBack(form, PRINT_TARGETS.avery5160)}>
                Print labels (Avery 5160)
              </button>
              <button type="button" class="btn" onClick={() => submitPostBack(form, PRINT_TARGETS.avery8164)}>
                Print labels (Avery 8164)
              </button>
            </div>
          </section>
        )}

        <p class="help footnote">MGA assigns lot numbers when an item is saved. Changes save straight to MyGroupAuctions.</p>
      </main>

      {editing && (
        <ItemForm
          auctionId={auctionId}
          auctionItemId={editing.auctionItemId}
          lot={editing.lot}
          prefill={editing.prefill}
          minSaleCents={auction?.minSaleCents ?? null}
          onClose={closeForm}
          onLoggedOut={setLoginUrl}
        />
      )}
      {relisting && (
        <Relist
          past={past}
          onClose={() => setRelisting(false)}
          onLoggedOut={setLoginUrl}
          onPick={(prefill) => {
            setRelisting(false);
            setEditing({ auctionItemId: '0', prefill });
          }}
        />
      )}
    </Shell>
  );
}
