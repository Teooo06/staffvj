import { create } from 'zustand';

export type PerformanceMode = 'performance' | 'balanced' | 'quality' | 'custom';
export type PreviewResolution = 360 | 540 | 720;
export type OutputResolution = 720 | 1080;
export type StartupLayout = 'single' | 'studio' | 'decks';
export type ShortcutAction =
  | 'tapTempo'
  | 'bpmDown'
  | 'bpmUp'
  | 'bpmDown5'
  | 'bpmUp5'
  | 'blackout'
  | 'takeA'
  | 'takeB'
  | 'clearLayer'
  | 'shortcuts'
  | 'settings';

export interface ShortcutBinding {
  code: string;
  label: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export interface PerformanceSettings {
  mode: PerformanceMode;
  previewResolution: PreviewResolution;
  previewFps: 24 | 30 | 60;
  browserFps: 15 | 24 | 30;
  outputResolution: OutputResolution;
  outputFps: 30 | 60;
}

interface UserPreferences {
  performance: PerformanceSettings;
  startupLayout: StartupLayout;
  shortcuts: Record<ShortcutAction, ShortcutBinding | null>;
}

interface PreferencesStore extends UserPreferences {
  settingsOpen: boolean;
  settingsTab: 'general' | 'performance' | 'keyboard' | 'audio' | 'recovery';
  setSettingsOpen: (open: boolean) => void;
  setSettingsTab: (tab: PreferencesStore['settingsTab']) => void;
  setStartupLayout: (layout: StartupLayout) => void;
  setShortcut: (action: ShortcutAction, binding: ShortcutBinding | null) => void;
  setPerformance: (patch: Partial<PerformanceSettings>) => void;
  setPerformanceFromRuntime: (performance: PerformanceSettings) => void;
  applyPerformanceMode: (mode: Exclude<PerformanceMode, 'custom'>) => void;
}

export const PERFORMANCE_PRESETS: Record<Exclude<PerformanceMode, 'custom'>, Omit<PerformanceSettings, 'mode'>> = {
  performance: {
    previewResolution: 360,
    previewFps: 24,
    browserFps: 15,
    outputResolution: 720,
    outputFps: 30,
  },
  balanced: {
    previewResolution: 540,
    previewFps: 30,
    browserFps: 24,
    outputResolution: 1080,
    outputFps: 60,
  },
  quality: {
    previewResolution: 720,
    previewFps: 60,
    browserFps: 30,
    outputResolution: 1080,
    outputFps: 60,
  },
};

const DEFAULT_SHORTCUTS: Record<ShortcutAction, ShortcutBinding | null> = {
  tapTempo: { code: 'Space', label: 'Spazio', ctrl: false, alt: false, shift: false, meta: false },
  bpmDown: { code: 'ArrowDown', label: '↓', ctrl: false, alt: false, shift: false, meta: false },
  bpmUp: { code: 'ArrowUp', label: '↑', ctrl: false, alt: false, shift: false, meta: false },
  bpmDown5: { code: 'ArrowDown', label: '↓', ctrl: false, alt: false, shift: true, meta: false },
  bpmUp5: { code: 'ArrowUp', label: '↑', ctrl: false, alt: false, shift: true, meta: false },
  blackout: { code: 'KeyB', label: 'B', ctrl: false, alt: false, shift: false, meta: false },
  takeA: { code: 'BracketLeft', label: '[', ctrl: false, alt: false, shift: false, meta: false },
  takeB: { code: 'BracketRight', label: ']', ctrl: false, alt: false, shift: false, meta: false },
  clearLayer: { code: 'Delete', label: 'Canc', ctrl: false, alt: false, shift: false, meta: false },
  shortcuts: { code: 'F1', label: 'F1', ctrl: false, alt: false, shift: false, meta: false },
  settings: { code: 'F2', label: 'F2', ctrl: false, alt: false, shift: false, meta: false },
};

const DEFAULT_PREFERENCES: UserPreferences = {
  performance: { mode: 'balanced', ...PERFORMANCE_PRESETS.balanced },
  startupLayout: 'studio',
  shortcuts: DEFAULT_SHORTCUTS,
};

const STORAGE_KEY = 'staffvj:preferences:v1';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadPreferences(): UserPreferences {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!isObject(parsed)) return DEFAULT_PREFERENCES;
    const rawPerformance = isObject(parsed.performance) ? parsed.performance : {};
    const rawShortcuts = isObject(parsed.shortcuts) ? parsed.shortcuts : {};
    const rawLayout = parsed.startupLayout;
    const shortcuts = { ...DEFAULT_SHORTCUTS };
    for (const action of Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[]) {
      const raw = rawShortcuts[action];
      if (raw === null) {
        shortcuts[action] = null;
      } else if (isObject(raw) && typeof raw.code === 'string' && typeof raw.label === 'string') {
        shortcuts[action] = {
          code: raw.code,
          label: raw.label.slice(0, 24),
          ctrl: raw.ctrl === true,
          alt: raw.alt === true,
          shift: raw.shift === true,
          meta: raw.meta === true,
        };
      }
    }
    const mode = ['performance', 'balanced', 'quality', 'custom'].includes(String(rawPerformance.mode))
      ? rawPerformance.mode as PerformanceMode
      : DEFAULT_PREFERENCES.performance.mode;
    const outputResolution = rawPerformance.outputResolution === 720 ? 720 : 1080;
    const previewResolution = rawPerformance.previewResolution === 360 || rawPerformance.previewResolution === 720
      ? rawPerformance.previewResolution
      : 540;
    const previewFps = rawPerformance.previewFps === 24 || rawPerformance.previewFps === 60
      ? rawPerformance.previewFps
      : 30;
    const browserFps = rawPerformance.browserFps === 15 || rawPerformance.browserFps === 30
      ? rawPerformance.browserFps
      : 24;
    const outputFps = rawPerformance.outputFps === 30 ? 30 : 60;
    return {
      performance: { mode, previewResolution, previewFps, browserFps, outputResolution, outputFps },
      startupLayout: rawLayout === 'single' || rawLayout === 'decks' ? rawLayout : 'studio',
      shortcuts,
    };
  } catch (_error) {
    return DEFAULT_PREFERENCES;
  }
}

