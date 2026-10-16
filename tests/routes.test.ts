import { describe, expect, it } from 'vitest';
import { routeFor } from '@/lib/routes';

const r = (path: string) => routeFor(new URL(path, 'https://mygroupauctions.com'));

describe('routeFor', () => {
  it('routes the CGA screens', () => {
    expect(r('/')).toEqual({ kind: 'home' });
    expect(r('/default.aspx')).toEqual({ kind: 'home' });
    expect(r('/Default.aspx')).toEqual({ kind: 'home' });
    expect(r('/preview-auction.aspx?id=951')).toEqual({ kind: 'lots', auctionId: '951' });
    expect(r('/auction-items.aspx?id=963')).toEqual({ kind: 'selling', auctionId: '963' });
  });

  it('never takes over account, profile, dialog or report pages', () => {
    for (const p of [
      '/account/login.aspx?ReturnUrl=%2fdefault.aspx',
      '/Account/Login.aspx',
      '/account/register.aspx',
      '/profile.aspx',
      '/dialogs/AuctionItem.aspx?auctionItemId=0&auctionId=951&mode=user',
      '/OpenReportViewer.aspx?reportName=x',
    ]) {
      expect(r(p), p).toEqual({ kind: 'untouched' });
    }
  });

  it('leaves unknown pages and bad ids as MGA with the bar', () => {
    expect(r('/preview-auction.aspx')).toEqual({ kind: 'other' });
    expect(r('/preview-auction.aspx?id=abc')).toEqual({ kind: 'other' });
    expect(r('/something-else.aspx')).toEqual({ kind: 'other' });
    expect(r('/accounting.aspx')).toEqual({ kind: 'other' });
  });
});
