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
 * Afterwards the live form's hidden fields are updated so later postbacks (Print Selected) validate.
 */
export async function loadAllLots(form: HTMLFormElement) {
  const doc = await postBack(form, PREVIEW_GRID, `FireCommand:${PREVIEW_GRID}$ctl00;PageSize;5000`);
  syncHiddenInputs(doc, form);
  return doc;
}

/** Copies hidden inputs from a postback response into MGA's live form. Only fields the form already has. */
export function syncHiddenInputs(from: Document, into: HTMLFormElement) {
  for (const [name, value] of Object.entries(hiddenInputs(from))) {
    const mine = into.querySelector<HTMLInputElement>(`input[type=hidden][name="${CSS.escape(name)}"]`);
    if (mine) mine.value = value;
  }
}
