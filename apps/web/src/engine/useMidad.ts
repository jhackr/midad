// React binding: the wasm editor is the single source of truth; React keeps
// a revision counter and re-reads the scene after every edit.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { storage } from '../lib/files';
import type { Engine, EditorHandle } from './engine';
import type { GlyphKey, MidadDocument, PlacedGlyph, Scene } from './types';
import { sameKey } from './types';

export const SAMPLE_TEXT = 'بسم الله الرحمن الرحيم';

function restore(engine: Engine): EditorHandle {
  const saved = storage.loadDocument();
  if (saved) {
    try {
      return engine.openDocument(saved);
    } catch {
      /* stale or foreign document: start fresh */
    }
  }
  return engine.createEditor(engine.styles[0].id, SAMPLE_TEXT);
}

export interface Midad {
  editor: EditorHandle;
  scene: Scene;
  doc: MidadDocument;
  revision: number;
  selection: GlyphKey | null;
  selectedGlyph: PlacedGlyph | null;
  select: (key: GlyphKey | null) => void;
  /** Run an edit; returns the error message if the engine refused it. */
  act: (edit: (e: EditorHandle) => void) => string | null;
  replace: (editor: EditorHandle) => void;
}

export function useMidad(engine: Engine): Midad {
  const [editor, setEditor] = useState<EditorHandle>(() => restore(engine));
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<GlyphKey | null>(null);
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const scene = useMemo(() => editor.scene(), [editor, revision]);
  const doc = useMemo(() => editor.document(), [editor, revision]);

  const selectedGlyph = useMemo(
    () => (selection ? scene.glyphs.find((g) => sameKey(g.key, selection)) ?? null : null),
    [scene, selection],
  );

  // Drop a selection that no longer exists (e.g. after deleting text).
  useEffect(() => {
    if (selection && !selectedGlyph) setSelection(null);
  }, [selection, selectedGlyph]);

  // Autosave, debounced.
  useEffect(() => {
    const id = window.setTimeout(() => storage.saveDocument(editor.toJson()), 400);
    return () => window.clearTimeout(id);
  }, [editor, revision]);

  const act = useCallback((edit: (e: EditorHandle) => void) => {
    let error: string | null = null;
    try {
      edit(editorRef.current);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    setRevision((r) => r + 1);
    return error;
  }, []);

  const replace = useCallback((next: EditorHandle) => {
    editorRef.current.free();
    setEditor(next);
    setSelection(null);
    setRevision((r) => r + 1);
  }, []);

  return { editor, scene, doc, revision, selection, selectedGlyph, select: setSelection, act, replace };
}

/** Selectable glyphs (letters, not marks or elongations) in logical order. */
export function letterOrder(scene: Scene): GlyphKey[] {
  return scene.glyphs
    .filter((g) => g.key && !g.is_mark && g.bounds)
    .map((g) => g.key as GlyphKey)
    .sort((a, b) => a.cluster - b.cluster || a.index - b.index);
}
