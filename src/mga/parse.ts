import { formQueryParam, idFromLinks, readGrid, yesNo } from './grid';
import { clean, cleanMultiline, imageIdFromSrc, isDonationTitle, moneyToCents, parseDate, parseTime } from './text';
import type { Auction, Group, Home, ItemDialog, Lot, Preview, SellItem, Selling } from './types';

export class MgaMarkupError extends Error {
  constructor(what: string) {
    super(`MGA page changed: ${what} not found`);
  }
}

export const toDoc = (html: string) => new DOMParser().parseFromString(html, 'text/html');

const text = (el: Element | undefined | null) => clean(el?.textContent);

/** /default.aspx */
export function parseHome(doc: Document): Home {
  const groupRows = readGrid(doc, 'ctl00_Content_dgGroups_ctl00');
  const auctionRows = readGrid(doc, 'ctl00_Content_dgAuctions_ctl00');
  if (!groupRows) throw new MgaMarkupError('groups grid');
  if (!auctionRows) throw new MgaMarkupError('auctions grid');

  const groups: Group[] = groupRows.map((r) => ({
    shortName: text(r.cell('Short Name')),
    fullName: text(r.cell('Full Name')),
    location: text(r.cell('City/State/Postal')),
    allowDonations: yesNo(r.cell('Allow Donations?')),
    minSaleCents: moneyToCents(r.cell('Min. Sale Price')?.textContent),
    role: text(r.cell('Role')),
  }));

  const auctions: Auction[] = [];
  for (const r of auctionRows) {
    // The reports link is on every auction; preview and add links only on upcoming ones.
    const id =
      idFromLinks(r.tr, /openReportsMenu\((\d+)\)/) ??
      idFromLinks(r.tr, /preview-auction\.aspx\?id=(\d+)/i) ??
      idFromLinks(r.tr, /auction-items\.aspx\?id=(\d+)/i);
    if (!id) continue;
    auctions.push({
      id,
      date: parseDate(text(r.cell('Date'))),
      time: parseTime(text(r.cell('Time'))),
      name: text(r.cell('Name')),
      group: text(r.cell('Group')),
      allowDonations: yesNo(r.cell('Allow Donations?')),
      minSaleCents: moneyToCents(r.cell('Min. Sale Price')?.textContent),
      role: text(r.cell('Role')),
      upcoming: !!idFromLinks(r.tr, /preview-auction\.aspx\?id=(\d+)/i),
      canAddItems: !!idFromLinks(r.tr, /auction-items\.aspx\?id=(\d+)/i),
    });
  }
  return { groups, auctions };
}

/** /preview-auction.aspx?id=N, either the first page or the load all response. */
export function parsePreview(doc: Document): Preview {
  const rows = readGrid(doc, 'ctl00_Content_dgItems_ctl00');
  if (!rows) throw new MgaMarkupError('lots grid');

  const lots: Lot[] = rows.map((r) => {
    const lot = text(r.cell('Lot #'));
    const title = cleanMultiline(r.cell('Item')?.textContent);
    const img = r.cell('Images')?.querySelector('img');
    const src = img?.getAttribute('src') ?? null;
    return {
      lot,
      lotNum: parseInt(lot, 10) || 0,
      title,
      minCents: moneyToCents(r.cell('Min. Bid')?.textContent),
      imageId: imageIdFromSrc(src),
      imageSrc: src,
      donation: isDonationTitle(title),
      selectName: r.tr.querySelector<HTMLInputElement>('input[type=checkbox][name$="SelectedCB"]')?.name ?? null,
    };
  });

  const foot = doc.querySelector('table#ctl00_Content_dgItems_ctl00 > tfoot');
  const m = clean(foot?.textContent).match(/(\d+)\s+items?\s+in\s+(\d+)\s+pages?/i);
  const total = m?.[1] ? +m[1] : null;
  return {
    auctionId: formQueryParam(doc, 'id'),
    lots,
    total,
    complete: total == null ? !foot?.querySelector('.rgNumPart a') : lots.length >= total,
  };
}

