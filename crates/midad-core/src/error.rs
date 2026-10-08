use thiserror::Error;

/// Everything that can go wrong inside the engine.
#[derive(Debug, Error)]
pub enum Error {
    #[error("invalid style manifest: {0}")]
    Manifest(#[from] toml::de::Error),

    #[error("invalid style manifest: {0}")]
    ManifestValue(String),

    #[error("the font data could not be parsed")]
    InvalidFont,

    #[error("shaping failed: {0}")]
    Shaping(String),

    #[error("unknown style '{0}'")]
    UnknownStyle(String),

    #[error("invalid document: {0}")]
    Document(#[from] serde_json::Error),

    #[error("document format {found} is newer than this engine supports ({supported})")]
    UnsupportedFormat { found: u32, supported: u32 },

    #[error("document was written for style '{expected}', not '{found}'")]
    StyleMismatch { expected: String, found: String },

    /// A calligraphic rule of the style refused the edit (e.g. kashida position).
    #[error("{0}")]
    Rule(String),
}

pub type Result<T> = std::result::Result<T, Error>;
