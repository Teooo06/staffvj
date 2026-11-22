# StaffVJ — Documento di realizzazione

**Versione:** 0.1 (prototipo)
**Data:** 23 ottobre 2026
**Riferimento:** `docs/SPECIFICHE.md`

---

## 1. Panoramica architetturale

StaffVJ è un'app Electron con due renderer React:

```text
┌─────────────────────────────────────────────────────────────┐
│                     Electron main process                   │
│  finestre, dialog, protocollo vjmedia, display, permessi    │
│  IPC: stato, transport, snapshot, output                    │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                │ preload.cjs                 │ preload.cjs
                ▼                             ▼
┌───────────────────────────┐     ┌───────────────────────────┐
│ Control renderer          │     │ Output renderer           │
│ React + Zustand           │     │ React + VJEngine          │
│ VJEngine preview 720p     │     │ VJEngine output 1080p     │
│ UI, libreria, inspector   │     │ solo canvas + errori      │
└───────────────────────────┘     └───────────────────────────┘
```

Il control è l'unica fonte di verità per lo stato del progetto. L'output riceve lo stato tramite IPC e mantiene un proprio motore WebGL2 indipendente.

### 1.1 Flusso di stato

1. L'utente modifica lo stato Zustand nel control.
2. `useShowRuntime` si iscrive allo store.
3. A ogni modifica viene chiamato `engine.setState(buildShowState(state))`.
4. Lo stato viene inviato all'output con throttle di circa 40 ms.
5. Il transport viene inviato con throttle di circa 50 ms.
6. L'output applica stato e transport al proprio motore.

### 1.2 Perché due motori

L'output deve poter essere a 1920x1080 e su un display separato, mentre il control resta a 1280x720 per non consumare risorse inutilmente. Tenere due contesti WebGL separati evita di dover trasferire texture tra processi.

Il costo è che entrambi i motori aprono le sorgenti capture in modo indipendente. È un limite noto, descritto nelle specifiche.

---

## 2. Stack e versioni

| Componente | Versione |
|---|---|
| Electron | 45 |
| Chromium | incluso in Electron 45 |
| Node | incluso in Electron 45 |
| Vite | 8.3 |
| React | 19.3 |
| TypeScript | 5.9 |
| Zustand | 5.0 |
| electron-builder | 26.15 |

Non sono presenti librerie UI o motori grafici esterni: il rendering è WebGL2 puro.

---

## 3. Struttura del repository

```text
staffvj/
├─ electron/
│  ├─ main.cjs          processo principale, finestre, IPC, protocollo media
│  └─ preload.cjs       API window.vj
├─ src/
│  ├─ App.tsx           layout control
│  ├─ main.tsx          bootstrap React, routing control/output
│  ├─ store.ts          stato Zustand, azioni, sanitizzazione, autosave
│  ├─ types.ts          modello dati condiviso
│  ├─ demo.ts           progetto demo, default, factory
│  ├─ vj.d.ts           tipi globali di window.vj
│  ├─ styles.css        tema e layout
│  ├─ audio/
│  │  └─ transport.ts   clock BPM, tap, analyser, beat detection
│  ├─ engine/
│  │  ├─ engine.ts          VJEngine, pipeline WebGL2
│  │  ├─ mediaManager.ts    video, immagini, capture, testi
│  │  ├─ textTexture.ts     rendering testi su canvas
│  │  ├─ generators.ts      shader dei generatori
│  │  ├─ effectDefs.ts      definizioni e shader degli effetti
│  │  └─ glUtils.ts         Program, RenderTarget, quad
│  ├─ hooks/
│  │  ├─ useShowRuntime.ts      motore, store, IPC, autopilot
│  │  ├─ useMediaDevices.ts     enumerazione ingressi
│  │  └─ useKeyboardShortcuts.ts
│  ├─ lib/
│  │  ├─ devices.ts
│  │  └─ utils.ts
│  ├─ components/
│  │  ├─ TopBar.tsx
│  │  ├─ MediaPanel.tsx
│  │  ├─ PreviewPanel.tsx
│  │  ├─ Crossfader.tsx
│  │  ├─ DecksBar.tsx
│  │  ├─ Inspector.tsx
│  │  ├─ EffectBrowser.tsx
│  │  ├─ EffectRack.tsx
│  │  ├─ Slider.tsx
│  │  ├─ Modal.tsx
│  │  ├─ Toasts.tsx
│  │  ├─ Shortcuts.tsx
│  │  └─ Icons.tsx
│  └─ output/
│     └─ OutputApp.tsx  renderer della finestra output
├─ public/
│  ├─ logo.png
│  └─ logo-dark.png
├─ docs/
│  ├─ SPECIFICHE.md
│  └─ REALIZZAZIONE.md
├─ index.html
├─ vite.config.ts
├─ tsconfig.json
├─ electron-builder.yml
└─ package.json
```

