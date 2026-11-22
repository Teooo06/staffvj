const parentPort = process.parentPort;

const receivers = new Map();
const connectingReceivers = new Set();
const receiverRetryAt = new Map();
let ndi = null;
let finderSources = [];
let wantedSources = new Map();
let sender = null;
let senderName = '';
let pendingVideoFrame = null;
let sendingVideo = false;
let discovering = false;
let syncingReceivers = false;
let receiverSyncPending = false;
let ready = false;
let lastOutputError = null;

function post(message) {
  try {
    parentPort?.postMessage(message);
  } catch (error) {
    console.warn('[ndi] messaggio non inviato', error);
  }
}

function sourceId(source) {
  return source.urlAddress || source.name;
}

function publishStatus(error = null) {
  const now = Date.now();
  post({
    type: 'status',
    available: ready,
    version: ready ? ndi.version() : null,
    error: error || lastOutputError,
    outputEnabled: Boolean(sender),
    outputName: senderName,
    receiving: [...receivers.keys()],
    streaming: [...receivers.entries()]
      .filter(([, entry]) => entry.frameCount > 0 && now - entry.lastFrameAt < 1500)
      .map(([id]) => id),
  });
}

async function stopReceiver(id) {
  const entry = receivers.get(id);
  if (!entry) return;
  receivers.delete(id);
  entry.closed = true;
  try {
    entry.receiver.destroy();
  } catch (_error) {
    /* la connessione può essersi già chiusa */
  }
  post({ type: 'remove', sourceId: id });
}

