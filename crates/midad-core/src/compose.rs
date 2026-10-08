//! Composition: document + style → [`Scene`].
//!
//! ```text
//!   text ──split lines──► line ──bidi──► visual runs (RTL / LTR)
//!                                            │
//!   for every run:                           ▼
//!     ① plain shaping ............ which joins may take a kashida?
//!     ② insert tatweels .......... for the kashidas the document asks for
//!     ③ shaping pass A ........... "what the shaper picks on its own" (defaults)
//!     ④ alternates → features .... value N of the alternates feature, on one cluster
//!     ⑤ shaping pass B ........... only when ④ produced features
//!     ⑥ pen positions ............ kashida glyphs stretched to the asked length
//!
//!   then: align lines, apply per-glyph offsets/scale/rotation, compute bounds.
//! ```
//!
//! Alternates are applied *inside* the shaper (step ⑤), never by swapping
//! glyph ids afterwards, so mark positioning, kerning and cursive attachment
//! are always computed for the glyph that is actually displayed.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::ops::Range;

use harfrust::Feature;
use unicode_bidi::{BidiInfo, Level};

use crate::document::{Align, Document, GlyphKey};
use crate::error::Result;
use crate::geometry::{Affine, Rect};
use crate::kashida;
use crate::scene::{
    AlternateChoice, KashidaSlot, LineInfo, PlacedGlyph, Scene, Warning, WarningKind,
};
use crate::shape::{
    ShapeRequest, ShapedGlyph, char_cluster, feature_on_cluster, kashida_cluster, shape,
};
use crate::style::Style;
use crate::text::{TATWEEL, word_at};

/// A scene plus what the editor needs to answer questions about it.
#[derive(Clone, Debug)]
pub struct Composition {
    pub scene: Scene,
    defaults: HashMap<GlyphKey, u16>,
    current: HashMap<GlyphKey, u16>,
    allowed_kashida: BTreeSet<u32>,
}

impl Composition {
    /// Glyph the shaper picks at `key` when no alternate is chosen.
    pub fn default_glyph(&self, key: GlyphKey) -> Option<u16> {
        self.defaults.get(&key).copied()
    }

    /// Glyph currently displayed at `key`.
    pub fn current_glyph(&self, key: GlyphKey) -> Option<u16> {
        self.current.get(&key).copied()
    }

    pub fn kashida_allowed(&self, after: u32) -> bool {
        self.allowed_kashida.contains(&after)
    }

    /// The shapes the user can pick for `key`: the default first, then its alternates.
    pub fn alternates(&self, style: &Style, key: GlyphKey) -> Vec<AlternateChoice> {
        let Some(default) = self.default_glyph(key) else {
            return Vec::new();
        };
        let current = self.current_glyph(key).unwrap_or(default);
        std::iter::once(default)
            .chain(style.font.alternates(default).iter().copied())
            .map(|gid| AlternateChoice {
                gid,
                is_default: gid == default,
                is_current: gid == current,
            })
            .collect()
    }
}

/// Glyph after shaping and pen placement, before alignment and user transforms.
struct RawGlyph {
    gid: u16,
    key: Option<GlyphKey>,
    kashida: Option<u32>,
    span: [u32; 2],
    line: u32,
    base: Affine,
    origin: [f32; 2],
    advance: f32,
}

struct RawSlot {
    after: u32,
    x: f32,
    length: f32,
    line: u32,
}

struct Composer<'a> {
    style: &'a Style,
    doc: &'a Document,
    chars: Vec<char>,
    global_features: Vec<Feature>,
    kashida_enabled: bool,
    glyphs: Vec<RawGlyph>,
    slots: Vec<RawSlot>,
    lines: Vec<LineInfo>,
    warnings: Vec<Warning>,
    defaults: HashMap<GlyphKey, u16>,
    allowed: BTreeSet<u32>,
}

