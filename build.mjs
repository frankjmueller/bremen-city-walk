#!/usr/bin/env node
/* Bremen City Walk — build script.
   Renders index.html, teens.html and sw.js from content/bremen/ + templates/.
   No dependencies, Node stdlib only.

     node build.mjs           build into repo root
     node build.mjs --check   verify committed output matches the sources (CI)

   The service-worker cache version is a hash of all content and assets, so it
   bumps itself exactly when something changed — never by hand again. */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = p => readFileSync(join(ROOT, p), 'utf8');
const readJson = p => JSON.parse(read(p));

const city = readJson('content/bremen/city.json');
const pois = Object.fromEntries(readJson('content/bremen/pois.json').map(p => [p.id, p]));
const tours = ['classic', 'teens'].map(id => readJson(`content/bremen/tours/${id}.json`));
const styles = read('templates/styles.css');
const appJs = read('templates/app.js');
const swTmpl = read('templates/sw.js');

/* ————— integrity: every stop must reference a known POI with matching coords ————— */
for (const tour of tours) {
  for (const stop of tour.stops) {
    const poi = pois[stop.poi];
    if (!poi) throw new Error(`${tour.id}/${stop.liId}: unknown poi '${stop.poi}'`);
    const q = /query=([\d.]+)%2C([\d.]+)/.exec(stop.maps.href);
    if (!q) throw new Error(`${tour.id}/${stop.liId}: unparsable maps href`);
    const [lat, lng] = [Number(q[1]), Number(q[2])];
    if (lat !== poi.coord[0] || lng !== poi.coord[1]) {
      throw new Error(`${tour.id}/${stop.liId}: maps href [${lat},${lng}] != poi '${stop.poi}' coord [${poi.coord}]`);
    }
  }
}

/* ————— markup fragments (kept byte-identical to the hand-written original) ————— */
const PIN = '<svg viewBox="0 0 24 24"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

function renderStop(s) {
  const cls = s.liClass ? `stop ${s.liClass}` : 'stop';
  const out = [];
  if (s.comment) out.push(`    ${s.comment}`);
  out.push(`    <li class="${cls}" id="${s.liId}">`);
  out.push(`      ${s.beadHtml}`);
  out.push('      <article class="card">');
  if (s.imgHtml) out.push(`        ${s.imgHtml}`);
  out.push('        <div class="pad">');
  out.push(`          <p class="eyebrow">${s.eyebrow}</p>`);
  out.push(`          <h2>${s.titleHtml}</h2>`);
  out.push(`          <p class="walk">${s.walkHtml}</p>`);
  for (const b of s.blocks) {
    if (b.type === 'p') out.push(`          <p>${b.html}</p>`);
    else out.push(`          <div class="${b.type}">${b.html}</div>`);
  }
  if (s.player) {
    out.push(`          <div class="player" data-src="${s.player.src}">`);
    out.push(`            <button aria-label="${s.player.aria}">${PLAY}</button>`);
    out.push(`            <div class="meta"><p class="label">${s.player.label}</p>`);
    out.push('            <div class="bar"><div class="fill"></div></div></div>');
    out.push('            <span class="time">–:–</span>');
    out.push('          </div>');
  }
  out.push(`          <a class="maps" href="${s.maps.href}" target="_blank" rel="noopener">`);
  out.push(`            ${PIN}`);
  out.push(`            ${s.maps.label}</a>`);
  out.push('        </div>');
  out.push('      </article>');
  out.push('    </li>');
  return out.join('\n');
}

