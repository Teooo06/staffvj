import type {
  BlendMode,
  DeckId,
  EffectInstance,
  EffectType,
  GeneratorKind,
  Layer,
  LayerSource,
  MediaItem,
  ShowState,
} from '../types';
import { DECK_LAYER_COUNT } from '../types';
import { clamp, hexToRgb } from '../lib/utils';
import { buildEffectShader, getEffectDef } from './effectDefs';
import { buildGeneratorShader } from './generators';
import { FULLSCREEN_VERTEX, Program, RenderTarget, createQuad } from './glUtils';
import type { Quad } from './glUtils';
import { MediaManager } from './mediaManager';
import type { SourceFrame } from './mediaManager';

export type EngineMonitor = 'program' | 'A' | 'B';

export interface EngineOptions {
  width: number;
  height: number;
  monitor?: EngineMonitor;
  maxFps?: number;
}

const SOURCE_VERTEX = `#version 300 es
layout(location = 0) in vec2 a_pos;
uniform vec2 u_res;
uniform vec2 u_media;
uniform float u_contain;
uniform vec2 u_offset;
uniform float u_scale;
uniform float u_rotation;
out vec2 v_uv;
void main() {
  float canvasAspect = u_res.x / max(1.0, u_res.y);
  float mediaAspect = u_media.x / max(1.0, u_media.y);
  vec2 fit;
  if (u_contain > 0.5) {
    if (mediaAspect > canvasAspect) fit = vec2(1.0, canvasAspect / mediaAspect);
    else fit = vec2(mediaAspect / canvasAspect, 1.0);
  } else {
    if (mediaAspect > canvasAspect) fit = vec2(mediaAspect / canvasAspect, 1.0);
    else fit = vec2(1.0, canvasAspect / mediaAspect);
  }
  vec2 pos = a_pos * 0.5 * fit * max(0.001, u_scale);
  pos.x *= canvasAspect;
  float c = cos(u_rotation);
  float s = sin(u_rotation);
  pos = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
  pos.x /= canvasAspect;
  pos += u_offset;
  gl_Position = vec4(pos * 2.0, 0.0, 1.0);
  v_uv = a_pos * 0.5 + 0.5;
}
`;

const SOURCE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
void main() {
  outColor = texture(u_tex, v_uv);
}
`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_base;
uniform sampler2D u_layer;
uniform float u_opacity;
uniform int u_blend;

vec3 blendMode(vec3 base, vec3 layer, int mode) {
  if (mode == 1) return min(vec3(1.0), base + layer);
  if (mode == 2) return 1.0 - (1.0 - base) * (1.0 - layer);
  if (mode == 3) return base * layer;
  if (mode == 4) {
    return mix(
      2.0 * base * layer,
      1.0 - 2.0 * (1.0 - base) * (1.0 - layer),
      step(vec3(0.5), base)
    );
  }
  if (mode == 5) return abs(base - layer);
  if (mode == 6) return max(base, layer);
  if (mode == 7) return min(base, layer);
  return layer;
}

void main() {
  vec4 base = texture(u_base, v_uv);
  vec4 layer = texture(u_layer, v_uv);
  float alpha = clamp(layer.a * u_opacity, 0.0, 1.0);
  vec3 blended = blendMode(base.rgb, layer.rgb, u_blend);
  outColor = vec4(mix(base.rgb, blended, alpha), 1.0);
}
`;

const CROSSFADE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_a;
uniform sampler2D u_b;
uniform float u_t;
void main() {
  outColor = mix(texture(u_a, v_uv), texture(u_b, v_uv), clamp(u_t, 0.0, 1.0));
}
`;

const FINAL_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform float u_opacity;
uniform float u_blackout;
void main() {
  vec4 c = texture(u_tex, v_uv);
  float gain = u_blackout > 0.5 ? 0.0 : u_opacity;
  outColor = vec4(c.rgb * gain, 1.0);
}
`;

const BLEND_INDEX: Record<BlendMode, number> = {
  normal: 0,
  add: 1,
  screen: 2,
  multiply: 3,
  overlay: 4,
  difference: 5,
  lighten: 6,
  darken: 7,
};

const TARGET_CLEAR = [0, 0, 0, 0] as const;

interface DeckTargets {
  pair: [RenderTarget, RenderTarget];
}

interface LayerTargets {
  pair: [RenderTarget, RenderTarget];
}

