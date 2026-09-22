/* Storie dei clienti — filtri, lightbox e blocchi "La parola ai clienti".
   Nessuna richiesta verso terzi prima del clic su play: il player YouTube (youtube-nocookie)
   nasce solo dentro il dialog. I blocchi leggono /testimonianze.json (stessa origine).
   La card generata qui deve restare identica a card() di build_testimonianze.py. */
(function () {
  "use strict";
  var root = (document.documentElement.getAttribute("data-root") || "./");
  var dialog = document.getElementById("st-dialog");

  // ---------- lightbox ----------
  function apri(id, titolo) {
    if (!dialog) { window.open("https://www.youtube.com/watch?v=" + encodeURIComponent(id), "_blank", "noopener"); return; }
    var screen = dialog.querySelector("#st-screen");
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0&modestbranding=1&playsinline=1";
    f.title = titolo || "Video della testimonianza";
    f.allow = "autoplay; encrypted-media; picture-in-picture";
    f.setAttribute("allowfullscreen", "");
    f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    screen.innerHTML = "";
    screen.appendChild(f);
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  }
  function chiudi() {
    if (!dialog) return;
    var screen = dialog.querySelector("#st-screen");
    if (screen) screen.innerHTML = "";          // ferma audio e connessioni
    if (dialog.open) dialog.close(); else dialog.removeAttribute("open");
  }
  document.addEventListener("click", function (ev) {
    var play = ev.target.closest && ev.target.closest(".st-play");
    if (play) { ev.preventDefault(); apri(play.getAttribute("data-video"), play.getAttribute("data-titolo")); return; }
    if (ev.target.closest && ev.target.closest(".st-close")) { chiudi(); return; }
    if (dialog && ev.target === dialog) chiudi();   // clic sullo sfondo
    var filtro = ev.target.closest && ev.target.closest("[data-filtro]");
    if (filtro) applicaFiltro(filtro.getAttribute("data-filtro"));
  });
  if (dialog) dialog.addEventListener("close", function () { var s = dialog.querySelector("#st-screen"); if (s) s.innerHTML = ""; });

  // ---------- filtri della pagina /storie/ ----------
  function applicaFiltro(f) {
    var grid = document.querySelector("[data-storie-grid]");
    if (!grid) return;
    var kind = f.split(":")[0], val = f.split(":")[1];
    var visibili = 0;
    grid.querySelectorAll(".st-card").forEach(function (c) {
      var ok = f === "tutti" ||
        (kind === "tipo" && c.getAttribute("data-tipo") === val) ||
        (kind === "linea" && (" " + c.getAttribute("data-linee") + " ").indexOf(" " + val + " ") >= 0);
      c.hidden = !ok; if (ok) visibili++;
    });
    document.querySelectorAll(".st-chip[data-filtro]").forEach(function (b) {
      var on = b.getAttribute("data-filtro") === f; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var vuoto = document.querySelector(".st-vuoto"); if (vuoto) vuoto.hidden = visibili > 0;
    try { history.replaceState(null, "", f === "tutti" ? location.pathname : "#" + f.replace(":", "=")); } catch (e) {}
  }
  var hash = location.hash.replace(/^#/, "");
  if (/^(tipo|linea)=/.test(hash)) applicaFiltro(hash.replace("=", ":"));
  else if (/^[A-Za-z0-9_-]{11}$/.test(hash)) {      // /storie/#<videoId> apre direttamente la storia
    var c = document.querySelector('.st-card[data-id="' + hash + '"] .st-play');
    if (c) setTimeout(function () { apri(c.getAttribute("data-video"), c.getAttribute("data-titolo")); }, 300);
  }

  // ---------- blocchi nelle altre pagine ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); }
  function card(i) {
    var d = i.video && i.video.durata_s ? Math.floor(i.video.durata_s / 60) + ":" + ("0" + (i.video.durata_s % 60)).slice(-2) : "";
    var luogo = esc(i.comune) + (i.provincia ? " (" + esc(i.provincia) + ")" : "");
    return '<article class="st-card" data-tipo="' + esc(i.tipo) + '" data-linee="' + esc(i.linee.join(" ")) + '" data-id="' + esc(i.id) + '">' +
      '<button class="st-play" type="button" data-video="' + esc(i.video.id) + '" data-titolo="' + esc(i.titolo) + '" aria-label="Guarda la storia di ' + esc(i.nome) + '">' +
      '<img src="' + root + esc(i.poster.src.replace(/^\//, "")) + '" alt="' + esc(i.poster.alt) + '" loading="lazy" width="540" height="960">' +
      '<span class="st-tipo">' + esc(i.tipo) + '</span><span class="st-durata">' + d + '</span><span class="st-ico" aria-hidden="true"></span>' +
      '<span class="st-nome"><b>' + esc(i.nome) + '</b>' + (i.titolare ? "<span>" + esc(i.titolare) + "</span>" : "") + "<small>" + luogo + "</small></span>" +
      "</button><div class=\"st-txt\"><p class=\"st-int\">" + esc(i.intervento) + "</p>" +
      (i.citazione ? '<p class="st-cit">“' + esc(i.citazione) + "”</p>" : "") +
      '<div class="st-badges">' + i.linee.map(function (l) { return '<span class="st-badge">' + esc(l) + "</span>"; }).join("") + "</div></div></article>";
  }
  var blocchi = document.querySelectorAll("[data-storie]");
  if (!blocchi.length) return;
  fetch(root + "testimonianze.json", { credentials: "omit" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (doc) {
    if (!doc || !doc.items || !doc.items.length) return;   // niente dati: i blocchi restano nascosti
    blocchi.forEach(function (b) {
      var tipo = b.getAttribute("data-tipo"), linea = b.getAttribute("data-linea"), max = parseInt(b.getAttribute("data-max") || "3", 10);
      var sel = doc.items.filter(function (i) { return (!tipo || i.tipo === tipo) && (!linea || i.linee.indexOf(linea) >= 0); });
      var ev = sel.filter(function (i) { return i.in_evidenza; });
      var lista = (ev.length >= Math.min(max, sel.length) ? ev : ev.concat(sel.filter(function (i) { return !i.in_evidenza; })))
        .sort(function (a, b) { return a.ordine - b.ordine; }).slice(0, max);
      if (!lista.length) return;
      var grid = b.querySelector("[data-storie-grid]") || b;
      grid.innerHTML = lista.map(card).join("");
      b.hidden = false;
      if (!dialog) {                                         // il dialog vive nella pagina /storie/: qui lo creiamo al volo
        var d = document.createElement("div");
        d.innerHTML = '<dialog class="st-dialog" id="st-dialog" aria-label="Video della testimonianza"><div class="st-frame"><button class="st-close" type="button" aria-label="Chiudi il video">×</button><div class="st-screen" id="st-screen"></div><p class="st-nota">Il video è ospitato su YouTube e si carica solo quando premi play.</p></div></dialog>';
        document.body.appendChild(d.firstChild);
        dialog = document.getElementById("st-dialog");
        dialog.addEventListener("close", function () { var s = dialog.querySelector("#st-screen"); if (s) s.innerHTML = ""; });
      }
    });
  }).catch(function () { /* JSON assente: la pagina resta com'è */ });
})();
