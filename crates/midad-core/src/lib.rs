//! # midad-core
//!
//! The composition engine of **Midad (مداد)**, an open-source editor for
//! Arabic calligraphy.
//!
//! ```text
//!  style.toml + font ──► Style ─┐
//!                               ├─► compose() ──► Scene ──► renderer / SVG
//!  Document (text + overrides) ─┘
//! ```
//!
//! * [`Style`] — a loaded style package (manifest + compiled font).
//! * [`Document`] — the text and the calligrapher's manual decisions
//!   (alternate shapes, offsets, kashida). Serialized as `.midad` JSON.
//! * [`compose`] — runs the shaper (HarfRust) and produces a [`Scene`] of
//!   positioned glyphs.
//! * [`Editor`] — document + undo history + validation; what UIs talk to.
//!
//! ```no_run
//! use std::sync::Arc;
//! use midad_core::{Editor, GlyphKey, Style, SvgOptions};
//!
//! let manifest = std::fs::read_to_string("styles/naskh-amiri/style.toml")?;
//! let font = std::fs::read("styles/naskh-amiri/dist/MidadNaskh-Regular.ttf")?;
//! let style = Arc::new(Style::load(&manifest, font)?);
//!
//! let mut editor = Editor::new(style, "بسم الله الرحمن الرحيم");
//! editor.cycle_alternate(GlyphKey::new(2, 0), 1)?; // next shape of the meem
//! editor.set_kashida(0, Some(600.0))?;               // stretch باء → سين
//! let svg = editor.export_svg(&SvgOptions::default())?;
//! # Ok::<(), Box<dyn std::error::Error>>(())
//! ```

pub mod compose;
pub mod document;
pub mod editor;
pub mod error;
pub mod font;
pub mod geometry;
pub mod history;
pub mod kashida;
pub mod manifest;
pub mod scene;
mod shape;
pub mod style;
pub mod svg;
pub mod text;

pub use compose::{Composition, compose};
pub use document::{Align, Document, FORMAT_VERSION, GlyphKey, GlyphOverride, Layout, StyleRef};
pub use editor::Editor;
pub use error::{Error, Result};
pub use font::{FontData, GlyphOutline};
pub use geometry::{Affine, Rect};
pub use manifest::Manifest;
pub use scene::{AlternateChoice, KashidaSlot, LineInfo, PlacedGlyph, Scene, Warning, WarningKind};
pub use style::{Style, StyleSummary};
pub use svg::{SvgOptions, scene_to_svg};
