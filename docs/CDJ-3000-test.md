# Test connessione CDJ-3000 + mixer

Documento operativo per verificare se due CDJ-3000 e il mixer riescono a comunicare con il computer tramite Pro DJ Link.

Stato: test hardware, nessuna integrazione in StaffVJ. La schermata CDJ aggiunta in precedenza è stata rimossa.

## 1. Materiale

- 2 x Pioneer/AlphaTheta CDJ-3000
- 1 x mixer compatibile Pro DJ Link
- 1 x switch Ethernet Gigabit, almeno 4 porte
- Cavi Ethernet Cat5e o Cat6
- Mac con Ethernet nativa oppure adattatore USB-C/Ethernet
- 2 x chiavetta USB con tracce analizzate da rekordbox
- Facoltativo: Wireshark
- Facoltativo: Beat Link Trigger
- Facoltativo: Node.js 22 o successivo, per il test con `alphatheta-connect`

Il mixer del 2020, stesso periodo e stesso livello della CDJ-3000, è quasi certamente il **DJM-V10** oppure il **DJM-V10-LF**. Se invece è un **DJM-900NXS2**, il test resta valido perché anche quel mixer supporta Pro DJ Link. Il modello esatto va annotato durante il test.

Non serve Internet. Non servono driver Pioneer.

## 2. Topologia di rete

```text
CDJ-3000 #1  LINK ─┐
CDJ-3000 #2  LINK ─┼── Switch Ethernet Gigabit ── Mac
DJM-V10      LINK ─┘
```

Collegare preferibilmente:

- CDJ #1 al mixer o allo switch
- CDJ #2 al mixer o allo switch
- mixer allo switch
- Mac allo switch

Se il mixer ha un hub Ethernet integrato, si può usare quello, ma per il test è più chiaro usare uno switch esterno con tutte le porte libere.

Non usare Wi-Fi per Pro DJ Link. Il Mac può tenere il Wi-Fi attivo per Internet, ma la comunicazione con le CDJ deve passare dall'interfaccia Ethernet.

## 3. Indirizzi di rete

Tutti i dispositivi devono stare sulla stessa sottorete.

Due configurazioni possibili:

1. **Con router/DHCP**: CDJ, mixer e Mac prendono un indirizzo `192.168.x.x` dallo stesso router.
2. **Senza DHCP**: i dispositivi usano indirizzi link-local `169.254.x.x`. Anche il Mac deve avere un indirizzo `169.254.x.x` sull'interfaccia Ethernet.

Da evitare:

- Mac su Wi-Fi e CDJ su Ethernet con sottoreti diverse
- VLAN separate
- isolamento client / AP isolation
- firewall che blocca traffico UDP locale
- due applicazioni Pro DJ Link sullo stesso Mac

Se il Mac ha più interfacce, verificare quale interfaccia sta usando:

```bash
networksetup -listallhardwareports
ifconfig
```

## 4. Impostazioni CDJ e mixer

Su ogni CDJ-3000:

- abilitare Pro DJ Link / LINK
- impostare Player No. 1 e Player No. 2, oppure lasciare auto se non ci sono conflitti
- caricare una traccia analizzata da rekordbox
- verificare che la traccia abbia BPM e beat grid
- avviare la riproduzione

Sul mixer:

- collegare la porta LINK
- assegnare i canali alle due CDJ
- verificare che il mixer veda i player
- verificare il tempo master

Controllare che le CDJ mostrino il collegamento di rete e che il player number non sia duplicato.

## 5. Test A: verifica dei pacchetti

Prima di installare software, verificare che i pacchetti Pro DJ Link arrivino al Mac.

Individuare l'interfaccia Ethernet, ad esempio `en0` o `en1`, poi eseguire:

```bash
sudo tcpdump -i en0 -nn 'udp port 50000 or udp port 50001 or udp port 50002'
```

In alternativa, in Wireshark usare il filtro:

```text
udp.port == 50000 || udp.port == 50001 || udp.port == 50002
```

Durante il test:

- caricare una traccia
- avviare e fermare la riproduzione
- muovere il pitch
- premere MASTER su una CDJ
- attivare e disattivare SYNC

Ci si aspetta traffico UDP dalle CDJ e dal mixer. Se non arriva nulla, il problema è rete, interfaccia, switch, sottorete o firewall.

## 6. Test B: Beat Link Trigger

Beat Link Trigger è la via più rapida per verificare che le CDJ vengano viste e che il BPM sia leggibile.

Download:

https://github.com/Deep-Symmetry/beat-link-trigger/releases

Per Mac Apple Silicon usare il `.dmg` della versione 8.0.0 o successiva. Il `.dmg` contiene Java, quindi non serve installare Java separatamente. Se si usa il file `.jar`, serve Java 21 o successivo.

Procedura:

