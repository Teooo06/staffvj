const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  screen,
  session,
  systemPreferences,
  powerSaveBlocker,
  utilityProcess,
} = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { Readable } = require('node:stream');
const { pathToFileURL } = require('node:url');

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const ROOT = path.join(__dirname, '..');
const DIST_INDEX = path.join(ROOT, 'dist', 'index.html');
const DEV_URL = 'http://127.0.0.1:5173';
const SMOKE = process.env.VJ_SMOKE === '1';
const BROWSER_WIDTH = 960;
const BROWSER_HEIGHT = 540;
const BROWSER_FPS = 24;
let browserFrameRate = BROWSER_FPS;

if (SMOKE) {
  try {
    app.setPath('userData', path.join(os.tmpdir(), 'staffvj-smoke-profile'));
  } catch (error) {
    console.warn('[smoke] profilo temporaneo non impostato', error);
  }
}

app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (isWindows) {
  app.commandLine.appendSwitch('force_high_performance_gpu');
}

let controlWindow = null;
let outputWindow = null;
let ndiWindow = null;
let latestState = null;
let latestTransport = null;
let latestPerformanceSettings = {
  mode: 'balanced',
  previewResolution: 540,
  previewFps: 30,
  browserFps: 24,
  outputResolution: 1080,
  outputFps: 60,
};
let sleepBlockerId = null;
let smokeTimer = null;
const browserSources = new Map();
let ndiWorker = null;
let ndiSources = [];
let ndiStatus = {
  available: false,
  version: null,
  error: 'Avvio del runtime NDI…',
  outputEnabled: false,
  outputName: '',
  receiving: [],
  streaming: [],
};
let pendingNdiSourcesRequest = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vjmedia',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const VIDEO_EXT = new Set(['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'ogv', 'ogg']);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg']);

const MIME = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  json: 'application/json',
};

function extOf(filePath) {
  return path.extname(filePath).slice(1).toLowerCase();
}

function mimeOf(filePath) {
  return MIME[extOf(filePath)] || 'application/octet-stream';
}

function mediaKind(filePath) {
  const ext = extOf(filePath);
  if (VIDEO_EXT.has(ext)) return 'video';
  if (IMAGE_EXT.has(ext)) return 'image';
  return 'video';
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  };
}

async function handleMediaRequest(request) {
  try {
    const url = new URL(request.url);
    const filePath = url.searchParams.get('p');
    if (!filePath) return new Response('Percorso mancante', { status: 400 });

    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return new Response('File non trovato', { status: 404 });

    const headers = {
      'Content-Type': mimeOf(filePath),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      ...corsHeaders(),
    };

    if (request.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: { ...headers, 'Content-Length': String(stat.size) },
      });
    }

    const rangeHeader = request.headers.get('Range') || request.headers.get('range');
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if (match) {
        const size = stat.size;
        let start = match[1] ? Number(match[1]) : 0;
        let end = match[2] ? Number(match[2]) : size - 1;
        if (!match[1] && match[2]) {
          start = Math.max(0, size - Number(match[2]));
          end = size - 1;
        }
        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
          return new Response('Range non valido', {
            status: 416,
            headers: { ...headers, 'Content-Range': `bytes */${size}` },
          });
        }
        end = Math.min(end, size - 1);
        const stream = fs.createReadStream(filePath, { start, end });
        return new Response(Readable.toWeb(stream), {
          status: 206,
          headers: {
            ...headers,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(end - start + 1),
          },
        });
      }
    }

    const stream = fs.createReadStream(filePath);
    return new Response(Readable.toWeb(stream), {
      status: 200,
      headers: { ...headers, 'Content-Length': String(stat.size) },
    });
  } catch (error) {
    console.error('[media]', error);
    return new Response('Errore lettura file', { status: 500 });
  }
}

function setupPermissions() {
  const allowed = new Set([
    'media',
    'audioCapture',
    'videoCapture',
    'midi',
    'midiSysex',
    'fullscreen',
    'clipboard-sanitized-write',
  ]);

  const isTrustedRenderer = (webContents) =>
    webContents === controlWindow?.webContents ||
    webContents === outputWindow?.webContents ||
    webContents === ndiWindow?.webContents;

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(isTrustedRenderer(webContents) && allowed.has(permission));
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return isTrustedRenderer(webContents) && allowed.has(permission);
  });
}

