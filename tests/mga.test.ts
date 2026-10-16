import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hiddenInputs, MgaMarkupError, parseHome, parseItemDialog, parsePreview, parseSelling, toDoc } from '@/mga/parse';
import { postBackBody, syncHiddenInputs } from '@/mga/client';
import { cleanMultiline, imageIdFromSrc, moneyToCents, parseDate, parseTime } from '@/mga/text';

const fixture = (name: string) => toDoc(readFileSync(resolve('tests/fixtures', `${name}.html`), 'utf8'));

describe('text helpers', () => {
  it('parses money, dates and times', () => {
    expect(moneyToCents('$0.00')).toBe(0);
    expect(moneyToCents(' $3.01 ')).toBe(301);
    expect(moneyToCents('$1,250.50')).toBe(125050);
    expect(moneyToCents('')).toBe(0);
    expect(parseDate('10/3/2026')).toBe('2026-10-03');
    expect(parseTime('9:00 AM')).toBe('09:00');
    expect(parseTime('12:30 PM')).toBe('12:30');
    expect(parseTime('12:05 AM')).toBe('00:05');
    expect(parseTime('2:45 PM')).toBe('14:45');
  });

  it('reads image ids with the space MGA puts before them', () => {
    expect(imageIdFromSrc('system/services/imagehandler.ashx?type=item&id= 70408')).toBe('70408');
    expect(imageIdFromSrc('imagehandler.ashx?type=item&id=%2070408')).toBe('70408');
    expect(imageIdFromSrc('images/logo.png')).toBeNull();
  });

  it('keeps line breaks in titles', () => {
    expect(cleanMultiline('  6x Kribs  \r\n\r\n\r\n*Picture of mother ')).toBe('6x Kribs\n\n*Picture of mother');
  });
});

describe('parseHome', () => {
  const home = parseHome(fixture('home'));

  it('reads groups', () => {
    expect(home.groups.map((g) => g.shortName)).toEqual(['CAPI', 'PVAS Auctions', 'JRAS']);
    expect(home.groups[0]).toEqual({
      shortName: 'CAPI',
      fullName: 'Capital Cichlid Association, Incorporated',
      location: 'Olney, MD 20832',
      allowDonations: true,
      minSaleCents: 100,
      role: 'Member',
    });
  });

  it('reads auctions and marks upcoming ones', () => {
    expect(home.auctions).toHaveLength(252);
    expect(home.auctions[0]).toEqual({
      id: '951',
      date: '2026-10-17',
      time: '09:00',
      name: 'James River Aquarium Society Fall All-Day Auction',
      group: 'James River Aquarium Society',
      allowDonations: true,
      minSaleCents: 301,
      role: 'Affiliate',
      upcoming: true,
      canAddItems: true,
    });
    expect(home.auctions.filter((a) => a.upcoming).map((a) => a.id)).toEqual(['951']);
    expect(home.auctions.find((a) => a.id === '963')).toMatchObject({ upcoming: false, canAddItems: false, date: '2026-10-03' });
    expect(new Set(home.auctions.map((a) => a.id)).size).toBe(252);
  });

  it('fails loudly when the grids are gone', () => {
    expect(() => parseHome(toDoc('<form id="aspnetForm"></form>'))).toThrow(MgaMarkupError);
  });
});

describe('parsePreview', () => {
  const p = parsePreview(fixture('preview'));

  it('reads lots on the first page', () => {
    expect(p.auctionId).toBe('951');
    expect(p.lots).toHaveLength(20);
    expect(p.lots[0]).toMatchObject({
      lot: '100',
      lotNum: 100,
      title: 'Purple Vampire Crabs (1 male/2 female)',
      minCents: 0,
      imageId: '900001',
      donation: false,
      selectName: 'ctl00$Content$dgItems$ctl00$ctl04$SelectedCB',
    });
    expect(p.lots.filter((l) => l.imageId)).toHaveLength(3);
    expect(p.lots[5]!.imageId).toBeNull();
  });

  it('knows the page is partial', () => {
    expect(p.total).toBe(394);
    expect(p.complete).toBe(false);
  });

  it('treats a page without a pager as complete', () => {
    const doc = fixture('preview');
    doc.querySelector('table#ctl00_Content_dgItems_ctl00 > tfoot')!.remove();
    expect(parsePreview(doc)).toMatchObject({ total: null, complete: true });
  });
});

describe('parseSelling', () => {
  const s = parseSelling(fixture('selling'));

  it("reads the user's items", () => {
    expect(s.auctionId).toBe('963');
    expect(s.items).toHaveLength(13);
    expect(s.items[0]).toEqual({
      auctionItemId: '146356',
      lot: '742',
      title: '6x Juvie Red Kribs (Pelvicachromis pulcher "Red")\n\n*Picture of mother',
      donated: false,
      minCents: 0,
      imageIds: ['900001'],
      deleteName: 'ctl00$Content$dgItems$ctl00$ctl04$DeleteIB',
      copyName: 'ctl00$Content$dgItems$ctl00$ctl04$CopyIB',
    });
    expect(s.items.find((i) => i.lot === '763')).toMatchObject({ donated: true, minCents: 100 });
    expect(s.items.filter((i) => i.imageIds.length)).toHaveLength(10);
  });

  it('sees the add link, which MGA shows even on this past auction', () => {
    expect(s.canAdd).toBe(true);
  });
});

describe('parseItemDialog', () => {
  it('reads an existing item', () => {
    expect(parseItemDialog(fixture('item'))).toEqual({
      auctionItemId: '146356',
      auctionId: '963',
      description: '6x Juvie Red Kribs (Pelvicachromis pulcher "Red")\n\n*Picture of mother',
      minBid: '$0.00',
      minCents: 0,
      isDonation: false,
      canUpload: true,
      images: [
        {
          imageId: '900001',
          primary: true,
          deleteName: 'ctl00$Content$RadGrid$ctl00$ctl04$DeleteIB',
          editName: 'ctl00$Content$RadGrid$ctl00$ctl04$EditButton',
        },
      ],
    });
  });
});

describe('postbacks', () => {
  it('builds the load all body from the live form', () => {
    const doc = fixture('preview');
    const form = doc.querySelector<HTMLFormElement>('form#aspnetForm')!;
    const body = postBackBody(form, 'ctl00$Content$dgItems', 'FireCommand:ctl00$Content$dgItems$ctl00;PageSize;5000');
    expect(body.get('__EVENTTARGET')).toBe('ctl00$Content$dgItems');
    expect(body.get('__EVENTARGUMENT')).toBe('FireCommand:ctl00$Content$dgItems$ctl00;PageSize;5000');
    expect(body.get('__VIEWSTATE')).toBe('SCRUBBED');
    // unticked checkboxes are not sent, like a real submit
    expect(body.has('ctl00$Content$dgItems$ctl00$ctl04$SelectedCB')).toBe(false);
  });

  it('copies hidden fields from a response into the live form', () => {
    const live = fixture('preview');
    const form = live.querySelector<HTMLFormElement>('form#aspnetForm')!;
    const response = toDoc('<input type="hidden" name="__VIEWSTATE" value="NEW"><input type="hidden" name="__NOT_IN_FORM" value="x">');
    syncHiddenInputs(response, form);
    expect(hiddenInputs(live).__VIEWSTATE).toBe('NEW');
    expect(hiddenInputs(live).__NOT_IN_FORM).toBeUndefined();
  });
});
