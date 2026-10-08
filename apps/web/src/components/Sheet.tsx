// The drawing sheet: renders the scene, handles selection, dragging letters,
// dragging kashida handles, panning and zooming.
//
// Scene coordinates are font units with y up. Everything is drawn inside
// one <g transform="scale(1,-1)">; pointer positions are converted back to
// scene units through that group's screen matrix, so drags are exact at any
// zoom level.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import type { Engine } from '../engine/engine';
import type { GlyphKey, KashidaSlot, PlacedGlyph, Scene } from '../engine/types';
import { keyId, sameKey } from '../engine/types';
import type { Frame } from '../lib/viewport';
import { dotLadder, panFrame, rhombus, toDots, viewBox, zoomFrame } from '../lib/viewport';

interface Props {
  engine: Engine;
  styleId: string;
  scene: Scene;
  frame: Frame;
  onFrame: (f: Frame) => void;
  selection: GlyphKey | null;
  onSelect: (key: GlyphKey | null) => void;
  offsetOf: (key: GlyphKey) => [number, number];
  onMove: (key: GlyphKey, dx: number, dy: number) => void;
  onKashida: (after: number, length: number | undefined) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  showGuides: boolean;
  nuqta: number;
  alefDots: number;
  dotsLabel: string;
}

type Drag =
  | { kind: 'glyph'; key: GlyphKey; start: [number, number]; offset: [number, number]; moved: boolean; pointer: number }
  | { kind: 'kashida'; slot: KashidaSlot; startX: number; pointer: number; length: number }
  | { kind: 'pan'; startClient: [number, number]; frame: Frame; scale: number; pointer: number };

const DRAG_THRESHOLD_PX = 3;