function sendBrowserFrame(webContents, entry) {
  if (!webContents || webContents.isDestroyed() || !entry?.frame) return;
  webContents.send('browser:frame', {
    sourceId: entry.id,
    width: entry.frame.width,
    height: entry.frame.height,
    sequence: entry.frame.sequence,
    bytes: entry.frame.bytes,
  });
}

function broadcastBrowserFrame(entry) {
  sendBrowserFrame(controlWindow?.webContents, entry);
  sendBrowserFrame(outputWindow?.webContents, entry);
  sendBrowserFrame(ndiWindow?.webContents, entry);
}

function sendBrowserFrames(webContents) {
  for (const entry of browserSources.values()) sendBrowserFrame(webContents, entry);
}

function sendNdiStatus(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  const status = webContents === outputWindow?.webContents
    ? { ...ndiStatus, outputEnabled: false, outputName: '' }
    : ndiStatus;
  webContents.send('ndi:status', status);
}

function broadcastNdiStatus() {
  sendNdiStatus(controlWindow?.webContents);
  sendNdiStatus(outputWindow?.webContents);
  sendNdiStatus(ndiWindow?.webContents);
}

function startNdiWorker() {
  if (ndiWorker) return;
  try {
    const workerPath = app.isPackaged
      ? path.join(path.dirname(app.getAppPath()), 'app.asar.unpacked', 'electron', 'ndi-worker.cjs')
      : path.join(__dirname, 'ndi-worker.cjs');
    ndiWorker = utilityProcess.fork(workerPath, [], {
      serviceName: 'StaffVJ NDI',
    });
    ndiWorker.on('message', (message) => {
      if (!message || typeof message.type !== 'string') return;
      if (message.type === 'status') {
        ndiStatus = { ...ndiStatus, ...message };
        broadcastNdiStatus();
        if (message.error && !message.outputEnabled && ndiWindow && !ndiWindow.isDestroyed()) {
          ndiWindow.close();
        }
      } else if (message.type === 'sources') {
        ndiSources = Array.isArray(message.sources) ? message.sources : [];
        controlWindow?.webContents.send('ndi:sources', ndiSources);
        if (pendingNdiSourcesRequest) {
          clearTimeout(pendingNdiSourcesRequest.timer);
          pendingNdiSourcesRequest.resolve(ndiSources);
          pendingNdiSourcesRequest = null;
        }
      } else if (message.type === 'frame') {
        controlWindow?.webContents.send('ndi:frame', message);
        outputWindow?.webContents.send('ndi:frame', message);
        ndiWindow?.webContents.send('ndi:frame', message);
      } else if (message.type === 'remove') {
        controlWindow?.webContents.send('ndi:remove', message.sourceId);
        outputWindow?.webContents.send('ndi:remove', message.sourceId);
        ndiWindow?.webContents.send('ndi:remove', message.sourceId);
      } else if (message.type === 'source-error') {
        controlWindow?.webContents.send('ndi:source-error', message);
      }
    });
    ndiWorker.on('exit', (code) => {
      ndiWorker = null;
      ndiStatus = {
        ...ndiStatus,
        available: false,
        outputEnabled: false,
        receiving: [],
        error: `Processo NDI terminato (${code})`,
      };
      broadcastNdiStatus();
    });
    if (latestState) syncNdiSources(latestState);
  } catch (error) {
    ndiStatus = {
      ...ndiStatus,
      error: error instanceof Error ? error.message : String(error),
    };
    broadcastNdiStatus();
  }
}

function syncNdiSources(showState) {
  if (!ndiWorker) return;
  const sources = [];
  for (const deckId of ['A', 'B']) {
    const layers = showState?.decks?.[deckId]?.layers;
    if (!Array.isArray(layers)) continue;
    for (const layer of layers) {
      if (layer?.source?.kind === 'ndi') sources.push(layer.source);
    }
  }
  const unique = [...new Map(sources.map((source) => [source.sourceId, {
    id: source.sourceId,
    name: source.sourceName,
    urlAddress: source.urlAddress,
  }])).values()];
  ndiWorker.postMessage({ type: 'watch', sources: unique });
}