---

## 4. Processo principale Electron

File: `electron/main.cjs`.

### 4.1 Finestre

**Control window**

- dimensioni 1480x940, minime 1180x740;
- `titleBarStyle: hiddenInset` su macOS, `hidden` + `titleBarOverlay` su Windows;
- `show: false` fino a `ready-to-show`;
- sfondo `#07080c`;
- logging degli errori console del renderer;
- gestione `did-fail-load` e `render-process-gone`.

**Output window**

- creata su richiesta con `output:open`;
- posizionata sui `bounds` del display scelto;
- frame assente, sfondo nero;
- `setSimpleFullScreen(true)` su macOS, `setFullScreen(true)` su Windows;
- `showInactive()` per non rubare il focus;
- `powerSaveBlocker` attivo finché la finestra è aperta;
- invia `output:closed` al control alla chiusura;
- riceve snapshot appena il renderer è pronto.

### 4.2 Sicurezza

Preload con:

```js
contextIsolation: true,
nodeIntegration: false,
sandbox: false
```

Il renderer non ha accesso diretto a Node o al filesystem. Tutte le operazioni sensibili passano da IPC.

La pagina include una Content Security Policy che consente:

- script e stili locali;
- immagini e media `vjmedia:`, `blob:` e `data:`;
- connessioni WebSocket per l'HMR di Vite.

### 4.3 Protocollo `vjmedia://`

Serve a servire i file locali al renderer evitando problemi di accesso diretto al filesystem.

- schema registrato come privilegiato, standard, secure, CORS e stream;
- URL nella forma `vjmedia://media?p=/percorso/assoluto/file.mp4`;
- supporto `HEAD`;
- supporto `Range` per seeking e streaming;
- header CORS;
- MIME derivato dall'estensione;
- stream da `fs.createReadStream`.

### 4.4 Permessi

`setupPermissions` abilita:

- media, audioCapture, videoCapture;
- MIDI;
- fullscreen;
- clipboard-sanitized-write.

Su macOS `app:ask-media-access` chiama `systemPreferences.askForMediaAccess('camera' | 'microphone')`. Il renderer lo invoca prima di aprire un ingresso o il microfono.

### 4.5 IPC

| Canale | Direzione | Scopo |
|---|---|---|
| `app:info` | invoke | versione app, Electron, Chrome |
| `app:ask-media-access` | invoke | permesso camera/microfono |
| `app:renderer-ready` | send | renderer pronto, snapshot o smoke |
| `media:open-dialog` | invoke | import media |
| `project:save` | invoke | salvataggio JSON |
| `project:load` | invoke | apertura JSON |
| `output:list-displays` | invoke | elenco display |
| `output:open` | invoke | apre output su display |
| `output:close` | invoke | chiude output |
| `output:is-open` | invoke | stato output |
| `output:get-snapshot` | invoke | stato iniziale per output |
| `output:state` | send | stato show dal control |
| `output:transport` | send | transport dal control |
| `output:closed` | send | output chiuso |
| `output:displays-changed` | send | display aggiunto/rimosso |

Lo stato e il transport sono accettati solo se provengono dal control.

### 4.6 Smoke test

Con `VJ_SMOKE=1`:

1. l'app usa un profilo temporaneo in `os.tmpdir()/staffvj-smoke-profile`, così lo smoke non legge l'autosave dell'utente;
2. l'app parte con `VJ_LOAD_DIST=1`;
3. attende `app:renderer-ready` dal control;
4. dopo 2,2 secondi cattura la pagina;
5. salva `smoke-control.png`;
6. chiude l'app.

