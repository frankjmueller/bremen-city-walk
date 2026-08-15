/* Inventory page: client-side place filter — the profile pilot.
   No login, no backend: profile and day plan live in localStorage,
   sharing is a URL the group passes around. */
const CFG = __CFG__;

/* ————— offline: same service worker & cache as the Bremen pages ————— */
(function () {
  const statusEl = document.getElementById('status');
  const textEl = document.getElementById('status-text');
  function setStatus(ready, text) {
    statusEl.classList.toggle('ready', ready);
    textEl.textContent = text;
  }
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
    setStatus(false, 'Offline-Speichern hier nicht verfügbar');
    return;
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.update();
    setStatus(false, 'Wird für offline gespeichert…');
    let tries = 0;
    const poll = setInterval(() => {
      tries++;
      navigator.serviceWorker.ready.then(r => {
        const sw = r.active;
        if (!sw) return;
        const ch = new MessageChannel();
        ch.port1.onmessage = e => {
          const { cached, total, missing, settled } = e.data;
          if (cached >= total) {
            clearInterval(poll);
            setStatus(true, 'Offline bereit ✓');
          } else if (settled && missing > 0) {
            clearInterval(poll);
            setStatus(false, `Offline unvollständig — ${missing} Dateien fehlen`);
          } else {
            setStatus(false, `Wird gespeichert… ${cached}/${total}`);
          }
        };
        sw.postMessage({ type: 'STATUS' }, [ch.port2]);
      });
      if (tries > 240) clearInterval(poll);
    }, 800);
  }).catch(() => setStatus(false, 'Offline-Speichern nicht verfügbar'));
})();

