import { useEffect, useState } from 'react';
import type { AudioSettings, MediaItem, TransportData } from '../types';
import type { NdiStatus } from '../types';
import { BLEND_LABELS, GENERATOR_LABELS, GENERATOR_OPTIONS } from '../types';
import type { GeneratorKind, TextSettings } from '../types';
import { useAppStore } from '../store';
import type { InspectorTab } from '../store';
import { useMediaDevices } from '../hooks/useMediaDevices';
import { FONT_OPTIONS, defaultGenerator } from '../demo';
import { cx } from '../lib/utils';
import { Icon } from './Icons';
import { Slider, Toggle } from './Slider';
import { EffectRack } from './EffectRack';
import { AudioRhythmMonitor } from './AudioRhythmMonitor';
import { usePreferencesStore } from '../preferences';

const TABS: Array<{ id: InspectorTab; label: string; icon: 'layers' | 'sparkles' | 'beam' | 'audio' | 'screen' }> = [
  { id: 'layer', label: 'Layer', icon: 'layers' },
  { id: 'master', label: 'Master', icon: 'sparkles' },
  { id: 'auto', label: 'Auto', icon: 'beam' },
  { id: 'audio', label: 'Audio', icon: 'audio' },
  { id: 'output', label: 'Output', icon: 'screen' },
];

const percent = (value: number) => `${Math.round(value * 100)}%`;

function SourceBadge({
  item,
  captureLabel,
  ndiLabel,
}: {
  item: MediaItem | null;
  captureLabel?: string;
  ndiLabel?: string;
}) {
  if (!item) {
    if (captureLabel) {
      return (
        <span className="source-badge live">
          <Icon name="camera" size={12} /> {captureLabel}
        </span>
      );
    }
    if (ndiLabel) {
      return (
        <span className="source-badge live">
          <Icon name="screen" size={12} /> {ndiLabel}
        </span>
      );
    }
    return (
      <span className="source-badge">
        <Icon name="layers" size={12} /> Vuoto
      </span>
    );
  }
  const icon =
    item.kind === 'text'
      ? 'text'
      : item.kind === 'generator'
        ? 'sparkles'
        : item.kind === 'image'
          ? 'image'
          : item.kind === 'browser'
            ? 'screen'
            : 'video';
  return (
    <span className={cx('source-badge', `kind-${item.kind}`)}>
      <Icon name={icon} size={12} /> {item.name}
    </span>
  );
}