La chiamata `window.vj.rendererReady()` è obbligatoria: senza di essa lo smoke va in timeout.

---

## 5. API preload

File: `electron/preload.cjs`, tipi in `src/vj.d.ts`.

`window.vj` espone:

- `platform`, `isElectron`, `appInfo`;
- `askMediaAccess`;
- `openMediaDialog`, `saveProject`, `loadProject`;
- `listDisplays`, `openOutput`, `closeOutput`, `isOutputOpen`;
- `getSnapshot`, `sendState`, `sendTransport`, `rendererReady`;
- `onState`, `onTransport`, `onSnapshot`;
- `onOutputClosed`, `onDisplaysChanged`;
- `quit`.

Le funzioni `on*` restituiscono una funzione di unsubscribe.

---

## 6. Stato applicativo

File: `src/store.ts`.

### 6.1 Zustand

Lo store contiene sia lo stato del progetto sia lo stato della UI:

- progetto: libreria, deck, crossfade, master, blackout, BPM, autopilot, audio, output;
- UI: target, media selezionato, monitor, tab inspector, modali, toast, display.

Le azioni principali:

- `triggerMedia`, `triggerCapture`;
- `updateLayer`, `updateTransform`, `clearLayer`, `toggleLayerVisible`;
- `addEffect`, `updateEffect`, `toggleEffect`, `removeEffect`;
- `setCrossfade`, `animateCrossfade`;
- `setMasterOpacity`, `setBlackout`, `setBpm`;
- `setAutopilot`, `setAudio`, `setOutput`;
- `refreshDisplays`, `toggleOutput`;
- `saveProject`, `loadProject`, `newProject`, `replaceProject`.

### 6.2 Crossfade animato

`animateCrossfade` usa `requestAnimationFrame` e una curva di easing. Se parte una nuova animazione, quella precedente viene annullata.

### 6.3 Autosave

`installAutosave` viene chiamato da `src/main.tsx` all'avvio del control e si iscrive allo store:

- serializza il progetto con `toProjectData`;
- confronta il JSON con l'ultimo salvato;
- usa un debounce di 500 ms;
- scrive in `localStorage` alla chiave `staffvj.autosave.v1`.

Il progetto viene ripristinato al caricamento del modulo. In caso di errore si usa `createDemoProject()`.

### 6.4 Sanitizzazione

`sanitizeProject` valida:

- media e riferimenti;
- layer e trasformazioni;
- effetti e parametri;
- deck A/B;
- master, audio, autopilot, output.

I dati non validi vengono sostituiti con default. Un progetto corrotto non blocca l'avvio.

### 6.5 ShowState

`buildShowState` produce il sottoinsieme di stato necessario al rendering:

- nome, libreria senza thumbnail;
- deck completi;
- crossfade, master, blackout, BPM.

Non include autopilot, audio, display o stato UI.

---

## 7. Motore WebGL2

File: `src/engine/engine.ts`.

### 7.1 Inizializzazione

`new VJEngine(canvas, { width, height })`:

- imposta le dimensioni del canvas;
- crea il contesto WebGL2 con `alpha: false`, `antialias: false`, `powerPreference: high-performance`;
- disabilita depth, cull e scissor;
- crea quad, programmi, target e `MediaManager`;
- avvia il loop con `requestAnimationFrame`.

Se WebGL2 non è disponibile viene lanciato un errore che la UI mostra nel preview.

### 7.2 Target

| Target | Scopo |
|---|---|
| deck A/B (2 ciascuno) | ping-pong del compositing dei layer |
| master (2) | ping-pong degli effetti master |
| generator (1) | output temporaneo dei generatori |
| layer (2 per layer) | allocati lazy, ping-pong degli effetti layer |

I target dei layer vengono creati al primo utilizzo per non allocare memoria inutile.

### 7.3 Pipeline

```text
Sorgente
  ↓
FBO layer trasparente
  ↓
effetti layer (ping-pong)
  ↓
compositing layer dal basso verso l'alto
  ↓
FBO deck A / deck B
  ↓
crossfade A/B
  ↓
effetti master (ping-pong)
  ↓
final: masterOpacity + blackout
  ↓
canvas
```