pub fn compose(style: &Style, doc: &Document) -> Result<Composition> {
    let mut c = Composer {
        style,
        doc,
        chars: doc.text.chars().collect(),
        global_features: style.global_features(&doc.options),
        kashida_enabled: style.manifest.kashida.enabled && style.font.tatweel().is_some(),
        glyphs: Vec::new(),
        slots: Vec::new(),
        lines: Vec::new(),
        warnings: Vec::new(),
        defaults: HashMap::new(),
        allowed: BTreeSet::new(),
    };

    let mut start = 0usize;
    let mut line = 0u32;
    loop {
        let end = c.chars[start..]
            .iter()
            .position(|ch| *ch == '\n')
            .map_or(c.chars.len(), |p| start + p);
        let width = c.compose_line(start..end, line)?;
        c.lines.push(LineInfo {
            baseline: 0.0,
            width,
            start: start as u32,
            end: end as u32,
        });
        if end >= c.chars.len() {
            break;
        }
        start = end + 1;
        line += 1;
    }

    Ok(c.finish())
}

impl Composer<'_> {
    fn compose_line(&mut self, range: Range<usize>, line: u32) -> Result<f32> {
        let mut pen = 0.0f32;
        for (run, rtl) in visual_runs(&self.chars[range.clone()]) {
            let run = (range.start + run.start)..(range.start + run.end);
            pen = self.compose_run(run, rtl, line, pen)?;
        }
        Ok(pen)
    }

    fn request<'r>(
        &'r self,
        input: &'r [(char, u32)],
        rtl: bool,
        features: &'r [Feature],
    ) -> ShapeRequest<'r> {
        ShapeRequest {
            input,
            rtl,
            script: self.style.script(),
            language: self.style.language(),
            features,
        }
    }

    fn compose_run(
        &mut self,
        run: Range<usize>,
        rtl: bool,
        line: u32,
        mut pen: f32,
    ) -> Result<f32> {
        let style: &Style = self.style;
        let font = &style.font;
        let rules = &style.manifest.kashida;

        // ① Which joins may take a kashida? Ask the shaper, then the style rules.
        let plain_input: Vec<(char, u32)> = run
            .clone()
            .map(|i| (self.chars[i], char_cluster(i as u32)))
            .collect();
        let mut allowed = BTreeSet::new();
        if rtl && self.kashida_enabled {
            let plain = shape(
                font,
                &self.request(&plain_input, rtl, &self.global_features),
            )?;
            for g in &plain {
                let Some(j) = g.char_index() else { continue };
                if g.safe_to_insert_tatweel
                    && j as usize > run.start
                    && kashida::rules_allow(rules, &self.chars, j as usize - 1)
                {
                    allowed.insert(j - 1);
                }
            }
        }

        // ② Kashidas requested by the document that are allowed here.
        let mut active: BTreeMap<u32, f32> = BTreeMap::new();
        let mut per_word: HashMap<usize, u32> = HashMap::new();
        for (&after, &length) in self.doc.kashidas.range(run.start as u32..run.end as u32) {
            if !allowed.contains(&after) {
                self.warn(
                    WarningKind::KashidaNotAllowed,
                    after,
                    "kashida is not allowed here",
                );
                continue;
            }
            let word = word_at(&self.chars, after as usize).start;
            let count = per_word.entry(word).or_insert(0);
            if rules.max_per_word > 0 && *count >= rules.max_per_word {
                self.warn(
                    WarningKind::KashidaLimit,
                    after,
                    "too many kashidas in this word",
                );
                continue;
            }
            *count += 1;
            active.insert(after, length);
        }
        let mut input = Vec::with_capacity(plain_input.len() + active.len());
        for &(ch, cluster) in &plain_input {
            input.push((ch, cluster));
            if active.contains_key(&(cluster / 2)) {
                input.push((TATWEEL, kashida_cluster(cluster / 2)));
            }
        }

        // ③ Pass A: the shaper's own choices.
        let pass_a = shape(font, &self.request(&input, rtl, &self.global_features))?;
        let keys_a = assign_keys(&pass_a, rtl);
        for (g, key) in pass_a.iter().zip(&keys_a) {
            if let Some(key) = key {
                self.defaults.insert(*key, g.gid);
            }
        }

        // ④ Chosen alternates → "alternates feature = N" on that cluster only.
        let mut alt_features = Vec::new();
        let mut used_clusters = BTreeSet::new();
        let key_range = GlyphKey::new(run.start as u32, 0)..GlyphKey::new(run.end as u32, 0);
        for (key, ov) in self.doc.glyphs.range(key_range) {
            let Some(target) = ov.alternate else { continue };
            let Some(&default) = self.defaults.get(key) else {
                self.warn(
                    WarningKind::StaleAlternate,
                    key.cluster,
                    "no glyph at this position",
                );
                continue;
            };
            if default == target {
                continue;
            }
            let Some(pos) = font.alternates(default).iter().position(|g| *g == target) else {
                self.warn(
                    WarningKind::StaleAlternate,
                    key.cluster,
                    "the chosen alternate does not fit this letter any more",
                );
                continue;
            };
            let cluster = char_cluster(key.cluster);
            if !used_clusters.insert(cluster) {
                self.warn(
                    WarningKind::ConflictingAlternates,
                    key.cluster,
                    "only one alternate per cluster is applied",
                );
                continue;
            }
            alt_features.push(feature_on_cluster(
                style.alternates_tag(),
                pos as u32 + 1,
                cluster,
            ));
        }

        // ⑤ Pass B, only when needed.
        let (glyphs, keys) = if alt_features.is_empty() {
            (pass_a, keys_a)
        } else {
            let mut features = self.global_features.clone();
            features.extend(alt_features);
            let pass_b = shape(font, &self.request(&input, rtl, &features))?;
            let keys = if pass_b.len() == pass_a.len() {
                keys_a
            } else {
                assign_keys(&pass_b, rtl)
            };
            (pass_b, keys)
        };

        // ⑥ Pen positions, stretching elongation glyphs.
        let spans = cluster_spans(&glyphs, run.end as u32);
        let mut natural: HashMap<u32, f32> = HashMap::new();
        for g in &glyphs {
            if let Some(after) = g.kashida_after() {
                *natural.entry(after).or_default() += g.x_advance;
            }
        }
        let max_length = rules.max_length;
        let stretch = |after: u32| -> f32 {
            let nat = natural.get(&after).copied().unwrap_or(0.0).max(1.0);
            let want = active.get(&after).copied().unwrap_or(nat);
            want.clamp(nat * 0.25, max_length.max(nat)) / nat
        };

        let mut kashida_left: HashMap<u32, f32> = HashMap::new();
        let mut base_left: HashMap<u32, f32> = HashMap::new();
        for (g, key) in glyphs.iter().zip(&keys) {
            let kashida = g.kashida_after();
            let sx = kashida.map_or(1.0, stretch);
            let origin = [pen + g.x_offset, g.y_offset];
            let advance = g.x_advance * sx;
            if let Some(after) = kashida {
                let left = kashida_left.entry(after).or_insert(f32::MAX);
                *left = left.min(origin[0]);
            }
            let span = key
                .map(|k| {
                    spans
                        .get(&k.cluster)
                        .copied()
                        .unwrap_or([k.cluster, k.cluster + 1])
                })
                .or_else(|| kashida.map(|a| [a, a + 1]))
                .unwrap_or([0, 0]);
            if let Some(k) = key {
                if k.index == 0 && !font.is_mark(g.gid) {
                    base_left.insert(k.cluster, origin[0]);
                }
            }
            self.glyphs.push(RawGlyph {
                gid: g.gid,
                key: *key,
                kashida,
                span,
                line,
                base: Affine::translate(origin[0], origin[1]).then(&Affine::scale(sx, 1.0)),
                origin,
                advance,
            });
            pen += advance;
        }

        // Kashida handles: at the left end of the elongation (or of the letter).
        for &after in &allowed {
            let x = if let Some(&x) = kashida_left.get(&after) {
                x
            } else {
                let owner = spans
                    .iter()
                    .find(|(_, span)| span[0] <= after && after < span[1])
                    .map(|(c, _)| *c);
                match owner.and_then(|c| base_left.get(&c)) {
                    Some(&x) => x,
                    None => continue,
                }
            };
            let length = if active.contains_key(&after) {
                natural.get(&after).copied().unwrap_or(0.0) * stretch(after)
            } else {
                0.0
            };
            self.slots.push(RawSlot {
                after,
                x,
                length,
                line,
            });
        }
        self.allowed.extend(allowed);
        Ok(pen)
    }

    fn warn(&mut self, kind: WarningKind, at: u32, message: &str) {
        self.warnings.push(Warning {
            kind,
            at,
            message: message.to_string(),
        });
    }

    fn finish(mut self) -> Composition {
        let style: &Style = self.style;
        let font = &style.font;
        let metrics = font.metrics();
        let line_height = (metrics.ascender - metrics.descender + metrics.line_gap)
            * self.doc.layout.line_spacing;
        let max_width = self.lines.iter().map(|l| l.width).fold(0.0, f32::max);

        let mut shifts = Vec::with_capacity(self.lines.len());
        for (i, line) in self.lines.iter_mut().enumerate() {
            line.baseline = -(i as f32) * line_height;
            // The block is anchored at its right edge (x = 0, negative x to
            // the left), like Arabic writing: lengthening a line pushes its
            // end leftwards and never moves its beginning.
            let dx = match self.doc.layout.align {
                Align::Right => -line.width,
                Align::Center => -(max_width + line.width) * 0.5,
                Align::Left => -max_width,
            };
            shifts.push((dx, line.baseline));
        }

        let mut bounds: Option<Rect> = None;
        let mut extend = |r: Rect| {
            bounds = Some(bounds.map_or(r, |b| b.union(&r)));
        };
        for (line, &(dx, baseline)) in self.lines.iter().zip(&shifts) {
            extend(Rect::new(
                dx,
                baseline + metrics.descender,
                dx + line.width,
                baseline + metrics.ascender,
            ));
        }

        let mut current = HashMap::new();
        let mut placed = Vec::with_capacity(self.glyphs.len());
        for raw in &self.glyphs {
            let (dx, baseline) = shifts[raw.line as usize];
            let line_shift = Affine::translate(dx, baseline);
            let mut transform = line_shift.then(&raw.base);
            let origin = [raw.origin[0] + dx, raw.origin[1] + baseline];
            let outline = font.outline(raw.gid);
            let is_mark = font.is_mark(raw.gid);
            let mut modified = false;

            if let Some(key) = raw.key {
                current.insert(key, raw.gid);
                let own = self.doc.glyphs.get(&key);
                // Marks travel with their base letter.
                let parent = (is_mark && key.index > 0)
                    .then(|| self.doc.glyphs.get(&GlyphKey::new(key.cluster, 0)))
                    .flatten();
                let (pdx, pdy) = parent.map_or((0.0, 0.0), |p| (p.dx, p.dy));
                modified = own.is_some_and(|o| !o.is_default());
                let (odx, ody, scale, rotate) =
                    own.map_or((0.0, 0.0, 1.0, 0.0), |o| (o.dx, o.dy, o.scale, o.rotate));
                if odx + pdx != 0.0 || ody + pdy != 0.0 || scale != 1.0 || rotate != 0.0 {
                    let (px, py) = outline
                        .bounds
                        .map(|b| b.transform(&transform).center())
                        .unwrap_or((origin[0], origin[1]));
                    let local = Affine::around(
                        Affine::rotate_degrees(rotate).then(&Affine::scale(scale, scale)),
                        px,
                        py,
                    );
                    transform = Affine::translate(odx + pdx, ody + pdy)
                        .then(&local)
                        .then(&transform);
                }
            }

            let glyph_bounds = outline.bounds.map(|b| b.transform(&transform));
            if let Some(b) = glyph_bounds {
                extend(b);
            }
            let alternates = raw
                .key
                .and_then(|k| self.defaults.get(&k))
                .map_or(0, |d| font.alternates(*d).len() as u16);

            placed.push(PlacedGlyph {
                gid: raw.gid,
                key: raw.key,
                kashida: raw.kashida,
                span: raw.span,
                line: raw.line,
                is_mark,
                transform,
                origin,
                advance: raw.advance,
                bounds: glyph_bounds,
                alternates,
                modified,
            });
        }

        let natural = font.tatweel_advance();
        let max = style.manifest.kashida.max_length;
        let kashida_slots = self
            .slots
            .iter()
            .map(|s| {
                let (dx, baseline) = shifts[s.line as usize];
                KashidaSlot {
                    after: s.after,
                    x: s.x + dx,
                    y: baseline,
                    length: s.length,
                    natural,
                    max,
                }
            })
            .collect();

        let empty = Rect::new(0.0, metrics.descender, 0.0, metrics.ascender);
        Composition {
            scene: Scene {
                units_per_em: font.units_per_em(),
                ascender: metrics.ascender,
                descender: metrics.descender,
                glyphs: placed,
                bounds: bounds.unwrap_or(empty),
                lines: self.lines,
                kashida_slots,
                warnings: self.warnings,
            },
            defaults: self.defaults,
            current,
            allowed_kashida: self.allowed,
        }
    }
}

