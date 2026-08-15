/* ————— device & family sync: the data travels INSIDE the link ————— */
/* No server, no account: plan, profile and private overlay are packed,
   compressed and put into the URL *fragment* (#s=…). Fragments are never
   sent to any server — not even to the static host — so this works for
   private data. The recipient gets a sheet and chooses what to adopt. */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const OVL_KEY = 'walk-overlay-' + CFG.cityId;

  /* ————— toast ————— */
  const toastEl = $('toast');
  let toastTimer = null;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('on');
      setTimeout(() => { toastEl.hidden = true; }, 250);
    }, 3500);
  }
  const pendingToast = sessionStorage.getItem('walk-toast');
  if (pendingToast) {
    sessionStorage.removeItem('walk-toast');
    setTimeout(() => toast(pendingToast), 400);
  }

  /* ————— bottom sheet ————— */
  const sheetWrap = $('sheet');
  const sheetBody = $('sheet-body');
  function openSheet(html) {
    sheetBody.innerHTML = html;
    sheetWrap.hidden = false;
    requestAnimationFrame(() => sheetWrap.classList.add('on'));
  }
  function closeSheet() {
    sheetWrap.classList.remove('on');
    setTimeout(() => { sheetWrap.hidden = true; sheetBody.innerHTML = ''; }, 200);
  }
  sheetWrap.addEventListener('click', e => { if (e.target === sheetWrap) closeSheet(); });

  /* ————— pack/unpack: deflate + base64url, plain fallback ————— */
  async function pack(obj) {
    let bytes = new TextEncoder().encode(JSON.stringify(obj));
    let mode = 'p';
    if (typeof CompressionStream === 'function') {
      const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      bytes = new Uint8Array(await new Response(cs).arrayBuffer());
      mode = 'z';
    }
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return mode + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function unpack(s) {
    const mode = s[0];
    const bin = atob(s.slice(1).replace(/-/g, '+').replace(/_/g, '/'));
    let bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    if (mode === 'z') {
      const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      bytes = new Uint8Array(await new Response(ds).arrayBuffer());
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  const load = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  function snapshot() {
    const plan = load(CFG.planKey) || [];
    const prof = load(CFG.storageKey) || {};
    const profN = ['cat', 'need', 'int', 'comp'].reduce((n, k) => n + ((prof[k] || []).length), 0);
    const ovl = load(OVL_KEY);
    const ovlN = ovl && ovl.places ? Object.keys(ovl.places).length : 0;
    return { plan, prof, profN, ovl, ovlN };
  }

  /* ————— sender ————— */
  let lastSel = null;
  async function buildLink(sel) {
    const { plan, prof, ovl } = snapshot();
    const payload = { v: 1, city: CFG.cityId };
    if (sel.plan) payload.plan = plan;
    if (sel.prof) payload.prof = prof;
    if (sel.ovl && ovl) payload.ovl = ovl;
    return location.origin + location.pathname + '#s=' + await pack(payload);
  }
  function qrFits(url) {
    try { const q = qrcode(0, 'L'); q.addData(url, 'Byte'); q.make(); return true; }
    catch (e) { return false; }
  }

  function senderSheet(presel) {
    lastSel = presel;
    const { plan, profN, ovlN } = snapshot();
    const row = (id, label, count, on, off) => `
      <label class="srow${off ? ' off' : ''}">
        <input type="checkbox" id="${id}" ${on && !off ? 'checked' : ''} ${off ? 'disabled' : ''}>
        <b>${label}</b><span>${count}</span>
      </label>`;
    openSheet(`
      <h3>🔄 Sync &amp; teilen</h3>
      <p class="sheet-sub">Der Link enthält die Daten selbst — kein Server, kein Konto.
      Wer den Link (oder QR) hat, hat die Daten.</p>
      ${row('s-plan', 'Tagesplan', plan.length ? plan.length + ' Orte' : 'leer', presel.plan, !plan.length)}
      ${row('s-prof', 'Filter-Profil', profN ? profN + ' aktiv' : 'leer', presel.prof, !profN)}
      ${row('s-ovl', 'Privates Overlay 🔒', ovlN ? ovlN + ' Orte' : 'keins', presel.ovl, !ovlN)}
      <p class="s-note" id="s-note"></p>
      <div class="sheet-actions">
        <button type="button" id="s-qr">📱 QR zeigen</button>
        <button type="button" id="s-link">🔗 Link teilen</button>
      </div>`);
    const note = $('s-note');
    const sel = () => ({
      plan: $('s-plan').checked, prof: $('s-prof').checked, ovl: $('s-ovl').checked,
    });
    async function refresh() {
      const s = sel();
      lastSel = s;
      if (!s.plan && !s.prof && !s.ovl) {
        note.textContent = 'Nichts ausgewählt.';
        $('s-qr').disabled = $('s-link').disabled = true;
        return;
      }
      const url = await buildLink(s);
      const kb = (url.length / 1024).toFixed(1).replace('.', ',');
      note.textContent = `Link: ~${kb} kB · ${qrFits(url) ? 'passt in einen QR-Code' : 'zu groß für QR — Link geht immer'}`;
      $('s-qr').disabled = !qrFits(url);
      $('s-link').disabled = false;
    }
    ['s-plan', 's-prof', 's-ovl'].forEach(id => $(id).addEventListener('change', refresh));
    refresh();
    $('s-link').addEventListener('click', async () => {
      const url = await buildLink(sel());
      if (navigator.share) {
        navigator.share({ title: CFG.shareTitle || document.title, url }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url)
          .then(() => toast('Link kopiert — einfach an Familie oder dich selbst schicken.'))
          .catch(() => {});
      }
    });
    $('s-qr').addEventListener('click', async () => qrSheet(await buildLink(sel())));
  }

  function qrSheet(url) {
    openSheet(`
      <h3>📱 Per QR aufs andere Gerät</h3>
      <div class="qrbox"><canvas id="qr-canvas"></canvas></div>
      <p class="sheet-sub">Mit der Kamera des anderen Geräts scannen. Der QR enthält
      die Daten selbst — es fließt nichts über einen Server.</p>
      <div class="sheet-actions"><button type="button" id="qr-back" class="ghost">Zurück</button></div>`);
    try {
      const qr = qrcode(0, 'L');
      qr.addData(url, 'Byte');
      qr.make();
      const n = qr.getModuleCount();
      const scale = Math.max(3, Math.floor(320 / n));
      const quiet = 4;
      const size = (n + quiet * 2) * scale;
      const cv = $('qr-canvas');
      cv.width = size; cv.height = size;
      const c2 = cv.getContext('2d');
      c2.fillStyle = '#fff'; c2.fillRect(0, 0, size, size);
      c2.fillStyle = '#000';
      for (let r = 0; r < n; r++) {
        for (let col = 0; col < n; col++) {
          if (qr.isDark(r, col)) c2.fillRect((col + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
      }
    } catch (e) {
      sheetBody.querySelector('.qrbox').textContent = 'Zu viele Daten für einen QR-Code — nutze „Link teilen".';
    }
    $('qr-back').addEventListener('click', () => senderSheet(lastSel || { plan: true, prof: true }));
  }

  /* ————— receiver ————— */
  function receiveSheet(p) {
    const rows = [];
    if (Array.isArray(p.plan)) rows.push(['r-plan', 'Tagesplan', `${p.plan.length} Orte`]);
    if (p.prof) {
      const n = ['cat', 'need', 'int', 'comp'].reduce((s, k) => s + ((p.prof[k] || []).length), 0);
      rows.push(['r-prof', 'Filter-Profil', `${n} aktiv`]);
    }
    if (p.ovl && p.ovl.places) rows.push(['r-ovl', 'Privates Overlay 🔒', `${Object.keys(p.ovl.places).length} Orte`]);
    if (!rows.length) { toast('Der Sync-Link war leer.'); return; }
    openSheet(`
      <h3>🔄 Sync empfangen</h3>
      <p class="sheet-sub">Von einem anderen Gerät geteilt — wähle, was du übernehmen willst.
      Overlay-Einträge werden mit deinen zusammengeführt, nichts geht verloren.</p>
      ${rows.map(([id, label, count]) => `
      <label class="srow"><input type="checkbox" id="${id}" checked><b>${label}</b><span>${count}</span></label>`).join('')}
      <div class="sheet-actions">
        <button type="button" id="r-skip" class="ghost">Ignorieren</button>
        <button type="button" id="r-ok">Übernehmen</button>
      </div>`);
    $('r-skip').addEventListener('click', () => {
      history.replaceState(null, '', location.pathname);
      closeSheet();
    });
    $('r-ok').addEventListener('click', () => {
      const took = [];
      if ($('r-plan') && $('r-plan').checked) {
        localStorage.setItem(CFG.planKey, JSON.stringify(p.plan));
        took.push('Tagesplan');
      }
      if ($('r-prof') && $('r-prof').checked) {
        localStorage.setItem(CFG.storageKey, JSON.stringify(p.prof));
        took.push('Profil');
      }
      if ($('r-ovl') && $('r-ovl').checked) {
        const mine = load(OVL_KEY) || { city: CFG.cityId, places: {} };
        const places = { ...(mine.places || {}) };
        for (const [id, d] of Object.entries(p.ovl.places)) {
          places[id] = { ...(places[id] || {}), ...d }; // incoming wins per field
        }
        localStorage.setItem(OVL_KEY, JSON.stringify({ ...mine, ...p.ovl, places }));
        took.push('Overlay');
      }
      sessionStorage.setItem('walk-toast', 'Übernommen ✓ ' + took.join(' · '));
      location.replace(location.pathname); // clean reload, everything re-initialises
    });
  }

  const frag = /[#&]s=([^&]+)/.exec(location.hash);
  if (frag) {
    unpack(frag[1]).then(p => {
      if (p.city && p.city !== CFG.cityId) {
        const target = CFG.pages && CFG.pages[p.city];
        openSheet(`
          <h3>🔄 Sync empfangen</h3>
          <p class="sheet-sub">Dieser Link ist für „${esc(p.city)}", nicht für diese Seite.</p>
          <div class="sheet-actions">${target
            ? `<a class="sheet-btn" href="${esc(target)}${esc(location.hash)}">Dort öffnen</a>`
            : '<button type="button" id="r-skip" class="ghost">Schließen</button>'}</div>`);
        const skip = $('r-skip');
        if (skip) skip.addEventListener('click', closeSheet);
        return;
      }
      receiveSheet(p);
    }).catch(() => toast('Sync-Link nicht lesbar.'));
  }

  /* ————— entry points ————— */
  $('sync-open').addEventListener('click', () => senderSheet({ plan: true, prof: true, ovl: false }));
  // the plan bar's share button now opens the same sheet, plan preselected
  const oldShare = $('plan-share');
  const newShare = oldShare.cloneNode(true);
  oldShare.replaceWith(newShare);
  newShare.addEventListener('click', () => senderSheet({ plan: true, prof: false, ovl: false }));
})();
