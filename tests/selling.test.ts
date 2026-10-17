// @vitest-environment-options {"url": "https://mygroupauctions.com/auction-items.aspx?id=951"}
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// client.ts binds fetch when it loads, so the stub must exist before the imports below.
const calls = vi.hoisted(() => {
  const calls: { url: string; init: RequestInit }[] = [];
  const replies: string[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return new Response(replies.shift() ?? '', { status: 200, headers: { 'Content-Type': 'text/html' } });
  }) as typeof fetch;
  return Object.assign(calls, { replies });
});

import { copyItem, deleteItem, deletePhoto, itemBody, MgaWriteError, openItem, saveItem, uploadPhoto } from '@/mga/items';
import { parseItemDialog, parseSelling, toDoc } from '@/mga/parse';
import { scaledSize, sniffImageType } from '@/lib/photos';

const html = (name: string) => readFileSync(resolve('tests/fixtures', `${name}.html`), 'utf8');
const fixture = (name: string) => toDoc(html(name));
const session = (name: string) => ({ url: 'https://mygroupauctions.com/dialogs/AuctionItem.aspx?auctionItemId=0&auctionId=951&mode=user', doc: fixture(name), item: parseItemDialog(fixture(name)) });
const fields = { description: '12 Catappa Leaves', minBid: '6', donation: false };

beforeEach(() => {
  calls.length = 0;
  calls.replies.length = 0;
});

describe('item dialog responses (captured Oct 16)', () => {
  it('reads a new item form', () => {
    const i = parseItemDialog(fixture('item-new'));
    expect(i).toMatchObject({ auctionItemId: '0', auctionId: '951', minBid: '$0.00', canUpload: false, images: [], message: '' });
  });

  it('reads the page MGA returns after a save', () => {
    const i = parseItemDialog(fixture('item-saved'));
    expect(i).toMatchObject({ auctionItemId: '147818', description: '12 Catappa Leaves', minCents: 600, canUpload: true, images: [] });
    expect(i.message).toBe('Item successfully saved.');
  });

  it('reads photos and the newest primary', () => {
    const i = parseItemDialog(fixture('item-photos'));
    expect(i.images.map((p) => [p.imageId, p.primary])).toEqual([
      ['71724', false],
      ['71725', false],
      ['71726', true],
    ]);
    expect(i.images[2]!.deleteName).toBe('ctl00$Content$RadGrid$ctl00$ctl06$DeleteIB');
  });

  it('reads the list after a copy', () => {
    const s = parseSelling(fixture('selling-upcoming'));
    expect(s.items).toHaveLength(7);
    expect(s.items.at(-1)).toMatchObject({ auctionItemId: '147824', lot: '629', title: '1 x Unknown Malawi Cichlid', minCents: 0 });
    expect(s.items.find((i) => i.lot === '628')).toMatchObject({ title: '12 Catappa Leaves', minCents: 1200 });
  });
});

describe('item bodies', () => {
  it('posts a new item urlencoded, like MGA', () => {
    const body = itemBody(session('item-new'), { ...fields, donation: true }, [['__EVENTTARGET', 'ctl00$Content$SaveLB']]);
    expect(body).toBeInstanceOf(URLSearchParams);
    const b = body as URLSearchParams;
    expect(b.get('ctl00$Content$AuctionItemIDHF')).toBe('0');
    expect(b.get('ctl00$Content$DescriptionTB')).toBe('12 Catappa Leaves');
    expect(b.get('ctl00$Content$MinBidTB')).toBe('6');
    expect(b.get('ctl00$Content$IsDonationCB')).toBe('on');
    expect(b.getAll('__EVENTTARGET')).toContain('ctl00$Content$SaveLB');
    expect(b.has('__VIEWSTATE')).toBe(true);
  });

  it('posts a saved item as multipart with the empty file field', () => {
    const body = itemBody(session('item-saved'), fields) as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('ctl00$Content$AuctionItemIDHF')).toBe('147818');
    expect(body.get('ctl00$Content$FileUpload1')).toBeInstanceOf(File);
    expect(body.has('ctl00$Content$IsDonationCB')).toBe(false);
  });
});

