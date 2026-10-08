//! The document model: text + every manual decision the calligrapher made.
//!
//! A document never stores glyph positions. It stores the *text* and a small
//! set of *overrides* (alternate shape, offset, scale, rotation, kashida).
//! The composition is recomputed from those on every change, so the shaper
//! stays the single source of truth and a document survives font updates.
//!
//! Overrides are addressed by [`GlyphKey`]: the index of the first source
//! character of the glyph's cluster, plus the glyph's position inside that
//! cluster. When the text is edited, keys are remapped (see
//! [`Document::set_text`]) so that edits elsewhere in the text keep them.
//!
//! The JSON produced by `serde` is the `.midad` file format, documented in
//! `docs/DOCUMENT_FORMAT.md`.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

/// Version of the `.midad` JSON format written by this engine.
pub const FORMAT_VERSION: u32 = 1;

/// Stable address of a glyph produced by shaping.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct GlyphKey {
    /// Char index (not byte index) of the first character of the cluster.
    pub cluster: u32,
    /// Position of the glyph inside its cluster, in logical order (0 = base).
    pub index: u16,
}

impl GlyphKey {
    pub const fn new(cluster: u32, index: u16) -> Self {
        Self { cluster, index }
    }
}

/// Manual changes to one glyph. All lengths in font units.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct GlyphOverride {
    /// Glyph id of the chosen alternate (None = what the shaper picked).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alternate: Option<u16>,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub dx: f32,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub dy: f32,
    #[serde(default = "one", skip_serializing_if = "is_one")]
    pub scale: f32,
    /// Degrees, counter-clockwise.
    #[serde(default, skip_serializing_if = "is_zero")]
    pub rotate: f32,
}

impl Default for GlyphOverride {
    fn default() -> Self {
        Self {
            alternate: None,
            dx: 0.0,
            dy: 0.0,
            scale: 1.0,
            rotate: 0.0,
        }
    }
}

impl GlyphOverride {
    pub fn is_default(&self) -> bool {
        self == &Self::default()
    }

    pub fn has_transform(&self) -> bool {
        self.dx != 0.0 || self.dy != 0.0 || self.scale != 1.0 || self.rotate != 0.0
    }
}

