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
