import { create } from 'zustand';
import type {
  AudioSettings,
  AutopilotSettings,
  Deck,
  DeckId,
  DisplayInfo,
  EffectInstance,
  EffectScope,
  EffectType,
  GeneratorKind,
  ImportedFile,
  Layer,
  MediaItem,
  NdiLayerSource,
  ProjectData,
  Scene,
  ShowState,
  ToastMessage,
} from './types';
import {
  BLEND_LABELS,
  DECK_LAYER_COUNT,
  GENERATOR_LABELS,
} from './types';
import {
  createDeck,
  createDemoProject,
  createLayer,
  defaultGenerator,
  defaultText,
  makeFileItem,
  makeBrowserItem,
  makeGeneratorItem,
  makeTextItem,
} from './demo';
import { createEffectInstance, getEffectDef, MAX_EFFECTS } from './engine/effectDefs';
import { usePreferencesStore } from './preferences';
import {
  clamp,
  clearAutosave,
  readAutosave,
  uid,
  writeAutosave,
} from './lib/utils';

export type MonitorMode = 'program' | 'A' | 'B';
export type MonitorLayout = 'single' | 'studio' | 'decks';
export type InspectorTab = 'layer' | 'master' | 'auto' | 'audio' | 'output';

export interface Target {
  deck: DeckId;
  layerIndex: number;
}

export interface MomentarySceneSnapshot {
  sceneId: string;
  deckId: DeckId;
  deck: Deck;
  library: MediaItem[];
  target: Target;
  selectedMediaId: string | null;
  monitor: MonitorMode;
  inspectorTab: InspectorTab;
}

export interface EffectBrowserState {
  open: boolean;
  scope: EffectScope | null;
}

export interface AppStore {
  projectName: string;
  library: MediaItem[];
  decks: Record<DeckId, Deck>;
  scenes: Scene[];
  crossfade: number;
  masterOpacity: number;
  masterEffects: EffectInstance[];
  blackout: boolean;
  bpm: number;

  target: Target;
  selectedMediaId: string | null;
  monitor: MonitorMode;
  monitorLayout: MonitorLayout;
  inspectorTab: InspectorTab;
  autopilot: AutopilotSettings;
  audio: AudioSettings;
  output: { displayId: number | null };
  outputOpen: boolean;
  displays: DisplayInfo[];
  effectBrowser: EffectBrowserState;
  shortcutsOpen: boolean;
  toasts: ToastMessage[];
  momentaryScene: MomentarySceneSnapshot | null;

  setProjectName: (name: string) => void;
  importMedia: (files: ImportedFile[]) => MediaItem[];
  addBrowserUrl: (url: string) => void;
  addBrowserFile: (path: string, name: string) => void;
  addScene: (thumbnail?: string) => void;
  loadScene: (
    sceneId: string,
    options?: { deck?: DeckId; focusInspector?: boolean; compactToTwo?: boolean; silent?: boolean },
  ) => void;
  beginMomentaryScene: (sceneId: string) => void;
  endMomentaryScene: (sceneId?: string) => void;
  latchMomentaryScene: (sceneId?: string) => void;
  renameScene: (sceneId: string, name: string) => void;
  removeScene: (sceneId: string) => void;
  setSceneShortcut: (
    sceneId: string,
    shortcut: string | null,
    label?: string | null,
    modifiers?: { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean },
  ) => void;
  addTextItem: () => void;
  addGenerator: (kind: GeneratorKind) => void;
  updateMedia: (id: string, patch: Partial<MediaItem>) => void;
  removeMedia: (id: string) => void;
  triggerMedia: (
    mediaId: string,
    deck?: DeckId,
    layerIndex?: number,
    options?: { focusInspector?: boolean; updateTarget?: boolean },
  ) => void;
  triggerNdi: (
    source: NdiLayerSource,
    deck?: DeckId,
    layerIndex?: number,
    options?: { focusInspector?: boolean; updateTarget?: boolean },
  ) => void;
  triggerCapture: (deviceId: string, label: string, deck?: DeckId, layerIndex?: number) => void;
  clearLayer: (deck: DeckId, layerIndex: number) => void;
  updateLayer: (deck: DeckId, layerIndex: number, patch: Partial<Omit<Layer, 'id'>>) => void;
  updateTransform: (
    deck: DeckId,
    layerIndex: number,
    patch: Partial<Layer['transform']>,
  ) => void;
  toggleLayerVisible: (deck: DeckId, layerIndex: number) => void;
  setTarget: (deck: DeckId, layerIndex: number) => void;
  selectDeck: (deck: DeckId) => void;
  setMonitor: (monitor: MonitorMode) => void;
  setMonitorLayout: (layout: MonitorLayout) => void;
  setInspectorTab: (tab: InspectorTab) => void;

  addEffect: (scope: EffectScope, type: EffectType) => void;
  updateEffect: (
    scope: EffectScope,
    effectId: string,
    patch: Partial<Omit<EffectInstance, 'params'>> & { params?: Record<string, number> },
  ) => void;
  toggleEffect: (scope: EffectScope, effectId: string) => void;
  removeEffect: (scope: EffectScope, effectId: string) => void;
  replaceMasterEffects: (effects: EffectInstance[]) => void;

  setCrossfade: (value: number) => void;
  animateCrossfade: (value: number, durationMs?: number) => void;
  takeDeckLive: (deck: DeckId, durationMs?: number) => void;
  cutDeckLive: (deck: DeckId) => void;
  setMasterOpacity: (value: number) => void;
  setBlackout: (value: boolean) => void;
  toggleBlackout: () => void;
  setBpm: (value: number) => void;

