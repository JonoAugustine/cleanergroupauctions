# CleanerGroupAuctions: working notes for Claude

Read `SPEC.md` before doing anything. It holds the product decisions and everything known about how MyGroupAuctions (MGA) works. `reference/mga-plus.user.js` is a working Tampermonkey script that already loads all lots, searches and filters; reuse its techniques, not its UI.

## Project
- Browser extension for Chrome and Firefox desktop plus Firefox for Android. Manifest V3, TypeScript, built with WXT (see SPEC.md §2).
- Owner: @JonoAugustine. Public repo. No company names or branding anywhere except "not affiliated with MyGroupAuctions".

## Commands
- `pnpm dev` (Chrome) / `pnpm dev:firefox`
- `pnpm build` / `pnpm build:firefox` / `pnpm zip`
- `pnpm test` (unit + parser fixture tests) / `pnpm compile` (type check)
- Firefox for Android: `pnpm web-ext run -t firefox-android --adb-device <id> -s .output/firefox-mv3`

## Layout
- `src/entrypoints/content/`: content script; routes the page, hides MGA, mounts the shadow root UI
- `src/entrypoints/options/`: Settings page (also the extension options page)
- `src/entrypoints/background.ts`: opens the options page for content scripts; runs Sync (local is the source of truth, `storage.sync` holds one item per auction, see `src/lib/sync-items.ts`)
- `src/lib/routes.ts`: URL to screen mapping (SPEC.md §2 routes); `src/lib/settings.ts`: Settings in `storage.local`
- `src/ui/`: Preact components and `tokens.css`; `src/ui/lots/` is the Lots screen; `Chrome.tsx` holds the shared Shell (header, footer, phone tab bar)
- `src/lib/`: pure logic with tests: `search.ts` (query syntax), `filters.ts`, `exporters.ts` (CSV, watchlist text), `format.ts`; `userdata.ts` (watch and hidden lots as signals over `storage.local`), `home-cache.ts`, `theme.ts` (swatches, contrast, CSS variables), `backup.ts` (export and import file), `fonts.ts`
- Keyboard handlers read state from refs: keys can arrive faster than renders.
- `src/mga/`: MGA data layer. `parse.ts` (pure parsers taking a Document; `toDoc(html)` for strings), `client.ts` (same origin fetch, login redirect detection, postbacks, load all), `grid.ts` (RadGrid rows by header text), `text.ts`, `types.ts`
- `scripts/scrub-fixture.mjs`: turns a saved MGA page into a committable fixture; raw saves go in `tests/fixtures/raw/` (ignored)
- Shadow root gotchas: WXT sets `all: initial` on the host, so base text styles live on `.cga-root`, not `:host`. `@font-face` is declared on the page (`injectFonts`), not in the shadow root. Theme variables are set inline on the host element.
- `public/fonts/`: bundled OFL fonts with their licenses.

## Hard rules
1. **Never write to MGA without the user's explicit OK for that specific action.** Saving, copying or deleting an item, uploading a photo, joining a group or anything else that changes data lands in a real club auction other people use. Reading pages is fine.
2. **Never touch credentials.** Do not take over `/account/*` pages, do not read or store passwords, do not log in on the user's behalf. If a session expires, link to MGA's own login page.
3. **Same origin only.** All MGA requests go from the content script to mygroupauctions.com with the user's cookies. No proxies, no servers, no telemetry, no analytics, no third party requests at runtime.
4. **Only the user's own data.** Never construct report URLs or item URLs for other users' IDs.
5. **Be gentle with MGA.** One load all request per catalog view, cached; no polling; sequential requests when looping over auctions.
6. **Classic view must always work** and must be reachable from every CGA screen.

## MGA gotchas (details in SPEC.md §3)
- Every MGA page is one `<form id="aspnetForm">`. Anything injected into it needs `type="button"` and must swallow Enter, or the page posts back.
- Keep the original form in the DOM (hidden) so postbacks such as Print Selected keep working, and copy hidden inputs from any postback response back into it.
- Image URLs contain a space before the id (`imagehandler.ashx?type=item&id= 70408`).
- Lot counts change daily; never hardcode counts.
- Reports are PDF files from SQL Server Reporting Services.

## Testing
- Keep MGA parsing in `src/mga/` with pure functions that take HTML strings.
- Fixtures: with the user logged in, save real responses into `tests/fixtures/` (home page, a preview page after load all, a selling list, an item dialog). **Before committing, scrub personal data**: the user's name, user IDs, other members' names, emails and anything in reports. Lot titles are public to members and fine to keep.
- Test the UI at 390, 834 and 1280 px widths.

## Style
- UI copy is short and plain; no em dashes.
- Accessible by default: real buttons, links, labels; 44px touch targets; visible focus.
- Dark only; all colors come from CSS variables derived from Settings (SPEC.md §5).
