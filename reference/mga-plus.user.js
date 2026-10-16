// ==UserScript==
// @name         MyGroupAuctions Plus
// @namespace    https://github.com/JonoAugustine
// @version      1.1.0
// @description  Loads every lot on one page and adds search, filters, sorting, card view, photo lightbox, watchlist with notes, and bulk select for printing.
// @author       JonoAugustine
// @match        https://mygroupauctions.com/preview-auction.aspx*
// @match        https://www.mygroupauctions.com/preview-auction.aspx*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ---------- storage (GM with localStorage fallback) ----------
  const store = {
    get(k, d) {
      try { if (typeof GM_getValue === 'function') return GM_getValue(k, d); } catch (e) {}
      try { const v = localStorage.getItem('mga:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set(k, v) {
      try { if (typeof GM_setValue === 'function') return GM_setValue(k, v); } catch (e) {}
      try { localStorage.setItem('mga:' + k, JSON.stringify(v)); } catch (e) {}
    },
  };
  const copy = (text) => {
    try { if (typeof GM_setClipboard === 'function') return GM_setClipboard(text); } catch (e) {}
    navigator.clipboard?.writeText(text);
  };

  const GRID_UID = 'ctl00$Content$dgItems';
  const GRID_ID = 'ctl00_Content_dgItems';
  const auctionId = new URLSearchParams(location.search).get('id') || 'unknown';
  const form = document.forms[0];
  if (!form || !document.getElementById(GRID_ID)) return;

  // ---------- state ----------
  const watchKey = 'watch:' + auctionId;
  const hiddenKey = 'hidden:' + auctionId;
  let watch = store.get(watchKey, {});      // { lot: { note } }
  let hidden = store.get(hiddenKey, []);    // [lot]
  const prefs = Object.assign({ view: 'table', sort: 'lot-asc' }, store.get('prefs', {}));
  const filters = { q: '', photo: 'any', price: 'any', min: '', max: '', watchedOnly: false, showHidden: false, donations: 'any' };
  let lots = [];

  // ---------- styles ----------
  const css = `
  :root{--mga-accent:#0e7490;--mga-bg:#fff;--mga-fg:#1f2937;--mga-muted:#6b7280;--mga-line:#e5e7eb;--mga-soft:#f3f4f6;--mga-star:#f59e0b;--mga-mark:#fde68a}
  #mga-bar{position:sticky;top:0;z-index:50;background:var(--mga-bg);border:1px solid var(--mga-line);border-radius:10px;padding:10px 12px;margin:8px 0 12px;box-shadow:0 2px 8px rgba(0,0,0,.06);font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--mga-fg)}
  #mga-bar .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  #mga-bar .row + .row{margin-top:8px}
  #mga-bar input[type=search],#mga-bar input[type=number],#mga-bar select{border:1px solid var(--mga-line);border-radius:6px;padding:6px 8px;font:inherit;background:#fff}
  #mga-q{flex:1 1 280px;min-width:200px;font-size:14px!important}
  #mga-bar input[type=number]{width:72px}
  #mga-bar button,.mga-chip{border:1px solid var(--mga-line);background:var(--mga-soft);border-radius:6px;padding:5px 10px;font:inherit;cursor:pointer;color:var(--mga-fg)}
  #mga-bar button:hover,.mga-chip:hover{border-color:var(--mga-accent)}
  .mga-chip{border-radius:999px;padding:3px 10px;user-select:none}
  .mga-chip.on{background:var(--mga-accent);border-color:var(--mga-accent);color:#fff}
  .mga-chip .n{opacity:.7;margin-left:4px;font-size:11px}
  #mga-stats{color:var(--mga-muted);margin-left:auto}
  .mga-sep{width:1px;height:20px;background:var(--mga-line)}
  .mga-label{color:var(--mga-muted)}
  #${GRID_ID} .rgNumPart,#${GRID_ID} tfoot{display:none!important}
  table.record-grid{width:100%;border-collapse:collapse}
  table.record-grid td{vertical-align:middle;padding:6px 8px;border-bottom:1px solid var(--mga-line)}
  table.record-grid tbody tr:hover{background:#f0f9ff}
  tr.mga-watched{background:#fffbeb!important}
  tr.mga-hiddenlot{opacity:.45}
  tr.mga-off{display:none!important}
  .mga-thumb{height:72px!important;max-height:72px!important;width:72px;object-fit:cover;border-radius:6px;cursor:zoom-in;background:var(--mga-soft)}
  .mga-nophoto{display:inline-flex;width:72px;height:72px;border-radius:6px;background:var(--mga-soft);color:#9ca3af;align-items:center;justify-content:center;font-size:11px}
  .mga-note{display:block;font-size:12px;color:#92400e;margin-top:3px}
  .mga-actions{white-space:nowrap;text-align:right}
  .mga-actions button{border:0;background:none;cursor:pointer;font-size:18px;padding:2px 4px;color:#9ca3af;line-height:1}
  .mga-actions button:hover{color:var(--mga-fg)}
  .mga-actions .mga-star.on{color:var(--mga-star)}
  mark.mga-hl{background:var(--mga-mark);padding:0 1px;border-radius:2px}
  .mga-free{color:#047857;font-weight:600}
  /* card view */
  #page,#content{width:auto!important;max-width:1400px;margin:0 auto;box-sizing:border-box;padding:0 12px}
  .mga-cards table.record-grid{display:block}
  .mga-cards table.record-grid thead{display:none}
  .mga-cards table.record-grid tbody{width:100%;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
  .mga-cards table.record-grid tbody tr{display:flex;flex-direction:column;border:1px solid var(--mga-line);border-radius:10px;overflow:hidden;background:#fff;position:relative}
  .mga-cards table.record-grid td{border:0;padding:4px 10px}
  .mga-cards td.mga-c-img{order:-1;padding:0}
  .mga-cards .mga-thumb,.mga-cards .mga-nophoto{width:100%!important;height:200px!important;max-height:200px!important;border-radius:0}
  .mga-cards td.mga-c-lot{font-weight:700;color:var(--mga-accent);padding-top:8px}
  .mga-cards td.mga-c-lot::before{content:"Lot "}
  .mga-cards td.mga-c-title{flex:1}
  .mga-cards td.mga-c-sel{position:absolute;top:6px;left:2px;background:rgba(255,255,255,.85);border-radius:6px;padding:2px 4px}
  .mga-cards td.mga-actions{position:absolute;top:4px;right:4px;background:rgba(255,255,255,.85);border-radius:6px;padding:0 2px}
  .mga-cards td.mga-c-price{padding-bottom:10px}
  /* lightbox */
  #mga-lb{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:none;align-items:center;justify-content:center;flex-direction:column;font:14px system-ui,sans-serif;color:#fff}
  #mga-lb.open{display:flex}
  #mga-lb img{max-width:92vw;max-height:80vh;border-radius:8px;background:#111}
  #mga-lb .cap{margin-top:12px;max-width:90vw;text-align:center}
  #mga-lb .nav{position:absolute;top:50%;transform:translateY(-50%);font-size:40px;background:none;border:0;color:#fff;cursor:pointer;padding:20px}
  #mga-lb .prev{left:8px}#mga-lb .next{right:8px}
  #mga-lb .close{position:absolute;top:10px;right:16px;font-size:30px;background:none;border:0;color:#fff;cursor:pointer}
  #mga-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:8px 14px;border-radius:8px;font:13px system-ui,sans-serif;z-index:10000;opacity:0;transition:opacity .2s;pointer-events:none}
  #mga-toast.show{opacity:1}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const toast = (msg) => {
    let t = document.getElementById('mga-toast');
    if (!t) { t = document.createElement('div'); t.id = 'mga-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800);
  };

  // ---------- load every lot (one background postback, then swap grid + page state) ----------
  async function loadAllLots() {
    if (!document.querySelector(`#${GRID_ID} .rgNumPart`)) return; // already showing everything
    const fd = new FormData(form);
    fd.set('__EVENTTARGET', GRID_UID);
    fd.set('__EVENTARGUMENT', `FireCommand:${GRID_UID}$ctl00;PageSize;5000`);
    const res = await fetch(form.action, { method: 'POST', body: new URLSearchParams(fd), credentials: 'include' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const fresh = doc.getElementById(GRID_ID);
    if (!fresh) throw new Error('grid missing in response');
    fresh.querySelectorAll('img[src*="imagehandler"]').forEach((i) => i.setAttribute('loading', 'lazy'));
    document.getElementById(GRID_ID).replaceWith(document.importNode(fresh, true));
    // keep server state in sync so native postbacks (Print Selected) see these rows
    doc.querySelectorAll('input[type=hidden][name]').forEach((h) => {
      const mine = form.querySelector(`input[type=hidden][name="${CSS.escape(h.name)}"]`);
      if (mine) mine.value = h.value;
    });
  }

  // ---------- parse + decorate rows ----------
  function money(s) { const n = parseFloat(String(s).replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n; }

  function decorate() {
    const table = document.querySelector(`#${GRID_ID} table.record-grid`) || document.getElementById(GRID_ID + '_ctl00');
    const headRow = table.querySelector('thead tr:last-child');
    if (headRow && !headRow.querySelector('.mga-th')) {
      const th = document.createElement('th'); th.className = 'record-grid-hdr mga-th'; th.textContent = 'Watch';
      headRow.appendChild(th);
      // disable server sort links; sorting is client side now
      headRow.querySelectorAll('a[href*="__doPostBack"]').forEach((a) => {
        const key = { 'Lot #': 'lot', 'Item': 'title', 'Min. Bid': 'price' }[a.textContent.trim()];
        a.removeAttribute('href'); a.style.cursor = 'pointer';
        if (key) a.addEventListener('click', () => {
          prefs.sort = prefs.sort === key + '-asc' ? key + '-desc' : key + '-asc';
          store.set('prefs', prefs); document.getElementById('mga-sort').value = prefs.sort; apply();
        });
      });
    }
    const rows = [...table.querySelectorAll('tbody > tr.record-grid-row, tbody > tr.record-grid-alt')];
    lots = rows.map((tr) => {
      const [cSel, cLot, cTitle, cPrice, cImg] = tr.cells;
      [cSel, cLot, cTitle, cPrice, cImg].forEach((c, i) => c && c.classList.add(['mga-c-sel', 'mga-c-lot', 'mga-c-title', 'mga-c-price', 'mga-c-img'][i]));
      const lot = cLot.textContent.trim();
      const title = cTitle.textContent.replace(/\s+/g, ' ').trim();
      const price = money(cPrice.textContent);
      if (price === 0) cPrice.innerHTML = '<span class="mga-free">No min</span>';
      const img = cImg.querySelector('img');
      if (img) {
        img.classList.add('mga-thumb'); img.removeAttribute('style'); img.loading = 'lazy'; img.alt = title;
      } else {
        cImg.innerHTML = '<span class="mga-nophoto">No photo</span>';
      }
      cTitle.dataset.raw = title;
      const actions = document.createElement('td');
      actions.className = 'mga-actions';
      // type="button" matters: the whole page is one ASP.NET <form>, so a default button would trigger a postback
      actions.innerHTML = '<button type="button" class="mga-star" title="Watch (adds to watchlist)">☆</button><button type="button" class="mga-notebtn" title="Add note">✎</button><button type="button" class="mga-hide" title="Hide lot">✕</button>';
      tr.appendChild(actions);
      const L = { tr, lot, lotNum: parseInt(lot, 10) || 0, title, titleLC: title.toLowerCase(), price, img: img ? img.src : null,
        donation: /\bdonat(ion|ed)\b/i.test(title), cTitle, cb: cSel?.querySelector('input[type=checkbox]') };
      actions.querySelector('.mga-star').addEventListener('click', () => toggleWatch(L));
      actions.querySelector('.mga-notebtn').addEventListener('click', () => editNote(L));
      actions.querySelector('.mga-hide').addEventListener('click', () => toggleHidden(L));
      if (img) img.addEventListener('click', () => openLightbox(L));
      return L;
    });
  }

  // ---------- watch / notes / hide ----------
  function toggleWatch(L) {
    if (watch[L.lot]) delete watch[L.lot]; else watch[L.lot] = { note: '' };
    store.set(watchKey, watch); apply();
  }
  function editNote(L) {
    const cur = watch[L.lot]?.note || '';
    const v = prompt(`Note for lot ${L.lot}: ${L.title}`, cur);
    if (v === null) return;
    watch[L.lot] = { note: v.trim() };
    store.set(watchKey, watch); apply();
  }
  function toggleHidden(L) {
    const i = hidden.indexOf(L.lot);
    if (i >= 0) hidden.splice(i, 1); else hidden.push(L.lot);
    store.set(hiddenKey, hidden); apply();
  }

  // ---------- search ----------
  function parseQuery(q) {
    const inc = [], exc = [];
    const re = /(-?)"([^"]+)"|(-?)(\S+)/g; let m;
    while ((m = re.exec(q))) {
      const neg = m[1] || m[3]; const term = (m[2] || m[4] || '').toLowerCase();
      if (!term || term === '-') continue;
      (neg ? exc : inc).push(term);
    }
    return { inc, exc };
  }
  function matchTerm(L, t) {
    const range = t.match(/^(\d+)-(\d+)$/);
    if (range) return L.lotNum >= +range[1] && L.lotNum <= +range[2];
    if (/^#\d+$/.test(t)) return L.lot === t.slice(1);
    if (/^\d+$/.test(t) && L.lot === t) return true;
    return L.titleLC.includes(t);
  }
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- apply filters/sort ----------
  function apply() {
    const { inc, exc } = parseQuery(filters.q);
    const textTerms = inc.filter((t) => !/^(#?\d+|\d+-\d+)$/.test(t));
    const hlRe = textTerms.length ? new RegExp('(' + textTerms.map(escRe).join('|') + ')', 'gi') : null;
    const min = filters.min === '' ? -Infinity : +filters.min;
    const max = filters.max === '' ? Infinity : +filters.max;
    let shown = 0;

    lots.forEach((L) => {
      const isHidden = hidden.includes(L.lot);
      const ok =
        inc.every((t) => matchTerm(L, t)) &&
        !exc.some((t) => matchTerm(L, t)) &&
        (filters.photo === 'any' || (filters.photo === 'yes') === !!L.img) &&
        (filters.price === 'any' || (filters.price === 'nomin' ? L.price === 0 : L.price > 0)) &&
        (filters.donations === 'any' || (filters.donations === 'only') === L.donation) &&
        L.price >= min && L.price <= max &&
        (!filters.watchedOnly || !!watch[L.lot]) &&
        (filters.showHidden || !isHidden);
      L.tr.classList.toggle('mga-off', !ok);
      L.tr.classList.toggle('mga-watched', !!watch[L.lot]);
      L.tr.classList.toggle('mga-hiddenlot', isHidden);
      const star = L.tr.querySelector('.mga-star');
      star.textContent = watch[L.lot] ? '★' : '☆'; star.classList.toggle('on', !!watch[L.lot]);
      L.tr.querySelector('.mga-hide').title = isHidden ? 'Unhide lot' : 'Hide lot';
      // title with highlight and note
      let html = escHtml(L.title);
      if (hlRe) html = html.replace(hlRe, '<mark class="mga-hl">$1</mark>');
      const note = watch[L.lot]?.note;
      if (note) html += `<span class="mga-note">📝 ${escHtml(note)}</span>`;
      L.cTitle.innerHTML = html;
      if (ok) shown++;
    });

    // sort
    const [key, dir] = prefs.sort.split('-');
    const mult = dir === 'desc' ? -1 : 1;
    const sorted = [...lots].sort((a, b) => {
      let d = key === 'title' ? a.title.localeCompare(b.title) : key === 'price' ? a.price - b.price : a.lotNum - b.lotNum;
      if (!d) d = a.lotNum - b.lotNum;
      return d * mult;
    });
    const tbody = lots[0]?.tr.parentNode;
    if (tbody) sorted.forEach((L) => tbody.appendChild(L.tr));

    // counts
    document.getElementById('mga-watched').classList.toggle('on', filters.watchedOnly);
    document.getElementById('mga-showhidden').classList.toggle('on', filters.showHidden);
    const wc = Object.keys(watch).length;
    document.getElementById('mga-watched').querySelector('.n').textContent = wc;
    document.getElementById('mga-showhidden').querySelector('.n').textContent = hidden.length;
    const sel = lots.filter((L) => L.cb?.checked).length;
    document.getElementById('mga-stats').textContent = `Showing ${shown} of ${lots.length} lots${sel ? ` · ${sel} selected for print` : ''}`;
  }

  // ---------- toolbar ----------
  function buildBar() {
    const bar = document.createElement('div');
    bar.id = 'mga-bar';
    bar.innerHTML = `
      <div class="row">
        <input id="mga-q" type="search" placeholder='Search lots… e.g. pleco -bristlenose "group of 6" 120-150 #124   (press / to focus)'>
        <select id="mga-sort" title="Sort">
          <option value="lot-asc">Lot # ↑</option><option value="lot-desc">Lot # ↓</option>
          <option value="title-asc">Name A to Z</option><option value="title-desc">Name Z to A</option>
          <option value="price-asc">Min bid ↑</option><option value="price-desc">Min bid ↓</option>
        </select>
        <button id="mga-view" title="Toggle table / cards"></button>
        <span id="mga-stats"></span>
      </div>
      <div class="row">
        <span class="mga-label">Photo</span>
        <select id="mga-photo"><option value="any">Any</option><option value="yes">Has photo</option><option value="no">No photo</option></select>
        <span class="mga-label">Min bid</span>
        <select id="mga-price"><option value="any">Any</option><option value="nomin">No minimum</option><option value="hasmin">Has minimum</option></select>
        <input id="mga-min" type="number" min="0" step="1" placeholder="$ min">
        <input id="mga-max" type="number" min="0" step="1" placeholder="$ max">
        <span class="mga-label">Donations</span>
        <select id="mga-don"><option value="any">Any</option><option value="only">Only</option><option value="exclude">Exclude</option></select>
        <span class="mga-sep"></span>
        <span class="mga-chip" id="mga-watched">★ Watched<span class="n"></span></span>
        <span class="mga-chip" id="mga-showhidden">Show hidden<span class="n"></span></span>
        <span class="mga-sep"></span>
        <button id="mga-selvis" title="Tick the print checkbox for every lot currently shown">Select shown</button>
        <button id="mga-selwatch" title="Tick the print checkbox for every watched lot">Select watched</button>
        <button id="mga-selnone">Clear selection</button>
        <button id="mga-export" title="Copy watchlist to clipboard">Copy watchlist</button>
        <button id="mga-csv" title="Download shown lots as CSV">CSV</button>
        <button id="mga-reset">Reset filters</button>
      </div>`;
    bar.querySelectorAll('button').forEach((b) => (b.type = 'button'));
    // Enter inside the page-wide form would submit it; swallow it in our inputs
    bar.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) e.preventDefault(); });
    const anchor = document.getElementById(GRID_ID);
    anchor.parentNode.insertBefore(bar, anchor);


    const $ = (id) => bar.querySelector('#' + id);
    let deb;
    $('mga-q').addEventListener('input', (e) => { clearTimeout(deb); deb = setTimeout(() => { filters.q = e.target.value; apply(); }, 120); });
    $('mga-sort').value = prefs.sort;
    $('mga-sort').addEventListener('change', (e) => { prefs.sort = e.target.value; store.set('prefs', prefs); apply(); });
    const setView = () => {
      document.getElementById(GRID_ID).classList.toggle('mga-cards', prefs.view === 'cards');
      $('mga-view').textContent = prefs.view === 'cards' ? '☰ Table view' : '▦ Card view';
    };
    setView();
    $('mga-view').addEventListener('click', () => { prefs.view = prefs.view === 'cards' ? 'table' : 'cards'; store.set('prefs', prefs); setView(); });
    $('mga-photo').addEventListener('change', (e) => { filters.photo = e.target.value; apply(); });
    $('mga-price').addEventListener('change', (e) => { filters.price = e.target.value; apply(); });
    $('mga-min').addEventListener('input', (e) => { filters.min = e.target.value; apply(); });
    $('mga-max').addEventListener('input', (e) => { filters.max = e.target.value; apply(); });
    $('mga-don').addEventListener('change', (e) => { filters.donations = e.target.value; apply(); });
    $('mga-watched').addEventListener('click', () => { filters.watchedOnly = !filters.watchedOnly; apply(); });
    $('mga-showhidden').addEventListener('click', () => { filters.showHidden = !filters.showHidden; apply(); });
    const shownLots = () => lots.filter((L) => !L.tr.classList.contains('mga-off'));
    $('mga-selvis').addEventListener('click', () => { shownLots().forEach((L) => L.cb && (L.cb.checked = true)); apply(); toast('Ticked shown lots; use Print Selected'); });
    $('mga-selwatch').addEventListener('click', () => { lots.forEach((L) => { if (watch[L.lot] && L.cb) L.cb.checked = true; }); apply(); toast('Ticked watched lots'); });
    $('mga-selnone').addEventListener('click', () => { lots.forEach((L) => L.cb && (L.cb.checked = false)); apply(); });
    $('mga-export').addEventListener('click', () => {
      const w = lots.filter((L) => watch[L.lot]).sort((a, b) => a.lotNum - b.lotNum);
      if (!w.length) return toast('Watchlist is empty');
      const head = document.title + ' (auction ' + auctionId + ')';
      copy(head + '\n' + w.map((L) => `Lot ${L.lot}: ${L.title}${L.price ? ` (min $${L.price.toFixed(2)})` : ''}${watch[L.lot].note ? ` | ${watch[L.lot].note}` : ''}`).join('\n'));
      toast(`Copied ${w.length} watched lots`);
    });
    $('mga-csv').addEventListener('click', () => {
      const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
      const lines = [['Lot', 'Item', 'Min Bid', 'Photo', 'Watched', 'Note'].join(',')].concat(
        shownLots().map((L) => [L.lot, q(L.title), L.price.toFixed(2), L.img ? 'yes' : 'no', watch[L.lot] ? 'yes' : '', q(watch[L.lot]?.note || '')].join(',')));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
      a.download = `auction-${auctionId}-lots.csv`; a.click();
    });
    $('mga-reset').addEventListener('click', () => {
      Object.assign(filters, { q: '', photo: 'any', price: 'any', min: '', max: '', watchedOnly: false, showHidden: false, donations: 'any' });
      ['mga-q', 'mga-min', 'mga-max'].forEach((id) => ($(id).value = ''));
      ['mga-photo', 'mga-price', 'mga-don'].forEach((id) => ($(id).value = 'any'));
      apply();
    });
    // keep the "selected" count fresh when ticking boxes by hand
    document.getElementById(GRID_ID).addEventListener('change', (e) => { if (e.target.type === 'checkbox') apply(); });
  }

  // ---------- lightbox ----------
  let lbIndex = -1, lbList = [];
  function buildLightbox() {
    const lb = document.createElement('div');
    lb.id = 'mga-lb';
    lb.innerHTML = '<button type="button" class="close" title="Close (Esc)">×</button><button type="button" class="nav prev" title="Previous (←)">‹</button><img alt=""><div class="cap"></div><button type="button" class="nav next" title="Next (→)">›</button>';
    document.body.appendChild(lb);
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('close')) closeLightbox(); });
    lb.querySelector('.prev').addEventListener('click', () => stepLightbox(-1));
    lb.querySelector('.next').addEventListener('click', () => stepLightbox(1));
  }
  function openLightbox(L) {
    lbList = lots.filter((x) => x.img && !x.tr.classList.contains('mga-off'));
    // follow current on-screen order
    lbList.sort((a, b) => (a.tr.compareDocumentPosition(b.tr) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    lbIndex = lbList.indexOf(L);
    renderLightbox();
    document.getElementById('mga-lb').classList.add('open');
  }
  function renderLightbox() {
    const L = lbList[lbIndex]; if (!L) return;
    const lb = document.getElementById('mga-lb');
    lb.querySelector('img').src = L.img;
    lb.querySelector('.cap').innerHTML = `<b>Lot ${L.lot}</b>: ${escHtml(L.title)}${L.price ? ` · min $${L.price.toFixed(2)}` : ''} · ${lbIndex + 1}/${lbList.length}${watch[L.lot] ? ' · ★' : ''}<br><small>W to watch, ← → to browse, Esc to close</small>`;
  }
  function stepLightbox(d) { if (!lbList.length) return; lbIndex = (lbIndex + d + lbList.length) % lbList.length; renderLightbox(); }
  function closeLightbox() { document.getElementById('mga-lb').classList.remove('open'); }

  // ---------- keyboard ----------
  document.addEventListener('keydown', (e) => {
    const lbOpen = document.getElementById('mga-lb')?.classList.contains('open');
    if (lbOpen) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'ArrowRight') stepLightbox(1);
      else if (e.key.toLowerCase() === 'w') { toggleWatch(lbList[lbIndex]); renderLightbox(); }
      else return;
      e.preventDefault(); return;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (e.key === '/' && !typing) { e.preventDefault(); document.getElementById('mga-q')?.focus(); }
    if (e.key === 'Escape' && document.activeElement?.id === 'mga-q') { e.target.value = ''; filters.q = ''; apply(); e.target.blur(); }
  });

  // ---------- boot ----------
  (async () => {
    const grid = document.getElementById(GRID_ID);
    grid.style.opacity = '.5';
    try { await loadAllLots(); }
    catch (err) { console.warn('[MGA+] could not load all lots, enhancing current page only', err); toast('Could not load all lots; showing this page only'); }
    document.getElementById(GRID_ID).style.opacity = '';
    decorate();
    buildBar();
    buildLightbox();
    apply();
  })();
})();
