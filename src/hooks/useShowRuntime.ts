import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { DeckId, TransportData } from '../types';
import type { AppStore, MonitorMode } from '../store';
import { buildShowState, useAppStore } from '../store';
import { VJEngine } from '../engine/engine';
import { TransportClock } from '../audio/transport';
import { EFFECT_DEFS, MAX_EFFECTS } from '../engine/effectDefs';
import { usePreferencesStore } from '../preferences';
import { clamp } from '../lib/utils';

const EMPTY_TRANSPORT: TransportData = {
  bpm: 124,
  level: 0,
  beatPulse: 0,
  beatPosition: 0,
  beatIndex: 0,
  beatInBar: 1,
  barNumber: 1,
  lastBeatAt: 0,
  barPhase: 0,
  playing: true,
  audioConnected: false,
  audioRunning: false,
  beatDetected: false,
  estimatedBpm: 0,
  beatConfidence: 0,
  onsetGraph: Array.from({ length: 64 }, () => 0),
  onsetMarkers: Array.from({ length: 64 }, () => 0),
  waveform: [],
  spectrum: [],
};

export interface ShowRuntime {
  transport: TransportData;
  fps: number;
  engineError: string | null;
  gpuRenderer: string;
  tap: () => void;
  setManualBpm: (value: number) => void;
  nudgeBpm: (delta: number) => void;
  restartEngines: () => void;
  restartAudio: () => void;
}

