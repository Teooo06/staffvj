import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { DeckId, TransportData } from '../types';
import type { MonitorLayout, MonitorMode } from '../store';
import { useAppStore } from '../store';
import { cx } from '../lib/utils';
import { Icon } from './Icons';
import { usePreferencesStore } from '../preferences';

const MONITORS: Array<{ id: MonitorMode; label: string }> = [
  { id: 'A', label: 'A' },
  { id: 'program', label: 'Program' },
  { id: 'B', label: 'B' },
];

const LAYOUTS: Array<{ id: MonitorLayout; label: string; title: string }> = [
  { id: 'single', label: 'Program', title: 'Mostra un monitor' },
  { id: 'studio', label: 'Studio', title: 'Preview e uscita live' },
  { id: 'decks', label: 'A / B', title: 'Mostra entrambi i deck' },
];

export function PreviewPanel({
  canvasRef,
  auxCanvasRef,
  transport,
  fps,
  engineError,
  onRestartEngines,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  auxCanvasRef: RefObject<HTMLCanvasElement | null>;
  transport: TransportData;
  fps: number;
  engineError: string | null;
  onRestartEngines: () => void;
}) {
  const monitor = useAppStore((state) => state.monitor);
  const monitorLayout = useAppStore((state) => state.monitorLayout);
  const targetDeck = useAppStore((state) => state.target.deck);
  const setMonitor = useAppStore((state) => state.setMonitor);
  const setMonitorLayout = useAppStore((state) => state.setMonitorLayout);
  const blackout = useAppStore((state) => state.blackout);
  const outputOpen = useAppStore((state) => state.outputOpen);
  const crossfade = useAppStore((state) => state.crossfade);
  const takeDeckLive = useAppStore((state) => state.takeDeckLive);
  const performance = usePreferencesStore((state) => state.performance);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = () => setContextMenu(null);
    window.addEventListener('pointerdown', dismiss);
    return () => window.removeEventListener('pointerdown', dismiss);
  }, [contextMenu]);

  const liveDeck: DeckId = crossfade < 0.5 ? 'A' : 'B';
  const isMixing = crossfade > 0.02 && crossfade < 0.98;
  const monitorLabel =
    monitor === 'program' ? 'PROGRAM' : monitor === 'A' ? 'DECK A' : 'DECK B';
  const isSingle = monitorLayout === 'single';
  const isStudio = monitorLayout === 'studio';

  const blackoutOverlay = (visible: boolean) =>
    visible ? (
      <div className="blackout-overlay">
        <Icon name="blackout" size={22} />
        <span>BLACKOUT</span>
      </div>
    ) : null;

  const errorOverlay = engineError ? (
    <div className="engine-error">
      <Icon name="warning" size={24} />
      <strong>Motore video non disponibile</strong>
      <p>{engineError}</p>
    </div>
  ) : null;

  const stageFooter = (
    <div className="stage-footer">
      <span>
        MIX A/B <strong>{Math.round(crossfade * 100)}%</strong>
      </span>
      <span className="stage-bar">
        <i style={{ width: `${Math.round(crossfade * 100)}%` }} />
      </span>
    </div>
  );

  return (
    <section className={cx('preview-panel', outputOpen && 'is-output-live')}>
      <div className="preview-head">
        <div className="preview-status">
          <span className={cx('live-dot', blackout && 'is-blackout')} />
          <span className="preview-label">
            {isStudio
              ? isMixing
                ? 'LIVE · MIX A/B'
                : `LIVE · DECK ${liveDeck}`
              : isSingle
                ? monitorLabel
                : 'DECK A / B'}
          </span>
          <span className="preview-sub">{Math.round(transport.bpm)} BPM</span>
        </div>
        {isSingle ? (
          <div className="monitor-switch" role="group" aria-label="Monitor singolo">
            {MONITORS.map((entry) => (
              <button
                key={entry.id}
                className={cx('monitor-btn', monitor === entry.id && 'is-active')}
                onClick={() => setMonitor(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="layout-switch" role="group" aria-label="Layout dei monitor">
          {LAYOUTS.map((entry) => (
            <button
              key={entry.id}
              className={cx('monitor-btn', monitorLayout === entry.id && 'is-active')}
              onClick={() => setMonitorLayout(entry.id)}
              title={entry.title}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="preview-meta">
          <span>{fps} FPS</span>
          <span>{Math.round((performance.previewResolution * 16) / 9)}×{performance.previewResolution} · {performance.previewFps} FPS</span>
          {outputOpen ? (
            <span className="output-live">
              <Icon name="screen" size={12} /> LIVE
            </span>
          ) : null}
        </div>
      </div>

      <div
        className={cx('stage', `stage-${monitorLayout}`)}
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({
            x: Math.min(event.clientX, window.innerWidth - 230),
            y: Math.min(event.clientY, window.innerHeight - 150),
          });
        }}
      >
        <div
          className={cx(
            'stage-screen',
            'stage-screen-primary',
            monitorLayout === 'single' && 'is-single-screen',
            isStudio && 'is-live-screen',
            monitorLayout === 'decks' &&
              (isMixing ? 'is-mix-screen' : liveDeck === 'A' && 'is-live-screen'),
          )}
        >
          <div className="stage-screen-head">
            <span>
              {isStudio ? 'PROGRAM · USCITA' : isSingle ? monitorLabel : 'DECK A'}
            </span>
            {isStudio ? (
              <span className="on-air-chip"><i /> LIVE</span>
            ) : monitorLayout === 'decks' ? (
              <span
                className={cx(
                  'on-air-chip',
                  !isMixing && liveDeck !== 'A' && 'is-off-air',
                  isMixing && 'is-mixing',
                )}
              >
                <i /> {isMixing ? 'IN MIX' : liveDeck === 'A' ? 'LIVE' : 'PREVIEW'}
              </span>
            ) : null}
          </div>
          <canvas ref={canvasRef} className="stage-canvas" />
          {blackoutOverlay(
            blackout &&
              (isStudio ||
                (isSingle && monitor === 'program') ||
                (monitorLayout === 'decks' && liveDeck === 'A')),
          )}
          {errorOverlay}
        </div>
        <div
          className={cx(
            'stage-screen',
            'stage-screen-aux',
            isSingle && 'is-hidden-screen',
            monitorLayout === 'decks' &&
              (isMixing ? 'is-mix-screen' : liveDeck === 'B' && 'is-live-screen'),
          )}
        >
          <div className="stage-screen-head">
            <span>{isStudio ? `PREVIEW · DECK ${targetDeck}` : 'DECK B'}</span>
            {isStudio ? (
              <button
                className="take-live-btn"
                onClick={() => takeDeckLive(targetDeck, 650)}
                title={`Dissolvi verso Deck ${targetDeck}`}
              >
                <Icon name="screen" size={12} /> VAI LIVE
              </button>
            ) : monitorLayout === 'decks' ? (
              <span
                className={cx(
                  'on-air-chip',
                  !isMixing && liveDeck !== 'B' && 'is-off-air',
                  isMixing && 'is-mixing',
                )}
              >
                <i /> {isMixing ? 'IN MIX' : liveDeck === 'B' ? 'LIVE' : 'PREVIEW'}
              </span>
            ) : null}
          </div>
          <canvas ref={auxCanvasRef} className="stage-canvas" />
          {blackoutOverlay(blackout && monitorLayout === 'decks' && liveDeck === 'B')}
          {errorOverlay}
        </div>
        {monitorLayout !== 'single' ? stageFooter : null}
        {contextMenu ? (
          <div
            className="stage-recovery-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
          >
            <strong>Recupero rapido</strong>
            <button onClick={() => { onRestartEngines(); setContextMenu(null); }}>Riavvia anteprime</button>
            <button onClick={() => { void window.vj?.reloadOutput(); setContextMenu(null); }}>Ricarica output</button>
            <button onClick={() => { void window.vj?.reloadBrowserSources(); setContextMenu(null); }}>Ricarica browser source</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
