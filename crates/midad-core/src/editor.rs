//! A document being edited: the API every front-end (web, desktop, CLI) uses.
//!
//! The editor owns the [`Document`] and its [`History`], recomposes lazily,
//! and validates every edit against the style's rules. Front-ends never
//! touch glyph ids or positions directly; they call these methods and draw
//! the resulting [`Scene`].

use std::sync::Arc;

use crate::compose::{Composition, compose};
use crate::document::{Align, Document, GlyphKey};
use crate::error::{Error, Result};
use crate::history::History;
use crate::scene::{AlternateChoice, Scene};
use crate::style::Style;
use crate::svg::{SvgOptions, scene_to_svg};
use crate::text::word_at;

pub const MIN_SCALE: f32 = 0.2;
pub const MAX_SCALE: f32 = 5.0;

pub struct Editor {
    style: Arc<Style>,
    doc: Document,
    history: History,
    composition: Option<Composition>,
}

impl Editor {
    pub fn new(style: Arc<Style>, text: &str) -> Self {
        let doc = style.new_document(&normalize(text));
        Self {
            style,
            doc,
            history: History::default(),
            composition: None,
        }
    }

    /// Open a saved document. The style must be the one it was written for.
    pub fn open(style: Arc<Style>, doc: Document) -> Result<Self> {
        if doc.style.id != style.id() {
            return Err(Error::StyleMismatch {
                expected: doc.style.id.clone(),
                found: style.id().to_string(),
            });
        }
        Ok(Self {
            style,
            doc,
            history: History::default(),
            composition: None,
        })
    }

    pub fn style(&self) -> &Arc<Style> {
        &self.style
    }

    pub fn document(&self) -> &Document {
        &self.doc
    }

    pub fn to_json(&self) -> String {
        self.doc.to_json()
    }

    pub fn composition(&mut self) -> Result<&Composition> {
        if self.composition.is_none() {
            self.composition = Some(compose(&self.style, &self.doc)?);
        }
        Ok(self.composition.as_ref().expect("just composed"))
    }

    pub fn scene(&mut self) -> Result<&Scene> {
        Ok(&self.composition()?.scene)
    }

    /// Apply a change as one undoable step.
    fn edit(&mut self, change: impl FnOnce(&mut Document)) {
        let before = self.doc.clone();
        change(&mut self.doc);
        self.doc.prune();
        if self.doc != before {
            self.history.record(&before);
            self.composition = None;
        }
    }

    // ---------------------------------------------------------------- text

    pub fn set_text(&mut self, text: &str) {
        let text = normalize(text);
        self.edit(|d| d.set_text(&text));
    }

    // -------------------------------------------------------------- glyphs

    /// Show alternate `gid` at `key`; `None` returns to the shaper's choice.
    pub fn set_alternate(&mut self, key: GlyphKey, gid: Option<u16>) -> Result<()> {
        if let Some(gid) = gid {
            let style = self.style.clone();
            let choices = self.composition()?.alternates(&style, key);
            if !choices.iter().any(|c| c.gid == gid) {
                return Err(Error::Rule(format!(
                    "glyph {gid} is not an alternate of the letter at {}",
                    key.cluster
                )));
            }
            let is_default = choices.iter().any(|c| c.gid == gid && c.is_default);
            self.edit(|d| d.glyph_mut(key).alternate = (!is_default).then_some(gid));
        } else {
            self.edit(|d| d.glyph_mut(key).alternate = None);
        }
        Ok(())
    }

    /// Step through alternates (`step` = +1 next, -1 previous), wrapping around.
    pub fn cycle_alternate(&mut self, key: GlyphKey, step: i32) -> Result<()> {
        let style = self.style.clone();
        let choices = self.composition()?.alternates(&style, key);
        if choices.len() < 2 {
            return Ok(());
        }
        let current = choices.iter().position(|c| c.is_current).unwrap_or(0) as i32;
        let next = (current + step).rem_euclid(choices.len() as i32) as usize;
        self.set_alternate(key, Some(choices[next].gid))
    }

    pub fn alternates(&mut self, key: GlyphKey) -> Result<Vec<AlternateChoice>> {
        let style = self.style.clone();
        Ok(self.composition()?.alternates(&style, key))
    }

    /// Absolute offset from the shaper's position, in font units.
    pub fn set_offset(&mut self, key: GlyphKey, dx: f32, dy: f32) {
        self.edit(|d| {
            let g = d.glyph_mut(key);
            g.dx = dx.round();
            g.dy = dy.round();
        });
    }

