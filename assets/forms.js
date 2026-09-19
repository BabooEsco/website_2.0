/* Baboo · form del sito → relè /api/lead (Odoo CRM). Se il relè non risponde, ripiega sulla mail verso info@baboo.eu.
   Provenienza: data-origine sul form, oppure ?da=<pagina> nell'URL (i pulsanti delle pagine-linea e del simulatore);
   UTM di arrivo e risposte del simulatore vengono lette da sessionStorage (le scrive site.js / canone.js). */
(function () {
  'use strict';
  const form = document.getElementById('lead-form');
  if (!form) return;
  const msg = form.querySelector('.form-msg');
  const subject = form.getAttribute('data-subject') || 'Richiesta dal sito baboo.eu';
  const root = document.documentElement.getAttribute('data-root') || '';
  const endpoint = form.getAttribute('data-endpoint') || (root + 'api/lead');
  const PRIVACY_V = '2026-09';
  const NOMI = { solero: 'SOLERO', clima: 'CLIMA', miniclima: 'MINICLIMA', mountainview: 'MOUNTAINVIEW', casa: 'Baboo Casa', canone: 'Calcola il tuo canone', business: 'Business', care: 'Care', showroom: 'Showroom', faq: 'Domande frequenti', comunita: 'Comunità energetiche' };
  const PRESEL = { solero: 'Fotovoltaico e accumulo', clima: 'Riscaldamento e raffrescamento', miniclima: 'Riscaldamento e raffrescamento', mountainview: 'Serramenti', canone: null, casa: null };
  const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };

  /* provenienza: ?da= vince sull'attributo; si ricorda per la sessione */
  const params = new URLSearchParams(location.search);
  const da = params.get('da');
  if (da) ss('baboo_da', da);
  const origine = form.getAttribute('data-origine') || da || ss('baboo_da') || 'home';
  let sim = null; try { sim = JSON.parse(ss('baboo_sim') || 'null'); } catch (e) { }
  let utm = null; try { utm = JSON.parse(ss('baboo_utm') || 'null'); } catch (e) { }

  /* campo-esca: i bot lo compilano, le persone non lo vedono */
  const hp = document.createElement('input');
  hp.type = 'text'; hp.name = 'hp'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.setAttribute('aria-hidden', 'true');
  hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
  form.appendChild(hp);

  /* form della Home: preseleziona l'intervento e dice da dove arrivi */
  if (!form.getAttribute('data-origine') && (da || sim)) {
    const sel = form.querySelector('select[name="intervento"]');
    const pre = PRESEL[origine];
    if (sel && pre && !sel.value) { [...sel.options].forEach(o => { if (o.text === pre) sel.value = o.value || o.text; }); }
    const nome = NOMI[origine];
    const testo = sim && sim.livello
      ? 'Hai fatto il simulatore: ' + sim.livello + (sim.casa ? ', ' + sim.casa.toLowerCase() : '') + (sim.risc ? ', oggi ' + sim.risc.toLowerCase() : '') + '. Il tecnico che ti richiama lo saprà.'
      : nome ? 'Arrivi dalla pagina ' + nome + ': il tecnico che ti richiama lo saprà.' : '';
    if (testo) {
      const p = document.createElement('p'); p.className = 'form-from'; p.textContent = testo;
      form.insertBefore(p, form.firstElementChild);
    }
  }

  form.querySelectorAll('input,select,textarea').forEach(el => el.addEventListener('blur', () => el.classList.add('touched')));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    form.querySelectorAll('input,select,textarea').forEach(el => el.classList.add('touched'));
    if (!form.checkValidity()) { msg.textContent = 'Controlla i campi evidenziati: ci servono per risponderti.'; form.querySelector(':invalid').focus(); return; }
    const data = Object.fromEntries(new FormData(form).entries());
    const thanks = 'Grazie. Ti rispondiamo entro il prossimo giorno lavorativo.';
    const btn = form.querySelector('[type="submit"]'); if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Invio…'; }
    const payload = Object.assign({}, data, {
      oggetto: subject, origine, privacy: !!data.privacy, privacy_v: PRIVACY_V,
      pagina: location.pathname, pagina_da: ss('baboo_da_url') || '', referrer: ss('baboo_ref') || '',
      utm: utm || undefined, sim: sim || undefined,
      messaggio: data.note || data.description || data.messaggio || undefined,
      segmento: data.tipo === 'Condominio' ? 'condominio' : data.tipo ? 'azienda' : undefined,
    });
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal });
      clearTimeout(t);
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { form.classList.add('sent'); msg.textContent = thanks; try { sessionStorage.removeItem('baboo_sim'); } catch (e) { } return; }
      if (r.status === 400) { msg.textContent = 'Controlla nome, telefono, email e la casella privacy.'; if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; } return; }
      throw new Error('relay ' + r.status);
    } catch (err) { /* si passa alla mail */ }
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
    const body = subject + ' dal sito baboo.eu\n\n' + Object.entries(data).filter(([k]) => k !== 'privacy' && k !== 'hp').map(([k, v]) => k.charAt(0).toUpperCase() + k.slice(1) + ': ' + v).join('\n') + '\nProvenienza: ' + (NOMI[origine] || origine) + '\n';
    location.href = 'mailto:info@baboo.eu?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    form.classList.add('sent');
    msg.textContent = 'Si è aperta la tua posta con la richiesta già scritta: premi Invia. ' + thanks;
  });
})();
