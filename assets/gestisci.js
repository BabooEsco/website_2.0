/* Baboo · /manutenzione/gestisci/: la prenotazione dal link della mail (?t=<codice>). Legge GET /api/prenotazione/:t,
   permette la disdetta fino al limite (il relè decide) e la richiesta di spostamento (nota all'ufficio, non tocca l'agenda). */
(function () {
  'use strict';
  const root = document.documentElement.getAttribute('data-root') || '';
  const box = document.getElementById('gestisci'); if (!box) return;
  const t = new URLSearchParams(location.search).get('t') || '';
  const ep = root + 'api/prenotazione/' + encodeURIComponent(t);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const view = {
    load: box.querySelector('.g-load'), card: box.querySelector('.g-card'), gone: box.querySelector('.g-gone'), done: box.querySelector('.g-done'),
    ref: box.querySelector('.g-ref'), servizio: box.querySelector('.g-servizio'), quando: box.querySelector('.g-quando'), dove: box.querySelector('.g-dove'), stato: box.querySelector('.g-stato'),
    actions: box.querySelector('.g-actions'), late: box.querySelector('.g-late'), confirm: box.querySelector('.g-confirm'), move: box.querySelector('.g-move'), msg: box.querySelector('.g-msg'),
  };
  const show = which => { ['load', 'card', 'gone', 'done'].forEach(k => { view[k].hidden = k !== which; }); };
  const fetchJ = (url, opt) => fetch(url, Object.assign({ headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } }, opt || {})).then(async r => ({ status: r.status, j: await r.json().catch(() => ({})) }));
  let p = null;
  async function load() {
    if (!/^[a-f0-9-]{24,36}$/.test(t)) return show('gone');
    try {
      const r = await fetchJ(ep);
      if (!r.j.ok) return show('gone');
      p = r.j;
      view.ref.textContent = p.ref || ''; view.servizio.textContent = p.servizio || ''; view.dove.textContent = p.indirizzo || '';
      view.quando.textContent = p.quando ? p.quando.charAt(0).toUpperCase() + p.quando.slice(1) : '';
      view.stato.textContent = p.stato === 'confermata' ? 'Confermata' : p.stato === 'annullata' ? 'Annullata' : 'In attesa di conferma';
      view.stato.dataset.s = p.stato;
      const annullata = p.stato === 'annullata';
      view.actions.hidden = annullata || !p.disdicibile; view.late.hidden = annullata || p.disdicibile;
      if (annullata) { view.quando.textContent = 'Prenotazione annullata'; }
      show('card');
    } catch (e) { show('gone'); }
  }
  box.addEventListener('click', async e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const act = b.dataset.g;
    if (act === 'ask-cancel') { view.confirm.hidden = false; view.move.hidden = true; return; }
    if (act === 'ask-move') { view.move.hidden = false; view.confirm.hidden = true; return; }
    if (act === 'back') { view.confirm.hidden = true; view.move.hidden = true; return; }
    b.disabled = true;
    if (act === 'cancel') {
      const r = await fetchJ(ep + '/disdici', { method: 'POST', body: JSON.stringify({ motivo: (view.confirm.querySelector('textarea') || {}).value || '' }) });
      b.disabled = false;
      if (r.j.ok) { view.done.querySelector('h2').textContent = 'Prenotazione annullata.'; view.done.querySelector('p').innerHTML = 'Ti abbiamo mandato una mail. Quando vuoi, <a href="' + root + 'manutenzione/">prenota di nuovo</a>.'; return show('done'); }
      view.msg.textContent = r.status === 409 ? 'Siamo a meno di un giorno dall\'intervento: per disdire chiamaci allo 0323 63934.' : 'Non riusciamo a completare la disdetta da qui: chiamaci allo 0323 63934.';
    }
    if (act === 'move') {
      const r = await fetchJ(ep + '/spostamento', { method: 'POST', body: JSON.stringify({ testo: (view.move.querySelector('textarea') || {}).value || '' }) });
      b.disabled = false;
      if (r.j.ok) { view.done.querySelector('h2').textContent = 'Richiesta ricevuta.'; view.done.querySelector('p').textContent = 'Ti richiamiamo per trovare un altro giorno. Fino ad allora la prenotazione resta com\'è.'; return show('done'); }
      view.msg.textContent = 'Non riusciamo a inviare la richiesta da qui: chiamaci allo 0323 63934.';
    }
  });
  load();
})();
