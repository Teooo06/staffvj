import type { TransportData } from '../types';

export function AudioRhythmMonitor({ transport }: { transport: TransportData }) {
  const running = transport.audioConnected && transport.audioRunning;
  const estimateLabel = transport.estimatedBpm > 0
    ? `Stima ${Math.round(transport.estimatedBpm)} BPM · confidenza ${Math.round(transport.beatConfidence * 100)}%`
    : 'In attesa di 4 attacchi regolari';

  return (
    <section className="audio-rhythm-monitor" aria-label="Rilevamento BPM e battute">
      <div className="audio-rhythm-head">
        <span>Attacchi audio · ultimi 5 s</span>
        <small className={running ? 'is-running' : ''}>
          {running ? 'ANALISI ATTIVA' : transport.audioConnected ? 'AUDIO SOSPESO' : 'IN ATTESA'}
        </small>
      </div>
      <div className="audio-rhythm-graph" role="img" aria-label="Grafico degli attacchi audio recenti">
        {transport.onsetGraph.map((value, index) => (
          <span
            key={index}
            className={transport.onsetMarkers[index] ? 'is-onset' : ''}
            style={{ height: `${Math.max(3, Math.round(value * 100))}%` }}
            title={transport.onsetMarkers[index] ? 'Attacco rilevato' : undefined}
          />
        ))}
      </div>
      <div className="audio-rhythm-stats">
        <div className="audio-rhythm-beat">
          <strong>{Math.round(transport.bpm)} <small>BPM</small></strong>
          <span>BATTUTA {String(transport.barNumber).padStart(2, '0')} · {transport.beatInBar}/4</span>
        </div>
        <span
          className="audio-rhythm-estimate"
          title="La confidenza non è la soglia attacchi: indica quanto la stima del BPM è coerente."
        >
          {estimateLabel}
        </span>
      </div>
      <div className="audio-rhythm-count" aria-hidden="true">
        {[1, 2, 3, 4].map((beat) => (
          <span
            key={beat}
            className={beat === transport.beatInBar ? 'is-current' : ''}
            style={{ opacity: beat === transport.beatInBar ? 0.45 + transport.beatPulse * 0.55 : 0.4 }}
          />
        ))}
      </div>
    </section>
  );
}
