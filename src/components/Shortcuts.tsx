import { useAppStore } from '../store';
import { Modal } from './Modal';
import { shortcutLabel, usePreferencesStore } from '../preferences';
import type { ShortcutAction } from '../preferences';

function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'Spazio';
  if (code === 'BracketLeft') return '[';
  if (code === 'BracketRight') return ']';
  return code;
}

const SHORTCUTS: Array<{ id: ShortcutAction; label: string }> = [
  { id: 'tapTempo', label: 'Tap tempo' },
  { id: 'bpmDown', label: 'BPM −1' },
  { id: 'bpmUp', label: 'BPM +1' },
  { id: 'bpmDown5', label: 'BPM −5' },
  { id: 'bpmUp5', label: 'BPM +5' },
  { id: 'blackout', label: 'Blackout on/off' },
  { id: 'takeA', label: 'Dissolvi verso Deck A' },
  { id: 'takeB', label: 'Dissolvi verso Deck B' },
  { id: 'clearLayer', label: 'Svuota il layer selezionato' },
  { id: 'shortcuts', label: 'Apri questo pannello' },
  { id: 'settings', label: 'Apri impostazioni' },
];

export function Shortcuts() {
  const open = useAppStore((state) => state.shortcutsOpen);
  const setOpen = useAppStore((state) => state.setShortcutsOpen);
  const scenes = useAppStore((state) => state.scenes);
  const shortcuts = usePreferencesStore((state) => state.shortcuts);

  return (
    <Modal
      open={open}
      title="Scorciatoie"
      subtitle="Controllo rapido durante il live"
      onClose={() => setOpen(false)}
    >
      <div className="shortcut-list">
        {SHORTCUTS.filter((entry) => shortcuts[entry.id]).map((entry) => (
          <div key={entry.label} className="shortcut-row">
            <span className="shortcut-keys">
              <kbd>{shortcutLabel(shortcuts[entry.id])}</kbd>
            </span>
            <span>{entry.label}</span>
          </div>
        ))}
        {scenes.filter((scene) => scene.shortcut).map((scene) => (
          <div key={scene.id} className="shortcut-row">
            <span className="shortcut-keys"><kbd>{[
              ...(scene.shortcutModifiers?.ctrl ? ['Ctrl'] : []),
              ...(scene.shortcutModifiers?.alt ? ['Alt'] : []),
              ...(scene.shortcutModifiers?.shift ? ['Maiusc'] : []),
              ...(scene.shortcutModifiers?.meta ? ['⌘'] : []),
              scene.shortcutLabel ?? keyLabel(scene.shortcut!),
            ].join('+')}</kbd></span>
            <span>Carica “{scene.name}” nel deck di preview · tocco 1 s, tieni premuto</span>
          </div>
        ))}
      </div>
      <p className="hint">
          Assegna i tasti alle scene dal pannello Scene. I tasti assegnati richiamano la scena nel
        deck selezionato; Esc chiude menu e finestre.
      </p>
    </Modal>
  );
}
