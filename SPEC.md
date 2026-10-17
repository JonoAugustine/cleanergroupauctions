# CleanerGroupAuctions (CGA): product and technical spec

CGA is an open source browser extension that replaces the user interface of [MyGroupAuctions.com](https://mygroupauctions.com) (MGA), the site aquarium clubs use to run live auctions. It takes over MGA pages in place, using the visitor's own MGA login, and adds fast search, filters, a watchlist, cleaner selling tools and user chosen colors.

Author: [@JonoAugustine](https://github.com/JonoAugustine). Not affiliated with MyGroupAuctions or the Raleigh Aquarium Society. No other company names or branding appear in the product or repo.

Everything in "MGA reference" below was observed on the live site on Oct 15 and 16, 2026 while logged in as a normal member. Items marked **UNVERIFIED** were never exercised and must be confirmed before building on them.

---

## 1. Decisions already made

| Topic | Decision |
|---|---|
| Name | CleanerGroupAuctions, short form CGA |
| Credit | "CleanerGroupAuctions by @JonoAugustine · not affiliated with MyGroupAuctions" in footers and Settings |
| Browsers | Chrome and Firefox on desktop; Firefox for Android on mobile |
| Distribution | Public: Chrome Web Store and addons.mozilla.org |
| Integration | Take over MGA pages in place (content script), not a separate extension page |
| Escape hatch | A Classic view switch that turns CGA off for MGA pages; reachable from every CGA footer and from Settings |
| Theme | Dark mode only. Users pick accent, background and "watched" colors; the rest of the palette is derived |
| Selling | In scope: list, add, edit, copy, delete items; photos with a primary pick |
| History (buy/sell reports) | Later. Reports are PDF files |
| Privacy | No servers, no telemetry, no analytics. Data stays in browser storage. CGA never sees or stores the MGA password |

## 2. Architecture

- **Manifest V3**, one codebase built for Chrome and Firefox. Recommended: [WXT](https://wxt.dev) (handles both browsers, MV3, hot reload) with TypeScript. Use `browser.*` APIs through WXT's polyfill.
- **UI**: a small framework that renders into a **shadow root** so MGA's old CSS cannot leak in (Preact or Svelte are good fits; keep the bundle small for phones).
- **Content script** on `https://mygroupauctions.com/*` and `https://www.mygroupauctions.com/*`, `run_at: document_start`:
  1. Read settings. If Classic view is on, do nothing except inject a small floating "Use CGA" pill.
  2. Otherwise hide the original page immediately (a `<style>` that sets the original body content to `visibility:hidden`) to avoid a flash.
  3. Route by URL (table below). Unknown pages: leave MGA visible and add a thin CGA bar with a link home.
  4. Mount the CGA app in a shadow root. **Keep MGA's original `<form id="aspnetForm">` in the DOM, hidden.** Some actions (Print Selected, item saves) are ASP.NET postbacks that need that form and its hidden fields.
- **Data layer**: same origin `fetch` with `credentials: 'include'` from the content script, parsed with `DOMParser`. No background page network calls are needed. Put every MGA parser behind one module (`src/mga/`) with fixture based tests, because MGA markup is the most fragile dependency.
- **Settings page**: also reachable as the extension's options page so it works when MGA is closed.

### Routes

| MGA URL | CGA screen |
|---|---|
| `/default.aspx`, `/` | Home |
| `/preview-auction.aspx?id=N` | Lots (catalog) for auction N |
| `/auction-items.aspx?id=N` | Selling for auction N |
| `/account/login.aspx`, `/account/*` | **Never take over.** Leave login, registration and password pages untouched |
| `/profile.aspx`, `/dialogs/*`, `/OpenReportViewer.aspx` | Leave as MGA |
| anything else | Leave as MGA plus the CGA bar |

## 3. MGA reference (observed)

Stack: ASP.NET WebForms, Telerik RadGrid / RadWindow, jQuery 1.5.1. No public API: `/system/services/` returns 403 and guesses like `/api/` or `AuctionService.asmx` return MGA's soft 404 page.

### 3.1 Auth and page quirks
- Login sets one cookie, `.AUTH`. Sessions expire after some hours; detect a redirect to `/account/login.aspx?ReturnUrl=...` on any fetch and show a "Log in to MGA" state that links to the real login page.
- **Every page is a single `<form id="aspnetForm">`.** Any `<button>` without `type="button"`, or Enter inside an input, submits it and reloads the page. CGA renders in a shadow root outside that form, but if anything is ever injected into the form, set `type="button"` and swallow Enter.
- Postbacks use `__EVENTTARGET`, `__EVENTARGUMENT`, `__VIEWSTATE` (10 to 110 KB), `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`. To replay one: `new FormData(form)`, set the two event fields, POST to `form.action` as `application/x-www-form-urlencoded`.

### 3.2 Home: `/default.aspx`
Two RadGrids:
- `#ctl00_Content_dgGroups`: Short Name, Full Name, City/State/Postal, Allow Donations?, Min. Sale Price, Role (Member / Affiliate), plus icon links.
- `#ctl00_Content_dgAuctions`: Date, Time, Name, Group, Allow Donations?, Min. Sale Price, Role, then icon links per row:
  - `auction-items.aspx?id=N` (add items; **only on upcoming auctions**)
  - `preview-auction.aspx?id=N` (lot preview; only on upcoming auctions)
  - `javascript:openReportsMenu(N)` (reports; on every auction)
- "Join a Group": `javascript:openJoinGroup()` opens `dialogs/JoinGroup.aspx`.
- Logout: `__doPostBack('ctl00$LogoutLB','')`.

Example data at time of writing: groups CAPI (Capital Cichlid Association, Olney MD, $1.00, Member), PVAS Auctions (Potomac Valley Aquarium Society, Merrifield VA, $1.01, Member), JRAS (James River Aquarium Society, Mechanicsville VA, $2.01, Affiliate). Upcoming: auction 951, JRAS Fall All-Day Auction, 10/17/2026 9:00 AM, min sale $3.01.

### 3.3 Lots: `/preview-auction.aspx?id=N`
- Grid `#ctl00_Content_dgItems`, table `#ctl00_Content_dgItems_ctl00` (class `record-grid`).
- Rows: `tr.record-grid-row, tr.record-grid-alt`. Cells:
  0. checkbox `…$SelectedCB` (used by Print Selected)
  1. lot number
  2. title (free text, can contain newlines and quotes; this is the only description bidders see)
  3. minimum bid, formatted `$0.00`
  4. image: `<img src="system/services/imagehandler.ashx?type=item&id= 70408">` (note the space before the id). Only the **primary** photo is shown; images are 600×600.
- Default page size 20 (combo offers 10/20/50). **Load all lots in one request:**
  ```
  POST form.action
  __EVENTTARGET   = ctl00$Content$dgItems
  __EVENTARGUMENT = FireCommand:ctl00$Content$dgItems$ctl00;PageSize;5000
  ```
  Parse the returned HTML, replace the grid, and **copy every `input[type=hidden][name]` from the response into the live form** so later postbacks validate.
- Print labels: tick the row checkboxes, then `__doPostBack('ctl00$Content$PrintSelectedLB','')`. Verified to redirect to the print page with the swapped ViewState.
- Server side sort links exist in headers; CGA sorts client side instead.
- The default row order is roughly lot order but not strictly. Lot numbers are not called in order at the live auction (do not build a "running order" feature).
- Data volume changes daily: auction 951 went from 274 lots / 103 photos (Oct 15) to 394 lots / 193 photos (Oct 16), lots 100 to 493. Many minimums are $0.00; 55 lots had a minimum.

### 3.4 Selling: `/auction-items.aspx?id=N`
Lists **only the current user's** items for that auction. Grid columns: Lot #, Item, Donated?, Min. Bid, Images, then per row:
- `…$DeleteIB` (image input, `onclick="return confirm('Are you sure you want to delete this item?')"`)
- `…$CopyIB` (image input, confirm "Are you sure you want to copy this item?")
- edit: `javascript:openAuctionItem(<auctionItemId>, <auctionId>)`
- "Add new Item": `openAuctionItem(0, <auctionId>)`; hidden `RefreshAuctionItemListBtn` reloads the list after the dialog closes.
- Home links `auction-items.aspx` only for upcoming auctions, but the Selling page itself still shows "Add new Item" (`lnkAddItem_Text`, `openAuctionItem(0, N)`) when opened directly for a past auction (seen on 963, Oct 16). Decide upcoming from Home, not from this link. **UNVERIFIED** whether adding to a past auction is accepted. Past auction 963 (PVAS Fall, Oct 3) had 13 of the user's items, e.g. lot 742 "6x Juvie Red Kribs (Pelvicachromis pulcher "Red") *Picture of mother", $0.00, 1 photo, auctionItemId 146356.

`openAuctionItem` opens a RadWindow at
`dialogs/AuctionItem.aspx?auctionItemId=<id>&auctionId=<auctionId>&mode=user`.

Item dialog fields (names are prefixed `ctl00$Content$`):
| Field | Control | Notes |
|---|---|---|
| `DescriptionTB` | textarea | required, error "Description is required" |
| `MinBidTB` | text | required, default `$0.00`, error "Min bid is required" |
| `IsDonationCB` | checkbox | "Donation?" |
| `SaveIB` / `SaveLB` | save | postback via `WebForm_DoPostBackWithOptions` (validation group) |
| `CancelIB` / `CancelLB` | close | |
| `NewIB` / `NewLB` | save and start another | |

- **New item** (id 0): form is urlencoded and shows "You can add images after saving the item."
- **Existing item**: form becomes `multipart/form-data` and adds `FileUpload1` (file), `IsPrimaryCB`, `UploadImageBtn` (submit), and an image list where each row has `DeleteIB` and `EditButton`. One file per upload.

Verified on Oct 16, 2026 (Firefox HAR, auction 951, the user's own real items; scrubbed responses in `tests/fixtures/item-saved.html`, `item-photos.html`, `selling-upcoming.html`):
- **Blank description**: blocked client side by the ASP.NET validators; no request is sent. Server side errors were not seen.
- **Save** (`__EVENTTARGET=ctl00$Content$SaveLB`, fields `AuctionItemIDHF`, `DescriptionTB`, `MinBidTB`, `IsDonationCB=on` only when ticked): returns the **same dialog page**, HTTP 200, no redirect and no closing script. `AuctionItemIDHF` now holds the new id (e.g. 147818), `MessageLbl` reads "Item successfully saved.", and the form is now the multipart one with the upload field. The dialog URL keeps `auctionItemId=0`; the id lives in `AuctionItemIDHF`.
- **Lot numbers are assigned on save**: the new item showed as lot 628 on the list straight away.
- `MinBidTB` accepts `6` and `12`; MGA echoes it back as `$6.00`.
- **Save with a file chosen does not upload it.** Only `UploadImageBtn` uploads (empty `__EVENTTARGET`, the submit button's own name and value). The response is the same dialog with the image grid.
- **Uploads are slow** (about 2 s for a 1 MB JPEG) and **requests the browser abandoned still landed**: three clicks on Upload stored three copies (ids 71724, 71725, 71726). CGA must disable Upload while one is in flight and never retry on its own.
- **Primary**: the newest upload with `IsPrimaryCB` ticked becomes the only primary; earlier ones show "No". The checkbox renders unticked once an item has a primary. `EditButton` (change primary of an existing photo) is **UNVERIFIED**.
- **Delete photo**: native submit of the row's image input, i.e. `…$RadGrid$ctl00$ctlNN$DeleteIB.x` and `.y`, empty `__EVENTTARGET`, after a browser `confirm()`. Response is the dialog without that image.
- `imagehandler.ashx` serves photos with `Content-Type: text/html`; sniff the bytes when reading one back.
- **Copy** (list page, `…$dgItems$ctl00$ctlNN$CopyIB.x/.y`): returns the list page with a new item in the same auction (new auctionItemId and the next lot number, here 629) with the same description and minimum. Whether photos are copied is **UNVERIFIED** (the copied item had none).
- **Delete item** (list page, `…$DeleteIB.x/.y`): returns the list page without it.
- After the dialog closes MGA posts `ctl00$Content$RefreshAuctionItemListBtn` to reload the list; a plain GET of the list works as well.
- Print links on the list page: `PrintAvery8164LB`, `PrintAvery5160LB` (labels for your own items) and `ExportLB`, all `__doPostBack` on the live form.
- Still **UNVERIFIED**: server side validation errors, upload size and type limits, adding to a past auction.

### 3.5 Reports (later)
- `dialogs/ReportsMenu.aspx?AuctionID=N` has radios `rblReport` with values `ctl00$Content$rblReport_SellerDetail` ("Seller Detail Report") and `ctl00$Content$rblReport_Buyers` ("Buyer's Report / Receipt"), an empty `cboBuyers` select, and OK = `__doPostBack('ctl00$Content$btnPrint_Text','')`.
- The OK response contains `CloseAndReturn('oArg.reportName="Sellers Report";oArg.reportArgs="<base64>";')` where the base64 decodes to `AuctionID=963&SellerUserID=<userId>` (or `BuyerUserID`).
- Viewer: `/OpenReportViewer.aspx?reportPath=&reportName=<name>&reportArgs=<base64>` returns `application/pdf` (SQL Server Reporting Services 14). Seller report worked; Buyers report opened directly errored "requires a default or user-defined value for the report parameter 'BuyerUserID'" (**UNVERIFIED** why).
- Parsing needs pdf.js. Text extraction was not proven.
- **Security note**: report args carry user IDs in plain base64. CGA must only ever request reports for the logged in user's own ID (taken from the server's own response, never constructed). Consider privately telling the RAS board.

### 3.6 Load etiquette
- One "load all" request per catalog view, cached in memory for the session; refresh on demand or when the tab regains focus after 10+ minutes.
- Home across clubs: at most one preview request per upcoming auction per visit, sequential, not parallel.
- No background polling of MGA.

## 4. Product behavior (version 1)

Reference designs: the Design canvas "CleanerGroupAuctions Mockups" (private to the author; screens described here so the spec stands alone). Every screen exists at desktop, tablet and phone sizes.

### 4.1 Lots (catalog)
- Header: CGA wordmark, nav (Home, Lots, Selling), auction switcher (upcoming auctions from Home data), search, Grid/List toggle, Settings.
- **Search** filters as you type and highlights matches in titles. Syntax:
  - words: all must match (case insensitive substring)
  - `-word` excludes; `"exact phrase"`
  - `120-150` lot range; `#143` a single lot; a bare number also matches that lot
- **Filters**: Show (All lots / Watched / Hidden, with counts), Has photo, No minimum bid, Include donated lots (donation = title contains "donation"/"donated"; MGA preview has no donation column), Sort (lot, name, minimum).
- Active filters appear as removable chips above results; empty state when nothing matches.
- **Grid**: photo cards (lot number badge, star, title, minimum, "max $X" when watched with a max, Donation badge, note line).
- **List**: dense table (checkbox for labels, lot, thumbnail, item, min bid, my max, star). On phone the list is compact rows: lot, title (2 lines), "Min - · photo · max $30", star.
- **Minimum bid**: show `-` when $0.00; otherwise `$10.00`.
- **Lot drawer** (click card or row): primary photo (click to enlarge), lot number, minimum, title, Watch, Hide, My max bid, Private note, "Open on MyGroupAuctions", next/previous through the current results.
- **Keyboard** (desktop): `/` search, `J`/`K` next/prev, `W` watch, `N` note, `H` hide, `V` grid or list, `Esc` close.
- **Labels**: "Selected for labels" count, Print selected (ticks MGA checkboxes and fires the real postback), Copy watchlist (plain text), CSV export of current results.
- **New since last visit**: store the set of lot numbers per auction at last view; flag additions.

### 4.2 Home
- Next auction card: name, date, time, role, Browse N lots, stats (lots with "+N new", with photos, you're watching, min sale price).
- Saved searches with live match counts in the next auction; "+ Save a search".
- Search every upcoming auction (one box across clubs).
- Recent auctions with a link to the user's reports (later).
- Selling card for the next auction; My clubs list.

### 4.3 Selling
- "Your listings" for the selected auction with Edit, Copy (confirm), Delete (confirm, danger style). Empty state copy: "Nothing listed yet. Add an item, or relist something you sold at an earlier auction."
- **One step item form** (modal on desktop/tablet, full screen on phone): Description (required, same error text as MGA), Minimum bid (`$` prefix; helper "0 means no minimum. This auction's minimum sale price is $X."), Donated to the club, Photos (grid, "Primary" badge, make primary, remove, add multiple). Photos selected before the first save are queued and uploaded right after the save completes, hiding MGA's "save first, then add images" rule. Until `EditButton` is captured, "make primary" is offered for new photos only (the primary one uploads last, with `IsPrimaryCB`). Photos over 2000 px or 2 MB are scaled to a 2000 px JPEG before upload.
- **Relist from a past auction**: lists the user's items from earlier auctions (via `auction-items.aspx?id=<past>`), prefills description, minimum and photos (fetch the image from `imagehandler.ashx` and reupload it).
- Print my labels: hand off to MGA's own flow.
- Footnote: "MGA assigns lot numbers when an item is saved. Changes save straight to MyGroupAuctions."

### 4.4 Settings
- **Colors**: Accent, Background (always dark), Watched. Five swatches each plus a custom color input; Reset to defaults; whole page previews live; warning when accent to background contrast is under 3:1.
  - Defaults: accent `#4E9A5B`, background `#141914`, watched `#E9B949`.
  - Swatches: accent Moss `#4E9A5B`, Teal `#2BA6A0`, Blue `#4C8DF6`, Violet `#9B7BF2`, Coral `#E8735A`; background Deep moss `#141914`, Charcoal `#161616`, Navy `#0F1626`, Plum `#1B1520`, Slate `#151B1F`; watched Amber `#E9B949`, Pink `#F07FB0`, Sky `#5EB6F0`, Lime `#A6D95B`, Orange `#F2994A`.
- **Behavior**: Classic view, Sync across browsers, Flag new lots, Show donated lots, Default view (grid/list).
- **Your data**: Export as file, Import, Clear all CGA data. Copy: "Watchlist, notes, max bids and saved searches live in your browser. CGA never sends them anywhere and never sees your MGA password."
- About: version, credit, "Report an issue" (GitHub issues), not affiliated notice.

### 4.5 Responsive layout
| Width | Layout |
|---|---|
| ≥ 1024px | Filter rail left (240px), results, lot drawer docked right (340px) |
| 600 to 1023px | Filters and lot drawer slide over the content with a scrim; 3 card columns; Filters button with active count |
| < 600px | 2 card columns or compact list; filter sheet from the bottom with "Show N lots"; lot opens full screen; bottom tab bar: Home, Lots, Selling, Settings |

Touch targets at least 44px. All controls are real buttons, links and inputs with labels.

## 5. Visual system

Dark only. Palette roles (defaults; Settings overrides the starred ones and derives the rest with `color-mix(in oklch, …)`):

| Role | Default | Derived from user picks |
|---|---|---|
| `--bg` * | `#141914` | user background |
| `--surface` | `oklch(0.215 0.007 150)` | bg 88% + white |
| `--surface-2` | `oklch(0.25 0.008 150)` | bg 80% + white |
| `--border` | `oklch(0.3 0.008 150)` | bg 72% + white |
| `--border-strong` | `oklch(0.55 0.01 150)` | bg 45% + white |
| `--fg` | `oklch(0.94 0.006 120)` | fixed |
| `--fg-muted` | `oklch(0.72 0.01 140)` | fixed |
| `--fg-subtle` | `oklch(0.665 0.01 140)` | fixed |
| `--accent` * | `#4E9A5B` | user accent |
| `--accent-fg` | dark or white | by luminance of accent |
| `--accent-text` | | accent 80% + white |
| `--accent-soft` / `--accent-soft-fg` | | accent 22% over bg / accent 70% + white |
| `--watch` * | `#E9B949` | user watched |
| `--watch-text` / `--watch-soft` / `--watch-border` | | 75% + white / 28% over bg / 55% over bg |
| `--danger`, `--danger-text`, `--danger-border` | `oklch(0.68 0.19 18)`, `oklch(0.88 0.0637 18)`, `oklch(0.62 0.2 20)` | fixed |
| `--info-soft` / `--info-text` (donation badge) | `oklch(0.3 0.05 240)` / `oklch(0.85 0.08 240)` | fixed |
| `--overlay-scrim` | `oklch(0 0 0 / 0.6)` | fixed |

Radii: controls 8px, cards 12px, sheets 16px, chips 999px. Type: UI "Open Sans" 14px base (13/12/11 for small, caption, eyebrow); display headings "Instrument Serif" 400 (20 to 40px). Both fonts are SIL Open Font License; bundle the woff2 files. Elevation shadows: `0 24px 48px -12px rgb(0 0 0 / .65)` for sheets and dialogs.

Copy style: plain, short, no em dashes.

## 6. Storage model

Use `browser.storage.local` as the source of truth; mirror a compact subset to `storage.sync` when Sync is on (sync quotas are small: about 100 KB total, 8 KB per item on Chrome).

```ts
type Settings = { accent: string; bg: string; watch: string; classic: boolean; sync: boolean; newBadge: boolean; donations: boolean; view: 'grid' | 'list' };
type LotKey = `${auctionId}:${lotNumber}`;
type Watch = Record<LotKey, { note?: string; max?: string; at: number }>;
type Hidden = Record<LotKey, true>;
type SavedSearch = { id: string; q: string; createdAt: number };
type Seen = Record<auctionId, number[]>; // lot numbers at last view, for "new" flags
```
Lot numbers are stable within an auction once assigned. If a lot's title changes, keep the watch entry but show the new title.

## 7. Milestones

1. **Scaffold**: WXT + TypeScript + UI framework; builds for Chrome and Firefox; content script mounts a "Hello CGA" shadow root on MGA pages; Classic view switch works; login pages untouched.
2. **MGA data layer**: parsers for Home grids, preview grid (with load all), selling list; fixture tests from saved HTML (see CLAUDE.md for capturing fixtures).
3. **Lots catalog**: search, filters, grid/list, drawer, keyboard, watch/hide/notes/max, labels via Print Selected, CSV, responsive layouts.
4. **Settings and theming**: color pickers with derivation and contrast warning, behavior switches, export/import/clear, options page.
5. **Home**: next auction, saved searches with counts, cross auction search, new since last visit, my clubs.
6. **Selling**: list, form, photo queue, edit, copy, delete, relist. Save, upload, copy and delete were captured on Oct 16 (§3.4).
7. **Release**: icons, store listings, privacy statement, AMO and Chrome Web Store submissions, Firefox for Android check.
8. **Later**: history from PDF reports; print friendly watchlist.

## 8. Open questions for the author
- ~~Confirm the visual tokens can be published.~~ Confirmed by the author on Oct 16, 2026.
- Approve a throwaway test item in an upcoming auction (and its deletion) to capture save, upload, copy and delete responses.
- Store listing copy and icon.
