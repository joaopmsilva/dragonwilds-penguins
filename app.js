// KGP Field Guide: every penguin spawn spot on a zoomable map, with a per-browser "found" checklist.
(async () => {
  const DATA = await (await fetch('data/spots.json')).json();
  const REGION_COLOR = {
    'Brynmoor': '--r-brynmoor', 'Ghornfell': '--r-ghornfell', 'Fellhollow': '--r-fellhollow',
    'Scorned Wilderness': '--r-scorned', 'Dowdun Reach': '--r-dowdun', 'Umbral Sands': '--r-umbral',
  };
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const colorOf = r => css(REGION_COLOR[r]);
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fmt = n => n.toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const describe = s => (s.dir === 'at' ? 'At ' + s.near : fmt(s.m) + ' m ' + s.dir + ' of ' + s.near);
  const OFF_MAP = 'Scorned Wilderness'; // its own zone, not on the world map

  // ---- found checklist, kept in this browser only ----
  const KEY = 'kgp-found-v1';
  let found = new Set();
  try { found = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { /* private mode */ }
  const saveFound = () => { try { localStorage.setItem(KEY, JSON.stringify([...found])); } catch (e) { /* ignore */ } };

  // ---- state ----
  let region = 'all', disguise = 'all', hideFound = false, term = '', selected = null;

  // ---- views (#map / #guide, #spot-<id>, #<region>) ----
  const mapView = document.getElementById('mapview'), guideView = document.getElementById('guide');
  const viewLinks = document.querySelectorAll('.views a');
  function showView(name) {
    mapView.hidden = name !== 'map';
    guideView.hidden = name !== 'guide';
    viewLinks.forEach(a => { if (a.dataset.view === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (name === 'map') setTimeout(() => map.invalidateSize(), 0);
  }

  // ---- map ----
  // The wiki's map projection: game units, x east, y south. See dragonwilds.runescape.wiki maps gadget.
  const mult = 6144 / 420000 / 16, offX = 11075, offY = 117685;
  const crs = L.extend({}, L.CRS.Simple, {
    projection: L.Projection.LonLat,
    transformation: new L.Transformation(mult, mult * offX, mult, mult * offY),
  });
  const bounds = L.latLngBounds([[-offY, -offX], [420000 - offY, 420000 - offX]]);
  const map = L.map('map', { crs, maxBounds: bounds.pad(0.1), minZoom: 0, maxZoom: 6, zoomSnap: 1, zoomDelta: 1, attributionControl: false });
  L.tileLayer('tiles/{z}/{x}_{y}.png', { minNativeZoom: 0, maxNativeZoom: 4, maxZoom: 6, bounds, noWrap: true }).addTo(map);
  map.fitBounds(L.latLngBounds([[-80000, 0], [255000, 395000]]));
  const ll = s => L.latLng(s.y, s.x);

  // Place names from the in-game map, shown once zoomed in a little.
  const labels = L.layerGroup(DATA.places.map(p => L.marker([p.y, p.x], {
    interactive: false, keyboard: false,
    icon: L.divIcon({ className: '', html: '<div class="place-label">' + esc(p.name) + '</div>', iconSize: [0, 0] }),
  })));
  const syncLabels = () => (map.getZoom() >= 2 ? labels.addTo(map) : labels.remove());
  map.on('zoomend', syncLabels); syncLabels();

  // The shop.
  L.marker([DATA.shop.y, DATA.shop.x], {
    icon: L.divIcon({ className: '', html: '<div class="shop-icon"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
    title: "Façade's Front, the penguin shop",
  }).addTo(map).bindPopup('<div class="pop"><h3>Façade\'s Front</h3><div class="sub">The penguin shop · Adventurer\'s Guild ruins</div>Talk to the door (Fishy Façade). Any answer to its password question works. Trade Penguin Coins here.<div class="acts"><button data-act="guide">Open the quest guide</button></div></div>');

  const markers = new Map();
  for (const s of DATA.spots) {
    if (s.r === OFF_MAP) continue;
    const m = L.circleMarker(ll(s), { radius: 7, weight: 2, color: '#fff', fillOpacity: 0.95 });
    m.on('click', () => select(s, false));
    m.bindPopup(() => popupHtml(s), { autoPan: true });
    markers.set(s.id, m);
  }
  function styleMarker(s) {
    const m = markers.get(s.id);
    if (!m) return;
    const isFound = found.has(s.id);
    m.setStyle({ fillColor: isFound ? css('--found') : colorOf(s.r), fillOpacity: isFound ? 0.6 : 0.95, radius: selected === s ? 10 : 7 });
  }
  function popupHtml(s) {
    const isFound = found.has(s.id);
    return '<div class="pop"><h3>' + esc(s.r) + ' #' + s.n + '</h3>' +
      '<div class="sub">' + esc(describe(s)) + '</div>' +
      'Disguise: <b>' + esc(s.dis) + '</b>' +
      '<div class="acts"><button class="' + (isFound ? '' : 'primary') + '" data-act="found" data-id="' + s.id + '">' + (isFound ? 'Not found yet' : 'Mark as found') + '</button>' +
      '<button data-act="link" data-id="' + s.id + '">Copy link</button></div></div>';
  }
  map.on('popupopen', e => {
    e.popup.getElement().addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'found') { toggleFound(b.dataset.id); e.popup.setContent(popupHtml(spotById(b.dataset.id))); }
      if (b.dataset.act === 'link') copyLink(b.dataset.id, b);
      if (b.dataset.act === 'guide') location.hash = 'guide';
    });
  });

  // ---- Scorned Wilderness inset (it isn't on the world map) ----
  const inset = document.getElementById('inset'), insetSvg = document.getElementById('insetSvg');
  function drawInset() {
    const spots = DATA.spots.filter(s => s.r === OFF_MAP && visible(s));
    const all = DATA.spots.filter(s => s.r === OFF_MAP);
    const xs = all.map(s => s.x), ys = all.map(s => s.y);
    const pad = 3000, minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
    const w = Math.max(...xs) - minX + pad, h = Math.max(...ys) - minY + pad, u = Math.max(w, h) / 100;
    insetSvg.setAttribute('viewBox', minX + ' ' + minY + ' ' + w + ' ' + h);
    insetSvg.innerHTML = spots.map(s => '<circle class="pin" data-id="' + s.id + '" cx="' + s.x + '" cy="' + s.y + '" r="' + u * (selected === s ? 1.8 : 1.2) +
      '" stroke-width="' + u * 0.35 + '" fill="' + (found.has(s.id) ? css('--found') : colorOf(OFF_MAP)) + '"><title>#' + s.n + ' · ' + esc(describe(s)) + '</title></circle>').join('') +
      '<text x="' + (minX + w - u * 2) + '" y="' + (minY + u * 5) + '" font-size="' + u * 3.4 + '" text-anchor="end" fill="' + css('--muted') + '" font-family="IBM Plex Mono, monospace">N ↑</text>';
  }
  insetSvg.addEventListener('click', e => { const id = e.target.closest('.pin')?.dataset.id; if (id) select(spotById(id), true); });

  // ---- filters ----
  const chips = document.getElementById('chips');
  const regionsAll = ['all', ...DATA.regions];
  for (const r of regionsAll) {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.dataset.region = r;
    const n = r === 'all' ? DATA.spots.length : DATA.spots.filter(s => s.r === r).length;
    b.innerHTML = (r === 'all' ? '' : '<span class="sw" style="background:var(' + REGION_COLOR[r] + ')"></span>') + esc(r === 'all' ? 'All regions' : r) + ' <span class="n">' + n + '</span>';
    b.addEventListener('click', () => { location.hash = r === 'all' ? 'map' : slug(r); });
    chips.appendChild(b);
  }
  const dsel = document.getElementById('disguise');
  for (const d of [...new Set(DATA.spots.map(s => s.dis))].sort()) dsel.add(new Option(d[0].toUpperCase() + d.slice(1), d));
  dsel.addEventListener('change', () => { disguise = dsel.value; render(); });
  document.getElementById('q').addEventListener('input', e => { term = e.target.value.trim().toLowerCase(); render(); });
  document.getElementById('hideFound').addEventListener('change', e => { hideFound = e.target.checked; render(); });

  const resetBtn = document.getElementById('reset'), confirmBox = document.getElementById('confirm');
  resetBtn.addEventListener('click', () => { confirmBox.hidden = false; });
  document.getElementById('confirmYes').addEventListener('click', () => { found.clear(); saveFound(); confirmBox.hidden = true; render(); });
  document.getElementById('confirmNo').addEventListener('click', () => { confirmBox.hidden = true; });

  const visible = s => (region === 'all' || s.r === region) && (disguise === 'all' || s.dis === disguise) &&
    (!hideFound || !found.has(s.id)) && (!term || describe(s).toLowerCase().includes(term) || s.r.toLowerCase().includes(term));
  const spotById = id => DATA.spots.find(s => s.id === id);

  // ---- list ----
  const list = document.getElementById('list');
  function render() {
    chips.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.region === region)));
    const shown = DATA.spots.filter(visible);
    document.getElementById('count').textContent = shown.length + ' shown';
    document.getElementById('progress').innerHTML = '<b>' + found.size + '</b> / ' + DATA.spots.length + ' found';
    resetBtn.hidden = found.size === 0;

    let html = '', last = '';
    for (const s of shown) {
      if (s.r !== last) {
        last = s.r;
        const done = DATA.spots.filter(x => x.r === s.r && found.has(x.id)).length, total = DATA.spots.filter(x => x.r === s.r).length;
        html += '<li class="group"><span class="sw" style="background:var(' + REGION_COLOR[s.r] + ')"></span>' + esc(s.r) + ' <span class="count">' + done + ' / ' + total + ' found</span></li>';
      }
      const isFound = found.has(s.id);
      html += '<li class="spot' + (isFound ? ' found' : '') + (selected === s ? ' on' : '') + '" data-id="' + s.id + '" tabindex="0">' +
        '<input type="checkbox" aria-label="Found #' + s.n + '"' + (isFound ? ' checked' : '') + '>' +
        '<span class="num">#' + s.n + '</span><span class="where">' + esc(describe(s)) + '</span>' +
        '<span class="meta"><span class="tag' + (s.dis === 'box, pot, barrel or sack' ? '' : ' special') + '">' + esc(s.dis) + '</span>' +
        (s.r === OFF_MAP ? '<span>own zone, shown in the Scorned Wilderness view</span>' : '') + '</span></li>';
    }
    list.innerHTML = html || '<li class="empty">No spots match these filters.</li>';

    for (const s of DATA.spots) {
      const m = markers.get(s.id);
      if (!m) continue;
      if (visible(s)) { m.addTo(map); styleMarker(s); } else m.remove();
    }
    inset.hidden = region !== OFF_MAP;
    if (region === OFF_MAP) drawInset();
  }
  list.addEventListener('click', e => {
    const li = e.target.closest('.spot');
    if (!li) return;
    if (e.target.matches('input')) { toggleFound(li.dataset.id); return; }
    select(spotById(li.dataset.id), true);
  });
  list.addEventListener('keydown', e => {
    const li = e.target.closest('.spot');
    if (li && (e.key === 'Enter' || e.key === ' ') && !e.target.matches('input')) { e.preventDefault(); select(spotById(li.dataset.id), true); }
  });

  function toggleFound(id) {
    if (found.has(id)) found.delete(id); else found.add(id);
    saveFound();
    render();
  }

  function select(s, fly) {
    const prev = selected;
    selected = s;
    if (prev) styleMarker(prev);
    if (s.r === OFF_MAP) {
      if (region !== OFF_MAP && region !== 'all') location.hash = slug(OFF_MAP);
      else if (region === 'all') { region = OFF_MAP; render(); }
      drawInset();
    } else {
      if (region === OFF_MAP) { region = 'all'; render(); }
      styleMarker(s);
      const m = markers.get(s.id);
      if (fly && m) { map.flyTo(ll(s), Math.max(map.getZoom(), 4), { duration: 0.6 }); setTimeout(() => m.openPopup(), 650); }
      else if (m) m.openPopup();
    }
    list.querySelectorAll('.spot.on').forEach(el => el.classList.remove('on'));
    const li = list.querySelector('[data-id="' + s.id + '"]');
    if (li) { li.classList.add('on'); if (!fly) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }

  function copyLink(id, btn) {
    const url = location.origin + location.pathname + '#spot-' + id;
    const done = () => { btn.textContent = 'Link copied'; };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt('Copy this link', url));
    else prompt('Copy this link', url);
  }

  // ---- routing ----
  function route() {
    const h = location.hash.slice(1);
    if (h === 'guide') { showView('guide'); return; }
    showView('map');
    if (h.startsWith('spot-')) {
      const s = spotById(h.slice(5));
      if (s) { region = 'all'; render(); select(s, true); return; }
    }
    if (h === 'shop') { region = 'all'; render(); map.flyTo([DATA.shop.y, DATA.shop.x], 5, { duration: 0.6 }); return; }
    const r = DATA.regions.find(x => slug(x) === h);
    region = r || 'all';
    render();
    if (r && r !== OFF_MAP) {
      const pts = DATA.spots.filter(s => s.r === r).map(ll);
      map.flyToBounds(L.latLngBounds(pts).pad(0.15), { duration: 0.6 });
    }
  }
  window.addEventListener('hashchange', route);
  document.querySelectorAll('[data-goto]').forEach(a => a.addEventListener('click', () => { location.hash = a.dataset.goto; }));
  route();
})();
