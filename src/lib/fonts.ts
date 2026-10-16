import { browser, type PublicPath } from 'wxt/browser';

/** Bundled SIL OFL fonts. Names are prefixed so they never clash with a page's own fonts. */
const FACES = [
  { family: 'CGA Open Sans', weight: 400, file: 'open-sans-latin-400-normal.woff2' },
  { family: 'CGA Open Sans', weight: 600, file: 'open-sans-latin-600-normal.woff2' },
  { family: 'CGA Instrument Serif', weight: 400, file: 'instrument-serif-latin-400-normal.woff2' },
];

export const fontFaceCss = (url: (file: string) => string) =>
  FACES.map(
    (f) =>
      `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};font-display:swap;src:url('${url(f.file)}') format('woff2')}`,
  ).join('\n');

/**
 * @font-face does not work inside a shadow root in every browser, so the faces are declared on the
 * page itself, pointing at the extension's own files.
 */
export function injectFonts(doc: Document) {
  const style = doc.createElement('style');
  style.textContent = fontFaceCss((file) => browser.runtime.getURL(`/fonts/${file}` as PublicPath));
  (doc.head ?? doc.documentElement).append(style);
}
