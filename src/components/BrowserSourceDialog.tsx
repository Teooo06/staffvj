import { useState } from 'react';
import { Modal } from './Modal';

export function BrowserSourceDialog({
  open,
  onClose,
  onAddUrl,
  onAddFile,
}: {
  open: boolean;
  onClose: () => void;
  onAddUrl: (url: string) => void;
  onAddFile: (path: string, name: string) => void;
}) {
  const [url, setUrl] = useState('https://');
  const [error, setError] = useState<string | null>(null);

  const addUrl = () => {
    const value = url.trim();
    if (!value || value === 'https://') return;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setError('Usa un indirizzo HTTP o HTTPS.');
        return;
      }
      onAddUrl(parsed.toString());
      setUrl('https://');
      setError(null);
      onClose();
    } catch (_error) {
      setError('Inserisci un indirizzo web valido.');
    }
  };

  const addLocalFile = async () => {
    const file = await window.vj?.openHtmlDialog();
    if (!file) return;
    onAddFile(file.path, file.name);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Aggiungi sorgente browser"
      subtitle="La pagina viene renderizzata come un livello video. L’audio della pagina è disattivato."
      onClose={onClose}
    >
      <div className="browser-source-form">
        <label className="field">
          <span>Indirizzo web</span>
          <input
            type="url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addUrl();
            }}
            placeholder="https://esempio.it"
            autoFocus
        />
        {error ? <p className="hint error">{error}</p> : null}
        </label>
        <button className="btn primary wide" onClick={addUrl}>
          Aggiungi URL
        </button>
        <div className="browser-source-divider"><span>oppure</span></div>
        <button className="btn wide" onClick={() => void addLocalFile()}>
          Scegli file HTML locale
        </button>
        <p className="hint">
          Le sorgenti browser vengono salvate nel progetto. I file HTML locali restano nel loro
          percorso sul computer.
        </p>
      </div>
    </Modal>
  );
}
