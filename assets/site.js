/* Baboo · comportamenti condivisi da tutte le pagine: menu, tendina, entrate, pausa, canoni */
(function () {
  'use strict';

  /* ---- menu mobile e tendina "Le linee" ---- */
  const burger = document.querySelector('.burger');
  const menu = document.querySelector('.menu');
  if (burger && menu) {
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!open));
      menu.classList.toggle('open', !open); document.body.classList.toggle('menu-open', !open);
      document.documentElement.style.overflow = open ? '' : 'hidden';
    });
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      if (menu.classList.contains('open')) {
        burger.setAttribute('aria-expanded', 'false');
        menu.classList.remove('open'); document.body.classList.remove('menu-open');
        document.documentElement.style.overflow = '';
      }
    }));
  }
  document.querySelectorAll('.has-sub').forEach(btn => {
    const sub = btn.nextElementSibling;
    const set = open => { btn.setAttribute('aria-expanded', String(open)); sub.classList.toggle('open', open); };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    const li = btn.parentElement;
    li.addEventListener('mouseenter', () => { if (matchMedia('(min-width: 1101px)').matches) set(true); });
    li.addEventListener('mouseleave', () => { if (matchMedia('(min-width: 1101px)').matches) set(false); });
    li.addEventListener('focusout', e => { if (!li.contains(e.relatedTarget)) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  });

  /* ---- entrate coreografate ---- */
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const reveals = document.querySelectorAll('.reveal');
  if (reduced.matches) {
    reveals.forEach(el => el.classList.add('in', 'done'));
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          setTimeout(() => en.target.classList.add('done'), 1400);
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.18 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('in', 'done'));
  }

  /* ---- animazioni vive solo quando in vista, pausa su tab nascosto ---- */
  const live = document.querySelectorAll('[data-live]');
  if ('IntersectionObserver' in window) {
    const lo = new IntersectionObserver(entries => {
      entries.forEach(en => en.target.classList.toggle('live', en.isIntersecting));
    }, { threshold: 0.05 });
    live.forEach(el => lo.observe(el));
  } else { live.forEach(el => el.classList.add('live')); }
  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('paused', document.hidden);
  });

  /* ---- schema a fasi (pagine-linea): ciclo giorno / sera / notte ---- */
  document.querySelectorAll('.schema[data-cycle]').forEach(fig => {
    const phases = ['day', 'eve', 'night'];
    const svg = fig.querySelector('svg');
    const sec = fig.closest('section');
    const tiles = sec ? sec.querySelectorAll('[data-phase]') : [];
    let i = 0, timer = null;
    const set = ph => {
      phases.forEach(p => fig.classList.toggle('ph-' + p, p === ph));
      tiles.forEach(t => t.classList.toggle('on', t.getAttribute('data-phase') === ph));
    };
    const step = () => { i = (i + 1) % phases.length; set(phases[i]); };
    const run = () => {
      const on = fig.classList.contains('live') && !document.hidden && !reduced.matches;
      if (on && !timer) { timer = setInterval(step, 4600); if (svg && svg.unpauseAnimations) svg.unpauseAnimations(); }
      if (!on && timer) { clearInterval(timer); timer = null; }
      if (!on && svg && svg.pauseAnimations) svg.pauseAnimations();
    };
    set('day');
    if (reduced.matches) tiles.forEach(t => t.classList.remove('on'));
    new MutationObserver(muts => { if (muts.some(m => m.oldValue === null || /(^| )live( |$)/.test(m.oldValue) !== fig.classList.contains('live'))) run(); })
      .observe(fig, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    document.addEventListener('visibilitychange', run);
    run();
  });

  /* ---- canoni: i prezzi vengono solo dal file dati ---- */
  const priceEls = document.querySelectorAll('[data-canone]');
  if (priceEls.length) {
    const base = document.documentElement.getAttribute('data-root') || '';
    fetch(base + 'assets/data/canoni.json', { cache: 'no-cache' }).then(r => r.json()).then(data => {
      const fmt = n => new Intl.NumberFormat('it-IT').format(n);
      priceEls.forEach(el => {
        const lv = data.livelli.find(l => l.id === el.getAttribute('data-canone'));
        if (!lv) return;
        const field = el.getAttribute('data-field') || 'da';
        if (field === 'da') el.innerHTML = 'da ' + fmt(lv.da) + ' <small>€/mese</small>';
        else if (field === 'netto') el.textContent = 'circa ' + fmt(lv.netto_detrazione) + ' € netto detrazione';
        else if (field === 'mesi') el.textContent = data.durata_mesi;
      });
    }).catch(() => {
      priceEls.forEach(el => { el.textContent = 'Canone definito al sopralluogo'; });
    });
  }

  /* ---- header: stato "sul hero" ---- */
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  if (header && hero && 'IntersectionObserver' in window) {
    const ho = new IntersectionObserver(([en]) => {
      header.classList.toggle('on-hero', en.isIntersecting && en.intersectionRatio > 0);
    }, { threshold: [0, 0.01], rootMargin: '-72px 0px 0px 0px' });
    ho.observe(hero);
  }
})();
