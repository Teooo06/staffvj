import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAppStore } from '../store';
import { shortcutLabel, usePreferencesStore } from '../preferences';
import type { ShortcutAction } from '../preferences';
import { cx } from '../lib/utils';

interface KeyDef {
  code: string;
  label: string;
  sub?: string;
  units?: number;
  blank?: boolean;
}

interface KeyAssignment {
  code: string;
  ctrl: boolean;
  kind: 'global' | 'scene';
  name: string;
  short: string;
  combo: string;
}

const ACTION_LABELS: Record<ShortcutAction, { name: string; short: string }> = {
  tapTempo: { name: 'Tap tempo', short: 'TAP' },
  bpmDown: { name: 'BPM −1', short: 'B−' },
  bpmUp: { name: 'BPM +1', short: 'B+' },
  bpmDown5: { name: 'BPM −5', short: 'B−5' },
  bpmUp5: { name: 'BPM +5', short: 'B+5' },
  blackout: { name: 'Blackout', short: 'BLK' },
  takeA: { name: 'Dissolvi verso Deck A', short: 'A' },
  takeB: { name: 'Dissolvi verso Deck B', short: 'B' },
  clearLayer: { name: 'Svuota layer', short: 'SVUOTA' },
  shortcuts: { name: 'Apri scorciatoie', short: 'F1' },
  settings: { name: 'Apri impostazioni', short: 'F2' },
  switchDeck: { name: 'Cambia deck', short: 'DECK' },
  cutDeckLive: { name: 'Taglio netto', short: 'CUT' },
};

function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const aliases: Record<string, string> = {
    Backquote: '\\',
    Minus: "'",
    Equal: 'ì',
    BracketLeft: 'è',
    BracketRight: '+',
    Backslash: 'ù',
    Semicolon: 'ò',
    Quote: 'à',
    Comma: ',',
    Period: '.',
    Slash: '-',
    IntlBackslash: '<',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: '',
    Enter: 'return',
    Backspace: '⌫',
    CapsLock: 'caps lock',
    ShiftLeft: '⇧',
    ShiftRight: '⇧',
    ControlLeft: 'ctrl',
    ControlRight: 'ctrl',
    AltLeft: 'option',
    AltRight: 'option',
    MetaLeft: '⌘',
    MetaRight: '⌘',
    Escape: 'esc',
  };
  return aliases[code] ?? code;
}

