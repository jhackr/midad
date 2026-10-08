//! Export a scene as a standalone SVG file (vector, editable in Illustrator,
//! Inkscape, Figma…). Glyphs are written as plain `<path>` elements so the
//! file does not depend on the font.

use std::fmt::Write;

use serde::Deserialize;

use crate::font::FontData;
use crate::scene::Scene;

#[derive(Clone, Debug, Deserialize)]
#[serde(default)]
pub struct SvgOptions {
    /// Margin around the artwork, in font units.
    pub padding: f32,
    /// Fill colour of the letters.
    pub fill: String,
    /// Background colour; `None` = transparent.
    pub background: Option<String>,
    /// Output height in px (width follows the aspect ratio). `None` = font units.
    pub height: Option<f32>,
    pub title: Option<String>,
}

impl Default for SvgOptions {
    fn default() -> Self {
        Self {
            padding: 120.0,
            fill: "#000000".into(),
            background: None,
            height: None,
            title: None,
        }
    }
}

fn num(v: f32) -> String {
    let r = (v * 1000.0).round() / 1000.0;
    if r == r.trunc() {
        format!("{}", r as i64)
    } else {
        format!("{r}")
    }
}

fn escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

pub fn scene_to_svg(scene: &Scene, font: &FontData, opts: &SvgOptions) -> String {
    let b = scene.bounds;
    let pad = opts.padding.max(0.0);
    // Scene is y-up; SVG is y-down. Flip with scale(1 -1) and use a viewBox
    // expressed in the flipped space.
    let vx = b.x0 - pad;
    let vy = -(b.y1 + pad);
    let vw = b.width() + 2.0 * pad;
    let vh = b.height() + 2.0 * pad;
    let (w, h) = match opts.height {
        Some(h) if h > 0.0 => (vw * h / vh, h),
        _ => (vw, vh),
    };

    let mut out = String::new();
    let _ = write!(
        out,
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{} {} {} {}" width="{}" height="{}">"#,
        num(vx),
        num(vy),
        num(vw),
        num(vh),
        num(w),
        num(h)
    );
    if let Some(title) = &opts.title {
        let _ = write!(out, "<title>{}</title>", escape(title));
    }
    if let Some(bg) = &opts.background {
        let _ = write!(
            out,
            r#"<rect x="{}" y="{}" width="{}" height="{}" fill="{}"/>"#,
            num(vx),
            num(vy),
            num(vw),
            num(vh),
            escape(bg)
        );
    }
    let _ = write!(
        out,
        r#"<g fill="{}" transform="scale(1 -1)">"#,
        escape(&opts.fill)
    );
    for g in &scene.glyphs {
        let outline = font.outline(g.gid);
        if outline.path.is_empty() {
            continue;
        }
        let [a, bb, c, d, e, f] = g.transform.0;
        let _ = write!(
            out,
            r#"<path transform="matrix({} {} {} {} {} {})" d="{}"/>"#,
            num(a),
            num(bb),
            num(c),
            num(d),
            num(e),
            num(f),
            outline.path
        );
    }
    out.push_str("</g></svg>\n");
    out
}