function renderPage(tour) {
  const css = styles + (tour.extraCss ? `\n/* ${tour.id} edition override */\n${tour.extraCss}\n` : '');
  const svg = read(`content/bremen/${tour.routeCard.svg}`).trimEnd();
  const cfg = {
    meetKey: tour.ui.meetKey,
    statusUnsupported: tour.ui.statusUnsupported,
    statusFileProto: tour.ui.statusFileProto,
    statusSaving: tour.ui.statusSaving,
    statusProgress: tour.ui.statusProgress,
    statusReady: tour.ui.statusReady,
    statusUnavailable: tour.ui.statusUnavailable,
    statusIncomplete: tour.ui.statusIncomplete,
    statusRetrying: tour.ui.statusRetrying,
    audioMissing: tour.ui.audioMissing,
    iosTip: tour.ui.iosTip,
    androidTip: tour.ui.androidTip,
    meetHint: tour.practical.meetHint,
    meetAdopted: tour.ui.meetAdopted,
    meetCopied: tour.ui.meetCopied,
    meetNeedTime: tour.ui.meetNeedTime,
    shareTitle: tour.ui.shareTitle,
    icsSummaryPrefix: tour.ui.icsSummaryPrefix,
    icsFallback: tour.ui.icsFallback,
    icsAlarm: tour.ui.icsAlarm,
  };
  const js = appJs.replace('__CFG__', JSON.stringify(cfg, null, 2));

  return `<!DOCTYPE html>
<!-- GENERATED from content/bremen/ + templates/ — edit those, then run: node build.mjs -->
<html lang="${tour.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${tour.head.title}</title>
<meta name="description" content="${tour.head.description}">
<meta name="theme-color" content="#7A2E20">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>
${css}</style>
</head>
<body>

<header class="hero">
  <p class="eyebrow">${tour.hero.eyebrow}</p>
  <h1>${tour.hero.h1}</h1>
  <img class="hero-logo" src="icons/icon-192.png" alt="" width="96" height="96">
  <p class="hero-sub">${tour.hero.sub}</p>
  <p class="status" id="status"><span class="dot"></span><span id="status-text">${tour.hero.statusInitial}</span></p>
  <br>
  <button class="install" id="install-btn" hidden>
    <img src="icons/icon-192.png" alt="">
    ${tour.hero.installLabel}
  </button>
  <div class="ios-tip" id="install-tip" hidden></div>
  <br>
  ${tour.hero.langLink}
</header>

<div class="howto">
  <div class="wrap">
    ${tour.howto.join('\n    ')}
  </div>
</div>

<main class="wrap">

${tour.routeComment ? '  ' + tour.routeComment + '\n' : ''}  <section class="map-card" aria-label="${tour.routeCard.aria}">
    <h2>${tour.routeCard.h2}</h2>
    <p>${tour.routeCard.intro}</p>
    ${svg}
  </section>

  <ol class="route">

${tour.stops.map(renderStop).join('\n\n')}
  </ol>

${tour.practicalComment ? '  ' + tour.practicalComment + '\n' : ''}  <section class="map-card" aria-label="${tour.practical.aria}">
    <h2>${tour.practical.h2}</h2>
    <div class="info-grid">
      ${tour.practical.grid.join('\n      ')}
    </div>
    <div class="meet">
      <label for="meet-place">${tour.practical.meetLabel}</label>
      <input id="meet-place" type="text" maxlength="120" autocomplete="off" spellcheck="false">
      <div class="meet-row">
        <label for="meet-time">${tour.practical.meetTimeLabel}</label>
        <input id="meet-time" type="time">
      </div>
      <div class="meet-actions">
        <button type="button" id="meet-share">${tour.practical.meetShareLabel}</button>
        <button type="button" id="meet-cal">${tour.practical.meetCalLabel}</button>
      </div>
      <small id="meet-note">${tour.practical.meetHint}</small>
    </div>
  </section>

</main>

<footer>
  <div class="wrap">
${tour.footerHtml}
  </div>
</footer>

<script>
${js}</script>
</body>
</html>
`;
}

/* ————— inventory page (Windhoek pilot): places + client-side filter ————— */

