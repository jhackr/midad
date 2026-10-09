import { useCallback, useEffect, useRef, useState } from 'react';

import { Composer } from './components/Composer';
import { Hint, IconButton } from './components/Floating';
import { Dot } from './components/Icon';
import type { Tool } from './components/Inspector';
import { LetterTools, PieceTools } from './components/Inspector';
import { Sheet } from './components/Sheet';
import { TopBar } from './components/TopBar';
import { Engine } from './engine/engine';
import type { GlyphKey } from './engine/types';
import { sameKey } from './engine/types';
import { letterOrder, resetLetter, useMidad } from './engine/useMidad';
import type { Lang } from './i18n';
import { dictionaries, engineError, warningText } from './i18n';
import { fileStem, storage, svgToPng } from './lib/files';
import { openTextFile, saveFile } from './lib/platform';
import { useMedia } from './lib/useMedia';
import type { Frame } from './lib/viewport';
import { fitFrame, zoomFrame } from './lib/viewport';

/** Phones get the bottom-sheet layout; everything wider gets the side column. */
const PHONE_QUERY = '(max-width: 760px)';
const NOTICE_MS = 4500;

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
        <Dot className="splash-mark" />
        <h1>{t.loadFailed}</h1>
        <p>{t.loadFailedHint}</p>
        <pre dir="ltr">{failure}</pre>
      </main>
    );
  }
  if (!engine) {
    return (
      <main className="splash" aria-busy="true" aria-label={t.loading}>
        <div className="loading-row" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span key={i} style={{ animationDelay: `${i * 110}ms` }} />
          ))}
        </div>
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
  const isPhone = useMedia(PHONE_QUERY);
  const [tool, setTool] = useState<Tool>('shapes');
  const [pieceOpen, setPieceOpen] = useState(false);

  // Notices fade on their own; a new one restarts the clock.
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [notice]);

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
      if (e.code === 'Escape' && pieceOpen) return setPieceOpen(false);
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
        midad.act((ed) => resetLetter(ed, scene, key));
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
  const warnings = [...new Set(scene.warnings.map((w) => warningText[lang][w.kind]))];
  const warningKey = warnings.join('|');

  // A new engine warning is announced once; it then stays behind the "!" in the bar.
  const lastWarnings = useRef('');
  useEffect(() => {
    if (warningKey && warningKey !== lastWarnings.current) setNotice(warningKey.split('|')[0]);
    lastWarnings.current = warningKey;
  }, [warningKey]);

  const select = (k: GlyphKey | null) => {
    midad.select(k);
    if (k) setPieceOpen(false);
    setNotice(null);
  };

  const common = { t, lang, engine, style, midad, naskhFamily: NASKH_FAMILY, report };
  const letterTools = (
    <LetterTools {...common} compact={isPhone} tool={tool} onTool={setTool} onClose={() => midad.select(null)} />
  );

  return (
    <div className={isPhone ? 'app is-phone' : 'app'}>
      <TopBar
        t={t}
        lang={lang}
        engine={engine}
        style={style}
        compact={isPhone}
        canUndo={editor.canUndo()}
        canRedo={editor.canRedo()}
        warnings={warnings}
        onUndo={() => midad.act((ed) => ed.undo())}
        onRedo={() => midad.act((ed) => ed.redo())}
        onNew={actions.create}
        onOpen={actions.open}
        onSave={actions.save}
        onExportSvg={actions.exportSvg}
        onExportPng={actions.exportPng}
        onLang={onLang}
      />

      <div className="workspace">
        {!isPhone && (
          <aside className="inspector" aria-label={midad.selection ? t.letter : t.piece}>
            {midad.selection ? letterTools : <PieceTools {...common} />}
          </aside>
        )}
        {!isPhone && <div className="seam" aria-hidden="true" />}

        <main className="stage">
          <div className="sheet-frame">
            <Sheet
              engine={engine}
              styleId={style.id}
              scene={scene}
              frame={frame}
              onFrame={setFrame}
              selection={midad.selection}
              onSelect={select}
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

            <div className="sheet-tools">
              <Hint label={`${t.moreInfo}: ${t.letter}`} side="above">
                {t.sheetHelp}
              </Hint>
              <IconButton
                icon="ladder"
                label={`${t.guides}: ${t.guidesHint}`}
                side="above"
                aria-pressed={showGuides}
                className="is-toggle"
                onClick={() => setShowGuides((g) => !g)}
              />
              <span className="tools-rule" aria-hidden="true" />
              <span className="sheet-zoom" dir="ltr">
                {!isPhone && (
                  <IconButton icon="minus" label={t.zoomOut} keys="−" side="above" onClick={() => setFrame((f) => zoomFrame(f, 0.8))} />
                )}
                <button type="button" className="btn zoom-readout" onClick={fit} aria-label={`${t.fit} (${zoomPercent}%)`}>
                  <span dir="ltr">{zoomPercent}%</span>
                </button>
                {!isPhone && (
                  <IconButton icon="plus" label={t.zoomIn} keys="+" side="above" onClick={() => setFrame((f) => zoomFrame(f, 1.25))} />
                )}
              </span>
            </div>

            {notice && (
              <button type="button" className="toast" role="status" onClick={() => setNotice(null)} aria-label={`${notice} (${t.dismiss})`}>
                <Dot />
                <span>{notice}</span>
              </button>
            )}
          </div>

          {!(isPhone && (midad.selection || pieceOpen)) && (
            <Composer
              value={doc.text}
              placeholder={t.textPlaceholder}
              label={t.text}
              fontFamily={NASKH_FAMILY}
              onChange={(text) => midad.act((ed) => ed.setText(text))}
            >
              {isPhone && (
                <IconButton icon="sliders" label={t.pieceSettings} side="above" onClick={() => setPieceOpen(true)} />
              )}
            </Composer>
          )}
        </main>
      </div>

      {isPhone && midad.selection && <div className="dock">{letterTools}</div>}
      {isPhone && !midad.selection && pieceOpen && (
        <div className="dock">
          <PieceTools {...common} onClose={() => setPieceOpen(false)} />
        </div>
      )}
    </div>
  );
}
