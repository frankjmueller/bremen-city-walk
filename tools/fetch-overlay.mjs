#!/usr/bin/env node
/* Personal overlay fetcher — PRIVATE USE ONLY.
 *
 * Pulls Google ratings for one city's places via the official Places API
 * (your own key) and writes personal/overlay-<city>.json — a file that is
 * gitignored and MUST stay that way: Google's terms don't allow republishing
 * or bundling this data, and this project's public pages must stay free of
 * third-party datasets. The file is meant for the "Privates Overlay laden"
 * button on the inventory pages (data then lives only in your browser's
 * localStorage) and for one trip at a time, not as a standing pipeline.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=xxxx node tools/fetch-overlay.mjs bremen
 *   node tools/fetch-overlay.mjs bremen --dry-run     (no API calls)
 *
 * Existing personal fields (note, myStars) in the overlay are preserved.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const city = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const key = process.env.GOOGLE_MAPS_API_KEY;

if (!city || !existsSync(join(ROOT, `content/${city}/pois.json`))) {
  console.error('usage: GOOGLE_MAPS_API_KEY=... node tools/fetch-overlay.mjs <city> [--dry-run]');
  process.exit(1);
}
if (!key && !dryRun) {
  console.error('GOOGLE_MAPS_API_KEY fehlt (oder --dry-run verwenden).');
  process.exit(1);
}

const pois = JSON.parse(readFileSync(join(ROOT, `content/${city}/pois.json`), 'utf8'));
const cityMeta = JSON.parse(readFileSync(join(ROOT, `content/${city}/city.json`), 'utf8'));
const outPath = join(ROOT, `personal/overlay-${city}.json`);

let existing = { places: {} };
try { existing = JSON.parse(readFileSync(outPath, 'utf8')); } catch { /* first run */ }

async function lookup(p) {
  const query = `${p.name.de || p.name.en}, ${city}`;
  if (dryRun) {
    console.log(`DRY  ${p.id}: searchText "${query}"${p.coord ? ` bias ${p.coord}` : ''}`);
    return null;
  }
  const body = {
    textQuery: query,
    pageSize: 1,
    ...(p.coord && {
      locationBias: { circle: { center: { latitude: p.coord[0], longitude: p.coord[1] }, radius: 500 } },
    }),
  };
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.businessStatus,places.googleMapsUri',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`FAIL ${p.id}: HTTP ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data.places?.[0] ?? null;
}

const result = {
  city,
  updated: new Date().toISOString().slice(0, 10),
  source: 'Google Places API (persönlicher Abruf — nicht veröffentlichen, nicht committen)',
  places: {},
};

for (const p of pois) {
  const hit = await lookup(p);
  const prev = existing.places?.[p.id] ?? {};
  const entry = { ...prev }; // keep personal fields: note, myStars, …
  if (hit) {
    entry.placeId = hit.id;
    if (typeof hit.rating === 'number') entry.rating = hit.rating;
    if (typeof hit.userRatingCount === 'number') entry.ratings = hit.userRatingCount;
    if (hit.businessStatus && hit.businessStatus !== 'OPERATIONAL') entry.status = hit.businessStatus;
    entry.matched = hit.displayName?.text;
    console.log(`OK   ${p.id}: ${entry.matched} — ★ ${entry.rating ?? '–'} (${entry.ratings ?? '–'})`);
  }
  if (Object.keys(entry).length) result.places[p.id] = entry;
  if (!dryRun) await new Promise(r => setTimeout(r, 200)); // gentle pacing
}

if (!dryRun) {
  mkdirSync(join(ROOT, 'personal'), { recursive: true });
  writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
  console.log(`\ngeschrieben: personal/overlay-${city}.json (${Object.keys(result.places).length} Orte, ${cityMeta.currency})`);
  console.log('Import: Bestandsseite öffnen → Footer → „Privates Overlay laden".');
} else {
  console.log(`\n--dry-run: ${pois.length} Abfragen geplant, nichts geschrieben.`);
}