const KIND_META = {
  sight: ['🏛', 'Sehenswert'], memorial: ['🕯', 'Erinnerung'], viewpoint: ['🌄', 'Aussicht'],
  art: ['🎨', 'Kunst'], food: ['🍽', 'Essen'], icecream: ['🍦', 'Eis'],
  park: ['🌳', 'Park'], cooldown: ['💧', 'Abkühlung'], playground: ['🛝', 'Spielplatz'],
  shop: ['🛍', 'Laden'], market: ['🧺', 'Markt'], wc: ['🚻', 'WC'],
  water: ['🚰', 'Trinkwasser'], luggage: ['🧳', 'Gepäck'], transit: ['🚌', 'Transport'],
};
const INTEREST_LABEL = {
  history: 'Geschichte', architecture: 'Architektur', art: 'Kunst', 'street-art': 'Street Art',
  'memory-culture': 'Erinnerung', nature: 'Natur', wildlife: 'Tiere', science: 'Wissenschaft',
  music: 'Musik', craft: 'Handwerk', food: 'Essen', sweets: 'Süßes', action: 'Action',
  games: 'Spiele', geocache: 'Geocache', photo: 'Foto',
};
const CAT_GROUPS = {
  sehen: ['sight', 'memorial', 'viewpoint', 'art'],
  essen: ['food', 'icecream', 'market'],
  gruen: ['park', 'cooldown', 'playground', 'water'],
  einkaufen: ['shop', 'market'],
  praktisch: ['wc', 'water', 'luggage', 'transit'],
};
const CAT_LABEL = { sehen: 'Sehen', essen: 'Essen', gruen: 'Grün & kühl', einkaufen: 'Einkaufen', praktisch: 'Praktisch' };
const NEEDS = [
  ['open', '🕐 Jetzt offen'], ['shade', '🌳 Schatten'], ['indoor', '🏠 Drinnen'],
  ['veg', '🥦 Vegetarisch'], ['free', '🆓 Kostenlos'],
];
/* Companions travel with you all day — they never empty the list over
   missing data; they hide only known conflicts and surface known info. */
const COMPANIONS = [
  ['k0', '👶 0–3'], ['k4', '🧒 4–7'], ['k8', '🧑 8–12'], ['k13', '🎧 13+'],
  ['dog', '🐕 Hund'], ['wheel', '♿ Rollstuhl'],
];
const KID_BANDS = { k0: [0, 3], k4: [4, 7], k8: [8, 12], k13: [13, 17] };

function validatePois(list, cityId) {
  const seen = new Set();
  for (const p of list) {
    const where = `${cityId}/${p.id ?? '?'}`;
    for (const f of ['id', 'kind', 'name', 'sources', 'verification']) {
      if (!(f in p)) throw new Error(`${where}: missing '${f}'`);
    }
    if (seen.has(p.id)) throw new Error(`${where}: duplicate id`);
    seen.add(p.id);
    if (!KIND_META[p.kind]) throw new Error(`${where}: unknown kind '${p.kind}'`);
    if (p.coord) {
      const [lat, lng] = p.coord;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error(`${where}: coord out of range`);
    }
    const v = p.verification;
    if (!['draft', 'verified', 'stale'].includes(v.status)) throw new Error(`${where}: bad verification.status`);
    if (v.status === 'verified' && !(v.by && v.on && v.method && p.coord)) {
      throw new Error(`${where}: 'verified' requires by/on/method and a coord`);
    }
    for (const i of p.tags?.interests ?? []) {
      if (!INTEREST_LABEL[i]) throw new Error(`${where}: unknown interest '${i}'`);
    }
  }
}

function poiFlags(p) {
  const f = [];
  if (p.tags?.shade) f.push('shade');
  if (p.tags?.indoor) f.push('indoor');
  if ((p.tags?.diet ?? []).some(d => d === 'vegetarian' || d === 'vegan')) f.push('veg');
  if (p.cost && p.cost.amount === 0) f.push('free');
  if (p.cost && p.cost.amount > 0) f.push('paid');
  if (p.tags?.kids) f.push('kids');
  return f;
}

/* Criteria only judge places they are meaningful for — a museum must not
   disappear because it serves no vegetarian food, and a restaurant must
   not disappear because it isn't historical. Places outside a criterion's
   scope pass it vacuously; the profile describes the person, not each place. */
const CONTENT_KINDS = ['sight', 'memorial', 'viewpoint', 'art', 'park', 'cooldown', 'playground'];
const NEED_SCOPE = {
  veg: ['food', 'icecream', 'market'],       // diet is a food question
  free: CONTENT_KINDS,                        // "kostenlos" means entry, not consumption
  shade: null,                                // heat escape applies everywhere (shade OR indoor)
  indoor: null,
};

