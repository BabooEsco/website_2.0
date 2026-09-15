# Nuovo sito Baboo (New Baboo Style)

Sito statico: HTML, CSS e JavaScript puri, nessun build step. `index.html` e' la Home con il video a scorrimento; ogni pagina interna vive nella sua cartella con un `index.html`; tutto lo stile condiviso e' in `assets/baboo.css`.

## Ambienti
- **Locale**: doppio clic su `Anteprima sito.command` (nella cartella madre) oppure `python3 -m http.server 8765` in questa cartella, poi http://localhost:8765/
- **Test**: ogni push su `main` pubblica su GitHub Pages (workflow in `.github/workflows/pages.yml`). Le pagine di test sono `noindex`.
- **Produzione**: VPS Hostinger dedicato, dominio baboo.eu. Mai pubblicare in produzione senza l'approvazione esplicita di Renato Clementi.

## Come si modifica
- Testi e struttura della Home: `index.html`.
- Pagine interne: sono generate da `design/build_pages.py` (nella cartella madre). Modificare li' e rigenerare, non a mano.
- Canoni Baboo Casa: solo in `assets/data/canoni.json`. Nessun prezzo va scritto nell'HTML.
- Video hero e immagini: `assets/`. I file grezzi restano in `review/`, che non fa parte del repository.

## Vincoli di marchio (guida PM v1.1)
Il marchio si scrive Baboo; le linee (SOLERO, CLIMA, MINICLIMA, MAXICLIMA, THERMO, MOUNTAINVIEW, MONITOR) in maiuscolo. Canoni sempre "da", su 120 mesi, con rimando al sopralluogo e nota art. 106 TUB. Nessuno SLA numerico. Banda slate con CTA e MONITOR presenti in ogni pagina.
