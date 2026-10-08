//! A loaded style package: manifest + compiled font, ready to compose with.

use std::collections::BTreeSet;
use std::str::FromStr;

use harfrust::{Feature, Language, Script, Tag};
use serde::Serialize;

use crate::document::{Document, StyleRef};
use crate::error::{Error, Result};
use crate::font::FontData;
use crate::manifest::{Localized, Manifest};

pub struct Style {
    pub manifest: Manifest,
    pub font: FontData,
    script: Option<Script>,
    language: Option<Language>,
    base_features: Vec<Feature>,
    alternates_tag: Tag,
}

impl std::fmt::Debug for Style {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Style")
            .field("id", &self.manifest.style.id)
            .field("font", &self.font)
            .finish()
    }
}

fn parse_tag(s: &str) -> Result<Tag> {
    Tag::new_checked(s.as_bytes())
        .map_err(|_| Error::ManifestValue(format!("'{s}' is not a valid OpenType tag")))
}

impl Style {
    /// Load a style from the text of its `style.toml` and the bytes of its compiled font.
    pub fn load(manifest_toml: &str, font_bytes: Vec<u8>) -> Result<Self> {
        let manifest = Manifest::from_toml(manifest_toml)?;
        let alternates_tag = parse_tag(&manifest.alternates.feature)?;
        let font = FontData::new(font_bytes, alternates_tag)?;

        // "arab" (OpenType) and "Arab" (ISO 15924) are both accepted.
        let mut script_name = manifest.shaping.script.clone();
        if let Some(first) = script_name.get_mut(0..1) {
            first.make_ascii_uppercase();
        }
        let script = Script::from_str(&script_name).ok();
        let language = manifest
            .shaping
            .language
            .as_deref()
            .and_then(|l| Language::from_str(l).ok());

        let base_features = manifest
            .shaping
            .features
            .iter()
            .map(|f| {
                Feature::from_str(f)
                    .map_err(|_| Error::ManifestValue(format!("invalid feature '{f}'")))
            })
            .collect::<Result<Vec<_>>>()?;

        Ok(Self {
            manifest,
            font,
            script,
            language,
            base_features,
            alternates_tag,
        })
    }

    pub fn id(&self) -> &str {
        &self.manifest.style.id
    }

    pub fn style_ref(&self) -> StyleRef {
        StyleRef {
            id: self.manifest.style.id.clone(),
            version: self.manifest.style.version.clone(),
        }
    }

    /// A new document with this style's default options switched on.
    pub fn new_document(&self, text: &str) -> Document {
        let mut doc = Document::new(self.style_ref(), text);
        doc.options = self
            .manifest
            .options
            .iter()
            .filter(|o| o.default)
            .map(|o| o.tag.clone())
            .collect();
        doc
    }

    pub(crate) fn script(&self) -> Option<Script> {
        self.script
    }

    pub(crate) fn language(&self) -> Option<&Language> {
        self.language.as_ref()
    }

    pub(crate) fn alternates_tag(&self) -> Tag {
        self.alternates_tag
    }

    /// Whole-text features: manifest features + the options enabled in the document.
    pub(crate) fn global_features(&self, options: &BTreeSet<String>) -> Vec<Feature> {
        let mut features = self.base_features.clone();
        for opt in &self.manifest.options {
            if let Ok(tag) = parse_tag(&opt.tag) {
                let on = options.contains(&opt.tag);
                features.push(Feature::new(tag, on as u32, ..));
            }
        }
        features
    }

    /// Everything a UI needs to present the style.
    pub fn summary(&self) -> StyleSummary {
        let m = &self.manifest;
        let metrics = self.font.metrics();
        StyleSummary {
            id: m.style.id.clone(),
            version: m.style.version.clone(),
            name: m.style.name.clone(),
            description: m.style.description.clone(),
            license: m.style.license.clone(),
            credits: m.style.credits.clone(),
            upstream: m.style.upstream.clone(),
            units_per_em: self.font.units_per_em(),
            ascender: metrics.ascender,
            descender: metrics.descender,
            glyphs_with_alternates: self.font.glyphs_with_alternates(),
            // Without a declared measure, assume a 5-dot alef of 0.7 em.
            nuqta: m
                .metrics
                .map_or(self.font.units_per_em() as f32 * 0.14, |x| x.nuqta),
            alef_dots: m.metrics.map_or(5, |x| x.alef_dots),
            options: m
                .options
                .iter()
                .map(|o| OptionSummary {
                    tag: o.tag.clone(),
                    label: o.label.clone(),
                    default: o.default,
                })
                .collect(),
            kashida: KashidaSummary {
                enabled: m.kashida.enabled && self.font.tatweel().is_some(),
                max_length: m.kashida.max_length,
                max_per_word: m.kashida.max_per_word,
            },
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct StyleSummary {
    pub id: String,
    pub version: String,
    pub name: Localized,
    pub description: Localized,
    pub license: String,
    pub credits: String,
    pub upstream: Option<String>,
    pub units_per_em: u16,
    pub ascender: f32,
    pub descender: f32,
    pub glyphs_with_alternates: usize,
    /// One calligraphic dot, in font units.
    pub nuqta: f32,
    pub alef_dots: u32,
    pub options: Vec<OptionSummary>,
    pub kashida: KashidaSummary,
}

#[derive(Clone, Debug, Serialize)]
pub struct OptionSummary {
    pub tag: String,
    pub label: Localized,
    pub default: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct KashidaSummary {
    pub enabled: bool,
    pub max_length: f32,
    pub max_per_word: u32,
}