Il layer 0 è il più alto: il loop di compositing parte da `DECK_LAYER_COUNT - 1` e arriva a 0.

### 7.4 Sorgenti

`MediaManager` gestisce:

- **video:** elemento HTMLVideoElement nascosto, muto, in loop, con sincronizzazione a `startedAt`;
- **immagini:** caricamento con CORS e upload texture;
- **capture:** `getUserMedia` con deviceId, retry e gestione errori;
- **testi:** canvas 1280x720 e texture WebGL.

L'upload usa `UNPACK_FLIP_Y_WEBGL`, perché le texture WebGL hanno l'asse Y invertito rispetto al canvas.

### 7.5 Sorgente video

`renderSource` applica:

- cover o contain;
- offset X/Y;
- scala;
- rotazione in radianti;
- texture della sorgente.

### 7.6 Compositing

`COMPOSITE_FRAGMENT` implementa otto blend mode:

| Modo | Indice |
|---|---|
| normal | 0 |
| add | 1 |
| screen | 2 |
| multiply | 3 |
| overlay | 4 |
| difference | 5 |
| lighten | 6 |
| darken | 7 |

Il layer è trasparente (`TARGET_CLEAR = [0,0,0,0]`), il deck parte da nero opaco.

### 7.7 Effetti

`effectDefs.ts` contiene:

- metadati e parametri;
- shader GLSL generati da `buildEffectShader`;
- `EFFECT_DEFS`, `EFFECT_CATEGORIES`, `MAX_EFFECTS = 4`;
- `createEffectInstance`.

`renderEffect` imposta:

- texture di input;
- risoluzione;
- tempo;
- mix;
- livello audio e impulso beat scalati per `audioReact`/`beatReact`;
- fino a quattro parametri.

Il wrapper comune degli effetti applica una lieve reazione ai livelli audio e al beat.

### 7.8 Generatori

`generators.ts` contiene shader per:

- plasma;
- aurora;
- tunnel;
- griglia;
- tramonto;
- rumore;
- test card;
- tinta unita.

Il tempo è assoluto: `(Date.now() % 86400000) / 1000`. In questo modo control e output mostrano la stessa animazione senza dover sincronizzare un clock.

### 7.9 Testi

`TextRenderer`:

- canvas 1280x720;
- ridisegno solo se cambiano le impostazioni o se l'animazione è attiva;
- redraw animato ogni circa 33 ms;
- texture cache per id media;
- supporto a outline, sfondo, spaziatura e allineamento;
- animazioni `none`, `scroll-left`, `scroll-right`, `pulse`, `typewriter`, `bounce`.

### 7.10 Crossfade e master

Dopo il rendering dei due deck:

- `CROSSFADE_FRAGMENT` miscela A e B con `u_t`;
- il monitor `program` usa il mix reale;
- il monitor `A` forza A;
- il monitor `B` forza B;
- gli effetti master vengono applicati in ping-pong;
- `FINAL_FRAGMENT` applica opacità e blackout.

### 7.11 Layer fade

Ogni layer ha `fadeMs`. Se `startedAt` è valido, l'opacità viene moltiplicata per una rampa lineare tra 0 e 1. Il fade si applica solo all'attivazione della sorgente.

### 7.12 FPS e ciclo

Il loop:

- calcola `wallNow` e `seconds`;
- aggiorna il contatore FPS ogni secondo;
- chiama `render`;
- intercetta errori e li logga una sola volta.

### 7.13 Dispose

Il dispose:

- annulla il RAF;
- elimina programmi e target;
- svuota le cache;
- ferma stream e video;
- rimuove i listener.

---

## 8. Audio e transport

File: `src/audio/transport.ts`.

`TransportClock`:

- mantiene BPM tra 60 e 200;
- calcola la posizione del beat con anchor time;
- gestisce tap tempo con media pesata;
- crea `AudioContext` e `AnalyserNode` (FFT 1024);
- calcola il livello RMS;
- rileva onset e impulso beat;
- stima il BPM se `autoBpm` è attivo;
- restituisce `TransportData` con BPM, livello, beat, fase.

`useShowRuntime`:

