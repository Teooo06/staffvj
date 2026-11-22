import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useShowRuntime } from './hooks/useShowRuntime';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { TopBar } from './components/TopBar';
import { MediaPanel } from './components/MediaPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { Crossfader } from './components/Crossfader';
import { DecksBar } from './components/DecksBar';
import { Inspector } from './components/Inspector';
import { EffectBrowser } from './components/EffectBrowser';
import { Shortcuts } from './components/Shortcuts';
import { Toasts } from './components/Toasts';
import { SettingsPage } from './components/SettingsPage';
import { cx } from './lib/utils';

function constrainPanelWidths(widths: { media: number; inspector: number }) {
  let media = Math.min(420, Math.max(190, widths.media));
  let inspector = Math.min(460, Math.max(250, widths.inspector));
  const maxTotal = Math.max(440, window.innerWidth - 422);
  let overflow = Math.max(0, media + inspector - maxTotal);
  const reduceMedia = Math.min(overflow, media - 190);
  media -= reduceMedia;
  overflow -= reduceMedia;
  inspector = Math.max(250, inspector - overflow);
  return { media, inspector };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const auxCanvasRef = useRef<HTMLCanvasElement>(null);
  const runtime = useShowRuntime(canvasRef, auxCanvasRef);
  useKeyboardShortcuts(runtime.tap, runtime.nudgeBpm);
  const isMac = window.vj?.platform === 'darwin';
  const [panelWidths, setPanelWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('staffvj:panel-widths');
      if (saved) {
        const parsed = JSON.parse(saved) as { media?: number; inspector?: number };
        return constrainPanelWidths({ media: parsed.media ?? 292, inspector: parsed.inspector ?? 338 });
      }
    } catch (_error) {
      /* ignora preferenze locali non leggibili */
    }
    return { media: 292, inspector: 338 };
  });

  useEffect(() => {
    const resize = () => setPanelWidths((widths) => constrainPanelWidths(widths));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const resizePanel = (side: 'media' | 'inspector', event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidths[side];
    const move = (pointer: PointerEvent) => {
      const delta = pointer.clientX - startX;
      const next = side === 'media' ? startWidth + delta : startWidth - delta;
      setPanelWidths((current) => {
        const updated = constrainPanelWidths({ ...current, [side]: next });
        try {
          localStorage.setItem('staffvj:panel-widths', JSON.stringify(updated));
        } catch (_error) {
          /* il layout resta utilizzabile anche senza storage locale */
        }
        return updated;
      });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    window.addEventListener('pointercancel', stop, { once: true });
  };

  return (
    <div className={cx('app', isMac && 'is-mac')}>
      <TopBar
        transport={runtime.transport}
        onTap={runtime.tap}
        onBpmChange={runtime.setManualBpm}
      />
      <div
        className="app-body"
        style={{ gridTemplateColumns: `${panelWidths.media}px 7px minmax(360px, 1fr) 7px ${panelWidths.inspector}px` }}
      >
        <MediaPanel />
        <div className="resize-handle" role="separator" aria-orientation="vertical" aria-label="Ridimensiona libreria" onPointerDown={(event) => resizePanel('media', event)} />
        <main className="center-column">
          <PreviewPanel
            canvasRef={canvasRef}
            auxCanvasRef={auxCanvasRef}
            transport={runtime.transport}
            fps={runtime.fps}
            engineError={runtime.engineError}
            onRestartEngines={runtime.restartEngines}
          />
          <Crossfader />
          <DecksBar />
        </main>
        <div className="resize-handle" role="separator" aria-orientation="vertical" aria-label="Ridimensiona inspector" onPointerDown={(event) => resizePanel('inspector', event)} />
        <Inspector transport={runtime.transport} />
      </div>
      <EffectBrowser />
      <Shortcuts />
      <SettingsPage
        gpuRenderer={runtime.gpuRenderer}
        transport={runtime.transport}
        onTap={runtime.tap}
        onResetLayout={() => {
          const defaults = { media: 292, inspector: 338 };
          setPanelWidths(constrainPanelWidths(defaults));
          try {
            localStorage.setItem('staffvj:panel-widths', JSON.stringify(defaults));
          } catch (_error) {
            /* il layout viene comunque ripristinato per questa sessione */
          }
        }}
        onRestartEngines={runtime.restartEngines}
        onRestartAudio={runtime.restartAudio}
      />
      <Toasts />
    </div>
  );
}
