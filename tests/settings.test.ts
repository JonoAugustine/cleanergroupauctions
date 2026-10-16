import { describe, expect, it } from 'vitest';
import { makeBackup, mergeWatch, parseBackup } from '@/lib/backup';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { fromSyncItems, syncDiff, toSyncItems } from '@/lib/sync-items';
import { accentFg, contrast, isDarkEnough, SWATCHES, themeVars } from '@/lib/theme';

describe('theme', () => {
  it('computes WCAG contrast', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#777777')).toBe(1);
  });
  it('picks readable text for accents', () => {
    expect(accentFg('#4E9A5B')).toBe('#0B0F0B');
    expect(accentFg('#1B4F9C')).toBe('#FFFFFF');
  });
  it('keeps every default accent readable on every default background', () => {
    for (const a of SWATCHES.accent) for (const b of SWATCHES.bg) expect(contrast(a.hex, b.hex), `${a.name} on ${b.name}`).toBeGreaterThanOrEqual(3);
  });
  it('only accepts dark backgrounds', () => {
    for (const b of SWATCHES.bg) expect(isDarkEnough(b.hex), b.name).toBe(true);
    expect(isDarkEnough('#333333')).toBe(true);
    expect(isDarkEnough('#808080')).toBe(false);
    expect(isDarkEnough('#FFFFFF')).toBe(false);
  });
  it('exposes the starred roles as variables', () => {
    expect(themeVars(DEFAULT_SETTINGS)).toEqual({ '--bg': '#141914', '--accent': '#4E9A5B', '--watch': '#E9B949', '--accent-fg': '#0B0F0B' });
  });
});

describe('backup', () => {
  const watch = { '951:100': { at: 5, note: 'yes', max: '30' } };
  it('round trips', () => {
    const b = makeBackup(DEFAULT_SETTINGS, watch, { '951:101': true });
    expect(parseBackup(JSON.stringify(b))).toEqual(b);
  });
  it('rejects other files', () => {
    expect(() => parseBackup('nope')).toThrow('not a CGA backup');
    expect(() => parseBackup('{"app":"x"}')).toThrow('not a CGA backup');
  });
  it('drops anything it does not know', () => {
    const b = parseBackup(
      JSON.stringify({
        app: 'CleanerGroupAuctions',
        version: 1,
        settings: { accent: 'red', bg: '#000000', view: 'table', classic: 'yes', extra: 1 },
        watch: { '951:100': { at: 1, max: '$30', note: 7, evil: '<script>' }, bad: { at: 1 } },
        hidden: { '951:1': true, '951:2': 'true' },
      }),
    );
    expect(b.settings).toEqual({ ...DEFAULT_SETTINGS, bg: '#000000' });
    expect(b.watch).toEqual({ '951:100': { at: 1 } });
    expect(b.hidden).toEqual({ '951:1': true });
  });
  it('merges watchlists, newest entry wins', () => {
    expect(mergeWatch({ a: { at: 1, note: 'old' }, b: { at: 1 } }, { a: { at: 2, note: 'new' }, c: { at: 1 } })).toEqual({
      a: { at: 2, note: 'new' },
      b: { at: 1 },
      c: { at: 1 },
    });
  });
});

describe('sync items', () => {
  const watch = { '951:100': { at: 1 }, '951:101': { at: 2, note: 'x' }, '963:742': { at: 3 } };
  const hidden = { '951:102': true as const };
  const items = toSyncItems(watch, hidden, { ...DEFAULT_SETTINGS, classic: true, sync: true });

  it('splits data by auction and leaves per browser settings out', () => {
    expect(Object.keys(items).sort()).toEqual(['h:951', 'settings', 'w:951', 'w:963']);
    expect(items['w:951']).toEqual({ '100': { at: 1 }, '101': { at: 2, note: 'x' } });
    expect(items.settings).not.toHaveProperty('classic');
    expect(items.settings).not.toHaveProperty('sync');
  });
  it('reads them back', () => {
    const back = fromSyncItems(items);
    expect(back.watch).toEqual(watch);
    expect(back.hidden).toEqual(hidden);
    expect(back.settings).toMatchObject({ accent: DEFAULT_SETTINGS.accent });
  });
  it('writes only what changed and removes emptied auctions', () => {
    const next = toSyncItems({ '951:100': { at: 1 } }, {}, DEFAULT_SETTINGS);
    const d = syncDiff(items, next);
    expect(Object.keys(d.set)).toEqual(['w:951']);
    expect(d.remove.sort()).toEqual(['h:951', 'w:963']);
  });
});
