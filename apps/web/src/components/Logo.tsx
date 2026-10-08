// The word "مداد" composed by the engine itself, with a long kashida on the
// first join — the app signs its own name.

import { useMemo } from 'react';

import type { Engine } from '../engine/engine';

export function Logo({ engine, styleId, label }: { engine: Engine; styleId: string; label: string }) {
  const drawing = useMemo(() => {
    const editor = engine.createEditor(styleId, 'مداد');
    try {
      editor.setKashida(0, 520);
    } catch {
      /* the style may not allow it; the plain word is fine */
    }
    const scene = editor.scene();
    const paths = scene.glyphs.map((g) => ({
      d: engine.outline(styleId, g.gid)?.path ?? '',
      t: g.transform.join(' '),
    }));
    editor.free();
    // Tight box around the ink (the scene bounds include the whole line height).
    const b = scene.glyphs.reduce(
      (acc, g) =>
        g.bounds
          ? {
              x0: Math.min(acc.x0, g.bounds.x0),
              y0: Math.min(acc.y0, g.bounds.y0),
              x1: Math.max(acc.x1, g.bounds.x1),
              y1: Math.max(acc.y1, g.bounds.y1),
            }
          : acc,
      { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
    );
    return { paths, box: `${b.x0 - 30} ${-b.y1 - 30} ${b.x1 - b.x0 + 60} ${b.y1 - b.y0 + 60}` };
  }, [engine, styleId]);

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
