// The madder band: wordmark, file, undo/redo at the start; warnings,
// shortcuts, language and the one worded action, Export, at the end.

import type { Engine } from '../engine/engine';
import type { StyleSummary } from '../engine/types';
import type { Lang, Strings } from '../i18n';
import { shortcutList } from '../i18n';
import { Hint, IconButton, Menu, MenuItem } from './Floating';
import { Icon } from './Icon';
import { Logo } from './Logo';

interface Props {
  t: Strings;
  lang: Lang;
  engine: Engine;
  style: StyleSummary;
  compact: boolean;
  canUndo: boolean;
  canRedo: boolean;
  warnings: string[];
  onUndo: () => void;
  onRedo: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onLang: () => void;
}

export function TopBar(p: Props) {
  const { t } = p;
  return (
    <header className="bar">
      <div className="bar-group">
        <Logo engine={p.engine} styleId={p.style.id} label={t.appName} />
        <Menu
          label={t.file}
          trigger={(props) => (
            <button type="button" className="btn btn-icon" aria-label={t.file} {...props}>
              <Icon name="file" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon="new" label={t.newDoc} onSelect={() => (close(), p.onNew())} />
              <MenuItem icon="open" label={t.openDoc} onSelect={() => (close(), p.onOpen())} />
              <MenuItem icon="save" label={t.saveDoc} keys="Ctrl+S" onSelect={() => (close(), p.onSave())} />
            </>
          )}
        </Menu>
        <span className="bar-rule" aria-hidden="true" />
        <IconButton icon="undo" label={t.undo} keys="Ctrl+Z" disabled={!p.canUndo} onClick={p.onUndo} />
        <IconButton icon="redo" label={t.redo} keys="Ctrl+Shift+Z" disabled={!p.canRedo} onClick={p.onRedo} />
      </div>

      <div className="bar-group">
        {p.warnings.length > 0 && (
          <Hint label={t.warnings} tone="warn">
            {p.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </Hint>
        )}
        {!p.compact && (
          <Menu
            label={t.shortcuts}
            align="end"
            role="dialog"
            trigger={(props) => (
              <button type="button" className="btn btn-icon" aria-label={t.shortcuts} {...props}>
                <Icon name="keyboard" />
              </button>
            )}
          >
            {() => (
              <dl className="shortcuts">
                {shortcutList[p.lang].map(([keys, action]) => (
                  <div key={keys}>
                    <dt>{action}</dt>
                    <dd>
                      <kbd dir="ltr">{keys}</kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Menu>
        )}
        <button
          type="button"
          className="btn btn-icon btn-lang"
          onClick={p.onLang}
          aria-label={t.switchLang}
          lang={p.lang === 'ar' ? 'en' : 'ar'}
        >
          {t.langShort}
        </button>
        <Menu
          label={t.exportDoc}
          align="end"
          trigger={(props) => (
            <button type="button" className="btn btn-primary" {...props}>
              <Icon name="export" />
              <span>{t.exportDoc}</span>
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon="vector" label={t.exportSvg} note={t.exportSvgNote} onSelect={() => (close(), p.onExportSvg())} />
              <MenuItem icon="image" label={t.exportPng} note={t.exportPngNote} onSelect={() => (close(), p.onExportPng())} />
            </>
          )}
        </Menu>
      </div>
    </header>
  );
}
