import type { MediaItem, TextSettings } from '../types';
import { createSourceTexture } from './glUtils';

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const ANIMATED_REDRAW_MS = 33;

interface TextEntry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: WebGLTexture;
  key: string;
  lastDraw: number;
}

function canvasFont(settings: TextSettings): string {
  return `${Math.round(settings.weight)} ${Math.round(settings.size)}px "${settings.font}", "Helvetica Neue", Arial, sans-serif`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  settings: TextSettings,
  nowMs: number,
  bpm?: number,
): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const seconds = nowMs / 1000;
  const bpmValue = bpm ?? 124;
  const beatsPerSecond = bpmValue / 60;
  ctx.clearRect(0, 0, width, height);

  const raw = settings.uppercase ? settings.text.toUpperCase() : settings.text;
  if (!raw.trim()) return;

  const size = Math.max(12, settings.size);
  const lineHeight = size * 1.16;
  ctx.font = canvasFont(settings);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = settings.color;
  ctx.strokeStyle = settings.outlineColor;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.055);
  ctx.globalAlpha = 1;

  const spacingCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  spacingCtx.letterSpacing = `${settings.letterSpacing}px`;

  const fullLines = raw.split('\n');
  const blockWidth = fullLines.reduce(
    (max, line) => Math.max(max, ctx.measureText(line).width),
    0,
  );
  let lines = fullLines;

  if (settings.animation === 'typewriter') {
    const total = raw.length;
    const revealed = Math.min(
      total,
      Math.floor((seconds * Math.max(0.1, settings.speed) * 18) % (total + 18)),
    );
    lines = raw.slice(0, revealed).split('\n');
  }

  let anchorX = settings.x * width;
  const bounce =
    settings.animation === 'bounce'
      ? -Math.abs(
          Math.sin(seconds * Math.max(0.2, settings.speed) * 2.4 * beatsPerSecond),
        ) * size * 0.32
      : 0;
  const anchorY = settings.y * height + bounce;

  if (settings.animation === 'scroll-left' || settings.animation === 'scroll-right') {
    const travel = width + blockWidth + size;
    const progress =
      ((seconds * Math.max(0.1, settings.speed) * 150) % travel + travel) % travel;
    anchorX =
      settings.animation === 'scroll-left'
        ? width + blockWidth / 2 - progress
        : progress - blockWidth / 2;
  }

  const pulse =
    settings.animation === 'pulse'
      ? 1 + Math.sin(seconds * Math.max(0.2, settings.speed) * 3.2 * beatsPerSecond) * 0.055
      : 1;

  ctx.save();
  ctx.translate(anchorX, anchorY);
  if (pulse !== 1) ctx.scale(pulse, pulse);

  const padX = size * 0.24;
  const padY = size * 0.16;
  const visibleHeight = Math.max(1, lines.length) * lineHeight;

  if (settings.background) {
    ctx.globalAlpha = settings.backgroundOpacity;
    ctx.fillStyle = '#000000';
    roundedRect(
      ctx,
      -blockWidth / 2 - padX,
      -visibleHeight / 2 - padY,
      blockWidth + padX * 2,
      visibleHeight + padY * 2,
      Math.min(28, size * 0.18),
    );
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = settings.color;
  }

  ctx.textAlign =
    settings.animation === 'scroll-left' || settings.animation === 'scroll-right'
      ? 'left'
      : settings.align === 'left'
        ? 'left'
        : settings.align === 'right'
          ? 'right'
          : 'center';

  const x =
    ctx.textAlign === 'left'
      ? -blockWidth / 2
      : ctx.textAlign === 'right'
        ? blockWidth / 2
        : 0;

  const startY = -((Math.max(1, lines.length) - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    if (settings.outline) ctx.strokeText(line, x, y);
    ctx.fillText(line, x, y);
  });

  ctx.restore();
  spacingCtx.letterSpacing = '0px';
}

export class TextRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly entries = new Map<string, TextEntry>();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  textureFor(item: MediaItem, nowMs: number, bpm?: number): WebGLTexture | null {
    if (!item.text) return null;
    const key = JSON.stringify(item.text);
    let entry = this.entries.get(item.id);

    if (!entry) {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      entry = {
        canvas,
        ctx,
        texture: createSourceTexture(this.gl),
        key: '',
        lastDraw: 0,
      };
      this.entries.set(item.id, entry);
    }

    const animated = item.text.animation !== 'none';
    if (
      entry.key !== key ||
      (animated && nowMs - entry.lastDraw >= ANIMATED_REDRAW_MS)
    ) {
      drawText(entry.ctx, item.text, nowMs, bpm);
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        entry.canvas,
      );
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.bindTexture(gl.TEXTURE_2D, null);
      entry.key = key;
      entry.lastDraw = nowMs;
    }

    return entry.texture;
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      this.gl.deleteTexture(entry.texture);
    }
    this.entries.clear();
  }
}

export const TEXT_CANVAS_SIZE = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