/* ————— profile, filters, day plan, nearby sort ————— */
(function () {
  const chips = Array.from(document.querySelectorAll('.chip'));
  const places = Array.from(document.querySelectorAll('.place'));
  const list = document.getElementById('places');
  const origOrder = places.slice();
  const count = document.getElementById('fcount');
  const empty = document.getElementById('empty');
  const reset = document.getElementById('freset');
  const sortBtn = document.getElementById('fsort');
  const bar = document.getElementById('planbar');
  const barSummary = document.getElementById('plan-summary');
  const planOnlyBtn = document.getElementById('plan-only');

  let state = { cat: [], need: [], int: [], comp: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(CFG.storageKey));
    if (saved) state = Object.assign(state, saved);
  } catch (e) { /* fresh profile */ }
  state.comp = state.comp || [];
  let plan = [];
  try { plan = JSON.parse(localStorage.getItem(CFG.planKey)) || []; } catch (e) { /* fresh plan */ }
  plan = plan.filter(id => document.getElementById('poi-' + id));
  let planOnly = false;

  let flashTimer = null;
  function flash(text) {
    count.textContent = text;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { count.textContent = count.dataset.base || ''; }, 5000);
  }

  // adopt a shared day plan from the URL: ?plan=id1,id2
  const params = new URLSearchParams(location.search);
  if (params.has('plan')) {
    plan = params.get('plan').split(',').filter(id => document.getElementById('poi-' + id));
    localStorage.setItem(CFG.planKey, JSON.stringify(plan));
    history.replaceState(null, '', location.pathname + location.hash);
    setTimeout(() => flash('Geteilter Tagesplan übernommen ✓'), 100);
  }

  function persist() { localStorage.setItem(CFG.storageKey, JSON.stringify(state)); }
  function persistPlan() { localStorage.setItem(CFG.planKey, JSON.stringify(plan)); }

  chips.forEach(ch => {
    const g = ch.dataset.g, v = ch.dataset.v;
    ch.setAttribute('aria-pressed', String(state[g].includes(v)));
    ch.addEventListener('click', () => {
      const i = state[g].indexOf(v);
      if (i >= 0) state[g].splice(i, 1); else state[g].push(v);
      ch.setAttribute('aria-pressed', String(state[g].includes(v)));
      persist();
      apply();
    });
  });

  reset.addEventListener('click', () => {
    state = { cat: [], need: [], int: [], comp: [] };
    persist();
    chips.forEach(ch => ch.setAttribute('aria-pressed', 'false'));
    apply();
  });

  /* Scoped semantics: AND across criteria, OR within one — but every
     criterion only judges places it is meaningful for. The profile
     describes the person; a place outside a criterion's scope passes it
     vacuously ("vegetarisch + Geschichte" keeps both the veggie
     restaurant AND the history museum). Categories stay a hard cut. */
  function needPass(n, kind, flags) {
    const scope = CFG.needScope[n];
    if (scope && scope.indexOf(kind) < 0) return true; // not this place's question
    if (n === 'shade') return flags.includes('shade') || flags.includes('indoor');
    if (n === 'free') return !flags.includes('paid'); // unknown price stays (draft honesty)
    return flags.includes(n); // veg, indoor
  }

  /* Companions (kids by age, dog) travel with you all day — they must
     never empty the list over missing data. Only known conflicts count
     against a place; known info is surfaced on the cards instead. */
  const NEED_FAIL = {
    shade: 'kein Schatten bekannt', indoor: 'nicht drinnen',
    veg: 'kein vegetarisches Angebot bekannt', free: 'kostenpflichtig',
    open: 'gerade geschlossen',
  };

  /* Offline opening-hours evaluation: parses the OSM subset used in the
     data ("Mo-Fr 09:00-17:00; Sa 10:00-17:00", "24/7"). Unknown or
     unparsable hours never count against a place — draft honesty. */
  const OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const JS_DAY = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
  const hoursCache = new Map();
  function parseHours(spec) {
    if (!spec) return null;
    if (spec.trim() === '24/7') return 'always';
    const rules = [];
    for (const part of spec.split(';')) {
      const m = /^([A-Za-z,\- ]+?)\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(part.trim());
      if (!m) return null;
      const days = new Set();
      for (const tok of m[1].split(',')) {
        const r = /^([A-Za-z]{2})-([A-Za-z]{2})$/.exec(tok.trim());
        if (r) {
          const a = OSM_DAYS.indexOf(r[1]), b = OSM_DAYS.indexOf(r[2]);
          if (a < 0 || b < 0) return null;
          for (let i = a; ; i = (i + 1) % 7) { days.add(JS_DAY[OSM_DAYS[i]]); if (i === b) break; }
        } else {
          if (JS_DAY[tok.trim()] === undefined) return null;
          days.add(JS_DAY[tok.trim()]);
        }
      }
      rules.push({ days, from: +m[2] * 60 + +m[3], to: +m[4] * 60 + +m[5] });
    }
    return rules.length ? rules : null;
  }
  function openNow(p) { // null = unknown; else {open, until}
    if (!hoursCache.has(p.id)) hoursCache.set(p.id, parseHours(p.dataset.hours));
    const rules = hoursCache.get(p.id);
    if (!rules) return null;
    if (rules === 'always') return { open: true, until: null };
    const d = new Date();
    const day = d.getDay(), mins = d.getHours() * 60 + d.getMinutes();
    for (const r of rules) {
      if (r.days.has(day) && mins >= r.from && mins < r.to) {
        const pad = n => String(n).padStart(2, '0');
        return { open: true, until: `${pad(Math.floor(r.to / 60))}:${pad(r.to % 60)}` };
      }
    }
    return { open: false, until: null };
  }

  /* Returns null when the place matches the profile, else the reason —
     shown on the collapsed row. Nothing ever disappears from the list. */
  function judge(p, kinds) {
    const kind = p.dataset.kind;
    const flags = p.dataset.flags.split(' ').filter(Boolean);
    const ints = p.dataset.interests.split(' ').filter(Boolean);
    if (state.cat.length && !kinds.has(kind)) return 'andere Kategorie';
    for (const n of state.need) {
      if (n === 'open') {
        const st = openNow(p);
        if (st && !st.open) return NEED_FAIL.open; // unknown hours pass
        continue;
      }
      if (!needPass(n, kind, flags)) return NEED_FAIL[n] || n;
    }
    if (state.int.length && CFG.contentKinds.indexOf(kind) >= 0
        && !ints.some(i => state.int.includes(i))) return 'anderes Interesse';
    if (state.comp.includes('dog') && p.dataset.dogs === 'no') return 'Hunde verboten';
    if (state.comp.includes('wheel') && p.dataset.wheelchair === 'no') return 'nicht rollstuhlgerecht';
    const bands = state.comp.filter(c => c !== 'dog' && c !== 'wheel').map(c => CFG.bands[c]);
    if (bands.length) {
      const oldest = Math.max(...bands.map(b => b[1]));
      const youngest = Math.min(...bands.map(b => b[0]));
      if (p.dataset.kidsmin !== undefined && Number(p.dataset.kidsmin) > oldest) {
        return `erst ab ${p.dataset.kidsmin} Jahren`;
      }
      if (p.dataset.kidsmax !== undefined && Number(p.dataset.kidsmax) < youngest) {
        return `nur bis ${p.dataset.kidsmax} Jahre`;
      }
    }
    return null;
  }

  const csep = document.getElementById('csep');
  let order = origOrder.slice(); // current display order (nearby sort swaps it)

  function apply() {
    const kinds = new Set(state.cat.flatMap(c => CFG.groups[c] || []));
    document.body.classList.toggle('has-dog', state.comp.includes('dog'));
    document.body.classList.toggle('has-wheel', state.comp.includes('wheel'));
    document.body.classList.toggle('has-kids', state.comp.some(c => c !== 'dog' && c !== 'wheel'));
    let shown = 0;
    const matching = [], folded = [];
    order.forEach(p => {
      // live open/closed line, evaluated offline from the stated hours
      const st = openNow(p);
      const po = p.querySelector('.popen');
      if (st) {
        po.hidden = false;
        po.className = 'popen ' + (st.open ? 'open' : 'closed');
        po.textContent = st.open
          ? '🕐 Jetzt geöffnet' + (st.until ? ' · bis ' + st.until : '')
          : '🕐 Jetzt geschlossen';
      } else {
        po.hidden = true;
      }
      if (planOnly) {
        // the plan is an explicit selection — here hiding is the honest cut
        const inPlan = plan.includes(p.id.replace(/^poi-/, ''));
        p.hidden = !inPlan;
        p.classList.remove('collapsed', 'expanded');
        if (inPlan) shown++;
        matching.push(p);
        return;
      }
      p.hidden = false;
      const why = judge(p, kinds);
      p.classList.toggle('collapsed', why !== null);
      if (why === null) {
        p.classList.remove('expanded');
        p.querySelector('.crow').setAttribute('aria-expanded', 'false');
        shown++;
        matching.push(p);
      } else {
        folded.push(p);
      }
      p.querySelector('.crow-why').textContent = why || '';
    });
    // matching places first (in current order), collapsed ones behind a separator
    matching.forEach(p => list.appendChild(p));
    csep.hidden = planOnly || folded.length === 0;
    list.appendChild(csep);
    folded.forEach(p => list.appendChild(p));
    const base = planOnly
      ? `${shown} ${shown === 1 ? 'Ort' : 'Orte'} im Plan`
      : CFG.countTpl.replace('{n}', shown).replace('{t}', places.length)
        + (folded.length ? ' passen — Rest unten zusammengeklappt' : '');
    count.textContent = base;
    count.dataset.base = base;
    empty.hidden = true; // the list can never be empty anymore
    reset.hidden = !(state.cat.length || state.need.length || state.int.length || state.comp.length);
  }

  // a collapsed row expands on tap — the filter suggests, it never dictates
  places.forEach(p => {
    const crow = p.querySelector('.crow');
    crow.addEventListener('click', () => {
      const ex = p.classList.toggle('expanded');
      crow.setAttribute('aria-expanded', String(ex));
    });
  });

  /* ————— day plan: tap places together, see the time, share the link ————— */
  function fmtMin(m) {
    if (m >= 60) {
      const h = Math.floor(m / 60), r = m % 60;
      return r ? `~${h} h ${r} min` : `~${h} h`;
    }
    return `~${m} min`;
  }
  function updatePlanUI() {
    places.forEach(p => {
      const btn = p.querySelector('.padd');
      const active = plan.includes(p.id.replace(/^poi-/, ''));
      btn.setAttribute('aria-pressed', String(active));
      btn.textContent = active ? '✓ im Plan' : '➕ Plan';
    });
    bar.hidden = plan.length === 0;
    document.body.classList.toggle('has-plan', plan.length > 0);
    if (plan.length === 0 && planOnly) {
      planOnly = false;
      planOnlyBtn.setAttribute('aria-pressed', 'false');
    }
    let mins = 0, costSum = 0, costUnknown = 0;
    plan.forEach(id => {
      const el = document.getElementById('poi-' + id);
      if (!el) return;
      if (el.dataset.visit) mins += Number(el.dataset.visit);
      if (el.dataset.cost !== undefined) costSum += Number(el.dataset.cost);
      else costUnknown++;
    });
    // budget line: never claim more than the data knows
    let costTxt = '';
    if (plan.length && costUnknown < plan.length) {
      if (costSum > 0) costTxt = ` · ${costUnknown ? 'ab ' : ''}${costSum} ${CFG.currency}`;
      else if (!costUnknown) costTxt = ' · kostenlos';
    }
    barSummary.textContent = `${plan.length} ${plan.length === 1 ? 'Ort' : 'Orte'}` +
      (mins ? ` · ${fmtMin(mins)} vor Ort (ohne Wege)` : '') + costTxt;
  }
  places.forEach(p => {
    p.querySelector('.padd').addEventListener('click', () => {
      const id = p.id.replace(/^poi-/, '');
      const i = plan.indexOf(id);
      if (i >= 0) plan.splice(i, 1); else plan.push(id);
      persistPlan();
      updatePlanUI();
      if (planOnly) apply();
    });
  });
  planOnlyBtn.addEventListener('click', () => {
    planOnly = !planOnly;
    planOnlyBtn.setAttribute('aria-pressed', String(planOnly));
    apply();
  });
  document.getElementById('plan-share').addEventListener('click', () => {
    const url = location.origin + location.pathname + '?plan=' + plan.join(',');
    if (navigator.share) {
      navigator.share({ title: 'Windhoek — unser Tagesplan', url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => flash('Plan-Link kopiert — an die Gruppe schicken.'))
        .catch(() => {});
    }
  });
  document.getElementById('plan-clear').addEventListener('click', () => {
    plan = [];
    persistPlan();
    updatePlanUI();
    apply();
  });

  /* ————— nearby sort: GPS works offline; draft coords are approximate ————— */
  let sorted = false;
  function haversine(lat1, lng1, lat2, lng2) {
    const r = x => x * Math.PI / 180, R = 6371000;
    const h = Math.sin(r(lat2 - lat1) / 2) ** 2 +
      Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmtDist(m) {
    return m < 950 ? `≈ ${Math.max(50, Math.round(m / 50) * 50)} m`
      : `≈ ${(m / 1000).toFixed(1).replace('.', ',')} km`;
  }
  sortBtn.addEventListener('click', () => {
    if (sorted) {
      order = origOrder.slice();
      places.forEach(p => { p.querySelector('.pdist').hidden = true; });
      sorted = false;
      sortBtn.setAttribute('aria-pressed', 'false');
      apply();
      return;
    }
    if (!navigator.geolocation) { flash('Standort hier nicht verfügbar.'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      const withDist = places.map(p => ({
        el: p,
        d: p.dataset.lat
          ? haversine(latitude, longitude, Number(p.dataset.lat), Number(p.dataset.lng))
          : Infinity, // places without coordinates go last
      }));
      withDist.sort((a, b) => a.d - b.d);
      withDist.forEach(({ el, d }) => {
        const dEl = el.querySelector('.pdist');
        dEl.textContent = isFinite(d) ? '📍 ' + fmtDist(d) : '';
        dEl.hidden = !isFinite(d);
      });
      order = withDist.map(x => x.el);
      sorted = true;
      sortBtn.setAttribute('aria-pressed', 'true');
      apply(); // regroups: matching by distance first, collapsed behind the separator
    }, () => flash('Standort nicht freigegeben — Sortierung bleibt wie sie ist.'),
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  });

  // returning to the tab re-evaluates "Jetzt geöffnet"
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) apply();
  });

  updatePlanUI();
  apply();
})();

