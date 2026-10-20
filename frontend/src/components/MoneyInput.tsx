import { useEffect, useState } from "react";
import { num, parseMoney } from "../utils/format";

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

/** Input Rupiah: diketik bebas, diformat 1.234.567 saat keluar fokus. Kosong = null (≠ 0). */
export default function MoneyInput({ value, onChange, disabled, placeholder, id }: Props) {
  const [text, setText] = useState(value == null ? "" : num(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value == null ? "" : num(value));
  }, [value, focused]);

  return (
    <input
      id={id}
      className="input tnum text-right"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      placeholder={placeholder}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseMoney(e.target.value));
      }}
      onBlur={() => {
        setFocused(false);
        setText(value == null ? "" : num(value));
      }}
    />
  );
}
