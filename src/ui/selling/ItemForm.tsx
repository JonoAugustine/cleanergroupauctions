import { useEffect, useRef, useState } from 'preact/hooks';
import { cleanMax, formatMin } from '@/lib/format';
import { photoFromMga, photoSrc, prepareUpload } from '@/lib/photos';
import { LoggedOutError } from '@/mga/client';
import { deletePhoto, openItem, saveItem, uploadPhoto, type ItemFields, type ItemSession } from '@/mga/items';
import { Icon } from '../Icon';
import { Modal } from './Modal';

/** Starting values when relisting an item from an earlier auction. */
export type Prefill = { description: string; minCents: number; donation: boolean; imageIds: string[] };

type Props = {
  auctionId: string;
  /** '0' for a new item */
  auctionItemId: string;
  lot?: string;
  prefill?: Prefill;
  minSaleCents: number | null;
  /** changed: something was written to MGA, so the list needs a reload */
  onClose: (changed: boolean) => void;
  onLoggedOut: (loginUrl: string) => void;
};

type Queued = { key: string; file: File | null; url: string | null; status: 'loading' | 'queued' | 'uploading' | 'failed' | 'unreadable' };

const dollars = (cents: number) => (cents ? (cents / 100).toFixed(2).replace(/\.00$/, '') : '0');
let nextKey = 0;

/**
 * One step item form. MGA wants a save before photos, so photos picked first wait in a queue and
 * upload one at a time right after the save. Each MGA response is the base for the next postback.
 */