export function useShowRuntime(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  auxCanvasRef: RefObject<HTMLCanvasElement | null>,
): ShowRuntime {
  const engineRef = useRef<VJEngine | null>(null);
  const clockRef = useRef<TransportClock | null>(null);
  const [transport, setTransport] = useState<TransportData>(EMPTY_TRANSPORT);
  const [fps, setFps] = useState(0);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [gpuRenderer, setGpuRenderer] = useState('');
  const [engineGeneration, setEngineGeneration] = useState(0);
  const restartAudioRef = useRef<(() => void) | null>(null);
  const previewResolution = usePreferencesStore((state) => state.performance.previewResolution);
  const previewFps = usePreferencesStore((state) => state.performance.previewFps);
  const browserFps = usePreferencesStore((state) => state.performance.browserFps);
  const outputResolution = usePreferencesStore((state) => state.performance.outputResolution);
  const outputFps = usePreferencesStore((state) => state.performance.outputFps);

  useEffect(() => {
    void window.vj
      ?.setPerformanceSettings(usePreferencesStore.getState().performance)
      .catch((error) => console.warn('[prestazioni] sincronizzazione non riuscita', error));
  }, [previewResolution, previewFps, browserFps, outputResolution, outputFps]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const auxCanvas = auxCanvasRef.current;
    if (!canvas || !auxCanvas) return;

    let engine: VJEngine | null = null;
    let auxEngine: VJEngine | null = null;
    try {
      const previewWidth = Math.round((previewResolution * 16) / 9);
      const previewOptions = {
        width: previewWidth,
        height: previewResolution,
        maxFps: previewFps,
      };
      engine = new VJEngine(canvas, previewOptions);
      auxEngine = new VJEngine(auxCanvas, { ...previewOptions, monitor: 'A' });
    } catch (error) {
      engine?.dispose();
      auxEngine?.dispose();
      const message = error instanceof Error ? error.message : 'WebGL2 non disponibile';
      setEngineError(message);
      useAppStore.getState().toast(message, 'error');
      return;
    }
    if (!engine || !auxEngine) return;
    engineRef.current = engine;
    setGpuRenderer(engine.getGpuRenderer());

    const initial = useAppStore.getState();
    const clock = new TransportClock(initial.bpm);
    clockRef.current = clock;
    clock.setAudioSettings(initial.audio);
    const primaryMonitor = (state: AppStore): MonitorMode =>
      state.monitorLayout === 'studio'
        ? 'program'
        : state.monitorLayout === 'decks'
          ? 'A'
          : state.monitor;
    const secondaryMonitor = (state: AppStore): MonitorMode =>
      state.monitorLayout === 'studio' ? state.target.deck : 'B';
    engine.setMonitor(primaryMonitor(initial));
    auxEngine.setMonitor(secondaryMonitor(initial));
    engine.setState(buildShowState(initial));
    auxEngine.setState(buildShowState(initial));
    auxEngine.setActive(initial.monitorLayout !== 'single');

    let prevAudio = initial.audio;
    let prevBpm = initial.bpm;
    let audioConnecting = false;
    let disposed = false;

    const connectAudio = async (deviceId: string | null): Promise<void> => {
      if (audioConnecting) return;
      audioConnecting = true;
      try {
        if (window.vj) {
          const granted = await window.vj.askMediaAccess('microphone');
          if (!granted) {
            useAppStore
              .getState()
              .toast('Permesso microfono negato: abilitalo nelle impostazioni di sistema', 'error');
            if (useAppStore.getState().audio.enabled) {
              useAppStore.getState().setAudio({ enabled: false });
            }
            return;
          }
        }
        if (disposed) return;
        await clock.connectAudio(deviceId);
        if (disposed) clock.disconnectAudio();
      } catch (_error) {
        if (disposed) return;
        useAppStore
          .getState()
          .toast('Ingresso audio non disponibile: controlla i permessi', 'error');
        if (useAppStore.getState().audio.enabled) {
          useAppStore.getState().setAudio({ enabled: false });
        }
      } finally {
        audioConnecting = false;
      }
    };

    restartAudioRef.current = () => {
      if (audioConnecting) {
        useAppStore.getState().toast('Attendi che l’ingresso audio abbia finito di collegarsi', 'info');
        return;
      }
      clock.disconnectAudio();
      const currentAudio = useAppStore.getState().audio;
      if (currentAudio.enabled) void connectAudio(currentAudio.deviceId);
    };

    if (initial.audio.enabled) {
      void connectAudio(initial.audio.deviceId);
    }

    let lastStateSent = 0;
    let stateSendTimer: number | null = null;
    let lastTransportSent = 0;
    let lastTick = 0;
    let lastUiUpdate = 0;
    let lastFpsUpdate = 0;
    let lastAutopilotBeat = -1;
    let lastEngineError: string | null = null;
    const effectTimers: number[] = [];

    const sendState = (state: AppStore): void => {
      if (!window.vj) return;
      const now = performance.now();
      const delay = 40 - (now - lastStateSent);
      if (delay <= 0) {
        lastStateSent = now;
        window.vj.sendState(buildShowState(state));
        return;
      }
      if (stateSendTimer !== null) return;
      stateSendTimer = window.setTimeout(() => {
        stateSendTimer = null;
        lastStateSent = performance.now();
        window.vj?.sendState(buildShowState(useAppStore.getState()));
      }, delay);
    };

    const syncAudio = (state: AppStore): void => {
      const changed =
        state.audio.enabled !== prevAudio.enabled ||
        state.audio.deviceId !== prevAudio.deviceId;
      clock.setAudioSettings(state.audio);
      prevAudio = state.audio;
      if (!changed) return;
      if (!state.audio.enabled) {
        clock.disconnectAudio();
        return;
      }
      void connectAudio(state.audio.deviceId);
    };

    const applyState = (state: AppStore): void => {
      engine.setMonitor(primaryMonitor(state));
      auxEngine.setMonitor(secondaryMonitor(state));
      engine.setState(buildShowState(state));
      auxEngine.setState(buildShowState(state));
      auxEngine.setActive(state.monitorLayout !== 'single');
      if (state.bpm !== prevBpm) {
        clock.setBpm(state.bpm);
        prevBpm = state.bpm;
      }
      syncAudio(state);
      sendState(state);
    };

    const runAutopilot = (data: TransportData): void => {
      const state = useAppStore.getState();
      if (!state.autopilot.enabled) {
        lastAutopilotBeat = -1;
        return;
      }
      if (lastAutopilotBeat === data.beatIndex) return;
      lastAutopilotBeat = data.beatIndex;
      if (data.beatIndex % state.autopilot.everyBeats !== 0) return;

      const playable = state.library.filter(
        (item) =>
          item.kind === 'video' ||
          item.kind === 'image' ||
          item.kind === 'browser' ||
          item.kind === 'generator' ||
          item.kind === 'text',
      );
      if (state.crossfade > 0.02 && state.crossfade < 0.98) return;
      const liveDeck: DeckId = state.crossfade < 0.5 ? 'A' : 'B';
      const previewDeck: DeckId = liveDeck === 'A' ? 'B' : 'A';
      const useScene =
        state.scenes.length > 0 && (playable.length === 0 || Math.random() < 0.35);
      let changedLayer = -1;
      if (useScene) {
        const scene = state.scenes[Math.floor(Math.random() * state.scenes.length)];
        state.loadScene(scene.id, { deck: previewDeck, focusInspector: false, compactToTwo: true });
      } else {
        if (!playable.length) return;
        const pick = playable[Math.floor(Math.random() * playable.length)];
        state.clearLayer(previewDeck, 2);
        state.clearLayer(previewDeck, 3);
        const previewLayers = useAppStore.getState().decks[previewDeck].layers;
        // L2 is the base; L1 is the only automatic overlay and stays at half opacity.
        const layerIndex = !previewLayers[1]?.source
          ? 1
          : !previewLayers[0]?.source
            ? 0
            : Math.random() < 0.5
              ? 1
              : 0;
        state.triggerMedia(pick.id, previewDeck, layerIndex, { focusInspector: false });
        state.updateLayer(previewDeck, layerIndex, { opacity: layerIndex === 0 ? 0.5 : 1 });
        changedLayer = layerIndex;
      }

      if (state.autopilot.autoMix) {
        state.takeDeckLive(previewDeck, Math.max(450, (60000 / state.bpm) * 2));
      }

      if (state.autopilot.autoFx) {
        const activeState = useAppStore.getState();
        const candidateLayer =
          changedLayer >= 0
            ? changedLayer
            : activeState.decks[previewDeck].layers.findIndex((entry) => Boolean(entry.source));
        const layer = candidateLayer >= 0 ? activeState.decks[previewDeck].layers[candidateLayer] : null;
        if (layer && layer.effects.length < MAX_EFFECTS) {
          const candidates = EFFECT_DEFS.filter((def) => def.category !== 'Chiave');
          const def = candidates[Math.floor(Math.random() * candidates.length)];
          const scope = {
            kind: 'layer' as const,
            deck: previewDeck,
            layerIndex: candidateLayer,
          };
          state.addEffect(scope, def.type);
          const effects = useAppStore.getState().decks[previewDeck].layers[scope.layerIndex].effects;
          const created = effects[effects.length - 1];
          if (created) {
            const timer = window.setTimeout(() => {
              useAppStore.getState().removeEffect(scope, created.id);
            }, 12000);
            effectTimers.push(timer);
          }
        }
      }
    };

    const unsubStore = useAppStore.subscribe(applyState);
    sendState(initial);
    window.vj?.rendererReady();

    const offClosed = window.vj?.onOutputClosed(() => {
      useAppStore.getState().setOutputOpen(false);
    });
    const offDisplays = window.vj?.onDisplaysChanged((displays) => {
      useAppStore.getState().setDisplays(displays);
    });
    const latestBrowserSequence = new Map<string, number>();
    const offBrowserFrame = window.vj?.onBrowserFrame((frame) => {
      if (frame.sequence <= (latestBrowserSequence.get(frame.sourceId) ?? 0)) return;
      latestBrowserSequence.set(frame.sourceId, frame.sequence);
      const bytes = new Uint8Array(frame.bytes);
      void createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }))
        .then((bitmap) => {
          if (disposed || latestBrowserSequence.get(frame.sourceId) !== frame.sequence) {
            bitmap.close();
            return;
          }
          engine.setBrowserBitmap(frame.sourceId, bitmap, frame.sequence);
          auxEngine.setBrowserBitmap(frame.sourceId, bitmap, frame.sequence);
          bitmap.close();
        })
        .catch((error) => {
          console.warn('[browser source] decodifica condivisa non riuscita', error);
        });
    });
    const offBrowserRemove = window.vj?.onBrowserRemove((sourceId) => {
      latestBrowserSequence.delete(sourceId);
      engine.removeBrowserFrame(sourceId);
      auxEngine.removeBrowserFrame(sourceId);
    });
    const offNdiFrame = window.vj?.onNdiFrame((frame) => {
      engine.setNdiFrame(frame.sourceId, frame.bytes, frame.width, frame.height);
      auxEngine.setNdiFrame(frame.sourceId, frame.bytes, frame.width, frame.height);
    });
    const offNdiRemove = window.vj?.onNdiRemove((sourceId) => {
      engine.removeNdiFrame(sourceId);
      auxEngine.removeNdiFrame(sourceId);
    });
    void useAppStore.getState().refreshDisplays();

    let raf = 0;
    const tick = (now: number): void => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      if (now - lastTick < 30) return;
      lastTick = now;

      const data = clock.tick(now);
      const current = useAppStore.getState();
      if (
        current.audio.enabled &&
        current.audio.autoBpm &&
        Math.abs(data.bpm - current.bpm) >= 0.5
      ) {
        current.setBpm(data.bpm);
      }
      engine.setAudioLevels(data.level, data.beatPulse, data.beatPosition, data.bpm);
      auxEngine.setAudioLevels(data.level, data.beatPulse, data.beatPosition, data.bpm);
      runAutopilot(data);

      const error = engine.getError() ?? auxEngine.getError();
      if (error !== lastEngineError) {
        lastEngineError = error;
        setEngineError(error);
      }

      if (window.vj && now - lastTransportSent > 50) {
        lastTransportSent = now;
        window.vj.sendTransport(data);
      }
      if (now - lastUiUpdate > 90) {
        lastUiUpdate = now;
        setTransport(data);
      }
      if (now - lastFpsUpdate > 600) {
        lastFpsUpdate = now;
        setFps(engine.getFps());
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      unsubStore();
      offClosed?.();
      offDisplays?.();
      offBrowserFrame?.();
      offBrowserRemove?.();
      offNdiFrame?.();
      offNdiRemove?.();
      if (stateSendTimer !== null) clearTimeout(stateSendTimer);
      effectTimers.forEach((timer) => clearTimeout(timer));
      clock.dispose();
      restartAudioRef.current = null;
      auxEngine.dispose();
      engine.dispose();
      clockRef.current = null;
      engineRef.current = null;
    };
  }, [canvasRef, auxCanvasRef, previewResolution, previewFps, engineGeneration]);

  const tap = useCallback(() => {
    const clock = clockRef.current;
    if (!clock) return;
    const bpm = clock.tap();
    useAppStore.getState().setBpm(bpm);
  }, []);

  const setManualBpm = useCallback((value: number) => {
    const next = Math.round(clamp(value, 60, 200) * 10) / 10;
    clockRef.current?.setManualBpm(next);
    useAppStore.getState().setBpm(next);
  }, []);

  const nudgeBpm = useCallback(
    (delta: number) => {
      setManualBpm(useAppStore.getState().bpm + delta);
    },
    [setManualBpm],
  );

  const restartEngines = useCallback(() => {
    setEngineGeneration((generation) => generation + 1);
  }, []);

  const restartAudio = useCallback(() => {
    restartAudioRef.current?.();
  }, []);

  return { transport, fps, engineError, gpuRenderer, tap, setManualBpm, nudgeBpm, restartEngines, restartAudio };
}