- crea il clock;
- collega l'audio quando abilitato;
- gestisce i permessi microfono;
- invia il transport all'output;
- aggiorna la UI ogni circa 90 ms;
- aggiorna gli FPS ogni circa 600 ms.

---

## 9. Runtime del control

File: `src/hooks/useShowRuntime.ts`.

Responsabilità:

1. Creare il motore sul canvas del preview.
2. Applicare lo stato iniziale.
3. Iscriversi allo store.
4. Inviare lo stato all'output con throttle.
5. Avviare il loop del transport.
6. Eseguire l'autopilot.
7. Gestire display e chiusura output.
8. Ripulire tutto allo smontaggio.

### 9.1 Autopilot

A ogni beat:

- se disabilitato, resetta l'indice;
- se il beat non è multiplo di `everyBeats`, non fa nulla;
- sceglie un media riproducibile;
- lo manda sul target;
- opzionalmente alterna il crossfade;
- opzionalmente aggiunge un effetto e lo rimuove dopo 12 secondi.

### 9.2 Permessi

Prima di collegare l'audio viene chiamato `window.vj.askMediaAccess('microphone')`. In caso di rifiuto:

- viene mostrato un toast;
- `audio.enabled` viene riportato a `false`.

Prima di avviare una capture viene chiamato `askMediaAccess('camera')`.

---

## 10. Interfaccia

File: `src/App.tsx` e `src/components`.

- **TopBar:** progetto, BPM, tap, salva/apri/nuovo, scorciatoie, output, blackout.
- **MediaPanel:** import, testo, generatori, ricerca, filtri, griglia, ingressi video.
- **PreviewPanel:** canvas, monitor program/A/B, FPS, errore WebGL.
- **Crossfader:** slider A/B e auto-crossfade.
- **DecksBar:** deck A/B, layer 1–4, sorgente, fade, visibilità, svuota.
- **Inspector:**
  - Layer: opacità, blend, fit, trasformazione, fade, catena effetti, contenuto;
  - Master: opacità, blackout, effetti master;
  - Auto: autopilot;
  - Audio: ingresso, sensibilità, autoBPM;
  - Output: display, apertura/chiusura.
- **EffectBrowser:** scelta effetto per categoria.
- **Toasts:** feedback non bloccante.
- **Modali:** effetti e scorciatoie.

Il canvas del preview è lo stesso canvas del motore: non ci sono canvas nascosti o copie.

---

## 11. Finestra output

File: `src/output/OutputApp.tsx`.

- crea `VJEngine` con risoluzione 1920x1080;
- ascolta `onState`, `onTransport`, `onSnapshot`;
- chiede lo snapshot iniziale;
- chiama `rendererReady`;
- disabilita il menu contestuale;
- rimuove il canvas e il motore allo smontaggio.

L'output non ha UI: mostra solo il canvas o un messaggio di errore WebGL.

---

## 12. Build e avvio

### 12.1 Sviluppo

```bash
npm install
npm run dev
```

`concurrently` avvia Vite e attende `127.0.0.1:5173` prima di lanciare Electron.

### 12.2 Build

```bash
npm run build
```

Esegue `tsc --noEmit` e `vite build`. L'output va in `dist/`.

### 12.3 Avvio su build

```bash
VJ_LOAD_DIST=1 npm start
```

Senza `VJ_LOAD_DIST`, in sviluppo l'app prova prima il dev server e poi ricade su `dist`.

### 12.4 Smoke

```bash
npm run smoke
open smoke-control.png
```

### 12.5 Packaging

```bash
npm run dist:mac
npm run dist:win
```

macOS produce un DMG; Windows un installer NSIS. Il packaging non è ancora stato validato su hardware reale.

### 12.6 Warning noto

Vite segnala che `vite.config.ts` usa sintassi ESM in un file caricato come CommonJS. È un warning, non un errore. Per eliminarlo si può rinominare il file in `vite.config.mts` o aggiungere `"type": "module"` al `package.json`, verificando prima l'impatto sul main CJS.

---

## 13. Test

### 13.1 Automatici disponibili

- `tsc --noEmit` tramite `npm run build`;
- build Vite;
- smoke Electron con screenshot.

### 13.2 Manuali consigliati

