import { useRef } from 'react';

import type { Engine } from '../engine/engine';
import type { StyleSummary } from '../engine/types';
import type { Lang, Strings } from '../i18n';
import { Logo } from './Logo';

interface Props {
  t: Strings;
  lang: Lang;
  engine: Engine;
  style: StyleSummary;
  canUndo: boolean;
  canRedo: boolean;
  showGuides: boolean;
  zoomPercent: number;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (factor: number) => void;
  onFit: () => void;
  onGuides: (v: boolean) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onLang: () => void;
}

export function TopBar(p: Props) {
  const menu = useRef<HTMLDetailsElement>(null);
  const run = (fn: () => void) => () => {
    if (menu.current) menu.current.open = false;
    fn();
  };

  return (
    <header className="topbar">
      <div className="brand">
        <Logo engine={p.engine} styleId={p.style.id} label={p.t.appName} />
        <span className="tagline">{p.t.tagline}</span>
      </div>

      <div className="toolbar" role="toolbar" aria-label={p.t.appName}>
        <details className="menu" ref={menu}>
          <summary className="tool">{p.t.file}</summary>
          <div className="menu-list" role="menu">
            <button role="menuitem" onClick={run(p.onNew)}>{p.t.newDoc}</button>
            <button role="menuitem" onClick={run(p.onOpen)}>{p.t.openDoc}</button>
            <button role="menuitem" onClick={run(p.onSave)}>{p.t.saveDoc}</button>
            <hr />
            <button role="menuitem" onClick={run(p.onExportSvg)}>{p.t.exportSvg}</button>
            <button role="menuitem" onClick={run(p.onExportPng)}>{p.t.exportPng}</button>
          </div>
        </details>

        <span className="tool-group">
          <button className="tool" onClick={p.onUndo} disabled={!p.canUndo} title="Ctrl+Z">
            {p.t.undo}
          </button>
          <button className="tool" onClick={p.onRedo} disabled={!p.canRedo} title="Ctrl+Shift+Z">
            {p.t.redo}
          </button>
        </span>

        <span className="tool-group">
          <button className="tool icon" onClick={() => p.onZoom(1 / 1.25)} aria-label={p.t.zoomOut} title={p.t.zoomOut}>
            −
          </button>
          <button className="tool zoom-readout" onClick={p.onFit} title={p.t.fit}>
            <span dir="ltr">{p.zoomPercent}%</span>
          </button>
          <button className="tool icon" onClick={() => p.onZoom(1.25)} aria-label={p.t.zoomIn} title={p.t.zoomIn}>
            +
          </button>
        </span>

        <label className="tool toggle" title={p.t.guidesHint}>
          <input type="checkbox" checked={p.showGuides} onChange={(e) => p.onGuides(e.target.checked)} />
          <span>{p.t.guides}</span>
        </label>

        <span className="style-name" title={p.t.style}>
          {p.style.name[p.lang] ?? p.style.name.ar}
        </span>

        <button className="tool lang" onClick={p.onLang} lang={p.lang === 'ar' ? 'en' : 'ar'}>
          {p.t.switchLang}
        </button>
      </div>
    </header>
  );
}
