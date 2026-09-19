/* Baboo · pagina Assistenza: schede "tre controlli" e richiesta di assistenza come percorso guidato nel telefono
   (<dialog id="richiesta">, una domanda per schermata, come il simulatore del canone). Invio al relè /api/ticket
   (Odoo Helpdesk): le foto viaggiano nel JSON in base64, ridotte a 1600 px prima di partire. Se il relè non
   risponde, ripiego sulla mail verso assistenza@baboo.eu (che apre comunque un ticket). */
(function () {
  'use strict';
  const root = document.documentElement.getAttribute('data-root') || '';
  const PRIVACY_V = '2026-09';
  const MAX_FILES = 3, MAX_BYTES = 8 * 1024 * 1024, MAX_SIDE = 1600;
  const ss = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };

  /* ---- schede per tipo di impianto ---- */
  document.querySelectorAll('[data-tabs]').forEach(box => {
    const tabs = [...box.querySelectorAll('[role="tab"]')];
    const panels = [...box.querySelectorAll('[role="tabpanel"]')];
    const show = tab => {
      tabs.forEach(t => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      panels.forEach(p => { p.hidden = p.id !== tab.getAttribute('aria-controls'); });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => show(t));
      t.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return; e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); show(n);
      });
    });
    if (tabs.length) show(tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0]);
  });

  /* ---- il telefono ---- */
  const dlg = document.getElementById('richiesta');
  const form = dlg && dlg.querySelector('#ticket-form');
  if (!dlg || !form) return;
  const endpoint = form.getAttribute('data-endpoint') || (root + 'api/ticket');
  const steps = [...form.querySelectorAll('.step')];
  const count = form.querySelector('.count'), dots = form.querySelector('.dots');
  const back = form.querySelector('[data-act="back"]'), next = form.querySelector('[data-act="next"]');
  const msg = form.querySelector('.form-msg');
  const body = form.querySelector('.sim-body');
  const LAST = steps.length - 2;          /* l'ultimo .step è la schermata di esito */
  let step = 0, sent = false;

  /* campo-esca */
  const hp = document.createElement('input');
  hp.type = 'text'; hp.name = 'hp'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.setAttribute('aria-hidden', 'true');
  hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
  form.appendChild(hp);

  /* opzioni a pulsante: stato visivo + avanzamento automatico */
  form.querySelectorAll('.opts').forEach(g => g.addEventListener('change', e => {
    g.querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o.querySelector('input').checked));
    if (e.target.type === 'radio' && step < LAST) setTimeout(() => go(step + 1), 180);
  }));

  /* allegati */
  const fileInput = form.querySelector('input[type="file"]');
  const fileList = form.querySelector('.files');
  let files = [];
  const fmt = b => b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB';
  const renderFiles = () => {
    fileList.innerHTML = '';
    files.forEach((f, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span></span> <small></small> <button type="button" aria-label="Togli il file"></button>';
      li.querySelector('span').textContent = f.name; li.querySelector('small').textContent = fmt(f.size);
      li.querySelector('button').addEventListener('click', () => { files.splice(i, 1); renderFiles(); nav(); });
      fileList.appendChild(li);
    });
    fileInput.value = '';
  };
  fileInput.addEventListener('change', () => {
    const errs = [];
    [...fileInput.files].forEach(f => {
      if (files.length >= MAX_FILES) { errs.push('Al massimo ' + MAX_FILES + ' file.'); return; }
      if (f.size > MAX_BYTES) { errs.push(f.name + ' supera gli 8 MB.'); return; }
      if (!/^image\//.test(f.type) && f.type !== 'application/pdf' && !/\.(heic|heif|pdf|jpe?g|png|webp)$/i.test(f.name)) { errs.push(f.name + ': formato non accettato.'); return; }
      files.push(f);
    });
    renderFiles(); nav();
    note(errs.join(' '));
  });
  const toBase64 = blob => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(blob); });
  async function pack(f) {
    let blob = f, type = f.type || 'application/octet-stream', name = f.name;
    if (/^image\//.test(type) && type !== 'image/gif' && f.size > 400e3) {
      try {
        const bmp = await createImageBitmap(f);
        const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
        if (k < 1 || type === 'image/heic' || type === 'image/heif') {
          const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
          c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
          const out = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.82));
          if (out && out.size < f.size) { blob = out; type = 'image/jpeg'; name = name.replace(/\.[^.]+$/, '') + '.jpg'; }
        }
        bmp.close && bmp.close();
      } catch (e) { /* si manda l'originale */ }
    }
    return { name, type, data: await toBase64(blob) };
  }

  /* ---- motore dei passi ---- */
  const fields = s => [...s.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(el => el.name !== 'hp');
  const answered = s => fields(s).some(el => el.type === 'radio' || el.type === 'checkbox' ? el.checked : el.type === 'file' ? files.length : el.value.trim());
  const note = t => { const n = steps[step].querySelector('.err'); if (n) n.textContent = t || ''; };
  function valid(s) {
    const fs = fields(s);
    fs.forEach(el => el.classList.add('touched'));
    const bad = fs.find(el => !el.checkValidity());
    if (!bad) return true;
    note(bad.type === 'checkbox' ? 'Serve la spunta sulla privacy per inviare.' : bad.type === 'radio' ? 'Scegli una voce per continuare.' : bad.validity.valueMissing ? 'Questo ci serve per aiutarti.' : 'Controlla il formato.');
    bad.focus({ preventScroll: true });
    return false;
  }
  function nav() {
    const s = steps[step], opt = s.hasAttribute('data-opt'), hasOpts = !!s.querySelector('.opts');
    count.textContent = step <= LAST ? (step + 1) + ' di ' + (LAST + 1) : 'Fatto';
    dots.innerHTML = ''; for (let i = 0; i <= LAST; i++) { const li = document.createElement('li'); li.className = i < step ? 'done' : i === step ? 'now' : ''; dots.appendChild(li); }
    back.style.visibility = step > 0 && step <= LAST ? 'visible' : 'hidden';
    if (step > LAST) { next.textContent = 'Chiudi'; next.disabled = false; next.dataset.act = 'close'; return; }
    next.dataset.act = 'next';
    if (step === LAST) { next.textContent = 'Invia'; next.disabled = false; return; }
    next.textContent = opt && !answered(s) ? 'Salta' : 'Avanti';
    next.disabled = hasOpts && !opt && !answered(s);   /* con le opzioni obbligatorie si avanza scegliendo */
  }
  function go(i) {
    if (i > step && step <= LAST && !steps[step].hasAttribute('data-opt') && !valid(steps[step])) return;
    step = Math.max(0, Math.min(i, steps.length - 1));
    steps.forEach((s, j) => { s.hidden = j !== step; });
    if (step === LAST) summary();
    nav(); note('');
    body.scrollTop = 0;
    const h = steps[step].querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    const first = fields(steps[step]).find(el => el.type !== 'radio' && el.type !== 'file' && el.type !== 'checkbox');
    if (first && matchMedia('(min-width: 600px)').matches) setTimeout(() => first.focus({ preventScroll: true }), 60);
  }
  function summary() {
    const d = Object.fromEntries(new FormData(form).entries());
    const dl = form.querySelector('.sum'); dl.innerHTML = '';
    [['Impianto', d.impianto], ['Fermo', d.fermo], ['Da quando', d.da_quando], ['Cosa succede', d.messaggio], ['Foto', files.length ? files.length + (files.length === 1 ? ' file' : ' file') : ''], ['Dove', d.indirizzo], ['Nome', d.nome], ['Telefono', d.telefono], ['Email', d.email], ['Care', d.care]]
      .filter(([, v]) => v && String(v).trim()).forEach(([k, v]) => {
        const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; dl.appendChild(dt); dl.appendChild(dd);
      });
  }
  form.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'back') go(step - 1);
    else if (act === 'close') close();
    else if (act === 'next') step === LAST ? send() : go(step + 1);
    else if (act === 'goto') go(+b.dataset.step);
  });
  form.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.type === 'file' || e.target.tagName === 'BUTTON') return;
    e.preventDefault(); if (step < LAST) go(step + 1); else send();
  });
  form.addEventListener('submit', e => { e.preventDefault(); send(); });
  form.querySelectorAll('input,textarea').forEach(el => el.addEventListener('blur', () => el.classList.add('touched')));

  /* ---- invio ---- */
  async function send() {
    if (sent || !valid(steps[LAST])) return;
    const data = Object.fromEntries(new FormData(form).entries()); delete data.file;
    next.disabled = true; next.textContent = files.length ? 'Invio con le foto…' : 'Invio…';
    let utm = null; try { utm = JSON.parse(ss('baboo_utm') || 'null'); } catch (err) { }
    const payload = Object.assign({}, data, {
      privacy: !!data.privacy, privacy_v: PRIVACY_V, pagina: location.pathname, referrer: ss('baboo_ref') || document.referrer || '', utm: utm || undefined,
      allegati: await Promise.all(files.map(pack)),
    });
    let outcome = null;
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 60000);
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal });
      clearTimeout(t);
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) outcome = { ok: true, ref: j.ref || ('#' + j.id) };
      else if (r.status === 400) { next.disabled = false; next.textContent = 'Invia'; return note('Controlla nome, telefono, email, indirizzo e la spunta privacy.'); }
      else if (r.status === 413) { next.disabled = false; next.textContent = 'Invia'; return note('Le foto sono troppo pesanti: togline una e riprova.'); }
      else if (r.status === 429) { next.disabled = false; next.textContent = 'Invia'; return note('Abbiamo già ricevuto diverse richieste da questa connessione. Se è urgente chiamaci: 0323 63934.'); }
    } catch (err) { /* si passa alla mail */ }
    sent = true;
    if (outcome) {
      msg.innerHTML = '<span class="kicker">Richiesta ricevuta</span><h2>Numero <b class="ref"></b></h2><p>Ti abbiamo mandato una mail di conferma a <b class="m"></b>. Un tecnico legge la richiesta e ti richiama al <b class="t"></b>.</p><p class="hint">Se nel frattempo cambia qualcosa, rispondi alla mail: resta tutto nella stessa pratica.</p>';
      msg.querySelector('.ref').textContent = outcome.ref; msg.querySelector('.m').textContent = data.email; msg.querySelector('.t').textContent = data.telefono;
    } else {
      const righe = [['Nome', data.nome], ['Telefono', data.telefono], ['Email', data.email], ['Indirizzo impianto', data.indirizzo], ['Impianto', data.impianto], ['Impianto fermo', data.fermo], ['Da quando', data.da_quando], ['Cliente Care', data.care], ['Cosa succede', data.messaggio]].filter(([, v]) => v);
      const testo = 'Richiesta di assistenza dal sito baboo.eu\n\n' + righe.map(([k, v]) => k + ': ' + v).join('\n') + (files.length ? '\n\n(Allega qui le foto scelte: ' + files.map(f => f.name).join(', ') + ')' : '') + '\n';
      location.href = 'mailto:assistenza@baboo.eu?subject=' + encodeURIComponent('Assistenza · ' + (data.impianto || '') + ' · ' + (data.nome || '')) + '&body=' + encodeURIComponent(testo);
      msg.innerHTML = '<span class="kicker">Un passaggio in più</span><h2>Non riusciamo a inviare da qui.</h2><p>Si è aperta la tua posta con il testo già pronto per <b>assistenza@baboo.eu</b>: allega le foto e premi Invia. La richiesta si apre lo stesso.</p>';
    }
    go(steps.length - 1);
  }

  /* ---- apertura e chiusura, come il simulatore ---- */
  function open() {
    if (dlg.open) return;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    document.documentElement.classList.add('sim-open');
    go(step);
  }
  function close() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', () => {
    document.documentElement.classList.remove('sim-open');
    if (location.hash === '#richiesta') history.replaceState(null, '', location.pathname + location.search);
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  dlg.querySelector('.sim-close').addEventListener('click', close);
  document.querySelectorAll('a[href="#richiesta"],a[href$="assistenza/#richiesta"]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const imp = a.getAttribute('data-impianto');   /* dai "tre controlli": il tipo di impianto è già scelto */
    if (imp) { const r = form.querySelector('input[name="impianto"][value="' + imp.replace(/"/g, '\\"') + '"]'); if (r) { r.checked = true; r.closest('.opts').querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o.querySelector('input').checked)); if (step === 0) step = 1; } }
    if (location.hash !== '#richiesta') history.replaceState(null, '', '#richiesta');
    open();
  }));
  window.addEventListener('hashchange', () => { if (location.hash === '#richiesta') open(); });
  if (location.hash === '#richiesta') open();
})();
