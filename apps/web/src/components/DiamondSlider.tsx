// The kashida control: a woven row of pen dots, one rhombus per nuqta, that
// fills from the right as the join stretches (Arabic elongates leftwards).
// It is a real slider underneath: pointer drag, arrow keys, Home/End.

import { useId, useRef } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';

interface Props {
  /** Current length, in dots. */
  value: number;
  /** Longest allowed length, in dots. */
  max: number;
  label: string;
  valueText: string;
  disabled?: boolean;
  onChange: (dots: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

const CELL = 14;
const DIAMOND = 10.5;

export function DiamondSlider({ value, max, label, valueText, disabled, onChange, onStart, onEnd }: Props) {
  const clipId = `dfill${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const count = Math.max(1, Math.ceil(max - 1e-6));
  const width = count * CELL;
  const clamp = (v: number) => Math.min(max, Math.max(0, Math.round(v * 10) / 10));

  const fromPointer = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return value;
    // Filled from the right edge: the row grows the way the join does.
    return clamp(((r.right - clientX) / r.width) * count);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    onStart?.();
    onChange(fromPointer(e.clientX));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) onChange(fromPointer(e.clientX));
  };
  const finish = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onEnd?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = e.shiftKey ? 1 : 0.5;
    const next: Record<string, number> = {
      ArrowLeft: value + step,
      ArrowUp: value + step,
      ArrowRight: value - step,
      ArrowDown: value - step,
      PageUp: value + 2,
      PageDown: value - 2,
      Home: 0,
      End: max,
    };
    if (!(e.key in next)) return;
    e.preventDefault();
    onChange(clamp(next[e.key]));
  };

  // Fill width in cells, measured from the right.
  const filled = Math.min(count, value) * CELL;

  return (
    <div
      ref={ref}
      className="diamond-slider"
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      aria-disabled={disabled || undefined}
      aria-orientation="horizontal"
      style={{ '--cells': count } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onKeyDown={onKeyDown}
    >
      <svg viewBox={`0 0 ${width} ${CELL}`} aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={clipId}>
            <rect x={width - filled} y={0} width={filled} height={CELL} />
          </clipPath>
        </defs>
        <g className="diamond-empty">
          {Array.from({ length: count }, (_, i) => (
            <path key={i} d={rhombusPath(i * CELL + CELL / 2, CELL / 2, DIAMOND)} />
          ))}
        </g>
        <g className="diamond-full" clipPath={`url(#${clipId})`}>
          {Array.from({ length: count }, (_, i) => (
            <path key={i} d={rhombusPath(i * CELL + CELL / 2, CELL / 2, DIAMOND)} />
          ))}
        </g>
      </svg>
    </div>
  );
}

function rhombusPath(cx: number, cy: number, size: number) {
  const h = size / 2;
  return `M${cx} ${cy - h}L${cx + h} ${cy}L${cx} ${cy + h}L${cx - h} ${cy}Z`;
}
