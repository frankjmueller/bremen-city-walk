# Bremen City Walk — Offline Guide

A mobile-first, fully offline walking guide through Bremen's old town,
made for guests from Namibia staying at 7things (Universität).

- **No backend, no database, no dependencies** — plain HTML + a service worker.
- Everything (pictures, audio stories, fonts) is precached on first visit.
- Google Maps buttons use coordinates, so they work with offline maps.

## How it's built

`index.html`, `teens.html` and `sw.js` are **generated** — don't edit them
directly. The sources are:

```
content/bremen/          content: city meta, POIs, the two tour editions,
                         route-map SVGs (tours/classic.json, tours/teens.json)
content/schema/          JSON Schemas for the multi-city data model
content/windhoek/        next city (draft inventory, see docs/erfassung-windhoek.md)
templates/               one stylesheet, one page script, one service worker
build.mjs                renders everything (Node ≥ 18, zero dependencies)
```

## Updating

1. Edit the content under `content/bremen/` (or the templates).
2. Run `node build.mjs`.
3. Commit **sources and generated output together** and push — GitHub Pages
   redeploys automatically.

That's it. The service-worker asset list and the cache version are computed
from the content (hash-based), so phones pick up changes automatically —
no manual version bumping, no hand-maintained asset list. CI runs
`node build.mjs --check` and fails if the committed output doesn't match
the sources.

## Regenerating audio

Audio was generated with [edge-tts](https://pypi.org/project/edge-tts/)
(voice `en-GB-SoniaNeural`). Any MP3 dropped into `assets/audio/` with the
same filename works. **Note:** edge-tts is fine for this private prototype
but not licensed for commercial use — switch to Azure/Google TTS (or a
human voice) before selling anything. See `docs/ausbau-analyse.md`.

## Photo licenses

See `ATTRIBUTION.md` — all photos from Wikimedia Commons (CC licenses / public domain).
