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
  };

  /* Returns null when the place matches the profile, else the reason —
     shown on the collapsed row. Nothing ever disappears from the list. */
  function judge(p, kinds) {
    const kind = p.dataset.kind;
    const flags = p.dataset.flags.split(' ').filter(Boolean);
    const ints = p.dataset.interests.split(' ').filter(Boolean);
    if (state.cat.length && !kinds.has(kind)) return 'andere Kategorie';
    for (const n of state.need) {
      if (!needPass(n, kind, flags)) return NEED_FAIL[n] || n;
    }
    if (state.int.length && CFG.contentKinds.indexOf(kind) >= 0
        && !ints.some(i => state.int.includes(i))) return 'anderes Interesse';
    if (state.comp.includes('dog') && p.dataset.dogs === 'no') return 'Hunde verboten';
    const bands = state.comp.filter(c => c !== 'dog').map(c => CFG.bands[c]);
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

  function apply() {
    const kinds = new Set(state.cat.flatMap(c => CFG.groups[c] || []));
    document.body.classList.toggle('has-dog', state.comp.includes('dog'));
    document.body.classList.toggle('has-kids', state.comp.some(c => c !== 'dog'));
    let shown = 0;
    places.forEach(p => {
      if (planOnly) {
        // the plan is an explicit selection — here hiding is the honest cut
        const inPlan = plan.includes(p.id.replace(/^poi-/, ''));
        p.hidden = !inPlan;
        p.classList.remove('collapsed', 'expanded');
        if (inPlan) shown++;
        return;
      }
      p.hidden = false;
      const why = judge(p, kinds);
      p.classList.toggle('collapsed', why !== null);
      if (why === null) {
        p.classList.remove('expanded');
        p.querySelector('.crow').setAttribute('aria-expanded', 'false');
        shown++;
      }
      p.querySelector('.crow-why').textContent = why || '';
    });
    const collapsed = planOnly ? 0 : places.length - shown;
    const base = planOnly
      ? `${shown} ${shown === 1 ? 'Ort' : 'Orte'} im Plan`
      : CFG.countTpl.replace('{n}', shown).replace('{t}', places.length)
        + (collapsed ? ' passen — Rest zusammengeklappt' : '');
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
    const mins = plan.reduce((s, id) => {
      const el = document.getElementById('poi-' + id);
      return s + (el && el.dataset.visit ? Number(el.dataset.visit) : 0);
    }, 0);
    barSummary.textContent = `${plan.length} ${plan.length === 1 ? 'Ort' : 'Orte'}` +
      (mins ? ` · ${fmtMin(mins)} vor Ort (ohne Wege)` : '');
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
      origOrder.forEach(el => list.appendChild(el));
      places.forEach(p => { p.querySelector('.pdist').hidden = true; });
      sorted = false;
      sortBtn.setAttribute('aria-pressed', 'false');
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
        list.appendChild(el);
        const dEl = el.querySelector('.pdist');
        dEl.textContent = isFinite(d) ? '📍 ' + fmtDist(d) : '';
        dEl.hidden = !isFinite(d);
      });
      sorted = true;
      sortBtn.setAttribute('aria-pressed', 'true');
    }, () => flash('Standort nicht freigegeben — Sortierung bleibt wie sie ist.'),
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  });

  updatePlanUI();
  apply();
})();
