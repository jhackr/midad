// The side panel: text, the selected letter (shapes, offset, size, slant,
// stretch), style options, layout, shortcuts and credits.

import { useMemo } from 'react';
import type { ReactNode } from 'react';

import type { Engine } from '../engine/engine';
import type { Align, StyleSummary } from '../engine/types';
import type { Midad } from '../engine/useMidad';
import type { Lang, Strings } from '../i18n';
import { shortcutList } from '../i18n';
import { fromDots, toDots } from '../lib/viewport';
import { GlyphThumb } from './GlyphThumb';

interface Props {
  t: Strings;
  lang: Lang;
  engine: Engine;
  style: StyleSummary;
  midad: Midad;
  naskhFamily: string;
  report: (error: string | null) => void;
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="panel-section">
      <header className="panel-heading">
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Panel(props: Props) {
  const { t, midad, style } = props;
  return (
    <aside className="panel" aria-label={t.letter}>
      <Section title={t.text}>
        <textarea
          className="text-input"
          dir="rtl"
          lang="ar"
          rows={3}
          value={midad.doc.text}
          placeholder={t.textPlaceholder}
          spellCheck={false}
          style={{ fontFamily: props.naskhFamily }}
          onChange={(e) => midad.act((ed) => ed.setText(e.target.value))}
        />
      </Section>

      <LetterSection {...props} />

      {style.options.length > 0 && (
        <Section title={t.styleOptions}>
          <ul className="option-list">
            {style.options.map((o) => (
              <li key={o.tag}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={midad.doc.options.includes(o.tag)}
                    onChange={(e) => midad.act((ed) => ed.setOption(o.tag, e.target.checked))}
                  />
                  <span>{o.label[props.lang] ?? o.label.ar ?? o.tag}</span>
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t.layout}>
        <div className="segmented" role="radiogroup" aria-label={t.layout}>
          {(
            [
              ['right', t.alignRight],
              ['center', t.alignCenter],
              ['left', t.alignLeft],
            ] as Array<[Align, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              role="radio"
              aria-checked={midad.doc.layout.align === value}
              className="segment"
              onClick={() => midad.act((ed) => ed.setAlign(value))}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{t.lineSpacing}</span>
          <input
            type="range"
            min={0.6}
            max={2.5}
            step={0.05}
            value={midad.doc.layout.line_spacing}
            onPointerDown={() => midad.editor.beginGesture()}
            onPointerUp={() => midad.editor.endGesture()}
            onChange={(e) => midad.act((ed) => ed.setLineSpacing(Number(e.target.value)))}
          />
          <output>{midad.doc.layout.line_spacing.toFixed(2)}×</output>
        </label>
      </Section>

      <details className="panel-section disclosure">
        <summary>{t.shortcuts}</summary>
        <dl className="shortcuts">
          {shortcutList[props.lang].map(([keys, action]) => (
            <div key={keys}>
              <dt>
                <kbd dir="ltr">{keys}</kbd>
              </dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      </details>

      <details className="panel-section disclosure">
        <summary>{t.about}</summary>
        <p className="about-name">{style.name[props.lang] ?? style.name.ar}</p>
        <p className="muted">{style.description[props.lang] ?? style.description.ar}</p>
        <p className="muted">{style.credits}</p>
        <p className="muted">
          {t.license}: {style.license}
          {style.upstream && (
            <>
              {' '}
              <a href={style.upstream} target="_blank" rel="noreferrer">
                {style.upstream.replace(/^https?:\/\//, '')}
              </a>
            </>
          )}
        </p>
        <p className="muted">{t.savedLocally}</p>
      </details>
    </aside>
  );
}

function LetterSection({ t, engine, style, midad, naskhFamily, report }: Props) {
  const glyph = midad.selectedGlyph;
  const key = midad.selection;

  const alternates = useMemo(
    () => (key ? midad.editor.alternates(key) : []),
    // Re-read after every edit: the current shape may have changed.
    [midad.editor, key, midad.revision],
  );

  if (!glyph || !key) {
    return (
      <Section title={t.letter}>
        <p className="empty-hint">{t.noSelection}</p>
      </Section>
    );
  }

  const override = midad.doc.glyphs.find((g) => g.cluster === key.cluster && g.index === key.index);
  const dx = override?.dx ?? 0;
  const dy = override?.dy ?? 0;
  const scale = override?.scale ?? 1;
  const rotate = override?.rotate ?? 0;
  const chars = Array.from(midad.doc.text).slice(glyph.span[0], glyph.span[1]).join('');
  const slot = midad.scene.kashida_slots.find((s) => s.after === glyph.span[1] - 1);
  const nuqta = style.nuqta;
  const gesture = {
    onPointerDown: () => midad.editor.beginGesture(),
    onPointerUp: () => midad.editor.endGesture(),
  };

  return (
    <Section
      title={t.letter}
      aside={
        glyph.modified && (
          <button className="link-button" onClick={() => midad.act((ed) => ed.resetGlyph(key))}>
            {t.resetLetter}
          </button>
        )
      }
    >
      <div className="letter-head">
        <span className="letter-glyph" style={{ fontFamily: naskhFamily }} lang="ar">
          {chars}
        </span>
        {glyph.modified && <span className="badge">{t.modified}</span>}
      </div>

      <h3 className="subheading">{t.shapes}</h3>
      {alternates.length > 1 ? (
        <div className="shape-grid" role="listbox" aria-label={t.shapes}>
          {alternates.map((a) => (
            <button
              key={a.gid}
              role="option"
              aria-selected={a.is_current}
              className="shape-tile"
              title={a.is_default ? t.original : `#${a.gid}`}
              onClick={() => report(midad.act((ed) => ed.setAlternate(key, a.is_default ? undefined : a.gid)))}
            >
              <GlyphThumb outline={engine.outline(style.id, a.gid)} ascender={style.ascender} descender={style.descender} />
              {a.is_default && <span className="tile-label">{t.original}</span>}
            </button>
          ))}
        </div>
      ) : (
        <p className="empty-hint">{t.noShapes}</p>
      )}

      <h3 className="subheading">{t.kashida}</h3>
      {slot ? (
        <label className="field">
          <span>{t.kashidaAfter}</span>
          <input
            type="range"
            min={0}
            max={toDots(slot.max, nuqta)}
            step={0.1}
            value={toDots(slot.length, nuqta)}
            {...gesture}
            onChange={(e) => {
              const dots = Number(e.target.value);
              report(midad.act((ed) => ed.setKashida(slot.after, dots < 0.3 ? undefined : fromDots(dots, nuqta))));
            }}
          />
          <output>
            {toDots(slot.length, nuqta)} {t.dots}
          </output>
        </label>
      ) : (
        <p className="empty-hint">{t.kashidaUnavailable}</p>
      )}

      <h3 className="subheading">{t.position}</h3>
      <div className="pair">
        <NumberField
          label={t.horizontal}
          unit={t.dots}
          value={toDots(dx, nuqta)}
          onChange={(v) => midad.act((ed) => ed.setOffset(key, fromDots(v, nuqta), dy))}
        />
        <NumberField
          label={t.vertical}
          unit={t.dots}
          value={toDots(dy, nuqta)}
          onChange={(v) => midad.act((ed) => ed.setOffset(key, dx, fromDots(v, nuqta)))}
        />
      </div>

      <label className="field">
        <span>{t.size}</span>
        <input
          type="range"
          min={20}
          max={300}
          step={1}
          value={Math.round(scale * 100)}
          {...gesture}
          onChange={(e) => midad.act((ed) => ed.setScale(key, Number(e.target.value) / 100))}
        />
        <output>{Math.round(scale * 100)}%</output>
      </label>

      <label className="field">
        <span>{t.rotation}</span>
        <input
          type="range"
          min={-45}
          max={45}
          step={0.5}
          value={rotate}
          {...gesture}
          onChange={(e) => midad.act((ed) => ed.setRotation(key, Number(e.target.value)))}
        />
        <output>{rotate}°</output>
      </label>
    </Section>
  );
}

function NumberField(props: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="number-field">
      <span>{props.label}</span>
      <span className="number-input">
        <input
          type="number"
          step={0.1}
          value={props.value}
          dir="ltr"
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) props.onChange(v);
          }}
        />
        <small>{props.unit}</small>
      </span>
    </label>
  );
}
