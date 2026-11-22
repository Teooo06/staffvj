export type DeckId = 'A' | 'B';
export type MediaKind = 'video' | 'image' | 'generator' | 'text' | 'browser';

export type GeneratorKind =
  | 'plasma'
  | 'aurora'
  | 'tunnel'
  | 'grid'
  | 'sunset'
  | 'noise'
  | 'testcard'
  | 'solid'
  | 'liquid'
  | 'rings'
  | 'orbit'
  | 'starfield'
  | 'fire'
  | 'mandala'
  | 'matrix';

export type BlendMode =
  | 'normal'
  | 'add'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'difference'
  | 'lighten'
  | 'darken';

export type FitMode = 'cover' | 'contain';

export type TextAnimation =
  | 'none'
  | 'scroll-left'
  | 'scroll-right'
  | 'pulse'
  | 'typewriter'
  | 'bounce';

export type EffectType =
  | 'color'
  | 'kaleido'
  | 'mirror'
  | 'pixelate'
  | 'rgbsplit'
  | 'wave'
  | 'ripple'
  | 'twist'
  | 'blur'
  | 'posterize'
  | 'edge'
  | 'scanlines'
  | 'grain'
  | 'vignette'
  | 'chroma'
  | 'lumakey'
  | 'invert'
  | 'strobe'
  | 'zoomblur'
  | 'glitch'
  | 'glow'
  | 'bounce';

export interface TextSettings {
  text: string;
  font: string;
  weight: number;
  size: number;
  color: string;
  align: 'left' | 'center' | 'right';
  x: number;
  y: number;
  animation: TextAnimation;
  speed: number;
  outline: boolean;
  outlineColor: string;
  background: boolean;
  backgroundOpacity: number;
  letterSpacing: number;
  uppercase: boolean;
}

export interface GeneratorSettings {
  speed: number;
  hue: number;
  intensity: number;
  color: string;
}

export interface MediaItem {
  id: string;
  name: string;
  kind: MediaKind;
  path?: string;
  /** URL of a remote browser source. Local HTML sources use path. */
  url?: string;
  generator?: GeneratorKind;
  gen?: GeneratorSettings;
  text?: TextSettings;
  width?: number;
  height?: number;
  duration?: number;
  size?: number;
  createdAt: number;
  /** Solo UI: non viene serializzato nel progetto né inviato all'output. */
  thumb?: string;
}

export interface MediaLayerSource {
  kind: 'media';
  mediaId: string;
  startedAt: number;
  playbackRate?: number;
  rangeStart?: number;
  rangeEnd?: number;
  seekAt?: number;
}

export interface CaptureLayerSource {
  kind: 'capture';
  deviceId: string;
  label: string;
  startedAt: number;
}

export interface NdiLayerSource {
  kind: 'ndi';
  sourceId: string;
  sourceName: string;
  urlAddress?: string;
  startedAt: number;
}

export interface NdiSourceInfo {
  id: string;
  name: string;
  urlAddress?: string;
}

export interface NdiStatus {
  available: boolean;
  version: string | null;
  error: string | null;
  outputEnabled: boolean;
  outputName: string;
  receiving: string[];
  streaming: string[];
}

export interface NdiFrame {
  sourceId: string;
  width: number;
  height: number;
  bytes: Uint8Array;
}

export type LayerSource = MediaLayerSource | CaptureLayerSource | NdiLayerSource;

export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface EffectInstance {
  id: string;
  type: EffectType;
  enabled: boolean;
  mix: number;
  audioReact: number;
  beatReact: number;
  beatSync: boolean;
  params: Record<string, number>;
}

export type EffectScope =
  | { kind: 'master' }
  | { kind: 'layer'; deck: DeckId; layerIndex: number };

export interface Layer {
  id: string;
  source: LayerSource | null;
  opacity: number;
  blend: BlendMode;
  fit: FitMode;
  transform: Transform;
  effects: EffectInstance[];
  fadeMs: number;
  visible: boolean;
}

