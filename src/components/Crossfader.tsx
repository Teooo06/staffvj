import { useAppStore } from '../store';
import { Icon } from './Icons';

export function Crossfader() {
  const crossfade = useAppStore((state) => state.crossfade);
  const setCrossfade = useAppStore((state) => state.setCrossfade);
  const animateCrossfade = useAppStore((state) => state.animateCrossfade);

  return (
    <section className="crossfader-card">
      <div className="xf-head">
        <span className="eyebrow">
          <Icon name="mix" size={13} /> Crossfader
        </span>
        <span className="xf-value">
          {crossfade < 0.001 ? 'A' : crossfade > 0.999 ? 'B' : `${Math.round(crossfade * 100)}%`}
        </span>
      </div>
      <div className="xf-body">
        <button
          className="xf-side"
          onClick={() => animateCrossfade(0, 900)}
          title="Dissolvi verso Deck A"
        >
          A
        </button>
        <div className="xf-track-wrap">
          <span className="xf-track-side xf-a" />
          <span className="xf-track-side xf-b" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={crossfade}
            onChange={(event) => setCrossfade(Number(event.target.value))}
            onDoubleClick={() => setCrossfade(0)}
            aria-label="Crossfader A/B"
            title="Doppio clic per tornare al Deck A"
          />
        </div>
        <button
          className="xf-side"
          onClick={() => animateCrossfade(1, 900)}
          title="Dissolvi verso Deck B"
        >
          B
        </button>
        <button
          className="btn small xf-auto"
          onClick={() => animateCrossfade(crossfade < 0.5 ? 1 : 0, 900)}
          title="Dissolvenza automatica"
        >
          <Icon name="beam" size={14} />
          Auto
        </button>
      </div>
    </section>
  );
}
