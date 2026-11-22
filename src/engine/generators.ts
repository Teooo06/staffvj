import type { GeneratorKind } from '../types';

const COMMON = `
float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += valueNoise(p) * amplitude;
    p = p * 2.03 + 17.1;
    amplitude *= 0.5;
  }
  return value;
}
vec3 hueRotate(vec3 color, float angle) {
  const vec3 k = vec3(0.577350269);
  float c = cos(angle);
  float s = sin(angle);
  return color * c + cross(k, color) * s + k * dot(k, color) * (1.0 - c);
}
`;

const BODIES: Record<GeneratorKind, string> = {
  plasma: `
vec3 generate(vec2 uv, float t) {
  vec2 p = uv * 2.0 - 1.0;
  float v = sin(p.x * 3.0 + t * 1.2)
          + sin(p.y * 4.0 - t * 0.9)
          + sin((p.x + p.y) * 2.5 + t * 1.4)
          + sin(length(p) * 5.0 - t * 1.7);
  vec3 c = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + v * 1.35 + vec3(0.6, 0.0, 0.2));
  c = mix(c, u_color, 0.07);
  c *= 0.55 + 0.45 * (1.0 - length(p) * 0.5);
  return c;
}`,
  aurora: `
vec3 generate(vec2 uv, float t) {
  float n = sin(uv.x * 3.0 + t * 0.6 + sin(uv.y * 3.0 + t * 0.4) * 1.6);
  float band = smoothstep(0.1, 0.9, n * 0.5 + 0.5);
  vec3 deep = vec3(0.01, 0.02, 0.06);
  vec3 teal = vec3(0.05, 0.85, 0.7);
  vec3 pink = vec3(0.9, 0.15, 0.65);
  vec3 c = mix(deep, teal, band);
  c = mix(c, pink, smoothstep(0.45, 1.0, uv.y + 0.18 * sin(t * 0.8 + uv.x * 5.0)));
  c += vec3(0.06, 0.16, 0.18) * (1.0 - uv.y);
  c *= 0.4 + 0.8 * pow(1.0 - uv.y * 0.6, 1.4);
  c += vec3(0.9) * smoothstep(0.985, 1.0, hash21(floor(uv * u_res * 0.6))) * 0.35;
  return c;
}`,
  tunnel: `
vec3 generate(vec2 uv, float t) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_res.x / u_res.y;
  float r = length(p) + 0.0001;
  float a = atan(p.y, p.x);
  float rings = sin(1.2 / r * 2.5 - t * 2.2 + a * 2.0);
  float g = smoothstep(-0.25, 0.95, rings);
  vec3 c = mix(vec3(0.015, 0.0, 0.055), vec3(1.0, 0.08, 0.55), g);
  c += vec3(0.05, 0.55, 1.0) * smoothstep(0.8, 1.05, 1.0 - r) * 0.5;
  c *= 1.0 - smoothstep(0.75, 1.35, r);
  return c;
}`,
  grid: `
vec3 generate(vec2 uv, float t) {
  float horizon = 0.34;
  float groundY = 1.0 - uv.y;
  vec3 sky = mix(vec3(0.015, 0.02, 0.05), vec3(0.02, 0.12, 0.08), smoothstep(0.0, horizon, groundY));
  float z = max(0.06, groundY - horizon);
  float gx = abs(fract(uv.x * 14.0 * z + 0.5) - 0.5);
  float gy = abs(fract((groundY - horizon) * 32.0 * z - t * 0.55) - 0.5);
  float lineX = 1.0 - smoothstep(0.0, 0.045, gx);
  float lineY = 1.0 - smoothstep(0.0, 0.055, gy);
  float depth = smoothstep(horizon, 1.0, groundY);
  vec3 floorCol = vec3(0.75, 1.0, 0.2) * (lineX + lineY * 0.8) * smoothstep(horizon, horizon + 0.08, groundY);
  floorCol += vec3(0.01, 0.08, 0.03) * depth;
  vec3 c = groundY < horizon + 0.005 ? sky : floorCol * (0.6 + 0.4 * depth);
  c += vec3(0.4, 1.0, 0.3) * 0.35 * exp(-abs(groundY - horizon) * 90.0);
  return c;
}`,
  sunset: `
vec3 generate(vec2 uv, float t) {
  vec3 sky = mix(vec3(0.06, 0.02, 0.14), vec3(0.95, 0.28, 0.16), pow(uv.y, 1.35));
  float sun = 1.0 - smoothstep(0.0, 0.23, distance(uv, vec2(0.5, 0.4)));
  vec3 sunCol = vec3(1.0, 0.72, 0.25) * sun;
  float stripes = (1.0 - smoothstep(0.25, 0.35, uv.y)) * smoothstep(0.15, 0.45, sin(uv.y * 38.0 - t * 1.2) * 0.5 + 0.5);
  vec3 c = sky + sunCol * 0.85;
  c -= stripes * 0.18 * (1.0 - smoothstep(0.0, 0.42, distance(uv, vec2(0.5, 0.4))));
  c += vec3(0.25, 0.05, 0.2) * exp(-abs(uv.y - 0.42) * 14.0) * 0.25;
  float ridge = 0.18 + 0.05 * sin(uv.x * 7.0) + 0.025 * sin(uv.x * 17.0 + 2.0);
  c = mix(c, vec3(0.015, 0.01, 0.03), step(uv.y, ridge));
  return c;
}`,
  noise: `
vec3 generate(vec2 uv, float t) {
  vec2 p = uv * 4.2;
  float warpA = fbm(p + vec2(t * 0.62, -t * 0.44));
  float warpB = fbm(p + vec2(4.7 - t * 0.38, 2.3 + t * 0.52));
  float cloud = fbm(p + vec2(warpA, warpB) * 2.2);
  float glow = smoothstep(0.32, 0.78, cloud);
  vec3 c = mix(vec3(0.015, 0.018, 0.08), vec3(0.04, 0.82, 0.72), glow);
  c = mix(c, vec3(0.92, 0.08, 0.54), smoothstep(0.58, 0.9, cloud));
  c += vec3(0.2, 0.18, 0.55) * smoothstep(0.22, 0.48, cloud);
  c = mix(c, u_color, 0.12);
  return c;
}`,
  testcard: `
vec3 generate(vec2 uv, float t) {
  float bar = floor(uv.x * 8.0);
  vec3 c;
  if (bar < 1.0) c = vec3(0.95);
  else if (bar < 2.0) c = vec3(0.95, 0.95, 0.1);
  else if (bar < 3.0) c = vec3(0.1, 0.95, 0.95);
  else if (bar < 4.0) c = vec3(0.1, 0.95, 0.1);
  else if (bar < 5.0) c = vec3(0.95, 0.1, 0.95);
  else if (bar < 6.0) c = vec3(0.95, 0.1, 0.1);
  else if (bar < 7.0) c = vec3(0.1, 0.1, 0.95);
  else c = vec3(0.05);
  if (uv.y < 0.2) {
    float sub = floor(uv.x * 16.0);
    c = mix(vec3(0.02), vec3(0.8), mod(sub, 2.0));
  }
  if (uv.y > 0.2 && uv.y < 0.27) c = mix(vec3(1.0), u_color, 0.3);
  float scan = 1.0 - smoothstep(0.0, 0.035, abs(uv.y - fract(t * 0.08 + 0.2)));
  c += scan * 0.35;
  c *= 1.0 - 0.3 * length(uv - 0.5);
  return c;
}`,
  solid: `
vec3 generate(vec2 uv, float t) {
  float pulse = 0.82 + 0.18 * sin(t * 2.0);
  vec3 c = u_color * pulse;
  c *= 0.7 + 0.3 * (1.0 - length(uv - 0.5));
  return c;
}`,
  liquid: `
vec3 generate(vec2 uv, float t) {
  vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  vec2 warp = vec2(
    sin(p.y * 4.2 + t * 1.2) + cos(p.x * 2.7 - t * 0.8),
    cos(p.x * 3.6 + t) - sin(p.y * 2.4 - t * 0.7)
  ) * 0.24;
  vec2 q = p * 3.2 + warp;
  float bands = sin(length(q) * 3.6 - t * 2.1 + atan(q.y, q.x) * 1.6);
  float contour = 0.5 + 0.5 * bands;
  vec3 c = mix(vec3(0.012, 0.025, 0.09), vec3(0.05, 0.82, 0.68), smoothstep(0.16, 0.62, contour));
  c = mix(c, vec3(0.9, 0.07, 0.48), smoothstep(0.62, 0.98, contour));
  c += vec3(0.18, 0.5, 1.0) * pow(max(0.0, 1.0 - abs(bands)), 10.0) * 0.55;
  return mix(c, u_color, 0.12);
}`,
  rings: `
vec3 generate(vec2 uv, float t) {
  vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float wave = sin(radius * 48.0 - t * 3.4 + sin(angle * 5.0 + t) * 2.0);
  float ring = exp(-abs(wave) * 2.7) * (1.0 - smoothstep(0.72, 1.05, radius));
  float spokes = pow(max(0.0, cos(angle * 12.0 + t * 0.7)), 18.0);
  vec3 palette = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + radius * 5.0 - t * 0.5);
  vec3 c = vec3(0.012, 0.012, 0.035) + palette * ring * 1.25;
  c += vec3(0.25, 0.9, 1.0) * spokes * ring * 0.7;
  return mix(c, u_color, 0.1);
}`,
  orbit: `
vec3 generate(vec2 uv, float t) {
  vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float ring = exp(-abs(sin(radius * 34.0 - t * 2.0)) * 9.0) * 0.38;
  float nodes = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float a = t * (0.5 + fi * 0.09) + fi * 1.5708;
    vec2 point = vec2(cos(a), sin(a)) * (0.24 + 0.07 * mod(fi, 2.0));
    float d = length(p - point);
    nodes += exp(-d * 42.0);
  }
  float sweep = pow(max(0.0, cos(angle - t * 0.8)), 18.0) * (1.0 - smoothstep(0.05, 0.8, radius));
  vec3 c = vec3(0.008, 0.014, 0.04) + vec3(0.08, 0.55, 1.0) * ring;
  c += vec3(1.0, 0.12, 0.62) * nodes + vec3(0.25, 1.0, 0.62) * sweep * 0.5;
  c *= 0.72 + 0.28 * (1.0 - smoothstep(0.1, 0.85, radius));
  return mix(c, u_color, 0.1);
}`,
  starfield: `
vec3 generate(vec2 uv, float t) {
  vec2 p = uv - 0.5;
  p.x *= u_res.x / u_res.y;
  float nebula = fbm(uv * 3.2 + vec2(0.0, t * 0.025));
  vec3 c = mix(vec3(0.003, 0.006, 0.025), vec3(0.045, 0.035, 0.16), nebula * 0.8);
  vec2 grid = uv * vec2(32.0, 18.0);
  grid.y += t * 0.65;
  vec2 cell = floor(grid);
  vec2 local = fract(grid);
  float seed = hash21(cell);
  vec2 center = vec2(hash21(cell + 3.1), hash21(cell + 9.7));
  float size = mix(0.025, 0.12, hash21(cell + 17.3));
  float d = length((local - center) * vec2(0.82, 1.1));
  float star = (1.0 - smoothstep(size, size + 0.035, d)) * step(0.79, seed);
  float twinkle = 0.55 + 0.45 * sin(t * (1.5 + seed * 5.0) + seed * 48.0);
  c += mix(vec3(0.35, 0.68, 1.0), vec3(1.0, 0.52, 0.82), seed) * star * twinkle * 1.8;
  float centerGlow = exp(-length(p) * 4.0) * nebula * 0.16;
  c += vec3(0.18, 0.12, 0.48) * centerGlow;
  return mix(c, u_color, 0.12);
}`,
  fire: `
vec3 generate(vec2 uv, float t) {
  vec2 p = uv * vec2(4.8, 2.2);
  float flow = fbm(p + vec2(sin(uv.x * 8.0 + t * 0.25) * 0.18, -t * 0.72));
  float tongues = sin(uv.x * 17.0 + flow * 8.0 + t * 0.7) * 0.08;
  float heat = (1.0 - uv.y) * 0.88 + flow * 0.5 + tongues;
  float flame = smoothstep(0.2, 0.92, heat);
  float orange = smoothstep(0.28, 0.75, heat);
  float core = smoothstep(0.66, 1.02, heat);
  vec3 c = mix(vec3(0.008, 0.002, 0.018), vec3(0.42, 0.015, 0.025), flame);
  c = mix(c, vec3(1.0, 0.16, 0.015), orange);
  c = mix(c, vec3(1.0, 0.82, 0.22), core * 0.88);
  c += vec3(0.12, 0.03, 0.2) * exp(-abs(uv.y - 0.08) * 18.0);
  return mix(c, u_color, 0.1);
}`,
  mandala: `
vec3 generate(vec2 uv, float t) {
  vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float sector = 6.2831853 / 18.0;
  float folded = abs(mod(angle + sector * 0.5, sector) - sector * 0.5);
  float petalWave = sin(folded * 54.0 - radius * 23.0 + t * 0.45);
  float petals = exp(-abs(petalWave) * 4.0) * (1.0 - smoothstep(0.42, 0.78, radius));
  float rings = exp(-abs(sin(radius * 48.0 - t * 0.75)) * 7.0);
  float spokes = pow(max(0.0, cos(angle * 18.0)), 22.0) * (1.0 - smoothstep(0.08, 0.5, radius));
  vec3 palette = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + radius * 6.0 - t * 0.32);
  vec3 c = vec3(0.008, 0.006, 0.025) + palette * (petals * 0.9 + rings * 0.48);
  c += vec3(0.3, 0.85, 1.0) * spokes * 0.55;
  c += vec3(0.85, 0.18, 0.64) * exp(-abs(radius - 0.12) * 38.0);
  return mix(c, u_color, 0.12);
}`,
  matrix: `
vec3 generate(vec2 uv, float t) {
  vec2 grid = uv * vec2(66.0, 30.0);
  vec2 cell = floor(grid);
  vec2 local = fract(grid);
  float column = cell.x;
  float seed = hash21(vec2(column, 4.7));
  float columnSpeed = 0.22 + seed * 0.72;
  float head = mod(t * columnSpeed * 3.0 + hash21(vec2(column, 8.2)) * 30.0, 30.0);
  float distanceBehind = mod(head - cell.y + 30.0, 30.0);
  float tail = exp(-distanceBehind * 0.35);
  float glyphSeed = hash21(cell + vec2(17.0, 31.0));
  float vertical = 1.0 - smoothstep(0.04, 0.13, abs(local.x - (0.2 + 0.6 * hash21(cell + 7.1))));
  float horizontal = 1.0 - smoothstep(0.04, 0.13, abs(local.y - (0.18 + 0.64 * hash21(cell + 11.4))));
  float glyph = step(0.52, glyphSeed) * max(vertical * step(0.15, local.y), horizontal * step(0.2, local.x));
  float headDistance = abs(head - cell.y);
  headDistance = min(headDistance, 30.0 - headDistance);
  float headGlow = exp(-headDistance * headDistance * 1.8) * glyph;
  vec3 c = vec3(0.002, 0.012, 0.005);
  c += vec3(0.04, 0.64, 0.11) * glyph * tail;
  c += vec3(0.58, 1.0, 0.68) * headGlow;
  return mix(c, u_color, 0.12);
}`,
};

export function buildGeneratorShader(kind: GeneratorKind): string {
  const body = BODIES[kind] ?? BODIES.plasma;
  return `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_res;
uniform float u_time;
uniform float u_speed;
uniform float u_hue;
uniform float u_intensity;
uniform vec3 u_color;
${COMMON}
${body}
void main() {
  vec3 c = generate(v_uv, u_time * u_speed);
  c = hueRotate(c, u_hue * 6.2831853);
  outColor = vec4(clamp(c * u_intensity, 0.0, 1.0), 1.0);
}
`;
}