  setAutopilot: (patch: Partial<AutopilotSettings>) => void;
  setAudio: (patch: Partial<AudioSettings>) => void;
  setOutput: (patch: Partial<AppStore['output']>) => void;
  setOutputOpen: (open: boolean) => void;
  setDisplays: (displays: DisplayInfo[]) => void;
  refreshDisplays: () => Promise<void>;
  toggleOutput: () => Promise<void>;

  openEffectBrowser: (scope: EffectScope) => void;
  closeEffectBrowser: () => void;
  setShortcutsOpen: (open: boolean) => void;
  toast: (message: string, tone?: ToastMessage['tone']) => void;
  dismissToast: (id: string) => void;

  replaceProject: (data: unknown) => void;
  newProject: () => void;
  saveProject: () => Promise<void>;
  loadProject: () => Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function sameSceneShortcutModifiers(
  first: Scene['shortcutModifiers'],
  second: Scene['shortcutModifiers'],
): boolean {
  return Boolean(first?.ctrl) === Boolean(second?.ctrl) &&
    Boolean(first?.alt) === Boolean(second?.alt) &&
    Boolean(first?.shift) === Boolean(second?.shift) &&
    Boolean(first?.meta) === Boolean(second?.meta);
}

function sanitizeEffect(raw: unknown): EffectInstance | null {
  if (!isRecord(raw)) return null;
  const type = raw.type as EffectType;
  let def;
  try {
    def = getEffectDef(type);
  } catch (_error) {
    return null;
  }
  const rawParams = isRecord(raw.params) ? raw.params : {};
  const params: Record<string, number> = {};
  for (const param of def.params) {
    params[param.key] = clamp(
      finite(rawParams[param.key], param.default),
      param.min,
      param.max,
    );
  }
  return {
    id: str(raw.id, uid('fx')),
    type,
    enabled: bool(raw.enabled, true),
    mix: clamp(finite(raw.mix, 1), 0, 1),
    audioReact: clamp(finite(raw.audioReact, 0), 0, 1),
    beatReact: clamp(finite(raw.beatReact, 0), 0, 1),
    beatSync: bool(
      raw.beatSync,
      type === 'bounce' && typeof rawParams.auto === 'number'
        ? rawParams.auto >= 0.5
        : def.defaultBeatSync ?? false,
    ),
    params,
  };
}

function sanitizeEffects(raw: unknown): EffectInstance[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(sanitizeEffect)
    .filter((effect): effect is EffectInstance => Boolean(effect))
    .slice(0, MAX_EFFECTS);
}

function sanitizeMedia(raw: unknown): MediaItem | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id : null;
  const kind = raw.kind;
  if (!id) return null;
  if (
    kind !== 'video' &&
    kind !== 'image' &&
    kind !== 'generator' &&
    kind !== 'text' &&
    kind !== 'browser'
  ) {
    return null;
  }

  const item: MediaItem = {
    id,
    name: str(raw.name, 'Media'),
    kind,
    createdAt: finite(raw.createdAt, Date.now()),
  };

  if (kind === 'video' || kind === 'image') {
    if (typeof raw.path !== 'string' || !raw.path) return null;
    item.path = raw.path;
    if (typeof raw.width === 'number') item.width = raw.width;
    if (typeof raw.height === 'number') item.height = raw.height;
    if (typeof raw.duration === 'number') item.duration = raw.duration;
    if (typeof raw.size === 'number') item.size = raw.size;
  }

  if (kind === 'browser') {
    const url = typeof raw.url === 'string' ? raw.url : '';
    const path = typeof raw.path === 'string' ? raw.path : '';
    if (!url && !path) return null;
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        item.url = parsed.toString();
      } catch (_error) {
        return null;
      }
    }
    if (path) item.path = path;
  }

  if (kind === 'generator') {
    const generator =
      typeof raw.generator === 'string' && raw.generator in GENERATOR_LABELS
        ? (raw.generator as GeneratorKind)
        : 'plasma';
    const rawGen = isRecord(raw.gen) ? raw.gen : {};
    item.generator = generator;
    item.gen = {
      ...defaultGenerator(generator),
      speed: clamp(finite(rawGen.speed, defaultGenerator(generator).speed), 0, 4),
      hue: clamp(finite(rawGen.hue, defaultGenerator(generator).hue), 0, 1),
      intensity: clamp(finite(rawGen.intensity, defaultGenerator(generator).intensity), 0, 2),
      color: str(rawGen.color, defaultGenerator(generator).color),
    };
  }

  if (kind === 'text') {
    const rawText = isRecord(raw.text) ? raw.text : {};
    const base = defaultText();
    const animation = rawText.animation;
    item.text = {
      ...base,
      text: str(rawText.text, base.text),
      font: str(rawText.font, base.font),
      weight: clamp(finite(rawText.weight, base.weight), 100, 900),
      size: clamp(finite(rawText.size, base.size), 12, 400),
      color: str(rawText.color, base.color),
      align:
        rawText.align === 'left' || rawText.align === 'right' || rawText.align === 'center'
          ? rawText.align
          : base.align,
      x: clamp(finite(rawText.x, base.x), 0, 1),
      y: clamp(finite(rawText.y, base.y), 0, 1),
      animation:
        animation === 'scroll-left' ||
        animation === 'scroll-right' ||
        animation === 'pulse' ||
        animation === 'typewriter' ||
        animation === 'bounce' ||
        animation === 'none'
          ? animation
          : base.animation,
      speed: clamp(finite(rawText.speed, base.speed), 0, 6),
      outline: bool(rawText.outline, base.outline),
      outlineColor: str(rawText.outlineColor, base.outlineColor),
      background: bool(rawText.background, base.background),
      backgroundOpacity: clamp(
        finite(rawText.backgroundOpacity, base.backgroundOpacity),
        0,
        1,
      ),
      letterSpacing: clamp(finite(rawText.letterSpacing, base.letterSpacing), -20, 40),
      uppercase: bool(rawText.uppercase, base.uppercase),
    };
  }

  return item;
}

