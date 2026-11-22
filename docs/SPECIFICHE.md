# StaffVJ — Specifiche funzionali e tecniche

**Versione:** 0.1 (prototipo)
**Data:** 23 ottobre 2026
**Committente:** Stafffeste
**Scopo del documento:** definire cosa deve fare StaffVJ, per chi, con quali limiti e con quali criteri si considera accettabile.

---

## 1. Contesto e obiettivo

Stafffeste gestisce eventi e serate dal vivo. La regia video attuale si appoggia a soluzioni tipo Arkaos, percepite come complesse e poco adatte a un utilizzo rapido durante l'evento.

StaffVJ è un sistema VJ desktop pensato per:

- mandare in onda video, immagini, generatori grafici e testi;
- gestire due deck A/B con crossfade;
- applicare effetti in tempo reale;
- reagire alla musica;
- automatizzare parte della regia;
- inviare il programma a un proiettore o a un secondo schermo.

L'obiettivo della v0.1 è avere un **prototipo stabile e comprensibile**, utilizzabile in sala prove e nelle prime serate, senza la complessità di un prodotto professionale completo.

---

## 2. Pubblico e scenari d'uso

### 2.1 Operatore VJ

Persona che durante l'evento:

- sceglie e lancia i contenuti;
- prepara il deck successivo;
- usa il crossfader;
- regola effetti e testi;
- controlla l'output sul proiettore.

Non si presume che conosca il funzionamento interno di WebGL o dei codec video.

### 2.2 Preparazione a tavolino

Prima dell'evento:

- importazione di video e immagini;
- creazione di testi e generatori;
- composizione dei deck;
- salvataggio del progetto;
- verifica degli ingressi video e audio.

### 2.3 Live

Durante l'evento:

- l'operatore usa tastiera, mouse e crossfader;
- il pubblico vede solo la finestra di output;
- il sistema deve restare stabile e ripristinabile.

---

## 3. Ambito

### 3.1 Incluso nella v0.1

- Due deck A/B con quattro layer ciascuno.
- Crossfade tra i deck.
- Media library con video, immagini, generatori e testi.
- Effetti per layer e per master.
- Trasformazioni per layer.
- Blend mode tra layer.
- Ingressi video da telecamera o scheda di acquisizione.
- Analisi audio con BPM, tap tempo e rilevamento beat.
- Autopilot.
- Finestra output su display selezionato.
- Salvataggio e apertura progetto in JSON.
- Autosave locale.
- Scorciatoie da tastiera.
- Packaging macOS e Windows tramite electron-builder.

### 3.2 Escluso dalla v0.1

- NDI input/output.
- Projection mapping e maschere.
- Registrazione del programma.
- Streaming verso piattaforme esterne.
- Controllo DMX o Art-Net.
- Sintesi audio o uscita audio dal programma.
- Supporto garantito a codec professionali come HEVC, ProRes e HAP.
- Editing timeline non lineare.
- Multi-utente o controllo remoto via rete.

Queste funzioni potranno essere valutate in versioni successive.

---

## 4. Requisiti funzionali

### RF-01 — Libreria media

- Importare più file contemporaneamente tramite dialog di sistema.
- Gestire video, immagini, generatori e testi nello stesso elenco.
- Mostrare nome, tipo, anteprima e durata/dimensione quando disponibili.
- Filtrare per tipo: tutti, video, immagini, generatori, testi.
- Cercare per nome.
- Eliminare un media dalla libreria.
- Conservare i media nel progetto salvato come riferimenti a percorso, non come copie.

### RF-02 — Deck e layer

- Ogni deck contiene quattro layer.
- Il layer 0 è il più alto nella composizione; il layer 3 è il più basso.
- Un layer può essere vuoto, visibile o nascosto.
- Ogni layer ha: sorgente, opacità, blend mode, fit, trasformazione, effetti, fade-in e visibilità.
- Il target corrente è composto da deck e indice layer.
- Cliccando un media si attiva sul target corrente.
- Il layer attivo può essere svuotato.

