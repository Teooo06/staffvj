import type {
  Deck,
  DeckId,
  GeneratorKind,
  GeneratorSettings,
  ImportedFile,
  Layer,
  MediaItem,
  ProjectData,
  TextSettings,
} from './types';
import { DECK_LAYER_COUNT } from './types';
import { createEffectInstance } from './engine/effectDefs';
import { basenameNoExt, uid } from './lib/utils';

export const FONT_OPTIONS = [
  { value: 'Arial Black', label: 'Arial Black' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica Neue', label: 'Helvetica Neue' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Times New Roman', label: 'Times New Roman' },
];

export function defaultText(overrides: Partial<TextSettings> = {}): TextSettings {
  return {
    text: 'STAFFFESTE',
    font: 'Arial Black',
    weight: 900,
    size: 150,
    color: '#ffffff',
    align: 'center',
    x: 0.5,
    y: 0.5,
    animation: 'none',
    speed: 1,
    outline: false,
    outlineColor: '#000000',
    background: false,
    backgroundOpacity: 0.35,
    letterSpacing: 0,
    uppercase: true,
    ...overrides,
  };
}

export function defaultGenerator(kind: GeneratorKind): GeneratorSettings {
  const presets: Record<GeneratorKind, Partial<GeneratorSettings>> = {
    plasma: { speed: 0.8, hue: 0.12, intensity: 1, color: '#c8ff2e' },
    aurora: { speed: 0.55, hue: 0.55, intensity: 1, color: '#4de1ff' },
    tunnel: { speed: 0.7, hue: 0.72, intensity: 1, color: '#ff3ea5' },
    grid: { speed: 0.9, hue: 0.3, intensity: 0.9, color: '#c8ff2e' },
    sunset: { speed: 0.4, hue: 0.08, intensity: 1, color: '#ff9a3e' },
    noise: { speed: 1.3, hue: 0.5, intensity: 1, color: '#ffffff' },
    testcard: { speed: 1, hue: 0, intensity: 1, color: '#ffffff' },
    solid: { speed: 0.6, hue: 0.25, intensity: 1, color: '#c8ff2e' },
    liquid: { speed: 0.55, hue: 0.52, intensity: 1, color: '#37e6cf' },
    rings: { speed: 0.75, hue: 0.88, intensity: 1, color: '#ff3ea5' },
    orbit: { speed: 0.7, hue: 0.16, intensity: 1, color: '#c8ff2e' },
    starfield: { speed: 0.7, hue: 0.56, intensity: 1, color: '#66d9ff' },
    fire: { speed: 0.55, hue: 0.02, intensity: 1, color: '#ff9c32' },
    mandala: { speed: 0.35, hue: 0.82, intensity: 1, color: '#ff4fd8' },
    matrix: { speed: 0.65, hue: 0.31, intensity: 1, color: '#7dff6b' },
  };
  return {
    speed: 1,
    hue: 0,
    intensity: 1,
    color: '#ffffff',
    ...presets[kind],
  };
}

export function makeTextItem(overrides: Partial<MediaItem> = {}, text: Partial<TextSettings> = {}): MediaItem {
  return {
    id: uid('media'),
    name: text.text?.split('\n')[0]?.slice(0, 24) || 'Testo',
    kind: 'text',
    text: defaultText(text),
    createdAt: Date.now(),
    ...overrides,
  };
}

export function makeGeneratorItem(
  generator: GeneratorKind,
  displayName: string,
  genOverrides: Partial<GeneratorSettings> = {},
): MediaItem {
  return {
    id: uid('media'),
    name: displayName,
    kind: 'generator',
    generator,
    gen: { ...defaultGenerator(generator), ...genOverrides },
    createdAt: Date.now(),
  };
}

export function makeFileItem(file: ImportedFile): MediaItem {
  return {
    id: uid('media'),
    name: basenameNoExt(file.name),
    kind: file.kind,
    path: file.path,
    size: file.size,
    createdAt: Date.now(),
  };
}

