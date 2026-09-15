/* Baboo · Home: filo della temperatura, momento interattivo MONITOR, FAQ, form, ridotto movimento dal vivo */
(function () {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  window.baboo = window.baboo || {};

  /* ---------- il filo della temperatura (firma): si disegna con lo scroll ---------- */
  const wire = document.querySelector('.wire');
  const wirePath = document.getElementById('wire-path');
  let wireOn = false, wireRaf = null, lastWire = -1;
  function layoutWire() {
    if (!wire) return;
    const start = document.querySelector('.creds');
    const end = document.querySelector('.contact');
    if (!start || !end) return;
    const top = start.offsetTop, bottom = end.offsetTop + 40;
    wire.style.top = top + 'px'; wire.style.height = (bottom - top) + 'px';
    const left = Math.max(0, (innerWidth - 1280) / 2) + (innerWidth <= 600 ? 8 : 18);
    wire.style.left = (left - 6) + 'px'; wire.style.width = '12px';
    wire.setAttribute('viewBox', '0 0 12 ' + (bottom - top));
    const h = bottom - top;
    wirePath.setAttribute('d', 'M6 0 C 6 ' + (h * 0.12) + ', 6 ' + (h * 0.12) + ', 6 ' + (h * 0.25) + ' S 6 ' + (h * 0.5) + ', 6 ' + (h * 0.62) + ' S 6 ' + (h * 0.85) + ', 6 ' + h);
    const len = wirePath.getTotalLength();
    wirePath.style.strokeDasharray = len; if (!wire.classList.contains('pinned')) wirePath.style.strokeDashoffset = len * (1 - Math.max(0, lastWire));
  }
  function drawWire() {
    wireRaf = null;
    if (!wire || wire.classList.contains('pinned')) return;
    const r = wire.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / r.height));
    if (Math.abs(p - lastWire) < 0.004) return;
    lastWire = p;
    const len = wirePath.getTotalLength();
    wirePath.style.strokeDashoffset = len * (1 - p);
  }
  function onWireScroll() { if (wireRaf === null) wireRaf = requestAnimationFrame(drawWire); }
  function armWire() { if (wireOn) return; wireOn = true; wire.classList.remove('pinned'); layoutWire(); lastWire = -1; addEventListener('scroll', onWireScroll, { passive: true }); drawWire(); }
  function disarmWire() { wireOn = false; removeEventListener('scroll', onWireScroll); wire.classList.add('pinned'); wirePath.style.strokeDashoffset = 0; }
  addEventListener('resize', () => { layoutWire(); if (wireOn) { lastWire = -1; drawWire(); } });
  addEventListener('load', layoutWire);

  /* ---------- MONITOR: tieni premuto e la temperatura si stabilizza ---------- */
  const hold = document.getElementById('hold');
  const lineEl = document.getElementById('temp-line');
  const glowEl = document.getElementById('temp-glow');
  const delta = document.getElementById('delta');
  const monLines = [...document.querySelectorAll('.mon-lines li')];
  const monitor = document.querySelector('.monitor');
  let prog = 0, holding = false, done = false, monRaf = null, t0 = performance.now(), lastDelta = '', lastDeltaAt = 0;
  const seed = 7;
  function noise(x, t) {
    return Math.sin(x * 0.021 + t * 0.9) * 0.55 + Math.sin(x * 0.047 - t * 1.7 + seed) * 0.3 + Math.sin(x * 0.013 + t * 0.4) * 0.15;
  }
  function pathFor(p, t) {
    const amp = 62 * (1 - p) + 4;         // oscillazione: da nervosa a quasi piatta
    const speed = 1 + (1 - p) * 1.2;
    let d = '';
    for (let x = 0; x <= 600; x += 12) {
      const y = 130 + noise(x, t * speed) * amp;
      d += (x === 0 ? 'M' : 'L') + x + ' ' + y.toFixed(1) + ' ';
    }
    return d;
  }
  function renderMon(now) {
    monRaf = null;
    const t = (now - t0) / 1000;
    const target = holding || done ? 1 : 0;
    const rate = holding ? 0.0065 : 0.012;   // sale lentamente, torna con calma
    if (!done) prog += (target - prog) * (holding ? 0.02 : 0.03) + (holding ? rate * 0.6 : 0) * 0;
    prog = Math.min(1, Math.max(0, holding ? prog + rate : (done ? 1 : prog - rate)));
    const d = pathFor(prog, t);
    lineEl.setAttribute('d', d); glowEl.setAttribute('d', d);
    hold.style.setProperty('--p', prog.toFixed(3));
    const dv = (1.8 - 1.6 * prog).toFixed(1).replace('.', ',');
    const label = 'Δ ' + dv + ' °C';
    if (now - lastDeltaAt > 100 && label !== lastDelta) { lastDelta = label; lastDeltaAt = now; delta.textContent = label; }
    if (prog >= 1 && holding && !done) complete();
    const idle = !holding && !done && prog <= 0 && !monitor.classList.contains('live');
    if (!idle || holding || done) monRaf = requestAnimationFrame(renderMon);
    else monRaf = requestAnimationFrame(renderMon); // la linea resta viva a livello di sussurro quando in vista
  }
  function complete() {
    done = true; holding = false; prog = 1;
    hold.classList.add('done'); hold.setAttribute('aria-pressed', 'true');
    monLines.forEach(li => li.classList.add('lit'));
  }
  function startHold(e) { if (done) return; e.preventDefault(); holding = true; hold.setAttribute('aria-pressed', 'true'); kickMon(); }
  function endHold() { if (done) return; holding = false; hold.setAttribute('aria-pressed', 'false'); }
  function kickMon() { if (monRaf === null && !document.hidden) monRaf = requestAnimationFrame(renderMon); }
  if (hold && lineEl) {
    hold.addEventListener('pointerdown', startHold);
    hold.addEventListener('pointerup', endHold);
    hold.addEventListener('pointerleave', endHold);
    hold.addEventListener('pointercancel', endHold);
    hold.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !holding) { e.preventDefault(); holding = true; kickMon(); } });
    hold.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') endHold(); });
    hold.addEventListener('contextmenu', e => e.preventDefault());
    new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) kickMon(); else if (monRaf !== null && !holding) { cancelAnimationFrame(monRaf); monRaf = null; } });
    }, { threshold: 0.05 }).observe(monitor);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kickMon(); });
    lineEl.setAttribute('d', pathFor(0, 0)); glowEl.setAttribute('d', pathFor(0, 0));
  }

  /* ---------- tre passi: micro-zoom all'ingresso ---------- */
  const stairs = document.querySelectorAll('.stair li');
  if ('IntersectionObserver' in window) {
    const so = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in-view'); so.unobserve(en.target); } }), { threshold: 0.3 });
    stairs.forEach(li => so.observe(li));
  }

  /* ---------- FAQ: un'apertura alla volta, con easing ---------- */
  const details = [...document.querySelectorAll('.acc details')];
  details.forEach(d => {
    d.addEventListener('toggle', () => { if (d.open) details.forEach(o => { if (o !== d) o.open = false; }); });
  });

  /* ---------- form: endpoint configurabile, altrimenti mail precompilata ---------- */
  const form = document.getElementById('lead-form');
  if (form) {
    const msg = form.querySelector('.form-msg');
    form.querySelectorAll('input,select').forEach(el => el.addEventListener('blur', () => el.classList.add('touched')));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      form.querySelectorAll('input,select').forEach(el => el.classList.add('touched'));
      if (!form.checkValidity()) { msg.textContent = 'Controlla i campi evidenziati: ci servono per richiamarti.'; form.querySelector(':invalid').focus(); return; }
      const data = Object.fromEntries(new FormData(form).entries());
      const endpoint = form.getAttribute('data-endpoint');
      const thanks = 'Grazie. Ti richiamiamo entro il prossimo giorno lavorativo per fissare la data.';
      if (endpoint) {
        try {
          const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) });
          if (!r.ok) throw new Error('http ' + r.status);
          form.classList.add('sent'); msg.textContent = thanks; return;
        } catch (err) { /* si passa alla mail */ }
      }
      const body = 'Richiesta di sopralluogo gratuito dal sito baboo.eu\n\nNome: ' + data.nome + '\nTelefono: ' + data.telefono + '\nEmail: ' + data.email + '\nComune: ' + data.comune + '\nIntervento: ' + data.intervento + '\n';
      location.href = 'mailto:info@baboo.eu?subject=' + encodeURIComponent('Sopralluogo gratuito: ' + data.comune) + '&body=' + encodeURIComponent(body);
      form.classList.add('sent');
      msg.textContent = 'Si è aperta la tua posta con la richiesta già scritta: premi Invia. ' + thanks;
    });
  }

  /* ---------- ridotto movimento: stati finali, in entrambe le direzioni ---------- */
  function pinToFinalStates() {
    if (wire) disarmWire();
    if (hold && !done) { complete(); }
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in', 'done'));
    stairs.forEach(li => li.classList.add('in-view'));
  }
  window.baboo.unpinFinalStates = function () { if (wire) armWire(); };
  if (reduced.matches) pinToFinalStates(); else if (wire) armWire();
  reduced.addEventListener('change', e => {
    if (e.matches) pinToFinalStates();
    else if (window.baboo.applyHeroMode) window.baboo.applyHeroMode();
  });
})();
