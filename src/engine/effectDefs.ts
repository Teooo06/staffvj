import type { EffectInstance, EffectType } from '../types';
import { uid } from '../lib/utils';

export type EffectCategory =
  | 'Colore'
  | 'Distorsione'
  | 'Stile'
  | 'Glitch'
  | 'Chiave'
  | 'Master';

export interface EffectParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step: number;
  unit?: string;
}

export interface EffectDef {
  type: EffectType;
  name: string;
  category: EffectCategory;
  description: string;
  params: EffectParamDef[];
  tempoSync?: boolean;
  defaultBeatSync?: boolean;
  body: string;
}

export const MAX_EFFECTS = 4;

const HELPERS = `
float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 rot2(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c) * p;
}
vec3 hueRotate(vec3 color, float angle) {
  const vec3 k = vec3(0.577350269);
  float c = cos(angle);
  float s = sin(angle);
  return color * c + cross(k, color) * s + k * dot(k, color) * (1.0 - c);
}
`;

export const EFFECT_DEFS: EffectDef[] = [
  {
    type: 'color',
    name: 'Correzione colore',
    category: 'Colore',
    description: 'Regola colore, intensità e contrasto senza cambiare la forma dell’immagine.',
    params: [
      { key: 'hue', label: 'Tonalità', min: -1, max: 1, default: 0, step: 0.01 },
      { key: 'sat', label: 'Saturazione', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'bright', label: 'Luminosità', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'contrast', label: 'Contrasto', min: 0, max: 2, default: 1, step: 0.01 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  vec3 c = src.rgb;
  float l = luma(c);
  c = mix(vec3(l), c, u_p1);
  c *= u_p2;
  c = (c - 0.5) * u_p3 + 0.5;
  c = hueRotate(c, u_p0 * 6.2831853);
  return vec4(clamp(c, 0.0, 1.0), src.a);
}`,
  },
  {
    type: 'kaleido',
    name: 'Caleidoscopio',
    category: 'Distorsione',
    description: 'Ripete l’immagine a spicchi, come in un caleidoscopio.',
    params: [
      { key: 'segments', label: 'Settori', min: 2, max: 16, default: 6, step: 1 },
      { key: 'rotation', label: 'Rotazione', min: 0, max: 1, default: 0, step: 0.005 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  float aspect = u_res.x / max(1.0, u_res.y);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x) + u_p1 * 6.2831853;
  float seg = 6.2831853 / max(2.0, floor(u_p0 + 0.5));
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  vec2 q = vec2(cos(a), sin(a)) * r;
  q.x /= aspect;
  q += 0.5;
  return texture(u_tex, clamp(q, 0.002, 0.998));
}`,
  },
  {
    type: 'mirror',
    name: 'Specchio',
    category: 'Distorsione',
    description: 'Ribalta la scena in orizzontale, in verticale o in quattro quadranti.',
    params: [
      { key: 'mode', label: 'Modo', min: 0, max: 2, default: 0, step: 1 },
      { key: 'zoom', label: 'Zoom', min: 0.2, max: 2, default: 1, step: 0.01 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  vec2 q = uv;
  float mode = u_p0;
  if (mode < 0.5) {
    q.x = abs(q.x * 2.0 - 1.0);
  } else if (mode < 1.5) {
    q.y = abs(q.y * 2.0 - 1.0);
  } else {
    q.x = abs(q.x * 2.0 - 1.0);
    q.y = abs(q.y * 2.0 - 1.0);
  }
  q = (q - 0.5) / max(0.2, u_p1) + 0.5;
  return texture(u_tex, clamp(q, 0.002, 0.998));
}`,
  },
  {
    type: 'pixelate',
    name: 'Pixel',
    category: 'Stile',
    description: 'Trasforma l’immagine in blocchi grandi: alza Dimensione per un effetto più marcato.',
    params: [{ key: 'size', label: 'Dimensione', min: 2, max: 160, default: 24, step: 1, unit: 'px' }],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  vec2 cells = u_res / max(2.0, u_p0);
  vec2 q = (floor(uv * cells) + 0.5) / cells;
  return texture(u_tex, q);
}`,
  },
  {
    type: 'rgbsplit',
    name: 'Scomposizione RGB',
    category: 'Glitch',
    description: 'Sposta rosso e blu in direzioni opposte creando bordi colorati.',
    params: [
      { key: 'amount', label: 'Distanza', min: 0, max: 0.08, default: 0.008, step: 0.0005 },
      { key: 'angle', label: 'Angolo', min: 0, max: 1, default: 0, step: 0.005 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  float ang = u_p1 * 6.2831853;
  vec2 offset = vec2(cos(ang), sin(ang)) * max(0.0, u_p0);
  vec4 base = texture(u_tex, uv);
  float r = texture(u_tex, uv + offset).r;
  float b = texture(u_tex, uv - offset).b;
  return vec4(r, base.g, b, base.a);
}`,
  },
  {
    type: 'wave',
    name: 'Onda',
    category: 'Distorsione',
    description: 'Fa ondeggiare la scena: Ampiezza controlla quanto si deforma.',
    tempoSync: true,
    params: [
      { key: 'amp', label: 'Ampiezza', min: 0, max: 0.1, default: 0.02, step: 0.001 },
      { key: 'freq', label: 'Frequenza', min: 1, max: 40, default: 8, step: 0.1 },
      { key: 'speed', label: 'Velocità', min: 0, max: 4, default: 1, step: 0.01 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  vec2 q = uv;
  q.x += sin(uv.y * max(1.0, u_p1) + u_time * u_p2) * u_p0;
  q.y += cos(uv.x * max(1.0, u_p1) * 0.83 + u_time * u_p2 * 1.27) * u_p0 * 0.6;
  return texture(u_tex, clamp(q, 0.002, 0.998));
}`,
  },
  {
    type: 'ripple',
    name: 'Ripple',
    category: 'Distorsione',
    description: 'Crea increspature circolari che si allargano dal centro.',
    tempoSync: true,
    params: [
      { key: 'strength', label: 'Forza', min: 0, max: 0.08, default: 0.015, step: 0.001 },
      { key: 'freq', label: 'Frequenza', min: 5, max: 80, default: 30, step: 0.5 },
      { key: 'speed', label: 'Velocità', min: 0, max: 3, default: 1, step: 0.01 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  vec2 p = uv - 0.5;
  float d = length(p);
  float w = sin(d * u_p1 - u_time * u_p2 * 3.0) * u_p0;
  vec2 q = uv + normalize(p + vec2(0.0001)) * w;
  return texture(u_tex, clamp(q, 0.002, 0.998));
}`,
  },
  {
    type: 'twist',
    name: 'Vortice',
    category: 'Distorsione',
    description: 'Ruota l’immagine verso il centro, come un vortice.',
    params: [
      { key: 'amount', label: 'Rotazione', min: -4, max: 4, default: 1.2, step: 0.01 },
      { key: 'radius', label: 'Raggio', min: 0.05, max: 1.2, default: 0.6, step: 0.01 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  vec2 p = uv - 0.5;
  float d = length(p);
  float angle = u_p0 * (1.0 - smoothstep(0.0, max(0.01, u_p1), d));
  vec2 q = rot2(p, angle) + 0.5;
  return texture(u_tex, clamp(q, 0.002, 0.998));
}`,
  },
  {
    type: 'blur',
    name: 'Sfocatura',
    category: 'Stile',
    description: 'Ammorbidisce l’immagine; aumenta Raggio per una sfocatura più evidente.',
    params: [{ key: 'radius', label: 'Raggio', min: 0, max: 0.02, default: 0.003, step: 0.0002 }],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = -3; i <= 3; i++) {
    for (int j = -3; j <= 3; j++) {
      float w = exp(-float(i * i + j * j) / 7.0);
      sum += texture(u_tex, clamp(uv + vec2(float(i), float(j)) * u_p0, 0.0, 1.0)) * w;
      total += w;
    }
  }
  return sum / total;
}`,
  },
  {
    type: 'posterize',
    name: 'Poster',
    category: 'Stile',
    description: 'Riduce le sfumature a pochi colori, come un poster stampato.',
    params: [{ key: 'levels', label: 'Livelli', min: 2, max: 32, default: 6, step: 1 }],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  float levels = max(2.0, floor(u_p0 + 0.5));
  vec3 c = floor(src.rgb * (levels - 1.0) + 0.5) / (levels - 1.0);
  return vec4(clamp(c, 0.0, 1.0), src.a);
}`,
  },
  {
    type: 'edge',
    name: 'Bordi',
    category: 'Stile',
    description: 'Mostra i contorni degli oggetti con un look da disegno al neon.',
    params: [
      { key: 'thickness', label: 'Spessore', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'gain', label: 'Gain', min: 0, max: 5, default: 1.4, step: 0.01 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  vec2 px = (1.0 + u_p0 * 3.0) / u_res;
  float tl = luma(texture(u_tex, clamp(uv + vec2(-px.x, -px.y), 0.0, 1.0)).rgb);
  float tc = luma(texture(u_tex, clamp(uv + vec2(0.0, -px.y), 0.0, 1.0)).rgb);
  float tr = luma(texture(u_tex, clamp(uv + vec2(px.x, -px.y), 0.0, 1.0)).rgb);
  float ml = luma(texture(u_tex, clamp(uv + vec2(-px.x, 0.0), 0.0, 1.0)).rgb);
  float mr = luma(texture(u_tex, clamp(uv + vec2(px.x, 0.0), 0.0, 1.0)).rgb);
  float bl = luma(texture(u_tex, clamp(uv + vec2(-px.x, px.y), 0.0, 1.0)).rgb);
  float bc = luma(texture(u_tex, clamp(uv + vec2(0.0, px.y), 0.0, 1.0)).rgb);
  float br = luma(texture(u_tex, clamp(uv + vec2(px.x, px.y), 0.0, 1.0)).rgb);
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float g = clamp(length(vec2(gx, gy)) * u_p1, 0.0, 1.0);
  return vec4(vec3(g), src.a);
}`,
  },
  {
    type: 'scanlines',
    name: 'Scanline',
    category: 'Stile',
    description: 'Aggiunge righe orizzontali da vecchio monitor, con scorrimento opzionale.',
    tempoSync: true,
    params: [
      { key: 'count', label: 'Linee', min: 60, max: 1200, default: 540, step: 1 },
      { key: 'intensity', label: 'Intensità', min: 0, max: 1, default: 0.3, step: 0.01 },
      { key: 'speed', label: 'Scorrimento', min: 0, max: 4, default: 0.5, step: 0.01 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  float m = 0.5 + 0.5 * sin(uv.y * max(10.0, u_p0) * 6.2831853 + u_time * u_p2 * 3.0);
  vec3 c = src.rgb * (1.0 - u_p1 * (1.0 - m));
  return vec4(c, src.a);
}`,
  },
  {
    type: 'grain',
    name: 'Grana',
    category: 'Stile',
    description: 'Sovrappone una grana luminosa in movimento, come pellicola analogica.',
    tempoSync: true,
    params: [
      { key: 'amount', label: 'Quantità', min: 0, max: 0.6, default: 0.12, step: 0.01 },
      { key: 'speed', label: 'Velocità', min: 0, max: 5, default: 1, step: 0.01 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  float frame = floor(u_time * max(0.0, u_p1) * 8.0);
  float n = hash21(floor(uv * u_res) + vec2(frame, frame * 0.73));
  vec3 c = clamp(src.rgb + (n - 0.5) * u_p0, 0.0, 1.0);
  return vec4(c, src.a);
}`,
  },
  {
    type: 'vignette',
    name: 'Vignettatura',
    category: 'Stile',
    description: 'Scurisce gli angoli e lascia in evidenza il centro dell’immagine.',
    params: [
      { key: 'amount', label: 'Intensità', min: 0, max: 1, default: 0.65, step: 0.01 },
      { key: 'radius', label: 'Raggio', min: 0, max: 0.95, default: 0.35, step: 0.01 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  vec2 p = uv - 0.5;
  float d = length(p) * 1.41421356;
  float edge = smoothstep(clamp(u_p1, 0.0, 0.99), 1.25, d);
  vec3 c = src.rgb * (1.0 - edge * u_p0);
  return vec4(c, src.a);
}`,
  },
  {
    type: 'chroma',
    name: 'Chroma key',
    category: 'Chiave',
    description: 'Rende trasparenti le zone verdi: utile con un fondale verde uniforme.',
    params: [
      { key: 'threshold', label: 'Soglia', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'smooth', label: 'Morbidezza', min: 0.01, max: 0.4, default: 0.15, step: 0.005 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  vec3 key = vec3(0.05, 0.95, 0.10);
  float dist = distance(src.rgb, key);
  float mask = smoothstep(u_p0, u_p0 + max(0.001, u_p1), dist);
  return vec4(src.rgb, src.a * mask);
}`,
  },
  {
    type: 'lumakey',
    name: 'Luma key',
    category: 'Chiave',
    description: 'Rende trasparenti le zone scure, utile per sovrapporre loghi chiari.',
    params: [
      { key: 'threshold', label: 'Soglia', min: 0, max: 1, default: 0.12, step: 0.005 },
      { key: 'smooth', label: 'Morbidezza', min: 0.01, max: 0.5, default: 0.12, step: 0.005 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  float l = luma(src.rgb);
  float mask = smoothstep(u_p0, u_p0 + max(0.001, u_p1), l);
  return vec4(src.rgb, src.a * mask);
}`,
  },
  {
    type: 'invert',
    name: 'Inverti',
    category: 'Colore',
    description: 'Inverte tutti i colori per un negativo immediato.',
    params: [],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  return vec4(1.0 - src.rgb, src.a);
}`,
  },
  {
    type: 'strobe',
    name: 'Strobe',
    category: 'Master',
    description: 'Fa lampeggiare l’intera uscita. Usalo con intensità moderata.',
    tempoSync: true,
    defaultBeatSync: true,
    params: [
      { key: 'rate', label: 'Frequenza', min: 0.5, max: 20, default: 5, step: 0.1, unit: 'Hz' },
      { key: 'duty', label: 'Durata', min: 0.02, max: 0.8, default: 0.18, step: 0.01 },
      { key: 'mode', label: 'Modo', min: 0, max: 2, default: 0, step: 1 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  float on = step(fract(u_time * max(0.1, u_p0)), clamp(u_p1, 0.01, 0.95));
  vec3 c = src.rgb;
  if (u_p2 < 0.5) {
    c = mix(src.rgb, vec3(1.0), on);
  } else if (u_p2 < 1.5) {
    c = src.rgb * (1.0 - on);
  } else {
    c = mix(src.rgb, 1.0 - src.rgb, on);
  }
  return vec4(c, src.a);
}`,
  },
  {
    type: 'zoomblur',
    name: 'Zoom blur',
    category: 'Distorsione',
    description: 'Stira l’immagine dal centro verso i bordi, come uno zoom rapido.',
    params: [{ key: 'strength', label: 'Forza', min: 0, max: 0.6, default: 0.1, step: 0.005 }],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  vec2 dir = uv - 0.5;
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 12; i++) {
    float t = float(i) / 11.0;
    sum += texture(u_tex, clamp(uv - dir * (t * u_p0), 0.0, 1.0));
  }
  return sum / 12.0;
}`,
  },
  {
    type: 'glitch',
    name: 'Glitch',
    category: 'Glitch',
    description: 'Scompone la scena in bande che slittano, per un glitch digitale.',
    tempoSync: true,
    params: [
      { key: 'amount', label: 'Quantità', min: 0, max: 0.2, default: 0.04, step: 0.002 },
      { key: 'speed', label: 'Velocità', min: 0, max: 4, default: 1.2, step: 0.01 },
      { key: 'slices', label: 'Bande', min: 4, max: 48, default: 18, step: 1 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  float slices = max(4.0, floor(u_p2 + 0.5));
  float band = floor(uv.y * slices);
  float seed = floor(u_time * max(0.1, u_p1) * 8.0);
  float n = hash21(vec2(band, seed));
  float activeSlice = step(0.62, n);
  vec2 q = uv;
  q.x = fract(q.x + (n - 0.5) * u_p0 * activeSlice);
  vec4 c = texture(u_tex, q);
  vec3 shifted = c.rgb;
  if (activeSlice > 0.5) {
    shifted.r = texture(u_tex, fract(q + vec2(u_p0 * 0.35, 0.0))).r;
    shifted.b = texture(u_tex, fract(q - vec2(u_p0 * 0.35, 0.0))).b;
  }
  return vec4(shifted, c.a);
}`,
  },
  {
    type: 'glow',
    name: 'Glow',
    category: 'Stile',
    description: 'Aggiunge un alone alle parti luminose, come luci che brillano.',
    params: [
      { key: 'threshold', label: 'Soglia', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'radius', label: 'Raggio', min: 0, max: 64, default: 18, step: 0.5, unit: 'px' },
      { key: 'intensity', label: 'Intensità', min: 0, max: 2, default: 1, step: 0.01 },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  vec3 glow = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 16; i++) {
    float ang = float(i) * 2.39996323;
    float radius = (1.0 + mod(float(i), 4.0)) * max(0.0, u_p1);
    vec2 off = vec2(cos(ang), sin(ang)) * radius / u_res;
    vec3 s = texture(u_tex, clamp(uv + off, 0.0, 1.0)).rgb;
    float bright = max(0.0, luma(s) - u_p0);
    glow += s * bright;
    total += bright;
  }
  vec3 c = src.rgb + glow * (u_p2 / max(1.0, total));
  return vec4(c, src.a);
}`,
  },
  {
    type: 'bounce',
    name: 'Bounce',
    category: 'Stile',
    description: 'Dà un impulso di zoom e movimento sul battito.',
    tempoSync: true,
    defaultBeatSync: true,
    params: [
      { key: 'amount', label: 'Ampiezza', min: 0, max: 1, default: 0.2, step: 0.01 },
      { key: 'rate', label: 'Frequenza', min: 0.1, max: 20, default: 2, step: 0.1, unit: 'Hz' },
    ],
    body: `
vec4 effect(vec2 uv, vec4 src) {
  float phase = fract(u_time * max(0.1, u_p1));
  float impact = exp(-phase * 5.0);
  float bounce = sin(phase * 6.2831853 * 1.5) * exp(-phase * 4.0);
  float scale = 1.0 - impact * u_p0 * 0.08 + bounce * u_p0 * 0.16;
  vec2 scaledUV = (uv - 0.5) / max(0.5, scale) + 0.5;
  scaledUV.y -= bounce * u_p0 * 0.055;
  vec4 c = texture(u_tex, clamp(scaledUV, 0.0, 1.0));
  return c;
}`,
  },
];

export const EFFECT_MAP = new Map<EffectType, EffectDef>(EFFECT_DEFS.map((def) => [def.type, def]));

export const EFFECT_CATEGORIES: EffectCategory[] = [
  'Colore',
  'Distorsione',
  'Stile',
  'Glitch',
  'Chiave',
  'Master',
];

export function getEffectDef(type: EffectType): EffectDef {
  const def = EFFECT_MAP.get(type);
  if (!def) throw new Error(`Effetto sconosciuto: ${type}`);
  return def;
}

export function createEffectInstance(type: EffectType): EffectInstance {
  const def = getEffectDef(type);
  const params: Record<string, number> = {};
  for (const param of def.params) params[param.key] = param.default;
  return {
    id: uid('fx'),
    type,
    enabled: true,
    mix: 1,
    audioReact: 0,
    beatReact: 0,
    beatSync: def.defaultBeatSync ?? false,
    params,
  };
}

export function buildEffectShader(def: EffectDef): string {
  return `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time;
uniform float u_mix;
uniform float u_audio;
uniform float u_beat;
uniform float u_p0;
uniform float u_p1;
uniform float u_p2;
uniform float u_p3;
${HELPERS}
${def.body}
void main() {
  vec4 src = texture(u_tex, v_uv);
  vec4 fx = effect(v_uv, src);
  float react = clamp(u_audio * 0.9 + u_beat, 0.0, 2.0);
  fx.rgb = clamp(fx.rgb * (1.0 + react * 0.45), 0.0, 1.0);
  fx.a = clamp(fx.a, 0.0, 1.0);
  outColor = mix(src, fx, clamp(u_mix, 0.0, 1.0));
}
`;
}