1. Chiudere rekordbox sul Mac.
2. Installare e avviare Beat Link Trigger.
3. Consentire l'accesso alla rete locale se macOS lo chiede.
4. Attendere il rilevamento dei player.
5. Aprire la finestra Player Status.
6. Verificare che compaiano le due CDJ-3000.
7. Controllare BPM, beat, traccia e stato play/pausa.
8. Muovere il pitch e verificare che il BPM effettivo cambi.
9. Premere MASTER su una CDJ e verificare il cambio di tempo master.

Se Beat Link Trigger vede le CDJ e mostra il BPM, hardware e rete funzionano. Beat Link Trigger può anche inviare OSC o MIDI, ma per questo test basta la finestra Player Status.

Note:

- Beat Link Trigger non deve convivere con rekordbox sulla stessa macchina, perché entrambi usano le porte Pro DJ Link.
- Se serve rekordbox, usare la modalità passiva con permessi di cattura, ma non è necessaria per il test iniziale.
- Il BPM mostrato è il BPM effettivo, cioè traccia più pitch.

## 7. Test C: alphatheta-connect

`alphatheta-connect` è la libreria TypeScript da usare in futuro dentro StaffVJ. Supporta CDJ-3000, legge i pacchetti di posizione assoluta ogni circa 30 ms e espone il BPM.

Repository:

https://github.com/chrisle/alphatheta-connect

Installazione in un progetto Node separato:

```bash
npm install alphatheta-connect
```

Script minimo di prova:

```js
import { bringOnline } from 'alphatheta-connect';

const network = await bringOnline();
await network.autoconfigFromPeers();
await network.connect();

network.positionEmitter?.on('position', (position) => {
  if (position.bpm != null) {
    console.log(
      `Player ${position.deviceId}: ${position.bpm.toFixed(2)} BPM, ` +
      `playhead ${position.playhead} ms`,
    );
  }
});
```

Eseguire lo script con Node 22 o successivo, senza rekordbox aperto e senza Beat Link Trigger attivo.

Se il test funziona, la stessa logica potrà essere spostata nel main process di Electron e collegata a un futuro interruttore “CDJ BPM”.

Per il VJ non basta il BPM: servono anche beat e fase. I pacchetti di posizione e i beat packet di Pro DJ Link permettono di ricavare entrambi.

## 8. Test D: PRO DJ LINK Bridge ufficiale

PRO DJ LINK Bridge è il software ufficiale AlphaTheta/Pioneer DJ. Supporta CDJ-3000 e DJM-V10, ma non è un'API generica: converte i dati Pro DJ Link in TCNet per prodotti certificati come Resolume, Avolites, ChamSys e ShowKontrol.

Link:

https://www.pioneerdj.com/en/product/software-interfaces/pro-dj-link-bridge/

Per StaffVJ non è la prima scelta, perché richiederebbe di implementare TCNet. È utile solo se si vuole usare un software certificato già esistente.

## 9. Risoluzione problemi

### Nessun dispositivo rilevato

- verificare di essere sull'interfaccia Ethernet corretta
- disattivare Wi-Fi per il test, oppure controllare l'ordine dei servizi di rete
- verificare che CDJ, mixer e Mac siano sulla stessa sottorete
- controllare VLAN, isolamento client e firewall
- chiudere rekordbox e altri software Pro DJ Link
- controllare i cavi e le porte LINK
- riavviare switch, CDJ e mixer

### Solo una CDJ rilevata

- player number duplicato
- cavo o porta dello switch difettosi
- CDJ non inclusa nel link
- mixer che assegna solo un canale

### BPM assente o a zero

- nessuna traccia caricata
- traccia non analizzata da rekordbox
- riproduzione ferma
- BPM non disponibile nella traccia
- player non è tempo master
- traccia in streaming senza analisi

### Errore di porta occupata

- chiudere rekordbox
- chiudere Beat Link Trigger prima di avviare `alphatheta-connect`
- chiudere altre applicazioni Pro DJ Link
- riavviare il Mac se una porta UDP resta occupata

### Il mixer non compare come player

Il mixer può non apparire come player nella lista, ma i suoi beat packet possono comunque essere presenti. Verificare il modello esatto e il collegamento LINK. Con DJM-V10 il mixer partecipa al link e può fornire il tempo master.

## 10. Dati da annotare

- modello esatto del mixer
- versione firmware delle due CDJ-3000
- versione firmware del mixer
- modello dello switch
- interfaccia e indirizzo IP del Mac
- versione di Beat Link Trigger
- numero di player assegnato alle CDJ
- presenza o assenza del mixer nel link
- screenshot di Beat Link Trigger con BPM e player
- eventuale cattura Wireshark

## 11. Esito e passi successivi

Se Beat Link Trigger rileva entrambe le CDJ e mostra il BPM:

- la rete e l'hardware sono compatibili
- il passo successivo sarà integrare `alphatheta-connect` in StaffVJ
- il futuro interruttore CDJ BPM potrà avviare e fermare il listener
- il BPM e la fase del beat verranno passati al transport

Se Beat Link Trigger non rileva nulla:

- non ha senso modificare StaffVJ in questo momento
- prima vanno risolti rete, switch, sottorete o conflitti di porte
- il test va ripetuto con una sola CDJ, poi con due, poi con il mixer