export function Sheet(props: Props) {
  const { engine, styleId, scene, frame, onFrame, selection, onSelect, nuqta } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const selected = selection ? scene.glyphs.find((g) => sameKey(g.key, selection)) : undefined;

  /** Client (px) → scene units (y up). */
  const toScene = (clientX: number, clientY: number): [number, number] => {
    const ctm = groupRef.current?.getScreenCTM();
    if (!ctm) return [0, 0];
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  };
  const pxPerUnit = () => Math.abs(groupRef.current?.getScreenCTM()?.a ?? 1);

  // Ctrl/⌘ + wheel zooms around the pointer; a plain wheel pans.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = frameRef.current;
      if (e.ctrlKey || e.metaKey) {
        const [cx, cy] = toScene(e.clientX, e.clientY);
        onFrame(zoomFrame(f, Math.exp(-e.deltaY * 0.0025), cx, cy));
      } else {
        const s = pxPerUnit();
        onFrame(panFrame(f, e.deltaX / s, -e.deltaY / s));
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
    // toScene/pxPerUnit read refs only.
  }, [onFrame]);

  // Kashida handles: every existing elongation, plus the two joins of the selected letter.
  const visibleSlots = useMemo(() => {
    const around = new Set<number>();
    if (selected) {
      around.add(selected.span[1] - 1);
      around.add(selected.span[0] - 1);
    }
    return scene.kashida_slots.filter((s) => s.length > 0 || around.has(s.after));
  }, [scene, selected]);

  const ownerOfKashida = (after: number): GlyphKey | null => {
    const g = scene.glyphs.find((x) => x.key && x.key.index === 0 && x.span[0] <= after && after < x.span[1]);
    return g?.key ?? null;
  };

  const capture = (e: ReactPointerEvent) => {
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already-released pointer: dragging still works without capture */
    }
  };

  const onGlyphDown = (e: ReactPointerEvent, g: PlacedGlyph) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const key = g.key ?? (g.kashida !== null ? ownerOfKashida(g.kashida) : null);
    if (!key) return;
    onSelect(key);
    if (!g.key) return; // elongation glyph: select its letter only
    capture(e);
    setDrag({
      kind: 'glyph',
      key,
      start: toScene(e.clientX, e.clientY),
      offset: props.offsetOf(key),
      moved: false,
      pointer: e.pointerId,
    });
  };

  const onHandleDown = (e: ReactPointerEvent, slot: KashidaSlot) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    capture(e);
    props.onGestureStart();
    setDrag({ kind: 'kashida', slot, startX: toScene(e.clientX, e.clientY)[0], pointer: e.pointerId, length: slot.length });
  };

  const onBackgroundDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    capture(e);
    setDrag({ kind: 'pan', startClient: [e.clientX, e.clientY], frame, scale: pxPerUnit(), pointer: e.pointerId });
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    if (drag.kind === 'glyph') {
      const [x, y] = toScene(e.clientX, e.clientY);
      const dx = x - drag.start[0];
      const dy = y - drag.start[1];
      if (!drag.moved) {
        if (Math.hypot(dx, dy) * pxPerUnit() < DRAG_THRESHOLD_PX) return;
        props.onGestureStart();
        setDrag({ ...drag, moved: true });
      }
      props.onMove(drag.key, drag.offset[0] + dx, drag.offset[1] + dy);
    } else if (drag.kind === 'kashida') {
      // Arabic stretches leftwards: moving the pointer left lengthens.
      const x = toScene(e.clientX, e.clientY)[0];
      const length = Math.min(drag.slot.max, Math.max(0, drag.slot.length + (drag.startX - x)));
      setDrag({ ...drag, length });
      props.onKashida(drag.slot.after, length < drag.slot.natural * 0.5 ? undefined : length);
    } else {
      const dx = (e.clientX - drag.startClient[0]) / drag.scale;
      const dy = (e.clientY - drag.startClient[1]) / drag.scale;
      if (Math.hypot(dx, dy) * drag.scale > DRAG_THRESHOLD_PX) {
        onFrame(panFrame(drag.frame, -dx, dy));
      }
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    if (drag.kind === 'pan') {
      const moved = Math.hypot(e.clientX - drag.startClient[0], e.clientY - drag.startClient[1]);
      if (moved < DRAG_THRESHOLD_PX) onSelect(null);
    } else if (drag.kind === 'kashida' || drag.moved) {
      props.onGestureEnd();
    }
    setDrag(null);
  };

  const handleSize = nuqta * 0.7;
  const ladderX = scene.bounds.x1 + nuqta * 1.2;

  return (
    <svg
      ref={svgRef}
      className={`sheet${drag?.kind === 'pan' ? ' is-panning' : ''}`}
      viewBox={viewBox(frame)}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onBackgroundDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="img"
      aria-label={scene.lines.length ? undefined : ''}
    >
      <g ref={groupRef} transform="scale(1,-1)">
        {props.showGuides &&
          scene.lines.map((line, i) => (
            <g key={`guide-${i}`} className="guides" aria-hidden="true">
              <line
                x1={frame.x0}
                x2={frame.x1}
                y1={line.baseline}
                y2={line.baseline}
                className="baseline"
                vectorEffect="non-scaling-stroke"
              />
              {dotLadder(ladderX, line.baseline, nuqta, props.alefDots).map((d, j) => (
                <polygon key={j} className="ladder-dot" points={rhombus(d.cx, d.cy, nuqta * 0.92)} />
              ))}
            </g>
          ))}

        {scene.glyphs.map((g, i) => {
          const outline = engine.outline(styleId, g.gid);
          if (!outline || !outline.path) return null;
          const id = g.key ? keyId(g.key) : `k${g.kashida}`;
          const isSelected = !!g.key && sameKey(g.key, selection);
          const cls = ['glyph', isSelected && 'is-selected', hover === id && !isSelected && 'is-hover']
            .filter(Boolean)
            .join(' ');
          return (
            <path
              key={`${id}-${i}`}
              className={cls}
              d={outline.path}
              transform={`matrix(${g.transform.join(' ')})`}
              onPointerDown={(e) => onGlyphDown(e, g)}
              onPointerEnter={() => setHover(id)}
              onPointerLeave={() => setHover((h) => (h === id ? null : h))}
            />
          );
        })}

        {selected?.bounds && (
          <rect
            className="selection-box"
            x={selected.bounds.x0}
            y={selected.bounds.y0}
            width={selected.bounds.x1 - selected.bounds.x0}
            height={selected.bounds.y1 - selected.bounds.y0}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}

        {visibleSlots.map((slot) => (
          <polygon
            key={`slot-${slot.after}`}
            className={`kashida-handle${slot.length > 0 ? ' is-active' : ''}`}
            points={rhombus(slot.x, slot.y, handleSize)}
            onPointerDown={(e) => onHandleDown(e, slot)}
          >
            <title>{`${toDots(slot.length, nuqta)} ${props.dotsLabel}`}</title>
          </polygon>
        ))}
      </g>

      {drag?.kind === 'kashida' && (
        <text
          className="drag-label"
          x={drag.slot.x}
          y={-drag.slot.y + nuqta * 1.6}
          fontSize={nuqta * 0.9}
          textAnchor="middle"
        >
          {`${toDots(drag.length, nuqta)} ${props.dotsLabel}`}
        </text>
      )}
    </svg>
  );
}