function requestNdiSources() {
  if (!ndiWorker) return Promise.resolve(ndiSources);
  if (pendingNdiSourcesRequest) return pendingNdiSourcesRequest.promise;
  let resolveRequest;
  const promise = new Promise((resolve) => { resolveRequest = resolve; });
  const timer = setTimeout(() => {
    pendingNdiSourcesRequest = null;
    resolveRequest(ndiSources);
  }, 1800);
  pendingNdiSourcesRequest = { promise, resolve: resolveRequest, timer };
  ndiWorker.postMessage({ type: 'discover' });
  return promise;
}

function destroyBrowserSource(sourceId) {
  const entry = browserSources.get(sourceId);
  if (!entry) return;
  browserSources.delete(sourceId);
  if (!entry.window.isDestroyed()) entry.window.destroy();
  for (const win of [controlWindow, outputWindow, ndiWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send('browser:remove', sourceId);
  }
}

function browserSourceSignature(item) {
  return `${item.path || ''}\n${item.url || ''}`;
}

function createBrowserSource(item) {
  const win = new BrowserWindow({
    width: BROWSER_WIDTH,
    height: BROWSER_HEIGHT,
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      webgl: true,
    },
  });
  const entry = {
    id: item.id,
    signature: browserSourceSignature(item),
    window: win,
    frame: null,
    sequence: 0,
    localPath: item.path || null,
  };
  browserSources.set(item.id, entry);
  win.webContents.setAudioMuted(true);
  win.webContents.setFrameRate(browserFrameRate);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, target) => {
    let permitted = false;
    try {
      const parsed = new URL(target);
      permitted = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      if (entry.localPath && parsed.protocol === 'file:') {
        permitted = parsed.href.split('#')[0] === pathToFileURL(entry.localPath).href;
      }
    } catch (_error) {
      permitted = false;
    }
    if (!permitted) event.preventDefault();
  });
  win.webContents.on('paint', (_event, _dirty, image) => {
    if (image.isEmpty() || browserSources.get(item.id) !== entry) return;
    try {
      const bytes = image.toJPEG(72);
      if (!bytes.length) return;
      entry.sequence += 1;
      entry.frame = {
        width: image.getSize().width,
        height: image.getSize().height,
        sequence: entry.sequence,
        bytes,
      };
      broadcastBrowserFrame(entry);
    } catch (error) {
      console.warn('[browser source] frame non disponibile', error);
    }
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.warn(`[browser source:${item.name}] renderer terminato`, details);
  });
  win.on('closed', () => {
    if (browserSources.get(item.id) === entry) {
      browserSources.delete(item.id);
      for (const target of [controlWindow, outputWindow]) {
        if (target && !target.isDestroyed()) target.webContents.send('browser:remove', item.id);
      }
    }
  });

  const load = item.path ? win.loadFile(item.path) : win.loadURL(item.url);
  void load.catch((error) => {
    console.warn(`[browser source:${item.name}] caricamento non riuscito`, error?.message || error);
  });
  return entry;
}

function syncBrowserSources(showState) {
  const library = new Map((Array.isArray(showState?.library) ? showState.library : []).map((item) => [item.id, item]));
  const wanted = new Map();
  for (const deckId of ['A', 'B']) {
    const layers = showState?.decks?.[deckId]?.layers;
    if (!Array.isArray(layers)) continue;
    for (const layer of layers) {
      const source = layer?.source;
      if (source?.kind !== 'media') continue;
      const item = library.get(source.mediaId);
      if (item?.kind === 'browser' && (item.path || item.url)) wanted.set(item.id, item);
    }
  }

  for (const [sourceId, entry] of browserSources) {
    const item = wanted.get(sourceId);
    if (!item || browserSourceSignature(item) !== entry.signature) destroyBrowserSource(sourceId);
  }
  for (const item of wanted.values()) {
    if (!browserSources.has(item.id)) createBrowserSource(item);
  }
}

async function loadRenderer(win, search) {
  if (!app.isPackaged && process.env.VJ_LOAD_DIST !== '1') {
    try {
      const suffix = search ? `?${search}` : '';
      await win.loadURL(`${DEV_URL}/${suffix}`);
      return;
    } catch (error) {
      console.warn('[dev server non raggiungibile, uso dist]', error?.message || error);
    }
  }
  await win.loadFile(DIST_INDEX, search ? { search } : undefined);
}