### RF-03 — Composizione

- Ogni layer viene renderizzato su un target trasparente.
- Gli effetti del layer vengono applicati in catena.
- I layer vengono composti dal basso verso l'alto.
- Il deck risultante viene composto in nero opaco.
- I due deck vengono uniti dal crossfader.
- Il master applica eventuali effetti e poi opacità globale e blackout.

Blend mode disponibili: normal, add, screen, multiply, overlay, difference, lighten, darken.

### RF-04 — Effetti

- Ogni catena può contenere al massimo quattro effetti.
- Sono disponibili effetti per layer e per master.
- Categorie: Colore, Distorsione, Stile, Glitch, Chiave, Master.
- Ogni effetto ha mix, parametri, reazione audio e reazione beat.
- Gli effetti possono essere attivati, disattivati, rimossi e regolati.
- La catena master viene applicata dopo il crossfade.

Effetti inclusi: color, kaleido, mirror, pixelate, rgbsplit, wave, ripple, twist, blur, posterize, edge, scanlines, grain, vignette, chroma, lumakey, invert, strobe, zoomblur, glitch, glow.

### RF-05 — Trasformazioni layer

- Spostamento orizzontale e verticale.
- Scala.
- Rotazione.
- Adattamento cover o contain.
- Fade-in all'attivazione.
- Opacità.

### RF-06 — Generatori

- Generatori procedurali disponibili: Plasma, Aurora, Tunnel, Griglia, Tramonto, Rumore, Test card, Tinta unita.
- Parametri: velocità, tonalità, intensità, colore.
- I generatori sono sincronizzati tra control e output tramite tempo assoluto.

### RF-07 — Testi

- Testo su più righe.
- Font, peso, dimensione, colore.
- Allineamento, posizione, spaziatura.
- Outline e sfondo con opacità.
- Animazioni: nessuna, scorrimento sinistra/destra, pulsazione, macchina da scrivere, salto.
- Modifica in tempo reale dal pannello Inspector.

### RF-08 — Ingressi video

- Enumerare telecamere e schede di acquisizione.
- Richiedere il permesso telecamera su macOS.
- Mandare l'ingresso su un layer come sorgente live.
- Mostrare lo stato dell'ingresso.
- Gestire l'errore se il dispositivo non è disponibile.

### RF-09 — Audio e tempo

- Selezionare un ingresso audio.
- Analizzare il livello senza mandare audio in uscita.
- Regolare la sensibilità.
- Tap tempo.
- BPM manuale tra 60 e 200.
- Stima automatica del BPM opzionale.
- Rilevamento beat con impulso utilizzabile dagli effetti.
- Reazione audio e beat configurabile per effetto.

### RF-10 — Autopilot

- Attivabile e disattivabile.
- Intervallo in beat.
- Selezione casuale di un media riproducibile.
- Auto-mix tra deck.
- Auto-effetto temporaneo, rimosso dopo circa 12 secondi.
- Non deve selezionare sorgenti capture.

### RF-11 — Output

- Aprire una seconda finestra Electron.
- Scegliere il display di destinazione.
- Andare a schermo intero.
- Ricevere lo stesso stato del control.
- Ricevere il transport per audio-reattività.
- Mostrare il programma o il monitor A/B.
- Chiudere l'output dal control.
- Impedire lo spegnimento del display durante l'output.
- Gestire la chiusura della finestra output.

### RF-12 — Progetti

- Salvare su file JSON.
- Aprire un progetto salvato.
- Validare e sanificare i dati caricati.
- Ripristinare l'ultimo progetto tramite autosave.
- Creare un nuovo progetto demo.
- Non serializzare le anteprime temporanee della UI.

### RF-13 — Scorciatoie

- Spazio: tap tempo.
- B: blackout.
- [ e ]: dissolvenza verso deck A/B.
- 1–9: media corrispondente sul target.
- Canc: svuota layer.
- F1: pannello scorciatoie.
- Esc: chiude menu e finestre.