export interface Deck {
  id: DeckId;
  layers: Layer[];
}

export interface Scene {
  id: string;
  name: string;
  /** A scene is a snapshot of one deck. Global crossfader and master stay outside it. */
  deck: Deck;
  /** Snapshot of media referenced by the deck, including browser source definitions. */
  media: MediaItem[];
  /** Small UI preview captured from the deck when the scene is saved. */
  thumbnail?: string;
  shortcut: string | null;
  shortcutLabel?: string;
  shortcutModifiers?: { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean };
  createdAt: number;
}

export interface AutopilotSettings {
  enabled: boolean;
  everyBeats: number;
  autoMix: boolean;
  autoFx: boolean;
}

export type BpmDetectorMode = 'mix' | 'bass' | 'hybrid';

export interface AudioSettings {
  enabled: boolean;
  deviceId: string | null;
  deviceLabel: string;
  sensitivity: number;
  autoBpm: boolean;
  detectorMode: BpmDetectorMode;
  beatThreshold: number;
  tempoResponse: number;
  minBpm: number;
  maxBpm: number;
}

export interface ProjectData {
  version: number;
  name: string;
  library: MediaItem[];
  decks: Record<DeckId, Deck>;
  scenes: Scene[];
  crossfade: number;
  masterOpacity: number;
  masterEffects: EffectInstance[];
  blackout: boolean;
  bpm: number;
  autopilot: AutopilotSettings;
  audio: AudioSettings;
  output: { displayId: number | null };
}

export interface ShowState {
  name: string;
  library: MediaItem[];
  decks: Record<DeckId, Deck>;
  crossfade: number;
  masterOpacity: number;
  masterEffects: EffectInstance[];
  blackout: boolean;
  bpm: number;
}

export interface TransportData {
  bpm: number;
  level: number;
  beatPulse: number;
  beatPosition: number;
  beatIndex: number;
  beatInBar: number;
  barNumber: number;
  lastBeatAt: number;
  barPhase: number;
  playing: boolean;
  audioConnected: boolean;
  audioRunning: boolean;
  beatDetected: boolean;
  estimatedBpm: number;
  beatConfidence: number;
  onsetGraph: number[];
  onsetMarkers: number[];
  waveform: number[];
  spectrum: number[];
}

export interface DisplayInfo {
  id: number;
  label: string;
  width: number;
  height: number;
  scaleFactor: number;
  primary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface ToastMessage {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

export interface ImportedFile {
  path: string;
  name: string;
  size: number;
  kind: 'video' | 'image';
}

export const BLEND_LABELS: Record<BlendMode, string> = {
  normal: 'Normale',
  add: 'Aggiungi',
  screen: 'Schermo',
  multiply: 'Moltiplica',
  overlay: 'Sovrapponi',
  difference: 'Differenza',
  lighten: 'Chiarisci',
  darken: 'Scurisci',
};

export const GENERATOR_LABELS: Record<GeneratorKind, string> = {
  plasma: 'Plasma',
  aurora: 'Aurora',
  tunnel: 'Tunnel',
  grid: 'Griglia',
  sunset: 'Tramonto',
  noise: 'Nuvole colorate',
  testcard: 'Test card',
  solid: 'Tinta unita',
  liquid: 'Liquido',
  rings: 'Anelli',
  orbit: 'Orbita',
  starfield: 'Campo stellare',
  fire: 'Fiamme',
  mandala: 'Mandala',
  matrix: 'Pioggia digitale',
};

export const GENERATOR_OPTIONS: GeneratorKind[] = [
  'plasma',
  'aurora',
  'tunnel',
  'grid',
  'noise',
  'testcard',
  'solid',
  'liquid',
  'rings',
  'orbit',
  'starfield',
  'fire',
  'mandala',
  'matrix',
];

export const DECK_LAYER_COUNT = 4;