export function makeBrowserItem(source: { name: string; url?: string; path?: string }): MediaItem {
  return {
    id: uid('browser'),
    name: source.name,
    kind: 'browser',
    path: source.path,
    url: source.url,
    createdAt: Date.now(),
  };
}

export function createLayer(): Layer {
  return {
    id: uid('layer'),
    source: null,
    opacity: 1,
    blend: 'normal',
    fit: 'cover',
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    effects: [],
    fadeMs: 260,
    visible: true,
  };
}

export function createDeck(id: DeckId): Deck {
  return {
    id,
    layers: Array.from({ length: DECK_LAYER_COUNT }, () => createLayer()),
  };
}

function mediaSource(mediaId: string) {
  return { kind: 'media' as const, mediaId, startedAt: 0 };
}

export function createDemoProject(): ProjectData {
  const now = Date.now();
  const plasma = makeGeneratorItem('plasma', 'Plasma');
  const aurora = makeGeneratorItem('aurora', 'Aurora');
  const tunnel = makeGeneratorItem('tunnel', 'Tunnel');
  const grid = makeGeneratorItem('grid', 'Griglia');
  const liquid = makeGeneratorItem('liquid', 'Liquido');
  const rings = makeGeneratorItem('rings', 'Anelli');
  const orbit = makeGeneratorItem('orbit', 'Orbita');
  const stars = makeGeneratorItem('starfield', 'Campo stellare');
  const testcard = makeGeneratorItem('testcard', 'Test card');
  const title = makeTextItem(
    {
      name: 'STAFFFESTE',
      createdAt: now + 8,
    },
    {
      text: 'STAFFFESTE',
      size: 158,
      color: '#ffffff',
      y: 0.47,
      animation: 'pulse',
      speed: 0.55,
      letterSpacing: 2,
    },
  );
  const claim = makeTextItem(
    {
      name: 'Ci vediamo in pista',
      createdAt: now + 9,
    },
    {
      text: 'CI VEDIAMO\nIN PISTA',
      size: 108,
      color: '#c8ff2e',
      y: 0.74,
      animation: 'none',
      letterSpacing: 6,
    },
  );

  const library = [plasma, aurora, tunnel, grid, liquid, rings, orbit, stars, testcard, title, claim];

  const deckA = createDeck('A');
  deckA.layers[2] = {
    ...deckA.layers[2],
    source: mediaSource(plasma.id),
    opacity: 0.94,
  };
  deckA.layers[1] = {
    ...deckA.layers[1],
    source: mediaSource(grid.id),
    opacity: 0.1,
    blend: 'screen',
  };
  deckA.layers[0] = {
    ...deckA.layers[0],
    source: mediaSource(title.id),
    opacity: 1,
  };

  const deckB = createDeck('B');
  deckB.layers[2] = {
    ...deckB.layers[2],
    source: mediaSource(tunnel.id),
    opacity: 1,
  };
  deckB.layers[1] = {
    ...deckB.layers[1],
    source: mediaSource(rings.id),
    opacity: 0.24,
    blend: 'screen',
  };
  deckB.layers[0] = {
    ...deckB.layers[0],
    source: mediaSource(claim.id),
    opacity: 1,
  };

  const vignette = createEffectInstance('vignette');
  vignette.mix = 0.45;
  vignette.params.amount = 0.6;
  vignette.params.radius = 0.3;

  return {
    version: 2,
    name: 'Stafffeste Live',
    library,
    decks: { A: deckA, B: deckB },
    scenes: [],
    crossfade: 0,
    masterOpacity: 1,
    masterEffects: [vignette],
    blackout: false,
    bpm: 124,
    autopilot: {
      enabled: false,
      everyBeats: 16,
      autoMix: false,
      autoFx: false,
    },
    audio: {
      enabled: false,
      deviceId: null,
      deviceLabel: 'Nessun ingresso',
      sensitivity: 1,
      autoBpm: true,
      detectorMode: 'bass',
      beatThreshold: 0.85,
      tempoResponse: 0.42,
      minBpm: 60,
      maxBpm: 200,
    },
    output: {
      displayId: null,
    },
  };
}