function isGenerator(item: MediaItem): item is MediaItem & { generator: GeneratorKind } {
  return item.kind === 'generator';
}

export class VJEngine {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  readonly width: number;
  readonly height: number;

  private state: ShowState | null = null;
  private library = new Map<string, MediaItem>();
  private monitor: EngineMonitor;
  private audioLevel = 0;
  private beatPulse = 0;
  private beatClockBpm = 124;
  private beatClockPosition = 0;
  private beatClockAnchor = performance.now();

  private readonly quad: Quad;
  private readonly media: MediaManager;
  private readonly sourceProgram: Program;
  private readonly compositeProgram: Program;
  private readonly crossfadeProgram: Program;
  private readonly finalProgram: Program;
  private readonly effectPrograms = new Map<EffectType, Program>();
  private readonly generatorPrograms = new Map<GeneratorKind, Program>();

  private readonly deckTargets: Record<DeckId, DeckTargets>;
  private readonly masterTargets: [RenderTarget, RenderTarget];
  private readonly generatorTarget: RenderTarget;
  private readonly layerTargets = new Map<string, LayerTargets>();

  private raf: number | null = null;
  private disposed = false;
  private active = true;
  private failed = false;
  private lastError: string | null = null;
  private frameCount = 0;
  private fpsWindowStart = 0;
  private fps = 0;
  private readonly minFrameIntervalMs: number;
  private lastRenderedAt = 0;
  private ndiFrameCallback: ((bytes: Uint8Array, width: number, height: number) => void) | null = null;
  private ndiLastFrameAt = 0;
  private ndiReadback = new Uint8Array(0);
  private ndiFlipped = new Uint8Array(0);

  constructor(canvas: HTMLCanvasElement, options: EngineOptions) {
    this.canvas = canvas;
    this.width = Math.max(2, Math.round(options.width));
    this.height = Math.max(2, Math.round(options.height));
    this.monitor = options.monitor ?? 'program';
    this.minFrameIntervalMs = options.maxFps && options.maxFps > 0
      ? 1000 / options.maxFps
      : 0;

    canvas.width = this.width;
    canvas.height = this.height;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 non disponibile su questo sistema');
    this.gl = gl;

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.quad = createQuad(gl);
    this.media = new MediaManager(gl);
    this.sourceProgram = new Program(gl, SOURCE_FRAGMENT, SOURCE_VERTEX);
    this.compositeProgram = new Program(gl, COMPOSITE_FRAGMENT);
    this.crossfadeProgram = new Program(gl, CROSSFADE_FRAGMENT);
    this.finalProgram = new Program(gl, FINAL_FRAGMENT);
    this.deckTargets = {
      A: { pair: [this.target(), this.target()] },
      B: { pair: [this.target(), this.target()] },
    };
    this.masterTargets = [this.target(), this.target()];
    this.generatorTarget = this.target();

    this.raf = requestAnimationFrame(this.frame);
  }

  private target(): RenderTarget {
    return new RenderTarget(this.gl, this.width, this.height);
  }

  setState(state: ShowState): void {
    this.state = state;
    this.library = new Map(state.library.map((item) => [item.id, item]));
    this.retainCapturesForMonitor();
  }

  private retainCapturesForMonitor(): void {
    const state = this.state;
    if (!state) return;
    const keep = new Set<string>();
    const decks: DeckId[] =
      this.monitor === 'program'
        ? ['A', 'B']
        : [this.monitor];
    if (this.active) decks.forEach((deck) => {
      for (const layer of state.decks[deck].layers) {
        if (layer.source?.kind === 'capture') keep.add(layer.source.deviceId);
      }
    });
    this.media.releaseCapturesExcept(keep);
  }

  setBrowserFrame(sourceId: string, bytes: Uint8Array, sequence: number): void {
    this.media.updateBrowserFrame(sourceId, bytes, sequence);
  }

  setBrowserBitmap(sourceId: string, bitmap: ImageBitmap, sequence: number): void {
    this.media.updateBrowserBitmap(sourceId, bitmap, sequence);
  }

  removeBrowserFrame(sourceId: string): void {
    this.media.removeBrowserFrame(sourceId);
  }

  setNdiFrame(sourceId: string, bytes: Uint8Array, width: number, height: number): void {
    this.media.updateNdiFrame(sourceId, bytes, width, height);
  }

  removeNdiFrame(sourceId: string): void {
    this.media.removeNdiFrame(sourceId);
  }

