import { useId, type ReactNode } from 'react';

export function Field({
  label,
  optional,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  const Tag = htmlFor ? 'label' : 'div';
  return (
    <div className="field">
      <Tag className="field__label" {...(htmlFor ? { htmlFor } : {})}>
        {label}
        {optional && <span className="field__optional">선택</span>}
      </Tag>
      {hint && <p className="field__hint">{hint}</p>}
      {children}
    </div>
  );
}

interface ChipOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`chip ${value === o.value ? 'is-on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <span aria-hidden="true">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MultiChips({
  options,
  value,
  onChange,
  label,
  max = 3,
}: {
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  label: string;
  max?: number;
}) {
  const toggle = (o: string) => {
    if (value.includes(o)) onChange(value.filter((v) => v !== o));
    else onChange([...value, o].slice(-max));
  };
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value.includes(o)}
          className={`chip ${value.includes(o) ? 'is-on' : ''}`}
          onClick={() => toggle(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function SidoSigungu({
  sido,
  sigungu,
  onSido,
  onSigungu,
  options,
}: {
  sido: string;
  sigungu: string;
  onSido: (v: string) => void;
  onSigungu: (v: string) => void;
  options: readonly string[];
}) {
  const id = useId();
  return (
    <div className="row2">
      <div>
        <label className="sublabel" htmlFor={`${id}-sido`}>
          시·도
        </label>
        <select id={`${id}-sido`} className="input select" value={sido} onChange={(e) => onSido(e.target.value)}>
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="sublabel" htmlFor={`${id}-sgg`}>
          시·군·구
        </label>
        <input
          id={`${id}-sgg`}
          className="input"
          value={sigungu}
          maxLength={20}
          placeholder="예: 마포구"
          onChange={(e) => onSigungu(e.target.value)}
        />
      </div>
    </div>
  );
}
