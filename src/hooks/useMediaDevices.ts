import { useCallback, useEffect, useState } from 'react';
import { listInputDevices, primePermission } from '../lib/devices';
import type { InputDevice } from '../lib/devices';

export function useMediaDevices(kind: 'videoinput' | 'audioinput') {
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (ask = false) => {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setError('Ingressi non disponibili in questo ambiente');
        return;
      }
      if (ask) {
        setBusy(true);
        const granted = await primePermission(kind);
        setBusy(false);
        if (!granted) {
          setError(
            kind === 'videoinput'
              ? 'Permesso telecamera negato o nessun ingresso disponibile'
              : 'Permesso microfono negato o nessun ingresso disponibile',
          );
          return;
        }
        setError(null);
      }
      try {
        setDevices(await listInputDevices(kind));
        if (ask) setError(null);
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : 'Errore ingressi');
      }
    },
    [kind],
  );

  useEffect(() => {
    void refresh(false);
    const handler = () => {
      void refresh(false);
    };
    navigator.mediaDevices?.addEventListener('devicechange', handler);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handler);
    };
  }, [refresh]);

  return { devices, busy, error, refresh };
}
