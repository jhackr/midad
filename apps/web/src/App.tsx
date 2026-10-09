import { useCallback, useEffect, useMemo, useState } from 'react';

import { Panel } from './components/Panel';
import { Sheet } from './components/Sheet';
import { TopBar } from './components/TopBar';
import { Engine } from './engine/engine';
import type { GlyphKey } from './engine/types';
import { sameKey } from './engine/types';
import { letterOrder, useMidad } from './engine/useMidad';
import type { Lang } from './i18n';
import { dictionaries, engineError, warningText } from './i18n';
import { fileStem, storage, svgToPng } from './lib/files';
import { openTextFile, saveFile } from './lib/platform';
import type { Frame } from './lib/viewport';
import { fitFrame, zoomFrame } from './lib/viewport';

const NASKH_FAMILY = "'Midad Naskh', 'Readex Pro Variable', serif";

export function App() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(() => (storage.loadLang() === 'en' ? 'en' : 'ar'));
  const t = dictionaries[lang];

  useEffect(() => {
    let cancelled = false;
    Engine.load()
      .then(async (e) => {
        // The style's own font, so the text box previews the chosen style.
        const url = e.fontUrls[e.styles[0].id];
        try {
          const face = new FontFace('Midad Naskh', `url(${url})`);
          document.fonts.add(await face.load());
        } catch {
          /* preview font is optional */
        }
        if (!cancelled) setEngine(e);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFailure(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = `${t.appName} — ${t.tagline}`;
    storage.saveLang(lang);
  }, [lang, t]);

  const toggleLang = () => setLang((l) => (l === 'ar' ? 'en' : 'ar'));

  if (failure) {
    return (
      <main className="splash" role="alert">
        <h1>{t.loadFailed}</h1>
        <p>{t.loadFailedHint}</p>
        <pre dir="ltr">{failure}</pre>
      </main>
    );
  }
  if (!engine) {
    return (
      <main className="splash" aria-busy="true">
        <div className="loading-ladder" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{ animationDelay: `${i * 140}ms` }} />
          ))}
        </div>
        <p>{t.loading}</p>
      </main>
    );
  }
  return <Workspace engine={engine} lang={lang} onLang={toggleLang} />;
}

