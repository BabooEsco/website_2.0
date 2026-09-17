/* Baboo · modalità vetrina (kiosk): le pagine scorrono da sole a rotazione, per showroom e fiere.
   Entrata e uscita: pressione lunga (3 s) sul testo "ESCo certificata UNI CEI 11352" nel footer, oppure sul chip "Vetrina".
   Un tocco mette in pausa e lascia navigare; dopo 60 s di inattività riparte. Esc esce. */
(function () {
  'use strict';
  const KEY = 'baboo_kiosk';          // '1' quando la vetrina è attiva
  const KEY_IDX = 'baboo_kiosk_idx';  // indice della pagina corrente nella rotazione
  const KEY_LAST = 'baboo_kiosk_last';// ultimo tocco del visitatore (ms)
  const IDLE_MS = 60000;              // inattività prima di riprendere
  const HOLD_MS = 3000;               // pressione lunga per entrare/uscire
  const SPEED = 70;                   // px al secondo durante lo scorrimento (passo di lettura lento)
  const HERO_SPEED = 210;             // px al secondo dentro il hero a scorrimento (il video dura ~45 s)
  const RAMP_MS = 2000;               // accelerazione dolce all'avvio, senza strappo
  const END_PAUSE = 4500;             // sosta in fondo alla pagina prima di cambiare
  const END_PAUSE_HERO = 7000;        // sosta sul fotogramma finale del video (titolo e pulsanti) prima di cambiare
  const root = document.documentElement.getAttribute('data-root') || './';
  const PAGES = ['', 'baboo-casa/', 'linee/solero/', 'linee/clima/', 'business/', 'care/', 'linee/miniclima/', 'linee/mountainview/', 'showroom/', 'chi-siamo/'];

  const ss = {
    get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { sessionStorage.removeItem(k); } catch (e) {} }
  };
  const on = () => ss.get(KEY) === '1';

  /* ---- pressione lunga con anello di conferma ---- */
  function holdable(el, done) {
    let t = null;
    const start = e => { if (e.button && e.button !== 0) return; el.classList.add('holding'); t = setTimeout(() => { t = null; el.classList.remove('holding'); done(); }, HOLD_MS); };
    const cancel = () => { if (t) { clearTimeout(t); t = null; } el.classList.remove('holding'); };
    el.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, cancel));
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  /* ---- entrata e uscita ---- */
  function enter() {
    ss.set(KEY, '1'); ss.set(KEY_IDX, '0'); ss.del(KEY_LAST);
    const de = document.documentElement;
    if (de.requestFullscreen) de.requestFullscreen().catch(() => {});
    location.href = root + PAGES[0];
  }
  function exit() {
    ss.del(KEY); ss.del(KEY_IDX); ss.del(KEY_LAST);
    stopScroll();
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    document.documentElement.classList.remove('kiosk');
    location.href = root;
  }

  /* ---- scorrimento automatico ---- */
  let raf = null, last = 0, endTimer = null, idleTimer = null, paused = false, pos = 0, t0 = 0;
  function stopScroll() { if (raf) cancelAnimationFrame(raf); raf = null; last = 0; clearTimeout(endTimer); endTimer = null; }
  // nelle pagine con il video a scorrimento la vetrina percorre solo il hero: il video arriva alla fine e lì si ferma
  function scrubHero() { const h = document.querySelector('.hero'); return (h && h.offsetHeight > innerHeight * 2) ? h : null; }
  function maxY() { const h = scrubHero(); return Math.max(0, (h ? h.offsetHeight : document.documentElement.scrollHeight) - innerHeight); }
  function inHero() { const h = scrubHero(); return !!h && scrollY < h.offsetHeight - innerHeight; }
  function step(now) {
    raf = null;
    if (!on() || paused) return;
    if (!last) { last = now; t0 = now; pos = scrollY; }
    const dt = Math.min(34, now - last); last = now;
    // posizione in virgola mobile: non si rilegge scrollY (arrotondato), così il passo resta uniforme
    const ramp = Math.min(1, (now - t0) / RAMP_MS); const ease = ramp * ramp * (3 - 2 * ramp);
    const speed = (inHero() ? HERO_SPEED : SPEED) * ease;
    pos = Math.min(maxY(), pos + speed * dt / 1000);
    scrollTo(0, pos);
    if (pos >= maxY() - 0.5) { endTimer = setTimeout(nextPage, scrubHero() ? END_PAUSE_HERO : END_PAUSE); return; }
    raf = requestAnimationFrame(step);
  }
  function startScroll(delay) {
    stopScroll();
    endTimer = setTimeout(() => { last = 0; raf = requestAnimationFrame(step); }, delay);
  }
  function nextPage() {
    if (!on()) return;
    const i = (parseInt(ss.get(KEY_IDX) || '0', 10) + 1) % PAGES.length;
    ss.set(KEY_IDX, String(i));
    location.href = root + PAGES[i];
  }

  /* ---- pausa al tocco, ripresa dopo inattività ---- */
  function touched() {
    if (!on()) return;
    ss.set(KEY_LAST, String(Date.now()));
    if (!paused) { paused = true; stopScroll(); document.documentElement.classList.add('kiosk-paused'); }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(resume, IDLE_MS);
  }
  function resume() {
    if (!on()) return;
    paused = false; document.documentElement.classList.remove('kiosk-paused');
    ss.del(KEY_LAST);
    // il visitatore può essere andato altrove: si riparte dall'alto della pagina in cui si trova
    scrollTo({ top: 0, behavior: 'smooth' });
    startScroll(1200);
  }

  /* ---- chip di stato ---- */
  function chip() {
    const c = document.createElement('button');
    c.type = 'button'; c.className = 'kiosk-chip';
    c.innerHTML = '<span class="dot"></span><b>Vetrina</b><span class="hint">tieni premuto per uscire</span><span class="paused-hint">in pausa · riparte tra un minuto</span>';
    c.addEventListener('click', e => e.stopPropagation());
    holdable(c, exit);
    document.body.appendChild(c);
  }

  /* ---- avvio ---- */
  const trigger = document.querySelector('.kiosk-trigger');
  if (trigger) holdable(trigger, () => on() ? exit() : enter());

  if (on()) {
    document.documentElement.classList.add('kiosk');
    chip();
    // se la pagina è in una posizione della rotazione sconosciuta (navigazione manuale), riallinea l'indice
    const path = location.pathname.replace(/index\.html$/, '');
    const idx = PAGES.findIndex((p, i) => i > 0 && path.endsWith('/' + p));
    if (idx >= 0) ss.set(KEY_IDX, String(idx));
    ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, e => { if (ev === 'keydown' && e.key === 'Escape') { exit(); return; } touched(); }, { passive: true }));
    const lastTouch = parseInt(ss.get(KEY_LAST) || '0', 10);
    const since = Date.now() - lastTouch;
    if (lastTouch && since < IDLE_MS) { paused = true; document.documentElement.classList.add('kiosk-paused'); idleTimer = setTimeout(resume, IDLE_MS - since); }
    else {
      // la decisione si prende dopo che hero.js ha scelto la modalità (scrub, film o statico): gli script sono in coda,
      // e il hero a scorrimento è riconoscibile solo dall'altezza che il CSS gli dà
      endTimer = setTimeout(() => {
        const hero = document.querySelector('.hero[data-video]');
        if (hero && !scrubHero()) {
          // telefono e tablet: il film si guarda fino alla fine (o l'immagine ferma resta qualche secondo), poi pagina successiva, senza scorrere
          const v = hero.querySelector('video'); let done = false;
          const go = () => { if (done) return; done = true; clearTimeout(endTimer); endTimer = setTimeout(nextPage, END_PAUSE_HERO); };
          if (v) v.addEventListener('ended', go, { once: true });
          endTimer = setTimeout(go, hero.classList.contains('film') ? 22000 : 6000);
        } else startScroll(0);
      }, 1800);
    }
  }
})();
