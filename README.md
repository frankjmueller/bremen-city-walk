# Bremen City Walk — Offline Guide

A mobile-first, fully offline walking guide through Bremen's old town,
made for guests from Namibia staying at 7things (Universität).

- **No backend, no database** — plain HTML + a service worker.
- Everything (pictures, audio stories, fonts) is precached on first visit.
- Google Maps buttons use coordinates, so they work with offline maps.

## Updating

1. Edit `index.html` (content) — if you add/remove files under `assets/`,
   also update the `ASSETS` list in `sw.js`.
2. **Bump the cache version** in `sw.js` (`bremen-walk-v1` → `-v2`) so
   phones pick up the change.
3. Commit and push — GitHub Pages redeploys automatically.

## Regenerating audio

Audio was generated with [edge-tts](https://pypi.org/project/edge-tts/)
(voice `en-GB-SoniaNeural`); the script lives in the original build session.
Any MP3 dropped into `assets/audio/` with the same filename works.

## Photo licenses

See `ATTRIBUTION.md` — all photos from Wikimedia Commons (CC licenses / public domain).