function webPreferences() {
  return {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    backgroundThrottling: false,
    webgl: true,
  };
}

function createControlWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: '#07080c',
    title: 'StaffVJ',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 18, y: 18 } : undefined,
    titleBarOverlay: isMac
      ? undefined
      : {
          color: '#07080c',
          symbolColor: '#8b94a7',
          height: 54,
        },
    webPreferences: webPreferences(),
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.on('console-message', (event) => {
    console.log(
      `[renderer:${event.level}] ${event.message} (${event.sourceId}:${event.lineNumber})`,
    );
  });

  win.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('[renderer] caricamento fallito', code, description);
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer] processo terminato', details);
  });

  win.on('closed', () => {
    controlWindow = null;
    if (outputWindow && !outputWindow.isDestroyed()) outputWindow.close();
    if (ndiWindow && !ndiWindow.isDestroyed()) ndiWindow.close();
    for (const sourceId of browserSources.keys()) destroyBrowserSource(sourceId);
  });

  void loadRenderer(win);
  controlWindow = win;
  return win;
}

function createOutputWindow(displayId) {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.destroy();
    outputWindow = null;
  }

  const displays = screen.getAllDisplays();
  const display =
    displays.find((entry) => String(entry.id) === String(displayId)) ||
    screen.getPrimaryDisplay();
  const { x, y, width, height } = display.bounds;

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    show: false,
    backgroundColor: '#000000',
    title: 'StaffVJ Output',
    webPreferences: webPreferences(),
  });

  win.setMenuBarVisibility(false);
  win.setAspectRatio(0);
  outputWindow = win;

  win.once('ready-to-show', () => {
    win.showInactive();
    if (isMac) {
      win.setSimpleFullScreen(true);
    } else {
      win.setFullScreen(true);
    }
    win.focus();
    if (!sleepBlockerId) {
      sleepBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    }
  });

  win.webContents.on('did-finish-load', () => {
    sendSnapshot(win);
  });

  win.on('closed', () => {
    outputWindow = null;
    if (sleepBlockerId && !outputWindow) {
      try {
        powerSaveBlocker.stop(sleepBlockerId);
      } catch (_error) {
        /* noop */
      }
      sleepBlockerId = null;
    }
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('output:closed');
    }
  });

  void loadRenderer(win, 'output=1');
  return win;
}

function createNdiOutputWindow() {
  if (ndiWindow && !ndiWindow.isDestroyed()) return ndiWindow;
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    backgroundColor: '#000000',
    title: 'StaffVJ NDI Program',
    webPreferences: webPreferences(),
  });
  ndiWindow = win;
  win.webContents.on('did-finish-load', () => sendSnapshot(win));
  win.on('closed', () => { ndiWindow = null; });
  void loadRenderer(win, 'output=1&ndi=1');
  return win;
}

function closeNdiOutputWindow() {
  if (ndiWindow && !ndiWindow.isDestroyed()) ndiWindow.close();
}

function sendSnapshot(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('output:snapshot', {
    state: latestState,
    transport: latestTransport,
    performance: latestPerformanceSettings,
  });
}

function displayList() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((display, index) => ({
    id: display.id,
    label: display.label || `Schermo ${index + 1}`,
    width: display.size.width,
    height: display.size.height,
    scaleFactor: display.scaleFactor,
    primary: display.id === primary.id,
    bounds: display.bounds,
  }));
}