function renderPlace(p, currency) {
  const [emoji, kindLabel] = KIND_META[p.kind];
  const name = p.name.de || p.name.en;
  const meta = [];
  if (typeof p.cost?.amount === 'number') {
    meta.push(p.cost.amount === 0 ? 'kostenlos' : `${p.cost.amount} ${currency === 'NAD' ? 'N$' : currency}`);
  }
  if (p.visit?.minutes) meta.push(`~${p.visit.minutes} min`);
  if (p.hours?.osm) meta.push(p.hours.osm);
  const notes = [p.cost?.note?.de, p.hours?.note?.de].filter(Boolean);
  const draft = p.verification.status !== 'verified';
  const interests = p.tags?.interests ?? [];
  const attrs = [
    `id="poi-${p.id}"`,
    `data-kind="${p.kind}"`,
    `data-flags="${poiFlags(p).join(' ')}"`,
    `data-interests="${interests.join(' ')}"`,
    `data-dogs="${p.tags?.dogs ?? 'unknown'}"`,
    `data-wheelchair="${p.tags?.wheelchair ?? 'unknown'}"`,
  ];
  if (p.tags?.kids?.min !== undefined) attrs.push(`data-kidsmin="${p.tags.kids.min}"`);
  if (p.tags?.kids?.max !== undefined) attrs.push(`data-kidsmax="${p.tags.kids.max}"`);
  if (p.visit?.minutes) attrs.push(`data-visit="${p.visit.minutes}"`);
  if (typeof p.cost?.amount === 'number') attrs.push(`data-cost="${p.cost.amount}"`);
  if (p.hours?.osm) attrs.push(`data-hours="${p.hours.osm}"`);
  if (p.coord) attrs.push(`data-lat="${p.coord[0]}"`, `data-lng="${p.coord[1]}"`);
  const out = [];
  out.push(`    <li class="place" ${attrs.join(' ')}>`);
  // collapsed row: shown instead of the card when the place doesn't match —
  // nothing ever disappears, the reason is named, a tap expands it anyway
  const crowIssue = p.issue?.de ? `<span class="crow-issue" title="${p.issue.de}">⛔</span>` : '';
  out.push('      <button type="button" class="crow" aria-expanded="false">');
  out.push(`        <span aria-hidden="true">${emoji}</span><span class="crow-name">${name}</span>${crowIssue}<span class="crow-why"></span><span class="crow-chev" aria-hidden="true">▾</span>`);
  out.push('      </button>');
  out.push('      <article class="card"><div class="pad">');
  out.push('        <div class="badges">');
  out.push(`          <span class="badge kind">${emoji} ${kindLabel}</span>`);
  if (draft) out.push('          <span class="badge draft">⚠︎ ungeprüft</span>');
  else out.push(`          <span class="badge ok">✓ geprüft ${p.verification.on}</span>`);
  if (p.issue?.de) out.push(`          <span class="badge issue">⛔ ${p.issue.de}</span>`);
  out.push('          <button type="button" class="padd" aria-pressed="false">➕ Plan</button>');
  out.push('        </div>');
  out.push(`        <h3>${name}</h3>`);
  out.push('        <p class="pdist" hidden></p>');
  if (meta.length) out.push(`        <p class="pmeta">${meta.join(' · ')}</p>`);
  out.push('        <p class="popen" hidden></p>');
  if (p.body?.de?.snapshot) out.push(`        <p class="psnap">${p.body.de.snapshot}</p>`);
  if (p.funFact?.de) out.push(`        <p class="pfun">⚡ ${p.funFact.de}</p>`);
  if (notes.length) out.push(`        <p class="pnote">${notes.join(' · ')}</p>`);
  // companion lines: hidden by default, shown when the matching profile is active
  const DOG_LINE = {
    yes: '🐕 Hunde erlaubt', leash: '🐕 An der Leine erlaubt',
    no: '🚫 Keine Hunde', unknown: '🐕 Hunde: unbekannt — vor Ort fragen (und notieren!)',
  };
  out.push(`        <p class="pdog">${DOG_LINE[p.tags?.dogs ?? 'unknown']}</p>`);
  if (p.tags?.kids?.min !== undefined) {
    const kn = p.tags.kids.note?.de ? ` — ${p.tags.kids.note.de}` : '';
    out.push(`        <p class="pkids">🧒 Ab ${p.tags.kids.min} Jahren${kn}</p>`);
  } else {
    out.push('        <p class="pkids">🧒 Kinder-Eignung unbekannt — wird vor Ort erfasst</p>');
  }
  const WHEEL_LINE = {
    yes: '♿ Rollstuhlgerecht', partial: '♿ Teilweise rollstuhlgerecht',
    no: '♿ Nicht rollstuhlgerecht', unknown: '♿ Zugänglichkeit unbekannt — wird vor Ort erfasst',
  };
  out.push(`        <p class="pacc">${WHEEL_LINE[p.tags?.wheelchair ?? 'unknown']}</p>`);
  if (interests.length) out.push(`        <p class="ptags">${interests.map(i => INTEREST_LABEL[i]).join(' · ')}</p>`);
  if (p.coord) {
    out.push(`        <a class="maps maps-sm" href="https://www.google.com/maps/search/?api=1&query=${p.coord[0]}%2C${p.coord[1]}" target="_blank" rel="noopener">`);
    out.push(`          ${PIN}`);
    out.push('          In Google Maps öffnen</a>');
  } else {
    out.push('        <p class="pnote">📍 Koordinate fehlt noch — wird vor Ort erfasst.</p>');
  }
  out.push('      </div></article>');
  out.push('    </li>');
  return out.join('\n');
}

