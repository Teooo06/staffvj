import { useState } from 'react';
import { useAppStore } from '../store';
import {
  EFFECT_CATEGORIES,
  EFFECT_DEFS,
  MAX_EFFECTS,
} from '../engine/effectDefs';
import type { EffectCategory } from '../engine/effectDefs';
import type { EffectInstance } from '../types';
import { cx } from '../lib/utils';
import { Icon } from './Icons';
import { Modal } from './Modal';

const NO_EFFECTS: EffectInstance[] = [];

export function EffectBrowser() {
  const open = useAppStore((state) => state.effectBrowser.open);
  const scope = useAppStore((state) => state.effectBrowser.scope);
  const close = useAppStore((state) => state.closeEffectBrowser);
  const addEffect = useAppStore((state) => state.addEffect);
  const effects = useAppStore((state) =>
    scope?.kind === 'master'
      ? state.masterEffects
      : scope?.kind === 'layer'
        ? state.decks[scope.deck].layers[scope.layerIndex].effects
        : NO_EFFECTS,
  );
  const [category, setCategory] = useState<EffectCategory>('Distorsione');

  const defs = EFFECT_DEFS.filter((def) => def.category === category);

  return (
    <Modal
      open={open}
      title="Aggiungi effetto"
      subtitle={`${effects.length}/${MAX_EFFECTS} effetti in questa catena`}
      onClose={close}
      wide
    >
      <div className="browser-tabs">
        {EFFECT_CATEGORIES.map((entry) => (
          <button
            key={entry}
            className={cx('chip', category === entry && 'is-active')}
            onClick={() => setCategory(entry)}
          >
            {entry}
          </button>
        ))}
      </div>
      <div className="effect-grid">
        {defs.map((def) => (
          <button
            key={def.type}
            className="effect-card"
            disabled={!scope || effects.length >= MAX_EFFECTS}
            onClick={() => {
              if (!scope) return;
              addEffect(scope, def.type);
              close();
            }}
          >
            <span className="effect-card-icon">
              <Icon name="sparkles" size={20} />
            </span>
            <span className="effect-card-copy">
              <strong>{def.name}</strong>
              <small>{def.description}</small>
            </span>
            <span className="effect-card-meta">
              {def.params.length ? `${def.params.length} parametri` : 'on/off'}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