function savePreferences(preferences: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (_error) {
    /* le preferenze restano applicate per questa sessione */
  }
}

function currentUserPreferences(state: PreferencesStore): UserPreferences {
  return {
    performance: state.performance,
    startupLayout: state.startupLayout,
    shortcuts: state.shortcuts,
  };
}

const restored = loadPreferences();

export const usePreferencesStore = create<PreferencesStore>((set, get) => ({
  ...restored,
  settingsOpen: false,
  settingsTab: 'general',
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSettingsTab: (settingsTab) => set({ settingsTab }),
  setStartupLayout: (startupLayout) => {
    savePreferences({ ...currentUserPreferences(get()), startupLayout });
    set({ startupLayout });
  },
  setShortcut: (action, binding) => {
    const shortcuts = { ...get().shortcuts, [action]: binding };
    savePreferences({ ...currentUserPreferences(get()), shortcuts });
    set({ shortcuts });
  },
  setPerformance: (patch) => {
    const current = get().performance;
    const nextPerformance: PerformanceSettings = { ...current, ...patch, mode: 'custom' };
    savePreferences({ ...currentUserPreferences(get()), performance: nextPerformance });
    set({ performance: nextPerformance });
  },
  setPerformanceFromRuntime: (performance) => set({ performance }),
  applyPerformanceMode: (mode) => {
    const performance: PerformanceSettings = { mode, ...PERFORMANCE_PRESETS[mode] };
    savePreferences({ ...currentUserPreferences(get()), performance });
    set({ performance });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    const preferences = loadPreferences();
    usePreferencesStore.setState(preferences);
  });
}

export function matchesShortcut(event: KeyboardEvent, binding: ShortcutBinding | null): boolean {
  return Boolean(
    binding &&
      event.code === binding.code &&
      event.ctrlKey === binding.ctrl &&
      event.altKey === binding.alt &&
      event.shiftKey === binding.shift &&
      event.metaKey === binding.meta,
  );
}

export function shortcutLabel(binding: ShortcutBinding | null): string {
  if (!binding) return 'Non assegnata';
  const parts = [
    ...(binding.ctrl ? ['Ctrl'] : []),
    ...(binding.alt ? ['Alt'] : []),
    ...(binding.shift ? ['Maiusc'] : []),
    ...(binding.meta ? ['⌘'] : []),
    binding.label,
  ];
  return parts.join('+');
}
