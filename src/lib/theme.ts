import type { Settings } from './settings';

type Swatch = { name: string; hex: string };

/** SPEC.md §4.4 */
export const SWATCHES: Record<'accent' | 'bg' | 'watch', Swatch[]> = {
  accent: [
    { name: 'Moss', hex: '#4E9A5B' },
    { name: 'Teal', hex: '#2BA6A0' },
    { name: 'Blue', hex: '#4C8DF6' },
    { name: 'Violet', hex: '#9B7BF2' },
    { name: 'Coral', hex: '#E8735A' },
  ],
  bg: [
    { name: 'Deep moss', hex: '#141914' },
    { name: 'Charcoal', hex: '#161616' },
    { name: 'Navy', hex: '#0F1626' },
    { name: 'Plum', hex: '#1B1520' },
    { name: 'Slate', hex: '#151B1F' },
  ],
  watch: [
    { name: 'Amber', hex: '#E9B949' },
    { name: 'Pink', hex: '#F07FB0' },
    { name: 'Sky', hex: '#5EB6F0' },
    { name: 'Lime', hex: '#A6D95B' },
    { name: 'Orange', hex: '#F2994A' },
  ],
};

export const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const DARK_TEXT = '#0B0F0B';

/** Text on accent colored buttons: white or near black, whichever reads better. */
export const accentFg = (accent: string) => (contrast(accent, '#FFFFFF') >= contrast(accent, DARK_TEXT) ? '#FFFFFF' : DARK_TEXT);

/** CGA is dark only, so a background must stay near black (luminance of about #333 or darker). */
export const isDarkEnough = (hex: string) => luminance(hex) <= 0.035;

/** The starred roles from SPEC.md §5; tokens.css derives the rest with color-mix. */
export function themeVars(s: Pick<Settings, 'accent' | 'bg' | 'watch'>): Record<string, string> {
  return { '--bg': s.bg, '--accent': s.accent, '--watch': s.watch, '--accent-fg': accentFg(s.accent) };
}

export function applyTheme(el: HTMLElement, s: Pick<Settings, 'accent' | 'bg' | 'watch'>) {
  for (const [k, v] of Object.entries(themeVars(s))) el.style.setProperty(k, v);
}