/* ————— private overlay: personal ratings/notes, device-only.
   Imported from a JSON file, stored in localStorage, never uploaded —
   the legal home for data you may use but must not republish. ————— */
(function () {
  const KEY = 'walk-overlay-' + CFG.cityId;
  const btn = document.getElementById('ovl-btn');
  const removeBtn = document.getElementById('ovl-remove');
  const file = document.getElementById('ovl-file');
  const status = document.getElementById('ovl-status');

  function render() {
    let ovl = null;
    try { ovl = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* none */ }
    document.querySelectorAll('.place').forEach(li => {
      const el = li.querySelector('.povl');
      const d = ovl && ovl.places && ovl.places[li.id.replace(/^poi-/, '')];
      if (!d) { el.hidden = true; return; }
      const parts = [];
      if (typeof d.rating === 'number') {
        parts.push('★ ' + d.rating.toLocaleString('de-DE')
          + (d.ratings ? ` (${d.ratings.toLocaleString('de-DE')})` : ''));
      }
      if (typeof d.myStars === 'number') {
        parts.push('meine: ' + '★'.repeat(d.myStars) + '☆'.repeat(Math.max(0, 5 - d.myStars)));
      }
      if (d.status) parts.push(d.status);
      if (d.note) parts.push(d.note);
      el.textContent = parts.length ? '🔒 ' + parts.join(' · ') : '';
      el.hidden = parts.length === 0;
    });
    const has = !!(ovl && ovl.places && Object.keys(ovl.places).length);
    removeBtn.hidden = !has;
    status.textContent = has
      ? `Overlay aktiv: ${Object.keys(ovl.places).length} Orte`
        + (ovl.updated ? `, Stand ${ovl.updated}` : '') + ' — nur auf diesem Gerät.'
      : '';
  }

  btn.addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const f = file.files[0];
    if (!f) return;
    f.text().then(t => {
      const ovl = JSON.parse(t);
      if (ovl.city && ovl.city !== CFG.cityId) {
        status.textContent = `Diese Datei ist für „${ovl.city}", nicht für diese Seite.`;
        return;
      }
      if (!ovl.places || typeof ovl.places !== 'object') throw new Error('places fehlt');
      localStorage.setItem(KEY, JSON.stringify(ovl));
      render();
    }).catch(() => {
      status.textContent = 'Datei nicht lesbar — erwartet JSON mit { "places": { "<orts-id>": { … } } }.';
    }).finally(() => { file.value = ''; });
  });
  removeBtn.addEventListener('click', () => {
    localStorage.removeItem(KEY);
    render();
  });

  render();
})();
