// TypeScript mirror of the data the engine returns.
//
// Source of truth: crates/midad-core/src/{scene,document,style}.rs.
// The engine serialises with serde (snake_case field names). Update this
// file whenever those Rust structs change.

/** Font units, y pointing up. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** SVG matrix order: [a, b, c, d, e, f]. */
export type Affine = [number, number, number, number, number, number];

export interface GlyphKey {
  /** Char index of the first character of the cluster. */
  cluster: number;
  /** Glyph position inside the cluster, logical order (0 = base). */
  index: number;
}

export interface PlacedGlyph {
  gid: number;
  /** null for elongation (tatweel) glyphs. */
  key: GlyphKey | null;
  /** Char index the elongation follows, for tatweel glyphs. */
  kashida: number | null;
  span: [number, number];
  line: number;
  is_mark: boolean;
  transform: Affine;
  origin: [number, number];
  advance: number;
  bounds: Rect | null;
  alternates: number;
  modified: boolean;
}

export interface LineInfo {
  baseline: number;
  width: number;
  start: number;
  end: number;
}

export interface KashidaSlot {
  after: number;
  x: number;
  y: number;
  length: number;
  natural: number;
  max: number;
}

export type WarningKind =
  | 'stale_alternate'
  | 'kashida_not_allowed'
  | 'kashida_limit'
  | 'conflicting_alternates';

export interface EngineWarning {
  kind: WarningKind;
  at: number;
  message: string;
}

export interface Scene {
  units_per_em: number;
  ascender: number;
  descender: number;
  glyphs: PlacedGlyph[];
  bounds: Rect;
  lines: LineInfo[];
  kashida_slots: KashidaSlot[];
  warnings: EngineWarning[];
}

export interface AlternateChoice {
  gid: number;
  is_default: boolean;
  is_current: boolean;
}

export interface GlyphOverride {
  alternate?: number;
  dx?: number;
  dy?: number;
  scale?: number;
  rotate?: number;
}

export type Align = 'right' | 'center' | 'left';

export interface MidadDocument {
  format: number;
  style: { id: string; version: string };
  text: string;
  options: string[];
  glyphs: Array<GlyphKey & GlyphOverride>;
  kashidas: Record<string, number>;
  layout: { align: Align; line_spacing: number };
}

export type Localized = Record<string, string>;

export interface StyleSummary {
  id: string;
  version: string;
  name: Localized;
  description: Localized;
  license: string;
  credits: string;
  upstream: string | null;
  units_per_em: number;
  ascender: number;
  descender: number;
  glyphs_with_alternates: number;
  nuqta: number;
  alef_dots: number;
  options: Array<{ tag: string; label: Localized; default: boolean }>;
  kashida: { enabled: boolean; max_length: number; max_per_word: number };
}

export interface GlyphOutline {
  gid: number;
  /** SVG path data, font units, y up. */
  path: string;
  bounds: Rect | null;
}

export interface SvgExportOptions {
  padding?: number;
  fill?: string;
  background?: string | null;
  height?: number | null;
  title?: string | null;
}

export const keyId = (k: GlyphKey) => `${k.cluster}:${k.index}`;
export const sameKey = (a: GlyphKey | null | undefined, b: GlyphKey | null | undefined) =>
  !!a && !!b && a.cluster === b.cluster && a.index === b.index;