export function ItemForm({ auctionId, auctionItemId, lot, prefill, minSaleCents, onClose, onLoggedOut }: Props) {
  const [session, setSession] = useState<ItemSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [minBid, setMinBid] = useState(prefill ? dollars(prefill.minCents) : '0');
  const [donation, setDonation] = useState(prefill?.donation ?? false);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ description?: string; minBid?: string }>({});
  const changed = useRef(false);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const minRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const isNew = auctionItemId === '0';

  const fail = (e: unknown) => {
    if (e instanceof LoggedOutError) onLoggedOut(e.loginUrl);
    return e instanceof Error ? e.message : String(e);
  };

  useEffect(() => {
    openItem(auctionId, auctionItemId)
      .then((s) => {
        setSession(s);
        if (!isNew) {
          setDescription(s.item.description);
          setMinBid(dollars(s.item.minCents));
          setDonation(s.item.isDonation);
        }
      })
      .catch((e) => setLoadError(fail(e)));
    if (prefill?.imageIds.length) void loadPrefillPhotos(prefill.imageIds);
    return () => urls.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const objectUrl = (f: File) => {
    const u = URL.createObjectURL(f);
    urls.current.push(u);
    return u;
  };

  const patch = (key: string, p: Partial<Queued>) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...p } : x)));

  /** Relisted photos are read back from MGA one at a time. */
  async function loadPrefillPhotos(ids: string[]) {
    const entries = ids.map((): Queued => ({ key: `q${++nextKey}`, file: null, url: null, status: 'loading' }));
    setQueue(entries);
    for (const [i, id] of ids.entries()) {
      try {
        const file = await photoFromMga(id);
        patch(entries[i]!.key, { file, url: objectUrl(file), status: 'queued' });
      } catch {
        patch(entries[i]!.key, { status: 'unreadable' });
      }
    }
  }

  function addFiles(files: FileList | null) {
    const add = [...(files ?? [])].filter((f) => f.type.startsWith('image/'));
    setQueue((q) => [...q, ...add.map((file): Queued => ({ key: `q${++nextKey}`, file, url: objectUrl(file), status: 'queued' }))]);
    if (fileRef.current) fileRef.current.value = '';
  }

  const existing = session?.item.images ?? [];
  const hasPrimary = existing.some((i) => i.primary);
  const pending = queue.filter((q) => q.file && (q.status === 'queued' || q.status === 'failed'));
  // MGA makes the newest upload with Primary ticked the only primary.
  const primary = primaryKey && pending.some((q) => q.key === primaryKey) ? primaryKey : hasPrimary ? null : (pending[0]?.key ?? null);

  async function save() {
    if (!session || busy) return;
    const errs: typeof fieldError = {};
    if (!description.trim()) errs.description = 'Description is required';
    const min = minBid.trim() === '' ? '0' : cleanMax(minBid);
    if (!min) errs.minBid = 'Enter a dollar amount, like 5 or 5.50';
    setFieldError(errs);
    if (errs.description) return descRef.current?.focus();
    if (errs.minBid) return minRef.current?.focus();

    setError(null);
    const fields: ItemFields = { description: description.trim(), minBid: min, donation };
    let s = session;
    try {
      const i = s.item;
      const dirty =
        i.auctionItemId === '0' ||
        fields.description !== i.description ||
        Math.round(Number(min) * 100) !== i.minCents ||
        fields.donation !== i.isDonation;
      if (dirty) {
        setBusy('Saving…');
        s = await saveItem(s, fields);
        changed.current = true;
        setSession(s);
      }
      const order = [...pending.filter((q) => q.key !== primary), ...pending.filter((q) => q.key === primary)];
      for (const [n, q] of order.entries()) {
        setBusy(`Uploading photo ${n + 1} of ${order.length}…`);
        patch(q.key, { status: 'uploading' });
        try {
          s = await uploadPhoto(s, await prepareUpload(q.file!), q.key === primary);
          changed.current = true;
          setSession(s);
          setQueue((all) => all.filter((x) => x.key !== q.key));
        } catch (e) {
          patch(q.key, { status: 'failed' });
          const msg = fail(e);
          // A failed upload may still have landed (SPEC.md §3.4), so show what MGA really has now.
          try {
            setSession(await openItem(auctionId, s.item.auctionItemId ?? '0'));
          } catch {}
          throw new Error(`${msg}. Check the photos above before trying again`);
        }
      }
      setBusy(null);
      onClose(changed.current);
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function removePhoto(deleteName: string) {
    if (!session || busy) return;
    setBusy('Removing photo…');
    setError(null);
    try {
      setSession(await deletePhoto(session, deleteName));
      changed.current = true;
    } catch (e) {
      setError(fail(e));
    }
    setRemoving(null);
    setBusy(null);
  }

  const close = () => !busy && onClose(changed.current);
  const title = isNew ? (session?.item.auctionItemId && session.item.auctionItemId !== '0' ? 'Item saved' : prefill ? 'Relist item' : 'Add item') : `Edit lot ${lot ?? ''}`;

  return (
    <Modal labelledBy="cga-item-title" onCancel={close} class="item-modal">
      <form
        class="item-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div class="modal-bar">
          <h2 id="cga-item-title">{title}</h2>
          <button type="button" class="icon-btn" aria-label="Close" onClick={close} disabled={!!busy}>
            <Icon name="close" />
          </button>
        </div>

        <div class="modal-body">
          {loadError ? (
            <p role="alert" class="form-error">
              {loadError}. Try again, or use Classic view.
            </p>
          ) : !session ? (
            <p class="muted">Opening…</p>
          ) : (
            <>
              <label class="field">
                Description
                <textarea
                  ref={descRef}
                  rows={4}
                  value={description}
                  onInput={(e) => {
                    setDescription(e.currentTarget.value);
                    setFieldError((f) => ({ ...f, description: undefined }));
                  }}
                  aria-invalid={!!fieldError.description}
                  aria-describedby="cga-desc-help"
                  disabled={!!busy}
                />
                <span id="cga-desc-help" class={fieldError.description ? 'form-error' : 'help'}>
                  {fieldError.description ?? 'Bidders only see this text, so include the species, count and size.'}
                </span>
              </label>

              <label class="field">
                Minimum bid
                <span class="money">
                  <span aria-hidden="true">$</span>
                  <input
                    ref={minRef}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={minBid}
                    onInput={(e) => {
                      setMinBid(e.currentTarget.value);
                      setFieldError((f) => ({ ...f, minBid: undefined }));
                    }}
                    aria-invalid={!!fieldError.minBid}
                    aria-describedby="cga-min-help"
                    disabled={!!busy}
                  />
                </span>
                <span id="cga-min-help" class={fieldError.minBid ? 'form-error' : 'help'}>
                  {fieldError.minBid ??
                    `0 means no minimum.${minSaleCents ? ` This auction's minimum sale price is ${formatMin(minSaleCents)}.` : ''}`}
                </span>
              </label>

              <label class="check-row">
                <input type="checkbox" checked={donation} onChange={(e) => setDonation(e.currentTarget.checked)} disabled={!!busy} />
                Donated to the club
              </label>

              <fieldset class="photos">
                <legend>Photos</legend>
                <ul class="photo-grid">
                  {existing.map((p) => (
                    <li class="photo-tile">
                      {p.imageId ? <img src={photoSrc(p.imageId)} alt="" /> : <span class="no-photo">Photo</span>}
                      {p.primary && <span class="photo-badge">Primary</span>}
                      {p.deleteName &&
                        (removing === p.deleteName ? (
                          <span class="photo-confirm">
                            <button type="button" class="btn btn-sm btn-danger" onClick={() => removePhoto(p.deleteName!)} disabled={!!busy}>
                              Remove
                            </button>
                            <button type="button" class="btn btn-sm" onClick={() => setRemoving(null)} disabled={!!busy}>
                              Keep
                            </button>
                          </span>
                        ) : (
                          <button type="button" class="photo-x" aria-label="Remove photo" onClick={() => setRemoving(p.deleteName)} disabled={!!busy}>
                            <Icon name="close" size={16} />
                          </button>
                        ))}
                    </li>
                  ))}
                  {queue.map((q) => (
                    <li class={`photo-tile is-${q.status}`}>
                      {q.url ? <img src={q.url} alt="" /> : <span class="no-photo">{q.status === 'unreadable' ? 'Could not read' : 'Loading…'}</span>}
                      {q.key === primary && <span class="photo-badge">Primary</span>}
                      {q.status === 'uploading' && <span class="photo-badge photo-state">Uploading</span>}
                      {q.status === 'failed' && <span class="photo-badge photo-state">Not uploaded</span>}
                      {q.file && q.key !== primary && q.status !== 'uploading' && (
                        <button type="button" class="photo-make" onClick={() => setPrimaryKey(q.key)} disabled={!!busy}>
                          Make primary
                        </button>
                      )}
                      {q.status !== 'uploading' && (
                        <button
                          type="button"
                          class="photo-x"
                          aria-label="Remove photo"
                          onClick={() => setQueue((all) => all.filter((x) => x.key !== q.key))}
                          disabled={!!busy}
                        >
                          <Icon name="close" size={16} />
                        </button>
                      )}
                    </li>
                  ))}
                  <li>
                    <label class={`photo-add${busy ? ' is-disabled' : ''}`}>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        class="sr-only"
                        onChange={(e) => addFiles(e.currentTarget.files)}
                        disabled={!!busy}
                      />
                      <span aria-hidden="true">+</span>
                      Add photos
                    </label>
                  </li>
                </ul>
                {queue.some((q) => q.status === 'queued') && <p class="help">New photos upload when you save.</p>}
              </fieldset>
            </>
          )}
          {error && (
            <p role="alert" class="form-error">
              {error}
            </p>
          )}
        </div>

        <div class="modal-foot">
          <p class="help footnote">MGA assigns lot numbers when an item is saved. Changes save straight to MyGroupAuctions.</p>
          <span class="status" role="status">
            {busy}
          </span>
          <button type="button" class="btn" onClick={close} disabled={!!busy}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={!session || !!busy}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