    pub fn move_by(&mut self, key: GlyphKey, ddx: f32, ddy: f32) {
        let (dx, dy) = self
            .doc
            .glyphs
            .get(&key)
            .map_or((0.0, 0.0), |g| (g.dx, g.dy));
        self.set_offset(key, dx + ddx, dy + ddy);
    }

    pub fn set_scale(&mut self, key: GlyphKey, scale: f32) {
        let scale = (scale.clamp(MIN_SCALE, MAX_SCALE) * 100.0).round() / 100.0;
        self.edit(|d| d.glyph_mut(key).scale = scale);
    }

    pub fn set_rotation(&mut self, key: GlyphKey, degrees: f32) {
        let degrees = (degrees.rem_euclid(360.0) * 10.0).round() / 10.0;
        let degrees = if degrees > 180.0 {
            degrees - 360.0
        } else {
            degrees
        };
        self.edit(|d| d.glyph_mut(key).rotate = degrees);
    }

    /// Forget every manual change to one glyph.
    pub fn reset_glyph(&mut self, key: GlyphKey) {
        self.edit(|d| {
            d.glyphs.remove(&key);
        });
    }

    /// Forget every manual change in the document (text and options stay).
    pub fn reset_all(&mut self) {
        self.edit(|d| {
            d.glyphs.clear();
            d.kashidas.clear();
        });
    }

    // ------------------------------------------------------------- kashida

    /// Set (Some) or remove (None) the elongation between char `after` and `after + 1`.
    pub fn set_kashida(&mut self, after: u32, length: Option<f32>) -> Result<()> {
        let Some(length) = length.filter(|l| *l > 0.0) else {
            self.edit(|d| {
                d.kashidas.remove(&after);
            });
            return Ok(());
        };
        if !self.composition()?.kashida_allowed(after) {
            return Err(Error::Rule(
                "a kashida is not allowed at this position".into(),
            ));
        }
        let rules = &self.style.manifest.kashida;
        if rules.max_per_word > 0 && !self.doc.kashidas.contains_key(&after) {
            let chars: Vec<char> = self.doc.text.chars().collect();
            let word = word_at(&chars, after as usize);
            let in_word = self
                .doc
                .kashidas
                .keys()
                .filter(|k| word.contains(&(**k as usize)))
                .count() as u32;
            if in_word >= rules.max_per_word {
                return Err(Error::Rule(format!(
                    "this style allows at most {} kashida(s) per word",
                    rules.max_per_word
                )));
            }
        }
        let length = length.min(rules.max_length).round();
        self.edit(|d| {
            d.kashidas.insert(after, length);
        });
        Ok(())
    }

    // ------------------------------------------------------------- options

    pub fn set_option(&mut self, tag: &str, enabled: bool) -> Result<()> {
        if !self.style.manifest.options.iter().any(|o| o.tag == tag) {
            return Err(Error::Rule(format!("unknown option '{tag}'")));
        }
        self.edit(|d| {
            if enabled {
                d.options.insert(tag.to_string());
            } else {
                d.options.remove(tag);
            }
        });
        Ok(())
    }

    pub fn set_align(&mut self, align: Align) {
        self.edit(|d| d.layout.align = align);
    }

    pub fn set_line_spacing(&mut self, spacing: f32) {
        let spacing = (spacing.clamp(0.5, 3.0) * 100.0).round() / 100.0;
        self.edit(|d| d.layout.line_spacing = spacing);
    }

    // ------------------------------------------------------------- history

    /// Group the following edits into one undo step (e.g. a mouse drag).
    pub fn begin_gesture(&mut self) {
        self.history.begin_gesture();
    }

    pub fn end_gesture(&mut self) {
        self.history.end_gesture();
    }

    pub fn undo(&mut self) -> bool {
        let done = self.history.undo(&mut self.doc);
        if done {
            self.composition = None;
        }
        done
    }

    pub fn redo(&mut self) -> bool {
        let done = self.history.redo(&mut self.doc);
        if done {
            self.composition = None;
        }
        done
    }

    pub fn can_undo(&self) -> bool {
        self.history.can_undo()
    }

    pub fn can_redo(&self) -> bool {
        self.history.can_redo()
    }

    // -------------------------------------------------------------- export

    pub fn export_svg(&mut self, options: &SvgOptions) -> Result<String> {
        let style = self.style.clone();
        let scene = self.scene()?;
        Ok(scene_to_svg(scene, &style.font, options))
    }
}

/// Line endings → `\n`; carriage returns and BOMs removed.
fn normalize(text: &str) -> String {
    text.replace("\r\n", "\n").replace(['\r', '\u{FEFF}'], "")
}
