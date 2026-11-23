import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { matchesShortcut, usePreferencesStore } from '../preferences';

const MOMENTARY_SCENE_MS = 1000;
const MOMENTARY_STOP_CODES = new Set([
  'Tab',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
]);

interface MomentaryKeyState {
  sceneId: string;
  code: string;
  timer: number | null;
  released: boolean;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest('[contenteditable="true"]')) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['range', 'checkbox', 'color', 'radio', 'button', 'submit'].includes(type);
  }
  return false;
}

export function useKeyboardShortcuts(tap: () => void, nudgeBpm: (delta: number) => void): void {
  const momentaryRef = useRef<MomentaryKeyState | null>(null);
  const suppressedCodesRef = useRef(new Set<string>());

  useEffect(() => {
    const finishMomentary = (sceneId?: string, suppressKey = false) => {
      const active = momentaryRef.current;
      if (!active) return;
      if (sceneId && active.sceneId !== sceneId) return;
      if (suppressKey) suppressedCodesRef.current.add(active.code);
      if (active.timer !== null) window.clearTimeout(active.timer);
      momentaryRef.current = null;
      useAppStore.getState().endMomentaryScene(active.sceneId);
    };

    const latchMomentary = () => {
      const active = momentaryRef.current;
      if (!active) return;
      suppressedCodesRef.current.add(active.code);
      if (active.timer !== null) window.clearTimeout(active.timer);
      momentaryRef.current = null;
      useAppStore.getState().latchMomentaryScene(active.sceneId);
    };

    const handler = (event: KeyboardEvent) => {
      const store = useAppStore.getState();
      const preferences = usePreferencesStore.getState();

      if (event.key === 'Escape') {
        finishMomentary(undefined, true);
        store.closeEffectBrowser();
        store.setShortcutsOpen(false);
        preferences.setSettingsOpen(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      if (momentaryRef.current && MOMENTARY_STOP_CODES.has(event.code)) {
        event.preventDefault();
        finishMomentary(undefined, true);
        return;
      }

      if (momentaryRef.current && (event.code === 'Enter' || event.code === 'NumpadEnter')) {
        event.preventDefault();
        latchMomentary();
        return;
      }

      if (suppressedCodesRef.current.has(event.code)) return;

      if (store.shortcutsOpen) {
        if (event.ctrlKey || event.metaKey) event.preventDefault();
        return;
      }
      if (preferences.settingsOpen) return;

      if (isTextEntry(event.target)) return;
      if (
        event.target instanceof HTMLInputElement &&
        event.target.type === 'range' &&
        (event.code === 'ArrowUp' || event.code === 'ArrowDown')
      ) {
        return;
      }

      const actions: Array<[keyof typeof preferences.shortcuts, () => void]> = [
        ['tapTempo', tap],
        ['bpmDown', () => nudgeBpm(-1)],
        ['bpmUp', () => nudgeBpm(1)],
        ['bpmDown5', () => nudgeBpm(-5)],
        ['bpmUp5', () => nudgeBpm(5)],
        ['blackout', store.toggleBlackout],
        ['takeA', () => store.takeDeckLive('A', 900)],
        ['takeB', () => store.takeDeckLive('B', 900)],
        ['clearLayer', () => store.clearLayer(store.target.deck, store.target.layerIndex)],
        ['switchDeck', () => store.selectDeck(store.target.deck === 'A' ? 'B' : 'A')],
        ['cutDeckLive', () => store.cutDeckLive(store.target.deck)],
        ['shortcuts', () => store.setShortcutsOpen(true)],
        ['settings', () => preferences.setSettingsOpen(true)],
      ];
      const matchedAction = actions.find(([id]) => matchesShortcut(event, preferences.shortcuts[id]));
      if (matchedAction) {
        const focusedControl =
          event.target instanceof HTMLElement &&
          event.target.closest('button, input, select, textarea, [role="button"]');
        if (event.code === 'Space' && focusedControl) return;
        event.preventDefault();
        matchedAction[1]();
        return;
      }

      const scene = store.scenes.find((entry) => {
        const modifiers = entry.shortcutModifiers;
        return Boolean(
          entry.shortcut === event.code &&
            event.ctrlKey === Boolean(modifiers?.ctrl) &&
            event.altKey === Boolean(modifiers?.alt) &&
            event.shiftKey === Boolean(modifiers?.shift) &&
            event.metaKey === Boolean(modifiers?.meta),
        );
      });
      if (scene) {
        event.preventDefault();
        if (event.repeat) return;
        const active = momentaryRef.current;
        if (active?.sceneId === scene.id) return;
        if (active) finishMomentary(undefined, true);
        useAppStore.getState().beginMomentaryScene(scene.id);
        const timer = window.setTimeout(() => {
          const current = momentaryRef.current;
          if (!current || current.sceneId !== scene.id) return;
          current.timer = null;
          if (current.released) finishMomentary(scene.id);
        }, MOMENTARY_SCENE_MS);
        momentaryRef.current = {
          sceneId: scene.id,
          code: event.code,
          timer,
          released: false,
        };
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    };

    const release = (event: KeyboardEvent) => {
      suppressedCodesRef.current.delete(event.code);
      const active = momentaryRef.current;
      if (!active || active.code !== event.code) return;
      active.released = true;
      if (active.timer === null) finishMomentary(active.sceneId);
    };

    const handleBlur = () => finishMomentary();

    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', release);
    window.addEventListener('blur', handleBlur);
    return () => {
      finishMomentary();
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', handleBlur);
    };
  }, [tap, nudgeBpm]);
}
