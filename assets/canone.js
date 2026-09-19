/* Simulatore del canone Baboo Casa. Nessun prezzo qui: i valori arrivano da assets/data/canoni.json.
   Quattro domande, un livello consigliato, il canone "a partire da" di quel livello. */
(function () {
  'use strict';
  var root = document.documentElement.getAttribute('data-root') || '';
  var dlg = document.getElementById('simulatore');
  var screen = dlg && dlg.querySelector('.screen');
  if (!dlg || !screen) return;

  var Q = [
    { id: 'casa', t: 'Che casa è?', s: 'Il tipo di casa dice quanto impianto ci sta.',
      o: [['villetta', 'Villetta indipendente', 'Tetto e giardino tuoi'], ['schiera', 'Casa a schiera o bifamiliare', 'Tetto tuo, spazi condivisi'], ['appartamento', 'Appartamento', 'In condominio, con riscaldamento autonomo']] },
    { id: 'mq', t: 'Quanto è grande?', s: 'La superficie riscaldata, all’incirca.',
      o: [['s', 'Fino a 90 m²', ''], ['m', 'Da 90 a 150 m²', ''], ['l', 'Oltre 150 m²', '']] },
    { id: 'risc', t: 'Come riscaldi oggi?', s: 'Da qui capiamo cosa sostituire.',
      o: [['gas', 'Caldaia a gas', ''], ['gasolio', 'Gasolio o GPL', ''], ['legna', 'Pellet o legna', ''], ['pdc', 'Ho già una pompa di calore', '']] },
    { id: 'extra', t: 'Cosa vorresti in più?', s: 'Puoi sceglierne più di una.', multi: true,
      o: [['fv', 'Fotovoltaico con accumulo', 'Il sole che si usa due volte'], ['ev', 'Ricarica per l’auto elettrica', 'Wallbox in garage o sotto la tettoia'], ['serr', 'Serramenti nuovi', 'Il freddo che si ferma'], ['no', 'Solo il riscaldamento', '']] }
  ];
  var LV = {
    'casa': { n: 'Casa', inc: ['Pompa di calore CLIMA', 'MONITOR, ogni giorno', 'Manutenzione e assistenza per 120 mesi'] },
    'casa-solare': { n: 'Casa Solare', inc: ['Tutto Casa', 'Fotovoltaico SOLERO con accumulo', 'MONITOR, ogni giorno'] },
    'casa-indipendente': { n: 'Casa Indipendente', inc: ['Tutto Casa Solare', 'Wallbox per l’auto', 'Serramenti MOUNTAINVIEW', 'Predisposizione alla comunità energetica'] }
  };

  var ans = {}, step = 0, data = null, dataErr = false;
  fetch(root + 'assets/data/canoni.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
    .then(function (d) { data = d; if (step === Q.length) render(); })
    .catch(function () { dataErr = true; if (step === Q.length) render(); });

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return new Intl.NumberFormat('it-IT').format(n); }

  function level() {
    var x = ans.extra || [];
    var lv = 'casa';
    if (x.indexOf('fv') > -1) lv = 'casa-solare';
    if (x.indexOf('ev') > -1 || x.indexOf('serr') > -1) lv = 'casa-indipendente';
    var notes = [];
    if (ans.casa === 'appartamento' && lv !== 'casa') {
      lv = 'casa'; notes.push('In appartamento fotovoltaico e wallbox passano dal condominio: al sopralluogo vediamo cosa si può fare, anche con una comunità energetica.');
    }
    if (ans.risc === 'pdc') notes.push('Hai già una pompa di calore: al sopralluogo valutiamo se tenerla. Se ti serve solo il fotovoltaico, guarda SOLERO.');
    if (ans.mq === 'l') notes.push('Oltre 150 m² l’impianto va dimensionato con cura: è il caso in cui il canone si allontana di più dal “da”.');
    return { id: lv, notes: notes };
  }

  function dots() {
    var h = '<ol class="dots" aria-label="Avanzamento">';
    for (var i = 0; i <= Q.length; i++) h += '<li class="' + (i < step ? 'done' : i === step ? 'now' : '') + '"></li>';
    return h + '</ol>';
  }

  function render() {
    var h = '';
    if (step < Q.length) {
      var q = Q[step];
      var sel = ans[q.id] || (q.multi ? [] : null);
      h += '<div class="sim-top"><span class="kicker">Baboo Casa</span><span class="count">' + (step + 1) + ' di ' + Q.length + '</span></div>';
      h += '<div class="sim-body"><h2>' + esc(q.t) + '</h2><p class="hint">' + esc(q.s) + '</p><div class="opts" role="' + (q.multi ? 'group' : 'radiogroup') + '">';
      q.o.forEach(function (o) {
        var on = q.multi ? sel.indexOf(o[0]) > -1 : sel === o[0];
        h += '<button type="button" class="opt' + (on ? ' on' : '') + '" role="' + (q.multi ? 'checkbox' : 'radio') + '" aria-checked="' + on + '" data-v="' + o[0] + '"><span class="mark" aria-hidden="true"></span><span class="txt"><b>' + esc(o[1]) + '</b>' + (o[2] ? '<small>' + esc(o[2]) + '</small>' : '') + '</span></button>';
      });
      h += '</div></div>';
      h += '<div class="sim-nav">' + (step > 0 ? '<button type="button" class="lnk" data-act="back">Indietro</button>' : '<span></span>') + dots();
      if (q.multi) h += '<button type="button" class="btn btn-blue sm" data-act="next"' + (sel.length ? '' : ' disabled') + '>Vedi il canone</button>';
      else h += '<span></span>';
      h += '</div>';
    } else {
      var r = level(), lv = LV[r.id];
      var price = '', net = '';
      if (data) {
        var d = null; data.livelli.forEach(function (l) { if (l.id === r.id) d = l; });
        if (d) { price = 'da ' + fmt(d.da) + ' <small>€/mese</small>'; net = 'circa ' + fmt(d.netto_detrazione) + ' € netto detrazione · ' + data.durata_mesi + ' mesi'; }
      }
      if (!price) price = dataErr ? 'Canone definito al sopralluogo' : '<span class="wait">…</span>';
      h += '<div class="sim-top"><span class="kicker">Il livello per te</span><span class="count">Risultato</span></div>';
      h += '<div class="sim-body result"><h2>' + esc(lv.n) + '</h2><p class="price">' + price + '</p>' + (net ? '<p class="net">' + esc(net) + '</p>' : '');
      h += '<ul class="inc">' + lv.inc.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
      r.notes.forEach(function (n) { h += '<p class="note">' + esc(n) + '</p>'; });
      h += '<p class="legal">Canone “a partire da”, su 120 mesi. Il canone definitivo è determinato dal sopralluogo tecnico gratuito. Il finanziamento è erogato da un istituto finanziario autorizzato ex art. 106 TUB, soggetto ad approvazione.</p></div>';
      h += '<div class="sim-nav end"><a class="btn btn-blue sm" href="' + root + '?da=canone#sopralluogo" data-act="prenota">Prenota il sopralluogo gratuito</a><a class="lnk" href="' + root + 'baboo-casa/">Scopri Baboo Casa</a><button type="button" class="lnk" data-act="restart">Ricomincia</button></div>';
    }
    screen.innerHTML = h;
    var first = screen.querySelector('h2'); if (first) { first.setAttribute('tabindex', '-1'); first.focus({ preventScroll: true }); }
  }

  screen.addEventListener('click', function (e) {
    var b = e.target.closest('[data-v],[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'prenota') { /* passa le risposte al form della Home (solo etichette, niente dati personali) */
      try {
        var lab = function (qid, v) { var q = Q.filter(function (x) { return x.id === qid; })[0]; var o = q && q.o.filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : ''; };
        var r = level();
        sessionStorage.setItem('baboo_sim', JSON.stringify({ livello: LV[r.id].n, casa: lab('casa', ans.casa), mq: lab('mq', ans.mq), risc: lab('risc', ans.risc), extra: (ans.extra || []).map(function (v) { return lab('extra', v); }) }));
        sessionStorage.setItem('baboo_da', 'canone'); sessionStorage.setItem('baboo_da_url', location.pathname);
      } catch (e) { }
      return; /* il link prosegue normalmente */
    }
    if (act === 'back') { step = Math.max(0, step - 1); return render(); }
    if (act === 'restart') { ans = {}; step = 0; return render(); }
    if (act === 'next') { step++; return render(); }
    var q = Q[step], v = b.getAttribute('data-v');
    if (q.multi) {
      var s = ans[q.id] || [];
      if (v === 'no') s = s.indexOf('no') > -1 ? [] : ['no'];
      else { s = s.filter(function (x) { return x !== 'no'; }); s = s.indexOf(v) > -1 ? s.filter(function (x) { return x !== v; }) : s.concat([v]); }
      ans[q.id] = s; render();
    } else {
      ans[q.id] = v; b.classList.add('on');
      setTimeout(function () { step++; render(); }, 180);
    }
  });

  function open() {
    if (dlg.open) return;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    document.documentElement.classList.add('sim-open');
    render();
  }
  function close() {
    if (dlg.open) dlg.close();
  }
  dlg.addEventListener('close', function () {
    document.documentElement.classList.remove('sim-open');
    if (location.hash === '#simulatore') history.replaceState(null, '', location.pathname + location.search);
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
  dlg.querySelector('.sim-close').addEventListener('click', close);
  document.querySelectorAll('a[href="#simulatore"],a[href$="canone/#simulatore"]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); if (location.hash !== '#simulatore') history.replaceState(null, '', '#simulatore'); open(); });
  });
  window.addEventListener('hashchange', function () { if (location.hash === '#simulatore') open(); });
  if (location.hash === '#simulatore') open();
})();
