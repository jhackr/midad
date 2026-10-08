//! The output of composition: positioned glyphs, ready to draw.
//!
//! Coordinates are font units with y pointing **up** (the font's own
//! coordinate system); a renderer flips y once, at the top level. The text
//! block is anchored at its right edge: x = 0 is where the first line
//! starts, and the composition extends towards negative x. The first
//! baseline is y = 0, following lines go down (negative y).
//! Outlines are not embedded: fetch them by glyph id with
//! [`crate::FontData::outline`] (renderers cache them).

use serde::Serialize;

use crate::document::GlyphKey;
use crate::geometry::{Affine, Rect};

#[derive(Clone, Debug, Serialize)]
pub struct Scene {
    pub units_per_em: u16,
    pub ascender: f32,
    pub descender: f32,
    pub glyphs: Vec<PlacedGlyph>,
    /// Union of all glyph bounds (or the empty line box for empty text).
    pub bounds: Rect,
    pub lines: Vec<LineInfo>,
    /// Every position where the user may add / drag a kashida.
    pub kashida_slots: Vec<KashidaSlot>,
    pub warnings: Vec<Warning>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PlacedGlyph {
    pub gid: u16,
    /// Address used by overrides. `None` for elongation (tatweel) glyphs.
    pub key: Option<GlyphKey>,
    /// `Some(i)` when this glyph is the elongation inserted after char `i`.
    pub kashida: Option<u32>,
    /// Source characters `[start, end)` this glyph's cluster covers.
    pub span: [u32; 2],
    pub line: u32,
    pub is_mark: bool,
    /// Full transform from glyph space to scene space.
    pub transform: Affine,
    /// Pen position chosen by the shaper, before manual changes.
    pub origin: [f32; 2],
    pub advance: f32,
    /// Scene-space bounds (None for blank glyphs such as spaces).
    pub bounds: Option<Rect>,
    /// How many alternates the user can choose from (0 = none).
    pub alternates: u16,
    /// True when the user changed this glyph (alternate, offset, scale…).
    pub modified: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct LineInfo {
    pub baseline: f32,
    pub width: f32,
    /// Char range `[start, end)` of the line in the document text.
    pub start: u32,
    pub end: u32,
}

#[derive(Clone, Debug, Serialize)]
pub struct KashidaSlot {
    /// The elongation goes between char `after` and char `after + 1`.
    pub after: u32,
    /// Junction point on the baseline (left end of the current elongation).
    pub x: f32,
    pub y: f32,
    /// Current length in font units (0 = no kashida yet).
    pub length: f32,
    /// Width of one plain tatweel, the natural minimum.
    pub natural: f32,
    pub max: f32,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WarningKind {
    /// A chosen alternate no longer fits the glyph at that position (text changed).
    StaleAlternate,
    /// A kashida sits where the shaper or the style rules no longer allow it.
    KashidaNotAllowed,
    /// More kashidas in one word than the style allows.
    KashidaLimit,
    /// Two alternates were chosen inside one ligature; only the first applies.
    ConflictingAlternates,
}

#[derive(Clone, Debug, Serialize)]
pub struct Warning {
    pub kind: WarningKind,
    /// Char index the warning refers to.
    pub at: u32,
    pub message: String,
}

/// One entry of the alternates picker.
#[derive(Clone, Debug, Serialize)]
pub struct AlternateChoice {
    pub gid: u16,
    /// The shape the shaper picks on its own.
    pub is_default: bool,
    /// The shape currently shown.
    pub is_current: bool,
}