const ROWS: KeyDef[][] = [
  [
    { code: 'Escape', label: 'esc', units: 1.2 },
    { code: 'F1', label: 'F1' },
    { code: 'F2', label: 'F2' },
    { code: 'F3', label: 'F3' },
    { code: 'F4', label: 'F4' },
    { code: 'F5', label: 'F5' },
    { code: 'F6', label: 'F6' },
    { code: 'F7', label: 'F7' },
    { code: 'F8', label: 'F8' },
    { code: 'F9', label: 'F9' },
    { code: 'F10', label: 'F10' },
    { code: 'F11', label: 'F11' },
    { code: 'F12', label: 'F12' },
    { code: '__power', label: 'touch id', units: 1.35, blank: true },
  ],
  [
    { code: 'Backquote', label: '\\' },
    { code: 'Digit1', label: '1', sub: '!' },
    { code: 'Digit2', label: '2', sub: '"' },
    { code: 'Digit3', label: '3', sub: '£' },
    { code: 'Digit4', label: '4', sub: '$' },
    { code: 'Digit5', label: '5', sub: '%' },
    { code: 'Digit6', label: '6', sub: '&' },
    { code: 'Digit7', label: '7', sub: '/' },
    { code: 'Digit8', label: '8', sub: '(' },
    { code: 'Digit9', label: '9', sub: ')' },
    { code: 'Digit0', label: '0', sub: '=' },
    { code: 'Minus', label: "'", sub: '?' },
    { code: 'Equal', label: 'ì', sub: '^' },
    { code: 'Backspace', label: '⌫', units: 1.55 },
  ],
  [
    { code: 'Tab', label: 'tab', units: 1.5 },
    { code: 'KeyQ', label: 'Q' },
    { code: 'KeyW', label: 'W' },
    { code: 'KeyE', label: 'E' },
    { code: 'KeyR', label: 'R' },
    { code: 'KeyT', label: 'T' },
    { code: 'KeyY', label: 'Y' },
    { code: 'KeyU', label: 'U' },
    { code: 'KeyI', label: 'I' },
    { code: 'KeyO', label: 'O' },
    { code: 'KeyP', label: 'P' },
    { code: 'BracketLeft', label: 'è', sub: 'é' },
    { code: 'BracketRight', label: '+', sub: '*' },
    { code: 'Enter', label: 'return', units: 1.65 },
  ],
  [
    { code: 'CapsLock', label: 'caps lock', units: 1.8 },
    { code: 'KeyA', label: 'A' },
    { code: 'KeyS', label: 'S' },
    { code: 'KeyD', label: 'D' },
    { code: 'KeyF', label: 'F' },
    { code: 'KeyG', label: 'G' },
    { code: 'KeyH', label: 'H' },
    { code: 'KeyJ', label: 'J' },
    { code: 'KeyK', label: 'K' },
    { code: 'KeyL', label: 'L' },
    { code: 'Semicolon', label: 'ò', sub: 'ç' },
    { code: 'Quote', label: 'à', sub: '°' },
    { code: 'Backslash', label: 'ù', sub: '§' },
  ],
  [
    { code: 'IntlBackslash', label: '<', sub: '>' },
    { code: 'ShiftLeft', label: '⇧', units: 2.15 },
    { code: 'KeyZ', label: 'Z' },
    { code: 'KeyX', label: 'X' },
    { code: 'KeyC', label: 'C' },
    { code: 'KeyV', label: 'V' },
    { code: 'KeyB', label: 'B' },
    { code: 'KeyN', label: 'N' },
    { code: 'KeyM', label: 'M' },
    { code: 'Comma', label: ',', sub: ';' },
    { code: 'Period', label: '.', sub: ':' },
    { code: 'Slash', label: '-', sub: '_' },
    { code: 'ShiftRight', label: '⇧', units: 2.15 },
  ],
  [
    { code: '__fn', label: 'fn', units: 0.9, blank: true },
    { code: 'ControlLeft', label: 'ctrl', units: 1.15 },
    { code: 'AltLeft', label: 'option', units: 1.25 },
    { code: 'MetaLeft', label: '⌘', units: 1.2 },
    { code: 'Space', label: 'spazio', units: 5.2 },
    { code: 'MetaRight', label: '⌘', units: 1.2 },
    { code: 'AltRight', label: 'option', units: 1.25 },
    { code: 'ArrowLeft', label: '←', units: 0.9 },
    { code: 'ArrowUp', label: '↑', units: 0.9 },
    { code: 'ArrowDown', label: '↓', units: 0.9 },
    { code: 'ArrowRight', label: '→', units: 0.9 },
  ],
];

