/* Baboo · pagina Manutenzione: prenotazione della manutenzione programmata come percorso guidato nel telefono
   (<dialog id="prenota">, una domanda per schermata, stesso guscio della richiesta di assistenza). Gli slot liberi
   arrivano dal relè (GET /api/slot, che li calcola sull'agenda del tecnico); la prenotazione va a POST /api/prenotazione,
   che scrive su Odoo (contatto, appuntamento, task) e risponde con l'esito. Nessuna conferma a schermo senza scrittura.
   Modalità dimostrativa (?demo=1, solo su stage e in locale): slot inventati, nessun invio. */
(function () {
  'use strict';
  const root = document.documentElement.getAttribute('data-root') || '';
  const PRIVACY_V = '2026-09';
  const ss = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const DEMO = /[?&]demo=1/.test(location.search) && /^(stage\.baboo\.eu|localhost|127\.0\.0\.1)$/.test(location.hostname);

  const dlg = document.getElementById('prenota');
  const form = dlg && dlg.querySelector('#prenota-form');
  if (!dlg || !form) return;
  const epSlot = form.getAttribute('data-endpoint-slot') || (root + 'api/slot');
  const epBook = form.getAttribute('data-endpoint') || (root + 'api/prenotazione');
  const all = [...form.querySelectorAll('.step')];
  const count = form.querySelector('.count'), dots = form.querySelector('.dots');
  const back = form.querySelector('[data-act="back"]'), next = form.querySelector('[data-act="next"]');
  const msg = form.querySelector('.form-msg');
  const body = form.querySelector('.sim-body');
  const zonaRiga = form.querySelector('.zona-riga');
  const daysBox = form.querySelector('.days');
  const quandoAlt = form.querySelector('.quando-alt');
  let steps = [], step = 0, sent = false, slotData = null, modo = 'slot', shown = 0;
  const val = n => { const el = form.elements[n]; if (!el) return ''; if (el instanceof RadioNodeList) return el.value; return el.value; };

  /* campo-esca */
  const hp = document.createElement('input');
  hp.type = 'text'; hp.name = 'hp'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.setAttribute('aria-hidden', 'true');
  hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
  form.appendChild(hp);

  /* passi attivi: le schermate con data-when="campo=valore" compaiono solo quando la condizione vale */
  function active() {
    return all.filter(s => {
      const w = s.getAttribute('data-when'); if (!w) return true;
      return w.split('&').every(c => { const [k, v] = c.split('='); return val(k) === v; });
    });
  }
  const LAST = () => steps.length - 2;

  /* opzioni a pulsante: avanzamento automatico */
  form.querySelectorAll('.opts').forEach(g => g.addEventListener('change', e => {
    g.querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o.querySelector('input').checked));
    if (e.target.type === 'radio' && step < LAST()) setTimeout(() => go(step + 1), 180);
  }));

  /* ---- comune con elenco (Piemonte e Lombardia) ---- */
  const comune = form.querySelector('input[name="comune"]'), cap = form.querySelector('input[name="cap"]');
  const prov = form.querySelector('input[name="provincia"]');
  const ac = form.querySelector('.ac');
  let comuni = null, comuniP = null;
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function loadComuni() {
    if (comuniP) return comuniP;
    comuniP = fetch(root + 'assets/data/comuni.json').then(r => r.json()).then(j => { comuni = j; return j; }).catch(() => { comuni = []; return comuni; });
    return comuniP;
  }
  function pick(c) {
    comune.value = c[0]; prov.value = c[1]; comune.setCustomValidity('');
    if (c[2] && c[2].length === 1 && !cap.value) cap.value = c[2][0];
    ac.hidden = true; ac.innerHTML = '';
    (cap.value ? fields(steps[step]).find(el => el.name === 'via') : cap).focus({ preventScroll: true });
  }
  function suggest() {
    const q = norm(comune.value.trim());
    prov.value = ''; comune.setCustomValidity(q ? 'Scegli il comune dall\'elenco.' : '');
    if (q.length < 2 || !comuni) { ac.hidden = true; ac.innerHTML = ''; return; }
    const starts = comuni.filter(c => norm(c[0]).startsWith(q));
    const within = starts.length < 6 ? comuni.filter(c => !norm(c[0]).startsWith(q) && norm(c[0]).includes(q)) : [];
    const list = starts.concat(within).slice(0, 6);
    ac.innerHTML = '';
    list.forEach(c => {
      const li = document.createElement('li'); li.setAttribute('role', 'option'); li.tabIndex = -1;
      li.innerHTML = '<b></b> <small></small>'; li.querySelector('b').textContent = c[0]; li.querySelector('small').textContent = c[1];
      li.addEventListener('mousedown', e => { e.preventDefault(); pick(c); });
      ac.appendChild(li);
    });
    if (list.length === 1 && norm(list[0][0]) === q) { pick(list[0]); return; }
    ac.hidden = !list.length;
  }
  if (comune) {
    comune.addEventListener('focus', () => loadComuni().then(suggest));
    comune.addEventListener('input', () => loadComuni().then(suggest));
    comune.addEventListener('blur', () => setTimeout(() => { ac.hidden = true; }, 120));
    comune.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' && !ac.hidden && ac.firstChild) { e.preventDefault(); ac.firstChild.focus(); }
      if (e.key === 'Enter' && !ac.hidden && ac.children.length === 1) { e.preventDefault(); ac.firstChild.dispatchEvent(new Event('mousedown')); }
    });
    ac.addEventListener('keydown', e => {
      const li = e.target.closest('li'); if (!li) return;
      if (e.key === 'ArrowDown' && li.nextSibling) { e.preventDefault(); li.nextSibling.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (li.previousSibling || comune).focus(); }
      else if (e.key === 'Enter') { e.preventDefault(); li.dispatchEvent(new Event('mousedown')); }
    });
  }

  /* ---- gli slot ---- */
  const fmtDay = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'long' });
  const fmtTime = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
  const D = s => new Date(s);
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  function quandoLabel(sl) { return sl.fascia ? sl.fascia : 'ore ' + fmtTime.format(D(sl.inizio)); }
  function slotSummary() {
    const r = form.elements.slot; const v = r && r.value; if (!v || !slotData) return '';
    for (const g of slotData.giorni) for (const sl of g.slot) if (sl.inizio === v) return cap1(fmtDay.format(D(sl.inizio))) + ' · ' + quandoLabel(sl);
    return '';
  }
  function suMisura() {
    return val('servizio') === 'Fotovoltaico' && (val('kwp') !== 'Fino a 6 kWp' || val('lavaggio') === 'Sì, anche il lavaggio');
  }
  async function fetchSlots() {
    const q = new URLSearchParams({ servizio: val('servizio'), comune: val('comune'), provincia: val('provincia'), cliente: val('cliente') });
    if (DEMO) return demoSlots();
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(epSlot + '?' + q, { headers: { 'Accept': 'application/json' }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error('slot ' + r.status);
    return r.json();
  }
  function renderSlots(reset) {
    daysBox.innerHTML = ''; if (reset) shown = 0;
    const giorni = slotData.giorni.filter(g => g.slot.length);
    const vis = giorni.slice(0, shown + 3); shown = vis.length;
    vis.forEach(g => {
      const div = document.createElement('div'); div.className = 'day';
      const h = document.createElement('h3'); h.textContent = cap1(fmtDay.format(D(g.data + 'T12:00:00'))); div.appendChild(h);
      const ul = document.createElement('div'); ul.className = 'slots'; ul.setAttribute('role', 'radiogroup'); ul.setAttribute('aria-label', h.textContent);
      g.slot.forEach(sl => {
        const lab = document.createElement('label'); lab.className = 'slot';
        const inp = document.createElement('input'); inp.type = 'radio'; inp.name = 'slot'; inp.value = sl.inizio; inp.required = true;
        inp.dataset.fine = sl.fine || ''; inp.dataset.conferma = sl.conferma || slotData.conferma || 'auto';
        const b = document.createElement('b'); b.textContent = fmtTime.format(D(sl.inizio));
        lab.appendChild(inp); lab.appendChild(b);
        if (sl.fascia) { const s = document.createElement('small'); s.textContent = sl.fascia; lab.appendChild(s); }
        if ((sl.conferma || slotData.conferma) === 'manuale') { const s = document.createElement('small'); s.className = 'man'; s.textContent = 'ti confermiamo noi'; lab.appendChild(s); }
        ul.appendChild(lab);
      });
      div.appendChild(ul); daysBox.appendChild(div);
    });
    if (giorni.length > shown) {
      const more = document.createElement('button'); more.type = 'button'; more.className = 'lnk more'; more.textContent = 'Mostra altre date';
      more.addEventListener('click', () => renderSlots(false)); daysBox.appendChild(more);
    }
    daysBox.querySelectorAll('input[name="slot"]').forEach(i => i.addEventListener('change', () => {
      daysBox.querySelectorAll('.slot').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
      setTimeout(() => go(step + 1), 180);
    }));
  }
  function setModo(m, testo) {
    modo = m; form.elements.modo.value = m;
    daysBox.hidden = m !== 'slot'; quandoAlt.hidden = m === 'slot';
    if (m !== 'slot') { quandoAlt.textContent = testo; daysBox.innerHTML = ''; }
    nav();
  }
  async function enterQuando() {
    zonaRiga.textContent = '';
    if (suMisura()) return setModo('misura', 'Per il tuo impianto prepariamo un intervento su misura: durata e squadra dipendono dalla taglia e dal contratto. Lasciaci i recapiti e ti richiamiamo con la proposta.');
    setModo('slot', ''); daysBox.innerHTML = '<p class="hint wait">Cerco i posti liberi nella tua zona…</p>';
    try { slotData = await fetchSlots(); }
    catch (e) { slotData = null; return setModo('errore', 'In questo momento non riusciamo a leggere il calendario. Lasciaci i recapiti: ti richiamiamo per fissare giorno e ora. Oppure chiama lo 0323 63934.'); }
    if (!slotData || slotData.zona === 'fuori' || slotData.zona === 'valutare') return setModo('fuori', 'Il tuo comune è fuori dalle zone in cui passiamo ogni settimana. Lasciaci i recapiti: valutiamo la richiesta e ti richiamiamo.');
    if (!slotData.giorni || !slotData.giorni.some(g => g.slot.length)) return setModo('vuoto', 'Nella tua zona non ci sono posti liberi nelle prossime settimane. Lasciaci i recapiti: ti richiamiamo con la prima data possibile.');
    zonaRiga.textContent = slotData.nota || '';
    renderSlots(true);
    if (slotData.sfogo) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'Nella tua zona i prossimi posti sono lontani: ti proponiamo il primo mercoledì libero, e ti confermiamo noi.'; daysBox.prepend(p); }
  }
  /* slot inventati per provare il percorso senza relè (solo stage e locale, con ?demo=1) */
  function demoSlots() {
    const p = val('provincia'); const wd = p === 'VB' ? 1 : /^(NO|VC|BI|AL)$/.test(p) ? 3 : 0;
    if (!wd) return Promise.resolve({ zona: /^(MI|MB|CO|VA|BG|BS|PV|LO|CR|MN|LC|SO|TO|CN|AT)$/.test(p) ? 'valutare' : 'fuori' });
    const man = wd === 3 || val('cliente') !== 'Sì';
    const grid = wd === 1 ? ['08:30', '09:45', '11:00', '14:00'] : ['10:00', '11:30'];
    const giorni = []; const d = new Date(); d.setDate(d.getDate() + 3);
    const pad = n => String(n).padStart(2, '0');
    for (let k = 0, guard = 0; giorni.length < 5 && guard < 120; d.setDate(d.getDate() + 1), guard++) {
      if (d.getDay() !== wd) continue;
      k++; if (k === 2) continue;                       /* il secondo giorno utile è "occupato da un cantiere" */
      const iso = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const slots = grid.filter((_, i) => !(k === 3 && i === 0));   /* nel terzo manca il primo slot */
      giorni.push({ data: iso, slot: slots.map((h, i) => ({ inizio: iso + 'T' + h + ':00', fine: '', fascia: i ? 'fra le ' + h + ' e le ' + pad(+h.slice(0, 2) + 2) + h.slice(2) : '' })) });
    }
    return new Promise(ok => setTimeout(() => ok({ zona: wd === 1 ? 'verbania' : 'lontana', conferma: man ? 'manuale' : 'auto', nota: wd === 1 ? 'Nella tua zona passiamo il lunedì.' : 'Nella tua zona passiamo il mercoledì, a rotazione.', giorni }), 500));
  }

  /* ---- motore dei passi ---- */
  const fields = s => [...s.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(el => el.name !== 'hp');
  const answered = s => fields(s).some(el => el.type === 'radio' || el.type === 'checkbox' ? el.checked : el.value.trim());
  const note = t => { const n = steps[step] && steps[step].querySelector('.err'); if (n) n.textContent = t || ''; };
  function valid(s) {
    if (s.id === 'st-quando' && modo !== 'slot') return true;
    const fs = fields(s);
    fs.forEach(el => el.classList.add('touched'));
    const bad = fs.find(el => !el.checkValidity());
    if (!bad) return true;
    note(bad.type === 'checkbox' ? 'Serve la spunta sulla privacy per prenotare.' : bad.type === 'radio' ? (bad.name === 'slot' ? 'Scegli un giorno e un orario.' : 'Scegli una voce per continuare.') : bad.validationMessage && bad.validity.customError ? bad.validationMessage : bad.validity.valueMissing ? 'Questo ci serve per venire da te.' : bad.validity.patternMismatch && bad.name === 'cap' ? 'Il CAP ha cinque cifre.' : bad.validity.rangeUnderflow || bad.validity.rangeOverflow ? 'Controlla l\'anno.' : 'Controlla il formato.');
    bad.focus({ preventScroll: true });
    return false;
  }
  function nav() {
    const s = steps[step], opt = s.hasAttribute('data-opt'), hasOpts = !!s.querySelector('.opts') || s.id === 'st-quando';
    const L = LAST();
    count.textContent = step <= L ? (step + 1) + ' di ' + (L + 1) : 'Fatto';
    dots.innerHTML = ''; for (let i = 0; i <= L; i++) { const li = document.createElement('li'); li.className = i < step ? 'done' : i === step ? 'now' : ''; dots.appendChild(li); }
    back.style.visibility = step > 0 && step <= L ? 'visible' : 'hidden';
    if (step > L) { next.textContent = 'Chiudi'; next.disabled = false; next.dataset.act = 'close'; return; }
    next.dataset.act = 'next';
    if (step === L) { next.textContent = modo === 'slot' ? 'Prenota' : 'Invia'; next.disabled = false; return; }
    if (s.id === 'st-quando') { next.textContent = 'Avanti'; next.disabled = modo === 'slot' && !answered(s); return; }
    next.textContent = opt && !answered(s) ? 'Salta' : 'Avanti';
    next.disabled = hasOpts && !opt && !answered(s);
  }
  function go(i) {
    if (i > step && step <= LAST() && !steps[step].hasAttribute('data-opt') && !valid(steps[step])) return;
    const forward = i > step;
    steps = active();
    step = Math.max(0, Math.min(i, steps.length - 1));
    all.forEach(s => { s.hidden = s !== steps[step]; });
    if (steps[step].id === 'st-quando' && forward) enterQuando();
    if (step === LAST()) summary();
    nav(); note('');
    body.scrollTop = 0;
    const h = steps[step].querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    const first = fields(steps[step]).find(el => el.type !== 'radio' && el.type !== 'checkbox');
    if (first && matchMedia('(min-width: 600px)').matches) setTimeout(() => first.focus({ preventScroll: true }), 60);
  }
  function summary() {
    const d = Object.fromEntries(new FormData(form).entries());
    const dl = form.querySelector('.sum'); dl.innerHTML = '';
    const quando = modo === 'slot' ? slotSummary() : modo === 'misura' ? 'Intervento su misura: ti richiamiamo' : 'Da valutare: ti richiamiamo';
    [['Servizio', d.servizio + (d.kwp ? ' · ' + d.kwp : '') + (d.lavaggio === 'Sì, anche il lavaggio' ? ' · con lavaggio' : '')], ['Dove', [d.via, d.cap, d.comune].filter(Boolean).join(', ')], ['Quando', quando], ['Cliente Baboo', d.cliente], ['Nome', d.nome], ['Telefono', d.telefono], ['Email', d.email], ['Impianto', [d.marca, d.anno].filter(Boolean).join(', ')], ['Note', d.note]]
      .filter(([, v]) => v && String(v).trim()).forEach(([k, v]) => {
        const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; dl.appendChild(dt); dl.appendChild(dd);
      });
  }
  form.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'back') go(step - 1);
    else if (act === 'close') close();
    else if (act === 'next') step === LAST() ? send() : go(step + 1);
    else if (act === 'goto') go(+b.dataset.step);
  });
  form.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.target.closest('.ac')) return;
    if (e.target === comune && !ac.hidden) return;
    e.preventDefault(); if (step < LAST()) go(step + 1); else send();
  });
  form.addEventListener('submit', e => { e.preventDefault(); send(); });
  form.querySelectorAll('input,textarea').forEach(el => el.addEventListener('blur', () => el.classList.add('touched')));

  /* ---- invio ---- */
  function esito(kind, d, j) {
    const tecnico = (j && j.tecnico) || 'un tecnico Baboo';
    if (kind === 'confermato') {
      msg.innerHTML = '<span class="kicker">Prenotato</span><h2 class="when"></h2><p>Ti abbiamo mandato la conferma a <b class="m"></b>, con cosa preparare e il link per disdire. Viene <b class="t"></b>.</p><p class="hint">Se cambia qualcosa, rispondi alla mail o chiama lo 0323 63934.</p>';
      msg.querySelector('.when').textContent = slotSummary(); msg.querySelector('.m').textContent = d.email; msg.querySelector('.t').textContent = tecnico;
    } else if (kind === 'registrato') {
      msg.innerHTML = '<span class="kicker">Richiesta registrata</span><h2 class="when"></h2><p>Nella tua zona mettiamo insieme il giro prima di confermare: ti scriviamo noi con la conferma o con una data vicina. Il riepilogo è già nella tua mail, <b class="m"></b>.</p>';
      msg.querySelector('.when').textContent = slotSummary(); msg.querySelector('.m').textContent = d.email;
    } else if (kind === 'richiamo') {
      msg.innerHTML = '<span class="kicker">Richiesta ricevuta</span><h2>Ti richiamiamo noi.</h2><p>Un tecnico legge la richiesta e ti chiama al <b class="t"></b> per proporti giorno e ora.</p><p class="hint">Se preferisci anticipare, chiama lo 0323 63934.</p>';
      msg.querySelector('.t').textContent = d.telefono;
    } else {
      msg.innerHTML = '<span class="kicker">Un passaggio in più</span><h2>Non riusciamo a prenotare da qui.</h2><p>Si è aperta la tua posta con il testo già pronto per <b>assistenza@baboo.eu</b>: premi Invia e ti richiamiamo per fissare giorno e ora.</p>';
    }
  }
  async function send() {
    if (sent || !valid(steps[LAST()])) return;
    const data = Object.fromEntries(new FormData(form).entries());
    next.disabled = true; next.textContent = 'Invio…';
    let utm = null; try { utm = JSON.parse(ss('baboo_utm') || 'null'); } catch (err) { }
    const slotInp = form.querySelector('input[name="slot"]:checked');
    const payload = Object.assign({}, data, {
      modo, slot: modo === 'slot' && slotInp ? { inizio: slotInp.value, fine: slotInp.dataset.fine, conferma: slotInp.dataset.conferma } : null,
      zona: slotData && slotData.zona || '', privacy: !!data.privacy, privacy_v: PRIVACY_V, origine: 'manutenzione',
      pagina: location.pathname, referrer: ss('baboo_ref') || document.referrer || '', utm: utm || undefined,
    });
    if (DEMO) { sent = true; esito(modo !== 'slot' ? 'richiamo' : (slotInp && slotInp.dataset.conferma === 'manuale' ? 'registrato' : 'confermato'), data, { tecnico: 'Mauro, tecnico Baboo' }); return go(steps.length - 1); }
    let kind = null, j = {};
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30000);
      const r = await fetch(epBook, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal });
      clearTimeout(t);
      j = await r.json().catch(() => ({}));
      if (r.status === 409) {   /* lo slot è stato preso nel frattempo: si torna al calendario aggiornato */
        next.disabled = false; sent = false;
        const qi = steps.findIndex(s => s.id === 'st-quando'); step = qi; all.forEach(s => { s.hidden = s !== steps[step]; }); nav();
        await enterQuando(); note('Quel posto è appena stato preso. Ecco le date aggiornate: i tuoi dati sono rimasti.'); return;
      }
      if (r.ok && j.ok) kind = j.esito || (modo !== 'slot' ? 'richiamo' : 'confermato');
      else if (r.status === 400) { next.disabled = false; nav(); return note('Controlla nome, telefono, email, indirizzo e la spunta privacy.'); }
      else if (r.status === 429) { next.disabled = false; nav(); return note('Abbiamo già ricevuto diverse richieste da questa connessione. Chiamaci: 0323 63934.'); }
      else if (j && j.esito === 'richiamo') kind = 'richiamo';   /* il relè non ha potuto scrivere tutto: ha aperto una pratica interna */
    } catch (err) { /* si passa alla mail */ }
    sent = true;
    if (!kind) {
      const righe = [['Servizio', data.servizio], ['Taglia', data.kwp], ['Lavaggio', data.lavaggio], ['Indirizzo', [data.via, data.cap, data.comune].filter(Boolean).join(', ')], ['Quando', modo === 'slot' ? slotSummary() : 'da concordare'], ['Cliente Baboo', data.cliente], ['Nome', data.nome], ['Telefono', data.telefono], ['Email', data.email], ['Impianto', [data.marca, data.anno].filter(Boolean).join(', ')], ['Note', data.note]].filter(([, v]) => v);
      const testo = 'Prenotazione manutenzione dal sito baboo.eu\n\n' + righe.map(([k, v]) => k + ': ' + v).join('\n') + '\n';
      location.href = 'mailto:assistenza@baboo.eu?subject=' + encodeURIComponent('Manutenzione · ' + (data.servizio || '') + ' · ' + (data.nome || '')) + '&body=' + encodeURIComponent(testo);
      esito('mail', data, j);
    } else esito(kind, data, j);
    go(steps.length - 1);
  }

  /* ---- apertura e chiusura ---- */
  function open() {
    if (dlg.open) return;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    document.documentElement.classList.add('sim-open');
    loadComuni();
    steps = active(); go(step);
  }
  function close() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', () => {
    document.documentElement.classList.remove('sim-open');
    if (location.hash === '#prenota') history.replaceState(null, '', location.pathname + location.search);
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  dlg.querySelector('.sim-close').addEventListener('click', close);
  document.querySelectorAll('a[href="#prenota"],a[href$="manutenzione/#prenota"]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const sv = a.getAttribute('data-servizio');   /* dalle card: il servizio è già scelto */
    if (sv) { const r = form.querySelector('input[name="servizio"][value="' + sv.replace(/"/g, '\\"') + '"]'); if (r) { r.checked = true; r.closest('.opts').querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o.querySelector('input').checked)); if (step === 0) step = 1; } }
    if (location.hash !== '#prenota') history.replaceState(null, '', '#prenota');
    open();
  }));
  window.addEventListener('hashchange', () => { if (location.hash === '#prenota') open(); });
  if (location.hash === '#prenota') open();
})();