1. Avvio con progetto demo.
2. Cambio media su layer diversi.
3. Modifica testo e verifica aggiornamento preview.
4. Aggiunta e rimozione effetto layer.
5. Effetto master.
6. Crossfade e auto-crossfade.
7. Import MP4 H.264 e PNG.
8. Import HEVC/ProRes per verificare il comportamento di errore.
9. Ingresso telecamera.
10. Ingresso audio con permesso concesso e negato.
11. Output su secondo display.
12. Salvataggio, chiusura, riapertura.
13. Ripristino autosave.
14. Progetto JSON corrotto.
15. Finestra output chiusa dal sistema.

### 13.3 Problemi già corretti

- **Schermata nera all'avvio:** React error #185 causato da `EffectBrowser` che restituiva `[]` come nuovo oggetto a ogni lettura dello store. Risolto con una costante `NO_EFFECTS`.
- **Smoke in timeout:** mancava `window.vj.rendererReady()` nel runtime del control.
- **Ping-pong del deck:** il target di spare veniva calcolato una volta sola; corretto il calcolo per ogni passata.
- **Shader con `smoothstep` invertito:** corretti grid, sunset e test card.
- **Errori TypeScript su transport e DecksBar:** corretti.
- **Permessi camera/microfono:** aggiunta la richiesta esplicita prima dell'uso.
- **Autosave non attivo:** `installAutosave` esisteva ma non veniva mai chiamato. Ora viene invocato in `src/main.tsx` solo nel control, non nell'output.
- **Dev server non raggiungibile:** Vite ascoltava su `[::1]:5173` mentre Electron e `wait-on` usavano `127.0.0.1`. Aggiunto `server.host: '127.0.0.1'` in `vite.config.ts`; `npm run dev` e HMR ora funzionano.

### 13.4 Verifiche di interazione eseguite

Test realizzati tramite Chrome DevTools Protocol sull'app compilata:

- aggiunta dell'effetto master Glow e verifica della catena;
- creazione del generatore Tramonto 2 sul layer selezionato;
- modifica del testo in tempo reale;
- filtro libreria per Testi;
- blackout on/off da tastiera;
- apertura e chiusura output;
- canvas output 1920x1080;
- autosave e ripristino dopo reload, inclusi effetto e testo modificato;
- assenza di errori console nel control e nell'output.

---

## 14. Scelte progettuali

### 14.1 WebGL2 puro

Evita dipendenze da motori grafici e mantiene il controllo su shader, target e passaggi. È adatto a un prototipo e a un'app locale.

### 14.2 Stato unico nel control

L'output non ha stato proprio: riceve tutto dal control. Questo semplifica la coerenza e il salvataggio, al costo di dover trasferire lo stato via IPC.

### 14.3 Tempo assoluto per i generatori

Usare `Date.now()` permette a control e output di animare gli stessi generatori senza sincronizzare clock o frame.

### 14.4 Target lazy per i layer

I layer sono otto per deck, ma non tutti sono attivi. Allocare i target solo al primo uso riduce memoria e costo di inizializzazione.

### 14.5 Effetti come shader generati

Ogni effetto ha un frammento GLSL costruito da una definizione comune. Aggiungere un effetto significa aggiungere una definizione, non un nuovo percorso di rendering.

### 14.6 Sanitizzazione difensiva

I progetti sono file esterni. La sanitizzazione evita crash e mantiene l'app avviabile anche con dati parziali o corrotti.

### 14.7 Nessun audio in uscita

L'audio serve solo all'analisi. Questo evita feedback, problemi di routing e latency nella prima versione.

---

## 15. Debito tecnico e prossimi passi

1. Gestire la doppia acquisizione control/output.
2. Testare e documentare i codec supportati su Mac e Windows.
3. Validare il packaging e la firma.
4. Ridurre il warning Vite sulla configurazione.
5. Aggiungere test automatici di interazione, non solo smoke.
6. Rifinire la UI della libreria (filtri su una sola riga o griglia).
7. Rimuovere la duplicazione del badge "Vuoto" nell'Inspector.
8. Semplificare il bottone suggerito in `EffectRack`.
9. Valutare NDI input/output.
10. Valutare registrazione del programma.