### RF-14 — Diagnostica

- Mostrare FPS nel preview.
- Mostrare errori di inizializzazione WebGL.
- Mostrare toast per import, permessi, salvataggio e output.
- Riportare in console gli errori del renderer in sviluppo.

---

## 5. Requisiti non funzionali

- **Prestazioni:** preview a 1280x720 e output a 1920x1080; obiettivo 60 fps su hardware recente con quattro layer attivi per deck.
- **Latenza:** ingresso video percepito come live; obiettivo indicativo sotto i 150 ms, da misurare su hardware reale.
- **Stabilità:** un errore nel rendering non deve chiudere l'app.
- **Avvio:** l'app deve essere utilizzabile in pochi secondi e senza connessione.
- **Cross-platform:** macOS e Windows.
- **Sicurezza:** `contextIsolation` attivo, `nodeIntegration` disattivo, accesso al filesystem mediato dal main process.
- **Permessi:** camera e microfono richiesti esplicitamente; nessun accesso implicito.
- **Recupero:** un progetto JSON corrotto non deve impedire l'avvio; si ricade sul progetto demo.
- **Semplicità:** le azioni principali devono essere raggiungibili in uno o due clic.

---

## 6. Modello dati

### 6.1 Entità principali

| Entità | Contenuto |
|---|---|
| `MediaItem` | id, nome, tipo, percorso, impostazioni generatore/testo, metadati |
| `Layer` | id, sorgente, opacità, blend, fit, trasformazione, effetti, fade, visibilità |
| `Deck` | id A/B e quattro layer |
| `EffectInstance` | id, tipo, abilitato, mix, reattività audio/beat, parametri |
| `ShowState` | libreria, deck, crossfade, master, blackout, BPM |
| `ProjectData` | ShowState + autopilot, audio, output, nome progetto |
| `TransportData` | BPM, livello, impulso beat, indice beat, fase della battuta |

### 6.2 Sorgenti layer

- `media`: riferimento a un elemento della libreria, con `startedAt`.
- `capture`: dispositivo live, con etichetta e `startedAt`.

### 6.3 Persistenza

- File progetto JSON con `version: 1`.
- Autosave in `localStorage` alla chiave `staffvj.autosave.v1`.
- Scrittura autosave con debounce di 500 ms.

---

## 7. Interfaccia

Layout a tre colonne:

1. **Sinistra:** libreria media, filtri, import, generatori, ingressi video.
2. **Centro:** preview program, selettore monitor A/B, crossfader, deck A/B.
3. **Destra:** Inspector con tab Layer, Master, Auto, Audio, Output.

Elementi globali:

- top bar con nome progetto, BPM, tap, salva/apri/nuovo, scorciatoie, output, blackout;
- toast in basso;
- modale effetti;
- modale scorciatoie.

---

## 8. Flussi principali

### 8.1 Avvio

1. Electron crea la finestra control.
2. Il renderer carica il progetto autosaved o il demo.
3. Il motore WebGL2 viene inizializzato.
4. Il runtime invia lo stato all'output, se aperto.
5. Parte il loop di rendering e il loop del transport.

### 8.2 Importazione

1. L'utente preme Importa.
2. Il main apre il dialog di sistema.
3. I file scelti diventano `MediaItem`.
4. La libreria viene aggiornata e salvata in autosave.
5. L'utente clicca il media per mandarlo sul target.

### 8.3 Live

1. L'operatore prepara un deck.
2. Lancia il media sul layer desiderato.
3. Regola opacità, trasformazione ed effetti.
4. Passa al deck B.
5. Usa il crossfader o l'auto-mix.
6. L'output riceve lo stato con un throttle di circa 40 ms.

### 8.4 Output

1. L'utente seleziona il display.
2. Il main crea la finestra output sullo schermo scelto.
3. La finestra riceve snapshot, stato e transport.
4. Va a schermo intero.
5. Alla chiusura, il control riceve l'evento e aggiorna lo stato.

