// Set a short phrase with the engine and return its outlines, framed tightly
// around the ink. Used for the wordmark and the style-option samples.

import type { EditorHandle, Engine } from '../engine/engine';

export interface Drawing {
  paths: Array<{ d: string; t: string }>;
  /** SVG viewBox (y already flipped). */
  box: string;
}

export function drawPhrase(
  engine: Engine,
  styleId: string,
  text: string,
  setup?: (editor: EditorHandle) => void,
  pad = 30,
): Drawing {
  const editor = engine.createEditor(styleId, text);
  try {
    setup?.(editor);
  } catch {
    /* the style may refuse the setup; the plain phrase is fine */
  }
  const scene = editor.scene();
  editor.free();
  const paths = scene.glyphs.map((g) => ({
    d: engine.outline(styleId, g.gid)?.path ?? '',
    t: g.transform.join(' '),
  }));
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
  if (!Number.isFinite(b.x0)) return { paths, box: '0 0 1 1' };
  return { paths, box: `${b.x0 - pad} ${-b.y1 - pad} ${b.x1 - b.x0 + 2 * pad} ${b.y1 - b.y0 + 2 * pad}` };
}
