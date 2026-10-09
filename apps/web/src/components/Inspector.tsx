// The tools beside the sheet. With no letter selected they set up the whole
// piece (alignment, spacing, style options); with a letter selected they
// shape that letter (shapes, stretch, offset, size, slant).
//
// Desktop shows every tool in one column. On a phone the same tools sit in
// a bottom sheet, one at a time, switched by a tab bar under the thumb.

import { useMemo } from 'react';
import type { CSSProperties, PointerEventHandler, ReactNode } from 'react';

import type { Engine } from '../engine/engine';
import type { Align, StyleSummary } from '../engine/types';
import { sameKey } from '../engine/types';
import type { Midad } from '../engine/useMidad';
import { letterOrder, resetLetter } from '../engine/useMidad';
import type { Lang, Strings } from '../i18n';
import { drawPhrase } from '../lib/draw';
import { isDesktop } from '../lib/platform';
import { fromDots, toDots } from '../lib/viewport';
import { DiamondSlider } from './DiamondSlider';
import { Hint, IconButton, useHoverTip } from './Floating';
import { GlyphThumb } from './GlyphThumb';
import type { IconName } from './Icon';
import { Dot, Icon } from './Icon';

export type Tool = 'shapes' | 'kashida' | 'move' | 'size' | 'slant';

interface Common {
  t: Strings;
  lang: Lang;
  engine: Engine;
  style: StyleSummary;
  midad: Midad;
  naskhFamily: string;
  report: (error: string | null) => void;
}

function SectionHead({ icon, label, hint, t }: { icon: IconName; label: string; hint?: ReactNode; t: Strings }) {
  return (
    <header className="section-head">
      <Icon name={icon} size={16} />
      <h3>{label}</h3>
      {hint && <Hint label={`${t.moreInfo}: ${label}`}>{hint}</Hint>}
    </header>
  );
}

// ------------------------------------------------------------------ letter

