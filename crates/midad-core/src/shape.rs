//! Thin wrapper around HarfRust (the Rust port of HarfBuzz).
//!
//! Cluster values: the engine feeds the shaper its own cluster numbers.
//! Character `i` of the document gets cluster `2·i`; a tatweel inserted for a
//! kashida after character `i` gets cluster `2·i + 1`. Clusters stay
//! monotonic (HarfBuzz requires that) and every output glyph can be traced
//! back to either a real character (even) or an elongation (odd).

use harfrust::{Buffer, BufferFlags, Direction, Feature, Language, Script, ShapeOptions, Tag};

use crate::error::{Error, Result};
use crate::font::FontData;

/// One glyph as returned by the shaper (font units).
#[derive(Clone, Copy, Debug)]
pub struct ShapedGlyph {
    pub gid: u16,
    pub cluster: u32,
    pub x_advance: f32,
    pub x_offset: f32,
    pub y_offset: f32,
    /// Inserting a tatweel *before* this cluster keeps shaping intact.
    pub safe_to_insert_tatweel: bool,
}

impl ShapedGlyph {
    /// Document char index for real characters, `None` for kashida glyphs.
    pub fn char_index(&self) -> Option<u32> {
        (self.cluster % 2 == 0).then_some(self.cluster / 2)
    }

    /// `Some(i)` when this glyph is the elongation inserted after char `i`.
    pub fn kashida_after(&self) -> Option<u32> {
        (self.cluster % 2 == 1).then_some(self.cluster / 2)
    }
}

pub fn char_cluster(index: u32) -> u32 {
    index * 2
}

pub fn kashida_cluster(after: u32) -> u32 {
    after * 2 + 1
}

/// A feature limited to the glyphs of one cluster.
///
/// Built by hand rather than with `Feature::new(tag, value, a..b)`: that
/// constructor turns an exclusive Rust range into an inclusive end, while the
/// shaper treats `end` as exclusive, so a one-cluster range would be empty.
pub fn feature_on_cluster(tag: Tag, value: u32, cluster: u32) -> Feature {
    Feature {
        tag,
        value,
        start: cluster,
        end: cluster + 1,
    }
}

pub struct ShapeRequest<'a> {
    pub input: &'a [(char, u32)],
    pub rtl: bool,
    pub script: Option<Script>,
    pub language: Option<&'a Language>,
    pub features: &'a [Feature],
}

/// Shape a single-direction run. Output is in visual order (left → right).
pub fn shape(font: &FontData, req: &ShapeRequest<'_>) -> Result<Vec<ShapedGlyph>> {
    let mut buffer = Buffer::new();
    for &(c, cluster) in req.input {
        buffer.push(c as u32, cluster);
    }
    buffer.set_direction(if req.rtl {
        Direction::RightToLeft
    } else {
        Direction::LeftToRight
    });
    if req.rtl {
        buffer.set_script(req.script);
        buffer.set_language(req.language.cloned());
    }
    buffer.guess_segment_properties();
    buffer.set_flags(
        BufferFlags::BEGINNING_OF_TEXT
            | BufferFlags::END_OF_TEXT
            | BufferFlags::PRODUCE_SAFE_TO_INSERT_TATWEEL,
    );

    let shaper = font.shaper();
    harfrust::shape(
        &shaper,
        &mut buffer,
        ShapeOptions::new().features(req.features),
    )
    .map_err(|e| Error::Shaping(format!("{e:?}")))?;

    Ok(buffer
        .glyph_infos()
        .iter()
        .zip(buffer.glyph_positions())
        .map(|(info, pos)| ShapedGlyph {
            gid: info.glyph_id as u16,
            cluster: info.cluster,
            x_advance: pos.x_advance as f32,
            x_offset: pos.x_offset as f32,
            y_offset: pos.y_offset as f32,
            safe_to_insert_tatweel: info.flags().is_safe_to_insert_tatweel(),
        })
        .collect())
}
