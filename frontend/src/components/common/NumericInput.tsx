import React, { useState, useEffect } from 'react';

interface NumericInputProps {
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  defaultValue?: number;
  allowDecimals?: boolean;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  min,
  max,
  step,
  placeholder = '',
  className = '',
  defaultValue = 1,
  allowDecimals = false,
}) => {
  // Maintain local string representation to allow complete backspacing and typing
  const [text, setText] = useState<string>(
    value !== undefined && value !== null ? String(value) : ''
  );

  // Synchronize when external value changes
  useEffect(() => {
    setText(value !== undefined && value !== null ? String(value) : '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    if (raw === '' || raw === '-') {
      return; // allow user to delete all characters or type negative sign
    }

    const num = allowDecimals || (step && step % 1 !== 0) ? parseFloat(raw) : parseInt(raw, 10);
    if (!isNaN(num)) {
      onChange(num);
    }
  };

  const handleBlur = () => {
    if (text === '' || text === '-' || isNaN(Number(text))) {
      const fallback = defaultValue;
      setText(String(fallback));
      onChange(fallback);
      return;
    }

    let num = allowDecimals || (step && step % 1 !== 0) ? parseFloat(text) : parseInt(text, 10);
    if (min !== undefined && num < min) num = min;
    if (max !== undefined && num > max) num = max;

    setText(String(num));
    onChange(num);
  };

  return (
    <input
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
};
