import { useAppStore } from '../store';
import { cx } from '../lib/utils';
import { Icon } from './Icons';

export function Toasts() {
  const toasts = useAppStore((state) => state.toasts);
  const dismiss = useAppStore((state) => state.dismissToast);

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          className={cx('toast', `toast-${toast.tone}`)}
          onClick={() => dismiss(toast.id)}
        >
          <Icon
            name={
              toast.tone === 'error'
                ? 'warning'
                : toast.tone === 'success'
                  ? 'check'
                  : 'sparkles'
            }
            size={16}
          />
          <span>{toast.message}</span>
        </button>
      ))}
    </div>
  );
}
