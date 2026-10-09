// The word "مداد" composed by the engine itself, with a long kashida on the
// first join — the app signs its own name.

import { useMemo } from 'react';

import type { Engine } from '../engine/engine';
import { drawPhrase } from '../lib/draw';

export function Logo({ engine, styleId, label }: { engine: Engine; styleId: string; label: string }) {
  const drawing = useMemo(() => drawPhrase(engine, styleId, 'مداد', (ed) => ed.setKashida(0, 520)), [engine, styleId]);

  return (
    <svg className="logo" viewBox={drawing.box} role="img" aria-label={label}>
      <g transform="scale(1,-1)">
        {drawing.paths.map((p, i) => (
          <path key={i} d={p.d} transform={`matrix(${p.t})`} />
        ))}
      </g>
    </svg>
  );
}
