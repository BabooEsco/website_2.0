/* Baboo · pagina Assistenza: schede "tre controlli", form di richiesta → relè /api/ticket (Odoo Helpdesk).
   Le foto viaggiano dentro il JSON in base64 (le immagini grandi vengono ridotte a 1600 px prima dell'invio).
   Se il relè non risponde, ripiega sulla mail verso assistenza@baboo.eu (che apre comunque un ticket). */
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

  /* ---- form ---- */
  const form = document.getElementById('ticket-form');
  if (!form) return;
  const msg = form.querySelector('.form-msg');
  const endpoint = form.getAttribute('data-endpoint') || (root + 'api/ticket');
  const sel = form.querySelector('select[name="impianto"]');

  /* i link "Apri la richiesta" dentro le schede preselezionano il tipo di impianto */
  document.querySelectorAll('[data-impianto]').forEach(a => a.addEventListener('click', () => {
    const v = a.getAttribute('data-impianto');
    if (sel && v) [...sel.options].forEach(o => { if (o.text === v) sel.value = o.value || o.text; });
  }));

  /* campo-esca */
  const hp = document.createElement('input');
  hp.type = 'text'; hp.name = 'hp'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.setAttribute('aria-hidden', 'true');
  hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
  form.appendChild(hp);

  /* allegati: elenco, limiti, rimozione */
  const fileInput = form.querySelector('input[type="file"]');
  const fileList = form.querySelector('.files');
  let files = [];
  const fmt = b => b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB';
  const render = () => {
    if (!fileList) return;
    fileList.innerHTML = '';
    files.forEach((f, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span></span> <small></small> <button type="button" aria-label="Togli il file"></button>';
      li.querySelector('span').textContent = f.name; li.querySelector('small').textContent = fmt(f.size);
      li.querySelector('button').addEventListener('click', () => { files.splice(i, 1); render(); });
      fileList.appendChild(li);
    });
    if (fileInput) fileInput.value = '';
  };
  if (fileInput) fileInput.addEventListener('change', () => {
    const errs = [];
    [...fileInput.files].forEach(f => {
      if (files.length >= MAX_FILES) { errs.push('Puoi allegare al massimo ' + MAX_FILES + ' file.'); return; }
      if (f.size > MAX_BYTES) { errs.push(f.name + ' supera gli 8 MB.'); return; }
      if (!/^image\//.test(f.type) && f.type !== 'application/pdf' && !/\.(heic|heif|pdf|jpe?g|png|webp)$/i.test(f.name)) { errs.push(f.name + ': formato non accettato.'); return; }
      files.push(f);
    });
    render();
    msg.textContent = errs.join(' ');
  });

  /* immagini grandi: ridotte a 1600 px prima di partire (se il browser non decodifica il formato, si manda l'originale) */
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

  form.querySelectorAll('input,select,textarea').forEach(el => el.addEventListener('blur', () => el.classList.add('touched')));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    form.querySelectorAll('input,select,textarea').forEach(el => el.classList.add('touched'));
    if (!form.checkValidity()) { msg.textContent = 'Controlla i campi evidenziati: ci servono per aiutarti.'; const inv = form.querySelector(':invalid'); if (inv) inv.focus(); return; }
    const data = Object.fromEntries(new FormData(form).entries());
    delete data.file;
    const btn = form.querySelector('[type="submit"]'); if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = files.length ? 'Invio con le foto…' : 'Invio…'; }
    let utm = null; try { utm = JSON.parse(ss('baboo_utm') || 'null'); } catch (err) { }
    const payload = Object.assign({}, data, {
      privacy: !!data.privacy, privacy_v: PRIVACY_V, pagina: location.pathname, referrer: ss('baboo_ref') || document.referrer || '', utm: utm || undefined,
      allegati: await Promise.all(files.map(pack)),
    });
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 60000);
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal });
      clearTimeout(t);
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        form.classList.add('sent', 'done');
        msg.classList.add('ok');
        msg.innerHTML = '<b>Richiesta ricevuta.</b> Numero <b class="ref"></b>.<br>Ti abbiamo mandato una mail di conferma a <span class="m"></span>. Un tecnico legge la richiesta e ti richiama al <span class="t"></span>. Se nel frattempo cambia qualcosa, rispondi alla mail: resta tutto nella stessa pratica.';
        msg.querySelector('.ref').textContent = j.ref || ('#' + j.id); msg.querySelector('.m').textContent = data.email; msg.querySelector('.t').textContent = data.telefono;
        msg.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      if (r.status === 400) { msg.textContent = 'Controlla nome, telefono, email, indirizzo, tipo di impianto e la casella privacy.'; if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; } return; }
      if (r.status === 413) { msg.textContent = 'Le foto sono troppo pesanti: toglierne una e riprova.'; if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; } return; }
      if (r.status === 429) { msg.textContent = 'Abbiamo già ricevuto diverse richieste da questa connessione. Se è urgente chiamaci: 0323 63934.'; if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; } return; }
      throw new Error('relay ' + r.status);
    } catch (err) { /* si passa alla mail */ }
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
    const righe = [['Nome', data.nome], ['Telefono', data.telefono], ['Email', data.email], ['Indirizzo impianto', data.indirizzo], ['Impianto', data.impianto], ['Impianto fermo', data.fermo], ['Da quando', data.da_quando], ['Cliente Care', data.care], ['Cosa succede', data.messaggio]].filter(([, v]) => v);
    const body = 'Richiesta di assistenza dal sito baboo.eu\n\n' + righe.map(([k, v]) => k + ': ' + v).join('\n') + (files.length ? '\n\n(Allega qui le foto scelte: ' + files.map(f => f.name).join(', ') + ')' : '') + '\n';
    location.href = 'mailto:assistenza@baboo.eu?subject=' + encodeURIComponent('Assistenza · ' + (data.impianto || '') + ' · ' + (data.nome || '')) + '&body=' + encodeURIComponent(body);
    form.classList.add('sent');
    msg.textContent = 'Non riusciamo a inviare la richiesta da qui. Si è aperta la tua posta con il testo già pronto per assistenza@baboo.eu: allega le foto e premi Invia.';
  });
})();
