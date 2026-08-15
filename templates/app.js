/* Shared page script — rendered per edition by build.mjs.
   CFG is injected at build time (strings, localStorage key). */
const CFG = __CFG__;

/* ————— Service worker: register + progress + visible failures ————— */
(function () {
  const statusEl = document.getElementById('status');
  const textEl = document.getElementById('status-text');

  function setStatus(ready, text) {
    statusEl.classList.toggle('ready', ready);
    textEl.textContent = text;
  }

  if (!('serviceWorker' in navigator)) {
    setStatus(false, CFG.statusUnsupported);
    return;
  }
  if (location.protocol === 'file:') {
    setStatus(false, CFG.statusFileProto);
    return;
  }

  // when a new guide version takes over, reload once so everyone
  // always sees the latest content without manual cache-fiddling
  // (skipped on first visit, where the SW claims the page mid-precache)
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    location.reload();
  });

  // ask the browser not to evict our cache after 7 idle days (iOS!)
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  let retryArmed = false;
  statusEl.addEventListener('click', () => {
    if (!retryArmed) return;
    retryArmed = false;
    setStatus(false, CFG.statusRetrying);
    navigator.serviceWorker.ready.then(reg => {
      if (reg.active) reg.active.postMessage({ type: 'RETRY' });
      poll();
    });
  });

  let pollTimer = null;
  function poll() {
    clearInterval(pollTimer);
    let tries = 0;
    pollTimer = setInterval(() => {
      tries++;
      navigator.serviceWorker.ready.then(reg => {
        const sw = reg.active;
        if (!sw) return;
        const ch = new MessageChannel();
        ch.port1.onmessage = e => {
          const { cached, total, missing, settled } = e.data;
          if (cached >= total) {
            clearInterval(pollTimer);
            setStatus(true, CFG.statusReady);
          } else if (settled && missing > 0) {
            // precache finished but some files failed — say so, offer retry
            clearInterval(pollTimer);
            retryArmed = true;
            setStatus(false, CFG.statusIncomplete.replace('{n}', missing));
          } else {
            setStatus(false, CFG.statusProgress.replace('{c}', cached).replace('{t}', total));
          }
        };
        sw.postMessage({ type: 'STATUS' }, [ch.port2]);
      });
      if (tries > 240) clearInterval(pollTimer); // give up quietly after ~3 min
    }, 800);
  }

  navigator.serviceWorker.register('sw.js').then(reg => {
    // check for a newer version on every visit
    reg.update();
    setStatus(false, CFG.statusSaving);
    poll();
  }).catch(() => {
    setStatus(false, CFG.statusUnavailable);
  });
})();

/* ————— Audio players ————— */
(function () {
  const players = document.querySelectorAll('.player');
  let current = null;

  const PLAY = '<path d="M8 5v14l11-7z"/>';
  const PAUSE = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';

  function fmt(s) {
    if (!isFinite(s)) return '–:–';
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + String(r).padStart(2, '0');
  }

  players.forEach(p => {
    const btn = p.querySelector('button');
    const fill = p.querySelector('.fill');
    const bar = p.querySelector('.bar');
    const time = p.querySelector('.time');
    let audio = null;

    function ensureAudio() {
      if (audio) return audio;
      audio = new Audio(p.dataset.src);
      audio.preload = 'metadata';
      audio.addEventListener('loadedmetadata', () => { time.textContent = fmt(audio.duration); });
      audio.addEventListener('timeupdate', () => {
        if (audio.duration) fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
        time.textContent = fmt(audio.duration - audio.currentTime);
      });
      audio.addEventListener('ended', () => {
        btn.querySelector('svg').innerHTML = PLAY;
        fill.style.width = '0%';
        time.textContent = fmt(audio.duration);
      });
      // file missing from the cache (e.g. interrupted first save): say so
      audio.addEventListener('error', () => {
        btn.querySelector('svg').innerHTML = PLAY;
        time.textContent = '⚠';
        p.title = CFG.audioMissing;
      });
      return audio;
    }

    btn.addEventListener('click', () => {
      const a = ensureAudio();
      if (a.paused) {
        if (current && current !== a) {
          current.pause();
          document.querySelectorAll('.player svg').forEach(s => s.innerHTML = PLAY);
        }
        a.play().catch(() => {});
        current = a;
        btn.querySelector('svg').innerHTML = PAUSE;
      } else {
        a.pause();
        btn.querySelector('svg').innerHTML = PLAY;
      }
    });

    bar.addEventListener('pointerdown', e => {
      const a = ensureAudio();
      if (!a.duration) return;
      const r = bar.getBoundingClientRect();
      a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.duration;
    });
  });
})();