function sanitizeLayer(raw: unknown, mediaIds: Set<string>): Layer {
  const base = createLayer();
  if (!isRecord(raw)) return base;

  let source: Layer['source'] = null;
  if (isRecord(raw.source)) {
    if (
      raw.source.kind === 'media' &&
      typeof raw.source.mediaId === 'string' &&
      mediaIds.has(raw.source.mediaId)
    ) {
      source = {
        kind: 'media',
        mediaId: raw.source.mediaId,
        startedAt: finite(raw.source.startedAt, 0),
      };
    } else if (raw.source.kind === 'capture' && typeof raw.source.deviceId === 'string') {
      source = {
        kind: 'capture',
        deviceId: raw.source.deviceId,
        label: str(raw.source.label, 'Ingresso live'),
        startedAt: finite(raw.source.startedAt, 0),
      };
    } else if (
      raw.source.kind === 'ndi' &&
      typeof raw.source.sourceId === 'string' &&
      typeof raw.source.sourceName === 'string'
    ) {
      source = {
        kind: 'ndi',
        sourceId: raw.source.sourceId,
        sourceName: raw.source.sourceName,
        urlAddress: typeof raw.source.urlAddress === 'string' ? raw.source.urlAddress : undefined,
        startedAt: finite(raw.source.startedAt, 0),
      };
    }
  }

  const rawTransform = isRecord(raw.transform) ? raw.transform : {};
  const blend =
    typeof raw.blend === 'string' && raw.blend in BLEND_LABELS
      ? (raw.blend as Layer['blend'])
      : 'normal';

  return {
    ...base,
    source,
    opacity: clamp(finite(raw.opacity, base.opacity), 0, 1),
    blend,
    fit: raw.fit === 'contain' ? 'contain' : 'cover',
    transform: {
      x: clamp(finite(rawTransform.x, 0), -2, 2),
      y: clamp(finite(rawTransform.y, 0), -2, 2),
      scale: clamp(finite(rawTransform.scale, 1), 0.05, 8),
      rotation: clamp(finite(rawTransform.rotation, 0), -720, 720),
    },
    effects: sanitizeEffects(raw.effects),
    fadeMs: clamp(finite(raw.fadeMs, base.fadeMs), 0, 5000),
    visible: bool(raw.visible, true),
  };
}

function sanitizeDeck(raw: unknown, id: DeckId, mediaIds: Set<string>): Deck {
  const base = createDeck(id);
  if (!isRecord(raw)) return base;
  const rawLayers = Array.isArray(raw.layers) ? raw.layers : [];
  return {
    id,
    layers: Array.from({ length: DECK_LAYER_COUNT }, (_value, index) =>
      rawLayers[index] ? sanitizeLayer(rawLayers[index], mediaIds) : createLayer(),
    ),
  };
}

function sanitizeScene(raw: unknown): Scene | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  const media = Array.isArray(raw.media)
    ? raw.media.map(sanitizeMedia).filter((item): item is MediaItem => Boolean(item))
    : [];
  const mediaIds = new Set(media.map((item) => item.id));
  const rawDeck = isRecord(raw.deck) ? raw.deck : {};
  const createdAt = finite(raw.createdAt, Date.now());
  return {
    id: raw.id,
    name: str(raw.name, 'Scena'),
    deck: sanitizeDeck(rawDeck, 'A', mediaIds),
    media,
    thumbnail:
      typeof raw.thumbnail === 'string' && raw.thumbnail.startsWith('data:image/')
        ? raw.thumbnail.slice(0, 120_000)
        : undefined,
    shortcut: typeof raw.shortcut === 'string' && raw.shortcut ? raw.shortcut : null,
    shortcutLabel: typeof raw.shortcutLabel === 'string' ? raw.shortcutLabel.slice(0, 24) : undefined,
    shortcutModifiers: isRecord(raw.shortcutModifiers)
      ? {
          ctrl: raw.shortcutModifiers.ctrl === true,
          alt: raw.shortcutModifiers.alt === true,
          shift: raw.shortcutModifiers.shift === true,
          meta: raw.shortcutModifiers.meta === true,
        }
      : undefined,
    createdAt,
  };
}