export function LetterTools(props: Common & { compact: boolean; tool: Tool; onTool: (tool: Tool) => void; onClose: () => void }) {
  const { t, engine, style, midad, naskhFamily, report, compact, tool } = props;
  const glyph = midad.selectedGlyph;
  const key = midad.selection;

  const alternates = useMemo(
    () => (key ? midad.editor.alternates(key) : []),
    // Re-read after every edit: the current shape may have changed.
    [midad.editor, key, midad.revision],
  );

  if (!glyph || !key) return null;

  const override = midad.doc.glyphs.find((g) => g.cluster === key.cluster && g.index === key.index);
  const dx = override?.dx ?? 0;
  const dy = override?.dy ?? 0;
  const scale = override?.scale ?? 1;
  const rotate = override?.rotate ?? 0;
  const chars = Array.from(midad.doc.text).slice(glyph.span[0], glyph.span[1]).join('');
  const slot = midad.scene.kashida_slots.find((s) => s.after === glyph.span[1] - 1);
  const changed = glyph.modified || (slot?.length ?? 0) > 0;
  const nuqta = style.nuqta;
  const gesture = {
    onPointerDown: () => midad.editor.beginGesture(),
    onPointerUp: () => midad.editor.endGesture(),
  };

  const order = letterOrder(midad.scene);
  const at = order.findIndex((k) => sameKey(k, key));
  const step = (d: number) => {
    const next = order[(at + d + order.length) % order.length];
    if (next) midad.select(next);
  };

  const shapes = (
    <div className={alternates.length > 1 ? 'shape-grid' : 'shape-grid is-single'} role="listbox" aria-label={t.shapes}>
      {(alternates.length > 0 ? alternates : [{ gid: glyph.gid, is_default: true, is_current: true }]).map((a) => (
        <button
          key={a.gid}
          type="button"
          role="option"
          aria-selected={a.is_current}
          aria-label={a.is_default ? t.original : `${t.shapes} ${a.gid}`}
          className="shape-tile"
          onClick={() => report(midad.act((ed) => ed.setAlternate(key, a.is_default ? undefined : a.gid)))}
        >
          <GlyphThumb outline={engine.outline(style.id, a.gid)} ascender={style.ascender} descender={style.descender} />
          {a.is_default && <Dot filled={false} className="tile-origin" />}
        </button>
      ))}
    </div>
  );

  const slotDots = slot ? toDots(slot.length, nuqta) : 0;
  const kashida = (
    <div className={slot ? 'tool-row' : 'tool-row is-off'}>
      <DiamondSlider
        value={slotDots}
        max={slot ? toDots(slot.max, nuqta) : toDots(style.kashida.max_length, nuqta)}
        label={t.kashida}
        valueText={`${slotDots} ${t.dots}`}
        disabled={!slot}
        onStart={() => midad.editor.beginGesture()}
        onEnd={() => midad.editor.endGesture()}
        onChange={(dots) => {
          if (!slot) return;
          report(midad.act((ed) => ed.setKashida(slot.after, dots < 0.3 ? undefined : fromDots(dots, nuqta))));
        }}
      />
      <output className="readout">
        {slotDots}
        <Dot />
      </output>
    </div>
  );

  const move = (
    <div className="steppers">
      <Stepper
        icon="moveH"
        label={t.horizontal}
        t={t}
        value={toDots(dx, nuqta)}
        onChange={(v) => midad.act((ed) => ed.setOffset(key, fromDots(v, nuqta), dy))}
      />
      <Stepper
        icon="moveV"
        label={t.vertical}
        t={t}
        value={toDots(dy, nuqta)}
        onChange={(v) => midad.act((ed) => ed.setOffset(key, dx, fromDots(v, nuqta)))}
      />
    </div>
  );

  const size = (
    <RangeRow
      label={t.size}
      min={20}
      max={300}
      step={1}
      origin={100}
      value={Math.round(scale * 100)}
      readout={`${Math.round(scale * 100)}%`}
      gesture={gesture}
      onChange={(v) => midad.act((ed) => ed.setScale(key, v / 100))}
    />
  );

  const slant = (
    <RangeRow
      label={t.rotation}
      min={-45}
      max={45}
      step={0.5}
      origin={0}
      value={rotate}
      readout={`${rotate}°`}
      gesture={gesture}
      onChange={(v) => midad.act((ed) => ed.setRotation(key, v))}
    />
  );

  const kashidaHint = slot ? t.kashidaHint : t.kashidaUnavailable;
  const tools: Array<{ id: Tool; icon: IconName; label: string; hint?: string; body: ReactNode }> = [
    { id: 'shapes', icon: 'shapes', label: t.shapes, hint: alternates.length > 1 ? undefined : t.noShapes, body: shapes },
    { id: 'kashida', icon: 'kashida', label: t.kashida, hint: kashidaHint, body: kashida },
    { id: 'move', icon: 'move', label: t.position, hint: t.positionHint, body: move },
    { id: 'size', icon: 'size', label: t.size, body: size },
    { id: 'slant', icon: 'slant', label: t.rotation, body: slant },
  ];

  const active = tools.find((x) => x.id === tool) ?? tools[0];
  const activeHint = active.hint && (
    <Hint label={`${t.moreInfo}: ${active.label}`} side="above">
      {active.hint}
    </Hint>
  );

  const header = (
    <header className="letter-head">
      <div className="letter-nav" dir="rtl">
        <IconButton icon="chevronRight" label={t.prevLetter} keys="Shift+Tab" onClick={() => step(-1)} />
        <span className="letter-glyph" style={{ fontFamily: naskhFamily }} lang="ar">
          {chars}
        </span>
        <IconButton icon="chevronLeft" label={t.nextLetter} keys="Tab" onClick={() => step(1)} />
      </div>
      {changed && (
        <span className="modified-mark" role="img" aria-label={t.modified}>
          <Dot />
        </span>
      )}
      {compact && activeHint}
      <span className="head-actions">
        <IconButton
          icon="reset"
          label={t.resetLetter}
          keys="Delete"
          disabled={!changed}
          onClick={() => midad.act((ed) => resetLetter(ed, midad.scene, key))}
        />
        {compact && <IconButton icon="close" label={t.close} keys="Esc" onClick={props.onClose} />}
      </span>
    </header>
  );

  if (compact) {
    return (
      <div className="letter-tools is-compact">
        {header}
        <div className="tool-stage" key={active.id}>
          {active.body}
        </div>
        <nav className="tool-tabs" role="tablist" aria-label={t.letter}>
          {tools.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={x.id === active.id}
              className="tool-tab"
              onClick={() => props.onTool(x.id)}
            >
              <Icon name={x.icon} />
              <span>{x.label}</span>
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="letter-tools">
      {header}
      {tools.map((x) => (
        <section key={x.id} className="tool-section">
          <SectionHead icon={x.icon} label={x.label} hint={x.hint} t={t} />
          {x.body}
        </section>
      ))}
    </div>
  );
}

function Stepper(props: { icon: IconName; label: string; t: Strings; value: number; onChange: (v: number) => void }) {
  const set = (v: number) => props.onChange(Math.round(v * 10) / 10);
  return (
    <div className="stepper" role="group" aria-label={props.label}>
      <span className="stepper-icon" aria-hidden="true">
        <Icon name={props.icon} size={18} />
      </span>
      <span className="stepper-field" dir="ltr">
        <button type="button" className="stepper-btn" aria-label={`${props.t.less}: ${props.label}`} onClick={() => set(props.value - 0.5)}>
          <Icon name="minus" size={16} />
        </button>
        <input
          type="number"
          inputMode="decimal"
          step={0.1}
          value={props.value}
          aria-label={props.label}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) props.onChange(v);
          }}
        />
        <Dot className="stepper-unit" />
        <button type="button" className="stepper-btn" aria-label={`${props.t.more}: ${props.label}`} onClick={() => set(props.value + 0.5)}>
          <Icon name="plus" size={16} />
        </button>
      </span>
    </div>
  );
}

