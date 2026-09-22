/* Le persone di Baboo — sezione team di /chi-siamo/.
   Il blocco [data-team] nasce vuoto e nascosto; qui si riempie leggendo /team.json (stessa origine),
   generato sul VPS da build_team.py a partire dalle schede dipendente di Odoo con l'etichetta "Sito web".
   Nessuna richiesta verso terzi prima del clic: il player YouTube (youtube-nocookie) nasce solo nel dialog.
   Se il JSON manca o è vuoto la sezione resta nascosta e la pagina non cambia. */
(function () {
  "use strict";
  var root = (document.documentElement.getAttribute("data-root") || "./");
  var blocco = document.querySelector("[data-team]");
  if (!blocco) return;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); }

  function card(p) {
    var v = p.video;
    return '<article class="tm-card" data-id="' + esc(p.id) + '">' +
      '<figure class="tm-foto"><img src="' + root + esc(p.foto.src.replace(/^\//, "")) + '" alt="' + esc(p.foto.alt) + '" loading="lazy" width="800" height="800"></figure>' +
      '<div class="tm-txt"><h3 class="tm-nome">' + esc(p.nome) + '</h3><p class="tm-ruolo">' + esc(p.ruolo) + '</p>' +
      (p.bio ? '<p class="tm-bio">' + esc(p.bio) + '</p>' : "") +
      (v ? '<button class="tm-play" type="button" data-video="' + esc(v.id) + '" data-verticale="' + (v.verticale ? "1" : "0") + '" data-titolo="' + esc(p.nome) + '" aria-label="Guarda il video di ' + esc(p.nome) + '"><span class="tm-ico" aria-hidden="true"></span>Guarda il video</button>' : "") +
      "</div></article>";
  }

  function gruppo(nome, lista, conTitolo) {
    return (conTitolo ? '<h3 class="tm-gruppo part">' + esc(nome) + "</h3>" : "") +
      '<div class="tm-grid part">' + lista.map(card).join("") + "</div>";
  }

  // ---------- player: cornice verticale (Shorts) o 16:9 ----------
  var dialog = null;
  function assicuraDialog() {
    if (dialog) return dialog;
    var d = document.createElement("div");
    d.innerHTML = '<dialog class="tm-dialog" id="tm-dialog" aria-label="Video di presentazione"><div class="tm-frame"><button class="tm-close" type="button" aria-label="Chiudi il video">×</button><div class="tm-screen" id="tm-screen"></div><p class="tm-nota">Il video è ospitato su YouTube e si carica solo quando premi play.</p></div></dialog>';
    document.body.appendChild(d.firstChild);
    dialog = document.getElementById("tm-dialog");
    dialog.addEventListener("close", function () { var s = dialog.querySelector("#tm-screen"); if (s) s.innerHTML = ""; });
    dialog.addEventListener("click", function (ev) { if (ev.target === dialog || ev.target.closest(".tm-close")) chiudi(); });
    return dialog;
  }
  function apri(id, titolo, verticale) {
    var dlg = assicuraDialog();
    if (typeof dlg.showModal !== "function") { window.open("https://www.youtube.com/watch?v=" + encodeURIComponent(id), "_blank", "noopener"); return; }
    dlg.classList.toggle("is-vert", !!verticale);
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0&modestbranding=1&playsinline=1";
    f.title = titolo ? "Video di " + titolo : "Video di presentazione";
    f.allow = "autoplay; encrypted-media; picture-in-picture";
    f.setAttribute("allowfullscreen", "");
    f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    var screen = dlg.querySelector("#tm-screen");
    screen.innerHTML = "";
    screen.appendChild(f);
    dlg.showModal();
  }
  function chiudi() {
    if (!dialog) return;
    var s = dialog.querySelector("#tm-screen"); if (s) s.innerHTML = "";
    if (dialog.open) dialog.close();
  }
  blocco.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest(".tm-play");
    if (!b) return;
    ev.preventDefault();
    apri(b.getAttribute("data-video"), b.getAttribute("data-titolo"), b.getAttribute("data-verticale") === "1");
  });

  // ---------- dati ----------
  fetch(root + "team.json", { credentials: "omit" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (doc) {
    if (!doc || !doc.items || !doc.items.length) return;          // niente dati: la sezione resta nascosta
    var gruppi = (doc.gruppi && doc.gruppi.length ? doc.gruppi : [null]);
    var conTitolo = gruppi.length > 1;                            // §3.5.6: un solo gruppo = niente intestazioni
    var html = gruppi.map(function (g) {
      var lista = doc.items.filter(function (p) { return !g || p.gruppo === g; }).sort(function (a, b) { return a.ordine - b.ordine; });
      return lista.length ? gruppo(g, lista, conTitolo) : "";
    }).join("");
    var cont = blocco.querySelector("[data-team-grid]") || blocco;
    cont.innerHTML = html;
    blocco.hidden = false;   // site.js osserva già la sezione (.reveal): l'entrata parte quando arriva in vista

    // JSON-LD: l'organizzazione con le persone pubblicate (solo chi ha dato il consenso è nel JSON)
    try {
      var org = { "@context": "https://schema.org", "@type": "Organization", "name": "Baboo ESCo", "url": location.origin + "/",
        "employee": doc.items.map(function (p) { return { "@type": "Person", "name": p.nome, "jobTitle": p.ruolo, "image": location.origin + p.foto.src.split("?")[0], "worksFor": { "@type": "Organization", "name": "Baboo ESCo" } }; }) };
      var s = document.createElement("script"); s.type = "application/ld+json"; s.textContent = JSON.stringify(org);
      document.head.appendChild(s);
    } catch (e) { /* facoltativo */ }
  }).catch(function () { /* JSON assente: la pagina resta com'è */ });
})();
