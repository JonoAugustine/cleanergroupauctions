// Writes to MGA: every function here changes a real club auction. Callers run them only on the
// user's own click, one at a time, and never retry on their own (SPEC.md §3.4: abandoned uploads
// still land). Behavior below was captured from MGA on Oct 16, 2026.
import { adoptGrid, mgaRequest } from './client';
import { hiddenInputs, parseItemDialog, parseSelling } from './parse';
import type { ItemDialog, Selling } from './types';

const P = 'ctl00$Content$';

/** One open item dialog: the last page MGA returned for it, which every next postback builds on. */
export type ItemSession = { url: string; doc: Document; item: ItemDialog };

export type ItemFields = { description: string; minBid: string; donation: boolean };

export class MgaWriteError extends Error {}

export const dialogUrl = (auctionId: string, auctionItemId = '0') =>
  `/dialogs/AuctionItem.aspx?auctionItemId=${auctionItemId}&auctionId=${auctionId}&mode=user`;

/** Opens the dialog for a new item (id 0) or one of the user's own items. Read only. */
export async function openItem(auctionId: string, auctionItemId = '0'): Promise<ItemSession> {
  const url = new URL(dialogUrl(auctionId, auctionItemId), location.origin).href;
  const doc = await mgaRequest(url);
  return { url, doc, item: parseItemDialog(doc) };
}

/** The dialog's own form fields as MGA's page would send them, plus the given extras. */
export function itemBody(s: ItemSession, fields: ItemFields, extra: [string, string | File][] = []) {
  const multipart = /multipart/i.test(s.doc.querySelector('form#aspnetForm')?.getAttribute('enctype') ?? '');
  const pairs: [string, string | File][] = [
    ...Object.entries(hiddenInputs(s.doc)).filter(([k]) => k !== `${P}AuctionItemIDHF`),
    [`${P}AuctionItemIDHF`, s.item.auctionItemId ?? '0'],
    [`${P}DescriptionTB`, fields.description],
    [`${P}MinBidTB`, fields.minBid],
    ...(fields.donation ? ([[`${P}IsDonationCB`, 'on']] as [string, string][]) : []),
    ...extra,
  ];
  if (multipart) {
    const fd = new FormData();
    // Browsers send the empty file field on every multipart submit; MGA saw it that way.
    if (!pairs.some(([k]) => k === `${P}FileUpload1`)) pairs.push([`${P}FileUpload1`, new File([], '', { type: 'application/octet-stream' })]);
    for (const [k, v] of pairs) fd.append(k, v);
    return fd;
  }
  const body = new URLSearchParams();
  for (const [k, v] of pairs) if (typeof v === 'string') body.append(k, v);
  return body;
}

function formAction(s: ItemSession) {
  return new URL(s.doc.querySelector('form#aspnetForm')?.getAttribute('action') ?? s.url, s.url).href;
}

async function post(s: ItemSession, body: FormData | URLSearchParams): Promise<ItemSession> {
  const init: RequestInit = { method: 'POST', body };
  if (body instanceof URLSearchParams) init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  const doc = await mgaRequest(formAction(s), init);
  return { url: s.url, doc, item: parseItemDialog(doc) };
}

const fieldsOf = (i: ItemDialog): ItemFields => ({ description: i.description, minBid: i.minBid, donation: i.isDonation });

/** Save: MGA answers with the same dialog, the item's id filled in and "Item successfully saved." */
export async function saveItem(s: ItemSession, fields: ItemFields) {
  const next = await post(s, itemBody(s, fields, [['__EVENTTARGET', `${P}SaveLB`], ['__EVENTARGUMENT', '']]));
  const id = next.item.auctionItemId;
  if (!id || id === '0' || !/saved/i.test(next.item.message))
    throw new MgaWriteError(next.item.errors[0] || next.item.message || 'MyGroupAuctions did not confirm the save');
  return next;
}

/** One photo. Only the Upload button uploads; Save ignores a chosen file. */
export async function uploadPhoto(s: ItemSession, file: File, primary: boolean) {
  if (!s.item.canUpload) throw new MgaWriteError('Save the item before adding photos');
  const button = s.doc.querySelector<HTMLInputElement>(`input[name="${P}UploadImageBtn"]`)?.value || 'Upload';
  const extra: [string, string | File][] = [
    ['__EVENTTARGET', ''],
    ['__EVENTARGUMENT', ''],
    [`${P}FileUpload1`, file],
    ...(primary ? ([[`${P}IsPrimaryCB`, 'on']] as [string, string][]) : []),
    [`${P}UploadImageBtn`, button],
  ];
  const next = await post(s, itemBody(s, fieldsOf(s.item), extra));
  if (next.item.images.length <= s.item.images.length) throw new MgaWriteError(next.item.message || 'MyGroupAuctions did not add the photo');
  return next;
}

/** Removes one photo: MGA's row Delete is an image input, so the click sends name.x and name.y. */
export async function deletePhoto(s: ItemSession, deleteName: string) {
  const extra: [string, string][] = [['__EVENTTARGET', ''], ['__EVENTARGUMENT', ''], [`${deleteName}.x`, '1'], [`${deleteName}.y`, '1']];
  const next = await post(s, itemBody(s, fieldsOf(s.item), extra));
  if (next.item.images.length >= s.item.images.length) throw new MgaWriteError('MyGroupAuctions did not remove the photo');
  return next;
}

/** Copy or Delete on the Selling list, posted from MGA's live (hidden) form on that page. */
async function listAction(form: HTMLFormElement, buttonName: string): Promise<Selling> {
  const fd = new FormData(form);
  fd.set('__EVENTTARGET', '');
  fd.set('__EVENTARGUMENT', '');
  const body = new URLSearchParams();
  for (const [k, v] of fd) if (typeof v === 'string') body.append(k, v);
  body.append(`${buttonName}.x`, '1');
  body.append(`${buttonName}.y`, '1');
  const doc = await mgaRequest(form.getAttribute('action') ?? location.href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  adoptGrid(doc, form);
  return parseSelling(doc);
}

export async function copyItem(form: HTMLFormElement, copyName: string, before: number) {
  const s = await listAction(form, copyName);
  if (s.items.length <= before) throw new MgaWriteError('MyGroupAuctions did not copy the item');
  return s;
}

export async function deleteItem(form: HTMLFormElement, deleteName: string, auctionItemId: string) {
  const s = await listAction(form, deleteName);
  if (s.items.some((i) => i.auctionItemId === auctionItemId)) throw new MgaWriteError('MyGroupAuctions did not delete the item');
  return s;
}

/** Fresh list after the item dialog changed something. Read only. */
export async function reloadList(form: HTMLFormElement): Promise<Selling> {
  const doc = await mgaRequest(location.pathname + location.search);
  adoptGrid(doc, form);
  return parseSelling(doc);
}

/** MGA's own label links on the Selling page, for submitPostBack. Read only. */
export const PRINT_TARGETS = {
  avery5160: `${P}PrintAvery5160LB`,
  avery8164: `${P}PrintAvery8164LB`,
} as const;
