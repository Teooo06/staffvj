import { useEffect, useMemo, useState } from 'react';
import type { DeckId, Scene } from '../types';
import { useAppStore } from '../store';
import { usePreferencesStore, type ShortcutAction } from '../preferences';
import { Icon } from './Icons';
import { cx } from '../lib/utils';

const MODIFIER_CODES = new Set([
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
  'ShiftRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
]);

const GLOBAL_LABELS: Record<ShortcutAction, string> = {
  tapTempo: 'Tap tempo',
  bpmDown: 'BPM −1',
  bpmUp: 'BPM +1',
  bpmDown5: 'BPM −5',
  bpmUp5: 'BPM +5',
  blackout: 'Blackout',
  takeA: 'Deck A',
  takeB: 'Deck B',
  clearLayer: 'Svuota layer',
  shortcuts: 'Scorciatoie',
  settings: 'Impostazioni',
  switchDeck: 'Cambia deck',
  cutDeckLive: 'Taglio netto',
};

function shortcutModifiersEqual(left: unknown, right: unknown): boolean {
  const a = left ?? {};
  const b = right ?? {};
  return (
    (a as Record<string, unknown>).ctrl === (b as Record<string, unknown>).ctrl &&
    (a as Record<string, unknown>).alt === (b as Record<string, unknown>).alt &&
    (a as Record<string, unknown>).shift === (b as Record<string, unknown>).shift &&
    (a as Record<string, unknown>).meta === (b as Record<string, unknown>).meta
  );
}

function isBindingUsed(
  scenes: Scene[],
  currentId: string,
  code: string,
  modifiers: { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean },
  shortcuts: Record<ShortcutAction, { code: string; label: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean } | null>,
): { scene?: Scene; global?: ShortcutAction } | null {
  const targetModifiers = modifiers;
  const scene = scenes.find(
    (entry) =>
      entry.id !== currentId &&
      entry.shortcut === code &&
      shortcutModifiersEqual(entry.shortcutModifiers, targetModifiers),
  );
  if (scene) return { scene };
  for (const [action, binding] of Object.entries(shortcuts) as Array<
    [ShortcutAction, { code: string; label: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean } | null]
  >) {
    if (binding && binding.code === code && shortcutModifiersEqual(binding, targetModifiers)) {
      return { global: action };
    }
  }
  return null;
}

function shortcutText(scene: Scene): string {
  if (!scene.shortcut) return '—';
  return [
    ...(scene.shortcutModifiers?.ctrl ? ['Ctrl'] : []),
    ...(scene.shortcutModifiers?.alt ? ['Alt'] : []),
    ...(scene.shortcutModifiers?.shift ? ['Maiusc'] : []),
    ...(scene.shortcutModifiers?.meta ? ['⌘'] : []),
    scene.shortcutLabel ?? keyLabel(scene.shortcut),
  ].join('+');
}

function keyLabel(code: string | null): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const aliases: Record<string, string> = {
    Space: 'Spazio',
    Backquote: '`',
    Minus: '−',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backspace: 'Canc',
    Delete: 'Del',
  };
  return aliases[code] ?? code;
}

function captureSceneThumbnail(deck: DeckId): string | undefined {
  const state = useAppStore.getState();
  const selector =
    state.monitorLayout === 'studio'
      ? '.stage-screen-aux .stage-canvas'
      : state.monitorLayout === 'decks'
        ? deck === 'A'
          ? '.stage-screen-primary .stage-canvas'
          : '.stage-screen-aux .stage-canvas'
        : state.monitor === deck
          ? '.stage-screen-primary .stage-canvas'
          : null;
  if (!selector) return undefined;
  const source = document.querySelector<HTMLCanvasElement>(selector);
  if (!source?.width || !source.height) return undefined;
  const thumbnail = document.createElement('canvas');
  thumbnail.width = 240;
  thumbnail.height = 135;
  const context = thumbnail.getContext('2d');
  if (!context) return undefined;
  try {
    context.drawImage(source, 0, 0, thumbnail.width, thumbnail.height);
    return thumbnail.toDataURL('image/jpeg', 0.62);
  } catch (_error) {
    return undefined;
  }
}