function isFormField(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

function Workspace({ engine, lang, onLang }: { engine: Engine; lang: Lang; onLang: () => void }) {
  const t = dictionaries[lang];
  const midad = useMidad(engine);
  const { scene, doc, editor } = midad;
  const style = engine.style(editor.styleId);
  const [frame, setFrame] = useState<Frame>(() => fitFrame(scene));
  const [fitWidth, setFitWidth] = useState(() => {
    const f = fitFrame(scene);
    return f.x1 - f.x0;
  });
  const [showGuides, setShowGuides] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const fit = useCallback(() => {
    const f = fitFrame(midad.scene);
    setFrame(f);
    setFitWidth(f.x1 - f.x0);
  }, [midad.scene]);

  // Re-frame when the text or the layout changes (typing, alignment, new piece).
  const layoutKey = `${editor.styleId}|${doc.text}|${doc.layout.align}|${doc.layout.line_spacing}`;
  useEffect(fit, [layoutKey, editor]);

  // Grow the frame when an edit pushes ink outside it (never shrink on its own).
  useEffect(() => {
    const b = scene.bounds;
    setFrame((f) =>
      b.x0 >= f.x0 && b.x1 <= f.x1 && b.y0 >= f.y0 && b.y1 <= f.y1
        ? f
        : { x0: Math.min(f.x0, b.x0 - 200), y0: Math.min(f.y0, b.y0 - 200), x1: Math.max(f.x1, b.x1 + 200), y1: Math.max(f.y1, b.y1 + 200) },
    );
  }, [scene]);

  const report = useCallback((error: string | null) => setNotice(error ? engineError(lang, error) : null), [lang]);

  const offsetOf = useCallback(
    (key: GlyphKey): [number, number] => {
      const o = doc.glyphs.find((g) => g.cluster === key.cluster && g.index === key.index);
      return [o?.dx ?? 0, o?.dy ?? 0];
    },
    [doc],
  );

  // ----------------------------------------------------------- file actions
  const stem = fileStem(doc.text);
  const filters = {
    midad: { name: 'Midad', extensions: ['midad'] },
    svg: { name: 'SVG', extensions: ['svg'] },
    png: { name: 'PNG', extensions: ['png'] },
  };
  const guard = (task: () => Promise<unknown>) => () => {
    task().catch((e: unknown) => report(e instanceof Error ? e.message : String(e)));
  };
  const actions = {
    save: guard(() => saveFile(`${stem}.midad`, editor.toJson(), filters.midad)),
    exportSvg: guard(() =>
      saveFile(`${stem}.svg`, editor.exportSvg({ title: doc.text, padding: style.nuqta }), filters.svg),
    ),
    exportPng: guard(async () =>
      saveFile(`${stem}.png`, await svgToPng(editor.exportSvg({ height: 1200, padding: style.nuqta })), filters.png),
    ),
    open: guard(async () => {
      const json = await openTextFile(filters.midad);
      if (!json) return;
      try {
        midad.replace(engine.openDocument(json));
        report(null);
      } catch {
        setNotice(t.openFailed);
      }
    }),
    create: () => midad.replace(engine.createEditor(style.id, '')),
  };

  // --------------------------------------------------------------- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      // e.code is layout-independent: shortcuts work with an Arabic keyboard too.
      if (mod && e.code === 'KeyS') {
        e.preventDefault();
        actions.save();
        return;
      }
      if (isFormField(e.target)) return;
      if (mod && (e.code === 'KeyZ' || e.code === 'KeyY')) {
        e.preventDefault();
        midad.act((ed) => (e.shiftKey || e.code === 'KeyY' ? ed.redo() : ed.undo()));
        return;
      }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') return setFrame((f) => zoomFrame(f, 1.25));
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') return setFrame((f) => zoomFrame(f, 0.8));
      if (e.code === 'Digit0') return fit();

      const key = midad.selection;
      if (!key) return;
      if (e.code === 'Escape') return midad.select(null);
      if (e.code === 'Tab') {
        e.preventDefault();
        const order = letterOrder(scene);
        const i = order.findIndex((k) => sameKey(k, key));
        const next = order[(i + (e.shiftKey ? -1 : 1) + order.length) % order.length];
        if (next) midad.select(next);
        return;
      }
      if (e.code === 'BracketRight' || e.code === 'BracketLeft') {
        e.preventDefault();
        report(midad.act((ed) => ed.cycleAlternate(key, e.code === 'BracketRight' ? 1 : -1)));
        return;
      }
      if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        midad.act((ed) => ed.resetGlyph(key));
        return;
      }
      const step = e.shiftKey ? style.nuqta : 10;
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      const move = arrows[e.code];
      if (move) {
        e.preventDefault();
        midad.act((ed) => ed.moveBy(key, move[0], move[1]));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const zoomPercent = Math.round((fitWidth / (frame.x1 - frame.x0)) * 100);
  const letters = useMemo(() => letterOrder(scene).length, [scene]);
  const warnings = scene.warnings.map((w) => warningText[lang][w.kind]);
  const statusMessage = notice ?? warnings[0] ?? null;

  return (
    <div className="app">
      <TopBar
        t={t}
        lang={lang}
        engine={engine}
        style={style}
        canUndo={editor.canUndo()}
        canRedo={editor.canRedo()}
        showGuides={showGuides}
        zoomPercent={zoomPercent}
        onUndo={() => midad.act((ed) => ed.undo())}
        onRedo={() => midad.act((ed) => ed.redo())}
        onZoom={(factor) => setFrame((f) => zoomFrame(f, factor))}
        onFit={fit}
        onGuides={setShowGuides}
        onNew={actions.create}
        onOpen={actions.open}
        onSave={actions.save}
        onExportSvg={actions.exportSvg}
        onExportPng={actions.exportPng}
        onLang={onLang}
      />

      <div className="workspace">
        <Panel t={t} lang={lang} engine={engine} style={style} midad={midad} naskhFamily={NASKH_FAMILY} report={report} />

        <main className="stage" aria-label={doc.text}>
          <Sheet
            engine={engine}
            styleId={style.id}
            scene={scene}
            frame={frame}
            onFrame={setFrame}
            selection={midad.selection}
            onSelect={(k) => {
              midad.select(k);
              setNotice(null);
            }}
            offsetOf={offsetOf}
            onMove={(key, dx, dy) => midad.act((ed) => ed.setOffset(key, dx, dy))}
            onKashida={(after, length) => report(midad.act((ed) => ed.setKashida(after, length)))}
            onGestureStart={() => editor.beginGesture()}
            onGestureEnd={() => editor.endGesture()}
            showGuides={showGuides}
            nuqta={style.nuqta}
            alefDots={style.alef_dots}
            dotsLabel={t.dots}
          />
        </main>
      </div>

      <footer className="statusbar">
        <p className={statusMessage ? 'status-message is-warning' : 'status-message'} role="status">
          {statusMessage ?? (
            <>
              <span>{t.hintSelect}</span>
              <span>{t.hintDrag}</span>
              <span>{t.hintKashida}</span>
            </>
          )}
        </p>
        <p className="status-meta">
          <span>
            {t.lettersLabel} <b>{letters}</b>
          </span>
          <span>
            {t.linesLabel} <b>{scene.lines.length}</b>
          </span>
        </p>
      </footer>
    </div>
  );
}
