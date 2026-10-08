//! Integration tests against the real `styles/naskh-amiri` package.
//!
//! These lock down the behaviour the editor relies on. If a test fails after
//! recompiling the style, check `build-info.json` first: the alternates
//! table may simply have changed.

use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

use midad_core::{
    Align, Document, Editor, Error, GlyphKey, Style, SvgOptions, WarningKind, compose,
};

const BASMALA: &str = "بسم الله الرحمن الرحيم";
// chars: ب0 س1 م2 ␠3 ا4 ل5 ل6 ه7 ␠8 ا9 ل10 ر11 ح12 م13 ن14 ␠15 ا16 ل17 ر18 ح19 ي20 م21

fn style() -> Arc<Style> {
    static STYLE: OnceLock<Arc<Style>> = OnceLock::new();
    STYLE
        .get_or_init(|| {
            let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../styles/naskh-amiri");
            let manifest = std::fs::read_to_string(dir.join("style.toml")).unwrap();
            let font = std::fs::read(dir.join("dist/MidadNaskh-Regular.ttf")).expect(
                "compile the style first: python -m midad_style compile styles/naskh-amiri",
            );
            Arc::new(Style::load(&manifest, font).unwrap())
        })
        .clone()
}

fn editor(text: &str) -> Editor {
    Editor::new(style(), text)
}

#[test]
fn style_loads_with_alternates() {
    let s = style();
    assert_eq!(s.id(), "naskh-amiri");
    assert!(s.font.glyphs_with_alternates() > 1000);
    assert!(s.font.tatweel().is_some());
    assert_eq!(s.summary().options.len(), 5);
}

#[test]
fn basmala_composes_right_to_left() {
    let mut e = editor(BASMALA);
    let scene = e.scene().unwrap();
    assert_eq!(scene.lines.len(), 1);
    assert!(scene.warnings.is_empty());
    assert!(scene.bounds.width() > 3000.0);

    // Every glyph key is unique.
    let mut keys: Vec<_> = scene.glyphs.iter().filter_map(|g| g.key).collect();
    let n = keys.len();
    keys.sort();
    keys.dedup();
    assert_eq!(keys.len(), n);

    // RTL: the first letter (ب, cluster 0) is drawn right of the last (م, 21).
    let x = |c: u32| {
        scene
            .glyphs
            .iter()
            .find(|g| g.key == Some(GlyphKey::new(c, 0)))
            .unwrap()
            .origin[0]
    };
    assert!(x(0) > x(21));
}

#[test]
fn choosing_an_alternate_changes_only_that_letter() {
    let mut e = editor(BASMALA);
    let meem = GlyphKey::new(2, 0);
    let before: Vec<u16> = e.scene().unwrap().glyphs.iter().map(|g| g.gid).collect();
    let choices = e.alternates(meem).unwrap();
    assert!(choices.len() > 2, "final meem has several shapes");
    assert!(choices[0].is_default && choices[0].is_current);

    let target = choices[1].gid;
    e.set_alternate(meem, Some(target)).unwrap();
    let comp = e.composition().unwrap();
    assert_eq!(comp.current_glyph(meem), Some(target));
    let after: Vec<u16> = comp.scene.glyphs.iter().map(|g| g.gid).collect();
    let changed = before.iter().zip(&after).filter(|(a, b)| a != b).count();
    assert_eq!(changed, 1);
}

#[test]
fn cycling_wraps_around_to_default() {
    let mut e = editor(BASMALA);
    let meem = GlyphKey::new(2, 0);
    let count = e.alternates(meem).unwrap().len();
    for _ in 0..count {
        e.cycle_alternate(meem, 1).unwrap();
    }
    assert!(
        e.document().glyphs.is_empty(),
        "back to default leaves no override"
    );
}

#[test]
fn foreign_glyph_is_rejected_as_alternate() {
    let mut e = editor(BASMALA);
    let err = e.set_alternate(GlyphKey::new(2, 0), Some(3)).unwrap_err();
    assert!(matches!(err, Error::Rule(_)));
}

#[test]
fn kashida_stretches_the_line() {
    let mut e = editor(BASMALA);
    let width = e.scene().unwrap().lines[0].width;
    e.set_kashida(0, Some(800.0)).unwrap();
    let scene = e.scene().unwrap();
    // The neighbours may switch to their "before tatweel" shapes, so the line
    // grows by roughly — not exactly — the kashida length.
    let grown = scene.lines[0].width - width;
    assert!((grown - 800.0).abs() < 150.0, "line grew by {grown}");
    let slot = scene.kashida_slots.iter().find(|s| s.after == 0).unwrap();
    assert!((slot.length - 800.0).abs() < 1.0);
    assert!(scene.glyphs.iter().any(|g| g.kashida == Some(0)));
}

#[test]
fn kashida_respects_style_rules() {
    let mut e = editor(BASMALA);
    // Inside "الله" (excluded word).
    assert!(e.set_kashida(5, Some(300.0)).is_err());
    // After a non-joining letter (ر in الرحمن does not join forward).
    assert!(e.set_kashida(11, Some(300.0)).is_err());
    // Across a space.
    assert!(e.set_kashida(2, Some(300.0)).is_err());
    // At most two per word.
    e.set_kashida(17, Some(300.0)).unwrap();
    e.set_kashida(19, Some(300.0)).unwrap();
    assert!(e.set_kashida(20, Some(300.0)).is_err());
}