const INVENTORY_CSS = `
/* ————— inventory page (filter pilot) ————— */
/* author display beats the UA's [hidden] rule — make hidden always win */
[hidden]{display:none!important}
.fgroup{display:flex;flex-wrap:wrap;gap:.45rem;margin:.5rem 0;justify-content:center}
.fgroup-label{width:100%;text-align:center;font-size:.72rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:.5rem 0 0}
.chip{
  border:1.5px solid var(--line);border-radius:999px;padding:.35em .85em;
  background:var(--card);color:var(--ink);font-size:.86rem;font-family:inherit;cursor:pointer;
}
.chip[aria-pressed="true"]{background:var(--patina);color:#fff;border-color:var(--patina);font-weight:700}
.fhint{font-size:.8rem;line-height:1.5;color:var(--muted);text-align:center;max-width:32rem;margin:.9rem auto 0}
.fcount{margin:.8rem 0 0}
.freset{background:none;border:none;color:var(--patina);font-family:inherit;font-size:.85rem;cursor:pointer;text-decoration:underline;margin:.3rem auto 0;display:block}
.places{list-style:none;margin:1.4rem 0 0;padding:0}
.place{margin:0 0 1rem}
.place h3{margin:.45rem 0 .2rem;font-size:1.2rem;font-family:'Bricolage',system-ui,sans-serif}
.badges{display:flex;flex-wrap:wrap;gap:.4rem}
.badge{font-size:.72rem;font-weight:700;padding:.22em .65em;border-radius:999px}
.badge.kind{background:color-mix(in srgb, var(--patina) 12%, var(--card));color:var(--patina)}
.badge.draft{background:color-mix(in srgb, var(--gold) 22%, var(--card));color:var(--brick)}
.badge.ok{background:color-mix(in srgb, var(--patina) 18%, var(--card));color:var(--patina)}
.pmeta{font-size:.85rem;color:var(--muted);margin:.1rem 0 .3rem}
.popen{font-size:.85rem;font-weight:700;margin:.15rem 0 .3rem}
.popen.open{color:var(--patina)}
.popen.closed{color:var(--brick)}
.psnap{margin:.3rem 0}
.pfun{font-size:.9rem;margin:.4rem 0;color:var(--patina)}
.pnote{font-size:.82rem;color:var(--muted);margin:.35rem 0}
.ptags{font-size:.78rem;color:var(--muted);letter-spacing:.02em;margin:.4rem 0 0}
.maps-sm{padding:.6em .9em;font-size:.9rem;margin-top:.7rem}
#empty{text-align:center;color:var(--muted);margin:2rem 0}
.padd{
  margin-left:auto;border:1.5px solid var(--patina);border-radius:999px;
  background:var(--card);color:var(--patina);font-size:.78rem;font-weight:700;
  padding:.22em .7em;cursor:pointer;font-family:inherit;flex:none;
}
.padd[aria-pressed="true"]{background:var(--patina);color:#fff}
.pdog,.pkids,.pacc{display:none;font-size:.85rem;margin:.35rem 0;color:var(--muted)}
body.has-dog .pdog{display:block}
body.has-kids .pkids{display:block}
body.has-wheel .pacc{display:block}
.badge.issue{background:color-mix(in srgb, var(--brick) 16%, var(--card));color:var(--brick)}
.crow-issue{flex:none}
.csep{
  list-style:none;text-align:center;font-size:.78rem;letter-spacing:.08em;
  color:var(--muted);margin:1.4rem 0 .9rem;
}
.pdist{font-size:.85rem;color:var(--patina);font-weight:700;margin:.15rem 0 .1rem}
.fsort{
  display:block;margin:.7rem auto 0;border:1.5px solid var(--line);border-radius:999px;
  background:var(--card);color:var(--ink);font-size:.86rem;font-family:inherit;
  padding:.4em 1em;cursor:pointer;
}
.fsort[aria-pressed="true"]{background:var(--patina);color:#fff;border-color:var(--patina);font-weight:700}
.planbar{
  position:fixed;left:0;right:0;bottom:0;z-index:30;
  display:flex;gap:.55rem;align-items:center;
  background:var(--patina-deep);color:#EAF5F0;
  padding:.7rem max(1rem, env(safe-area-inset-left)) calc(.7rem + env(safe-area-inset-bottom));
  box-shadow:0 -2px 12px rgba(0,0,0,.25);
}
.planbar span{flex:1;font-size:.88rem;font-weight:700;min-width:0}
.planbar button{
  flex:none;background:rgba(255,255,255,.14);color:#fff;
  border:1px solid rgba(255,255,255,.35);border-radius:999px;
  padding:.4em .85em;font-family:inherit;font-size:.84rem;cursor:pointer;
}
.planbar button[aria-pressed="true"]{background:var(--gold);color:#4A2317;border-color:var(--gold);font-weight:700}
body.has-plan main{padding-bottom:4.5rem}
.crow{
  display:none;width:100%;align-items:center;gap:.55rem;text-align:left;
  background:var(--card);border:1px dashed var(--line);border-radius:12px;
  padding:.55rem .8rem;font-family:inherit;font-size:.9rem;color:var(--muted);cursor:pointer;
}
.place.collapsed{margin:0 0 .5rem}
.place.collapsed .crow{display:flex}
.place.collapsed article{display:none}
.place.collapsed.expanded article{display:block;margin-top:.5rem}
.place.collapsed.expanded .crow-chev{transform:rotate(180deg)}
.crow-name{color:var(--ink);font-weight:600;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:45%}
.crow-why{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem}
.crow-chev{flex:none;transition:transform .15s}
@media (prefers-reduced-motion: reduce){.crow-chev{transition:none}}
.draftnote{
  max-width:34rem;margin:1rem auto 0;padding:.7rem 1rem;border-radius:12px;
  background:rgba(0,0,0,.28);border:1px solid rgba(217,164,65,.45);
  color:#F3E4C8;font-size:.85rem;text-align:left;line-height:1.5;
}
`;

