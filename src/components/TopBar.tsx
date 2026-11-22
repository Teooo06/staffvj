import type { TransportData } from '../types';
import { useAppStore } from '../store';
import { cx } from '../lib/utils';
import { Icon } from './Icons';
import { shortcutLabel, usePreferencesStore } from '../preferences';

export function TopBar({
  transport,
  onTap,
  onBpmChange,
}: {
  transport: TransportData;
  onTap: () => void;
  onBpmChange: (value: number) => void;
}) {
  const projectName = useAppStore((state) => state.projectName);
  const setProjectName = useAppStore((state) => state.setProjectName);
  const saveProject = useAppStore((state) => state.saveProject);
  const loadProject = useAppStore((state) => state.loadProject);
  const newProject = useAppStore((state) => state.newProject);
  const bpm = transport.bpm;
  const blackout = useAppStore((state) => state.blackout);
  const toggleBlackout = useAppStore((state) => state.toggleBlackout);
  const outputOpen = useAppStore((state) => state.outputOpen);
  const toggleOutput = useAppStore((state) => state.toggleOutput);
  const displays = useAppStore((state) => state.displays);
  const outputDisplayId = useAppStore((state) => state.output.displayId);
  const audioEnabled = useAppStore((state) => state.audio.enabled);
  const setShortcutsOpen = useAppStore((state) => state.setShortcutsOpen);
  const setSettingsOpen = usePreferencesStore((state) => state.setSettingsOpen);
  const shortcuts = usePreferencesStore((state) => state.shortcuts);

  const outputDisplay = displays.find((display) => display.id === outputDisplayId);
  const beatScale = 1 + transport.beatPulse * 0.9;

  return (
    <header className="topbar">
      <div className="brand">
        <img src="./logo.png" alt="Stafffeste" className="brand-logo" />
        <div className="brand-copy">
          <span className="brand-name">StaffVJ</span>
          <span className="brand-tag">LIVE VIDEO SYSTEM</span>
        </div>
      </div>

      <div className="project-name-wrap">
        <input
          className="project-name"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          aria-label="Nome progetto"
        />
      </div>

      <div className="topbar-center">
        <div className="tempo">
          <span
            className="beat-dot"
            style={{ transform: `scale(${beatScale})` }}
            aria-hidden="true"
          />
          <label className="bpm-field">
            <input
              type="number"
              min={60}
              max={200}
              value={Math.round(bpm)}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) onBpmChange(value);
              }}
              aria-label="BPM"
              title="BPM manuale: frecce ↑/↓, con Maiusc ±5"
            />
            <span>BPM</span>
          </label>
          <button className="btn tap-btn" onClick={onTap} title={`Tap tempo (${shortcutLabel(shortcuts.tapTempo)})`}>
            <Icon name="tap" size={15} />
            Tap
          </button>
          {audioEnabled ? (
            <div className="level-meter" title="Livello ingresso audio">
              <span style={{ width: `${Math.round(transport.level * 100)}%` }} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="topbar-actions">
        <div className="tool-group">
          <button
            className="icon-btn"
            title="Salva progetto"
            onClick={() => void saveProject()}
          >
            <Icon name="save" size={17} />
          </button>
          <button
            className="icon-btn"
            title="Apri progetto"
            onClick={() => void loadProject()}
          >
            <Icon name="folder" size={17} />
          </button>
          <button
            className="icon-btn"
            title="Nuovo progetto"
            onClick={() => {
              if (window.confirm('Creare un nuovo progetto demo? Le modifiche non salvate andranno perse.')) {
                newProject();
              }
            }}
          >
            <Icon name="plus" size={17} />
          </button>
          <button
            className="icon-btn"
            title="Scorciatoie da tastiera"
            onClick={() => setShortcutsOpen(true)}
          >
            <Icon name="keyboard" size={17} />
          </button>
          <button
            className="icon-btn"
            title="Impostazioni"
            onClick={() => setSettingsOpen(true)}
          >
            <Icon name="settings" size={17} />
          </button>
        </div>

        <button
          className={cx('btn output-btn', outputOpen && 'is-live')}
          onClick={() => void toggleOutput()}
          title={
            outputOpen
              ? `Chiudi output${outputDisplay ? ` su ${outputDisplay.label}` : ''}`
              : 'Apri output proiettore'
          }
        >
          <Icon name="screen" size={16} />
          <span>{outputOpen ? 'Output live' : 'Output'}</span>
        </button>

        <button
          className={cx('btn blackout-btn', blackout && 'is-active')}
          onClick={toggleBlackout}
          title={`Blackout (${shortcutLabel(shortcuts.blackout)})`}
        >
          <Icon name="blackout" size={16} />
          <span>Blackout</span>
        </button>
      </div>
    </header>
  );
}