export function KeyboardMap() {
  const scenes = useAppStore((state) => state.scenes);
  const shortcuts = usePreferencesStore((state) => state.shortcuts);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [ctrlPinned, setCtrlPinned] = useState(false);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'ControlLeft' || event.code === 'ControlRight') setCtrlHeld(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'ControlLeft' || event.code === 'ControlRight') setCtrlHeld(false);
    };
    const blur = () => setCtrlHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const assignments = useMemo(() => {
    const result = new Map<string, KeyAssignment[]>();
    const push = (assignment: KeyAssignment) => {
      const list = result.get(assignment.code) ?? [];
      list.push(assignment);
      result.set(assignment.code, list);
    };

    for (const [action, binding] of Object.entries(shortcuts) as Array<
      [ShortcutAction, (typeof shortcuts)[ShortcutAction]]
    >) {
      if (!binding) continue;
      push({
        code: binding.code,
        ctrl: binding.ctrl,
        kind: 'global',
        name: ACTION_LABELS[action].name,
        short: ACTION_LABELS[action].short,
        combo: shortcutLabel(binding),
      });
    }

    scenes.forEach((scene, index) => {
      if (!scene.shortcut) return;
      const modifiers = scene.shortcutModifiers;
      push({
        code: scene.shortcut,
        ctrl: Boolean(modifiers?.ctrl),
        kind: 'scene',
        name: `Scena “${scene.name}”`,
        short: `S${index + 1}`,
        combo: [
          ...(modifiers?.ctrl ? ['Ctrl'] : []),
          ...(modifiers?.alt ? ['Alt'] : []),
          ...(modifiers?.shift ? ['Maiusc'] : []),
          ...(modifiers?.meta ? ['⌘'] : []),
          scene.shortcutLabel ?? keyLabel(scene.shortcut),
        ].join('+'),
      });
    });

    return result;
  }, [scenes, shortcuts]);

  const showCtrlLayer = ctrlHeld || ctrlPinned;
  const visibleAssignments = useMemo(() => {
    const result = new Map<string, KeyAssignment[]>();
    assignments.forEach((list, code) => {
      const visible = list.filter((entry) => entry.ctrl === showCtrlLayer);
      if (visible.length) result.set(code, visible);
    });
    return result;
  }, [assignments, showCtrlLayer]);

  const layerAssignments = useMemo(
    () =>
      Array.from(visibleAssignments.values())
        .flat()
        .sort((a, b) => keyLabel(a.code).localeCompare(keyLabel(b.code))),
    [visibleAssignments],
  );

  return (
    <div className={cx('keyboard-panel', showCtrlLayer && 'is-ctrl-layer')}>
      <div className="keyboard-toolbar">
        <div>
          <span className="eyebrow">Tastiera italiana</span>
          <strong>MacBook Air · layout senza tastierino</strong>
        </div>
        <button
          className={cx('keyboard-layer-btn', showCtrlLayer && 'is-active')}
          onClick={() => setCtrlPinned((value) => !value)}
          aria-pressed={showCtrlLayer}
          title="Tieni premuto Ctrl oppure blocca il layer alternativo"
        >
          <kbd>Ctrl</kbd>
          {showCtrlLayer ? 'Layer Ctrl' : 'Layer base'}
        </button>
      </div>

      <div className="keyboard-shell">
        <div className="keyboard">
          {ROWS.map((row, rowIndex) => (
            <div className="keyboard-row" key={rowIndex}>
              {row.map((key) => {
                const list = visibleAssignments.get(key.code) ?? [];
                const kinds = new Set(list.map((entry) => entry.kind));
                const assignmentsText = list.map((entry) => `${entry.combo} · ${entry.name}`).join('\n');
                return (
                  <div
                    key={key.code}
                    className={cx(
                      'keycap',
                      key.blank && 'is-blank',
                      list.length > 0 && 'is-assigned',
                      list.length > 0 && 'is-locked',
                      kinds.has('global') && 'is-global',
                      kinds.has('scene') && 'is-scene',
                      !list.length && 'is-free',
                      showCtrlLayer && 'is-ctrl',
                      key.code === 'ControlLeft' && ctrlHeld && 'is-held',
                    )}
                    style={{ '--key-units': key.units ?? 1 } as CSSProperties}
                    title={assignmentsText || `${keyLabel(key.code)} · libero`}
                  >
                    <span className="keycap-main">{key.label || keyLabel(key.code)}</span>
                    {key.sub ? <span className="keycap-sub">{key.sub}</span> : null}
                    {list.length ? (
                      <span className="keycap-badges">
                        {list.slice(0, 2).map((entry, index) => (
                          <span key={`${entry.kind}-${entry.name}-${index}`} className="keycap-badge">
                            {entry.short}
                          </span>
                        ))}
                        {list.length > 2 ? <span className="keycap-more">+{list.length - 2}</span> : null}
                      </span>
                    ) : (
                      <span className="keycap-free">libero</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="keyboard-legend">
        <span><i className="legend-dot global" /> Comando globale</span>
        <span><i className="legend-dot scene" /> Scena</span>
        <span><i className="legend-dot locked" /> Assegnato e bloccato</span>
        <span><i className="legend-dot free" /> Libero</span>
      </div>

      <div className="keyboard-assignments">
        <span className="eyebrow">
          {showCtrlLayer ? 'Assegnazioni Ctrl' : 'Assegnazioni base'}
          {ctrlHeld ? ' · Ctrl premuto' : ''}
        </span>
        {layerAssignments.length ? (
          <div className="keyboard-assignment-list">
            {layerAssignments.map((entry, index) => (
              <span key={`${entry.code}-${entry.name}-${index}`} className={cx('keyboard-assignment', entry.kind)}>
                <kbd>{entry.combo}</kbd>
                {entry.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="hint">Nessuna assegnazione su questo layer: tutti i tasti sono liberi.</p>
        )}
      </div>
    </div>
  );
}