describe('writes', () => {
  it('opens, saves and checks MGA confirmed', async () => {
    calls.replies.push(html('item-new'), html('item-saved'));
    const s = await openItem('951');
    expect(calls[0]!.url).toBe('https://mygroupauctions.com/dialogs/AuctionItem.aspx?auctionItemId=0&auctionId=951&mode=user');
    const saved = await saveItem(s, fields);
    expect(saved.item.auctionItemId).toBe('147818');
    expect(calls[1]!.init.method).toBe('POST');
    expect(calls[1]!.url).toMatch(/\/dialogs\/AuctionItem\.aspx\?auctionItemId=0&auctionId=951&mode=user/);
  });

  it('rejects a save MGA did not confirm', async () => {
    calls.replies.push(html('item-new'));
    await expect(saveItem(session('item-new'), fields)).rejects.toBeInstanceOf(MgaWriteError);
  });

  it('uploads one photo with the Upload button and primary flag', async () => {
    calls.replies.push(html('item-photos'));
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'leaf.jpg', { type: 'image/jpeg' });
    const next = await uploadPhoto(session('item-saved'), file, true);
    expect(next.item.images).toHaveLength(3);
    const body = calls[0]!.init.body as FormData;
    expect(body.get('ctl00$Content$FileUpload1')).toBe(file);
    expect(body.get('ctl00$Content$UploadImageBtn')).toBe('Upload');
    expect(body.get('ctl00$Content$IsPrimaryCB')).toBe('on');
    expect(body.get('__EVENTTARGET')).toBe('');
  });

  it('refuses to upload before the first save', async () => {
    await expect(uploadPhoto(session('item-new'), new File([], 'x.jpg'), true)).rejects.toThrow('Save the item');
    expect(calls).toHaveLength(0);
  });

  it('deletes a photo with the image button coordinates', async () => {
    calls.replies.push(html('item-saved'));
    await deletePhoto(session('item-photos'), 'ctl00$Content$RadGrid$ctl00$ctl04$DeleteIB');
    const body = calls[0]!.init.body as FormData;
    expect(body.get('ctl00$Content$RadGrid$ctl00$ctl04$DeleteIB.x')).toBe('1');
    expect(body.get('ctl00$Content$RadGrid$ctl00$ctl04$DeleteIB.y')).toBe('1');
  });

  it('copies and deletes from the live list form', async () => {
    document.body.innerHTML = fixture('selling-upcoming').body.innerHTML;
    const form = document.querySelector<HTMLFormElement>('form#aspnetForm')!;
    calls.replies.push(html('selling-upcoming'));
    const s = await copyItem(form, 'ctl00$Content$dgItems$ctl00$ctl12$CopyIB', 6);
    expect(s.items).toHaveLength(7);
    const b = calls[0]!.init.body as URLSearchParams;
    expect(b.get('ctl00$Content$dgItems$ctl00$ctl12$CopyIB.x')).toBe('1');
    expect(b.get('__EVENTTARGET')).toBe('');

    calls.replies.push(html('selling-upcoming'));
    await expect(deleteItem(form, 'ctl00$Content$dgItems$ctl00$ctl16$DeleteIB', '147824')).rejects.toThrow('did not delete');
  });
});

describe('photos', () => {
  it('sniffs image types from bytes', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png');
    expect(sniffImageType(new TextEncoder().encode('<html>'))).toBeNull();
  });

  it('scales the long side down only', () => {
    expect(scaledSize(4000, 3000)).toEqual({ w: 2000, h: 1500 });
    expect(scaledSize(800, 600)).toEqual({ w: 800, h: 600 });
  });
});