function registerIpc() {
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  }));

  ipcMain.handle('app:ask-media-access', async (_event, kind) => {
    if (!isMac || !systemPreferences.askForMediaAccess) return true;
    try {
      if (kind === 'camera') return await systemPreferences.askForMediaAccess('camera');
      if (kind === 'microphone') return await systemPreferences.askForMediaAccess('microphone');
      return true;
    } catch (error) {
      console.warn('[permissions]', error);
      return false;
    }
  });

  ipcMain.handle('media:open-dialog', async () => {
    if (!controlWindow) return [];
    const result = await dialog.showOpenDialog(controlWindow, {
      title: 'Importa video e immagini',
      buttonLabel: 'Importa',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video', extensions: [...VIDEO_EXT] },
        { name: 'Immagini', extensions: [...IMAGE_EXT] },
        { name: 'Tutti i media', extensions: [...VIDEO_EXT, ...IMAGE_EXT] },
        { name: 'Tutti i file', extensions: ['*'] },
      ],
    });
    if (result.canceled) return [];
    return result.filePaths.map((filePath) => {
      let size = 0;
      try {
        size = fs.statSync(filePath).size;
      } catch (_error) {
        /* noop */
      }
      return {
        path: filePath,
        name: path.basename(filePath),
        size,
        kind: mediaKind(filePath),
      };
    });
  });

  ipcMain.handle('browser:open-html-dialog', async () => {
    if (!controlWindow) return null;
    const result = await dialog.showOpenDialog(controlWindow, {
      title: 'Scegli una pagina HTML',
      properties: ['openFile'],
      filters: [{ name: 'Pagine HTML', extensions: ['html', 'htm'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    return { path: filePath, name: path.basename(filePath) };
  });

  ipcMain.handle('project:save', async (_event, data) => {
    if (!controlWindow) return { canceled: true };
    const result = await dialog.showSaveDialog(controlWindow, {
      title: 'Salva progetto StaffVJ',
      defaultPath: 'StaffVJ-show.json',
      filters: [{ name: 'Progetto StaffVJ', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    try {
      await fsp.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf8');
      return { canceled: false, filePath: result.filePath };
    } catch (error) {
      dialog.showErrorBox('Salvataggio non riuscito', String(error));
      return { canceled: false, error: String(error) };
    }
  });

  ipcMain.handle('project:load', async () => {
    if (!controlWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(controlWindow, {
      title: 'Apri progetto StaffVJ',
      properties: ['openFile'],
      filters: [{ name: 'Progetto StaffVJ', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    try {
      const raw = await fsp.readFile(result.filePaths[0], 'utf8');
      return { canceled: false, filePath: result.filePaths[0], data: JSON.parse(raw) };
    } catch (error) {
      dialog.showErrorBox('Apertura non riuscita', String(error));
      return { canceled: false, error: String(error) };
    }
  });

  ipcMain.handle('output:list-displays', () => displayList());

  ipcMain.handle('output:open', (_event, displayId) => {
    createOutputWindow(displayId);
    return true;
  });

  ipcMain.handle('output:close', () => {
    if (outputWindow && !outputWindow.isDestroyed()) outputWindow.close();
    return true;
  });

  ipcMain.handle('output:reload', (event) => {
    if (!controlWindow || event.sender !== controlWindow.webContents) return false;
    if (!outputWindow || outputWindow.isDestroyed()) return false;
    outputWindow.webContents.reload();
    return true;
  });

  ipcMain.handle('app:reload-control', (event) => {
    if (!controlWindow || event.sender !== controlWindow.webContents) return false;
    controlWindow.webContents.reload();
    return true;
  });

  ipcMain.handle('browser:reload-all', (event) => {
    if (!controlWindow || event.sender !== controlWindow.webContents) return false;
    for (const entry of browserSources.values()) {
      if (!entry.window.isDestroyed()) entry.window.webContents.reload();
    }
    return true;
  });

  ipcMain.handle('performance:set-settings', (event, payload) => {
    if (!controlWindow || event.sender !== controlWindow.webContents || !payload) return false;
    const allowed = (value, options) => options.includes(Number(value));
    if (
      !allowed(payload.previewResolution, [360, 540, 720]) ||
      !allowed(payload.previewFps, [24, 30, 60]) ||
      !allowed(payload.browserFps, [15, 24, 30]) ||
      !allowed(payload.outputResolution, [720, 1080]) ||
      !allowed(payload.outputFps, [30, 60]) ||
      !['performance', 'balanced', 'quality', 'custom'].includes(payload.mode)
    ) return false;

    latestPerformanceSettings = {
      mode: payload.mode,
      previewResolution: Number(payload.previewResolution),
      previewFps: Number(payload.previewFps),
      browserFps: Number(payload.browserFps),
      outputResolution: Number(payload.outputResolution),
      outputFps: Number(payload.outputFps),
    };
    browserFrameRate = latestPerformanceSettings.browserFps;
    for (const entry of browserSources.values()) {
      if (!entry.window.isDestroyed()) entry.window.webContents.setFrameRate(browserFrameRate);
    }
    for (const win of [outputWindow, ndiWindow]) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('performance:settings', latestPerformanceSettings);
      }
    }
    return true;
  });

  ipcMain.handle('output:is-open', () => Boolean(outputWindow && !outputWindow.isDestroyed()));

  ipcMain.handle('output:get-snapshot', () => ({
    state: latestState,
    transport: latestTransport,
    performance: latestPerformanceSettings,
  }));

  ipcMain.handle('ndi:list-sources', () => ndiSources);
  ipcMain.handle('ndi:refresh-sources', () => requestNdiSources());
  ipcMain.handle('ndi:get-status', () => ndiStatus);
  ipcMain.handle('ndi:set-output', (event, payload) => {
    if (!controlWindow || event.sender !== controlWindow.webContents || !ndiWorker) return false;
    if (payload?.enabled) createNdiOutputWindow();
    else closeNdiOutputWindow();
    ndiWorker.postMessage({
      type: 'output',
      enabled: Boolean(payload?.enabled),
      name: typeof payload?.name === 'string' ? payload.name : 'StaffVJ Program',
    });
    return true;
  });

  ipcMain.on('ndi:output-frame', (event, payload) => {
    if (!ndiWindow || event.sender !== ndiWindow.webContents || !ndiWorker) return;
    ndiWorker.postMessage({ type: 'frame', ...payload });
  });

  ipcMain.on('output:state', (event, payload) => {
    if (!controlWindow || event.sender !== controlWindow.webContents) return;
    latestState = payload;
    syncBrowserSources(payload);
    syncNdiSources(payload);
    if (outputWindow && !outputWindow.isDestroyed()) {
      outputWindow.webContents.send('output:state', payload);
    }
    if (ndiWindow && !ndiWindow.isDestroyed()) ndiWindow.webContents.send('output:state', payload);
  });

  ipcMain.on('output:transport', (event, payload) => {
    if (!controlWindow || event.sender !== controlWindow.webContents) return;
    latestTransport = payload;
    if (outputWindow && !outputWindow.isDestroyed()) {
      outputWindow.webContents.send('output:transport', payload);
    }
    if (ndiWindow && !ndiWindow.isDestroyed()) ndiWindow.webContents.send('output:transport', payload);
  });

  ipcMain.on('app:renderer-ready', (event) => {
    if (outputWindow && !outputWindow.isDestroyed() && event.sender === outputWindow.webContents) {
      sendSnapshot(outputWindow);
    }
    if (ndiWindow && !ndiWindow.isDestroyed() && event.sender === ndiWindow.webContents) {
      sendSnapshot(ndiWindow);
    }
    if (controlWindow && event.sender === controlWindow.webContents) {
      sendBrowserFrames(event.sender);
      sendNdiStatus(event.sender);
      event.sender.send('ndi:sources', ndiSources);
      if (SMOKE) {
        clearTimeout(smokeTimer);
        smokeTimer = setTimeout(async () => {
          try {
            const image = await controlWindow.webContents.capturePage();
            const target = path.join(ROOT, 'smoke-control.png');
            await fsp.writeFile(target, image.toPNG());
            console.log('[smoke] screenshot:', target);
          } catch (error) {
            console.error('[smoke]', error);
          } finally {
            app.quit();
          }
        }, 2200);
      }
    }
    if (outputWindow && event.sender === outputWindow.webContents) {
      sendBrowserFrames(event.sender);
      sendNdiStatus(event.sender);
    }
    if (ndiWindow && event.sender === ndiWindow.webContents) {
      sendBrowserFrames(event.sender);
      sendNdiStatus(event.sender);
    }
  });

  ipcMain.on('app:quit', () => app.quit());
}

app.whenReady().then(() => {
  app.setName('StaffVJ');
  setupPermissions();
  protocol.handle('vjmedia', handleMediaRequest);
  registerIpc();

  screen.on('display-added', () => {
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('output:displays-changed', displayList());
    }
  });
  screen.on('display-removed', () => {
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('output:displays-changed', displayList());
    }
  });

  createControlWindow();
  startNdiWorker();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (ndiWorker) {
    try {
      ndiWorker.postMessage({ type: 'shutdown' });
    } catch (_error) {
      /* il processo può essere già terminato */
    }
  }
  if (sleepBlockerId) {
    try {
      powerSaveBlocker.stop(sleepBlockerId);
    } catch (_error) {
      /* noop */
    }
  }
});
