/* Baboo · hero a scorrimento: standard 10k-websites (Blob in streaming, lerp, seek con gate, bande in vh, cinque gate statici) */
(function () {
  'use strict';
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const stage = hero.querySelector('.stage');
  const video = hero.querySelector('video');
  const posterLayer = hero.querySelector('.poster');
  const ring = hero.querySelector('.ring');
  const bandEls = [...hero.querySelectorAll('.band')];
  const cue = hero.querySelector('.cue');
  const VIDEO_URL = hero.getAttribute('data-video');
  const POSTER_URL = hero.getAttribute('data-poster');
  const ENDING_URL = hero.getAttribute('data-ending') || POSTER_URL;
  let posterState = 'start';
  const VIDEO_BYTES = Number(hero.getAttribute('data-bytes')) || 12000000;
  const FILM_URL = hero.getAttribute('data-film');
  const FILM_POSTER = hero.getAttribute('data-film-poster') || POSTER_URL;
  const skipBtn = hero.querySelector('.film-skip');

  /* ---- bande: range e cache ---- */
  const bands = bandEls.map(el => ({
    el,
    a: parseFloat(el.dataset.from), b: parseFloat(el.dataset.to),
    ramp: el.dataset.ramp ? parseFloat(el.dataset.ramp) : null,
    op: -1, k: -1
  }));
  const smoothstep = (p, e0, e1) => { const t = Math.min(1, Math.max(0, (p - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* ---- suddivisione del testo (una volta, con rng seminato) ---- */
  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  bandEls.forEach((band, bi) => {
    band.querySelectorAll('[data-split]').forEach((el, ei) => {
      const mode = el.dataset.split;
      const text = el.textContent.trim();
      const r = rng(1000 + bi * 31 + ei * 7);
      const sr = document.createElement('span'); sr.className = 'visually-hidden'; sr.textContent = text;
      const vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true'); vis.className = 'vis';
      const words = text.split(/\s+/);
      const total = words.join('').length; let ci = 0;
      const spread = parseFloat(band.dataset.spread || '0.5');
      words.forEach((w, wi) => {
        const ws = document.createElement('span'); ws.className = 'w';
        if (/comfort/i.test(w)) ws.classList.add('em');
        ws.style.setProperty('--th', (wi / words.length * spread).toFixed(3));
        if (mode === 'chars' || mode === 'grid') {
          [...w].forEach(ch => {
            const cs = document.createElement('span'); cs.className = 'c'; cs.textContent = ch;
            const th = mode === 'grid' ? ci / total * spread + r() * 0.06 : r() * 0.55;
            cs.style.setProperty('--th', th.toFixed(3));
            cs.style.setProperty('--jx', ((r() - 0.5) * 60).toFixed(1) + 'px');
            cs.style.setProperty('--jy', (mode === 'grid' ? 0 : (r() - 0.5) * 40).toFixed(1) + 'px');
            cs.style.setProperty('--jr', ((r() - 0.5) * 20).toFixed(1) + 'deg');
            ws.appendChild(cs); ci++;
          });
        } else { ws.textContent = w; }
        vis.appendChild(ws);
        if (wi < words.length - 1) vis.appendChild(document.createTextNode(' '));
      });
      el.textContent = ''; el.appendChild(sr); el.appendChild(vis);
    });
  });

  /* ---- progresso di scroll ---- */
  function heroProgress() {
    const rect = hero.getBoundingClientRect();
    const range = hero.offsetHeight - innerHeight;
    return range > 0 ? clamp(-rect.top / range, 0, 1) : 0;
  }
  let loadK = 0, loadStart = null;
  function updateCaptions(p) {
    bands.forEach((b, i) => {
      const f = Math.min(0.02, (b.b - b.a) / 3);
      let op = smoothstep(p, b.a, b.a + f) * (1 - smoothstep(p, b.b - f, b.b));
      if (i === 0) op = 1 - smoothstep(p, b.b - f, b.b);
      if (i === bands.length - 1) op = smoothstep(p, b.a, b.a + f);
      let k = clamp((p - b.a) / (b.ramp || Math.min(0.025, (b.b - b.a) * 0.35)), 0, 1);
      if (i === 0) k = Math.max(k, loadK);
      if (Math.abs(op - b.op) > 0.004 || (op > 0 && b.op <= 0) || (op <= 0 && b.op > 0)) {
        b.op = op; b.el.style.opacity = op.toFixed(3); b.el.classList.toggle('on', op > 0.02);
      }
      if (Math.abs(k - b.k) > 0.008 || k === 0 || k === 1) { if (k !== b.k) { b.k = k; b.el.style.setProperty('--k', k.toFixed(3)); } }
    });
    if (cue) { const show = p < 0.04; if (cue.hidden === show) cue.hidden = !show; }
    // senza video, il poster racconta comunque il viaggio: partenza, poi arrivo
    if (stage.classList.contains('video-failed')) {
      const want = p > 0.55 ? 'end' : 'start';
      if (want !== posterState) { posterState = want; posterLayer.style.backgroundImage = "url('" + (want === 'end' ? ENDING_URL : POSTER_URL) + "')"; }
    }
  }

  /* ---- seek con gate (anti-deadlock) ---- */
  let seekBusy = false, pendingTime = null;
  function requestSeek(t) {
    if (!video.duration || !isFinite(t)) return;
    if (seekBusy) { pendingTime = t; return; }
    seekBusy = true; video.currentTime = t;
  }
  video.addEventListener('seeked', () => { seekBusy = false; if (pendingTime !== null) { const t = pendingTime; pendingTime = null; requestSeek(t); } });
  video.addEventListener('error', () => { seekBusy = false; pendingTime = null; if (filmOn) filmFail(); else failVideo(); });

  /* ---- lerp con rAF che riposa ---- */
  let target = 0, shown = 0, rafId = null, lastTick = 0, heroOnScreen = true;
  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now)); lastTick = now;
    const k = 0.16;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));
    if (loadStart !== null && loadK < 1) { loadK = clamp((now - loadStart) / 1400, 0, 1); loadK = loadK * loadK * (3 - 2 * loadK); }
    const converged = Math.abs(target - shown) < 0.0005 && (loadK >= 1 || loadStart === null);
    if (converged) { shown = target; rafId = null; lastTick = 0; } else { rafId = requestAnimationFrame(tick); }
    if (video.duration) requestSeek(shown * video.duration);
    updateCaptions(shown);
  }
  function onScroll() { if (!scrubOn) return; target = heroProgress(); if (rafId === null && heroOnScreen) rafId = requestAnimationFrame(tick); }
  new IntersectionObserver(([en]) => {
    heroOnScreen = en.isIntersecting;
    if (heroOnScreen) onScroll();
    if (filmOn && !filmEnded && video.readyState >= 3) { if (heroOnScreen) video.play().catch(() => {}); else video.pause(); }
  }).observe(hero);

  /* ---- Blob in streaming dietro l'anello ---- */
  let started = false, inited = false, blobUrl = null;
  function startBlobFetch() { if (started) return; started = true; loadHeroBlob().catch(failVideo); }
  function initHeroOnce() {
    if (inited) return; inited = true;
    posterLayer.style.backgroundImage = "url('" + POSTER_URL + "')";
    const img = new Image(); img.onload = startBlobFetch; img.onerror = startBlobFetch; img.src = POSTER_URL;
    setTimeout(startBlobFetch, 4000);
    loadStart = performance.now();
  }
  async function loadHeroBlob() {
    if (!VIDEO_URL || location.protocol === 'file:') throw new Error('no video');
    const ctrl = new AbortController();
    let watchdog = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(VIDEO_URL, { priority: 'low', signal: ctrl.signal });
    if (!res.ok) throw new Error('http ' + res.status);
    const total = Number(res.headers.get('Content-Length')) || VIDEO_BYTES;
    const reader = res.body.getReader(); const chunks = []; let got = 0, lastRing = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      clearTimeout(watchdog); watchdog = setTimeout(() => ctrl.abort(), 20000);
      chunks.push(value); got += value.length;
      const frac = Math.min(1, got / total); const now = performance.now();
      if (now - lastRing > 100 || frac === 1) { lastRing = now; ring.style.setProperty('--ld', Math.round(126 * (1 - frac))); }
    }
    clearTimeout(watchdog);
    ring.style.setProperty('--ld', 0);
    blobUrl = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
    if (filmOn) return; // nel frattempo siamo passati al film: lo scrub riprenderà il blob quando tornerà attivo
    video.src = blobUrl;
    video.load();
    video.addEventListener('canplay', () => {
      requestSeek(heroProgress() * video.duration);
      stage.classList.add('video-ready');
      ring.classList.add('done');
    }, { once: true });
  }
  function failVideo() { ring.classList.add('failed'); stage.classList.add('video-failed'); }

  /* ---- i cinque gate del hero statico, decisi dal vivo ---- */
  const GATES = [
    '(max-width: 720px)',
    '(orientation: portrait) and (max-width: 1024px)',
    '(orientation: portrait) and (pointer: coarse)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];
  let scrubOn = false;
  function enableScrub() {
    if (scrubOn) return; scrubOn = true;
    initHeroOnce();
    if (blobUrl && video.src !== blobUrl) { video.src = blobUrl; video.load(); video.addEventListener('canplay', () => { stage.classList.add('video-ready'); requestSeek(heroProgress() * video.duration); }, { once: true }); }
    addEventListener('scroll', onScroll, { passive: true });
    bands.forEach(b => { b.op = -1; b.k = -1; });
    if (window.baboo && window.baboo.unpinFinalStates) window.baboo.unpinFinalStates();
    updateCaptions(heroProgress()); onScroll();
  }
  function disableScrub() {
    if (!scrubOn) return; scrubOn = false;
    removeEventListener('scroll', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    bands.forEach(b => { b.el.style.removeProperty('--k'); b.el.style.removeProperty('opacity'); b.el.classList.remove('on'); b.op = -1; b.k = -1; });
  }
  /* ---- modalità film: su telefono e tablet il video verticale si guarda da solo ---- */
  let filmOn = false, filmRaf = null, filmEnded = false;
  function filmEligible() {
    if (!FILM_URL || location.protocol === 'file:') return false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const c = navigator.connection; if (c && c.saveData) return false;
    return true;
  }
  function filmTick() {
    filmRaf = null;
    if (!filmOn) return;
    const p = video.duration ? clamp(video.currentTime / video.duration, 0, 1) : 0;
    updateCaptions(p);
    if (skipBtn) { const hide = filmEnded || p > 0.74; if (skipBtn.hidden !== hide) skipBtn.hidden = hide; }
    if (!video.paused && !video.ended) filmRaf = requestAnimationFrame(filmTick);
  }
  function onFilmPlay() { if (filmRaf === null) filmRaf = requestAnimationFrame(filmTick); }
  function onFilmEnded() { filmEnded = true; updateCaptions(1); if (skipBtn) skipBtn.hidden = true; }
  function filmFail() { disableFilm(); disableScrub(); }
  function enableFilm() {
    if (filmOn) return; filmOn = true; filmEnded = false;
    disableScrub();
    hero.classList.add('film');
    posterLayer.style.backgroundImage = "url('" + FILM_POSTER + "')";
    stage.classList.remove('video-failed', 'video-ready');
    bands.forEach(b => { b.op = -1; b.k = -1; });
    updateCaptions(0);
    video.loop = false; video.muted = true; video.playsInline = true; video.preload = 'auto';
    video.addEventListener('play', onFilmPlay);
    video.addEventListener('ended', onFilmEnded);
    video.addEventListener('canplay', onFilmCanPlay);
    video.src = FILM_URL; video.load();
    if (skipBtn) skipBtn.hidden = false;
  }
  function onFilmCanPlay() {
    if (!filmOn) return;
    stage.classList.add('video-ready');
    if (heroOnScreen && !filmEnded) video.play().catch(filmFail);
  }
  function disableFilm() {
    if (!filmOn) return; filmOn = false;
    video.removeEventListener('play', onFilmPlay); video.removeEventListener('ended', onFilmEnded); video.removeEventListener('canplay', onFilmCanPlay);
    if (filmRaf !== null) { cancelAnimationFrame(filmRaf); filmRaf = null; }
    video.pause();
    hero.classList.remove('film'); stage.classList.remove('video-ready');
    posterLayer.style.removeProperty('background-image');
    if (skipBtn) skipBtn.hidden = true;
    bands.forEach(b => { b.el.style.removeProperty('--k'); b.el.style.removeProperty('opacity'); b.el.classList.remove('on'); b.op = -1; b.k = -1; });
    if (blobUrl) { video.src = blobUrl; video.load(); } else { video.removeAttribute('src'); video.load(); }
  }
  if (skipBtn) skipBtn.addEventListener('click', () => { if (video.duration) { video.currentTime = Math.max(0, video.duration - 0.05); if (video.paused) video.play().catch(() => onFilmEnded()); } else onFilmEnded(); });
  function applyHeroMode() {
    if (GATES.some(q => matchMedia(q).matches)) { if (filmEligible()) enableFilm(); else { disableFilm(); disableScrub(); } }
    else { disableFilm(); enableScrub(); }
  }
  const MQLS = GATES.map(q => matchMedia(q));
  MQLS.forEach(m => m.addEventListener('change', applyHeroMode));
  window.baboo = window.baboo || {};
  window.baboo.applyHeroMode = applyHeroMode;
  applyHeroMode();
})();
