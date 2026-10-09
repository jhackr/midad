// The phrase, typed in a single Naskh line docked under the sheet. It grows
// to a few lines for multi-line pieces.

import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface Props {
  value: string;
  placeholder: string;
  label: string;
  fontFamily: string;
  onChange: (text: string) => void;
  /** Extra controls at the end of the line (e.g. piece settings on a phone). */
  children?: ReactNode;
}

const MAX_LINES = 4;

export function Composer({ value, placeholder, label, fontFamily, onChange, children }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const line = parseFloat(getComputedStyle(el).lineHeight) || 40;
    el.style.height = `${Math.min(el.scrollHeight, line * MAX_LINES + 16)}px`;
  }, [value]);

  return (
    <div className="composer">
      <textarea
        ref={ref}
        className="composer-input"
        dir="rtl"
        lang="ar"
        rows={1}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        spellCheck={false}
        style={{ fontFamily }}
        onChange={(e) => onChange(e.target.value)}
      />
      {children}
    </div>
  );
}
