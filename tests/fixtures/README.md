Saved MGA pages, scrubbed with `node scripts/scrub-fixture.mjs <raw> <out>` (raw copies live in `raw/`, which git ignores).

The scrub removes scripts, styles, ViewState, the logged in name and emails, and rewrites "Save Page As" resource paths. Saved pages lose image ids, so imagehandler sources carry synthetic ids from 900001.

- `home.html`: /default.aspx, 3 groups and 252 auctions, one upcoming (951)
- `preview.html`: /preview-auction.aspx?id=951, first page of 20 (394 lots in all), not the load all response
- `selling.html`: /auction-items.aspx?id=963 (past auction), 13 of the user's own items
- `selling-empty.html`: /auction-items.aspx?id=951 with nothing listed (saved while CGA was running)
- `item.html`: dialogs/AuctionItem.aspx for item 146356 in auction 963, one primary photo