function renderInventory(cityId) {
  const c = readJson(`content/${cityId}/city.json`);
  const list = readJson(`content/${cityId}/pois.json`);
  validatePois(list, cityId);

  const kindsPresent = new Set(list.map(p => p.kind));
  const cats = Object.entries(CAT_GROUPS).filter(([, kinds]) => kinds.some(k => kindsPresent.has(k)));
  const interestsPresent = [...new Set(list.flatMap(p => p.tags?.interests ?? []))]
    .filter(i => INTEREST_LABEL[i]).sort((a, b) => INTEREST_LABEL[a].localeCompare(INTEREST_LABEL[b], 'de'));

  const chip = (g, v, label) => `      <button type="button" class="chip" data-g="${g}" data-v="${v}" aria-pressed="false">${label}</button>`;
  const cfg = {
    storageKey: `walk-profile-${cityId}`,
    planKey: `walk-plan-${cityId}`,
    currency: c.currency === 'NAD' ? 'N$' : c.currency,
    groups: CAT_GROUPS,
    contentKinds: CONTENT_KINDS,
    needScope: NEED_SCOPE,
    bands: KID_BANDS,
    countTpl: '{n} von {t} Orten',
  };
  const js = read('templates/inventory.js').replace('__CFG__', JSON.stringify(cfg, null, 2));
  const drafts = list.filter(p => p.verification.status !== 'verified').length;

  return `<!DOCTYPE html>
<!-- GENERATED from content/${cityId}/ + templates/ — edit those, then run: node build.mjs -->
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Windhoek — Orte-Bestand (Feldtest)</title>
<meta name="description" content="Recherchierter, noch unverifizierter Orte-Bestand für Windhoek — Pilot für Profil-Filter: Orte statt Touren.">
<meta name="theme-color" content="#7A2E20">
<link rel="icon" href="icons/icon-192.png">
<style>
${styles}${INVENTORY_CSS}</style>
</head>
<body>

<header class="hero">
  <p class="eyebrow">Feldtest · Bestand statt Tour · Namibia</p>
  <h1>Windhoek<span class="gold">.</span></h1>
  <p class="hero-sub">Das ist keine fertige Tour — es ist der <b>Orte-Bestand</b>, aus dem
  eure Tour entsteht: Ihr filtert, was heute zu euch passt. Profil wird auf diesem
  Handy gespeichert, kein Konto nötig.</p>
  <div class="draftnote"><b>⚠︎ Rohdaten:</b> Alle ${drafts} Orte sind recherchiert, aber noch
  <b>nicht vor Ort geprüft</b> — Preise, Zeiten und Koordinaten werden bei der Reise
  verifiziert (siehe Erfassungs-Checkliste). Nichts hiervon ist eine Zusage.</div>
  <p class="status" id="status"><span class="dot"></span><span id="status-text">Prüfe Offline-Speicher…</span></p>
  <br>
  <a class="lang" href="index.html">🇬🇧 Bremen guide</a> · <a class="lang" href="teens.html">🇩🇪 Bremen Teenie-Tour</a>
</header>

<main class="wrap">

  <section class="map-card" aria-label="Filter">
    <h2>Wer seid ihr heute?</h2>
    <p class="fgroup-label">Kategorie</p>
    <div class="fgroup">
${cats.map(([g]) => chip('cat', g, CAT_LABEL[g])).join('\n')}
    </div>
    <p class="fgroup-label">Bedürfnisse</p>
    <div class="fgroup">
${NEEDS.map(([v, label]) => chip('need', v, label)).join('\n')}
    </div>
    <p class="fgroup-label">Wer ist dabei?</p>
    <div class="fgroup">
${COMPANIONS.map(([v, label]) => chip('comp', v, label)).join('\n')}
    </div>
    <p class="fgroup-label">Interessen</p>
    <div class="fgroup">
${interestsPresent.map(i => chip('int', i, INTEREST_LABEL[i])).join('\n')}
    </div>
    <p class="fhint">Jeder Filter wirkt nur, wo er Sinn ergibt: „Vegetarisch" prüft Essens-Orte,
    Interessen prüfen Sehenswertes, „Kostenlos" meint den Eintritt. Ein Museum fliegt also
    nicht raus, weil es kein Essen hat — und das Restaurant nicht, weil es nicht historisch ist.
    Kinder, Hund und Rollstuhl sind Begleitung, kein Filter: Sie zeigen auf jeder Karte, was
    darüber bekannt ist. Was nicht passt, verschwindet nie — es rückt <b>zusammengeklappt ans
    Listenende</b>, mit dem Grund dran; antippen zeigt es trotzdem. ⛔ markiert bekannte
    Probleme (z.&nbsp;B. geschlossen). Mit ➕ sammelt ihr Orte in euren Tagesplan — teilbar
    als Link, wie der Treffpunkt in Bremen.</p>
    <p class="fcount" id="fcount"></p>
    <button type="button" class="fsort" id="fsort" aria-pressed="false">📍 Nach Nähe sortieren</button>
    <button type="button" class="freset" id="freset" hidden>Filter zurücksetzen</button>
  </section>

  <ol class="places" id="places">
${list.map(p => renderPlace(p, c.currency)).join('\n')}
    <li class="csep" id="csep" hidden>— passt gerade nicht, trotzdem da —</li>
  </ol>
  <p id="empty" hidden>Nichts übrig — Filter etwas lockern.</p>

</main>

<div class="planbar" id="planbar" hidden>
  <span id="plan-summary"></span>
  <button type="button" id="plan-only" aria-pressed="false">Nur Plan</button>
  <button type="button" id="plan-share">Teilen</button>
  <button type="button" id="plan-clear" aria-label="Plan leeren">✕</button>
</div>

<footer>
  <div class="wrap">
    <p>Feldtest-Bestand Windhoek · Kuration &amp; Verifikation vor Ort: ${c.curator.name}</p>
    <p>Koordinaten aus OpenStreetMap/Wikipedia (Entwurf). Google-Maps-Buttons öffnen eure
    Maps-App — mit heruntergeladener Offline-Karte von Windhoek auch ohne Netz.</p>
    <p>Teil des <a href="index.html">Bremen City Walk</a> · Bremen und Windhoek sind
    Partnerstädte. <span id="version">__VERSION__</span></p>
  </div>
</footer>

<script>
${js}</script>
</body>
</html>
`;
}