### 8.5 Salvataggio

1. Il main apre il dialog di salvataggio.
2. Il renderer serializza `ProjectData`.
3. Il file viene scritto dal main.
4. Un toast conferma l'esito.

---

## 9. Formati e compatibilità

### 9.1 Video

- Contenitore: MP4, M4V, MOV, WebM, MKV, AVI, OGV.
- Codec consigliato: H.264 in MP4 o MOV.
- Codec non garantiti: HEVC/H.265, ProRes, HAP, AV1.
- I video sono muti e vanno in loop.
- La riproduzione dipende dai codec inclusi in Chromium/Electron.

### 9.2 Immagini

PNG, JPG, JPEG, GIF, WebP, AVIF, BMP, SVG.

### 9.3 Audio

L'audio non viene riprodotto dal programma. Viene solo analizzato dall'ingresso scelto.

### 9.4 Sistemi

- macOS: richiede permessi camera/microfono.
- Windows: da verificare con packaging e driver della scheda di acquisizione.
- Output: richiede un display aggiuntivo per un utilizzo corretto.

---

## 10. Limiti noti e rischi

1. **NDI assente.** Non è possibile implementarlo solo con WebGL/Chromium; serve un SDK nativo o shared memory.
2. **Doppia acquisizione.** Control e output possono tentare di aprire la stessa scheda video; alcuni driver non lo consentono.
3. **Codec.** HEVC, ProRes e HAP possono non essere decodificati.
4. **Output su un solo schermo.** Va a schermo intero e copre il control.
5. **Prestazioni.** Con quattro layer, effetti master e output 1080p l'hardware può non mantenere 60 fps.
6. **Audio.** Il rilevamento BPM è euristico e può sbagliare su musica molto ritmica o molto rumorosa.
7. **Progetti.** I percorsi dei media sono assoluti: spostando i file il progetto non li ritrova.
8. **Windows.** Il percorso di build e i permessi non sono ancora stati validati su macchina reale.

---

## 11. Criteri di accettazione v0.1

### 11.1 Tecnici

- [x] `npm run build` completa senza errori TypeScript.
- [x] `npm run smoke` apre l'app, carica il demo e salva `smoke-control.png`.
- [x] La UI si renderizza correttamente a 1480x940.
- [x] Preview, deck, libreria e Inspector sono visibili.
- [x] Il progetto demo mostra generatori, testo e vignetta master.
- [x] Aggiunta di un effetto master e persistenza dopo reload.
- [x] Creazione di un generatore e aggiornamento del preview.
- [x] Modifica del testo e aggiornamento del preview.
- [x] Apertura e chiusura della finestra output con canvas 1920x1080.
- [x] Autosave e ripristino del progetto dopo reload.
- [ ] Importazione video/immagine verificata su file reali.
- [ ] Ingresso telecamera/scheda acquisizione verificato su hardware reale.
- [ ] Ingresso audio e beat verificati su hardware reale.
- [ ] Finestra output verificata su secondo schermo fisico.
- [ ] Salvataggio e riapertura progetto tramite dialog verificati.
- [ ] Build macOS installabile verificata.
- [ ] Build Windows verificata.

### 11.2 Funzionali

- [x] Due deck con quattro layer.
- [x] Crossfade e auto-crossfade.
- [x] Effetti per layer e master.
- [x] Testi modificabili.
- [x] Generatori parametrizzabili.
- [x] Master opacity e blackout.
- [x] Scorciatoie principali.
- [x] Autosave.
- [x] Permessi camera/microfono richiesti esplicitamente.

---

## 12. Roadmap successiva

1. Test sul campo con scheda di acquisizione e proiettore.
2. Documento di realizzazione e manuale operatore.
3. Miglioramento gestione doppia acquisizione.
4. NDI input/output.
5. Registrazione del programma.
6. Maschere e mapping.
7. Controllo midi.
8. Packaging firmato macOS e Windows.