function RangeRow(props: {
  label: string;
  min: number;
  max: number;
  step: number;
  /** The neutral value, marked on the track. */
  origin?: number;
  value: number;
  readout: string;
  gesture?: { onPointerDown: PointerEventHandler; onPointerUp: PointerEventHandler };
  onChange: (v: number) => void;
}) {
  const pct = (v: number) => ((v - props.min) / (props.max - props.min)) * 100;
  const from = pct(props.origin ?? props.min);
  const to = pct(props.value);
  return (
    <div className="tool-row">
      <input
        type="range"
        className="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        aria-label={props.label}
        aria-valuetext={props.readout}
        style={{ '--lo': `${Math.min(from, to)}%`, '--hi': `${Math.max(from, to)}%` } as CSSProperties}
        {...props.gesture}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      <output className="readout" dir="ltr">
        {props.readout}
      </output>
    </div>
  );
}

// ------------------------------------------------------------------- piece

export function PieceTools(props: Common & { onClose?: () => void }) {
  const { t, lang, style, midad } = props;
  const aligns: Array<[Align, IconName, string]> = [
    ['right', 'alignRight', t.alignRight],
    ['center', 'alignCenter', t.alignCenter],
    ['left', 'alignLeft', t.alignLeft],
  ];
  const hasChanges = midad.doc.glyphs.length > 0 || Object.keys(midad.doc.kashidas).length > 0;

  return (
    <div className="piece-tools">
      <header className="piece-head">
        <span className="style-name">{style.name[lang] ?? style.name.ar}</span>
        <Hint label={`${t.moreInfo}: ${style.name[lang] ?? style.name.ar}`}>
          <p>{style.description[lang] ?? style.description.ar}</p>
          <p className="bubble-muted">{style.credits}</p>
          <p className="bubble-muted">
            {t.license}: {style.license}
            {style.upstream && (
              <>
                {' · '}
                <a href={style.upstream} target="_blank" rel="noreferrer" dir="ltr">
                  {style.upstream.replace(/^https?:\/\//, '')}
                </a>
              </>
            )}
          </p>
        </Hint>
        <span className="head-actions">
          <IconButton
            icon="eraser"
            label={t.resetAll}
            disabled={!hasChanges}
            onClick={() => midad.act((ed) => ed.resetAll())}
          />
          {props.onClose && <IconButton icon="close" label={t.close} keys="Esc" onClick={props.onClose} />}
        </span>
      </header>

      <section className="tool-section">
        <SectionHead icon="alignRight" label={t.layout} t={t} />
        <div className="segmented" role="radiogroup" aria-label={t.layout} dir="rtl">
          {aligns.map(([value, icon, label]) => (
            <IconButton
              key={value}
              icon={icon}
              label={label}
              role="radio"
              aria-checked={midad.doc.layout.align === value}
              className="segment"
              onClick={() => midad.act((ed) => ed.setAlign(value))}
            />
          ))}
        </div>
      </section>

      <section className="tool-section">
        <SectionHead icon="lineSpacing" label={t.lineSpacing} t={t} />
        <RangeRow
          label={t.lineSpacing}
          min={0.6}
          max={2.5}
          step={0.05}
          origin={1}
          value={midad.doc.layout.line_spacing}
          readout={`${midad.doc.layout.line_spacing.toFixed(2)}×`}
          gesture={{ onPointerDown: () => midad.editor.beginGesture(), onPointerUp: () => midad.editor.endGesture() }}
          onChange={(v) => midad.act((ed) => ed.setLineSpacing(v))}
        />
      </section>

      {style.options.length > 0 && (
        <section className="tool-section">
          <SectionHead
            icon="sliders"
            label={t.styleOptions}
            t={t}
            hint={
              <dl className="bubble-list">
                {style.options.map((o) => (
                  <div key={o.tag}>
                    <dt lang="ar" style={{ fontFamily: props.naskhFamily }}>
                      {o.sample ?? '·'}
                    </dt>
                    <dd>{o.label[lang] ?? o.label.ar ?? o.tag}</dd>
                  </div>
                ))}
              </dl>
            }
          />
          <div className="option-grid">
            {style.options
              .filter((o) => o.sample)
              .map((o) => (
                <OptionTile
                  key={o.tag}
                  engine={props.engine}
                  styleId={style.id}
                  tag={o.tag}
                  sample={o.sample as string}
                  label={o.label[lang] ?? o.label.ar ?? o.tag}
                  on={midad.doc.options.includes(o.tag)}
                  onToggle={(on) => midad.act((ed) => ed.setOption(o.tag, on))}
                />
              ))}
          </div>
          {style.options.some((o) => !o.sample) && (
            <ul className="switch-list">
              {style.options
                .filter((o) => !o.sample)
                .map((o) => (
                  <li key={o.tag}>
                    <label className="switch">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={midad.doc.options.includes(o.tag)}
                        onChange={(e) => midad.act((ed) => ed.setOption(o.tag, e.target.checked))}
                      />
                      <span className="switch-track" aria-hidden="true" />
                      <span>{o.label[lang] ?? o.label.ar ?? o.tag}</span>
                    </label>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      {!isDesktop() && (
        <footer className="piece-foot">
          <Icon name="saved" size={18} />
          <Hint label={t.savedLocally} side="above">
            {t.savedLocally}
          </Hint>
        </footer>
      )}
    </div>
  );
}

/** A style option shown as its own effect: the sample word, drawn with the option on or off. */
function OptionTile(props: {
  engine: Engine;
  styleId: string;
  tag: string;
  sample: string;
  label: string;
  on: boolean;
  onToggle: (on: boolean) => void;
}) {
  const { engine, styleId, tag, sample, on } = props;
  const drawing = useMemo(
    () => drawPhrase(engine, styleId, sample, (ed) => ed.setOption(tag, on), 120),
    [engine, styleId, sample, tag, on],
  );
  const { ref, handlers, tip } = useHoverTip(props.label);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className="option-tile"
        aria-pressed={on}
        aria-label={props.label}
        {...handlers}
        onClick={() => props.onToggle(!on)}
      >
        <svg className="option-sample" viewBox={drawing.box} aria-hidden="true" focusable="false">
          <g transform="scale(1,-1)">
            {drawing.paths.map((p, i) => (
              <path key={i} d={p.d} transform={`matrix(${p.t})`} />
            ))}
          </g>
        </svg>
        <Dot filled={on} className="option-state" />
      </button>
      {tip}
    </>
  );
}