#[test]
fn edits_survive_typing_elsewhere() {
    let mut e = editor(BASMALA);
    let meem = GlyphKey::new(2, 0);
    let target = e.alternates(meem).unwrap()[1].gid;
    e.set_alternate(meem, Some(target)).unwrap();
    e.set_kashida(0, Some(500.0)).unwrap();

    e.set_text(&format!("{BASMALA} الكريم"));
    let comp = e.composition().unwrap();
    assert_eq!(comp.current_glyph(meem), Some(target));
    assert!(comp.scene.glyphs.iter().any(|g| g.kashida == Some(0)));
    assert!(comp.scene.warnings.is_empty());
}

#[test]
fn stale_alternate_is_reported_not_fatal() {
    let mut e = editor("بسم");
    let meem = GlyphKey::new(2, 0);
    let target = e.alternates(meem).unwrap()[1].gid;
    e.set_alternate(meem, Some(target)).unwrap();
    // The final meem becomes medial: its old alternate no longer fits.
    e.set_text("بسمك");
    let scene = e.scene().unwrap();
    assert!(
        scene
            .warnings
            .iter()
            .any(|w| w.kind == WarningKind::StaleAlternate)
    );
}

#[test]
fn undo_and_redo() {
    let mut e = editor(BASMALA);
    e.set_kashida(0, Some(400.0)).unwrap();
    e.set_offset(GlyphKey::new(7, 0), 10.0, 50.0);
    assert!(e.undo());
    assert!(e.document().glyphs.is_empty());
    assert!(e.undo());
    assert!(e.document().kashidas.is_empty());
    assert!(!e.undo());
    assert!(e.redo());
    assert_eq!(e.document().kashidas.get(&0), Some(&400.0));
}

#[test]
fn drag_gesture_is_one_undo_step() {
    let mut e = editor(BASMALA);
    let key = GlyphKey::new(0, 0);
    e.begin_gesture();
    for i in 1..=20 {
        e.set_offset(key, i as f32 * 5.0, 0.0);
    }
    e.end_gesture();
    assert_eq!(e.document().glyphs[&key].dx, 100.0);
    e.undo();
    assert!(e.document().glyphs.is_empty());
}

#[test]
fn moving_a_letter_moves_its_harakat() {
    let mut e = editor("بَ");
    let base_mark = |e: &mut Editor| {
        let s = e.scene().unwrap();
        let b = s.glyphs.iter().find(|g| !g.is_mark).unwrap().transform.0[5];
        let m = s.glyphs.iter().find(|g| g.is_mark).unwrap().transform.0[5];
        (b, m)
    };
    let (b0, m0) = base_mark(&mut e);
    e.set_offset(GlyphKey::new(0, 0), 0.0, 100.0);
    let (b1, m1) = base_mark(&mut e);
    assert_eq!(b1 - b0, 100.0);
    assert_eq!(m1 - m0, 100.0);
}

#[test]
fn options_change_shaping() {
    // ss07 switches Amiri's curvilinear kashida off.
    let mut e = editor("فــي");
    let curved: Vec<u16> = e.scene().unwrap().glyphs.iter().map(|g| g.gid).collect();
    e.set_option("ss07", true).unwrap();
    let straight: Vec<u16> = e.scene().unwrap().glyphs.iter().map(|g| g.gid).collect();
    assert_ne!(curved, straight);
    assert!(e.set_option("xxxx", true).is_err());
}

#[test]
fn multiline_and_alignment() {
    let mut e = editor("خط النسخ\nسنة 2026 م");
    e.set_align(Align::Center);
    let s = e.scene().unwrap();
    assert_eq!(s.lines.len(), 2);
    assert!(s.lines[1].baseline < s.lines[0].baseline);
    let line_of = |c: u32| s.glyphs.iter().find(|g| g.span[0] == c).unwrap().line;
    assert_eq!(line_of(0), 0);
    assert_eq!(line_of(9), 1);
}

#[test]
fn digits_keep_left_to_right_order() {
    let mut e = editor("سنة 2026");
    let s = e.scene().unwrap();
    let x = |c: u32| s.glyphs.iter().find(|g| g.span[0] == c).unwrap().origin[0];
    // "2026" occupies chars 4..8 and reads left to right.
    assert!(x(4) < x(5) && x(5) < x(6) && x(6) < x(7));
}

#[test]
fn document_roundtrip_through_json() {
    let mut e = editor(BASMALA);
    e.set_kashida(0, Some(450.0)).unwrap();
    e.cycle_alternate(GlyphKey::new(2, 0), 1).unwrap();
    e.set_scale(GlyphKey::new(7, 0), 1.25);
    let json = e.to_json();

    let doc = Document::from_json(&json).unwrap();
    let mut reopened = Editor::open(style(), doc).unwrap();
    let a = compose(&style(), e.document()).unwrap();
    let b = reopened.composition().unwrap();
    let gids = |s: &midad_core::Scene| {
        s.glyphs
            .iter()
            .map(|g| (g.gid, g.transform))
            .collect::<Vec<_>>()
    };
    assert_eq!(gids(&a.scene), gids(&b.scene));
}

#[test]
fn svg_export_is_self_contained() {
    let mut e = editor(BASMALA);
    let svg = e
        .export_svg(&SvgOptions {
            background: Some("#fff".into()),
            title: Some("بسملة <test>".into()),
            ..Default::default()
        })
        .unwrap();
    assert!(svg.starts_with("<svg"));
    assert!(svg.matches("<path").count() >= 18);
    assert!(svg.contains("&lt;test&gt;"));
    assert!(!svg.contains("<text"), "no dependency on installed fonts");
}

#[test]
fn empty_text_is_fine() {
    let mut e = editor("");
    let s = e.scene().unwrap();
    assert!(s.glyphs.is_empty());
    assert!(s.bounds.height() > 0.0);
}
