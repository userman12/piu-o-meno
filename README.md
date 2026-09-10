# Più o Meno

Gioco di stime numeriche per due giocatori sullo stesso telefono. PWA installabile,
file statici, nessun build step, nessuna dipendenza.

## Provare in locale

```sh
python3 -m http.server 8899
```

Poi apri `http://localhost:8899` (dal telefono: stesso Wi-Fi, `http://<ip-del-mac>:8899`).

## Installare sul telefono

Serve HTTPS (o `localhost`) perché il service worker si registri: pubblica la cartella
su qualsiasi hosting statico — GitHub Pages, Netlify, Cloudflare Pages — e usa
"Aggiungi alla schermata Home" da Safari o "Installa app" da Chrome.

## Test

```sh
node test.js          # formattazione numeri + scale di tutte le domande
python3 tools/make_icons.py   # rigenera le icone PWA
```

## File

| file | cosa fa |
|---|---|
| `index.html` | tutte le schermate (mostrate/nascoste via classe `.active`) |
| `app.js` | stato partita, flusso, picker a rotella, punteggio, salvataggio |
| `scale.js` | generazione delle tacche e formattazione dei numeri |
| `questions.js` | dataset domande (`q`, `a`, `max`, `u`, `c`) |
| `sw.js` | service worker cache-first |

## Aggiungere domande

Una riga in `questions.js`. `max` è il fondo scala e va scritto a mano: **non**
derivarlo dalla risposta, altrimenti i giocatori imparano che la risposta sta
sempre a metà scala. `node test.js` verifica che la scala generata contenga una
tacca abbastanza vicina alla risposta e che tutti i valori restino arrotondati.
