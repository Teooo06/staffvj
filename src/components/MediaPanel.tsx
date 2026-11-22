import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { useMediaDevices } from '../hooks/useMediaDevices';
import { GENERATOR_LABELS, GENERATOR_OPTIONS } from '../types';
import type { MediaItem } from '../types';
import type { NdiSourceInfo, NdiStatus } from '../types';
import { cx, formatBytes, mediaUrl } from '../lib/utils';
import { Icon } from './Icons';
import { BrowserSourceDialog } from './BrowserSourceDialog';
import { SceneShelf } from './SceneShelf';

type MediaFilter = 'all' | 'video' | 'image' | 'generator' | 'text' | 'browser';
type MediaPanelTab = 'library' | 'scenes' | 'sources';

const FILTERS: Array<{ id: MediaFilter; label: string }> = [
  { id: 'all', label: 'Tutti' },
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Immagini' },
  { id: 'generator', label: 'Generatori' },
  { id: 'text', label: 'Testi' },
  { id: 'browser', label: 'Browser' },
];

const KIND_LABEL: Record<MediaItem['kind'], string> = {
  video: 'VIDEO',
  image: 'IMG',
  generator: 'GEN',
  text: 'TESTO',
  browser: 'WEB',
};

function MediaThumb({ item }: { item: MediaItem }) {
  if (item.kind === 'image' && item.path) {
    return <img src={mediaUrl(item.path)} alt="" loading="lazy" />;
  }
  if (item.kind === 'video' && item.path) {
    return (
      <video
        src={`${mediaUrl(item.path)}#t=0.1`}
        preload="metadata"
        muted
        playsInline
      />
    );
  }
  if (item.kind === 'text') {
    return (
      <span className="thumb-text">
        {(item.text?.text || 'TESTO').split('\n').slice(0, 3).join('\n')}
      </span>
    );
  }
  if (item.kind === 'browser') {
    let host = 'HTML locale';
    if (item.url) {
      try {
        host = new URL(item.url).hostname;
      } catch (_error) {
        host = item.name;
      }
    }
    return (
      <span className="thumb-browser">
        <Icon name="screen" size={22} />
        <em>{host}</em>
      </span>
    );
  }
  return (
    <span className={cx('thumb-generator', `gen-${item.generator ?? 'plasma'}`)}>
      <Icon name="generator" size={22} />
      <em>{item.generator ? GENERATOR_LABELS[item.generator] : 'Generatore'}</em>
    </span>
  );
}

