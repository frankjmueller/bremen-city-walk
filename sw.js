/* Bremen City Walk — offline service worker
   Precaches EVERYTHING on install, serves cache-first,
   and answers HTTP Range requests from cache (required for
   audio playback on iOS Safari while offline). */

const CACHE_NAME = 'bremen-walk-v7';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/fonts/bricolage.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-maskable-512.png',
  // images
  './assets/img/tram.webp',
  './assets/img/dom.webp',
  './assets/img/musicians.webp',
  './assets/img/roland.webp',
  './assets/img/loch.webp',
  './assets/img/boettcher.webp',
  './assets/img/schnoor.webp',
  './assets/img/schlachte.webp',
  './assets/img/pigs.webp',
  './assets/img/muehle.webp',
  './assets/img/elephant.webp',
  './assets/img/rathaus.webp',
  // audio
  './assets/audio/welcome.mp3',
  './assets/audio/dom.mp3',
  './assets/audio/musicians.mp3',
  './assets/audio/roland.mp3',
  './assets/audio/loch.mp3',
  './assets/audio/boettcher.mp3',
  './assets/audio/schnoor.mp3',
  './assets/audio/schlachte.mp3',
  './assets/audio/pigs.mp3',
  './assets/audio/muehle.mp3',
  './assets/audio/elephant.mp3',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache:'reload' bypasses the browser HTTP cache, so a new SW version
      // always precaches the freshest files from the server
      .then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Page asks "how much is saved?" — reply with progress. */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'STATUS') {
    caches.open(CACHE_NAME)
      .then(cache => cache.keys())
      .then(keys => {
        event.ports[0].postMessage({ cached: keys.length, total: ASSETS.length });
      });
  }
});

/* Serve a partial (206) response from a fully cached body. */
async function rangeResponse(request, response) {
  const rangeHeader = request.headers.get('range');
  const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
  if (!match) return response;
  const buffer = await response.arrayBuffer();
  const size = buffer.byteLength;
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // ignoreSearch: tolerate cache-busting query strings
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) {
      if (request.headers.has('range')) return rangeResponse(request, cached);
      return cached;
    }
    try {
      return await fetch(request);
    } catch (err) {
      // offline navigation fallback
      if (request.mode === 'navigate') {
        const index = await cache.match('./index.html');
        if (index) return index;
      }
      throw err;
    }
  })());
});