function sanitizeProject(raw: unknown): ProjectData {
  if (!isRecord(raw) || !isRecord(raw.decks) || !Array.isArray(raw.library)) {
    return createDemoProject();
  }

  const library = raw.library
    .map(sanitizeMedia)
    .filter((item): item is MediaItem => Boolean(item));

  const mediaIds = new Set(library.map((item) => item.id));

  const rawAutopilot = isRecord(raw.autopilot) ? raw.autopilot : {};
  const rawAudio = isRecord(raw.audio) ? raw.audio : {};
  const rawOutput = isRecord(raw.output) ? raw.output : {};
  const audioMinBpm = clamp(finite(rawAudio.minBpm, 60), 60, 199);
  const audioMaxBpm = clamp(finite(rawAudio.maxBpm, 200), audioMinBpm + 1, 200);

  return {
    version: 2,
    name: str(raw.name, 'StaffVJ'),
    library,
    decks: {
      A: sanitizeDeck(raw.decks.A, 'A', mediaIds),
      B: sanitizeDeck(raw.decks.B, 'B', mediaIds),
    },
    scenes: Array.isArray(raw.scenes)
      ? raw.scenes.map(sanitizeScene).filter((scene): scene is Scene => Boolean(scene)).slice(0, 64)
      : [],
    crossfade: clamp(finite(raw.crossfade, 0), 0, 1),
    masterOpacity: clamp(finite(raw.masterOpacity, 1), 0, 1),
    masterEffects: sanitizeEffects(raw.masterEffects),
    blackout: bool(raw.blackout, false),
    bpm: clamp(finite(raw.bpm, 124), 60, 200),
    autopilot: {
      enabled: bool(rawAutopilot.enabled, false),
      everyBeats: clamp(finite(rawAutopilot.everyBeats, 16), 2, 128),
      autoMix: bool(rawAutopilot.autoMix, false),
      autoFx: bool(rawAutopilot.autoFx, false),
    },
    audio: {
      enabled: bool(rawAudio.enabled, false),
      deviceId: typeof rawAudio.deviceId === 'string' ? rawAudio.deviceId : null,
      deviceLabel: str(rawAudio.deviceLabel, 'Nessun ingresso'),
      sensitivity: clamp(finite(rawAudio.sensitivity, 1), 0.2, 3),
      autoBpm: bool(rawAudio.autoBpm, true),
      detectorMode:
        rawAudio.detectorMode === 'mix' || rawAudio.detectorMode === 'hybrid'
          ? rawAudio.detectorMode
          : 'bass',
      beatThreshold: clamp(finite(rawAudio.beatThreshold, 0.85), 0.4, 5),
      tempoResponse: clamp(finite(rawAudio.tempoResponse, 0.42), 0.1, 0.8),
      minBpm: audioMinBpm,
      maxBpm: audioMaxBpm,
    },
    output: {
      displayId:
        typeof rawOutput.displayId === 'number' && Number.isFinite(rawOutput.displayId)
          ? rawOutput.displayId
          : null,
    },
  };
}

function updateDeckLayer(
  decks: Record<DeckId, Deck>,
  deck: DeckId,
  layerIndex: number,
  patch: Partial<Layer>,
): Record<DeckId, Deck> {
  const next = { ...decks } as Record<DeckId, Deck>;
  next[deck] = {
    ...next[deck],
    layers: next[deck].layers.map((layer, index) =>
      index === layerIndex ? { ...layer, ...patch } : layer,
    ),
  };
  return next;
}

function effectsForScope(state: AppStore, scope: EffectScope): EffectInstance[] {
  if (scope.kind === 'master') return state.masterEffects;
  return state.decks[scope.deck].layers[scope.layerIndex]?.effects ?? [];
}

function stateWithEffects(
  state: AppStore,
  scope: EffectScope,
  effects: EffectInstance[],
): Partial<AppStore> {
  if (scope.kind === 'master') return { masterEffects: effects };
  return {
    decks: updateDeckLayer(state.decks, scope.deck, scope.layerIndex, { effects }),
  };
}

function stripThumb(item: MediaItem): MediaItem {
  const { thumb: _thumb, ...rest } = item;
  return rest;
}

export function toProjectData(state: AppStore): ProjectData {
  return {
    version: 2,
    name: state.projectName,
    library: state.library.map(stripThumb),
    decks: state.decks,
    scenes: state.scenes,
    crossfade: state.crossfade,
    masterOpacity: state.masterOpacity,
    masterEffects: state.masterEffects,
    blackout: state.blackout,
    bpm: state.bpm,
    autopilot: state.autopilot,
    audio: state.audio,
    output: { displayId: state.output.displayId },
  };
}

export function buildShowState(state: AppStore): ShowState {
  return {
    name: state.projectName,
    library: state.library.map(stripThumb),
    decks: state.decks,
    crossfade: state.crossfade,
    masterOpacity: state.masterOpacity,
    masterEffects: state.masterEffects,
    blackout: state.blackout,
    bpm: state.bpm,
  };
}

const restoredProject = (() => {
  try {
    const stored = readAutosave();
    return stored ? sanitizeProject(stored) : createDemoProject();
  } catch (_error) {
    return createDemoProject();
  }
})();

function initialSelection(project: ProjectData): string | null {
  const layer = project.decks[initialTargetDeck(project)].layers[0];
  if (layer?.source?.kind === 'media') return layer.source.mediaId;
  return null;
}

function initialTargetDeck(project: ProjectData): DeckId {
  return project.crossfade < 0.5 ? 'B' : 'A';
}

let crossfadeAnimation: number | null = null;

function cancelCrossfadeAnimation(): void {
  if (crossfadeAnimation !== null) {
    cancelAnimationFrame(crossfadeAnimation);
    crossfadeAnimation = null;
  }
}

