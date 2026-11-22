import { useEffect, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { AudioSettings, TransportData } from '../types';
import { useAppStore } from '../store';
import { shortcutLabel, usePreferencesStore } from '../preferences';
import type {
  PerformanceMode,
  PreviewResolution,
  OutputResolution,
  ShortcutAction,
  ShortcutBinding,
  StartupLayout,
} from '../preferences';
import { Icon } from './Icons';
import { cx } from '../lib/utils';
import { AudioRhythmMonitor } from './AudioRhythmMonitor';

const NAV: Array<{
  id: 'general' | 'performance' | 'keyboard' | 'audio' | 'recovery';
  title: string;
  subtitle: string;
  icon: 'settings' | 'sparkles' | 'keyboard' | 'audio' | 'refresh';
}> = [
  { id: 'general', title: 'Generali', subtitle: 'Avvio e interfaccia', icon: 'settings' },
  { id: 'performance', title: 'Prestazioni', subtitle: 'Qualità e fluidità', icon: 'sparkles' },
  { id: 'keyboard', title: 'Tastiera', subtitle: 'Scorciatoie personalizzate', icon: 'keyboard' },
  { id: 'audio', title: 'Audio e BPM', subtitle: 'Ingresso e rilevamento', icon: 'audio' },
  { id: 'recovery', title: 'Ripristino', subtitle: 'Comandi di recupero', icon: 'refresh' },
];

const ACTIONS: Array<{ id: ShortcutAction; label: string; detail: string }> = [
  { id: 'tapTempo', label: 'Tap tempo', detail: 'Imposta il ritmo manualmente' },
  { id: 'bpmDown', label: 'BPM −1', detail: 'Riduce il BPM; l’automatico resta in pausa per 3 s' },
  { id: 'bpmUp', label: 'BPM +1', detail: 'Aumenta il BPM; l’automatico resta in pausa per 3 s' },
  { id: 'bpmDown5', label: 'BPM −5', detail: 'Correzione rapida verso il basso' },
  { id: 'bpmUp5', label: 'BPM +5', detail: 'Correzione rapida verso l’alto' },
  { id: 'blackout', label: 'Blackout', detail: 'Oscura o riattiva l’uscita' },
  { id: 'takeA', label: 'Porta Deck A live', detail: 'Dissolvenza verso A' },
  { id: 'takeB', label: 'Porta Deck B live', detail: 'Dissolvenza verso B' },
  { id: 'clearLayer', label: 'Svuota layer selezionato', detail: 'Rimuove la sorgente dal layer' },
  { id: 'shortcuts', label: 'Guida scorciatoie', detail: 'Mostra il riepilogo dei tasti' },
  { id: 'settings', label: 'Apri impostazioni', detail: 'Mostra questa pagina' },
];

const MODE_INFO: Record<Exclude<PerformanceMode, 'custom'>, { label: string; description: string }> = {
  performance: { label: 'Prestazioni', description: 'Per computer sotto carico o GPU integrate meno recenti.' },
  balanced: { label: 'Bilanciato', description: 'Impostazione consigliata per la maggior parte dei live.' },
  quality: { label: 'Qualità', description: 'Anteprime più definite e browser source più fluide.' },
};

function sameBinding(a: ShortcutBinding, b: ShortcutBinding): boolean {
  return a.code === b.code && a.ctrl === b.ctrl && a.alt === b.alt && a.shift === b.shift && a.meta === b.meta;
}

function captureBinding(event: ReactKeyboardEvent<HTMLButtonElement>): ShortcutBinding | null {
  event.preventDefault();
  event.stopPropagation();
  if (event.code === 'Escape') return null;
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return null;
  if (!event.code || event.code === 'Unidentified') return null;
  return {
    code: event.code,
    label: event.key === ' ' ? 'Spazio' : event.key.length === 1 ? event.key.toLocaleUpperCase() : event.key,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}

function KeyboardSettings() {
  const shortcuts = usePreferencesStore((state) => state.shortcuts);
  const setShortcut = usePreferencesStore((state) => state.setShortcut);
  const [listening, setListening] = useState<ShortcutAction | null>(null);
  const scenes = useAppStore((state) => state.scenes);

  return (
    <div className="settings-section">
      <div className="settings-section-heading">
        <span className="eyebrow">Controllo live</span>
        <h2>Scorciatoie da tastiera</h2>
        <p>Premi “Registra” e poi il tasto o la combinazione che vuoi usare. Viene salvata la disposizione della tastiera che stai usando.</p>
      </div>
      <div className="settings-card keyboard-settings-list">
        {ACTIONS.map((action) => (
          <div className="settings-shortcut-row" key={action.id}>
            <div>
              <strong>{action.label}</strong>
              <small>{action.detail}</small>
            </div>
            <div className="settings-shortcut-controls">
              <button
                className={cx('shortcut-capture', listening === action.id && 'is-listening')}
                onClick={(event) => {
                  event.currentTarget.focus();
                  setListening(action.id);
                }}
                onKeyDown={(event) => {
                  if (listening !== action.id) return;
                  const binding = captureBinding(event);
                  if (event.code === 'Escape') {
                    setListening(null);
                    return;
                  }
                  if (!binding) return;
                  const conflict = Object.entries(shortcuts).find(
                    ([id, assigned]) => id !== action.id && assigned && sameBinding(assigned, binding),
                  );
                  const sceneConflict = scenes.find((scene) =>
                    scene.shortcut === binding.code &&
                    Boolean(scene.shortcutModifiers?.ctrl) === binding.ctrl &&
                    Boolean(scene.shortcutModifiers?.alt) === binding.alt &&
                    Boolean(scene.shortcutModifiers?.shift) === binding.shift &&
                    Boolean(scene.shortcutModifiers?.meta) === binding.meta,
                  );
                  if (conflict || sceneConflict) {
                    const conflictName = conflict
                      ? ACTIONS.find((entry) => entry.id === conflict[0])?.label
                      : `scena “${sceneConflict?.name}”`;
                    useAppStore.getState().toast(`Tasto già assegnato a ${conflictName}`, 'error');
                    setListening(null);
                    return;
                  }
                  setShortcut(action.id, binding);
                  setListening(null);
                }}
              >
                {listening === action.id ? 'Premi un tasto…' : shortcutLabel(shortcuts[action.id])}
              </button>
              {shortcuts[action.id] ? (
                <button className="icon-btn" title="Rimuovi scorciatoia" onClick={() => setShortcut(action.id, null)}>
                  <Icon name="close" size={13} />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <p className="hint">I tasti delle scene continuano a essere assegnabili dalle schede scena. Le combinazioni qui sopra hanno precedenza in caso di conflitto.</p>
    </div>
  );
}

function GeneralSettings({ onResetLayout }: { onResetLayout: () => void }) {
  const startupLayout = usePreferencesStore((state) => state.startupLayout);
  const setStartupLayout = usePreferencesStore((state) => state.setStartupLayout);
  const setMonitorLayout = useAppStore((state) => state.setMonitorLayout);
  const [appInfo, setAppInfo] = useState<{ version: string; platform: string; electron: string; chrome: string } | null>(null);

  useEffect(() => {
    void window.vj?.appInfo().then(setAppInfo).catch(() => setAppInfo(null));
  }, []);

  const updateLayout = (layout: StartupLayout) => {
    setStartupLayout(layout);
    setMonitorLayout(layout);
  };

  return (
    <div className="settings-section">
      <div className="settings-section-heading">
        <span className="eyebrow">Preferenze locali</span>
        <h2>Impostazioni generali</h2>
        <p>Queste scelte valgono per questo computer e non vengono inserite nel progetto o nelle scene.</p>
      </div>
      <div className="settings-card settings-card-grid">
        <label className="field">
          <span>Layout all’avvio</span>
          <select value={startupLayout} onChange={(event) => updateLayout(event.target.value as StartupLayout)}>
            <option value="studio">Studio · Preview e Program</option>
            <option value="decks">Deck A / Deck B</option>
            <option value="single">Program singolo</option>
          </select>
        </label>
        <div className="settings-action-row">
          <div>
            <strong>Layout dei pannelli</strong>
            <small>Riporta libreria e inspector alle dimensioni iniziali.</small>
          </div>
          <button className="btn" onClick={onResetLayout}>Ripristina pannelli</button>
        </div>
      </div>
      <div className="settings-card settings-version-card">
        <span className="eyebrow">Informazioni applicazione</span>
        <div className="settings-facts">
          <div><small>StaffVJ</small><strong>{appInfo?.version ?? '—'}</strong></div>
          <div><small>Sistema</small><strong>{appInfo?.platform ?? window.vj?.platform ?? 'Web'}</strong></div>
          <div><small>Electron</small><strong>{appInfo?.electron ?? '—'}</strong></div>
          <div><small>Chromium</small><strong>{appInfo?.chrome ?? '—'}</strong></div>
        </div>
      </div>
    </div>
  );
}

function PerformanceSettings({ gpuRenderer }: { gpuRenderer: string }) {
  const performance = usePreferencesStore((state) => state.performance);
  const applyPerformanceMode = usePreferencesStore((state) => state.applyPerformanceMode);
  const setPerformance = usePreferencesStore((state) => state.setPerformance);
  const cores = navigator.hardwareConcurrency || 0;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const renderer = gpuRenderer || 'Lettura GPU in corso…';
  const softwareRenderer = /swiftshader|llvmpipe|software raster/i.test(renderer);
  const discreteGpu = /nvidia|geforce|radeon rx|apple m[1-9]/i.test(renderer);
  const recommended: Exclude<PerformanceMode, 'custom'> =
    softwareRenderer || (cores > 0 && cores < 6)
      ? 'performance'
      : discreteGpu && cores >= 8
        ? 'quality'
        : 'balanced';
  const selectNumber = <T extends number>(value: string): T => Number(value) as T;

  return (
    <div className="settings-section">
      <div className="settings-section-heading">
        <span className="eyebrow">Profilo di rendering</span>
        <h2>Prestazioni</h2>
        <p>Le anteprime e l’output sono regolabili separatamente. La raccomandazione è una stima indicativa basata sui dati esposti dal sistema.</p>
      </div>
      <div className="settings-card machine-card">
        <div>
          <span className="eyebrow">Questa macchina</span>
          <strong>{cores ? `${cores} processori logici` : 'CPU non rilevata'}</strong>
          <small>{memory ? `${memory} GB di memoria segnalata dal browser` : 'Memoria non esposta dal sistema'}</small>
        </div>
        <div className="gpu-readout"><small>Renderer grafico</small><strong title={renderer}>{renderer}</strong></div>
        <div className="recommendation-chip"><span>Consigliato</span><strong>{MODE_INFO[recommended].label}</strong></div>
      </div>
      <div className="settings-profile-grid">
        {(Object.keys(MODE_INFO) as Array<Exclude<PerformanceMode, 'custom'>>).map((mode) => (
          <button
            key={mode}
            className={cx('settings-profile', performance.mode === mode && 'is-active', recommended === mode && 'is-recommended')}
            onClick={() => applyPerformanceMode(mode)}
          >
            <span>{MODE_INFO[mode].label}{recommended === mode ? ' · consigliato' : ''}</span>
            <small>{MODE_INFO[mode].description}</small>
          </button>
        ))}
      </div>
      <div className="settings-card settings-card-grid">
        <label className="field">
          <span>Risoluzione anteprime</span>
          <select value={performance.previewResolution} onChange={(event) => setPerformance({ previewResolution: selectNumber<PreviewResolution>(event.target.value) })}>
            <option value={360}>640 × 360</option>
            <option value={540}>960 × 540</option>
            <option value={720}>1280 × 720</option>
          </select>
        </label>
        <label className="field">
          <span>Frequenza anteprime</span>
          <select value={performance.previewFps} onChange={(event) => setPerformance({ previewFps: selectNumber<24 | 30 | 60>(event.target.value) })}>
            <option value={24}>24 fps</option><option value={30}>30 fps</option><option value={60}>60 fps</option>
          </select>
        </label>
        <label className="field">
          <span>Frequenza browser source</span>
          <select value={performance.browserFps} onChange={(event) => setPerformance({ browserFps: selectNumber<15 | 24 | 30>(event.target.value) })}>
            <option value={15}>15 fps · meno carico</option><option value={24}>24 fps · bilanciato</option><option value={30}>30 fps · più fluido</option>
          </select>
        </label>
        <label className="field">
          <span>Risoluzione output e NDI</span>
          <select value={performance.outputResolution} onChange={(event) => setPerformance({ outputResolution: selectNumber<OutputResolution>(event.target.value) })}>
            <option value={720}>1280 × 720</option><option value={1080}>1920 × 1080</option>
          </select>
        </label>
        <label className="field">
          <span>Frequenza output</span>
          <select value={performance.outputFps} onChange={(event) => setPerformance({ outputFps: selectNumber<30 | 60>(event.target.value) })}>
            <option value={30}>30 fps · meno carico</option><option value={60}>60 fps · più fluido</option>
          </select>
        </label>
      </div>
      <p className="hint">Qualità riduce il lavoro delle anteprime ma non può superare la frequenza dello schermo. L’output usa la risoluzione selezionata; 60 fps è più impegnativo, soprattutto con effetti, più layer o NDI.</p>
    </div>
  );
}

function AudioSettings({ transport, onTap, onRestartAudio }: {
  transport: TransportData;
  onTap: () => void;
  onRestartAudio: () => void;
}) {
  const audio = useAppStore((state) => state.audio);
  const setAudio = useAppStore((state) => state.setAudio);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const [minBpmDraft, setMinBpmDraft] = useState(String(audio.minBpm));
  const [maxBpmDraft, setMaxBpmDraft] = useState(String(audio.maxBpm));

  useEffect(() => setMinBpmDraft(String(audio.minBpm)), [audio.minBpm]);
  useEffect(() => setMaxBpmDraft(String(audio.maxBpm)), [audio.maxBpm]);

  const updateAudio = (patch: Partial<AudioSettings>) => setAudio(patch);

  return (
    <div className="settings-section">
      <div className="settings-section-heading">
        <span className="eyebrow">Clock audio</span>
        <h2>Ingresso e rilevamento BPM</h2>
        <p>Scegli il motore: “Bassi” segue il kick, “Ibrido” unisce kick e transienti, “Mix” usa tutto lo spettro. La soglia decide cosa conta come attacco; la reattività decide quanto in fretta il BPM segue la stima. La confidenza è la percentuale mostrata nel grafico.</p>
      </div>
      <div className="settings-card settings-card-grid">
        <label className="settings-check-row">
          <span><strong>Analizza ingresso audio</strong><small>L’audio guida BPM e risposta degli effetti; non viene riprodotto.</small></span>
          <input type="checkbox" checked={audio.enabled} onChange={(event) => updateAudio({ enabled: event.target.checked })} />
        </label>
        <label className="settings-check-row">
          <span><strong>BPM automatico</strong><small>Adatta il tempo agli attacchi secondo l’analisi scelta.</small></span>
          <input type="checkbox" checked={audio.autoBpm} onChange={(event) => updateAudio({ autoBpm: event.target.checked })} />
        </label>
        <label className="field">
          <span>Sensibilità ingresso · {audio.sensitivity.toFixed(2)}×</span>
          <input type="range" min="0.2" max="3" step="0.01" value={audio.sensitivity} onChange={(event) => updateAudio({ sensitivity: Number(event.target.value) })} />
          <small>Amplifica meter e analisi; non cambia il volume dell’audio.</small>
        </label>
        <label className="field">
          <span>Motore BPM</span>
          <select value={audio.detectorMode} onChange={(event) => updateAudio({ detectorMode: event.target.value as AudioSettings['detectorMode'] })}>
            <option value="bass">Bassi · kick</option>
            <option value="hybrid">Ibrido · kick + transienti</option>
            <option value="mix">Mix completo</option>
          </select>
          <small>Prova i tre motori sullo stesso brano e usa quello più stabile.</small>
        </label>
        <label className="field">
          <span>Soglia attacchi · {audio.beatThreshold.toFixed(2)}×</span>
          <input type="range" min="0.4" max="5" step="0.05" value={audio.beatThreshold} onChange={(event) => updateAudio({ beatThreshold: Number(event.target.value) })} />
          <small>Più alta = meno attacchi. Non è la confidenza del BPM.</small>
        </label>
        <label className="field">
          <span>Reattività BPM · {Math.round(audio.tempoResponse * 100)}%</span>
          <input type="range" min="0.1" max="0.8" step="0.01" value={audio.tempoResponse} onChange={(event) => updateAudio({ tempoResponse: Number(event.target.value) })} />
          <small>Più alta = segue più in fretta; più bassa = più stabile.</small>
        </label>
        <label className="field">
          <span>BPM minimo</span>
          <input type="number" min="60" max={audio.maxBpm - 1} value={minBpmDraft} onChange={(event) => setMinBpmDraft(event.target.value)} onBlur={() => updateAudio({ minBpm: Number(minBpmDraft) })} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
        </label>
        <label className="field">
          <span>BPM massimo</span>
          <input type="number" min={audio.minBpm + 1} max="200" value={maxBpmDraft} onChange={(event) => setMaxBpmDraft(event.target.value)} onBlur={() => updateAudio({ maxBpm: Number(maxBpmDraft) })} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
        </label>
        <div className="settings-rhythm-card">
          <AudioRhythmMonitor transport={transport} />
        </div>
        <div className="settings-audio-meter">
          <div><small>Livello</small><strong>{Math.round(transport.level * 100)}%</strong></div>
          <div className="level-bar"><span style={{ width: `${Math.round(transport.level * 100)}%` }} /></div>
          <div className="beat-visual"><span style={{ transform: `scale(${1 + transport.beatPulse * 0.35})` }} /><em>{Math.round(transport.bpm)} BPM</em><small>{transport.audioConnected && transport.audioRunning ? transport.beatDetected ? 'ATTACCO RILEVATO' : 'IN ASCOLTO' : transport.audioConnected ? 'AUDIO SOSPESO' : 'INGRESSO NON ATTIVO'}</small></div>
        </div>
        <div className="settings-action-row">
          <div><strong>{audio.deviceLabel || 'Ingresso predefinito'}</strong><small>Se il meter resta a zero, verifica il dispositivo nel pannello Audio.</small></div>
          <button className="btn" onClick={() => { setInspectorTab('audio'); usePreferencesStore.getState().setSettingsOpen(false); }}>Scegli ingresso</button>
        </div>
      </div>
      <div className="settings-inline-actions">
        <button className="btn primary" onClick={onTap}><Icon name="tap" size={14} /> Tap tempo</button>
        <button className="btn" disabled={!audio.enabled} onClick={onRestartAudio}><Icon name="refresh" size={14} /> Riavvia analisi</button>
      </div>
      <p className="hint">Se il meter resta a zero, controlla dispositivo e livello dell’interfaccia. Se il grafico vede pochi attacchi, abbassa la soglia; se segna colpi continui, alzala. La soglia non è la confidenza: la confidenza è la percentuale della stima. Per il BPM manuale usa le frecce ↑/↓ (con Maiusc ±5); l’automatico resta in pausa per 3 secondi.</p>
    </div>
  );
}

function RecoverySettings({ onRestartEngines, onRestartAudio }: { onRestartEngines: () => void; onRestartAudio: () => void }) {
  const run = async (action: (() => Promise<unknown> | unknown) | undefined, success: string) => {
    if (!action) {
      useAppStore.getState().toast('Comando disponibile solo nell’app desktop', 'error');
      return;
    }
    try {
      const result = await action();
      if (result === false) throw new Error('Ripristino non disponibile');
      useAppStore.getState().toast(success, 'success');
    } catch (_error) {
      useAppStore.getState().toast('Comando di ripristino non riuscito', 'error');
    }
  };

  const commands = [
    { title: 'Motore anteprime', detail: 'Ricrea i due motori WebGL nella finestra di controllo.', label: 'Riavvia anteprime', action: onRestartEngines },
    { title: 'Finestra output', detail: 'Ricarica l’output del proiettore senza chiudere il Program.', label: 'Ricarica output', action: () => run(window.vj?.reloadOutput, 'Output ricaricato') },
    { title: 'Browser source', detail: 'Ricarica le pagine web e HTML locali attualmente in uso.', label: 'Ricarica browser source', action: () => run(window.vj?.reloadBrowserSources, 'Browser source ricaricate') },
    { title: 'Ingresso audio', detail: 'Riapre il microfono o il line-in selezionato.', label: 'Riavvia audio', action: onRestartAudio },
    { title: 'Interfaccia principale', detail: 'Ricarica la finestra di controllo; il progetto resta nell’autosalvataggio.', label: 'Ricarica interfaccia', action: () => run(window.vj?.reloadControl, 'Interfaccia ricaricata') },
  ];

  return (
    <div className="settings-section">
      <div className="settings-section-heading">
        <span className="eyebrow">Ripristino mirato</span>
        <h2>Comandi di recupero</h2>
        <p>Usa il comando relativo alla parte che non risponde. Il Program resta in onda durante il riavvio delle sole anteprime.</p>
      </div>
      <div className="settings-card recovery-list">
        {commands.map((command) => (
          <div className="settings-action-row" key={command.title}>
            <div><strong>{command.title}</strong><small>{command.detail}</small></div>
            <button className="btn" onClick={() => void command.action()}>{command.label}</button>
          </div>
        ))}
      </div>
      <p className="hint">Per il congelamento dell’intera finestra puoi usare il comando di ricarica interfaccia; se non risponde neanche quello, chiudi e riapri l’app dal sistema operativo.</p>
    </div>
  );
}

export function SettingsPage({
  gpuRenderer,
  transport,
  onTap,
  onResetLayout,
  onRestartEngines,
  onRestartAudio,
}: {
  gpuRenderer: string;
  transport: TransportData;
  onTap: () => void;
  onResetLayout: () => void;
  onRestartEngines: () => void;
  onRestartAudio: () => void;
}) {
  const open = usePreferencesStore((state) => state.settingsOpen);
  const tab = usePreferencesStore((state) => state.settingsTab);
  const setOpen = usePreferencesStore((state) => state.setSettingsOpen);
  const setTab = usePreferencesStore((state) => state.setSettingsTab);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Impostazioni StaffVJ">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-head">
          <span className="eyebrow">StaffVJ</span>
          <h2>Impostazioni</h2>
        </div>
        <nav aria-label="Sezioni impostazioni">
          {NAV.map((item) => (
            <button key={item.id} title={item.title} aria-label={item.title} className={cx('settings-nav-item', tab === item.id && 'is-active')} onClick={() => setTab(item.id)}>
              <Icon name={item.icon} size={17} />
              <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
            </button>
          ))}
        </nav>
        <button className="settings-close btn" onClick={() => setOpen(false)}><Icon name="close" size={15} /> Chiudi</button>
      </aside>
      <main className="settings-main">
        <header className="settings-main-head">
          <div><span className="eyebrow">Preferenze applicazione</span><h1>{NAV.find((item) => item.id === tab)?.title}</h1></div>
          <button className="icon-btn" onClick={() => setOpen(false)} title="Chiudi impostazioni"><Icon name="close" size={18} /></button>
        </header>
        <div className="settings-main-scroll">
          {tab === 'general' ? <GeneralSettings onResetLayout={onResetLayout} /> : null}
          {tab === 'performance' ? <PerformanceSettings gpuRenderer={gpuRenderer} /> : null}
          {tab === 'keyboard' ? <KeyboardSettings /> : null}
          {tab === 'audio' ? <AudioSettings transport={transport} onTap={onTap} onRestartAudio={onRestartAudio} /> : null}
          {tab === 'recovery' ? <RecoverySettings onRestartEngines={onRestartEngines} onRestartAudio={onRestartAudio} /> : null}
        </div>
      </main>
    </div>
  );
}
