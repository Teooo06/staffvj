import type { MediaItem, MediaLayerSource } from '../types';
import { mediaUrl } from '../lib/utils';
import { videoTimeline } from '../lib/videoPlayback';
import { TextRenderer, TEXT_CANVAS_SIZE } from './textTexture';
import { createSourceTexture } from './glUtils';

export interface SourceFrame {
  texture: WebGLTexture;
  width: number;
  height: number;
}

interface VideoEntry {
  video: HTMLVideoElement;
  texture: WebGLTexture;
  width: number;
  height: number;
  failed: boolean;
  error: string | null;
  fallbackStart: number;
  lastUploadedTime: number;
  lastUploadedWidth: number;
  lastUploadedHeight: number;
}

interface ImageEntry {
  image: HTMLImageElement;
  texture: WebGLTexture;
  width: number;
  height: number;
  ready: boolean;
  failed: boolean;
}

interface CaptureEntry {
  video: HTMLVideoElement;
  texture: WebGLTexture;
  width: number;
  height: number;
  stream: MediaStream | null;
  failed: boolean;
  error: string | null;
  attemptedAt: number;
  pending: boolean;
  lastUploadedTime: number;
  lastUploadedWidth: number;
  lastUploadedHeight: number;
}

interface BrowserEntry {
  texture: WebGLTexture;
  bitmap: ImageBitmap | null;
  width: number;
  height: number;
  sequence: number;
  pendingSequence: number;
  dirty: boolean;
}

interface NdiEntry {
  texture: WebGLTexture;
  bytes: Uint8Array;
  width: number;
  height: number;
  sequence: number;
  dirty: boolean;
}

const SYNC_TOLERANCE = 0.55;
const CAPTURE_RETRY_MS = 5000;

