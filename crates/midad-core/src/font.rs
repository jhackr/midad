//! Font access: shaping handle, metrics, outlines and the alternates table.
//!
//! Two crates from the same family read the font:
//! * [`harfrust`] (HarfBuzz port) shapes text;
//! * [`skrifa`] (Google's fontations) draws outlines and reads tables.
//!
//! Both work on the same bytes, held once in an `Arc`.

use std::collections::{BTreeSet, HashMap};
use std::sync::{Arc, Mutex};

use harfrust::{ShaperFont, Tag};
use skrifa::instance::{LocationRef, Size};
use skrifa::outline::{DrawSettings, OutlinePen};
use skrifa::raw::tables::gsub::SubstitutionSubtables;
use skrifa::raw::{FontRef, TableProvider};
use skrifa::{GlyphId, MetadataProvider};

use crate::error::{Error, Result};
use crate::geometry::Rect;

const TATWEEL: char = '\u{0640}';
const GDEF_MARK_CLASS: u16 = 3;

/// The outline of one glyph, ready to draw.
#[derive(Clone, Debug)]
pub struct GlyphOutline {
    /// SVG path data in font units, y pointing up.
    pub path: String,
    /// Control box of the outline (None for empty glyphs such as space).
    pub bounds: Option<Rect>,
}

/// Vertical metrics in font units (y up: descender is negative).
#[derive(Clone, Copy, Debug)]
pub struct VerticalMetrics {
    pub ascender: f32,
    pub descender: f32,
    pub line_gap: f32,
}

pub struct FontData {
    bytes: Arc<dyn AsRef<[u8]> + Send + Sync>,
    shaping: harfrust::Font,
    units_per_em: u16,
    metrics: VerticalMetrics,
    tatweel: Option<u16>,
    tatweel_advance: f32,
    marks: BTreeSet<u16>,
    alternates: HashMap<u16, Vec<u16>>,
    outlines: Mutex<HashMap<u16, Arc<GlyphOutline>>>,
}

impl std::fmt::Debug for FontData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FontData")
            .field("units_per_em", &self.units_per_em)
            .field("glyphs_with_alternates", &self.alternates.len())
            .finish()
    }
}

impl FontData {
    /// Parse a font. `alternates_feature` is the GSUB feature whose
    /// type-3 lookups list each glyph's calligraphic alternates.
    pub fn new(bytes: Vec<u8>, alternates_feature: Tag) -> Result<Self> {
        let bytes: Arc<dyn AsRef<[u8]> + Send + Sync> = Arc::new(bytes);
        let font_ref = FontRef::new((*bytes).as_ref()).map_err(|_| Error::InvalidFont)?;

        let units_per_em = font_ref
            .head()
            .map_err(|_| Error::InvalidFont)?
            .units_per_em();
        let m = font_ref.metrics(Size::unscaled(), LocationRef::default());
        let metrics = VerticalMetrics {
            ascender: m.ascent,
            descender: m.descent,
            line_gap: m.leading,
        };
        let tatweel = font_ref.charmap().map(TATWEEL).map(|g| g.to_u32() as u16);
        let tatweel_advance = tatweel
            .and_then(|g| {
                font_ref
                    .glyph_metrics(Size::unscaled(), LocationRef::default())
                    .advance_width(GlyphId::new(g as u32))
            })
            .unwrap_or(0.0);
        let marks = read_mark_glyphs(&font_ref);
        let alternates = read_alternates(&font_ref, alternates_feature);

        let shaping = harfrust::Font::new(bytes.clone(), 0).ok_or(Error::InvalidFont)?;

        Ok(Self {
            bytes,
            shaping,
            units_per_em,
            metrics,
            tatweel,
            tatweel_advance,
            marks,
            alternates,
            outlines: Mutex::new(HashMap::new()),
        })
    }

    pub fn units_per_em(&self) -> u16 {
        self.units_per_em
    }

    pub fn metrics(&self) -> VerticalMetrics {
        self.metrics
    }

    /// Glyph id of U+0640 ARABIC TATWEEL, if the font has one.
    pub fn tatweel(&self) -> Option<u16> {
        self.tatweel
    }

    /// Advance width of a plain tatweel (0 when the font has none).
    pub fn tatweel_advance(&self) -> f32 {
        self.tatweel_advance
    }

    /// True when GDEF classifies the glyph as a mark (harakat, dots…).
    pub fn is_mark(&self, gid: u16) -> bool {
        self.marks.contains(&gid)
    }

    /// Calligraphic alternates of `gid` (not including `gid` itself).
    pub fn alternates(&self, gid: u16) -> &[u16] {
        self.alternates.get(&gid).map(Vec::as_slice).unwrap_or(&[])
    }

    pub fn glyphs_with_alternates(&self) -> usize {
        self.alternates.len()
    }

    /// A HarfBuzz font handle. Cheap: layout tables are cached inside `harfrust::Font`.
    pub(crate) fn shaper(&self) -> ShaperFont<'_, '_> {
        ShaperFont::new(&self.shaping)
    }

