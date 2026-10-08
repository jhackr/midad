// A single glyph drawn at thumbnail size. All thumbnails share the same
// vertical frame (ascender → descender) so shapes can be compared by eye.

import type { GlyphOutline } from '../engine/types';

interface Props {
  outline: GlyphOutline | undefined;
  ascender: number;
  descender: number;
}

export function GlyphThumb({ outline, ascender, descender }: Props) {
  if (!outline?.bounds) return <svg className="thumb" aria-hidden="true" />;
  const b = outline.bounds;
  const height = ascender - descender;
  const pad = height * 0.08;
  const width = Math.max(b.x1 - b.x0, height * 0.35);
  const cx = (b.x0 + b.x1) / 2;
  const box = `${cx - width / 2 - pad} ${-ascender - pad} ${width + 2 * pad} ${height + 2 * pad}`;
  return (
    <svg className="thumb" viewBox={box} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d={outline.path} transform="scale(1,-1)" />
    </svg>
  );
}
