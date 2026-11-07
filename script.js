(function () {
  'use strict';

  /* ===================== Data ===================== */
  const STORAGE_KEY = 'inventory-v2-items';
  const COLS_KEY = 'inventory-v2-hidden-cols';

  const seed = [
    { id: 1,  name: 'Wireless Mouse',       sku: 'WM-1001', category: 'Accessories', qty: 142, reorder: 30,  price: 24.99,  location: 'A-01' },
    { id: 2,  name: 'Mechanical Keyboard',  sku: 'KB-2040', category: 'Accessories', qty: 18,  reorder: 25,  price: 89.0,   location: 'A-02' },
    { id: 3,  name: '27" 4K Monitor',       sku: 'MN-3270', category: 'Electronics', qty: 36,  reorder: 10,  price: 329.0,  location: 'B-04' },
    { id: 4,  name: 'USB-C Hub 7-in-1',     sku: 'HB-0071', category: 'Accessories', qty: 0,   reorder: 20,  price: 39.5,   location: 'A-07' },
    { id: 5,  name: 'Standing Desk',        sku: 'DK-5500', category: 'Furniture',   qty: 12,  reorder: 5,   price: 449.0,  location: 'D-11' },
    { id: 6,  name: 'Ergonomic Chair',      sku: 'CH-6100', category: 'Furniture',   qty: 7,   reorder: 8,   price: 259.0,  location: 'D-12' },
    { id: 7,  name: 'Laptop Stand',         sku: 'LS-0810', category: 'Accessories', qty: 88,  reorder: 20,  price: 29.9,   location: 'A-09' },
    { id: 8,  name: 'Webcam 1080p',         sku: 'WC-1080', category: 'Electronics', qty: 54,  reorder: 15,  price: 59.0,   location: 'B-06' },
    { id: 9,  name: 'A4 Copy Paper (Ream)', sku: 'PP-A400', category: 'Office',      qty: 320, reorder: 100, price: 4.75,   location: 'C-03' },
    { id: 10, name: 'Gel Pens (12 pack)',   sku: 'PN-0120', category: 'Office',      qty: 9,   reorder: 40,  price: 6.2,    location: 'C-05' },
    { id: 11, name: 'Steel Shelving Unit',  sku: 'SH-7700', category: 'Storage',     qty: 21,  reorder: 6,   price: 119.0,  location: 'E-02' },
    { id: 12, name: 'Archive Boxes (10)',   sku: 'AB-1010', category: 'Storage',     qty: 64,  reorder: 25,  price: 18.4,   location: 'E-08' }
  ];

  let items = read(STORAGE_KEY, seed).map((i) => ({ location: '-', ...i }));
  let hiddenCols = read(COLS_KEY, []);
  const state = { q: '', tab: 'all', sortKey: null, sortDir: 'asc', page: 1, pageSize: 8, range: '3m' };
  const selected = new Set();
  let editingId = null, deletingId = null, menuId = null, dragId = null;

  function read(key, fallback) {
    try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw); } catch (e) {}
    return Array.isArray(fallback) ? fallback.slice() : fallback;
  }
  function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  /* ===================== Helpers ===================== */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const num = (n) => new Intl.NumberFormat('en-US').format(n);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const statusOf = (i) => (i.qty <= 0 ? 'out' : i.qty <= i.reorder ? 'low' : 'in');
  const STATUS = { in: ['In Stock', 'i-check'], low: ['Low Stock', 'i-alert'], out: ['Out of Stock', 'i-xc'] };
  const LUCIDE = {
    'i-up': 'trending-up', 'i-down': 'trending-down', 'i-check': 'circle-check', 'i-alert': 'circle-alert',
    'i-xc': 'circle-x', 'i-grip': 'grip-vertical', 'i-kebab': 'ellipsis-vertical'
  };
  const icon = (id) => `<i data-lucide="${LUCIDE[id]}" class="i"></i>`;
  // Lucide swaps <i data-lucide> for <svg>; call after any render that adds icons.
  const refreshIcons = () => { if (window.lucide) window.lucide.createIcons(); };

  /* ===================== KPI cards ===================== */
  function renderStats() {
    const value = items.reduce((s, i) => s + i.qty * i.price, 0);
    const low = items.filter((i) => statusOf(i) === 'low').length;
    const out = items.filter((i) => statusOf(i) === 'out').length;
    // Values are live; trend % and notes are sample figures.
    const cards = [
      { label: 'Inventory Value', value: money(value), badge: '+12.5%', up: true, line: 'Trending up this month', sub: 'Valuation at current unit prices' },
      { label: 'Total Products', value: num(items.length), badge: '+4.2%', up: true, line: 'Catalog is growing', sub: 'Active SKUs across all categories' },
      { label: 'Needs Attention', value: num(low + out), badge: '-8%', up: false, line: 'Fewer alerts this week', sub: `${low} low stock · ${out} out of stock` },
      { label: 'Fill Rate', value: '96.4%', badge: '+1.2%', up: true, line: 'Orders fulfilled on time', sub: 'Meets service targets' }
    ];
    $('#stats').innerHTML = cards.map((c) => `
      <article class="card stat-card">
        <div class="stat-top"><span>${c.label}</span><span class="pill-out">${icon(c.up ? 'i-up' : 'i-down')}${c.badge}</span></div>
        <p class="stat">${c.value}</p>
        <p class="stat-line">${c.line}${icon(c.up ? 'i-up' : 'i-down')}</p>
        <p class="stat-sub">${c.sub}</p>
      </article>`).join('');
    refreshIcons();
  }

  /* ===================== Chart ===================== */
  const RANGES = {
    '3m':  { n: 13, step: 7, text: '3 months', seed: 3 },
    '30d': { n: 10, step: 3, text: '30 days',  seed: 7 },
    '7d':  { n: 7,  step: 1, text: '7 days',   seed: 11 }
  };
  const chartWrap = $('#chartWrap');
  const tooltip = $('#tooltip');
  let chartData = null;

  function makeData(range) {
    const r = RANGES[range];
    const end = new Date();
    const pts = [];
    for (let i = 0; i < r.n; i++) {
      const d = new Date(end);
      d.setDate(end.getDate() - (r.n - 1 - i) * r.step);
      const t = i + r.seed;
      const received = Math.round(260 + 120 * Math.sin(t * 0.9) + 60 * Math.cos(t * 2.3) + 40 * Math.sin(t * 5.1));
      const shipped = Math.round(200 + 90 * Math.sin(t * 0.9 + 1.1) + 45 * Math.cos(t * 1.7) + 30 * Math.sin(t * 4.3));
      pts.push({ date: d, received: Math.max(40, received), shipped: Math.max(30, shipped) });
    }
    return pts;
  }

  function smoothPath(p) {
    if (p.length < 2) return '';
    let d = `M${p[0].x},${p[0].y}`;
    const clamp = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = clamp(p1.y + (p2.y - p0.y) / 6, p1.y, p2.y);
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = clamp(p2.y - (p3.y - p1.y) / 6, p1.y, p2.y);
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  function renderChart() {
    chartData = makeData(state.range);
    const W = chartWrap.clientWidth || 600, H = chartWrap.clientHeight || 260;
    const padX = 4, top = 12, bottom = 30;
    const plotH = H - top - bottom;
    const max = Math.max(...chartData.map((d) => Math.max(d.received, d.shipped))) * 1.15;
    const xs = (i) => padX + (i * (W - padX * 2)) / (chartData.length - 1);
    const ys = (v) => top + plotH - (v / max) * plotH;
    const s1 = chartData.map((d, i) => ({ x: xs(i), y: ys(d.received) }));
    const s2 = chartData.map((d, i) => ({ x: xs(i), y: ys(d.shipped) }));
    const base = top + plotH;
    const area = (pts) => `${smoothPath(pts)} L${pts[pts.length - 1].x},${base} L${pts[0].x},${base} Z`;

    const every = Math.ceil(chartData.length / (W < 480 ? 4 : 7));
    const labels = chartData.map((d, i) => (i % every === (chartData.length - 1) % every)
      ? `<text class="axis-text" x="${xs(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === chartData.length - 1 ? 'end' : 'middle'}">${fmtDate(d.date)}</text>` : '').join('');
    const grid = [0, 1, 2, 3].map((k) => `<line class="grid-line" x1="0" x2="${W}" y1="${top + (plotH / 3) * k}" y2="${top + (plotH / 3) * k}"/>`).join('');

    chartWrap.querySelector('svg')?.remove();
    chartWrap.insertAdjacentHTML('afterbegin', `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Stock movement chart">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(var(--blue))" stop-opacity=".55"/><stop offset="1" stop-color="hsl(var(--blue))" stop-opacity=".03"/></linearGradient>
          <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(var(--blue-2))" stop-opacity=".4"/><stop offset="1" stop-color="hsl(var(--blue-2))" stop-opacity=".02"/></linearGradient>
        </defs>
        ${grid}
        <path d="${area(s1)}" fill="url(#g1)"/>
        <path d="${area(s2)}" fill="url(#g2)"/>
        <path d="${smoothPath(s1)}" class="line-1" fill="none" stroke-width="1.6"/>
        <path d="${smoothPath(s2)}" class="line-2" fill="none" stroke-width="1.6"/>
        ${labels}
        <g id="hover" hidden>
          <line id="hLine" y1="${top}" y2="${base}" stroke="hsl(var(--muted-foreground))" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/>
          <circle id="hDot1" r="4" fill="hsl(var(--blue))" stroke="hsl(var(--card))" stroke-width="2"/>
          <circle id="hDot2" r="4" fill="hsl(var(--blue-2))" stroke="hsl(var(--card))" stroke-width="2"/>
        </g>
        <rect id="hit" x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
      </svg>`);

    const svg = chartWrap.querySelector('svg');
    const hover = $('#hover', svg), hit = $('#hit', svg);
    const move = (e) => {
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      let idx = Math.round(((x - padX) / (W - padX * 2)) * (chartData.length - 1));
      idx = Math.max(0, Math.min(chartData.length - 1, idx));
      const d = chartData[idx];
      hover.removeAttribute('hidden');
      $('#hLine', svg).setAttribute('x1', xs(idx)); $('#hLine', svg).setAttribute('x2', xs(idx));
      $('#hDot1', svg).setAttribute('cx', xs(idx)); $('#hDot1', svg).setAttribute('cy', ys(d.received));
      $('#hDot2', svg).setAttribute('cx', xs(idx)); $('#hDot2', svg).setAttribute('cy', ys(d.shipped));
      tooltip.hidden = false;
      tooltip.innerHTML = `<strong>${fmtDate(d.date)}</strong>
        <div><i class="dot d1"></i>Received<b>${num(d.received)}</b></div>
        <div><i class="dot d2"></i>Shipped<b>${num(d.shipped)}</b></div>`;
      const tw = tooltip.offsetWidth, px = (xs(idx) / W) * rect.width;
      tooltip.style.left = Math.max(0, Math.min(rect.width - tw, px + 12 + tw > rect.width ? px - tw - 12 : px + 12)) + 'px';
      tooltip.style.top = '8px';
    };
    hit.addEventListener('mousemove', move);
    hit.addEventListener('mouseleave', () => { hover.setAttribute('hidden', ''); tooltip.hidden = true; });
  }

  $('#range').addEventListener('click', (e) => {
    const b = e.target.closest('[data-range]');
    if (!b) return;
    state.range = b.dataset.range;
    $$('#range button').forEach((x) => x.classList.toggle('on', x === b));
    $('#chartSub').textContent = `Units received and shipped for the last ${RANGES[state.range].text}`;
    renderChart();
  });
  if (window.ResizeObserver) new ResizeObserver(() => renderChart()).observe(chartWrap);
  else window.addEventListener('resize', renderChart);

  /* ===================== Table ===================== */
  const tbody = $('#tbody'), table = $('#table');

  function filtered() {
    const q = state.q.toLowerCase();
    const list = items.filter((i) =>
      (state.tab === 'all' || statusOf(i) === state.tab) &&
      (!q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)));
    if (state.sortKey) {
      const k = state.sortKey, dir = state.sortDir === 'asc' ? 1 : -1;
      list.sort((a, b) => (typeof a[k] === 'number' ? a[k] - b[k] : String(a[k]).localeCompare(String(b[k]), undefined, { numeric: true })) * dir);
    }
    return list;
  }

  function renderTabs() {
    const c = { all: items.length, in: 0, low: 0, out: 0 };
    items.forEach((i) => c[statusOf(i)]++);
    $$('[data-count]').forEach((el) => { el.textContent = c[el.dataset.count]; });
    $$('.tab').forEach((t) => { const on = t.dataset.tab === state.tab; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
  }

  function renderTable() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / state.pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * state.pageSize;
    const rows = list.slice(start, start + state.pageSize);
    const canDrag = !state.sortKey;

    tbody.innerHTML = rows.map((i) => {
      const s = statusOf(i), [label, ic] = STATUS[s];
      return `<tr data-id="${i.id}" class="${selected.has(i.id) ? 'selected' : ''}"${canDrag ? ' draggable="true"' : ''}>
        <td class="w-grip"><span class="grip${canDrag ? '' : ' off'}" title="${canDrag ? 'Drag to reorder' : 'Clear sorting to reorder'}">${icon('i-grip')}</span></td>
        <td class="w-chk"><input type="checkbox" class="chk" data-sel="${i.id}" aria-label="Select ${esc(i.name)}" ${selected.has(i.id) ? 'checked' : ''}></td>
        <td data-col="name" class="cell-name"><strong>${esc(i.name)}</strong>${i.fav ? '<i data-lucide="star" class="fav-star" aria-label="Favorite"></i>' : ''}<small>${esc(i.sku)}</small></td>
        <td data-col="category"><span class="tag">${esc(i.category)}</span></td>
        <td data-col="status"><span class="status ${s}">${icon(ic)}${label}</span></td>
        <td data-col="qty" class="right">${num(i.qty)}</td>
        <td data-col="reorder" class="right">${num(i.reorder)}</td>
        <td data-col="price" class="right">${money(i.price)}</td>
        <td data-col="location">${esc(i.location)}</td>
        <td class="w-act"><button class="icon-btn" data-menu="${i.id}" aria-label="Actions for ${esc(i.name)}" aria-haspopup="true">${icon('i-kebab')}</button></td>
      </tr>`;
    }).join('');

    $('#empty').hidden = list.length !== 0;
    $('#pageInfo').textContent = `Page ${state.page} of ${pages}`;
    $('#first').disabled = $('#prev').disabled = state.page <= 1;
    $('#next').disabled = $('#last').disabled = state.page >= pages;

    $$('.sort').forEach((b) => { if (b.dataset.key === state.sortKey) b.dataset.dir = state.sortDir; else delete b.dataset.dir; });

    // selection UI
    const idsOnPage = rows.map((r) => r.id);
    const selOnPage = idsOnPage.filter((id) => selected.has(id)).length;
    const all = $('#selectAll');
    all.checked = idsOnPage.length > 0 && selOnPage === idsOnPage.length;
    all.indeterminate = selOnPage > 0 && selOnPage < idsOnPage.length;
    $('#selInfo').textContent = `${selected.size} of ${list.length} row(s) selected.`;

    table.dataset.hide = hiddenCols.join(' ');
    refreshIcons();
  }

  function renderAll() { renderStats(); renderTabs(); renderTable(); }

  /* ----- table events ----- */
  $('#search').addEventListener('input', (e) => { state.q = e.target.value.trim(); state.page = 1; renderTable(); });
  $('#tabs').addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (!t) return; state.tab = t.dataset.tab; state.page = 1; renderTabs(); renderTable(); });
  $('#pageSize').addEventListener('change', (e) => { state.pageSize = Number(e.target.value); state.page = 1; renderTable(); });
  $('#first').addEventListener('click', () => { state.page = 1; renderTable(); });
  $('#prev').addEventListener('click', () => { state.page--; renderTable(); });
  $('#next').addEventListener('click', () => { state.page++; renderTable(); });
  $('#last').addEventListener('click', () => { state.page = Infinity; renderTable(); });

  $$('.sort').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.key;
    if (state.sortKey !== k) { state.sortKey = k; state.sortDir = 'asc'; }
    else if (state.sortDir === 'asc') state.sortDir = 'desc';
    else state.sortKey = null; // third click clears sorting
    renderTable();
  }));

  $('#selectAll').addEventListener('change', (e) => {
    const list = filtered();
    const start = (state.page - 1) * state.pageSize;
    list.slice(start, start + state.pageSize).forEach((i) => (e.target.checked ? selected.add(i.id) : selected.delete(i.id)));
    renderTable();
  });
  tbody.addEventListener('change', (e) => {
    const c = e.target.closest('[data-sel]');
    if (!c) return;
    const id = Number(c.dataset.sel);
    c.checked ? selected.add(id) : selected.delete(id);
    renderTable();
  });

  /* ----- drag to reorder ----- */
  tbody.addEventListener('dragstart', (e) => {
    const tr = e.target.closest('tr'); if (!tr) return;
    dragId = Number(tr.dataset.id); tr.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(dragId)); } catch (err) {}
  });
  tbody.addEventListener('dragend', () => { dragId = null; $$('tr', tbody).forEach((r) => r.classList.remove('dragging', 'drag-over')); });
  tbody.addEventListener('dragover', (e) => {
    const tr = e.target.closest('tr'); if (!tr || dragId == null) return;
    e.preventDefault();
    $$('tr', tbody).forEach((r) => r.classList.toggle('drag-over', r === tr && Number(r.dataset.id) !== dragId));
  });
  tbody.addEventListener('drop', (e) => {
    const tr = e.target.closest('tr'); if (!tr || dragId == null) return;
    e.preventDefault();
    const targetId = Number(tr.dataset.id);
    if (targetId === dragId) return;
    const from = items.findIndex((i) => i.id === dragId);
    const [moved] = items.splice(from, 1);
    items.splice(items.findIndex((i) => i.id === targetId), 0, moved);
    write(STORAGE_KEY, items);
    renderTable();
  });

  /* ----- row menu ----- */
  const rowMenu = $('#rowMenu');
  tbody.addEventListener('click', (e) => {
    const b = e.target.closest('[data-menu]');
    if (!b) return;
    e.stopPropagation();
    menuId = Number(b.dataset.menu);
    closeCols();
    const r = b.getBoundingClientRect();
    const cur = items.find((i) => i.id === menuId);
    $('#favAct').textContent = cur && cur.fav ? 'Unfavorite' : 'Favorite';
    rowMenu.hidden = false;
    const mw = rowMenu.offsetWidth, mh = rowMenu.offsetHeight;
    rowMenu.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw)) + 'px';
    rowMenu.style.top = (r.bottom + mh + 8 > window.innerHeight ? r.top - mh - 4 : r.bottom + 4) + 'px';
  });
  rowMenu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = menuId; rowMenu.hidden = true;
    if (b.dataset.act === 'edit') openProduct(id);
    if (b.dataset.act === 'copy') duplicate(id);
    if (b.dataset.act === 'fav') toggleFav(id);
    if (b.dataset.act === 'delete') openDelete(id);
  });

  function toggleFav(id) {
    const it = items.find((i) => i.id === id); if (!it) return;
    it.fav = !it.fav;
    write(STORAGE_KEY, items); renderTable();
    toast(it.fav ? 'Added to favorites' : 'Removed from favorites');
  }

  function duplicate(id) {
    const src = items.find((i) => i.id === id); if (!src) return;
    let sku = src.sku + '-C', n = 2;
    while (items.some((i) => i.sku.toLowerCase() === sku.toLowerCase())) sku = `${src.sku}-C${n++}`;
    const newId = items.reduce((m, i) => Math.max(m, i.id), 0) + 1;
    items.splice(items.findIndex((i) => i.id === id) + 1, 0, { ...src, id: newId, sku, name: src.name + ' (copy)' });
    write(STORAGE_KEY, items); renderAll(); toast('Product duplicated');
  }

  /* ----- customize columns ----- */
  const colsMenu = $('#colsMenu');
  const COLS = [['category', 'Category'], ['status', 'Status'], ['qty', 'Qty'], ['reorder', 'Reorder'], ['price', 'Price'], ['location', 'Location']];
  function buildColsMenu() {
    colsMenu.innerHTML = COLS.map(([k, l]) => `<label><input type="checkbox" class="chk" value="${k}" ${hiddenCols.includes(k) ? '' : 'checked'}>${l}</label>`).join('');
  }
  function closeCols() { colsMenu.hidden = true; }
  $('#colsBtn').addEventListener('click', (e) => { e.stopPropagation(); rowMenu.hidden = true; if (colsMenu.hidden) { buildColsMenu(); colsMenu.hidden = false; } else closeCols(); });
  colsMenu.addEventListener('click', (e) => e.stopPropagation());
  colsMenu.addEventListener('change', () => {
    hiddenCols = $$('input', colsMenu).filter((c) => !c.checked).map((c) => c.value);
    write(COLS_KEY, hiddenCols); table.dataset.hide = hiddenCols.join(' ');
  });
  document.addEventListener('click', () => { rowMenu.hidden = true; closeCols(); });
  window.addEventListener('scroll', () => { rowMenu.hidden = true; }, true);

  /* ===================== Add / Edit modal ===================== */
  const productModal = $('#productModal'), deleteModal = $('#deleteModal'), form = $('#productForm');

  function clearErrors() { $$('.field', form).forEach((f) => { f.classList.remove('invalid'); $('.error', f).textContent = ''; }); }

  function openProduct(id) {
    editingId = id || null;
    form.reset(); clearErrors();
    const item = items.find((i) => i.id === id);
    $('#modalTitle').textContent = item ? 'Edit product' : 'Add product';
    $('#modalDesc').textContent = item ? 'Update the product details, then save.' : 'Fill in the details below, then save.';
    $('#saveBtn').textContent = item ? 'Save changes' : 'Save product';
    if (item) ['name', 'sku', 'category', 'qty', 'reorder', 'price', 'location'].forEach((k) => { form.elements[k].value = item[k]; });
    else form.elements.reorder.value = 10;
    productModal.showModal();
    form.elements.name.focus();
  }

  function validate() {
    clearErrors();
    let ok = true;
    const v = (n) => form.elements[n].value.trim();
    const fail = (n, msg) => { const f = form.elements[n].closest('.field'); f.classList.add('invalid'); $('.error', f).textContent = msg; ok = false; };
    const whole = (n) => v(n) !== '' && Number.isInteger(Number(v(n))) && Number(v(n)) >= 0;

    if (!v('name')) fail('name', 'Product name is required.');
    if (!v('sku')) fail('sku', 'SKU is required.');
    else if (items.some((i) => i.sku.toLowerCase() === v('sku').toLowerCase() && i.id !== editingId)) fail('sku', 'This SKU already exists.');
    if (!v('category')) fail('category', 'Choose a category.');
    if (!whole('qty')) fail('qty', 'Enter a whole number, 0 or more.');
    if (!whole('reorder')) fail('reorder', 'Enter a whole number, 0 or more.');
    if (v('price') === '' || Number.isNaN(Number(v('price'))) || Number(v('price')) < 0) fail('price', 'Enter a valid price.');
    if (!v('location')) fail('location', 'Location is required.');
    if (!ok) $('.invalid input, .invalid select', form).focus();
    return ok;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) return;
    const v = (n) => form.elements[n].value.trim();
    const data = { name: v('name'), sku: v('sku').toUpperCase(), category: v('category'), qty: parseInt(v('qty'), 10), reorder: parseInt(v('reorder'), 10), price: Math.round(Number(v('price')) * 100) / 100, location: v('location').toUpperCase() };
    if (editingId) { items = items.map((i) => (i.id === editingId ? { ...i, ...data } : i)); toast('Product updated'); }
    else { items.unshift({ id: items.reduce((m, i) => Math.max(m, i.id), 0) + 1, ...data }); state.page = 1; toast('Product added'); }
    write(STORAGE_KEY, items);
    productModal.close();
    renderAll();
  });
  $('#addBtn').addEventListener('click', () => openProduct(null));
  $('#quickCreate').addEventListener('click', () => openProduct(null));

  /* ----- delete ----- */
  function openDelete(id) {
    const item = items.find((i) => i.id === id); if (!item) return;
    deletingId = id;
    $('#delText').textContent = `"${item.name}" (${item.sku}) will be permanently removed.`;
    deleteModal.showModal();
  }
  $('#confirmDelete').addEventListener('click', () => {
    items = items.filter((i) => i.id !== deletingId);
    selected.delete(deletingId);
    write(STORAGE_KEY, items);
    deleteModal.close(); renderAll(); toast('Product deleted');
  });

  $$('dialog').forEach((d) => d.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return d.close();
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  }));

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  /* ===================== Sidebar & theme ===================== */
  const app = $('#app');
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  $('#sidebarToggle').addEventListener('click', () => { if (isMobile()) app.classList.toggle('mobile-open'); else app.classList.toggle('collapsed'); setTimeout(renderChart, 280); });
  $('#overlay').addEventListener('click', () => app.classList.remove('mobile-open'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { app.classList.remove('mobile-open'); rowMenu.hidden = true; closeCols(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); $('#sidebarToggle').click(); }
  });
  /* ----- view switching (Inventory / Settings) ----- */
  function showView(v) {
    $('#viewInventory').hidden = v !== 'inventory';
    $('#viewSettings').hidden = v !== 'settings';
    $('#pageTitle').textContent = v === 'settings' ? 'Settings' : 'Inventory';
    $$('.nav-item').forEach((a) => {
      const on = a.dataset.view === v;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (isMobile()) app.classList.remove('mobile-open');
    window.scrollTo(0, 0);
  }
  $$('.nav-item').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    if (a.dataset.view) showView(a.dataset.view);
  }));

  /* ----- theme: light / dark / system ----- */
  const root = document.documentElement;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  let savedTheme = 'system';
  try { savedTheme = localStorage.getItem('theme') || 'system'; } catch (e) {}
  function applyTheme(mode) { root.classList.toggle('dark', mode === 'dark' || (mode === 'system' && mq.matches)); }
  function setTheme(mode) {
    savedTheme = mode;
    try { localStorage.setItem('theme', mode); } catch (e) {}
    applyTheme(mode);
    const sel = $('#themeSel'); if (sel) sel.value = mode;
  }
  applyTheme(savedTheme);
  if (mq.addEventListener) mq.addEventListener('change', () => { if (savedTheme === 'system') applyTheme('system'); });
  $('#themeToggle').addEventListener('click', () => setTheme(root.classList.contains('dark') ? 'light' : 'dark'));

  /* ===================== Settings ===================== */
  const SETTINGS_KEY = 'inventory-v2-settings';
  const defaults = { username: '', email: '', bio: '', hiddenNav: [], rows: 8, notifyLow: true, notifyWeekly: false };
  let settings = { ...defaults, ...read(SETTINGS_KEY, {}) };

  function applySettings() {
    $$('[data-nav]').forEach((a) => { a.hidden = settings.hiddenNav.includes(a.dataset.nav); });
    state.pageSize = settings.rows;
    $('#pageSize').value = String(settings.rows);
    const name = $('.user-text strong'), mail = $('.user-text small'), av = $('.avatar');
    if (settings.username) { name.textContent = settings.username; av.textContent = settings.username.slice(0, 2).toUpperCase(); }
    if (settings.email) mail.textContent = settings.email;
  }

  function fillSettingsForm() {
    $('#username').value = settings.username;
    $('#email').value = settings.email;
    $('#bio').value = settings.bio;
    $$('#navChecks input').forEach((c) => { c.checked = !settings.hiddenNav.includes(c.value); });
    $('#rowsSel').value = String(settings.rows);
    $('#notifyLow').checked = settings.notifyLow;
    $('#notifyWeekly').checked = settings.notifyWeekly;
    $('#themeSel').value = savedTheme;
    markEmailPlaceholder();
  }
  function markEmailPlaceholder() { $('#email').classList.toggle('placeholder', !$('#email').value); }
  $('#email').addEventListener('change', markEmailPlaceholder);

  $('#profileForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#username'), err = $('#usernameErr'), val = input.value.trim();
    input.classList.remove('invalid'); err.textContent = '';
    if (val && !/^[A-Za-z0-9_.-]{3,20}$/.test(val)) {
      input.classList.add('invalid');
      err.textContent = 'Use 3–20 letters, numbers, dots, dashes or underscores.';
      input.focus();
      return;
    }
    settings = { ...settings, username: val, email: $('#email').value, bio: $('#bio').value.trim() };
    write(SETTINGS_KEY, settings);
    applySettings();
    toast('Profile saved');
  });

  $('#prefForm').addEventListener('submit', (e) => {
    e.preventDefault();
    settings = {
      ...settings,
      hiddenNav: $$('#navChecks input').filter((c) => !c.checked).map((c) => c.value),
      rows: Number($('#rowsSel').value),
      notifyLow: $('#notifyLow').checked,
      notifyWeekly: $('#notifyWeekly').checked
    };
    write(SETTINGS_KEY, settings);
    applySettings();
    state.page = 1;
    renderTable();
    toast('Preferences saved');
  });
  $('#themeSel').addEventListener('change', (e) => setTheme(e.target.value));

  /* ===================== Init ===================== */
  applySettings();
  fillSettingsForm();
  renderAll();
  renderChart();
})();
