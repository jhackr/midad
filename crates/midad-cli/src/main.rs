//! `midad` — command-line access to the engine.
//!
//! ```text
//! midad info        --style styles/naskh-amiri
//! midad render      --style styles/naskh-amiri --text "بسم الله" -o out.svg
//! midad render      --style styles/naskh-amiri --doc work.midad -o out.svg
//! midad alternates  --style styles/naskh-amiri --text "بسم الله" --at 2
//! midad scene       --style styles/naskh-amiri --text "بسم الله"   # JSON scene
//! ```
//!
//! Useful for calligraphers checking a style package, for CI snapshot
//! tests, and for batch rendering on a server.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::Arc;

use clap::{Parser, Subcommand};
use midad_core::{Document, Editor, GlyphKey, Style, SvgOptions, manifest::localized};

#[derive(Parser)]
#[command(
    name = "midad",
    version,
    about = "Midad (مداد) — Arabic calligraphy engine"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(clap::Args)]
struct Source {
    /// Style package folder (contains style.toml).
    #[arg(long, short)]
    style: PathBuf,
    /// Text to compose.
    #[arg(long, short, conflicts_with = "doc")]
    text: Option<String>,
    /// A saved .midad document.
    #[arg(long, short)]
    doc: Option<PathBuf>,
}

#[derive(Subcommand)]
enum Command {
    /// Describe a style package.
    Info {
        #[arg(long, short)]
        style: PathBuf,
    },
    /// Render text or a document to SVG.
    Render {
        #[command(flatten)]
        source: Source,
        /// Output file (stdout when omitted).
        #[arg(long, short)]
        output: Option<PathBuf>,
        /// Output height in pixels.
        #[arg(long)]
        height: Option<f32>,
        #[arg(long, default_value = "#000000")]
        fill: String,
        #[arg(long)]
        background: Option<String>,
    },
    /// List the alternates available for the letter at char index `at`.
    Alternates {
        #[command(flatten)]
        source: Source,
        #[arg(long)]
        at: u32,
        #[arg(long, default_value_t = 0)]
        index: u16,
    },
    /// Print the composed scene as JSON.
    Scene {
        #[command(flatten)]
        source: Source,
    },
}

fn load_style(dir: &Path) -> Result<Arc<Style>, String> {
    let manifest_path = dir.join("style.toml");
    let manifest = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("cannot read {}: {e}", manifest_path.display()))?;
    let parsed = midad_core::Manifest::from_toml(&manifest).map_err(|e| e.to_string())?;
    let font_path = dir.join(&parsed.font.compiled);
    let font = fs::read(&font_path).map_err(|e| {
        format!(
            "cannot read {} ({e}). Did you run `python -m midad_style compile {}`?",
            font_path.display(),
            dir.display()
        )
    })?;
    Style::load(&manifest, font)
        .map(Arc::new)
        .map_err(|e| e.to_string())
}

fn open_editor(source: &Source) -> Result<Editor, String> {
    let style = load_style(&source.style)?;
    match (&source.text, &source.doc) {
        (Some(text), _) => Ok(Editor::new(style, text)),
        (None, Some(path)) => {
            let json = fs::read_to_string(path).map_err(|e| e.to_string())?;
            let doc = Document::from_json(&json).map_err(|e| e.to_string())?;
            Editor::open(style, doc).map_err(|e| e.to_string())
        }
        (None, None) => Err("give --text or --doc".into()),
    }
}

fn run(cli: Cli) -> Result<(), String> {
    match cli.command {
        Command::Info { style } => {
            let style = load_style(&style)?;
            let s = style.summary();
            println!("{} ({}) v{}", localized(&s.name, "en"), s.id, s.version);
            println!("  {}", localized(&s.name, "ar"));
            println!("  license: {}   credits: {}", s.license, s.credits);
            println!(
                "  unitsPerEm {}  ascender {}  descender {}",
                s.units_per_em, s.ascender, s.descender
            );
            println!("  glyphs with alternates: {}", s.glyphs_with_alternates);
            println!(
                "  kashida: {} (max {} units, {} per word)",
                if s.kashida.enabled { "on" } else { "off" },
                s.kashida.max_length,
                s.kashida.max_per_word
            );
            for o in &s.options {
                println!("  option {} — {}", o.tag, localized(&o.label, "en"));
            }
        }
        Command::Render {
            source,
            output,
            height,
            fill,
            background,
        } => {
            let mut editor = open_editor(&source)?;
            let options = SvgOptions {
                height,
                fill,
                background,
                ..Default::default()
            };
            for w in &editor.scene().map_err(|e| e.to_string())?.warnings {
                eprintln!("warning at {}: {}", w.at, w.message);
            }
            let svg = editor.export_svg(&options).map_err(|e| e.to_string())?;
            match output {
                Some(path) => fs::write(&path, svg).map_err(|e| e.to_string())?,
                None => print!("{svg}"),
            }
        }
        Command::Alternates { source, at, index } => {
            let mut editor = open_editor(&source)?;
            let key = GlyphKey::new(at, index);
            let choices = editor.alternates(key).map_err(|e| e.to_string())?;
            if choices.is_empty() {
                println!("no glyph at char {at} (index {index})");
            }
            for c in choices {
                println!(
                    "gid {:5} {}{}",
                    c.gid,
                    if c.is_default { "default " } else { "" },
                    if c.is_current { "current" } else { "" }
                );
            }
        }
        Command::Scene { source } => {
            let mut editor = open_editor(&source)?;
            let scene = editor.scene().map_err(|e| e.to_string())?;
            println!(
                "{}",
                serde_json::to_string_pretty(scene).map_err(|e| e.to_string())?
            );
        }
    }
    Ok(())
}

fn main() -> ExitCode {
    match run(Cli::parse()) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}