  setNdiOutput(callback: ((bytes: Uint8Array, width: number, height: number) => void) | null): void {
    this.ndiFrameCallback = callback;
    this.ndiLastFrameAt = 0;
  }

  setMonitor(monitor: EngineMonitor): void {
    this.monitor = monitor;
    this.retainCapturesForMonitor();
  }

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.lastRenderedAt = 0;
    this.retainCapturesForMonitor();
  }

  setAudioLevels(
    level: number,
    beatPulse: number,
    beatPosition: number,
    bpm: number,
  ): void {
    this.audioLevel = clamp(level, 0, 1);
    this.beatPulse = clamp(beatPulse, 0, 1);
    this.beatClockPosition = beatPosition;
    this.beatClockBpm = clamp(bpm, 60, 200);
    this.beatClockAnchor = performance.now();
  }

  getFps(): number {
    return this.fps;
  }

  getGpuRenderer(): string {
    const extension = this.gl.getExtension('WEBGL_debug_renderer_info') as
      | { UNMASKED_RENDERER_WEBGL: number }
      | null;
    return String(this.gl.getParameter(extension?.UNMASKED_RENDERER_WEBGL ?? this.gl.RENDERER));
  }

  getError(): string | null {
    return this.lastError;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    for (const program of this.generatorPrograms.values()) program.dispose();
    for (const program of this.effectPrograms.values()) program.dispose();
    this.generatorPrograms.clear();
    this.effectPrograms.clear();
    this.sourceProgram.dispose();
    this.compositeProgram.dispose();
    this.crossfadeProgram.dispose();
    this.finalProgram.dispose();
    this.deckTargets.A.pair.forEach((target) => target.dispose());
    this.deckTargets.B.pair.forEach((target) => target.dispose());
    this.masterTargets.forEach((target) => target.dispose());
    this.generatorTarget.dispose();
    for (const targets of this.layerTargets.values()) {
      targets.pair.forEach((target) => target.dispose());
    }
    this.layerTargets.clear();
    this.media.dispose();
    this.quad.dispose();
  }

  private frame = (timestamp: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    if (!this.active) return;
    if (
      this.minFrameIntervalMs > 0 &&
      timestamp - this.lastRenderedAt < this.minFrameIntervalMs - 1
    ) {
      return;
    }
    this.lastRenderedAt = timestamp;
    const wallNow = Date.now();
    const seconds = (wallNow % 86_400_000) / 1000;

    this.frameCount += 1;
    if (!this.fpsWindowStart) this.fpsWindowStart = wallNow;
    if (wallNow - this.fpsWindowStart >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (wallNow - this.fpsWindowStart));
      this.frameCount = 0;
      this.fpsWindowStart = wallNow;
    }

    try {
      this.render(wallNow, seconds);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      if (!this.failed) {
        this.failed = true;
        console.error('[engine]', error);
      }
    }
  };

  private render(wallNow: number, seconds: number): void {
    const gl = this.gl;
    const state = this.state;
    if (!state) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    const deckA = this.monitor !== 'B' ? this.renderDeck('A', wallNow, seconds) : null;
    const deckB = this.monitor !== 'A' ? this.renderDeck('B', wallNow, seconds) : null;

    let texA: WebGLTexture;
    let texB: WebGLTexture;
    let mix: number;
    if (this.monitor === 'A') {
      texA = deckA!.texture;
      texB = texA;
      mix = 0;
    } else if (this.monitor === 'B') {
      texB = deckB!.texture;
      texA = texB;
      mix = 1;
    } else {
      texA = deckA!.texture;
      texB = deckB!.texture;
      mix = clamp(state.crossfade, 0, 1);
    }

    const master0 = this.masterTargets[0];
    const master1 = this.masterTargets[1];
    master0.bind();
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.crossfadeProgram.use();
    this.crossfadeProgram.setTexture('u_a', texA, 0);
    this.crossfadeProgram.setTexture('u_b', texB, 1);
    this.crossfadeProgram.set1f('u_t', mix);
    this.drawQuad();

    let current = master0;
    let spare = master1;
    for (const effect of state.masterEffects) {
      if (!this.shouldRenderEffect(effect)) continue;
      this.renderEffect(effect, current, spare, seconds);
      [current, spare] = [spare, current];
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.finalProgram.use();
    this.finalProgram.setTexture('u_tex', current.texture, 0);
    this.finalProgram.set1f('u_opacity', clamp(state.masterOpacity, 0, 1));
    this.finalProgram.set1f(
      'u_blackout',
      state.blackout && this.monitor === 'program' ? 1 : 0,
    );
    this.drawQuad();
    this.publishNdiFrame(wallNow);
  }

  private renderDeck(deckId: DeckId, wallNow: number, seconds: number): RenderTarget {
    const state = this.state;
    if (!state) throw new Error('Stato non disponibile');
    const deck = state.decks[deckId];
    const targets = this.deckTargets[deckId].pair;
    let current = targets[0];
    current.clear(0, 0, 0, 1);

    for (let index = DECK_LAYER_COUNT - 1; index >= 0; index -= 1) {
      const layer = deck.layers[index];
      if (!layer || !layer.visible || !layer.source) continue;
      if (layer.opacity <= 0.0005) continue;
      const layerTarget = this.renderLayer(deckId, index, layer, wallNow, seconds);
      if (!layerTarget) continue;
      const spare = current === targets[0] ? targets[1] : targets[0];
      const fade = this.layerFade(layer, wallNow);
      this.composite(current, layerTarget, spare, layer.opacity * fade, layer.blend);
      current = spare;
    }

    return current;
  }

  private layerFade(layer: Layer, wallNow: number): number {
    if (!layer.source || layer.source.startedAt <= 0 || layer.fadeMs <= 0) return 1;
    return clamp((wallNow - layer.source.startedAt) / layer.fadeMs, 0, 1);
  }

  private renderLayer(
    deckId: DeckId,
    layerIndex: number,
    layer: Layer,
    wallNow: number,
    seconds: number,
  ): RenderTarget | null {
    if (!layer.source) return null;
    const frame = this.sourceFrame(layer.source, wallNow, seconds);
    if (!frame) return null;

    const gl = this.gl;
    const targets = this.ensureLayerTargets(deckId, layerIndex);
    const [first, second] = targets.pair;

    first.bind();
    gl.disable(gl.BLEND);
    gl.clearColor(TARGET_CLEAR[0], TARGET_CLEAR[1], TARGET_CLEAR[2], TARGET_CLEAR[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.renderSource(frame, layer);

    let current = first;
    let spare = second;
    for (const effect of layer.effects) {
      if (!this.shouldRenderEffect(effect)) continue;
      this.renderEffect(effect, current, spare, seconds);
      [current, spare] = [spare, current];
    }
    return current;
  }

  private sourceFrame(
    source: LayerSource,
    wallNow: number,
    seconds: number,
  ): SourceFrame | null {
    if (source.kind === 'capture') {
      return this.media.frameForCapture(source.deviceId, wallNow);
    }
    if (source.kind === 'ndi') {
      return this.media.frameForNdi(source.sourceId);
    }
    const item = this.library.get(source.mediaId);
    if (!item) return null;
    if (isGenerator(item)) {
      return this.renderGenerator(item, seconds);
    }
    return this.media.frameForMedia(item, source, wallNow, this.beatClockBpm);
  }

  private renderGenerator(
    item: MediaItem & { generator: GeneratorKind },
    seconds: number,
  ): SourceFrame {
    const gl = this.gl;
    const target = this.generatorTarget;
    target.bind();
    gl.disable(gl.BLEND);

    let program = this.generatorPrograms.get(item.generator);
    if (!program) {
      program = new Program(gl, buildGeneratorShader(item.generator));
      this.generatorPrograms.set(item.generator, program);
    }
    const settings = item.gen ?? {
      speed: 1,
      hue: 0,
      intensity: 1,
      color: '#ffffff',
    };
    const [r, g, b] = hexToRgb(settings.color);
    program.use();
    program.set2f('u_res', this.width, this.height);
    program.set1f('u_time', seconds);
    program.set1f('u_speed', settings.speed);
    program.set1f('u_hue', settings.hue);
    program.set1f('u_intensity', settings.intensity);
    program.set3f('u_color', r, g, b);
    this.drawQuad();

    return {
      texture: target.texture,
      width: this.width,
      height: this.height,
    };
  }

  private renderSource(frame: SourceFrame, layer: Layer): void {
    this.sourceProgram.use();
    this.sourceProgram.set2f('u_res', this.width, this.height);
    this.sourceProgram.set2f('u_media', frame.width, frame.height);
    this.sourceProgram.set1f('u_contain', layer.fit === 'contain' ? 1 : 0);
    this.sourceProgram.set2f('u_offset', layer.transform.x, -layer.transform.y);
    this.sourceProgram.set1f('u_scale', layer.transform.scale);
    this.sourceProgram.set1f(
      'u_rotation',
      (layer.transform.rotation * Math.PI) / 180,
    );
    this.sourceProgram.setTexture('u_tex', frame.texture, 0);
    this.drawQuad();
  }

  private composite(
    base: RenderTarget,
    layer: RenderTarget,
    target: RenderTarget,
    opacity: number,
    blend: BlendMode,
  ): void {
    const gl = this.gl;
    target.bind();
    gl.disable(gl.BLEND);
    this.compositeProgram.use();
    this.compositeProgram.setTexture('u_base', base.texture, 0);
    this.compositeProgram.setTexture('u_layer', layer.texture, 1);
    this.compositeProgram.set1f('u_opacity', clamp(opacity, 0, 1));
    this.compositeProgram.setInt('u_blend', BLEND_INDEX[blend] ?? 0);
    this.drawQuad();
  }

  private shouldRenderEffect(effect: EffectInstance): boolean {
    if (!effect.enabled) return false;
    if (effect.mix <= 0.0005 && effect.audioReact <= 0 && effect.beatReact <= 0) {
      return false;
    }
    return true;
  }

  private renderEffect(
    effect: EffectInstance,
    input: RenderTarget,
    output: RenderTarget,
    seconds: number,
  ): void {
    const gl = this.gl;
    const def = getEffectDef(effect.type);
    let program = this.effectPrograms.get(effect.type);
    if (!program) {
      program = new Program(gl, buildEffectShader(def));
      this.effectPrograms.set(effect.type, program);
    }

    output.bind();
    gl.disable(gl.BLEND);
    program.use();
    program.setTexture('u_tex', input.texture, 0);
    program.set2f('u_res', this.width, this.height);
    program.set1f(
      'u_time',
      effect.beatSync ? this.currentBeatPosition() : seconds,
    );
    program.set1f('u_mix', clamp(effect.mix, 0, 1));
    program.set1f('u_audio', this.audioLevel * clamp(effect.audioReact, 0, 1));
    program.set1f('u_beat', this.beatPulse * clamp(effect.beatReact, 0, 1));
    for (let index = 0; index < 4; index += 1) {
      const param = def.params[index];
      const value = param
        ? effect.params[param.key] ?? param.default
        : 0;
      program.set1f(`u_p${index}`, value);
    }
    if (effect.type === 'strobe') {
      program.set1f(
        'u_p0',
        effect.beatSync ? 1 : Math.max(0.1, effect.params.rate ?? 5),
      );
    }
    if (effect.type === 'bounce') {
      program.set1f(
        'u_p1',
        effect.beatSync ? 1 : Math.max(0.1, effect.params.rate ?? 2),
      );
    }
    this.drawQuad();
  }

  private ensureLayerTargets(deckId: DeckId, layerIndex: number): LayerTargets {
    const key = `${deckId}:${layerIndex}`;
    let targets = this.layerTargets.get(key);
    if (!targets) {
      targets = { pair: [this.target(), this.target()] };
      this.layerTargets.set(key, targets);
    }
    return targets;
  }

  private drawQuad(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.quad.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  private currentBeatPosition(): number {
    return (
      this.beatClockPosition +
      ((performance.now() - this.beatClockAnchor) / 60000) * this.beatClockBpm
    );
  }

  private publishNdiFrame(now: number): void {
    if (!this.ndiFrameCallback || now - this.ndiLastFrameAt < 33) return;
    this.ndiLastFrameAt = now;
    const gl = this.gl;
    const byteLength = this.width * this.height * 4;
    if (this.ndiReadback.byteLength !== byteLength) {
      this.ndiReadback = new Uint8Array(byteLength);
      this.ndiFlipped = new Uint8Array(byteLength);
    }
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, this.ndiReadback);
    const rowBytes = this.width * 4;
    for (let row = 0; row < this.height; row += 1) {
      const sourceStart = (this.height - row - 1) * rowBytes;
      this.ndiFlipped.set(
        this.ndiReadback.subarray(sourceStart, sourceStart + rowBytes),
        row * rowBytes,
      );
    }
    this.ndiFrameCallback(this.ndiFlipped, this.width, this.height);
  }
}

export const PREVIEW_RESOLUTION = { width: 960, height: 540, maxFps: 30 };
export const OUTPUT_RESOLUTION = { width: 1920, height: 1080 };
