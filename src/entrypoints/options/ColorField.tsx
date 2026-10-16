import { useState } from 'preact/hooks';
import { isDarkEnough, SWATCHES } from '@/lib/theme';

type Props = { role: 'accent' | 'bg' | 'watch'; label: string; value: string; onChange: (hex: string) => void };

/** Five swatches plus a custom color, as one radio group. */
export function ColorField({ role, label, value, onChange }: Props) {
  const [error, setError] = useState('');
  const swatches = SWATCHES[role];
  const isCustom = !swatches.some((s) => s.hex.toLowerCase() === value.toLowerCase());

  const pickCustom = (hex: string) => {
    if (role === 'bg' && !isDarkEnough(hex)) return setError('CGA is dark only. Pick a darker background.');
    setError('');
    onChange(hex.toUpperCase());
  };

  return (
    <fieldset class="color-field">
      <legend>{label}</legend>
      <div class="swatches">
        {swatches.map((s) => (
          <label class="swatch" title={s.name}>
            <input
              type="radio"
              name={`cga-${role}`}
              checked={s.hex.toLowerCase() === value.toLowerCase()}
              onChange={() => {
                setError('');
                onChange(s.hex);
              }}
            />
            <span class="dot" style={{ background: s.hex }} />
            <span class="swatch-name">{s.name}</span>
          </label>
        ))}
        <label class="swatch">
          <input type="color" value={value} onChange={(e) => pickCustom(e.currentTarget.value)} />
          <span class="swatch-name">{isCustom ? value.toUpperCase() : 'Custom'}</span>
        </label>
      </div>
      {error && (
        <p class="warn" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
