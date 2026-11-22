import { useAppStore } from '../store';
import type { EffectScope } from '../types';
import { EFFECT_DEFS, getEffectDef, MAX_EFFECTS } from '../engine/effectDefs';
import { cx } from '../lib/utils';
import { Icon } from './Icons';
import { Slider, Toggle } from './Slider';

export function EffectRack({ scope }: { scope: EffectScope }) {
  const effects = useAppStore((state) =>
    scope.kind === 'master'
      ? state.masterEffects
      : state.decks[scope.deck].layers[scope.layerIndex].effects,
  );
  const openBrowser = useAppStore((state) => state.openEffectBrowser);
  const closeBrowser = useAppStore((state) => state.closeEffectBrowser);
  const toggleEffect = useAppStore((state) => state.toggleEffect);
  const removeEffect = useAppStore((state) => state.removeEffect);
  const updateEffect = useAppStore((state) => state.updateEffect);
  const addEffect = useAppStore((state) => state.addEffect);

  const addRandomEffect = () => {
    const available = EFFECT_DEFS.filter((def) => def.category !== 'Chiave');
    const unused = available.filter(
      (def) => !effects.some((effect) => effect.type === def.type),
    );
    const choices = unused.length ? unused : available;
    const picked = choices[Math.floor(Math.random() * choices.length)];
    if (picked) addEffect(scope, picked.type);
  };

  return (
    <div className="effect-rack">
      <div className="rack-head">
        <span className="eyebrow">Catena effetti</span>
        <div className="row-actions">
          <button
            className="btn small"
            onClick={addRandomEffect}
            disabled={effects.length >= MAX_EFFECTS}
            title="Aggiunge un effetto non ancora presente, esclusa la chiave colore"
          >
            Casuale
          </button>
          <button
            className="btn small"
            onClick={() => openBrowser(scope)}
            disabled={effects.length >= MAX_EFFECTS}
          >
            <Icon name="plus" size={14} />
            Scegli
          </button>
        </div>
      </div>

      {effects.length === 0 ? (
        <button
          className="empty-slot"
          onClick={() => {
            closeBrowser();
            openBrowser(scope);
          }}
        >
          <Icon name="sparkles" size={18} />
          <span>Nessun effetto. Aggiungine uno.</span>
        </button>
      ) : (
        <div className="effect-list">
          {effects.map((effect) => {
            const def = getEffectDef(effect.type);
            return (
              <div key={effect.id} className={cx('effect-item', !effect.enabled && 'is-off')}>
                <div className="effect-item-head">
                  <button
                    className="icon-btn tiny"
                    onClick={() => toggleEffect(scope, effect.id)}
                    title={effect.enabled ? 'Disattiva' : 'Attiva'}
                  >
                    <Icon name={effect.enabled ? 'eye' : 'eye-off'} size={15} />
                  </button>
                  <strong>{def.name}</strong>
                  <button
                    className="icon-btn tiny danger"
                    onClick={() => removeEffect(scope, effect.id)}
                    title="Rimuovi"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                <p className="effect-description">{def.description}</p>
                {def.tempoSync ? (
                  <Toggle
                    label="Sincronizza al BPM"
                    hint={
                      effect.beatSync
                        ? 'Segue il clock musicale: la velocità diventa cicli per battito.'
                        : 'La velocità è libera e non segue il BPM.'
                    }
                    checked={effect.beatSync}
                    onChange={(beatSync) => updateEffect(scope, effect.id, { beatSync })}
                  />
                ) : null}
                <Slider
                  compact
                  label="Mix"
                  value={effect.mix}
                  defaultValue={1}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(value) => `${Math.round(value * 100)}%`}
                  onChange={(value) => updateEffect(scope, effect.id, { mix: value })}
                />
                {def.params.length > 0 && (
                  <div className="param-grid">
                    {def.params.map((param) => (
                      <Slider
                        key={param.key}
                        compact
                        label={param.label}
                        value={effect.params[param.key] ?? param.default}
                        defaultValue={param.default}
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        unit={param.unit}
                        disabled={
                          effect.beatSync &&
                          (effect.type === 'strobe' || effect.type === 'bounce') &&
                          param.key === 'rate'
                        }
                        format={(value) =>
                          Math.abs(value) >= 10
                            ? value.toFixed(0)
                            : value.toFixed(param.step < 0.01 ? 3 : 2)
                        }
                        onChange={(value) =>
                          updateEffect(scope, effect.id, {
                            params: { [param.key]: value },
                          })
                        }
                      />
                    ))}
                  </div>
                )}
                <div className="react-grid">
                  <Slider
                    compact
                    label="Audio"
                    value={effect.audioReact}
                    defaultValue={0}
                    min={0}
                    max={1}
                    step={0.01}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onChange={(value) =>
                      updateEffect(scope, effect.id, { audioReact: value })
                    }
                  />
                  <Slider
                    compact
                    label="Beat"
                    value={effect.beatReact}
                    defaultValue={0}
                    min={0}
                    max={1}
                    step={0.01}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onChange={(value) =>
                      updateEffect(scope, effect.id, { beatReact: value })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {effects.length >= MAX_EFFECTS ? (
        <p className="hint">Limite di {MAX_EFFECTS} effetti raggiunto.</p>
      ) : null}

      {effects.length === 0 ? (
        <button
          className="link-btn"
          onClick={() =>
            addEffect(scope, scope.kind === 'master' ? 'strobe' : 'glow')
          }
        >
          Aggiungi un effetto suggerito
        </button>
      ) : null}
    </div>
  );
}