/** /auction-items.aspx?id=N: only the logged in user's own items. */
export function parseSelling(doc: Document): Selling {
  const rows = readGrid(doc, 'ctl00_Content_dgItems_ctl00');
  if (!rows) throw new MgaMarkupError('selling grid');

  const items: SellItem[] = [];
  for (const r of rows) {
    const auctionItemId = idFromLinks(r.tr, /openAuctionItem\((\d+)\s*,/);
    if (!auctionItemId) continue;
    const imageIds = [...(r.cell('Images')?.querySelectorAll('img') ?? [])]
      .map((i) => imageIdFromSrc(i.getAttribute('src')))
      .filter((id): id is string => !!id);
    items.push({
      auctionItemId,
      lot: text(r.cell('Lot #')),
      title: cleanMultiline(r.cell('Item')?.textContent),
      donated: yesNo(r.cell('Donated?')),
      minCents: moneyToCents(r.cell('Min. Bid')?.textContent),
      imageIds,
      deleteName: r.tr.querySelector<HTMLInputElement>('input[name$="DeleteIB"]')?.name ?? null,
      copyName: r.tr.querySelector<HTMLInputElement>('input[name$="CopyIB"]')?.name ?? null,
    });
  }
  return {
    auctionId: formQueryParam(doc, 'id'),
    canAdd: !!doc.querySelector('#ctl00_Content_lnkAddItem_Text, #ctl00_Content_lnkAddItem'),
    items,
  };
}

/** dialogs/AuctionItem.aspx?auctionItemId=N&auctionId=N&mode=user, and every postback response from it. */
export function parseItemDialog(doc: Document): ItemDialog {
  const desc = doc.querySelector<HTMLTextAreaElement>('textarea[name="ctl00$Content$DescriptionTB"]');
  const min = doc.querySelector<HTMLInputElement>('input[name="ctl00$Content$MinBidTB"]');
  if (!desc || !min) throw new MgaMarkupError('item form');

  const images = (readGrid(doc, 'ctl00_Content_RadGrid_ctl00') ?? []).map((r) => ({
    imageId: imageIdFromSrc(r.cell('Image')?.querySelector('img')?.getAttribute('src')),
    primary: yesNo(r.cell('Primary?')),
    deleteName: r.tr.querySelector<HTMLInputElement>('input[name$="DeleteIB"]')?.name ?? null,
    editName: r.tr.querySelector<HTMLInputElement>('input[name$="EditButton"]')?.name ?? null,
  }));

  const minBid = clean(min.getAttribute('value'));
  return {
    auctionItemId:
      doc.querySelector<HTMLInputElement>('input[name="ctl00$Content$AuctionItemIDHF"]')?.value || formQueryParam(doc, 'auctionItemId'),
    auctionId: formQueryParam(doc, 'auctionId'),
    description: cleanMultiline(desc.textContent),
    minBid,
    minCents: moneyToCents(minBid),
    isDonation: !!doc.querySelector<HTMLInputElement>('input[name="ctl00$Content$IsDonationCB"]')?.hasAttribute('checked'),
    canUpload: !!doc.querySelector('input[type=file][name="ctl00$Content$FileUpload1"]'),
    images,
    message: clean(doc.getElementById('ctl00_Content_MessageLbl')?.textContent),
    errors: [...doc.querySelectorAll('#ctl00_Content_ValidationSummary1 li')].map((li) => clean(li.textContent)).filter(Boolean),
  };
}

/** Every named hidden input, e.g. __VIEWSTATE, so a postback response can be copied into MGA's live form. */
export function hiddenInputs(doc: Document): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of doc.querySelectorAll<HTMLInputElement>('input[type=hidden][name]')) out[i.name] = i.value;
  return out;
}
