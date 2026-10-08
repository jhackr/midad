// Pure helpers for the drawing sheet. Scene coordinates are font units with
// y up; SVG coordinates are y down. The sheet draws everything inside one
// <g transform="scale(1,-1)">, so a scene point (x, y) sits at SVG (x, -y).

import type { Rect, Scene } from '../engine/types';

export interface Frame {
  /** Visible region in scene units (y up). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A frame around the composition with breathing room, never narrower than `minWidth`. */
export function fitFrame(scene: Scene, minWidthEm = 5): Frame {
  const b = scene.bounds;
  const em = scene.units_per_em;
  const padX = em * 0.9;
  const padY = em * 0.6;
  let x0 = b.x0 - padX;
  let x1 = b.x1 + padX;
  const minWidth = em * minWidthEm;
  if (x1 - x0 < minWidth) {
    // Keep the right edge (start of the line) fixed, extend to the left.
    x0 = x1 - minWidth;
  }
  return { x0, y0: b.y0 - padY, x1, y1: b.y1 + padY };
}

/** Zoom a frame around its centre (factor > 1 zooms in). */
export function zoomFrame(f: Frame, factor: number, cx?: number, cy?: number): Frame {
  const px = cx ?? (f.x0 + f.x1) / 2;
  const py = cy ?? (f.y0 + f.y1) / 2;
  const s = 1 / factor;
  return {
    x0: px + (f.x0 - px) * s,
    x1: px + (f.x1 - px) * s,
    y0: py + (f.y0 - py) * s,
    y1: py + (f.y1 - py) * s,
  };
}

export function panFrame(f: Frame, dx: number, dy: number): Frame {
  return { x0: f.x0 + dx, x1: f.x1 + dx, y0: f.y0 + dy, y1: f.y1 + dy };
}

/** SVG viewBox string for a frame (flipping y). */
export function viewBox(f: Frame): string {
  return `${f.x0} ${-f.y1} ${f.x1 - f.x0} ${f.y1 - f.y0}`;
}

/** Bounding box of a glyph outline after its transform (scene units). */
export function rectCenter(r: Rect): [number, number] {
  return [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
}

/** Font units → calligraphic dots, rounded to one decimal. */
export function toDots(units: number, nuqta: number): number {
  return Math.round((units / nuqta) * 10) / 10;
}

export function fromDots(dots: number, nuqta: number): number {
  return Math.round(dots * nuqta);
}

/**
 * Positions of the rhombic dots of the measure ladder (ميزان) drawn at the
 * start of a line: `count` dots stacked from the baseline, alternating
 * slightly left and right like a calligrapher's practice sheet.
 */
export function dotLadder(x: number, baseline: number, nuqta: number, count: number) {
  const dots: Array<{ cx: number; cy: number }> = [];
  for (let i = 0; i < count; i++) {
    dots.push({ cx: x + (i % 2 === 0 ? 0 : nuqta * 0.55), cy: baseline + nuqta * (i + 0.5) });
  }
  return dots;
}

/** Points of a rhombus (the reed-pen dot) centred on (cx, cy); `size` is its diagonal. */
export function rhombus(cx: number, cy: number, size: number): string {
  const h = size / 2;
  return `${cx},${cy + h} ${cx + h},${cy} ${cx},${cy - h} ${cx - h},${cy}`;
}
