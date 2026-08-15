/* Inventory page: client-side place filter — the profile pilot.
   No login, no backend: the profile lives in localStorage. */
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

(function () {
  const chips = Array.from(document.querySelectorAll('.chip'));
  const places = Array.from(document.querySelectorAll('.place'));
  const count = document.getElementById('fcount');
  const empty = document.getElementById('empty');
  const reset = document.getElementById('freset');

  let state = { cat: [], need: [], int: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(CFG.storageKey));
    if (saved) state = Object.assign(state, saved);
  } catch (e) { /* fresh profile */ }

  function persist() { localStorage.setItem(CFG.storageKey, JSON.stringify(state)); }

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
    state = { cat: [], need: [], int: [] };
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
    return flags.includes(n); // veg, indoor, kids
  }

  function apply() {
    const kinds = new Set(state.cat.flatMap(c => CFG.groups[c] || []));
    let shown = 0;
    places.forEach(p => {
      const kind = p.dataset.kind;
      const flags = p.dataset.flags.split(' ').filter(Boolean);
      const ints = p.dataset.interests.split(' ').filter(Boolean);
      let ok = true;
      if (state.cat.length) ok = kinds.has(kind);
      if (ok && state.need.length) ok = state.need.every(n => needPass(n, kind, flags));
      if (ok && state.int.length && CFG.contentKinds.indexOf(kind) >= 0) {
        ok = ints.some(i => state.int.includes(i));
      }
      p.hidden = !ok;
      if (ok) shown++;
    });
    count.textContent = CFG.countTpl.replace('{n}', shown).replace('{t}', places.length);
    empty.hidden = shown > 0;
    reset.hidden = !(state.cat.length || state.need.length || state.int.length);
  }
  apply();
})();
