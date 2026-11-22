import { useEffect, useRef, useState } from 'react';
import { VJEngine } from '../engine/engine';
import type { ShowState, TransportData } from '../types';
import { usePreferencesStore } from '../preferences';

export function OutputApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const outputResolution = usePreferencesStore((state) => state.performance.outputResolution);
  const outputFps = usePreferencesStore((state) => state.performance.outputFps);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: VJEngine;
    try {
      const isNdiOutput = new URLSearchParams(window.location.search).has('ndi');
      engine = new VJEngine(canvas, {
        width: Math.round((outputResolution * 16) / 9),
        height: outputResolution,
        maxFps: isNdiOutput ? Math.min(30, outputFps) : outputFps,
      });
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'WebGL2 non disponibile');
      return;
    }

    document.body.classList.add('output-mode');
    let disposed = false;

    const applyState = (state: ShowState) => engine.setState(state);
    const applyTransport = (transport: TransportData) =>
      engine.setAudioLevels(
        transport.level,
        transport.beatPulse,
        transport.beatPosition,
        transport.bpm,
      );

    const offState = window.vj?.onState(applyState);
    const offTransport = window.vj?.onTransport(applyTransport);
    const offSnapshot = window.vj?.onSnapshot((snapshot) => {
      if (snapshot.state) applyState(snapshot.state);
      if (snapshot.transport) applyTransport(snapshot.transport);
      if (snapshot.performance) {
        usePreferencesStore.getState().setPerformanceFromRuntime(snapshot.performance);
      }
    });
    const offPerformanceSettings = window.vj?.onPerformanceSettings((settings) => {
      usePreferencesStore.getState().setPerformanceFromRuntime(settings);
    });
    const offBrowserFrame = window.vj?.onBrowserFrame((frame) => {
      engine.setBrowserFrame(frame.sourceId, frame.bytes, frame.sequence);
    });
    const offBrowserRemove = window.vj?.onBrowserRemove((sourceId) => {
      engine.removeBrowserFrame(sourceId);
    });
    const offNdiFrame = window.vj?.onNdiFrame((frame) => {
      engine.setNdiFrame(frame.sourceId, frame.bytes, frame.width, frame.height);
    });
    const offNdiRemove = window.vj?.onNdiRemove((sourceId) => {
      engine.removeNdiFrame(sourceId);
    });
    const applyNdiStatus = (status: { outputEnabled: boolean }) => {
      engine.setNdiOutput(
        status.outputEnabled
          ? (bytes, width, height) => window.vj?.sendNdiOutputFrame(bytes, width, height)
          : null,
      );
    };
    const offNdiStatus = window.vj?.onNdiStatus(applyNdiStatus);
    void window.vj?.getNdiStatus().then(applyNdiStatus).catch(() => {
      /* lo stato arriverà via IPC */
    });

    void window.vj
      ?.getSnapshot()
      .then((snapshot) => {
        if (disposed) return;
        if (snapshot.state) applyState(snapshot.state);
        if (snapshot.transport) applyTransport(snapshot.transport);
        if (snapshot.performance) {
          usePreferencesStore.getState().setPerformanceFromRuntime(snapshot.performance);
        }
      })
      .catch(() => {
        /* lo stato arriverà via IPC */
      });

    window.vj?.rendererReady();

    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener('contextmenu', prevent);

    return () => {
      disposed = true;
      offState?.();
      offTransport?.();
      offSnapshot?.();
      offPerformanceSettings?.();
      offBrowserFrame?.();
      offBrowserRemove?.();
      offNdiFrame?.();
      offNdiRemove?.();
      offNdiStatus?.();
      engine.setNdiOutput(null);
      document.removeEventListener('contextmenu', prevent);
      document.body.classList.remove('output-mode');
      engine.dispose();
    };
  }, [outputResolution, outputFps]);

  return (
    <>
      <canvas ref={canvasRef} className="output-canvas" />
      {error ? (
        <div className="output-error">
          <h1>StaffVJ Output</h1>
          <p>{error}</p>
        </div>
      ) : null}
    </>
  );
}
