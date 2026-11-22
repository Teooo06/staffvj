import { useAppStore } from '../store';
import type { DeckId, Layer, MediaItem } from '../types';
import { DECK_LAYER_COUNT } from '../types';
import { cx } from '../lib/utils';
import { Icon } from './Icons';

function sourceLabel(layer: Layer, library: MediaItem[]): string {
  const source = layer.source;
  if (!source) return 'Vuoto';
  if (source.kind === 'capture') return source.label || 'Ingresso live';
  if (source.kind === 'ndi') return source.sourceName || 'Ingresso NDI';
  const item = library.find((entry) => entry.id === source.mediaId);
  return item?.name ?? 'Media mancante';
}

export function DecksBar() {
  const decks = useAppStore((state) => state.decks);
  const library = useAppStore((state) => state.library);
  const target = useAppStore((state) => state.target);
  const monitor = useAppStore((state) => state.monitor);
  const monitorLayout = useAppStore((state) => state.monitorLayout);
  const crossfade = useAppStore((state) => state.crossfade);
  const setTarget = useAppStore((state) => state.setTarget);
  const selectDeck = useAppStore((state) => state.selectDeck);
  const toggleLayerVisible = useAppStore((state) => state.toggleLayerVisible);
  const clearLayer = useAppStore((state) => state.clearLayer);

  return (
    <section className="decks-bar">
      {(['A', 'B'] as DeckId[]).map((deckId) => {
        const deck = decks[deckId];
        const active = target.deck === deckId;
        const inMix =
          deckId === 'A' ? crossfade < 0.999 : crossfade > 0.001;
        const onAir = deckId === 'A' ? crossfade <= 0.02 : crossfade >= 0.98;
        return (
          <div
            key={deckId}
            className={cx(
              'deck-column',
              active && 'is-active',
              monitor === deckId && 'is-monitored',
              monitorLayout === 'studio' && target.deck === deckId && 'is-preview-deck',
              onAir && 'is-live-deck',
            )}
          >
            <button
              className="deck-head"
              onClick={() => selectDeck(deckId)}
              title={`Seleziona Deck ${deckId}`}
            >
              <span className="deck-letter">{deckId}</span>
              <span className="deck-title">
                <strong>Deck {deckId}</strong>
                <small>
                  {monitorLayout === 'studio' && target.deck === deckId
                    ? 'Preview'
                    : onAir
                      ? 'In uscita'
                      : inMix
                        ? 'In mix'
                        : 'Fuori mix'}
                  {monitorLayout === 'single' && monitor === deckId ? ' · Monitor' : ''}
                </small>
              </span>
              <span className={cx('deck-led', inMix && 'is-on')} />
            </button>

            <div className="layer-list">
              {Array.from({ length: DECK_LAYER_COUNT }, (_value, index) => index).map(
                (index) => {
                  const layer = deck.layers[index];
                  const isTarget = active && target.layerIndex === index;
                  return (
                    <div
                      key={layer.id}
                      role="button"
                      tabIndex={0}
                      className={cx(
                        'layer-row',
                        isTarget && 'is-target',
                        !layer.visible && 'is-hidden',
                        !layer.source && 'is-empty',
                      )}
                      onClick={() => setTarget(deckId, index)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setTarget(deckId, index);
                        }
                      }}
                    >
                      <span className="layer-index">L{index + 1}</span>
                      <span className="layer-copy">
                        <strong>{sourceLabel(layer, library)}</strong>
                        <small>
                          {Math.round(layer.opacity * 100)}%
                          {layer.effects.length
                            ? ` · ${layer.effects.length} fx`
                            : ''}
                        </small>
                      </span>
                      <span className="layer-fx">
                        {layer.effects.length ? (
                          <Icon name="sparkles" size={12} />
                        ) : null}
                      </span>
                      <button
                        className="icon-btn tiny layer-action"
                        title={layer.visible ? 'Nascondi layer' : 'Mostra layer'}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleLayerVisible(deckId, index);
                        }}
                      >
                        <Icon name={layer.visible ? 'eye' : 'eye-off'} size={13} />
                      </button>
                      <button
                        className="icon-btn tiny layer-action"
                        title="Svuota layer"
                        disabled={!layer.source}
                        onClick={(event) => {
                          event.stopPropagation();
                          clearLayer(deckId, index);
                        }}
                      >
                        <Icon name="close" size={13} />
                      </button>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
