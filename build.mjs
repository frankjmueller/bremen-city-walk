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

/* ————— render, collect assets, hash, stamp ————— */
const pages = tours.map(t => ({ tour: t, html: renderPage(t) }));

const assetSet = new Set();
for (const { html } of pages) {
  for (const m of html.matchAll(/(?:assets|icons)\/[A-Za-z0-9._/-]+/g)) assetSet.add('./' + m[0]);
}
// icons referenced only from the manifest (install icon, splash) must be offline too
for (const icon of readJson('manifest.json').icons) assetSet.add('./' + icon.src);
const assets = ['./', './index.html', './teens.html', './manifest.json', ...[...assetSet].sort()];

const missing = assets.filter(a => {
  if (a === './') return false;
  try { statSync(join(ROOT, a)); return false; } catch { return true; }
});
if (missing.length) throw new Error('referenced assets missing on disk:\n  ' + missing.join('\n  '));

const h = createHash('sha256');
for (const { html } of pages) h.update(html);
h.update(swTmpl);
for (const a of assets) {
  if (a === './' || a === './index.html' || a === './teens.html') continue;
  h.update(readFileSync(join(ROOT, a)));
}
const hash = h.digest('hex').slice(0, 8);

const outputs = {};
for (const { tour, html } of pages) {
  outputs[tour.output] = html.replace('__VERSION__', `${tour.versionPrefix} ${city.release} · ${hash.slice(0, 6)}`);
}
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