export function MediaPanel() {
  const library = useAppStore((state) => state.library);
  const scenes = useAppStore((state) => state.scenes);
  const selectedMediaId = useAppStore((state) => state.selectedMediaId);
  const target = useAppStore((state) => state.target);
  const decks = useAppStore((state) => state.decks);
  const triggerMedia = useAppStore((state) => state.triggerMedia);
  const triggerCapture = useAppStore((state) => state.triggerCapture);
  const triggerNdi = useAppStore((state) => state.triggerNdi);
  const removeMedia = useAppStore((state) => state.removeMedia);
  const addTextItem = useAppStore((state) => state.addTextItem);
  const addGenerator = useAppStore((state) => state.addGenerator);
  const addBrowserUrl = useAppStore((state) => state.addBrowserUrl);
  const addBrowserFile = useAppStore((state) => state.addBrowserFile);
  const toast = useAppStore((state) => state.toast);
  const { devices, busy, error, refresh } = useMediaDevices('videoinput');

  const [filter, setFilter] = useState<MediaFilter>('all');
  const [panelTab, setPanelTab] = useState<MediaPanelTab>('library');
  const [query, setQuery] = useState('');
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [browserDialogOpen, setBrowserDialogOpen] = useState(false);
  const [mediaColumns, setMediaColumns] = useState<2 | 3 | 4>(2);
  const [ndiSources, setNdiSources] = useState<NdiSourceInfo[]>([]);
  const [ndiStatus, setNdiStatus] = useState<NdiStatus | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!generatorOpen) return;
    const handler = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setGeneratorOpen(false);
    };
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, [generatorOpen]);

  const activeCaptures = useMemo(() => {
    const active = new Set<string>();
    (['A', 'B'] as const).forEach((deck) => {
      decks[deck].layers.forEach((layer) => {
        if (layer.source?.kind === 'capture') active.add(layer.source.deviceId);
      });
    });
    return active;
  }, [decks]);

  const activeNdi = useMemo(() => {
    const active = new Set<string>();
    (['A', 'B'] as const).forEach((deck) => {
      decks[deck].layers.forEach((layer) => {
        if (layer.source?.kind === 'ndi') active.add(layer.source.sourceId);
      });
    });
    return active;
  }, [decks]);

  useEffect(() => {
    let mounted = true;
    void window.vj?.listNdiSources().then((sources) => { if (mounted) setNdiSources(sources); });
    void window.vj?.getNdiStatus().then((status) => { if (mounted) setNdiStatus(status); });
    const offSources = window.vj?.onNdiSources(setNdiSources);
    const offStatus = window.vj?.onNdiStatus(setNdiStatus);
    const offNdiError = window.vj?.onNdiSourceError(({ sourceId, error: message }) => {
      const source = useAppStore.getState().decks;
      const label = (['A', 'B'] as const)
        .flatMap((deck) => source[deck].layers)
        .find((layer) => layer.source?.kind === 'ndi' && layer.source.sourceId === sourceId)
        ?.source;
      toast(`NDI ${label?.kind === 'ndi' ? label.sourceName : 'input'}: ${message}`, 'error');
    });
    return () => {
      mounted = false;
      offSources?.();
      offStatus?.();
      offNdiError?.();
    };
  }, []);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return library.filter((item) => {
      if (filter !== 'all' && item.kind !== filter) return false;
      if (!search) return true;
      return item.name.toLowerCase().includes(search);
    });
  }, [library, filter, query]);

  const startCapture = async (deviceId: string, label: string) => {
    if (window.vj) {
      const granted = await window.vj.askMediaAccess('camera');
      if (!granted) {
        toast('Permesso telecamera negato: abilitalo nelle impostazioni di sistema', 'error');
        return;
      }
    }
    triggerCapture(deviceId, label);
  };

  const importMedia = async () => {
    if (!window.vj) {
      toast('Import disponibile solo nell’app desktop', 'error');
      return;
    }
    const files = await window.vj.openMediaDialog();
    if (files.length) useAppStore.getState().importMedia(files);
  };

  return (
    <aside className="panel media-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Sorgenti</span>
          <h2>{panelTab === 'scenes' ? 'Scene' : panelTab === 'sources' ? 'Ingressi' : 'Libreria'}</h2>
        </div>
        <span className="count-pill">
          {panelTab === 'scenes' ? scenes.length : panelTab === 'sources' ? devices.length : library.length}
        </span>
      </div>

      <div className="media-panel-tabs" role="tablist" aria-label="Pannello sorgenti">
        {([
          ['library', 'Libreria'],
          ['scenes', 'Scene'],
          ['sources', 'Ingressi'],
        ] as Array<[MediaPanelTab, string]>).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={panelTab === id}
            className={cx('media-panel-tab', panelTab === id && 'is-active')}
            onClick={() => setPanelTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {panelTab === 'library' ? (
        <div className="media-grid-controls">
          <span>Colonne miniature</span>
          <div className="media-grid-columns" role="group" aria-label="Colonne della griglia">
            {([2, 3, 4] as const).map((value) => (
              <button
                key={value}
                className={cx('media-grid-column-btn', mediaColumns === value && 'is-active')}
                onClick={() => setMediaColumns(value)}
                aria-pressed={mediaColumns === value}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {panelTab === 'library' ? <div className="media-tab-content">
      <div className="media-actions">
        <button className="btn" onClick={() => void importMedia()}>
          <Icon name="import" size={16} />
          Importa
        </button>
        <button className="btn" onClick={addTextItem}>
          <Icon name="text" size={16} />
          Testo
        </button>
        <div className="split-action" ref={menuRef}>
          <button
            className={cx('btn', generatorOpen && 'is-active')}
            onClick={() => setGeneratorOpen((open) => !open)}
          >
            <Icon name="sparkles" size={16} />
            Genera
            <Icon name="chevron-down" size={13} />
          </button>
          {generatorOpen ? (
            <div className="popover generator-menu">
              {GENERATOR_OPTIONS.filter((kind) => kind !== 'noise').map((kind) => (
                <button
                  key={kind}
                  onClick={() => {
                    addGenerator(kind);
                    setGeneratorOpen(false);
                  }}
                >
                  <span className={cx('gen-dot', `gen-${kind}`)} />
                  {GENERATOR_LABELS[kind]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="library-search">
        <Icon name="beam" size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca nella libreria…"
          aria-label="Cerca nella libreria"
        />
      </div>

      <div className="chip-row">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            className={cx('chip', filter === entry.id && 'is-active')}
            onClick={() => setFilter(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div
        className="library-grid"
        style={{ gridTemplateColumns: `repeat(${mediaColumns}, minmax(0, 1fr))` }}
      >
        {filtered.map((item) => (
          <button
            key={item.id}
            className={cx('media-card', selectedMediaId === item.id && 'is-selected')}
            onClick={() => triggerMedia(item.id)}
            title={`${item.name} — manda sul layer selezionato`}
          >
            <span className={cx('media-thumb', `kind-${item.kind}`)}>
              <MediaThumb item={item} />
              <span className="kind-badge">{KIND_LABEL[item.kind]}</span>
              <span
                className="media-delete"
                role="button"
                tabIndex={-1}
                title="Elimina dalla libreria"
                onClick={(event) => {
                  event.stopPropagation();
                  removeMedia(item.id);
                }}
              >
                <Icon name="trash" size={13} />
              </span>
            </span>
            <span className="media-meta">
              <span className="media-name">{item.name}</span>
              <span className="media-sub">
                {item.kind === 'video' || item.kind === 'image'
                  ? formatBytes(item.size)
                  : item.kind === 'text'
                    ? 'Testo live'
                    : item.kind === 'browser'
                      ? item.path ? 'HTML locale' : 'Pagina web'
                      : 'Generatore'}
              </span>
            </span>
          </button>
        ))}
        {filtered.length === 0 ? (
          <p className="library-empty">Nessun media con questo filtro.</p>
        ) : null}
      </div>

      <p className="hint">
        Clicca un media per mandarlo su{' '}
        <strong>
          Deck {target.deck} · L{target.layerIndex + 1}
        </strong>
        .
      </p>
      </div> : null}

      {panelTab === 'sources' ? <div className="media-tab-content">
      <div className="panel-section source-browser-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Web e HTML</span>
            <h3>Sorgenti browser</h3>
          </div>
          <Icon name="screen" size={17} />
        </div>
        <p className="hint">Aggiungi una pagina e poi mandala a un layer dalla Libreria.</p>
        <button className="btn primary wide" onClick={() => setBrowserDialogOpen(true)}>
          <Icon name="plus" size={15} />
          Aggiungi sorgente browser
        </button>
        <div className="source-count-row">
          <span>{library.filter((item) => item.kind === 'browser').length} pagine salvate</span>
          <button className="text-button" onClick={() => setPanelTab('library')}>
            Apri Libreria
          </button>
        </div>
      </div>

      <div className="panel-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Live input</span>
            <h3>Ingressi video</h3>
          </div>
          <button
            className="icon-btn"
            onClick={() => void refresh(true)}
            disabled={busy}
            title="Cerca ingressi e chiedi permesso"
          >
            <Icon name="refresh" size={15} />
          </button>
        </div>

        {devices.length === 0 ? (
          <button className="empty-slot" onClick={() => void refresh(true)} disabled={busy}>
            <Icon name="camera" size={18} />
            <span>
              {busy
                ? 'Ricerca ingressi…'
                : 'Cerca schede di acquisizione e telecamere'}
            </span>
          </button>
        ) : (
          <div className="device-list">
            {devices.map((device) => {
              const live = activeCaptures.has(device.deviceId);
              return (
                <div key={device.deviceId} className={cx('device-row', live && 'is-live')}>
                  <span className="device-icon">
                    <Icon name="camera" size={16} />
                  </span>
                  <span className="device-copy">
                    <strong>{device.label}</strong>
                    <small>{live ? 'In onda' : 'Disponibile'}</small>
                  </span>
                  <button
                    className="btn small"
                    onClick={() => void startCapture(device.deviceId, device.label)}
                  >
                    Vai
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {error ? <p className="hint error">{error}</p> : null}
        <p className="hint">
          Gli ingressi UVC e le schede HDMI vengono rilevati come telecamere. Il permesso viene
          richiesto al primo utilizzo.
        </p>
      </div>

      <div className="panel-section ndi-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">NDI · rete locale</span>
            <h3>Fonti NDI</h3>
          </div>
          <button
            className="icon-btn"
            title="Aggiorna fonti NDI"
            onClick={() => void window.vj?.refreshNdiSources()}
          >
            <Icon name="refresh" size={15} />
          </button>
        </div>
        {ndiSources.length ? (
          <div className="device-list">
            {ndiSources.map((source) => {
              const live = activeNdi.has(source.id);
              const receiving = ndiStatus?.receiving.includes(source.id) ?? false;
              const streaming = ndiStatus?.streaming.includes(source.id) ?? false;
              return (
                <div key={source.id} className={cx('device-row', live && 'is-live')}>
                  <span className="device-icon"><Icon name="screen" size={16} /></span>
                  <span className="device-copy">
                    <strong>{source.name}</strong>
                    <small>{streaming ? 'Video attivo' : receiving ? 'Collegato · attendo video' : live ? 'Connessione in corso' : 'Disponibile in rete'}</small>
                  </span>
                  <button
                    className="btn small"
                    onClick={() => triggerNdi({ kind: 'ndi', sourceId: source.id, sourceName: source.name, urlAddress: source.urlAddress, startedAt: Date.now() })}
                  >
                    Vai
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <button className="empty-slot" onClick={() => void window.vj?.refreshNdiSources()}>
            <Icon name="screen" size={18} />
            <span>{ndiStatus?.available ? 'Nessuna fonte NDI trovata: verifica rete e Discovery' : 'Avvio runtime NDI…'}</span>
          </button>
        )}
        {ndiStatus?.receiving.some((id) => !ndiStatus.streaming.includes(id)) ? (
          <p className="hint">
            Sorgente trovata ma senza frame video: verifica che StaffVJ sia autorizzato nel firewall
            e che il Wi-Fi non isoli i dispositivi. NDI usa mDNS per trovarsi e porte TCP/UDP separate
            per trasportare il video.
          </p>
        ) : null}
        {ndiStatus?.error ? <p className="hint error">{ndiStatus.error}</p> : null}
      </div>
      </div> : null}

      {panelTab === 'scenes' ? <div className="media-tab-content"><SceneShelf /></div> : null}

      <BrowserSourceDialog
        open={browserDialogOpen}
        onClose={() => setBrowserDialogOpen(false)}
        onAddUrl={addBrowserUrl}
        onAddFile={addBrowserFile}
      />
    </aside>
  );
}
