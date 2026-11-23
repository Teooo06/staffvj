import { cx } from '../lib/utils';

export interface SliderProps {
  label?: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  unit?: string;
  compact?: boolean;
  className?: string;
  disabled?: boolean;
}

export function Slider({
  label,
  value,
  defaultValue,
  min,
  max,
  step = 0.01,
  onChange,
  format,
  unit,
  compact,
  className,
  disabled,
}: SliderProps) {
  const display = format ? format(value) : String(Math.round(value * 100) / 100);
  const resetValue = Math.min(max, Math.max(min, defaultValue));
  return (
    <label className={cx('slider', compact && 'slider-compact', disabled && 'is-disabled', className)}>
      {(label || unit) && (
        <span className="slider-head">
          <span>{label}</span>
          <span className="slider-value">
            {display}
            {unit ? <em>{unit}</em> : null}
          </span>
        </span>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        onDoubleClick={() => {
          if (!disabled) onChange(resetValue);
        }}
        title="Doppio clic per ripristinare il valore predefinito"
      />
    </label>
  );
}

export interface DualRangeSliderProps {
  label?: string;
  start: number;
  end: number;
  min: number;
  max: number;
  step?: number;
  onChange: (start: number, end: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
}

export function DualRangeSlider({
  label,
  start,
  end,
  min,
  max,
  step = 0.1,
  onChange,
  format,
  disabled,
}: DualRangeSliderProps) {
  const span = Math.max(max - min, 0);
  const startPct = span > 0 ? ((start - min) / span) * 100 : 0;
  const endPct = span > 0 ? ((end - min) / span) * 100 : 100;
  const display = format ?? ((value: number) => value.toFixed(1));
  const minimumGap = Math.min(step, span);

  return (
    <div className={cx('dual-range', disabled && 'is-disabled')}>
      {label ? (
        <span className="slider-head">
          <span>{label}</span>
          <span className="slider-value">
            {display(start)} <em>→</em> {display(end)}
          </span>
        </span>
      ) : null}
      <div
        className="dual-range-control"
        onDoubleClick={() => {
          if (!disabled) onChange(min, max);
        }}
        title="Doppio clic per usare l'intero video"
      >
        <span className="dual-range-track" />
        <span
          className="dual-range-fill"
          style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
        />
        <input
          type="range"
          className="dual-range-input dual-range-start"
          aria-label={label ? `${label} — inizio` : 'Inizio'}
          min={min}
          max={max}
          step={step}
          value={start}
          disabled={disabled}
          onChange={(event) => {
            const value = Math.min(Number(event.target.value), end - minimumGap);
            onChange(Math.max(min, value), end);
          }}
        />
        <input
          type="range"
          className="dual-range-input dual-range-end"
          aria-label={label ? `${label} — fine` : 'Fine'}
          min={min}
          max={max}
          step={step}
          value={end}
          disabled={disabled}
          onChange={(event) => {
            const value = Math.max(Number(event.target.value), start + minimumGap);
            onChange(start, Math.min(max, value));
          }}
        />
      </div>
    </div>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cx('toggle', disabled && 'is-disabled')}>
      <span className="toggle-copy">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </label>
  );
}