/* ————— render, collect assets, hash, stamp ————— */
const pages = tours.map(t => ({ tour: t, html: renderPage(t) }));
const windhoekHtml = renderInventory('windhoek');

const assetSet = new Set();
for (const html of [...pages.map(p => p.html), windhoekHtml]) {
  for (const m of html.matchAll(/(?:assets|icons)\/[A-Za-z0-9._/-]+/g)) assetSet.add('./' + m[0]);
}
// icons referenced only from the manifest (install icon, splash) must be offline too
for (const icon of readJson('manifest.json').icons) assetSet.add('./' + icon.src);
const assets = ['./', './index.html', './teens.html', './windhoek.html', './manifest.json', ...[...assetSet].sort()];

const GENERATED = new Set(['./', './index.html', './teens.html', './windhoek.html']);
const missing = assets.filter(a => {
  if (GENERATED.has(a)) return false; // outputs of this very build
  try { statSync(join(ROOT, a)); return false; } catch { return true; }
});
if (missing.length) throw new Error('referenced assets missing on disk:\n  ' + missing.join('\n  '));

const h = createHash('sha256');
for (const { html } of pages) h.update(html);
h.update(windhoekHtml);
h.update(swTmpl);
for (const a of assets) {
  if (a === './' || a === './index.html' || a === './teens.html' || a === './windhoek.html') continue;
  h.update(readFileSync(join(ROOT, a)));
}
const hash = h.digest('hex').slice(0, 8);

