import { describe, expect, it } from 'vitest';

import type { Scene } from '../engine/types';
import { dotLadder, fitFrame, fromDots, panFrame, toDots, viewBox, zoomFrame } from './viewport';

const scene = (x0: number, x1: number): Scene => ({
  units_per_em: 1000,
  ascender: 1100,
  descender: -600,
  glyphs: [],
  bounds: { x0, y0: -600, x1, y1: 1100 },
  lines: [],
  kashida_slots: [],
  warnings: [],
});

describe('fitFrame', () => {
  it('pads the composition', () => {
    const f = fitFrame(scene(-6000, 0));
    expect(f.x0).toBeLessThan(-6000);
    expect(f.x1).toBeGreaterThan(0);
    expect(f.y1).toBeGreaterThan(1100);
  });

  it('keeps a minimum width, anchored at the right edge', () => {
    const f = fitFrame(scene(-200, 0), 5);
    expect(f.x1 - f.x0).toBeCloseTo(5000);
    expect(f.x1).toBeCloseTo(900);
  });
});

describe('zoom and pan', () => {
  it('zooming in shrinks the frame around its centre', () => {
    const f = zoomFrame({ x0: 0, y0: 0, x1: 100, y1: 100 }, 2);
    expect(f).toEqual({ x0: 25, y0: 25, x1: 75, y1: 75 });
  });

  it('pans', () => {
    expect(panFrame({ x0: 0, y0: 0, x1: 10, y1: 10 }, 5, -5)).toEqual({ x0: 5, y0: -5, x1: 15, y1: 5 });
  });

  it('builds a y-flipped viewBox', () => {
    expect(viewBox({ x0: -10, y0: -20, x1: 30, y1: 40 })).toBe('-10 -40 40 60');
  });
});

describe('dots', () => {
  it('converts units to calligraphic dots and back', () => {
    expect(toDots(278, 139)).toBe(2);
    expect(fromDots(2.5, 139)).toBe(348);
  });

  it('stacks the ladder from the baseline', () => {
    const d = dotLadder(0, 0, 100, 5);
    expect(d).toHaveLength(5);
    expect(d[0].cy).toBe(50);
    expect(d[4].cy).toBe(450);
  });
});