export const useAppStore = create<AppStore>((set, get) => ({
  projectName: restoredProject.name,
  library: restoredProject.library,
  decks: restoredProject.decks,
  scenes: restoredProject.scenes,
  crossfade: restoredProject.crossfade,
  masterOpacity: restoredProject.masterOpacity,
  masterEffects: restoredProject.masterEffects,
  blackout: restoredProject.blackout,
  bpm: restoredProject.bpm,

  target: { deck: initialTargetDeck(restoredProject), layerIndex: 0 },
  selectedMediaId: initialSelection(restoredProject),
  monitor: 'program',
  monitorLayout: usePreferencesStore.getState().startupLayout,
  inspectorTab: 'layer',
  autopilot: restoredProject.autopilot,
  audio: restoredProject.audio,
  output: restoredProject.output,
  outputOpen: false,
  displays: [],
  effectBrowser: { open: false, scope: null },
  shortcutsOpen: false,
  toasts: [],
  momentaryScene: null,

  setProjectName: (name) => set({ projectName: name }),

  importMedia: (files) => {
    const items = files.map(makeFileItem);
    if (!items.length) return [];
    set((state) => ({ library: [...state.library, ...items] }));
    get().toast(
      items.length === 1 ? 'Media importato' : `${items.length} media importati`,
      'success',
    );
    return items;
  },

  addBrowserUrl: (value) => {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch (_error) {
      get().toast('Inserisci un indirizzo web valido', 'error');
      return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      get().toast('La sorgente browser accetta URL HTTP o HTTPS', 'error');
      return;
    }
    const item = makeBrowserItem({ name: url.hostname || 'Pagina web', url: url.toString() });
    set((state) => ({ library: [...state.library, item] }));
    get().toast('Sorgente browser aggiunta', 'success');
  },

  addBrowserFile: (path, name) => {
    if (!path) return;
    const item = makeBrowserItem({ name: name.replace(/\.html?$/i, '') || 'HTML locale', path });
    set((state) => ({ library: [...state.library, item] }));
    get().toast('Pagina HTML aggiunta', 'success');
  },

  addScene: (thumbnail) => {
    const state = get();
    if (state.scenes.length >= 64) {
      get().toast('Hai raggiunto il limite di 64 scene', 'error');
      return;
    }
    const deck = state.decks[state.target.deck];
    const mediaIds = new Set(
      deck.layers.flatMap((layer) =>
        layer.source?.kind === 'media' ? [layer.source.mediaId] : [],
      ),
    );
    const media = state.library
      .filter((item) => mediaIds.has(item.id))
      .map((item) => JSON.parse(JSON.stringify(stripThumb(item))) as MediaItem);
    const snapshot = JSON.parse(JSON.stringify(deck)) as Deck;
    const scene: Scene = {
      id: uid('scene'),
      name: `Scena ${state.scenes.length + 1}`,
      deck: { ...snapshot, id: 'A' },
      media,
      thumbnail,
      shortcut: null,
      createdAt: Date.now(),
    };
    set((current) => ({ scenes: [...current.scenes, scene] }));
    get().toast(`Scena salvata dal Deck ${state.target.deck}`, 'success');
  },

  loadScene: (sceneId, options) => {
    const state = get();
    if (state.momentaryScene) {
      get().endMomentaryScene();
      get().loadScene(sceneId, options);
      return;
    }
    const scene = state.scenes.find((entry) => entry.id === sceneId);
    if (!scene) return;
    const deckId = options?.deck ?? state.target.deck;
    const sceneMedia = scene.media.map(
      (item) => JSON.parse(JSON.stringify(stripThumb(item))) as MediaItem,
    );
    const mediaById = new Map(state.library.map((item) => [item.id, item]));
    sceneMedia.forEach((item) => mediaById.set(item.id, item));
    let deck = JSON.parse(JSON.stringify(scene.deck)) as Deck;
    if (options?.compactToTwo) {
      const occupied = deck.layers
        .map((layer, index) => (layer.source ? index : -1))
        .filter((index) => index >= 0);
      if (occupied.length > 2) {
        const bottomIndex = occupied[occupied.length - 1];
        const topIndex = occupied[0];
        const layers = Array.from({ length: DECK_LAYER_COUNT }, () => createLayer());
        layers[1] = { ...deck.layers[bottomIndex], opacity: 1 };
        layers[0] = { ...deck.layers[topIndex], opacity: 0.5 };
        deck = { ...deck, layers };
      } else if (occupied.length === 2) {
        const bottomIndex = Math.max(occupied[0], occupied[1]);
        const topIndex = Math.min(occupied[0], occupied[1]);
        const layers = Array.from({ length: DECK_LAYER_COUNT }, () => createLayer());
        layers[1] = { ...deck.layers[bottomIndex], opacity: 1 };
        layers[0] = { ...deck.layers[topIndex], opacity: 0.5 };
        deck = { ...deck, layers };
      } else if (occupied.length === 1) {
        const layers = Array.from({ length: DECK_LAYER_COUNT }, () => createLayer());
        layers[1] = { ...deck.layers[occupied[0]], opacity: 1 };
        deck = { ...deck, layers };
      }
    }
    set({
      library: [...mediaById.values()],
      decks: { ...state.decks, [deckId]: { ...deck, id: deckId } },
      target: { deck: deckId, layerIndex: 0 },
      selectedMediaId:
        deck.layers[0]?.source?.kind === 'media' ? deck.layers[0].source.mediaId : null,
      monitor: deckId,
      ...(options?.focusInspector === false ? {} : { inspectorTab: 'layer' as const }),
    });
    if (!options?.silent) {
      get().toast(`“${scene.name}” caricata nel Deck ${deckId}`, 'success');
    }
  },

  beginMomentaryScene: (sceneId) => {
    const current = get();
    if (!current.scenes.some((scene) => scene.id === sceneId)) return;
    if (current.momentaryScene) get().endMomentaryScene();
    const state = get();
    const snapshot: MomentarySceneSnapshot = {
      sceneId,
      deckId: state.target.deck,
      deck: JSON.parse(JSON.stringify(state.decks[state.target.deck])) as Deck,
      library: state.library,
      target: { ...state.target },
      selectedMediaId: state.selectedMediaId,
      monitor: state.monitor,
      inspectorTab: state.inspectorTab,
    };
    get().loadScene(sceneId, {
      deck: snapshot.deckId,
      focusInspector: false,
      silent: true,
    });
    set({ momentaryScene: snapshot });
  },

  endMomentaryScene: (sceneId) => {
    const state = get();
    const snapshot = state.momentaryScene;
    if (!snapshot || (sceneId && snapshot.sceneId !== sceneId)) return;
    set({
      decks: { ...state.decks, [snapshot.deckId]: snapshot.deck },
      library: snapshot.library,
      target: snapshot.target,
      selectedMediaId: snapshot.selectedMediaId,
      monitor: snapshot.monitor,
      inspectorTab: snapshot.inspectorTab,
      momentaryScene: null,
    });
  },

  latchMomentaryScene: (sceneId) => {
    const state = get();
    const snapshot = state.momentaryScene;
    if (!snapshot || (sceneId && snapshot.sceneId !== sceneId)) return;
    const scene = state.scenes.find((entry) => entry.id === snapshot.sceneId);
    set({ momentaryScene: null });
    if (scene) get().toast(`“${scene.name}” resta attiva`, 'success');
  },

  renameScene: (sceneId, value) => {
    const name = value.trim();
    if (!name) return;
    set((state) => ({
      scenes: state.scenes.map((scene) => (scene.id === sceneId ? { ...scene, name } : scene)),
    }));
  },

  removeScene: (sceneId) => {
    set((state) => ({ scenes: state.scenes.filter((scene) => scene.id !== sceneId) }));
  },

  setSceneShortcut: (sceneId, shortcut, label = null, modifiers) => {
    const targetModifiers = modifiers ?? { ctrl: false, alt: false, shift: false, meta: false };
    set((state) => ({
      scenes: state.scenes.map((scene) => {
        if (scene.id === sceneId) {
          return {
            ...scene,
            shortcut,
            shortcutLabel: shortcut ? label ?? undefined : undefined,
            shortcutModifiers: shortcut ? targetModifiers : undefined,
          };
        }
        if (
          shortcut &&
          scene.shortcut === shortcut &&
          sameSceneShortcutModifiers(scene.shortcutModifiers, targetModifiers)
        ) {
          return { ...scene, shortcut: null, shortcutLabel: undefined, shortcutModifiers: undefined };
        }
        return scene;
      }),
    }));
  },

  addTextItem: () => {
    const item = makeTextItem(
      { name: 'Nuovo testo' },
      { text: 'SCRIVI QUI', size: 120, color: '#ffffff', animation: 'none' },
    );
    set((state) => ({ library: [...state.library, item] }));
    get().triggerMedia(item.id);
    get().toast('Testo creato', 'success');
  },

  addGenerator: (kind) => {
    const count = get().library.filter(
      (item) => item.kind === 'generator' && item.generator === kind,
    ).length;
    const label = GENERATOR_LABELS[kind];
    const item = makeGeneratorItem(kind, count > 0 ? `${label} ${count + 1}` : label);
    set((state) => ({ library: [...state.library, item] }));
    get().triggerMedia(item.id);
    get().toast(`${label} creato`, 'success');
  },

  updateMedia: (id, patch) => {
    set((state) => ({
      library: state.library.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          ...patch,
          text:
            patch.text && item.text
              ? { ...item.text, ...patch.text }
              : patch.text ?? item.text,
          gen:
            patch.gen && item.gen
              ? { ...item.gen, ...patch.gen }
              : patch.gen ?? item.gen,
        };
      }),
    }));
  },

  removeMedia: (id) => {
    const state = get();
    const decks = { ...state.decks } as Record<DeckId, Deck>;
    (['A', 'B'] as DeckId[]).forEach((deckId) => {
      decks[deckId] = {
        ...decks[deckId],
        layers: decks[deckId].layers.map((layer) =>
          layer.source?.kind === 'media' && layer.source.mediaId === id
            ? { ...layer, source: null }
            : layer,
        ),
      };
    });
    set({
      library: state.library.filter((item) => item.id !== id),
      decks,
      selectedMediaId: state.selectedMediaId === id ? null : state.selectedMediaId,
    });
    get().toast('Media eliminato', 'info');
  },

  triggerMedia: (mediaId, deckArg, layerArg, options) => {
    const state = get();
    const item = state.library.find((entry) => entry.id === mediaId);
    if (!item) return;
    const deck = deckArg ?? state.target.deck;
    const layerIndex = clamp(layerArg ?? state.target.layerIndex, 0, DECK_LAYER_COUNT - 1);
    const source = { kind: 'media' as const, mediaId, startedAt: Date.now() };
    set({
      decks: updateDeckLayer(state.decks, deck, layerIndex, { source }),
      ...(options?.updateTarget === false ? {} : { target: { deck, layerIndex } }),
      selectedMediaId: mediaId,
      ...(options?.focusInspector === false ? {} : { inspectorTab: 'layer' as const }),
    });
  },

  triggerNdi: (sourceArg, deckArg, layerArg, options) => {
    const state = get();
    const deck = deckArg ?? state.target.deck;
    const layerIndex = clamp(layerArg ?? state.target.layerIndex, 0, DECK_LAYER_COUNT - 1);
    const source: NdiLayerSource = { ...sourceArg, startedAt: Date.now() };
    set({
      decks: updateDeckLayer(state.decks, deck, layerIndex, { source }),
      ...(options?.updateTarget === false ? {} : { target: { deck, layerIndex } }),
      selectedMediaId: null,
      ...(options?.focusInspector === false ? {} : { inspectorTab: 'layer' as const }),
    });
    get().toast(`Ingresso NDI assegnato: ${source.sourceName}`, 'success');
  },

  triggerCapture: (deviceId, label, deckArg, layerArg) => {
    const state = get();
    const deck = deckArg ?? state.target.deck;
    const layerIndex = clamp(layerArg ?? state.target.layerIndex, 0, DECK_LAYER_COUNT - 1);
    const source = {
      kind: 'capture' as const,
      deviceId,
      label,
      startedAt: Date.now(),
    };
    set({
      decks: updateDeckLayer(state.decks, deck, layerIndex, { source }),
      target: { deck, layerIndex },
      selectedMediaId: null,
      inspectorTab: 'layer',
    });
    get().toast('Ingresso live assegnato', 'success');
  },

  clearLayer: (deck, layerIndex) => {
    const state = get();
    set({
      decks: updateDeckLayer(state.decks, deck, layerIndex, { source: null }),
      selectedMediaId:
        state.target.deck === deck && state.target.layerIndex === layerIndex
          ? null
          : state.selectedMediaId,
    });
  },

  updateLayer: (deck, layerIndex, patch) => {
    set((state) => ({
      decks: updateDeckLayer(state.decks, deck, layerIndex, patch),
    }));
  },

  updateTransform: (deck, layerIndex, patch) => {
    const state = get();
    const layer = state.decks[deck].layers[layerIndex];
    if (!layer) return;
    set({
      decks: updateDeckLayer(state.decks, deck, layerIndex, {
        transform: { ...layer.transform, ...patch },
      }),
    });
  },

  toggleLayerVisible: (deck, layerIndex) => {
    const state = get();
    const layer = state.decks[deck].layers[layerIndex];
    if (!layer) return;
    set({
      decks: updateDeckLayer(state.decks, deck, layerIndex, { visible: !layer.visible }),
    });
  },

  setTarget: (deck, layerIndex) => {
    const state = get();
    const index = clamp(layerIndex, 0, DECK_LAYER_COUNT - 1);
    const layer = state.decks[deck].layers[index];
    const selectedMediaId =
      layer?.source?.kind === 'media' ? layer.source.mediaId : null;
    set({
      target: { deck, layerIndex: index },
      selectedMediaId,
      inspectorTab: 'layer',
    });
  },

  selectDeck: (deck) => {
    const state = get();
    const layerIndex = state.target.layerIndex;
    const layer = state.decks[deck].layers[layerIndex];
    set({
      target: { deck, layerIndex },
      selectedMediaId:
        layer?.source?.kind === 'media' ? layer.source.mediaId : null,
    });
  },

  setMonitor: (monitor) => set({ monitor }),
  setMonitorLayout: (monitorLayout) => set({ monitorLayout }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),

  addEffect: (scope, type) => {
    const state = get();
    const effects = effectsForScope(state, scope);
    if (effects.length >= MAX_EFFECTS) {
      state.toast(`Massimo ${MAX_EFFECTS} effetti per catena`, 'error');
      return;
    }
    const next = [...effects, createEffectInstance(type)];
    set(stateWithEffects(state, scope, next));
    state.toast('Effetto aggiunto', 'success');
  },

  updateEffect: (scope, effectId, patch) => {
    const state = get();
    const effects = effectsForScope(state, scope).map((effect) => {
      if (effect.id !== effectId) return effect;
      return {
        ...effect,
        ...patch,
        params: patch.params
          ? { ...effect.params, ...patch.params }
          : effect.params,
      };
    });
    set(stateWithEffects(state, scope, effects));
  },

  toggleEffect: (scope, effectId) => {
    const state = get();
    const effects = effectsForScope(state, scope).map((effect) =>
      effect.id === effectId ? { ...effect, enabled: !effect.enabled } : effect,
    );
    set(stateWithEffects(state, scope, effects));
  },

  removeEffect: (scope, effectId) => {
    const state = get();
    const effects = effectsForScope(state, scope).filter(
      (effect) => effect.id !== effectId,
    );
    set(stateWithEffects(state, scope, effects));
  },

  replaceMasterEffects: (effects) => {
    set({ masterEffects: effects.slice(0, MAX_EFFECTS) });
  },

  setCrossfade: (value) => {
    cancelCrossfadeAnimation();
    set({ crossfade: clamp(value, 0, 1) });
  },

  animateCrossfade: (value, durationMs = 900) => {
    cancelCrossfadeAnimation();
    const startValue = get().crossfade;
    const target = clamp(value, 0, 1);
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = clamp((now - startTime) / durationMs, 0, 1);
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      set({ crossfade: startValue + (target - startValue) * eased });
      if (progress < 1) {
        crossfadeAnimation = requestAnimationFrame(tick);
      } else {
        crossfadeAnimation = null;
      }
    };
    crossfadeAnimation = requestAnimationFrame(tick);
  },

  takeDeckLive: (deck, durationMs = 650) => {
    const state = get();
    const outgoingDeck: DeckId = state.crossfade < 0.5 ? 'A' : 'B';
    const targetCrossfade = deck === 'A' ? 0 : 1;
    set({ monitor: 'program' });
    state.animateCrossfade(targetCrossfade, durationMs);
    if (outgoingDeck === deck) return;
    window.setTimeout(() => {
      const current = get();
      if (Math.abs(current.crossfade - targetCrossfade) < 0.02) {
        current.selectDeck(outgoingDeck);
      }
    }, durationMs + 40);
  },

  cutDeckLive: (deck: DeckId) => {
    const state = get();
    set({ crossfade: deck === 'A' ? 0 : 1, monitor: 'program' });
    state.selectDeck(deck);
  },

  setMasterOpacity: (value) => set({ masterOpacity: clamp(value, 0, 1) }),
  setBlackout: (value) => set({ blackout: value }),
  toggleBlackout: () => set((state) => ({ blackout: !state.blackout })),
  setBpm: (value) => set({ bpm: clamp(value, 60, 200) }),

  setAutopilot: (patch) =>
    set((state) => ({
      autopilot: {
        ...state.autopilot,
        ...patch,
        everyBeats:
          patch.everyBeats !== undefined
            ? clamp(patch.everyBeats, 2, 128)
            : state.autopilot.everyBeats,
      },
    })),

  setAudio: (patch) =>
    set((state) => {
      const audio = { ...state.audio, ...patch };
      audio.sensitivity = clamp(audio.sensitivity, 0.2, 3);
      audio.beatThreshold = clamp(audio.beatThreshold, 0.4, 5);
      audio.tempoResponse = clamp(audio.tempoResponse, 0.1, 0.8);
      audio.minBpm = clamp(audio.minBpm, 60, 199);
      audio.maxBpm = clamp(audio.maxBpm, audio.minBpm + 1, 200);
      return { audio };
    }),

  setOutput: (patch) =>
    set((state) => ({ output: { ...state.output, ...patch } })),
  setOutputOpen: (outputOpen) => set({ outputOpen }),
  setDisplays: (displays) =>
    set((state) => {
      const current = state.output.displayId;
      if (current !== null && displays.some((display) => display.id === current)) {
        return { displays };
      }
      const preferred = displays.find((display) => !display.primary) ?? displays[0];
      return {
        displays,
        output: { ...state.output, displayId: preferred ? preferred.id : null },
      };
    }),

  refreshDisplays: async () => {
    if (!window.vj) return;
    try {
      const displays = await window.vj.listDisplays();
      get().setDisplays(displays);
      const open = await window.vj.isOutputOpen();
      set({ outputOpen: open });
    } catch (error) {
      console.warn(error);
    }
  },

  toggleOutput: async () => {
    if (!window.vj) {
      get().toast('Apri StaffVJ come applicazione desktop', 'error');
      return;
    }
    const state = get();
    if (state.outputOpen) {
      await window.vj.closeOutput();
      set({ outputOpen: false });
      return;
    }
    let displays = state.displays;
    if (!displays.length) {
      displays = await window.vj.listDisplays();
      state.setDisplays(displays);
    }
    let displayId = state.output.displayId;
    if (displayId === null || !displays.some((display) => display.id === displayId)) {
      displayId =
        displays.find((display) => !display.primary)?.id ?? displays[0]?.id ?? null;
    }
    if (displayId === null) {
      state.toast('Nessuno schermo disponibile per l’output', 'error');
      return;
    }
    try {
      await window.vj.openOutput(displayId);
      set({
        outputOpen: true,
        output: { ...state.output, displayId },
      });
      state.toast('Output proiettore aperto', 'success');
    } catch (error) {
      console.error(error);
      state.toast('Apertura output non riuscita', 'error');
    }
  },

  openEffectBrowser: (scope) => set({ effectBrowser: { open: true, scope } }),
  closeEffectBrowser: () => set({ effectBrowser: { open: false, scope: null } }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),

  toast: (message, tone = 'info') => {
    const id = uid('toast');
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, message, tone }] }));
    window.setTimeout(() => get().dismissToast(id), 3200);
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  replaceProject: (data) => {
    const project = sanitizeProject(data);
    cancelCrossfadeAnimation();
    const targetDeck = initialTargetDeck(project);
    const deck = project.decks[targetDeck];
    const firstLayer = deck.layers[0];
    set({
      projectName: project.name,
      library: project.library,
      decks: project.decks,
      scenes: project.scenes,
      crossfade: project.crossfade,
      masterOpacity: project.masterOpacity,
      masterEffects: project.masterEffects,
      blackout: project.blackout,
      bpm: project.bpm,
      autopilot: project.autopilot,
      audio: project.audio,
      output: project.output,
      target: { deck: targetDeck, layerIndex: 0 },
      selectedMediaId:
        firstLayer?.source?.kind === 'media' ? firstLayer.source.mediaId : null,
      monitor: 'program',
      inspectorTab: 'layer',
      effectBrowser: { open: false, scope: null },
      momentaryScene: null,
    });
  },

  newProject: () => {
    clearAutosave();
    get().replaceProject(createDemoProject());
    get().toast('Nuovo progetto', 'success');
  },

  saveProject: async () => {
    if (!window.vj) {
      get().toast('Salvataggio disponibile solo nell’app desktop', 'error');
      return;
    }
    const result = await window.vj.saveProject(toProjectData(get()));
    if (!result?.canceled) {
      if (result?.error) {
        get().toast('Salvataggio non riuscito', 'error');
      } else {
        get().toast('Progetto salvato', 'success');
      }
    }
  },

  loadProject: async () => {
    if (!window.vj) {
      get().toast('Apertura disponibile solo nell’app desktop', 'error');
      return;
    }
    const result = await window.vj.loadProject();
    if (!result?.canceled) {
      if (result?.data) {
        get().replaceProject(result.data);
        get().toast('Progetto aperto', 'success');
      } else if (result?.error) {
        get().toast('Apertura non riuscita', 'error');
      }
    }
  },
}));

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let lastAutosaveJson = '';
let autosaveInstalled = false;

export function installAutosave(): void {
  if (autosaveInstalled) return;
  autosaveInstalled = true;
  useAppStore.subscribe((state) => {
    const data = toProjectData(state);
    const json = JSON.stringify(data);
    if (json === lastAutosaveJson) return;
    lastAutosaveJson = json;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => writeAutosave(data), 500);
  });
}

export function getActiveLayer(state: AppStore): Layer | undefined {
  return state.decks[state.target.deck].layers[state.target.layerIndex];
}

export function getSelectedMedia(state: AppStore): MediaItem | null {
  if (!state.selectedMediaId) return null;
  return state.library.find((item) => item.id === state.selectedMediaId) ?? null;
}