function SceneCard({ scene }: { scene: Scene }) {
  const targetDeck = useAppStore((state) => state.target.deck);
  const scenes = useAppStore((state) => state.scenes);
  const activeMomentaryScene = useAppStore((state) => state.momentaryScene?.sceneId ?? null);
  const loadScene = useAppStore((state) => state.loadScene);
  const takeDeckLive = useAppStore((state) => state.takeDeckLive);
  const renameScene = useAppStore((state) => state.renameScene);
  const removeScene = useAppStore((state) => state.removeScene);
  const setSceneShortcut = useAppStore((state) => state.setSceneShortcut);
  const toast = useAppStore((state) => state.toast);
  const shortcuts = usePreferencesStore((state) => state.shortcuts);
  const [listening, setListening] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const usedShortcuts = useMemo(() => {
    const base: string[] = [];
    const control: string[] = [];
    for (const entry of scenes) {
      if (!entry.shortcut || entry.id === scene.id) continue;
      const label = shortcutText(entry);
      if (entry.shortcutModifiers?.ctrl) {
        control.push(label);
      } else {
        base.push(label);
      }
    }
    return { base, control };
  }, [scene.id, scenes]);

  useEffect(() => {
    if (!listening) return;
    const capture = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === 'Escape') {
        setListening(false);
        return;
      }
      if (event.code === 'Backspace' || event.code === 'Delete') {
        setSceneShortcut(scene.id, null);
        setListening(false);
        return;
      }
      if (!event.code || event.code === 'Unidentified' || MODIFIER_CODES.has(event.code)) {
        return;
      }
      const targetModifiers = {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      };
      const collision = isBindingUsed(scenes, scene.id, event.code, targetModifiers, shortcuts);
      if (collision) {
        const already =
          collision.scene !== undefined
            ? `la scena “${collision.scene.name}”`
            : collision.global !== undefined
              ? GLOBAL_LABELS[collision.global]
              : 'un comando';
        toast(`Tasto già assegnato e bloccato (${already})`, 'error');
        return;
      }
      const label = event.key === ' ' ? 'Spazio' : event.key.length === 1 ? event.key.toLocaleUpperCase() : event.key;
      setSceneShortcut(scene.id, event.code, label, targetModifiers);
      setListening(false);
    };
    window.addEventListener('keydown', capture, true);
    return () => window.removeEventListener('keydown', capture, true);
  }, [listening, scene.id, scenes, setSceneShortcut, shortcuts, toast]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', keydown);
    };
  }, [menu]);

  const loadToPreview = () => loadScene(scene.id, { deck: targetDeck });
  const showContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY });
  };

  return (
    <article
      className={cx('scene-card', activeMomentaryScene === scene.id && 'is-momentary')}
      onContextMenu={showContextMenu}
    >
      <button className="scene-thumb" onClick={loadToPreview} title={`Carica ${scene.name} nel Deck ${targetDeck}`}>
        {scene.thumbnail ? (
          <img src={scene.thumbnail} alt={`Anteprima di ${scene.name}`} loading="lazy" />
        ) : (
          <span className="scene-thumb-placeholder"><Icon name="layers" size={19} /></span>
        )}
        <span className="scene-thumb-count">{scene.deck.layers.filter((layer) => layer.source).length} LAYERS</span>
      </button>
      <div className="scene-card-head">
        <input
          className="scene-name"
          aria-label="Nome scena"
          value={scene.name}
          onChange={(event) => renameScene(scene.id, event.target.value)}
          onContextMenu={showContextMenu}
        />
        <button
          className="icon-btn tiny"
          title="Elimina scena"
          onClick={() => removeScene(scene.id)}
        >
          <Icon name="trash" size={13} />
        </button>
      </div>
      <div className="scene-card-meta">
        <span>{scene.media.length} media</span>
        <span>{scene.deck.layers.filter((layer) => layer.source?.kind === 'capture').length} camere</span>
        <span>{scene.deck.layers.filter((layer) => layer.source?.kind === 'ndi').length} NDI</span>
      </div>
      <div className="scene-card-actions">
        <button className="btn small primary" onClick={loadToPreview}>
          Carica su {targetDeck}
        </button>
        <button
          className={cx('scene-key', listening && 'is-listening')}
          onClick={() => setListening((value) => !value)}
          title={listening ? 'Premi un tasto; tieni Ctrl per il secondo livello; Esc annulla, Canc rimuove' : 'Assegna un tasto rapido'}
        >
          <kbd>{listening ? '…' : shortcutText(scene)}</kbd>
        </button>
      </div>
      {listening ? (
        <div className="scene-key-map">
          <div className="scene-key-map-head">
            <strong>Tasti usati</strong>
            <span>Ctrl = secondo livello</span>
          </div>
          <div className="scene-key-map-row">
            <span>Base</span>
            {usedShortcuts.base.length ? (
              usedShortcuts.base.map((label, index) => <kbd key={`${label}-${index}`}>{label}</kbd>)
            ) : (
              <em>liberi</em>
            )}
          </div>
          <div className="scene-key-map-row">
            <span>Ctrl</span>
            {usedShortcuts.control.length ? (
              usedShortcuts.control.map((label, index) => <kbd key={`${label}-${index}`}>{label}</kbd>)
            ) : (
              <em>liberi</em>
            )}
          </div>
        </div>
      ) : null}
      {menu ? (
        <div
          className="scene-context-menu"
          style={{ left: Math.min(menu.x, window.innerWidth - 190), top: Math.min(menu.y, window.innerHeight - 150) }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button onClick={() => { loadToPreview(); setMenu(null); }}>Carica nel Deck {targetDeck}</button>
          <button onClick={() => { loadScene(scene.id, { deck: targetDeck }); takeDeckLive(targetDeck, 650); setMenu(null); }}>Carica e manda live</button>
          <button onClick={() => { setListening(true); setMenu(null); }}>Assegna tasto rapido…</button>
        </div>
      ) : null}
    </article>
  );
}