    /// Outline of `gid`, drawn once and cached.
    pub fn outline(&self, gid: u16) -> Arc<GlyphOutline> {
        if let Some(found) = self.outlines.lock().expect("outline cache").get(&gid) {
            return found.clone();
        }
        let outline = Arc::new(self.draw(gid));
        self.outlines
            .lock()
            .expect("outline cache")
            .insert(gid, outline.clone());
        outline
    }

    fn draw(&self, gid: u16) -> GlyphOutline {
        let mut pen = SvgPathPen::default();
        if let Ok(font) = FontRef::new((*self.bytes).as_ref()) {
            if let Some(glyph) = font.outline_glyphs().get(GlyphId::new(gid as u32)) {
                let settings = DrawSettings::unhinted(Size::unscaled(), LocationRef::default());
                let _ = glyph.draw(settings, &mut pen);
            }
        }
        GlyphOutline {
            path: pen.path,
            bounds: pen.bounds,
        }
    }

    /// Raw font bytes (used e.g. to embed the font in an export).
    pub fn bytes(&self) -> &[u8] {
        (*self.bytes).as_ref()
    }
}

/// Read every type-3 (alternate substitution) lookup registered under `feature`.
fn read_alternates(font: &FontRef, feature: Tag) -> HashMap<u16, Vec<u16>> {
    let mut result: HashMap<u16, Vec<u16>> = HashMap::new();
    let Ok(gsub) = font.gsub() else {
        return result;
    };
    let (Ok(features), Ok(lookups)) = (gsub.feature_list(), gsub.lookup_list()) else {
        return result;
    };

    let mut indices = BTreeSet::new();
    for record in features.feature_records() {
        if record.feature_tag() != feature {
            continue;
        }
        if let Ok(f) = record.feature(features.offset_data()) {
            indices.extend(f.lookup_list_indices().iter().map(|i| i.get()));
        }
    }

    for index in indices {
        let Ok(lookup) = lookups.lookups().get(index as usize) else {
            continue;
        };
        let Ok(SubstitutionSubtables::Alternate(subtables)) = lookup.subtables() else {
            continue;
        };
        for subtable in subtables.iter().flatten() {
            let Ok(coverage) = subtable.coverage() else {
                continue;
            };
            for (gid, set) in coverage.iter().zip(subtable.alternate_sets().iter()) {
                let Ok(set) = set else { continue };
                let entry = result.entry(gid.to_u16()).or_default();
                for alt in set.alternate_glyph_ids() {
                    let alt = alt.get().to_u16();
                    if !entry.contains(&alt) {
                        entry.push(alt);
                    }
                }
            }
        }
    }
    result
}

fn read_mark_glyphs(font: &FontRef) -> BTreeSet<u16> {
    let mut marks = BTreeSet::new();
    if let Ok(gdef) = font.gdef() {
        if let Some(Ok(class_def)) = gdef.glyph_class_def() {
            for (gid, class) in class_def.iter() {
                if class == GDEF_MARK_CLASS {
                    marks.insert(gid.to_u16());
                }
            }
        }
    }
    marks
}

/// Builds an SVG path string and its control box.
#[derive(Default)]
struct SvgPathPen {
    path: String,
    bounds: Option<Rect>,
}

impl SvgPathPen {
    fn point(&mut self, x: f32, y: f32) {
        match &mut self.bounds {
            Some(b) => b.include_point(x, y),
            None => self.bounds = Some(Rect::new(x, y, x, y)),
        }
        push_num(&mut self.path, x);
        self.path.push(' ');
        push_num(&mut self.path, y);
    }

    fn command(&mut self, c: char) {
        if !self.path.is_empty() {
            self.path.push(' ');
        }
        self.path.push(c);
    }
}

fn push_num(out: &mut String, v: f32) {
    use std::fmt::Write;
    let rounded = (v * 100.0).round() / 100.0;
    if rounded.fract() == 0.0 {
        let _ = write!(out, "{}", rounded as i64);
    } else {
        let _ = write!(out, "{rounded}");
    }
}

impl OutlinePen for SvgPathPen {
    fn move_to(&mut self, x: f32, y: f32) {
        self.command('M');
        self.point(x, y);
    }

    fn line_to(&mut self, x: f32, y: f32) {
        self.command('L');
        self.point(x, y);
    }

    fn quad_to(&mut self, cx0: f32, cy0: f32, x: f32, y: f32) {
        self.command('Q');
        self.point(cx0, cy0);
        self.path.push(' ');
        self.point(x, y);
    }

    fn curve_to(&mut self, cx0: f32, cy0: f32, cx1: f32, cy1: f32, x: f32, y: f32) {
        self.command('C');
        self.point(cx0, cy0);
        self.path.push(' ');
        self.point(cx1, cy1);
        self.path.push(' ');
        self.point(x, y);
    }

    fn close(&mut self) {
        self.command('Z');
    }
}
