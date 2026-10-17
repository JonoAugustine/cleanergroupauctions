import { hiddenInputs, toDoc } from './parse';

/** The session expired and MGA redirected to its login page. Show a link to it; never log in for the user. */
export class LoggedOutError extends Error {
  constructor(public loginUrl: string) {
    super('Logged out of MyGroupAuctions');
  }
}

const LOGIN_RE = /\/account\/login\.aspx/i;

/**
 * content.fetch is Firefox's page context fetch, so MGA sees an ordinary page request with the
 * page's cookies whatever context Firefox gives plain content script fetch. Chrome has no content
 * object and its content script fetch already behaves this way.
 */
const ff = (globalThis as { content?: { fetch?: typeof fetch } }).content;
const pageFetch: typeof fetch = ff?.fetch ? ff.fetch.bind(ff) : fetch.bind(globalThis);

/** Same origin request with the user's own cookies. Returns the parsed page. */
export async function mgaRequest(url: string, init: RequestInit = {}) {
  const res = await pageFetch(new URL(url, location.href).href, { credentials: 'include', ...init });
  if (LOGIN_RE.test(res.url)) throw new LoggedOutError(res.url);
  if (!res.ok) throw new Error(`MyGroupAuctions answered ${res.status}`);
  return toDoc(await res.text());
}

/** Same origin GET for a file, e.g. one of the user's own photos for relisting. */
export async function mgaBlob(url: string) {
  const res = await pageFetch(new URL(url, location.href).href, { credentials: 'include' });
  if (LOGIN_RE.test(res.url)) throw new LoggedOutError(res.url);
  if (!res.ok) throw new Error(`MyGroupAuctions answered ${res.status}`);
  return res.blob();
}

/** Body for an ASP.NET postback built from a form's current fields. */
export function postBackBody(form: HTMLFormElement, target: string, argument = '') {
  const fd = new FormData(form);
  fd.set('__EVENTTARGET', target);
  fd.set('__EVENTARGUMENT', argument);
  const body = new URLSearchParams();
  for (const [k, v] of fd) if (typeof v === 'string') body.append(k, v);
  return body;
}

/** Read only postback: a grid page size change. Returns the response page. */
export function postBack(form: HTMLFormElement, target: string, argument = '') {
  return mgaRequest(form.getAttribute('action') ?? location.href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: postBackBody(form, target, argument),
  });
}

export const PREVIEW_GRID = 'ctl00$Content$dgItems';

/**
 * One request that returns every lot: RadGrid's PageSize command set to 5000.
 * The response's grid replaces the live one and its hidden fields are copied into the live form, so
 * MGA's own postbacks (Print Selected) see every lot's checkbox and validate.
 */
export async function loadAllLots(form: HTMLFormElement) {
  const doc = await postBack(form, PREVIEW_GRID, `FireCommand:${PREVIEW_GRID}$ctl00;PageSize;5000`);
  adoptGrid(doc, form);
  return doc;
}

/**
 * Makes MGA's live form match a response: swaps in the response's dgItems grid and copies its hidden
 * fields, so the next postback from the live form passes event validation.
 */
export function adoptGrid(doc: Document, form: HTMLFormElement) {
  const fresh = doc.getElementById('ctl00_Content_dgItems');
  const live = form.ownerDocument.getElementById('ctl00_Content_dgItems');
  if (fresh && live) live.replaceWith(form.ownerDocument.importNode(fresh, true));
  syncHiddenInputs(doc, form);
}

/**
 * MGA's Print Selected: ticks exactly these checkboxes in the live form and submits it, which is what
 * __doPostBack does. The tab then goes to MGA's label page. Read only; it changes nothing on MGA.
 */
export function printSelected(form: HTMLFormElement, selectNames: Set<string>) {
  for (const cb of form.querySelectorAll<HTMLInputElement>('input[type=checkbox][name$="SelectedCB"]'))
    cb.checked = selectNames.has(cb.name);
  submitPostBack(form, 'ctl00$Content$PrintSelectedLB');
}

/** What __doPostBack does: the tab navigates to MGA's response. */
export function submitPostBack(form: HTMLFormElement, target: string) {
  form.querySelector<HTMLInputElement>('input[name="__EVENTTARGET"]')!.value = target;
  form.querySelector<HTMLInputElement>('input[name="__EVENTARGUMENT"]')!.value = '';
  form.submit();
}

/** Copies hidden inputs from a postback response into MGA's live form. Only fields the form already has. */
export function syncHiddenInputs(from: Document, into: HTMLFormElement) {
  for (const [name, value] of Object.entries(hiddenInputs(from))) {
    const mine = into.querySelector<HTMLInputElement>(`input[type=hidden][name="${CSS.escape(name)}"]`);
    if (mine) mine.value = value;
  }
}