export function SceneShelf() {
  const scenes = useAppStore((state) => state.scenes);
  const target = useAppStore((state) => state.target);
  const momentary = useAppStore((state) => state.momentaryScene);
  const addScene = useAppStore((state) => state.addScene);
  const selectDeck = useAppStore((state) => state.selectDeck);
  const setMonitor = useAppStore((state) => state.setMonitor);
  const takeDeckLive = useAppStore((state) => state.takeDeckLive);
  const endMomentaryScene = useAppStore((state) => state.endMomentaryScene);
  const latchMomentaryScene = useAppStore((state) => state.latchMomentaryScene);
  const momentaryName = momentary
    ? scenes.find((scene) => scene.id === momentary.sceneId)?.name ?? 'Scena'
    : null;

  const chooseDeck = (deck: DeckId) => {
    selectDeck(deck);
    setMonitor(deck);
  };

  const saveScene = () => {
    window.requestAnimationFrame(() => addScene(captureSceneThumbnail(target.deck)));
  };

  return (
    <div className="scene-shelf">
      <div className="scene-preview-select">
        <div>
          <span className="eyebrow">Deck di preview</span>
          <strong>Le scene caricano solo qui</strong>
        </div>
        <div className="scene-deck-switch">
          {(['A', 'B'] as DeckId[]).map((deck) => (
            <button
              key={deck}
              className={cx('monitor-btn', target.deck === deck && 'is-active')}
              onClick={() => chooseDeck(deck)}
            >
              {deck}
            </button>
          ))}
        </div>
      </div>

      <button className="btn primary wide" onClick={saveScene} disabled={scenes.length >= 64}>
        <Icon name="plus" size={15} />
        Salva scena dal Deck {target.deck}
      </button>

      <button className="btn wide" onClick={() => takeDeckLive(target.deck, 650)}>
        Prendi Deck {target.deck} live
      </button>

      {momentary && momentaryName ? (
        <div className="scene-momentary-banner" role="status">
          <div>
            <span className="eyebrow">Scena momentanea</span>
            <strong>{momentaryName}</strong>
            <span className="hint">Rilascia il tasto per tornare alla preview precedente.</span>
          </div>
          <div className="scene-momentary-actions">
            <button
              className="btn small primary"
              onClick={() => latchMomentaryScene(momentary.sceneId)}
              title="Mantieni questa scena attiva nel deck"
            >
              Blocca <span>Enter</span>
            </button>
            <button
              className="btn small"
              onClick={() => endMomentaryScene(momentary.sceneId)}
              title="Torna subito alla preview precedente"
            >
              Rilascia
            </button>
          </div>
        </div>
      ) : null}

      <p className="hint">
        Clicca una miniatura per caricarla in preview. Tasto destro per le azioni rapide. Le scene
        includono i layer e le sorgenti; crossfader e master restano globali. Con i tasti rapidi:
        tocco = 1 secondo, tieni premuto = resta, Enter = blocca la scena, Esc o Shift/Ctrl/Tab =
        annulla e ripristina la preview.
      </p>

      {scenes.length ? (
        <div className="scene-list">
          {scenes.map((scene: Scene) => <SceneCard key={scene.id} scene={scene} />)}
        </div>
      ) : (
        <div className="scene-empty">
          <strong>Nessuna scena salvata</strong>
          <span>Prepara il Deck A o B e salvalo come richiamo rapido.</span>
        </div>
      )}
    </div>
  );
}
