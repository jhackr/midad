// Typed façade over the WebAssembly engine.
//
// The wasm module is synchronous once initialised: every call returns
// immediately (composition takes well under a millisecond), so React can
// simply re-read the scene after each edit.

import init, { MidadEditor, MidadEngine } from './pkg/midad_wasm.js';
import type {
  Align,
  AlternateChoice,
  GlyphKey,
  GlyphOutline,
  MidadDocument,
  Scene,
  StyleSummary,
  SvgExportOptions,
} from './types';

interface StyleIndex {
  styles: Array<{ id: string; manifest: string; font: string }>;
}

// One wasm instance per page. wasm-bindgen's `init()` is not re-entrant: two
// overlapping calls (React StrictMode runs effects twice in development) each
// instantiate the module, and objects made on the first instance are then
// called on the second, corrupting memory.
let ready: Promise<unknown> | undefined;

/** Loaded engine + styles + a per-style outline cache. */
export class Engine {
  private outlines = new Map<string, Map<number, GlyphOutline>>();

  private constructor(
    private readonly inner: MidadEngine,
    readonly styles: StyleSummary[],
    readonly fontUrls: Record<string, string>,
  ) {}

  /** Initialise wasm and load every style listed in `styles/index.json`. */
  static async load(base: string = import.meta.env.BASE_URL): Promise<Engine> {
    await (ready ??= init());
    const inner = new MidadEngine();
    const index: StyleIndex = await fetchJson(`${base}styles/index.json`);
    const styles: StyleSummary[] = [];
    const fontUrls: Record<string, string> = {};
    for (const entry of index.styles) {
      const [manifest, font] = await Promise.all([
        fetchText(`${base}styles/${entry.manifest}`),
        fetchBytes(`${base}styles/${entry.font}`),
      ]);
      styles.push(inner.loadStyle(manifest, font) as StyleSummary);
      fontUrls[entry.id] = `${base}styles/${entry.font}`;
    }
    if (styles.length === 0) throw new Error('no style could be loaded');
    return new Engine(inner, styles, fontUrls);
  }

  style(id: string): StyleSummary {
    const found = this.styles.find((s) => s.id === id);
    if (!found) throw new Error(`style '${id}' is not loaded`);
    return found;
  }

  createEditor(styleId: string, text: string): EditorHandle {
    return new EditorHandle(this, this.inner.createEditor(styleId, text));
  }

  openDocument(json: string): EditorHandle {
    return new EditorHandle(this, this.inner.openDocument(json));
  }

  /** Outline of a glyph, fetched from wasm once and cached. */
  outline(styleId: string, gid: number): GlyphOutline | undefined {
    return this.outlines.get(styleId)?.get(gid);
  }

  /** Make sure every gid has a cached outline (one wasm call for the missing ones). */
  ensureOutlines(styleId: string, gids: Iterable<number>) {
    let cache = this.outlines.get(styleId);
    if (!cache) {
      cache = new Map();
      this.outlines.set(styleId, cache);
    }
    const missing = [...new Set(gids)].filter((g) => !cache.has(g));
    if (missing.length === 0) return;
    const fetched = this.inner.glyphOutlines(styleId, Uint16Array.from(missing)) as GlyphOutline[];
    for (const o of fetched) cache.set(o.gid, o);
  }
}

/** One open document. Methods throw `Error` when the style refuses an edit. */
export class EditorHandle {
  constructor(
    private readonly engine: Engine,
    private readonly inner: MidadEditor,
  ) {}

  get styleId(): string {
    return this.inner.styleId();
  }

  scene(): Scene {
    const scene = this.inner.scene() as Scene;
    this.engine.ensureOutlines(this.styleId, scene.glyphs.map((g) => g.gid));
    return scene;
  }

  document(): MidadDocument {
    return this.inner.document() as MidadDocument;
  }

  toJson(): string {
    return this.inner.toJson();
  }

  alternates(key: GlyphKey): AlternateChoice[] {
    const list = this.inner.alternates(key.cluster, key.index) as AlternateChoice[];
    this.engine.ensureOutlines(this.styleId, list.map((a) => a.gid));
    return list;
  }

  setText(text: string) {
    this.inner.setText(text);
  }
  setAlternate(key: GlyphKey, gid: number | undefined) {
    this.inner.setAlternate(key.cluster, key.index, gid);
  }
  cycleAlternate(key: GlyphKey, step: number) {
    this.inner.cycleAlternate(key.cluster, key.index, step);
  }
  setOffset(key: GlyphKey, dx: number, dy: number) {
    this.inner.setOffset(key.cluster, key.index, dx, dy);
  }
  moveBy(key: GlyphKey, ddx: number, ddy: number) {
    this.inner.moveBy(key.cluster, key.index, ddx, ddy);
  }
  setScale(key: GlyphKey, scale: number) {
    this.inner.setScale(key.cluster, key.index, scale);
  }
  setRotation(key: GlyphKey, degrees: number) {
    this.inner.setRotation(key.cluster, key.index, degrees);
  }
  resetGlyph(key: GlyphKey) {
    this.inner.resetGlyph(key.cluster, key.index);
  }
  resetAll() {
    this.inner.resetAll();
  }
  setKashida(after: number, length: number | undefined) {
    this.inner.setKashida(after, length);
  }
  setOption(tag: string, enabled: boolean) {
    this.inner.setOption(tag, enabled);
  }
  setAlign(align: Align) {
    this.inner.setAlign(align);
  }
  setLineSpacing(spacing: number) {
    this.inner.setLineSpacing(spacing);
  }
  beginGesture() {
    this.inner.beginGesture();
  }
  endGesture() {
    this.inner.endGesture();
  }
  undo(): boolean {
    return this.inner.undo();
  }
  redo(): boolean {
    return this.inner.redo();
  }
  canUndo(): boolean {
    return this.inner.canUndo();
  }
  canRedo(): boolean {
    return this.inner.canRedo();
  }
  exportSvg(options: SvgExportOptions = {}): string {
    return this.inner.exportSvg(options);
  }
  free() {
    this.inner.free();
  }
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res;
}
const fetchJson = async <T>(url: string): Promise<T> => (await fetchOk(url)).json() as Promise<T>;
const fetchText = async (url: string) => (await fetchOk(url)).text();
const fetchBytes = async (url: string) => new Uint8Array(await (await fetchOk(url)).arrayBuffer());