export class MediaManager {
  private readonly gl: WebGL2RenderingContext;
  private readonly text: TextRenderer;
  private readonly videos = new Map<string, VideoEntry>();
  private readonly images = new Map<string, ImageEntry>();
  private readonly captures = new Map<string, CaptureEntry>();
  private readonly browserFrames = new Map<string, BrowserEntry>();
  private readonly ndiFrames = new Map<string, NdiEntry>();
  private host: HTMLDivElement | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.text = new TextRenderer(gl);
  }

  private ensureHost(): HTMLDivElement {
    if (this.host && this.host.isConnected) return this.host;
    const host = document.createElement('div');
    host.id = 'vj-media-host';
    host.style.cssText =
      'position:fixed;left:-10000px;top:-10000px;width:2px;height:2px;overflow:hidden;opacity:0;pointer-events:none;';
    document.body.appendChild(host);
    this.host = host;
    return host;
  }

  frameForMedia(item: MediaItem, source: MediaLayerSource, nowMs: number, bpm?: number): SourceFrame | null {
    if (item.kind === 'text') {
      const texture = this.text.textureFor(item, nowMs, bpm);
      if (!texture) return null;
      return { texture, width: TEXT_CANVAS_SIZE.width, height: TEXT_CANVAS_SIZE.height };
    }
    if (item.kind === 'image') return this.imageFrame(item);
    if (item.kind === 'video') return this.videoFrame(item, source, nowMs);
    if (item.kind === 'browser') return this.browserFrame(item.id);
    return null;
  }

  updateBrowserFrame(
    sourceId: string,
    bytes: Uint8Array,
    sequence: number,
  ): void {
    let entry = this.browserFrames.get(sourceId);
    if (!entry) {
      entry = {
        texture: createSourceTexture(this.gl),
        bitmap: null,
        width: 0,
        height: 0,
        sequence: 0,
        pendingSequence: 0,
        dirty: false,
      };
      this.browserFrames.set(sourceId, entry);
    }
    if (sequence <= Math.max(entry.sequence, entry.pendingSequence)) return;
    entry.pendingSequence = sequence;
    const source = new Uint8Array(bytes);
    void createImageBitmap(new Blob([source], { type: 'image/jpeg' }))
      .then((bitmap) => {
        const current = this.browserFrames.get(sourceId);
        if (current !== entry || current.pendingSequence !== sequence) {
          bitmap.close();
          return;
        }
        current.bitmap?.close();
        current.bitmap = bitmap;
        current.width = bitmap.width;
        current.height = bitmap.height;
        current.sequence = sequence;
        current.dirty = true;
      })
      .catch((error) => {
        console.warn('[browser source] decodifica frame non riuscita', error);
      });
  }

  updateBrowserBitmap(sourceId: string, bitmap: ImageBitmap, sequence: number): void {
    let entry = this.browserFrames.get(sourceId);
    if (!entry) {
      entry = {
        texture: createSourceTexture(this.gl),
        bitmap: null,
        width: 0,
        height: 0,
        sequence: 0,
        pendingSequence: 0,
        dirty: false,
      };
      this.browserFrames.set(sourceId, entry);
    }
    if (sequence <= Math.max(entry.sequence, entry.pendingSequence)) return;
    entry.pendingSequence = sequence;
    entry.bitmap?.close();
    entry.bitmap = null;
    this.upload(bitmap, entry.texture);
    entry.width = bitmap.width;
    entry.height = bitmap.height;
    entry.sequence = sequence;
    entry.dirty = false;
  }

  removeBrowserFrame(sourceId: string): void {
    const entry = this.browserFrames.get(sourceId);
    if (!entry) return;
    entry.bitmap?.close();
    this.gl.deleteTexture(entry.texture);
    this.browserFrames.delete(sourceId);
  }

  updateNdiFrame(sourceId: string, bytes: Uint8Array, width: number, height: number): void {
    if (!width || !height || bytes.byteLength < width * height * 4) return;
    let entry = this.ndiFrames.get(sourceId);
    if (!entry) {
      entry = {
        texture: createSourceTexture(this.gl),
        bytes: new Uint8Array(),
        width: 0,
        height: 0,
        sequence: 0,
        dirty: false,
      };
      this.ndiFrames.set(sourceId, entry);
    }
    entry.bytes = new Uint8Array(bytes.subarray(0, width * height * 4));
    entry.width = width;
    entry.height = height;
    entry.sequence += 1;
    entry.dirty = true;
  }

  removeNdiFrame(sourceId: string): void {
    const entry = this.ndiFrames.get(sourceId);
    if (!entry) return;
    this.gl.deleteTexture(entry.texture);
    this.ndiFrames.delete(sourceId);
  }

  frameForNdi(sourceId: string): SourceFrame | null {
    const entry = this.ndiFrames.get(sourceId);
    if (!entry?.width || !entry.height) return null;
    if (entry.dirty) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        entry.width,
        entry.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        entry.bytes,
      );
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.bindTexture(gl.TEXTURE_2D, null);
      entry.dirty = false;
    }
    return { texture: entry.texture, width: entry.width, height: entry.height };
  }

  private browserFrame(sourceId: string): SourceFrame | null {
    const entry = this.browserFrames.get(sourceId);
    if (!entry?.width || !entry.height) return null;
    if (entry.dirty && entry.bitmap) {
      this.upload(entry.bitmap, entry.texture);
      entry.dirty = false;
    }
    return {
      texture: entry.texture,
      width: entry.width,
      height: entry.height,
    };
  }

  frameForCapture(deviceId: string, nowMs: number): SourceFrame | null {
    const entry = this.ensureCapture(deviceId, nowMs);
    if (!entry || entry.failed || entry.pending) return null;
    if (entry.video.readyState < 2 || !entry.video.videoWidth) return null;
    if (
      entry.video.currentTime !== entry.lastUploadedTime ||
      entry.video.videoWidth !== entry.lastUploadedWidth ||
      entry.video.videoHeight !== entry.lastUploadedHeight
    ) {
      this.upload(entry.video, entry.texture);
      entry.lastUploadedTime = entry.video.currentTime;
      entry.lastUploadedWidth = entry.video.videoWidth;
      entry.lastUploadedHeight = entry.video.videoHeight;
    }
    entry.width = entry.video.videoWidth;
    entry.height = entry.video.videoHeight;
    return { texture: entry.texture, width: entry.width, height: entry.height };
  }

  getCaptureError(deviceId: string): string | null {
    return this.captures.get(deviceId)?.error ?? null;
  }

  releaseCapturesExcept(keep: Set<string>): void {
    for (const [deviceId, entry] of this.captures) {
      if (keep.has(deviceId)) continue;
      this.destroyCapture(entry);
      this.captures.delete(deviceId);
    }
  }

  private imageFrame(item: MediaItem): SourceFrame | null {
    if (!item.path) return null;
    let entry = this.images.get(item.id);
    if (!entry) {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      const texture = createSourceTexture(this.gl);
      entry = {
        image,
        texture,
        width: 0,
        height: 0,
        ready: false,
        failed: false,
      };
      image.onload = () => {
        if (!entry) return;
        entry.ready = true;
        entry.width = image.naturalWidth;
        entry.height = image.naturalHeight;
        this.upload(image, entry.texture);
      };
      image.onerror = () => {
        if (entry) entry.failed = true;
      };
      image.src = mediaUrl(item.path);
      this.images.set(item.id, entry);
    }
    if (!entry.ready || entry.failed || !entry.width || !entry.height) return null;
    return { texture: entry.texture, width: entry.width, height: entry.height };
  }

  private videoFrame(item: MediaItem, source: MediaLayerSource, nowMs: number): SourceFrame | null {
    if (!item.path) return null;
    const video = this.ensureVideo(item);
    if (!video || video.failed) return null;
    if (video.video.readyState < 2 || !video.video.videoWidth) {
      return video.width && video.height
        ? { texture: video.texture, width: video.width, height: video.height }
        : null;
    }

    if (video.fallbackStart === 0) video.fallbackStart = nowMs;
    const duration = Number.isFinite(video.video.duration) ? video.video.duration : 0;
    const timeline = videoTimeline(source, nowMs, duration);
    const target = timeline.position;
    const reachedEnd =
      !timeline.loop && timeline.rawPosition >= timeline.end - 0.005 && timeline.end > timeline.start;

    if (duration > 0 && !video.video.seeking && Math.abs(video.video.currentTime - target) > SYNC_TOLERANCE) {
      try {
        video.video.currentTime = target;
      } catch (_error) {
        /* il media non è ancora pronto per la ricerca */
      }
    }

    video.video.playbackRate = timeline.rate;
    const shouldPause = timeline.paused || reachedEnd;
    if (shouldPause) {
      if (!video.video.paused) video.video.pause();
    } else if (video.video.paused) {
      void video.video.play().catch(() => {
        /* autoplay bloccato: il frame resta sull'ultimo fotogramma disponibile */
      });
    }

    const canUpload = !video.video.seeking || video.lastUploadedTime < 0;
    if (
      canUpload &&
      (video.video.currentTime !== video.lastUploadedTime ||
        video.video.videoWidth !== video.lastUploadedWidth ||
        video.video.videoHeight !== video.lastUploadedHeight)
    ) {
      this.upload(video.video, video.texture);
      video.lastUploadedTime = video.video.currentTime;
      video.lastUploadedWidth = video.video.videoWidth;
      video.lastUploadedHeight = video.video.videoHeight;
    }
    video.width = video.video.videoWidth;
    video.height = video.video.videoHeight;
    return { texture: video.texture, width: video.width, height: video.height };
  }

  private ensureVideo(item: MediaItem): VideoEntry | null {
    if (!item.path) return null;
    const key = `${item.id}:${item.path}`;
    let entry = this.videos.get(key);
    if (entry) return entry;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.defaultMuted = true;
    video.loop = false;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('playsinline', '');
    video.disablePictureInPicture = true;

    entry = {
      video,
      texture: createSourceTexture(this.gl),
      width: 0,
      height: 0,
      failed: false,
      error: null,
      fallbackStart: 0,
      lastUploadedTime: -1,
      lastUploadedWidth: 0,
      lastUploadedHeight: 0,
    };

    video.addEventListener('error', () => {
      if (!entry) return;
      entry.failed = true;
      entry.error = video.error?.message || 'Errore di decodifica del video';
    });
    video.addEventListener('loadeddata', () => {
      if (!entry) return;
      entry.width = video.videoWidth;
      entry.height = video.videoHeight;
    });

    video.src = mediaUrl(item.path);
    this.ensureHost().appendChild(video);
    video.load();
    this.videos.set(key, entry);
    return entry;
  }

  private ensureCapture(deviceId: string, nowMs: number): CaptureEntry | null {
    let entry = this.captures.get(deviceId);
    if (entry && !entry.failed) return entry;
    if (entry?.pending) return entry;
    if (entry?.failed && nowMs - entry.attemptedAt < CAPTURE_RETRY_MS) return entry;

    const video = entry?.video ?? document.createElement('video');
    if (!entry) {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.autoplay = true;
      entry = {
        video,
        texture: createSourceTexture(this.gl),
        width: 0,
        height: 0,
        stream: null,
        failed: false,
        error: null,
        attemptedAt: 0,
        pending: false,
        lastUploadedTime: -1,
        lastUploadedWidth: 0,
        lastUploadedHeight: 0,
      };
      this.ensureHost().appendChild(video);
      this.captures.set(deviceId, entry);
    }

    entry.pending = true;
    entry.failed = false;
    entry.error = null;
    entry.attemptedAt = nowMs;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: false,
        });
        if (!entry) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        entry.stream?.getTracks().forEach((track) => track.stop());
        entry.stream = stream;
        entry.video.srcObject = stream;
        await entry.video.play().catch(() => {
          /* il video parte comunque appena disponibile */
        });
        entry.failed = false;
      } catch (error) {
        if (entry) {
          entry.failed = true;
          entry.error =
            error instanceof Error
              ? error.name === 'NotAllowedError'
                ? 'Accesso alla scheda video negato'
                : error.message
              : 'Ingresso video non disponibile';
        }
      } finally {
        if (entry) entry.pending = false;
      }
    })();

    return entry;
  }

  private upload(source: TexImageSource, texture: WebGLTexture): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private destroyCapture(entry: CaptureEntry): void {
    entry.stream?.getTracks().forEach((track) => track.stop());
    entry.stream = null;
    entry.video.srcObject = null;
    entry.video.pause();
    entry.video.remove();
    this.gl.deleteTexture(entry.texture);
  }

  dispose(): void {
    for (const entry of this.videos.values()) {
      entry.video.pause();
      entry.video.removeAttribute('src');
      entry.video.load();
      entry.video.remove();
      this.gl.deleteTexture(entry.texture);
    }
    this.videos.clear();

    for (const entry of this.images.values()) {
      this.gl.deleteTexture(entry.texture);
    }
    this.images.clear();

    for (const entry of this.captures.values()) {
      this.destroyCapture(entry);
    }
    this.captures.clear();

    for (const entry of this.browserFrames.values()) {
      entry.bitmap?.close();
      this.gl.deleteTexture(entry.texture);
    }
    this.browserFrames.clear();

    for (const entry of this.ndiFrames.values()) {
      this.gl.deleteTexture(entry.texture);
    }
    this.ndiFrames.clear();

    this.text.dispose();
    this.host?.remove();
    this.host = null;
  }
}
