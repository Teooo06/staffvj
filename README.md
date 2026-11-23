# StaffVJ

Sistema VJ live per Stafffeste: mixer video a due deck, effetti WebGL2, testi, generatori, audio-reattivo, scene richiamabili e output su proiettore o display separato.

L'app è Electron + React. L'interfaccia e i documenti interni sono in italiano.

## Requisiti

- Node.js 22 LTS (minimo 20.19; Vite 8 e le dipendenze native NDI richiedono Node aggiornato).
- npm 10 o successivo.
- Git.
- macOS, Windows 10/11 oppure una distribuzione Linux con ambiente grafico.

NDI è opzionale: `npm install` prova a scaricare il runtime nativo precompilato per il sistema in uso. Se NDI non serve, l'app funziona lo stesso.

## Installazione e avvio rapido

Apri il terminale nella cartella del progetto:

```bash
git clone https://github.com/Teooo06/staffvj.git
cd staffvj
npm install
npm run dev
```

`npm run dev` avvia Vite su `http://127.0.0.1:5173` e poi Electron. Le modifiche al codice si ricaricano automaticamente.

Per avviare una build già compilata:

```bash
npm run build
npm start
```

In alternativa, per forzare Electron a usare `dist/` senza tentare il dev server:

```bash
# macOS e Linux
VJ_LOAD_DIST=1 npm start
```

```powershell
# Windows PowerShell
$env:VJ_LOAD_DIST="1"; npm start
```

## Avvio per sistema operativo

### macOS

1. Installa Node.js 22 LTS da [nodejs.org](https://nodejs.org/) oppure con Homebrew: `brew install node@22`.
2. Installa le dipendenze e avvia:

   ```bash
   npm install
   npm run dev
   ```

3. Al primo uso di telecamera o microfono, autorizza StaffVJ in **Impostazioni di Sistema → Privacy e Sicurezza → Fotocamera/Microfono**.
4. Per NDI, autorizza l'accesso alla rete locale se macOS lo chiede e consenti le connessioni in ingresso nel firewall.

Se macOS blocca un'app non firmata durante il packaging, apri il DMG con tasto destro → **Apri**. Le build di produzione non sono ancora firmate/notarizzate.

### Windows

1. Installa Node.js 22 LTS da [nodejs.org](https://nodejs.org/) (installer `.msi`, architettura x64).
2. Apri PowerShell nella cartella del progetto:

   ```powershell
   npm install
   npm run dev
   ```

3. Al primo utilizzo consenti a StaffVJ l'accesso a fotocamera e microfono in **Impostazioni → Privacy e Sicurezza → Fotocamera/Microfono**.
4. Per NDI, al primo avvio Windows può chiedere di autorizzare Node/Electron nel firewall: consenti almeno sulle reti private.

Se PowerShell blocca `npm.ps1` per i criteri di esecuzione, usa `npm.cmd install` e `npm.cmd run dev`, oppure imposta:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Lo script `npm run smoke` usa variabili d'ambiente in sintassi POSIX; su Windows eseguilo così:

```powershell
$env:VJ_LOAD_DIST="1"; $env:VJ_SMOKE="1"; npx electron .
```

### Linux

Serve un ambiente desktop con accelerazione grafica e le librerie richieste da Electron (su Debian/Ubuntu di solito `libnss3`, `libatk-bridge2.0-0`, `libgtk-3-0` e `libasound2`). Se Electron non parte, installa le dipendenze mancanti indicate dall'errore.

Con Node.js 22 già installato:

```bash
npm install
npm run dev
```

In alternativa, con nvm:

```bash
nvm install 22
nvm use 22
npm install
npm run dev
```

Note:

- Preferisci una sessione X11 se la finestra risulta vuota o instabile su Wayland.
- Non eseguire Electron come utente root: il sandbox di Chromium può rifiutarsi di partire.
- Per NDI apri le porte richieste dal runtime e verifica che la rete locale non isoli i dispositivi (mDNS/multicast).

## Comandi utili

| Comando | Funzione |
|---|---|
| `npm run dev` | Vite + Electron in sviluppo |
| `npm run build` | Type-check TypeScript e build di produzione in `dist/` |
| `npm start` | Avvia Electron sulla build disponibile |
| `npm run smoke` | Build + avvio automatico + screenshot `smoke-control.png` (macOS/Linux) |
| `npm run dist:mac` | Crea un DMG macOS |
| `npm run dist:win` | Prepara NDI Windows x64 e crea un installer NSIS |
| `npm run prepare:ndi-platform -- <piattaforma> <arch>` | Prepara il pacchetto NDI per il packaging |

Il packaging Linux non ha ancora uno script dedicato. Dopo `npm run build` si può provare:

```bash
npx electron-builder --linux
```

## Funzioni principali

- Due deck A/B con crossfader e take live.
- Layer multipli per deck, trasformazioni, opacità, blend e fade.
- Import di video, immagini, testi, generatori, telecamere, NDI e pagine web/HTML.
- Effetti WebGL2 sul layer, sul deck o sul master.
- BPM manuale, tap tempo e analisi audio con ingressi mix/bass/hybrid.
- Scene salvabili con anteprima, tasti rapidi e richiamo momentaneo: tocco singolo = circa 1 secondo, tieni premuto = resta finché tieni, `Enter` = blocca la scena, `Esc` / `Shift` / `Ctrl` / `Tab` = annulla e ripristina la preview.
- Tasti scena con secondo livello tramite `Ctrl` (es. `Ctrl+A`), pannello dei tasti già usati, tastiera italiana visualizzata nella modale Scorciatoie e tasti assegnati bloccati.
- `Backspace` cambia il deck attivo; `ì` esegue il taglio netto del deck attivo sul programma.
- I tasti globali sono disattivati quando scrivi in un campo di testo o input (titoli, valori numerici, ecc.).
- Controllo video con intervallo a due maniglie (inizio/fine), play/pausa, stop, ricomincia, indietro/avanti 5 s, loop e velocità; l'intervallo agisce dopo il caricamento della durata del video.
- Output separato su display/proiettore.

## Documentazione

- `docs/SPECIFICHE.md`: requisiti e limiti.
- `docs/REALIZZAZIONE.md`: architettura, flusso stato, motore e build.
- `docs/CDJ-3000-test.md`: prove di integrazione con CDJ/Pioneer DJ.

## Note tecniche

- `npm run build` usa `tsc --noEmit` + Vite.
- Vite segnala un warning non bloccante sul caricamento ESM di `vite.config.ts` in un package CommonJS.
- Il progetto è privato (`UNLICENSED`); non distribuire build o asset senza autorizzazione.