/* ————— Install as app ————— */
(function () {
  const btn = document.getElementById('install-btn');
  const tip = document.getElementById('install-tip');
  const standalone = matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true;
  if (standalone) return; // already installed & frameless

  // iPadOS reports a desktop-class Mac user agent — the touch-point check catches it
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.userAgent));

  // platform-specific fallback instructions, shown only when the
  // browser offers no native install prompt right now
  tip.innerHTML = isIOS ? CFG.iosTip : CFG.androidTip;

  btn.hidden = false; // always offer it; click resolves the best available path

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e; // native prompt is available — use it on click
  });

  btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      tip.hidden = true;
      const promptEvent = deferredPrompt;
      deferredPrompt = null; // a prompt event can only be used once
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') btn.hidden = true;
      // dismissed: keep the button; Chrome re-fires beforeinstallprompt later
    } else {
      tip.hidden = !tip.hidden;
    }
  });

  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    tip.hidden = true;
  });
})();

/* ————— Meeting point: place + time, shareable via URL, calendar reminder.
   Still no backend: the "sync" is a link the group passes around. ————— */
(function () {
  const place = document.getElementById('meet-place');
  const time = document.getElementById('meet-time');
  const note = document.getElementById('meet-note');
  const KEY = CFG.meetKey + '-v2';

  let noteTimer = null;
  function flash(text) {
    note.textContent = text;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { note.textContent = CFG.meetHint; }, 6000);
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function persist() {
    localStorage.setItem(KEY, JSON.stringify({ place: place.value, time: time.value }));
  }

  let data = load();
  // migrate the old free-text value ("15:00 am Roland") into the place field
  if (!data.place && localStorage.getItem(CFG.meetKey)) {
    data.place = localStorage.getItem(CFG.meetKey);
  }

  // adopt a shared meeting point from the URL: ?meet=Roland&at=15:00
  const params = new URLSearchParams(location.search);
  if (params.has('meet') || params.has('at')) {
    data = { place: params.get('meet') || '', time: params.get('at') || '' };
    place.value = data.place; time.value = data.time || '';
    persist();
    flash(CFG.meetAdopted);
    // clean the URL so a later reload doesn't overwrite manual edits
    history.replaceState(null, '', location.pathname + location.hash);
  } else {
    place.value = data.place || '';
    time.value = data.time || '';
  }

  place.addEventListener('input', persist);
  time.addEventListener('input', persist);

  document.getElementById('meet-share').addEventListener('click', () => {
    const url = location.origin + location.pathname
      + '?meet=' + encodeURIComponent(place.value)
      + '&at=' + encodeURIComponent(time.value);
    if (navigator.share) {
      navigator.share({ title: CFG.shareTitle, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => flash(CFG.meetCopied)).catch(() => {});
    }
  });

  document.getElementById('meet-cal').addEventListener('click', () => {
    if (!time.value) { flash(CFG.meetNeedTime); time.focus(); return; }
    const [h, m] = time.value.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d < new Date()) d.setDate(d.getDate() + 1); // time already past → tomorrow
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(m)}00`;
    const esc = s => s.replace(/([,;\\])/g, '\\$1');
    const summary = place.value ? CFG.icsSummaryPrefix + place.value : CFG.icsFallback;
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bremen City Walk//DE',
      'BEGIN:VEVENT',
      'UID:' + Date.now() + '@bremen-walk',
      'DTSTAMP:' + stamp,
      'DTSTART:' + stamp, // floating local time — right for a same-day meetup
      'SUMMARY:' + esc(summary),
      'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY',
      'DESCRIPTION:' + esc(CFG.icsAlarm),
      'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', '',
    ].join('\r\n');
    const file = new File([ics], 'treffpunkt.ics', { type: 'text/calendar' });
    // iOS: the share sheet is the only reliable road into the Calendar app
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: summary }).catch(() => {});
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = 'treffpunkt.ics';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
  });
})();
