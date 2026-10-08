//! `style.toml` — the manifest of a style package.
//!
//! The same file is read by the Python style compiler (`tools/midad_style`).
//! Keys that only the compiler uses (e.g. `alternates.edge_features`) are
//! accepted and ignored here, so the two programs can evolve independently.
//! The full reference lives in `docs/STYLE_FORMAT.md`.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

/// Text in several languages, keyed by BCP 47 tag (`ar`, `en`, …).
pub type Localized = BTreeMap<String, String>;

/// Pick the best string for `lang`, falling back to Arabic, English, then anything.
pub fn localized<'a>(text: &'a Localized, lang: &str) -> &'a str {
    text.get(lang)
        .or_else(|| text.get("ar"))
        .or_else(|| text.get("en"))
        .or_else(|| text.values().next())
        .map(String::as_str)
        .unwrap_or("")
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Manifest {
    pub style: StyleInfo,
    pub font: FontInfo,
    #[serde(default)]
    pub metrics: Option<CalligraphicMetrics>,
    #[serde(default)]
    pub shaping: ShapingConfig,
    #[serde(default)]
    pub alternates: AlternatesConfig,
    #[serde(default)]
    pub options: Vec<StyleOption>,
    #[serde(default)]
    pub kashida: KashidaRules,
}

impl Manifest {
    pub fn from_toml(text: &str) -> Result<Self> {
        let manifest: Manifest = toml::from_str(text)?;
        manifest.validate()?;
        Ok(manifest)
    }

    fn validate(&self) -> Result<()> {
        if self.style.id.trim().is_empty() {
            return Err(Error::ManifestValue("style.id must not be empty".into()));
        }
        if self.alternates.feature.len() != 4 {
            return Err(Error::ManifestValue(format!(
                "alternates.feature must be a 4-letter OpenType tag, got '{}'",
                self.alternates.feature
            )));
        }
        for opt in &self.options {
            if opt.tag.len() != 4 {
                return Err(Error::ManifestValue(format!(
                    "options.tag must be a 4-letter OpenType tag, got '{}'",
                    opt.tag
                )));
            }
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StyleInfo {
    pub id: String,
    pub version: String,
    pub name: Localized,
    #[serde(default)]
    pub description: Localized,
    #[serde(default)]
    pub license: String,
    #[serde(default)]
    pub credits: String,
    #[serde(default)]
    pub upstream: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FontInfo {
    /// Input of the style compiler. Never loaded by the engine.
    #[serde(default)]
    pub source: Option<String>,
    /// Path (relative to the style folder) of the font the engine loads.
    pub compiled: String,
    #[serde(default)]
    pub family_name: Option<String>,
}

/// Calligraphic measure: the rhombic dot (نقطة) made by the reed pen.
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct CalligraphicMetrics {
    /// Size of one dot, in font units.
    pub nuqta: f32,
    /// Height of the alef, in dots (5 in Naskh, 7 in Thuluth…).
    #[serde(default = "default_alef_dots")]
    pub alef_dots: u32,
}

fn default_alef_dots() -> u32 {
    5
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ShapingConfig {
    /// OpenType (`arab`) or ISO 15924 (`Arab`) script tag.
    #[serde(default = "default_script")]
    pub script: String,
    /// Optional BCP 47 language (`ar`, `ur`, `fa`…).
    #[serde(default)]
    pub language: Option<String>,
    /// Extra features in HarfBuzz syntax: `"ss01"`, `"-liga"`, `"cv01=2"`.
    #[serde(default)]
    pub features: Vec<String>,
}

impl Default for ShapingConfig {
    fn default() -> Self {
        Self {
            script: default_script(),
            language: None,
            features: Vec::new(),
        }
    }
}

fn default_script() -> String {
    "arab".into()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AlternatesConfig {
    /// GSUB feature whose type-3 lookups list each glyph's alternates.
    #[serde(default = "default_alt_feature")]
    pub feature: String,
}

impl Default for AlternatesConfig {
    fn default() -> Self {
        Self {
            feature: default_alt_feature(),
        }
    }
}

fn default_alt_feature() -> String {
    "salt".into()
}

/// A stylistic set (or any feature) the user can toggle for the whole text.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StyleOption {
    pub tag: String,
    pub label: Localized,
    #[serde(default)]
    pub default: bool,
}

/// Calligraphic rules for elongation (kashida / tatweel).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KashidaRules {
    #[serde(default = "yes")]
    pub enabled: bool,
    /// Longest elongation, in font units.
    #[serde(default = "default_max_length")]
    pub max_length: f32,
    /// Maximum elongations per word (0 = unlimited).
    #[serde(default = "default_max_per_word")]
    pub max_per_word: u32,
    /// Words (without diacritics) that are never elongated.
    #[serde(default)]
    pub exclude_words: Vec<String>,
    /// Never elongate right before these characters.
    #[serde(default)]
    pub never_before: Vec<String>,
    /// Never elongate right after these characters.
    #[serde(default)]
    pub never_after: Vec<String>,
}

impl Default for KashidaRules {
    fn default() -> Self {
        Self {
            enabled: true,
            max_length: default_max_length(),
            max_per_word: default_max_per_word(),
            exclude_words: Vec::new(),
            never_before: Vec::new(),
            never_after: Vec::new(),
        }
    }
}

fn yes() -> bool {
    true
}
fn default_max_length() -> f32 {
    1500.0
}
fn default_max_per_word() -> u32 {
    2
}

#[cfg(test)]
mod tests {
    use super::*;

    const MINIMAL: &str = r#"
        [style]
        id = "test"
        version = "1.0.0"
        name = { en = "Test" }

        [font]
        compiled = "dist/test.ttf"
    "#;

    #[test]
    fn minimal_manifest_gets_defaults() {
        let m = Manifest::from_toml(MINIMAL).unwrap();
        assert_eq!(m.shaping.script, "arab");
        assert_eq!(m.alternates.feature, "salt");
        assert!(m.kashida.enabled);
        assert_eq!(localized(&m.style.name, "ar"), "Test");
    }

    #[test]
    fn compiler_only_keys_are_ignored() {
        let text =
            format!("{MINIMAL}\n[alternates]\nfeature = \"salt\"\nedge_features = [\"rlig\"]\n");
        assert!(Manifest::from_toml(&text).is_ok());
    }

    #[test]
    fn rejects_bad_tag() {
        let text = format!("{MINIMAL}\n[alternates]\nfeature = \"alternates\"\n");
        assert!(Manifest::from_toml(&text).is_err());
    }
}