function TextEditor({ item }: { item: MediaItem }) {
  const updateMedia = useAppStore((state) => state.updateMedia);
  if (!item.text) return null;
  const text = item.text;
  const patch = (values: Partial<TextSettings>) =>
    updateMedia(item.id, { text: { ...text, ...values } });

  return (
    <div className="editor-block">
      <span className="eyebrow">Contenuto testo</span>
      <textarea
        className="text-area"
        rows={3}
        value={text.text}
        onChange={(event) => patch({ text: event.target.value })}
      />
      <div className="field-grid">
        <label className="field">
          <span>Font</span>
          <select
            value={text.font}
            onChange={(event) => patch({ font: event.target.value })}
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Animazione</span>
          <select
            value={text.animation}
            onChange={(event) =>
              patch({ animation: event.target.value as TextSettings['animation'] })
            }
          >
            <option value="none">Nessuna</option>
            <option value="scroll-left">Scorri a sinistra</option>
            <option value="scroll-right">Scorri a destra</option>
            <option value="pulse">Pulsa</option>
            <option value="typewriter">Macchina da scrivere</option>
            <option value="bounce">Salta</option>
          </select>
        </label>
      </div>

      <div className="field-grid">
        <label className="field color-field">
          <span>Colore</span>
          <input
            type="color"
            value={text.color}
            onChange={(event) => patch({ color: event.target.value })}
          />
        </label>
        <div className="field">
          <span>Allineamento</span>
          <div className="segmented">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                className={cx('seg-btn', text.align === align && 'is-active')}
                onClick={() => patch({ align })}
              >
                {align === 'left' ? 'Sx' : align === 'center' ? 'C' : 'Dx'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Slider
        label="Dimensione"
        value={text.size}
        defaultValue={150}
        min={24}
        max={400}
        step={1}
        unit="px"
        format={(value) => value.toFixed(0)}
        onChange={(value) => patch({ size: value })}
      />
      <Slider
        label="Velocità"
        value={text.speed}
        defaultValue={1}
        min={0}
        max={4}
        step={0.05}
        format={(value) => value.toFixed(2)}
        onChange={(value) => patch({ speed: value })}
      />
      <Slider
        label="Spaziatura"
        value={text.letterSpacing}
        defaultValue={0}
        min={-10}
        max={30}
        step={0.5}
        unit="px"
        format={(value) => value.toFixed(1)}
        onChange={(value) => patch({ letterSpacing: value })}
      />
      <Slider
        label="Posizione X"
        value={text.x}
        defaultValue={0.5}
        min={0}
        max={1}
        step={0.01}
        format={percent}
        onChange={(value) => patch({ x: value })}
      />
      <Slider
        label="Posizione Y"
        value={text.y}
        defaultValue={0.5}
        min={0}
        max={1}
        step={0.01}
        format={percent}
        onChange={(value) => patch({ y: value })}
      />
      <Toggle
        label="Maiuscole"
        checked={text.uppercase}
        onChange={(uppercase) => patch({ uppercase })}
      />
      <Toggle
        label="Contorno"
        checked={text.outline}
        onChange={(outline) => patch({ outline })}
      />
      {text.outline ? (
        <label className="field color-field">
          <span>Colore contorno</span>
          <input
            type="color"
            value={text.outlineColor}
            onChange={(event) => patch({ outlineColor: event.target.value })}
          />
        </label>
      ) : null}
      <Toggle
        label="Sfondo"
        checked={text.background}
        onChange={(background) => patch({ background })}
      />
      {text.background ? (
        <Slider
          label="Opacità sfondo"
          value={text.backgroundOpacity}
          defaultValue={0.35}
          min={0}
          max={1}
          step={0.01}
          format={percent}
          onChange={(value) => patch({ backgroundOpacity: value })}
        />
      ) : null}
    </div>
  );
}

function GeneratorEditor({ item }: { item: MediaItem }) {
  const updateMedia = useAppStore((state) => state.updateMedia);
  if (!item.gen) return null;
  const gen = item.gen;
  const generatorDefaults = defaultGenerator(item.generator ?? 'plasma');
  const generatorOptions: GeneratorKind[] =
    [
      ...GENERATOR_OPTIONS.filter((kind) => kind !== 'noise' || item.generator === 'noise'),
      ...(item.generator === 'sunset' ? ['sunset' as const] : []),
    ];
  return (
    <div className="editor-block">
      <span className="eyebrow">Generatore</span>
      <label className="field">
        <span>Tipo</span>
        <select
          value={item.generator}
          onChange={(event) => {
            const kind = event.target.value as GeneratorKind;
            updateMedia(item.id, {
              generator: kind,
              gen: defaultGenerator(kind),
            });
          }}
        >
          {generatorOptions.map((kind) => (
            <option key={kind} value={kind}>
              {GENERATOR_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      <Slider
        label="Velocità"
        value={gen.speed}
        defaultValue={generatorDefaults.speed}
        min={0}
        max={4}
        step={0.05}
        format={(value) => value.toFixed(2)}
        onChange={(value) => updateMedia(item.id, { gen: { ...gen, speed: value } })}
      />
      <Slider
        label="Tonalità"
        value={gen.hue}
        defaultValue={generatorDefaults.hue}
        min={0}
        max={1}
        step={0.01}
        format={percent}
        onChange={(value) => updateMedia(item.id, { gen: { ...gen, hue: value } })}
      />
      <Slider
        label="Intensità"
        value={gen.intensity}
        defaultValue={generatorDefaults.intensity}
        min={0}
        max={2}
        step={0.01}
        format={(value) => value.toFixed(2)}
        onChange={(value) =>
          updateMedia(item.id, { gen: { ...gen, intensity: value } })
        }
      />
      <label className="field color-field">
        <span>Colore</span>
        <input
          type="color"
          value={gen.color}
          onChange={(event) =>
            updateMedia(item.id, { gen: { ...gen, color: event.target.value } })
          }
        />
      </label>
    </div>
  );
}

function LayerTab() {
  const target = useAppStore((state) => state.target);
  const layer = useAppStore(
    (state) => state.decks[state.target.deck].layers[state.target.layerIndex],
  );
  const library = useAppStore((state) => state.library);
  const updateLayer = useAppStore((state) => state.updateLayer);
  const updateTransform = useAppStore((state) => state.updateTransform);
  const toggleLayerVisible = useAppStore((state) => state.toggleLayerVisible);
  const clearLayer = useAppStore((state) => state.clearLayer);

  const source = layer.source;
  const media =
    source?.kind === 'media'
      ? library.find((item) => item.id === source.mediaId) ?? null
      : null;
  const videoSource = source?.kind === 'media' ? source : null;
  const videoDuration = media?.kind === 'video' ? media.duration ?? videoSource?.rangeEnd ?? 0 : 0;
  const seekVideo = (delta: number) => {
    if (!videoSource) return;
    const rate = videoSource.playbackRate ?? 1;
    const start = videoSource.rangeStart ?? 0;
    const end = videoSource.rangeEnd ?? videoDuration;
    const base = videoSource.seekAt ?? videoSource.startedAt;
    const current = start + ((Date.now() - base) / 1000) * rate;
    const next = Math.max(start, Math.min(end || start, current + delta));
    const seekAt = Date.now() - ((next - start) / rate) * 1000;
    updateLayer(target.deck, target.layerIndex, {
      source: { ...videoSource, seekAt },
    });
  };
  const scope = {
    kind: 'layer' as const,
    deck: target.deck,
    layerIndex: target.layerIndex,
  };

  if (!layer) return null;

  return (
    <div className="tab-content">
      <div className="inspector-title">
        <div>
          <span className="eyebrow">Target</span>
          <h2>
            Deck {target.deck} · Layer {target.layerIndex + 1}
          </h2>
        </div>
        <div className="row-actions">
          <button
            className="icon-btn"
            title={layer.visible ? 'Nascondi layer' : 'Mostra layer'}
            onClick={() => toggleLayerVisible(target.deck, target.layerIndex)}
          >
            <Icon name={layer.visible ? 'eye' : 'eye-off'} size={16} />
          </button>
          <button
            className="icon-btn danger"
            title="Svuota layer"
            disabled={!source}
            onClick={() => clearLayer(target.deck, target.layerIndex)}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>

      <div className="source-line">
        <SourceBadge
          item={media}
          captureLabel={source?.kind === 'capture' ? source.label : undefined}
          ndiLabel={source?.kind === 'ndi' ? source.sourceName : undefined}
        />
        {source ? (
          <span className={cx('state-badge', layer.visible ? 'on' : 'off')}>
            {layer.visible ? 'VISIBILE' : 'NASCOSTO'}
          </span>
        ) : null}
      </div>

      {!source ? (
        <p className="hint">
          Layer vuoto. Seleziona un media dalla libreria o un ingresso live.
        </p>
      ) : null}

      {media?.kind === 'browser' ? (
        <p className="hint browser-layer-hint">
          Pagina browser acquisita come sorgente video. L’audio della pagina è disattivato.
          <span>{media.url ?? media.path}</span>
        </p>
      ) : null}

      {source?.kind === 'media' && media?.kind === 'video' ? (
        <div className="editor-block">
          <span className="eyebrow">Riproduzione video</span>
          <Slider
            label="Velocità"
            value={source.playbackRate ?? 1}
            defaultValue={1}
            min={0.25}
            max={4}
            step={0.25}
            unit="×"
            format={(value) => value.toFixed(2)}
            onChange={(value) =>
              updateLayer(target.deck, target.layerIndex, {
                source: { ...source, playbackRate: value },
              })
            }
          />
          <Slider
            label="Inizio"
            value={source.rangeStart ?? 0}
            defaultValue={0}
            min={0}
            max={videoDuration || 0}
            step={0.1}
            format={(value) => value.toFixed(1)}
            onChange={(value) =>
              updateLayer(target.deck, target.layerIndex, {
                source: { ...source, rangeStart: value },
              })
            }
          />
          <Slider
            label="Fine"
            value={source.rangeEnd ?? videoDuration}
            defaultValue={videoDuration}
            min={0}
            max={videoDuration || 0}
            step={0.1}
            format={(value) => value.toFixed(1)}
            onChange={(value) =>
              updateLayer(target.deck, target.layerIndex, {
                source: { ...source, rangeEnd: value },
              })
            }
          />
          <div className="segmented">
            <button className="seg-btn" onClick={() => seekVideo(-5)}>
              Indietro
            </button>
            <button className="seg-btn" onClick={() => seekVideo(5)}>
              Avanti
            </button>
          </div>
        </div>
      ) : null}

      <Slider
        label="Opacità layer"
        value={layer.opacity}
        defaultValue={1}
        min={0}
        max={1}
        step={0.01}
        format={percent}
        onChange={(value) =>
          updateLayer(target.deck, target.layerIndex, { opacity: value })
        }
      />

      <div className="field-grid">
        <label className="field">
          <span>Blend</span>
          <select
            value={layer.blend}
            onChange={(event) =>
              updateLayer(target.deck, target.layerIndex, {
                blend: event.target.value as typeof layer.blend,
              })
            }
          >
            {(Object.keys(BLEND_LABELS) as Array<keyof typeof BLEND_LABELS>).map(
              (blend) => (
                <option key={blend} value={blend}>
                  {BLEND_LABELS[blend]}
                </option>
              ),
            )}
          </select>
        </label>
        <div className="field">
          <span>Adattamento</span>
          <div className="segmented">
            {(['cover', 'contain'] as const).map((fit) => (
              <button
                key={fit}
                className={cx('seg-btn', layer.fit === fit && 'is-active')}
                onClick={() =>
                  updateLayer(target.deck, target.layerIndex, { fit })
                }
              >
                {fit === 'cover' ? 'Riempi' : 'Contieni'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="editor-block">
        <span className="eyebrow">Trasformazione</span>
        <Slider
          label="Spostamento X"
          value={layer.transform.x}
          defaultValue={0}
          min={-1}
          max={1}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(value) =>
            updateTransform(target.deck, target.layerIndex, { x: value })
          }
        />
        <Slider
          label="Spostamento Y"
          value={layer.transform.y}
          defaultValue={0}
          min={-1}
          max={1}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(value) =>
            updateTransform(target.deck, target.layerIndex, { y: value })
          }
        />
        <Slider
          label="Scala"
          value={layer.transform.scale}
          defaultValue={1}
          min={0.1}
          max={4}
          step={0.01}
          format={(value) => `${value.toFixed(2)}×`}
          onChange={(value) =>
            updateTransform(target.deck, target.layerIndex, { scale: value })
          }
        />
        <Slider
          label="Rotazione"
          value={layer.transform.rotation}
          defaultValue={0}
          min={-180}
          max={180}
          step={1}
          format={(value) => `${value.toFixed(0)}°`}
          onChange={(value) =>
            updateTransform(target.deck, target.layerIndex, { rotation: value })
          }
        />
        <Slider
          label="Fade in"
          value={layer.fadeMs}
          defaultValue={260}
          min={0}
          max={2000}
          step={20}
          unit="ms"
          format={(value) => value.toFixed(0)}
          onChange={(value) =>
            updateLayer(target.deck, target.layerIndex, { fadeMs: value })
          }
        />
      </div>

      {media?.kind === 'text' ? <TextEditor item={media} /> : null}
      {media?.kind === 'generator' ? <GeneratorEditor item={media} /> : null}
      {source?.kind === 'capture' ? (
        <p className="hint">
          Ingresso live attivo. Usa trasformazione, blend ed effetti per trattare
          il segnale come un video.
        </p>
      ) : null}
      {source?.kind === 'ndi' ? (
        <p className="hint">Ingresso NDI via rete locale. La ricezione si avvia quando il layer è assegnato.</p>
      ) : null}

      <EffectRack scope={scope} />
    </div>
  );
}

function MasterTab() {
  const masterOpacity = useAppStore((state) => state.masterOpacity);
  const setMasterOpacity = useAppStore((state) => state.setMasterOpacity);
  const blackout = useAppStore((state) => state.blackout);
  const setBlackout = useAppStore((state) => state.setBlackout);
  const outputResolution = usePreferencesStore((state) => state.performance.outputResolution);

  return (
    <div className="tab-content">
      <div className="inspector-title">
        <div>
          <span className="eyebrow">Uscita master</span>
          <h2>Programma</h2>
        </div>
      </div>

      <Slider
        label="Opacità master"
        value={masterOpacity}
        defaultValue={1}
        min={0}
        max={1}
        step={0.01}
        format={percent}
        onChange={setMasterOpacity}
      />
      <Toggle
        label="Blackout"
        hint="Oscura immediatamente l’uscita"
        checked={blackout}
        onChange={setBlackout}
      />

      <div className="stat-row">
        <div className="stat">
          <span>Risoluzione output</span>
          <strong>{Math.round((outputResolution * 16) / 9)}×{outputResolution}</strong>
        </div>
        <div className="stat">
          <span>Catena</span>
          <strong>Crossfade → Master FX</strong>
        </div>
      </div>

      <EffectRack scope={{ kind: 'master' }} />
    </div>
  );
}

function AutoTab({ transport }: { transport: TransportData }) {
  const autopilot = useAppStore((state) => state.autopilot);
  const setAutopilot = useAppStore((state) => state.setAutopilot);

  return (
    <div className="tab-content">
      <div className="inspector-title">
        <div>
          <span className="eyebrow">Automatismi</span>
          <h2>Autopilot</h2>
        </div>
      </div>

      <Toggle
        label="Autopilot attivo"
        hint="Prepara il deck in preview senza cambiare scheda o toccare il deck live"
        checked={autopilot.enabled}
        onChange={(enabled) => setAutopilot({ enabled })}
      />
      <Slider
        label="Ogni quante battute"
        value={autopilot.everyBeats}
        defaultValue={16}
        min={2}
        max={64}
        step={2}
        format={(value) => `${value}`}
        onChange={(everyBeats) => setAutopilot({ everyBeats })}
      />
      <Toggle
        label="Auto mix"
        hint="Alterna A/B a ogni cambio"
        checked={autopilot.autoMix}
        onChange={(autoMix) => setAutopilot({ autoMix })}
      />
      <Toggle
        label="Auto effetti"
        hint="Aggiunge un effetto temporaneo"
        checked={autopilot.autoFx}
        onChange={(autoFx) => setAutopilot({ autoFx })}
      />

      <div className="stat-row">
        <div className="stat">
          <span>Tempo</span>
          <strong>{Math.round(transport.bpm)} BPM</strong>
        </div>
        <div className="stat">
          <span>Battuta</span>
          <strong>{(transport.beatIndex % 4) + 1}/4</strong>
        </div>
      </div>

      <p className="hint">
        Prepara il deck opposto a quello in onda. I media automatici usano al massimo un livello
        base e un overlay al 50%; le scene salvate restano intatte. Gli effetti temporanei vengono
        rimossi dopo circa 12 secondi.
      </p>
    </div>
  );
}

function AudioTab({ transport }: { transport: TransportData }) {
  const audio = useAppStore((state) => state.audio);
  const setAudio = useAppStore((state) => state.setAudio);
  const { devices, busy, error, refresh } = useMediaDevices('audioinput');

  const selected = devices.find((device) => device.deviceId === audio.deviceId);

  return (
    <div className="tab-content">
      <div className="inspector-title">
        <div>
          <span className="eyebrow">Analisi ritmo</span>
          <h2>Ingresso audio</h2>
        </div>
        <span className={cx('state-badge', transport.audioConnected && transport.audioRunning ? 'on' : 'off')}>
          {transport.audioConnected && transport.audioRunning ? 'INGRESSO ATTIVO' : transport.audioConnected ? 'AUDIO SOSPESO' : audio.enabled ? 'COLLEGAMENTO…' : 'SPENTO'}
        </span>
      </div>

      <Toggle
        label="Analizza ingresso audio"
        hint="L’audio non viene riprodotto: pilota effetti e BPM"
        checked={audio.enabled}
        onChange={(enabled) => setAudio({ enabled })}
      />

      <div className="field">
        <span>Dispositivo</span>
        <div className="inline-field">
          <select
            value={audio.deviceId ?? ''}
            onChange={(event) => {
              const deviceId = event.target.value || null;
              const label =
                devices.find((device) => device.deviceId === deviceId)?.label ??
                'Predefinito di sistema';
              setAudio({ deviceId, deviceLabel: label });
            }}
          >
            <option value="">Predefinito di sistema</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          <button
            className="icon-btn"
            onClick={() => void refresh(true)}
            disabled={busy}
            title="Cerca ingressi audio"
          >
            <Icon name="refresh" size={15} />
          </button>
        </div>
      </div>

      {error ? <p className="hint error">{error}</p> : null}
      {selected ? (
        <p className="hint">Ingresso selezionato: {selected.label}</p>
      ) : null}

      <div className="level-visual">
        <div className="level-visual-head">
          <span>Livello</span>
          <strong>{Math.round(transport.level * 100)}%</strong>
        </div>
        <div className="level-bar">
          <span style={{ width: `${Math.round(transport.level * 100)}%` }} />
        </div>
        <div className="beat-visual">
          <span style={{ transform: `scale(${1 + transport.beatPulse * 0.35})` }} />
          <em>{Math.round(transport.bpm)} BPM</em>
          {audio.enabled ? <small>{transport.beatDetected ? 'ATTACCO RILEVATO' : 'IN ASCOLTO'}</small> : null}
        </div>
      </div>

      <AudioRhythmMonitor transport={transport} />

      <div className="audio-monitor">
        <div className="audio-monitor-head">
          <span>Forma d’onda</span>
          <strong>{Math.round(transport.bpm)} BPM</strong>
        </div>
        <svg className="audio-waveform" viewBox="0 0 100 40" preserveAspectRatio="none">
          <polyline
            points={transport.waveform
              .map(
                (value, index) =>
                  `${((index / Math.max(1, transport.waveform.length - 1)) * 100).toFixed(2)},${(
                    20 - value * 20
                  ).toFixed(2)}`,
              )
              .join(",")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1"
          />
        </svg>
        <span className="audio-spectrum-label">Spettro · bassi → alti</span>
        <div className="audio-spectrum">
          {transport.spectrum.map((value, index) => (
            <span key={index} style={{ height: `${Math.max(0, Math.min(100, Math.round(value * 100)))}%` }} />
          ))}
        </div>
      </div>

      <Slider
        label="Sensibilità ingresso"
        value={audio.sensitivity}
        defaultValue={1}
        min={0.2}
        max={3}
        step={0.01}
        format={(value) => `${value.toFixed(2)}×`}
        onChange={(sensitivity) => setAudio({ sensitivity })}
      />
      <Slider
        label="Soglia attacchi"
        value={audio.beatThreshold}
        defaultValue={0.85}
        min={0.4}
        max={5}
        step={0.05}
        format={(value) => `${value.toFixed(2)}×`}
        onChange={(beatThreshold) => setAudio({ beatThreshold })}
      />
      <div className="field">
        <span>Motore BPM</span>
        <select
          value={audio.detectorMode}
          onChange={(event) => setAudio({ detectorMode: event.target.value as AudioSettings['detectorMode'] })}
        >
            <option value="bass">Bassi · kick</option>
            <option value="hybrid">Ibrido · kick + transienti</option>
            <option value="mix">Mix completo</option>
        </select>
      </div>
      <Toggle
        label="BPM automatico"
        hint="Stima il tempo dagli attacchi sonori"
        checked={audio.autoBpm}
        onChange={(autoBpm) => setAudio({ autoBpm })}
      />

      <p className="hint">
        Il grafico mostra gli attacchi che entrano nell’analisi. Se il segnale è buono ma non rileva
        colpi, riduci la soglia; se conta troppi colpi, aumentala. La soglia non è la confidenza:
        la confidenza è la percentuale della stima. Prova i tre motori sullo stesso brano.
        Reattività e intervallo BPM sono nella scheda Impostazioni → Audio e BPM. BPM manuale:
        frecce ↑/↓, con Maiusc ±5.
      </p>
    </div>
  );
}

function OutputTab() {
  const displays = useAppStore((state) => state.displays);
  const output = useAppStore((state) => state.output);
  const outputOpen = useAppStore((state) => state.outputOpen);
  const setOutput = useAppStore((state) => state.setOutput);
  const refreshDisplays = useAppStore((state) => state.refreshDisplays);
  const toggleOutput = useAppStore((state) => state.toggleOutput);
  const performance = usePreferencesStore((state) => state.performance);
  const [switching, setSwitching] = useState(false);
  const [ndiStatus, setNdiStatus] = useState<NdiStatus | null>(null);
  const [ndiName, setNdiName] = useState('StaffVJ Program');

  useEffect(() => {
    let mounted = true;
    void window.vj?.getNdiStatus().then((status) => {
      if (!mounted) return;
      setNdiStatus(status);
      if (status.outputName) setNdiName(status.outputName);
    });
    const offStatus = window.vj?.onNdiStatus((status) => {
      setNdiStatus(status);
      if (status.outputName) setNdiName(status.outputName);
    });
    return () => {
      mounted = false;
      offStatus?.();
    };
  }, []);

  const changeDisplay = async (displayId: number) => {
    setOutput({ displayId });
    if (!outputOpen || !window.vj) return;
    setSwitching(true);
    try {
      await window.vj.closeOutput();
      await window.vj.openOutput(displayId);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="tab-content">
      <div className="inspector-title">
        <div>
          <span className="eyebrow">Proiettore</span>
          <h2>Output</h2>
        </div>
        <span className={cx('state-badge', outputOpen ? 'on' : 'off')}>
          {outputOpen ? 'LIVE' : 'CHIUSO'}
        </span>
      </div>

      <div className="field">
        <span>Schermo di destinazione</span>
        <div className="inline-field">
          <select
            value={output.displayId ?? ''}
            onChange={(event) => void changeDisplay(Number(event.target.value))}
            disabled={switching}
          >
            {displays.map((display) => (
              <option key={display.id} value={display.id}>
                {display.label} · {display.width}×{display.height}
                {display.primary ? ' (principale)' : ''}
              </option>
            ))}
            {!displays.length ? <option value="">Nessuno schermo</option> : null}
          </select>
          <button
            className="icon-btn"
            title="Aggiorna schermi"
            onClick={() => void refreshDisplays()}
          >
            <Icon name="refresh" size={15} />
          </button>
        </div>
      </div>

      <button
        className={cx('btn wide', outputOpen && 'danger')}
        onClick={() => void toggleOutput()}
        disabled={switching}
      >
        <Icon name="screen" size={16} />
        {outputOpen ? 'Chiudi finestra output' : 'Apri output proiettore'}
      </button>

      <div className="stat-row">
        <div className="stat">
          <span>Risoluzione</span>
          <strong>{Math.round((performance.outputResolution * 16) / 9)}×{performance.outputResolution}</strong>
        </div>
        <div className="stat">
          <span>Rendering</span>
          <strong>WebGL2</strong>
        </div>
      </div>

      <p className="hint">
        L’output è una finestra separata: puoi trascinarla su un proiettore o su
        un secondo schermo e la finestra di controllo resta operativa. Layer,
        effetti, BPM e crossfader sono sincronizzati.
      </p>

      <div className="ndi-output-card">
        <div className="inspector-title">
          <div>
            <span className="eyebrow">Rete locale</span>
            <h2>Uscita NDI</h2>
          </div>
          <span className={cx('state-badge', ndiStatus?.outputEnabled ? 'on' : 'off')}>
            {ndiStatus?.outputEnabled ? 'TRASMETTE' : ndiStatus?.available ? 'PRONTO' : 'NDI OFF'}
          </span>
        </div>
        <label className="field">
          <span>Nome del flusso</span>
          <input value={ndiName} onChange={(event) => setNdiName(event.target.value)} maxLength={128} />
        </label>
        <button
          className={cx('btn wide', ndiStatus?.outputEnabled && 'danger')}
          disabled={!ndiStatus?.available}
          onClick={() => void window.vj?.setNdiOutput(!ndiStatus?.outputEnabled, ndiName)}
        >
          <Icon name="screen" size={15} />
          {ndiStatus?.outputEnabled ? 'Ferma uscita NDI' : 'Avvia uscita Program NDI'}
        </button>
        <p className="hint">
          Trasmette il Program a {Math.round((performance.outputResolution * 16) / 9)}×{performance.outputResolution} e {Math.min(30, performance.outputFps)} fps anche senza aprire il proiettore. Per l’ingresso,
          aggiungi una fonte NDI dalla scheda Ingressi.
        </p>
        {ndiStatus?.error ? <p className="hint error">{ndiStatus.error}</p> : null}
      </div>
    </div>
  );
}

export function Inspector({ transport }: { transport: TransportData }) {
  const tab = useAppStore((state) => state.inspectorTab);
  const setTab = useAppStore((state) => state.setInspectorTab);

  return (
    <aside className="panel inspector">
      <div className="inspector-tabs">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            className={cx('inspector-tab', tab === entry.id && 'is-active')}
            onClick={() => setTab(entry.id)}
          >
            <Icon name={entry.icon} size={14} />
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'layer' ? <LayerTab /> : null}
      {tab === 'master' ? <MasterTab /> : null}
      {tab === 'auto' ? <AutoTab transport={transport} /> : null}
      {tab === 'audio' ? <AudioTab transport={transport} /> : null}
      {tab === 'output' ? <OutputTab /> : null}
    </aside>
  );
}
