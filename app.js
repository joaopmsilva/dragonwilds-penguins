// KGP Field Guide: every penguin spawn spot on a zoomable map, with a per-browser "found" checklist.
{
  // ---- the server-mod strip above the list: once closed, it stays closed ----
  const PROMO_KEY = 'kgp-promo-closed-v1';
  const promo = document.getElementById('promo');
  try { if (localStorage.getItem(PROMO_KEY)) promo.hidden = true; } catch (e) { /* private mode */ }
  document.getElementById('promoClose').addEventListener('click', () => {
    promo.hidden = true;
    try { localStorage.setItem(PROMO_KEY, '1'); } catch (e) { /* ignore */ }
  });
}

(async () => {
  const [DATA, ZONE] = await Promise.all([
    fetch('data/spots.json').then(r => r.json()),
    fetch('data/scorned.json').then(r => r.json()).catch(() => null),
  ]);
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
    if (name === 'map') setTimeout(() => { map.invalidateSize(); if (!inset.hidden) showScorned(); }, 0);
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
  }).addTo(map).bindPopup('<div class="pop"><h3>Façade\'s Front</h3><div class="sub">The penguin shop · Adventurer\'s Guild ruins</div>Talk to the door (Fishy Façade). Any answer to its password question works. Trade Penguin Coins here.<div class="xy">X ' + fmt(DATA.shop.x) + ' · Y ' + fmt(DATA.shop.y) + ' · Z ' + fmt(DATA.shop.z || 0) + '</div><div class="acts"><button data-act="guide">Open the quest guide</button></div></div>');

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
  // The game's world coordinates (centimetres), the same units the wiki's map uses.
  const coords = s => 'X ' + fmt(s.x) + ' · Y ' + fmt(s.y) + ' · Z ' + fmt(s.z);
  function popupHtml(s) {
    const isFound = found.has(s.id);
    return '<div class="pop"><h3>' + esc(s.r) + ' #' + s.n + '</h3>' +
      '<div class="sub">' + esc(describe(s)) + '</div>' +
      'Disguise: <b>' + esc(s.dis) + '</b>' +
      '<div class="xy">' + coords(s) + '</div>' +
      '<div class="acts"><button class="' + (isFound ? '' : 'primary') + '" data-act="found" data-id="' + s.id + '">' + (isFound ? 'Not found yet' : 'Mark as found') + '</button>' +
      '<button data-act="link" data-id="' + s.id + '">Copy link</button></div></div>';
  }
  map.on('popupopen', e => onPopup(e));
  function onPopup(e) {
    e.popup.getElement().addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'found') { toggleFound(b.dataset.id); e.popup.setContent(popupHtml(spotById(b.dataset.id))); }
      if (b.dataset.act === 'link') copyLink(b.dataset.id, b);
      if (b.dataset.act === 'guide') location.hash = 'guide';
    });
  }

  // ---- Scorned Wilderness (it isn't on the world map) ----
  const inset = document.getElementById('inset');
  // The game has no map picture for the zone, so it is drawn from the game's own data: the
  // zone's outline and Rasthin's Rest (its map regions), Kuldra's tower, and a 100 m grid.
  // It is built the first time it is shown: Leaflet places shapes wrongly in a hidden container.
  const scorned = DATA.spots.filter(s => s.r === OFF_MAP);
  const outline = ZONE ? ZONE.outline.map(([x, y]) => L.latLng(y, x)) : null;
  const sb = outline ? L.latLngBounds(outline) : L.latLngBounds(scorned.map(ll));
  let smap = null;
  for (const s of scorned) {
    const m = L.circleMarker(ll(s), { radius: 7, weight: 2, color: '#fff', fillOpacity: 0.95 });
    m.on('click', () => select(s, false));
    m.bindPopup(() => popupHtml(s), { autoPan: true });
    markers.set(s.id, m);
  }
  function showScorned() {
    if (inset.hidden) return;
    if (smap) { smap.invalidateSize(); return; }
    smap = L.map('smap', { crs, minZoom: 1, maxZoom: 7, zoomSnap: 1, attributionControl: false, maxBounds: sb.pad(0.6) });
    smap.fitBounds(sb.pad(0.06));
    const label = (at, text, cls) => L.marker(at, { interactive: false, keyboard: false, icon: L.divIcon({ className: '', html: '<div class="' + cls + '">' + esc(text) + '</div>', iconSize: [0, 0] }) }).addTo(smap);
    if (outline) {
      // The land, painted like the world map's art: ash and stone with glowing cracks, drawn
      // by the browser (an SVG filter clipped to the zone's outline), since the game has no picture.
      const land = L.polygon(outline, { stroke: false, fillColor: '#857a6b', fillOpacity: 1, interactive: false }).addTo(smap);
      const svg = land._path && land._path.ownerSVGElement;
      if (svg && !svg.querySelector('#pg-scorch')) {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML =
          '<filter id="pg-scorch" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">' +
            '<feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="5" seed="4" result="n"/>' +
            '<feColorMatrix in="n" type="matrix" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1" result="g"/>' +
            '<feComponentTransfer in="g" result="g2"><feFuncR type="linear" slope="2.2" intercept="-0.6"/><feFuncG type="linear" slope="2.2" intercept="-0.6"/><feFuncB type="linear" slope="2.2" intercept="-0.6"/></feComponentTransfer>' +
            '<feComponentTransfer in="g2" result="land"><feFuncR type="table" tableValues="0.27 0.40 0.50 0.58 0.68"/><feFuncG type="table" tableValues="0.23 0.35 0.44 0.52 0.61"/><feFuncB type="table" tableValues="0.20 0.30 0.38 0.44 0.52"/></feComponentTransfer>' +
            '<feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="3" seed="9" result="t"/>' +
            '<feColorMatrix in="t" type="matrix" values="0 0 0 0 0.9 0 0 0 0 0.36 0 0 0 0 0.12 -6 0 0 0 0.5" result="veins"/>' +
            '<feGaussianBlur in="veins" stdDeviation="3" result="glow"/>' +
            '<feComponentTransfer in="glow" result="glow2"><feFuncA type="linear" slope="0.8"/></feComponentTransfer>' +
            '<feMerge result="tex"><feMergeNode in="land"/><feMergeNode in="glow2"/><feMergeNode in="veins"/></feMerge>' +
            '<feComposite in="tex" in2="SourceGraphic" operator="in"/>' +
          '</filter>';
        svg.insertBefore(defs, svg.firstChild);
      }
      if (land._path) land._path.setAttribute('filter', 'url(#pg-scorch)');
      // The coast: a soft shadow, then a crisp edge.
      L.polygon(outline, { color: '#1d1915', weight: 12, opacity: 0.35, fill: false, interactive: false }).addTo(smap);
      L.polygon(outline, { color: '#2b2622', weight: 2.5, fill: false, interactive: false }).addTo(smap);
    }
    const grid = [];
    const g0x = Math.floor(sb.getWest() / 10000) * 10000, g1x = Math.ceil(sb.getEast() / 10000) * 10000;
    const g0y = Math.floor(sb.getSouth() / 10000) * 10000, g1y = Math.ceil(sb.getNorth() / 10000) * 10000;
    for (let x = g0x; x <= g1x; x += 10000) grid.push([[g0y, x], [g1y, x]]);
    for (let y = g0y; y <= g1y; y += 10000) grid.push([[y, g0x], [y, g1x]]);
    L.polyline(grid, { color: '#2b2622', weight: 1, opacity: 0.18, interactive: false }).addTo(smap);
    if (ZONE) {
      for (const a of ZONE.areas) {
        const poly = a.outline.map(([x, y]) => L.latLng(y, x));
        L.polygon(poly, { color: '#f1e6cf', weight: 2, dashArray: '6 6', fillColor: '#a39377', fillOpacity: 0.55, interactive: false }).addTo(smap);
        const b = L.latLngBounds(poly);
        label(L.latLng(b.getSouth() + 3500, b.getCenter().lng), a.name, 'place-label'); // near its top edge
      }
      for (const lm of ZONE.landmarks) {
        L.circleMarker([lm.y, lm.x], { radius: 5, color: '#2b2622', weight: 2, fillColor: '#f1e6cf', fillOpacity: 1, interactive: false }).addTo(smap);
        label(L.latLng(lm.y, lm.x), lm.name, 'landmark-label');
      }
    }
    // Larger y is further south (lower on screen), so getNorth() is the zone's bottom edge here.
    label(outline ? L.latLng(sb.getNorth() + 7000, sb.getCenter().lng) : sb.getCenter(), 'Scorned Wilderness', 'zone-title');
    smap.on('popupopen', e => onPopup(e));
    for (const s of scorned) if (visible(s)) { markers.get(s.id).addTo(smap); styleMarker(s); }
  }

  // On the world map, the zone is painted as the island west of the continent: a button there opens it.
  L.marker([-12100, -1500], {
    title: 'Scorned Wilderness: 47 spots',
    icon: L.divIcon({ className: '', html: '<button class="zone-badge" type="button">Scorned Wilderness · 47 spots</button>', iconSize: [0, 0] }),
  }).addTo(map).on('click', () => { location.hash = slug(OFF_MAP); });

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
        '<span class="xy">' + coords(s) + '</span>' +
        (s.r === OFF_MAP && region !== OFF_MAP ? '<span>own zone: pick Scorned Wilderness to see it</span>' : '') + '</span></li>';
    }
    list.innerHTML = html || '<li class="empty">No spots match these filters.</li>';

    for (const s of DATA.spots) {
      const m = markers.get(s.id);
      if (!m) continue;
      const on = s.r === OFF_MAP ? smap : map;
      if (visible(s) && on) { m.addTo(on); styleMarker(s); } else m.remove();
    }
    const showZone = region === OFF_MAP;
    if (inset.hidden === showZone) { inset.hidden = !showZone; if (showZone) showScorned(); }
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
    const zone = s.r === OFF_MAP;
    if (zone && region !== OFF_MAP) { region = OFF_MAP; render(); }
    if (!zone && region === OFF_MAP) { region = 'all'; render(); }
    styleMarker(s);
    const m = markers.get(s.id), on = zone ? smap : map;
    if (fly && m && on) {
      on.flyTo(ll(s), Math.max(on.getZoom(), 4), { duration: 0.6 });
      setTimeout(() => m.openPopup(), 650);
    } else if (m && on) m.openPopup();
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
  // How many open the quest guide (the page view itself is counted on load).
  // The counter script loads after this one, so a page opened straight on #guide waits for it.
  let guideCounted = false, guideTries = 0;
  function countGuide() {
    if (guideCounted) return;
    if (!window.goatcounter || !window.goatcounter.count) { if (guideTries++ < 20) setTimeout(countGuide, 500); return; }
    guideCounted = true;
    window.goatcounter.count({ path: 'view-quest-guide', title: 'Opened the quest guide', event: true });
  }
  function route() {
    const h = location.hash.slice(1);
    if (h === 'guide') countGuide();
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