async function streamReceiver(id, receiver) {
  const entry = { receiver, closed: false, lastFrameAt: 0, frameCount: 0, lastErrorAt: 0 };
  receivers.set(id, entry);
  publishStatus();
  while (!entry.closed && receivers.get(id) === entry) {
    try {
      const frame = await receiver.data(800);
      if (frame.type !== 'video') continue;
      const now = Date.now();
      if (now - entry.lastFrameAt < 32) continue;
      entry.lastFrameAt = now;

      const width = frame.xres;
      const height = frame.yres;
      const rowBytes = width * 4;
      const stride = frame.lineStrideBytes || rowBytes;
      const minimumBytes = stride * (height - 1) + rowBytes;
      if (!width || !height || stride < rowBytes || frame.data.byteLength < minimumBytes) {
        throw new Error(`Frame NDI non valido (${width}×${height}, stride ${stride})`);
      }
      if (frame.fourCC !== ndi.FourCC.RGBX && frame.fourCC !== ndi.FourCC.RGBA) {
        throw new Error(`Formato colore NDI non gestito (${frame.fourCC})`);
      }
      const bytes = Buffer.allocUnsafe(rowBytes * height);
      const incoming = frame.data;
      for (let row = 0; row < height; row += 1) {
        const destinationStart = row * rowBytes;
        incoming.copy(bytes, destinationStart, row * stride, row * stride + rowBytes);
        // RGBX has no alpha channel. Its fourth byte is padding and may be zero;
        // WebGL treats this buffer as RGBA, so make those pixels opaque.
        if (frame.fourCC === ndi.FourCC.RGBX) {
          for (let pixel = destinationStart + 3; pixel < destinationStart + rowBytes; pixel += 4) {
            bytes[pixel] = 255;
          }
        }
      }
      post({ type: 'frame', sourceId: id, width, height, bytes });
      entry.frameCount += 1;
      if (entry.frameCount === 1) publishStatus();
    } catch (error) {
      if (!entry.closed) {
        const now = Date.now();
        if (now - entry.lastErrorAt >= 5000) {
          entry.lastErrorAt = now;
          post({ type: 'source-error', sourceId: id, error: error instanceof Error ? error.message : String(error) });
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  }
  if (receivers.get(id) === entry) receivers.delete(id);
  try {
    receiver.destroy();
  } catch (_error) {
    /* noop */
  }
  publishStatus();
}

async function syncReceivers() {
  if (!ready) return;
  if (syncingReceivers) {
    receiverSyncPending = true;
    return;
  }
  syncingReceivers = true;
  try {
    do {
      receiverSyncPending = false;
      const available = new Map(finderSources.map((source) => [sourceId(source), source]));
      for (const id of receivers.keys()) {
        if (!wantedSources.has(id)) await stopReceiver(id);
      }
      for (const [id] of wantedSources) {
        if (receivers.has(id) || connectingReceivers.has(id)) continue;
        const source = available.get(id);
        if (!source || (receiverRetryAt.get(id) || 0) > Date.now()) continue;
        connectingReceivers.add(id);
        try {
          const receiver = await ndi.receive({
            source,
            colorFormat: ndi.ColorFormat.RGBX_RGBA,
            bandwidth: ndi.Bandwidth.Highest,
            allowVideoFields: false,
            name: 'StaffVJ Input',
          });
          receiverRetryAt.delete(id);
          if (!wantedSources.has(id)) receiver.destroy();
          else void streamReceiver(id, receiver);
        } catch (error) {
          receiverRetryAt.set(id, Date.now() + 4000);
          post({ type: 'source-error', sourceId: id, error: error instanceof Error ? error.message : String(error) });
        } finally {
          connectingReceivers.delete(id);
        }
      }
    } while (receiverSyncPending);
  } finally {
    syncingReceivers = false;
  }
  publishStatus();
}

async function refreshSources() {
  if (!ready || discovering) return;
  discovering = true;
  try {
    const finder = await ndi.find({ showLocalSources: true });
    await finder.wait(900);
    finderSources = finder.sources().map((source) => ({
      id: sourceId(source),
      name: source.name,
      urlAddress: source.urlAddress,
    }));
    finder.destroy();
    post({ type: 'sources', sources: finderSources });
    await syncReceivers();
  } catch (error) {
    publishStatus(error instanceof Error ? error.message : String(error));
  } finally {
    discovering = false;
  }
}

async function setOutput(enabled, name) {
  if (!ready) {
    publishStatus('NDI non disponibile su questa installazione o architettura');
    return;
  }
  const nextName = String(name || 'StaffVJ Program').trim().slice(0, 128) || 'StaffVJ Program';
  if (sender && (!enabled || senderName !== nextName)) {
    try {
      sender.destroy();
    } catch (_error) {
      /* noop */
    }
    sender = null;
    pendingVideoFrame = null;
  }
  if (!enabled) {
    senderName = '';
    lastOutputError = null;
    publishStatus();
    return;
  }
  if (!sender) {
    try {
      sender = await ndi.send({ name: nextName, clockVideo: true, clockAudio: false });
      senderName = nextName;
      lastOutputError = null;
    } catch (error) {
      lastOutputError = error instanceof Error ? error.message : String(error);
      sender = null;
    }
  }
  publishStatus();
}

function queueVideoFrame(message) {
  if (!sender || !message?.width || !message?.height || !message?.bytes) return;
  pendingVideoFrame = message;
  if (sendingVideo) return;
  sendingVideo = true;
  void (async () => {
    while (sender && pendingVideoFrame) {
      const frame = pendingVideoFrame;
      pendingVideoFrame = null;
      const buffer = Buffer.from(frame.bytes);
      try {
        await sender.video({
          type: 'video',
          xres: frame.width,
          yres: frame.height,
          frameRateN: 30,
          frameRateD: 1,
          pictureAspectRatio: frame.width / frame.height,
          fourCC: ndi.FourCC.RGBA,
          frameFormatType: ndi.FrameType.Progressive,
          lineStrideBytes: frame.width * 4,
          data: buffer,
          timecode: ndi.TIMECODE_SYNTHESIZE,
        });
      } catch (error) {
        lastOutputError = error instanceof Error ? error.message : String(error);
        publishStatus();
      }
    }
    sendingVideo = false;
  })();
}

async function initialize() {
  try {
    const module = await import('grandi');
    ndi = module.default || module.grandi || module;
    if (!ndi.isSupportedCPU() || !ndi.initialize()) {
      throw new Error('NDI non supportato dalla CPU o dal runtime installato');
    }
    ready = true;
    publishStatus();
    void refreshSources();
    setInterval(() => void refreshSources(), 5000);
    setInterval(() => publishStatus(), 1000);
  } catch (error) {
    publishStatus(error instanceof Error ? error.message : String(error));
  }
}

parentPort?.on('message', ({ data }) => {
  if (!data || typeof data.type !== 'string') return;
  if (data.type === 'discover') {
    void refreshSources();
  } else if (data.type === 'watch') {
    wantedSources = new Map(
      (Array.isArray(data.sources) ? data.sources : [])
        .filter((source) => source && typeof source.id === 'string' && typeof source.name === 'string')
        .map((source) => [source.id, { name: source.name, urlAddress: source.urlAddress }]),
    );
    void syncReceivers();
  } else if (data.type === 'output') {
    void setOutput(Boolean(data.enabled), data.name);
  } else if (data.type === 'frame') {
    queueVideoFrame(data);
  } else if (data.type === 'shutdown') {
    for (const id of receivers.keys()) void stopReceiver(id);
    try {
      sender?.destroy();
      ndi?.destroy();
    } catch (_error) {
      /* shutdown best effort */
    }
    process.exit(0);
  }
});

void initialize();
