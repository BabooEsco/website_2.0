/* Baboo · form delle pagine interne: endpoint configurabile (Odoo, Fase 2), altrimenti mail precompilata verso info@baboo.eu */
(function () {
  'use strict';
  const form = document.getElementById('lead-form');
  if (!form) return;
  const msg = form.querySelector('.form-msg');
  const subject = form.getAttribute('data-subject') || 'Richiesta dal sito baboo.eu';
  form.querySelectorAll('input,select,textarea').forEach(el => el.addEventListener('blur', () => el.classList.add('touched')));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    form.querySelectorAll('input,select,textarea').forEach(el => el.classList.add('touched'));
    if (!form.checkValidity()) { msg.textContent = 'Controlla i campi evidenziati: ci servono per risponderti.'; form.querySelector(':invalid').focus(); return; }
    const data = Object.fromEntries(new FormData(form).entries());
    const endpoint = form.getAttribute('data-endpoint');
    const thanks = 'Grazie. Ti rispondiamo entro il prossimo giorno lavorativo.';
    if (endpoint) {
      try {
        const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(Object.assign({ oggetto: subject }, data)) });
        if (!r.ok) throw new Error('http ' + r.status);
        form.classList.add('sent'); msg.textContent = thanks; return;
      } catch (err) { /* si passa alla mail */ }
    }
    const body = subject + ' dal sito baboo.eu\n\n' + Object.entries(data).filter(([k]) => k !== 'privacy').map(([k, v]) => k.charAt(0).toUpperCase() + k.slice(1) + ': ' + v).join('\n') + '\n';
    location.href = 'mailto:info@baboo.eu?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    form.classList.add('sent');
    msg.textContent = 'Si è aperta la tua posta con la richiesta già scritta: premi Invia. ' + thanks;
  });
})();