const outputs = {};
for (const { tour, html } of pages) {
  outputs[tour.output] = html.replace('__VERSION__', `${tour.versionPrefix} ${city.release} · ${hash.slice(0, 6)}`);
}
outputs['windhoek.html'] = windhoekHtml.replace('__VERSION__', `Stand ${city.release} · ${hash.slice(0, 6)}`);
outputs['sw.js'] = swTmpl
  .replace('__CACHE_NAME__', `bremen-walk-${city.release}-${hash}`)
  .replace('__ASSETS__', JSON.stringify(assets, null, 2).replace(/"/g, "'"));

/* ————— write or check ————— */
const checkMode = process.argv.includes('--check');
let dirty = [];
for (const [file, content] of Object.entries(outputs)) {
  if (checkMode) {
    let onDisk = null;
    try { onDisk = read(file); } catch { /* missing counts as dirty */ }
    if (onDisk !== content) dirty.push(file);
  } else {
    writeFileSync(join(ROOT, file), content);
    console.log(`wrote ${file} (${(content.length / 1024).toFixed(1)} kB)`);
  }
}
if (checkMode) {
  if (dirty.length) {
    console.error(`OUT OF SYNC: ${dirty.join(', ')}\nRun \`node build.mjs\` and commit the result.`);
    process.exit(1);
  }
  console.log('build check OK — committed output matches sources');
} else {
  console.log(`assets precached: ${assets.length} · cache: bremen-walk-${city.release}-${hash}`);
}