/// Number the glyphs of each cluster in logical order (0 = first).
fn assign_keys(glyphs: &[ShapedGlyph], rtl: bool) -> Vec<Option<GlyphKey>> {
    let mut keys = vec![None; glyphs.len()];
    let mut counters: HashMap<u32, u16> = HashMap::new();
    let mut visit = |i: usize| {
        if let Some(c) = glyphs[i].char_index() {
            let n = counters.entry(c).or_insert(0);
            keys[i] = Some(GlyphKey::new(c, *n));
            *n += 1;
        }
    };
    if rtl {
        (0..glyphs.len()).rev().for_each(&mut visit);
    } else {
        (0..glyphs.len()).for_each(&mut visit);
    }
    keys
}

/// Source char span of every cluster: from its first char up to the next cluster.
fn cluster_spans(glyphs: &[ShapedGlyph], run_end: u32) -> BTreeMap<u32, [u32; 2]> {
    let starts: BTreeSet<u32> = glyphs.iter().filter_map(|g| g.char_index()).collect();
    let starts: Vec<u32> = starts.into_iter().collect();
    starts
        .iter()
        .enumerate()
        .map(|(i, &s)| (s, [s, starts.get(i + 1).copied().unwrap_or(run_end)]))
        .collect()
}

/// Split a line into directional runs, in visual (left-to-right) order.
/// The paragraph direction is right-to-left.
fn visual_runs(line: &[char]) -> Vec<(Range<usize>, bool)> {
    if line.is_empty() {
        return Vec::new();
    }
    let text: String = line.iter().collect();
    let mut byte_to_char = vec![0usize; text.len() + 1];
    for (ci, (bi, ch)) in text.char_indices().enumerate() {
        byte_to_char[bi..bi + ch.len_utf8()].fill(ci);
    }
    byte_to_char[text.len()] = line.len();

    let info = BidiInfo::new(&text, Some(Level::rtl()));
    let mut runs = Vec::new();
    for para in &info.paragraphs {
        let (levels, level_runs) = info.visual_runs(para, para.range.clone());
        for r in level_runs {
            let rtl = levels[r.start].is_rtl();
            runs.push((byte_to_char[r.start]..byte_to_char[r.end], rtl));
        }
    }
    runs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn arabic_with_digits_splits_into_runs() {
        let line: Vec<char> = "سنة 2026 م".chars().collect();
        let runs = visual_runs(&line);
        assert!(runs.len() >= 2);
        assert!(runs.iter().any(|(_, rtl)| !rtl), "digits form an LTR run");
        let total: usize = runs.iter().map(|(r, _)| r.len()).sum();
        assert_eq!(total, line.len());
    }

    #[test]
    fn pure_arabic_is_one_rtl_run() {
        let line: Vec<char> = "بسم الله".chars().collect();
        assert_eq!(visual_runs(&line), vec![(0..line.len(), true)]);
    }
}