fn is_zero(v: &f32) -> bool {
    *v == 0.0
}
fn is_one(v: &f32) -> bool {
    *v == 1.0
}
fn one() -> f32 {
    1.0
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Align {
    #[default]
    Right,
    Center,
    Left,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Layout {
    #[serde(default)]
    pub align: Align,
    /// Multiplier of the font's natural line height.
    #[serde(default = "one")]
    pub line_spacing: f32,
}

impl Default for Layout {
    fn default() -> Self {
        Self {
            align: Align::Right,
            line_spacing: 1.0,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct StyleRef {
    pub id: String,
    pub version: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Document {
    pub format: u32,
    pub style: StyleRef,
    pub text: String,
    /// Tags of the style options (stylistic sets) switched on.
    #[serde(default)]
    pub options: BTreeSet<String>,
    #[serde(default, with = "glyph_list")]
    pub glyphs: BTreeMap<GlyphKey, GlyphOverride>,
    /// Elongations: char index → length in font units. The tatweel is
    /// inserted between char `i` and char `i + 1`.
    #[serde(default, with = "string_keys")]
    pub kashidas: BTreeMap<u32, f32>,
    #[serde(default)]
    pub layout: Layout,
}

impl Document {
    pub fn new(style: StyleRef, text: impl Into<String>) -> Self {
        Self {
            format: FORMAT_VERSION,
            style,
            text: text.into(),
            options: BTreeSet::new(),
            glyphs: BTreeMap::new(),
            kashidas: BTreeMap::new(),
            layout: Layout::default(),
        }
    }

    pub fn from_json(json: &str) -> Result<Self> {
        let doc: Document = serde_json::from_str(json)?;
        if doc.format > FORMAT_VERSION {
            return Err(Error::UnsupportedFormat {
                found: doc.format,
                supported: FORMAT_VERSION,
            });
        }
        Ok(doc)
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).expect("documents always serialize")
    }

    pub fn char_count(&self) -> u32 {
        self.text.chars().count() as u32
    }

    /// Mutable override for `key`, created on demand.
    pub fn glyph_mut(&mut self, key: GlyphKey) -> &mut GlyphOverride {
        self.glyphs.entry(key).or_default()
    }

    /// Drop overrides that no longer change anything.
    pub fn prune(&mut self) {
        self.glyphs.retain(|_, o| !o.is_default());
        self.kashidas.retain(|_, len| *len > 0.0);
    }

    /// Replace the text and carry overrides across the edit.
    ///
    /// The edit is modelled as one replaced span: the common prefix and
    /// suffix of the old and new text are kept, and everything referring to
    /// them survives (suffix keys are shifted). Overrides inside the replaced
    /// span are dropped — they referred to characters that no longer exist.
    pub fn set_text(&mut self, new_text: &str) {
        let old: Vec<char> = self.text.chars().collect();
        let new: Vec<char> = new_text.chars().collect();
        let prefix = old.iter().zip(&new).take_while(|(a, b)| a == b).count();
        let max_suffix = old.len().min(new.len()) - prefix;
        let suffix = old
            .iter()
            .rev()
            .zip(new.iter().rev())
            .take(max_suffix)
            .take_while(|(a, b)| a == b)
            .count();

        let old_suffix_start = (old.len() - suffix) as i64;
        let delta = new.len() as i64 - old.len() as i64;
        let prefix = prefix as i64;

        // A position is kept when it lies fully in the prefix or the suffix.
        let remap = |pos: i64| -> Option<u32> {
            if pos < prefix {
                Some(pos as u32)
            } else if pos >= old_suffix_start {
                Some((pos + delta) as u32)
            } else {
                None
            }
        };

        self.glyphs = std::mem::take(&mut self.glyphs)
            .into_iter()
            .filter_map(|(key, o)| {
                remap(key.cluster as i64).map(|c| (GlyphKey::new(c, key.index), o))
            })
            .collect();

        // A kashida sits between `i` and `i + 1`: both must survive and stay adjacent.
        self.kashidas = std::mem::take(&mut self.kashidas)
            .into_iter()
            .filter_map(|(i, len)| {
                let a = remap(i as i64)?;
                let b = remap(i as i64 + 1)?;
                (b == a + 1).then_some((a, len))
            })
            .collect();

        self.text = new_text.to_string();
    }
}

/// Integer-keyed maps are written with string keys (`{"12": 400}`), the only
/// form JSON and JavaScript objects accept.
mod string_keys {
    use super::*;
    use serde::{Deserializer, Serializer, de::Error as _};

    pub fn serialize<S: Serializer>(
        map: &BTreeMap<u32, f32>,
        s: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        map.iter()
            .map(|(k, v)| (k.to_string(), *v))
            .collect::<BTreeMap<String, f32>>()
            .serialize(s)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(
        d: D,
    ) -> std::result::Result<BTreeMap<u32, f32>, D::Error> {
        BTreeMap::<String, f32>::deserialize(d)?
            .into_iter()
            .map(|(k, v)| {
                k.parse::<u32>()
                    .map(|k| (k, v))
                    .map_err(|_| D::Error::custom(format!("invalid kashida position '{k}'")))
            })
            .collect()
    }
}

/// Serialize the override map as a flat list: `[{cluster, index, ...}]`.
mod glyph_list {
    use super::*;
    use serde::{Deserializer, Serializer};

    #[derive(Serialize, Deserialize)]
    struct Entry {
        cluster: u32,
        #[serde(default)]
        index: u16,
        #[serde(flatten)]
        value: GlyphOverride,
    }

    pub fn serialize<S: Serializer>(
        map: &BTreeMap<GlyphKey, GlyphOverride>,
        s: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        let entries: Vec<Entry> = map
            .iter()
            .map(|(k, v)| Entry {
                cluster: k.cluster,
                index: k.index,
                value: v.clone(),
            })
            .collect();
        entries.serialize(s)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(
        d: D,
    ) -> std::result::Result<BTreeMap<GlyphKey, GlyphOverride>, D::Error> {
        let entries = Vec::<Entry>::deserialize(d)?;
        Ok(entries
            .into_iter()
            .map(|e| (GlyphKey::new(e.cluster, e.index), e.value))
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc(text: &str) -> Document {
        Document::new(
            StyleRef {
                id: "t".into(),
                version: "1".into(),
            },
            text,
        )
    }

    #[test]
    fn json_roundtrip() {
        let mut d = doc("بسم الله");
        d.glyph_mut(GlyphKey::new(0, 0)).alternate = Some(42);
        d.glyph_mut(GlyphKey::new(2, 0)).dx = 15.0;
        d.kashidas.insert(0, 400.0);
        d.options.insert("ss01".into());
        let back = Document::from_json(&d.to_json()).unwrap();
        assert_eq!(back, d);
    }

    #[test]
    fn json_is_compact_for_defaults() {
        let mut d = doc("ب");
        d.glyph_mut(GlyphKey::new(0, 0)).alternate = Some(7);
        let json = d.to_json();
        assert!(json.contains("\"alternate\": 7"));
        assert!(!json.contains("\"scale\""));
    }

    #[test]
    fn rejects_future_format() {
        let mut d = doc("ب");
        d.format = FORMAT_VERSION + 1;
        let json = serde_json::to_string(&d).unwrap();
        assert!(matches!(
            Document::from_json(&json),
            Err(Error::UnsupportedFormat { .. })
        ));
    }

    #[test]
    fn insertion_keeps_prefix_and_shifts_suffix() {
        // chars: ب0 س1 م2 ␠3 ا4 ل5 ل6 ه7
        let mut d = doc("بسم الله");
        d.glyph_mut(GlyphKey::new(0, 0)).dx = 1.0; // ب (prefix)
        d.glyph_mut(GlyphKey::new(7, 0)).dx = 2.0; // ه (suffix)
        d.kashidas.insert(0, 300.0); // between ب and س
        d.kashidas.insert(5, 300.0); // between ل and ل

        d.set_text("بسم و الله"); // "و " inserted at 4
        assert_eq!(d.glyphs.get(&GlyphKey::new(0, 0)).unwrap().dx, 1.0);
        assert_eq!(d.glyphs.get(&GlyphKey::new(9, 0)).unwrap().dx, 2.0);
        assert_eq!(d.kashidas.get(&0), Some(&300.0));
        assert_eq!(d.kashidas.get(&7), Some(&300.0));
    }

    #[test]
    fn replacement_drops_overrides_inside_the_edit() {
        let mut d = doc("بسم الله");
        d.glyph_mut(GlyphKey::new(0, 0)).dx = 1.0;
        d.glyph_mut(GlyphKey::new(7, 0)).dx = 2.0; // ه — replaced
        d.set_text("بسم ربي");
        assert_eq!(d.glyphs.len(), 1);
        assert!(d.glyphs.contains_key(&GlyphKey::new(0, 0)));
    }

    #[test]
    fn kashida_dropped_when_neighbour_deleted() {
        let mut d = doc("بسم");
        d.kashidas.insert(0, 300.0); // ب|س
        d.set_text("بم"); // delete س
        assert!(d.kashidas.is_empty());
    }

    #[test]
    fn typing_at_end_keeps_everything() {
        let mut d = doc("بسم");
        d.glyph_mut(GlyphKey::new(2, 0)).alternate = Some(5);
        d.kashidas.insert(1, 200.0);
        d.set_text("بسم الله");
        assert!(d.glyphs.contains_key(&GlyphKey::new(2, 0)));
        assert!(d.kashidas.contains_key(&1));
    }
}
