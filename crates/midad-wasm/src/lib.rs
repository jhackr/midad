//! WebAssembly bindings for the web editor and the desktop shell.
//!
//! Two classes are exported to JavaScript:
//!
//! * `MidadEngine` — holds loaded styles, creates editors, serves outlines.
//! * `MidadEditor` — one open document (thin wrapper over `midad_core::Editor`).
//!
//! Data crosses the boundary as plain JS objects (`serde-wasm-bindgen`,
//! JSON-compatible mode). Their TypeScript shapes are declared by hand in
//! `apps/web/src/engine/types.ts`; keep the two in sync when changing
//! `midad_core::scene` or `midad_core::document`.

use std::collections::HashMap;
use std::sync::Arc;

use midad_core::{Align, Document, Editor, GlyphKey, Rect, Style, SvgOptions};
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

fn to_js<T: Serialize + ?Sized>(value: &T) -> Result<JsValue, JsError> {
    value
        .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        .map_err(|e| JsError::new(&e.to_string()))
}

fn js_err(e: impl std::fmt::Display) -> JsError {
    JsError::new(&e.to_string())
}

#[derive(Serialize)]
struct OutlineDto {
    gid: u16,
    path: String,
    bounds: Option<Rect>,
}

fn outlines(style: &Style, gids: &[u16]) -> Vec<OutlineDto> {
    gids.iter()
        .map(|&gid| {
            let o = style.font.outline(gid);
            OutlineDto {
                gid,
                path: o.path.clone(),
                bounds: o.bounds,
            }
        })
        .collect()
}

/// Registry of loaded styles.
#[wasm_bindgen]
#[derive(Default)]
pub struct MidadEngine {
    styles: HashMap<String, Arc<Style>>,
}

#[wasm_bindgen]
impl MidadEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }

    /// Engine version (Cargo package version).
    pub fn version() -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }

    /// Load a style from the text of its `style.toml` and its compiled font.
    /// Returns the style summary.
    #[wasm_bindgen(js_name = loadStyle)]
    pub fn load_style(&mut self, manifest: &str, font: Vec<u8>) -> Result<JsValue, JsError> {
        let style = Style::load(manifest, font).map_err(js_err)?;
        let summary = style.summary();
        self.styles.insert(style.id().to_string(), Arc::new(style));
        to_js(&summary)
    }

    #[wasm_bindgen(js_name = styleIds)]
    pub fn style_ids(&self) -> Vec<String> {
        let mut ids: Vec<String> = self.styles.keys().cloned().collect();
        ids.sort();
        ids
    }

    #[wasm_bindgen(js_name = styleSummary)]
    pub fn style_summary(&self, style_id: &str) -> Result<JsValue, JsError> {
        to_js(&self.style(style_id)?.summary())
    }

    #[wasm_bindgen(js_name = createEditor)]
    pub fn create_editor(&self, style_id: &str, text: &str) -> Result<MidadEditor, JsError> {
        Ok(MidadEditor {
            inner: Editor::new(self.style(style_id)?, text),
        })
    }

    /// Open a saved `.midad` document (its style must be loaded).
    #[wasm_bindgen(js_name = openDocument)]
    pub fn open_document(&self, json: &str) -> Result<MidadEditor, JsError> {
        let doc = Document::from_json(json).map_err(js_err)?;
        let style = self.style(&doc.style.id)?;
        Ok(MidadEditor {
            inner: Editor::open(style, doc).map_err(js_err)?,
        })
    }

    /// SVG path data (font units, y up) and bounds for each glyph id.
    #[wasm_bindgen(js_name = glyphOutlines)]
    pub fn glyph_outlines(&self, style_id: &str, gids: Vec<u16>) -> Result<JsValue, JsError> {
        let style = self.style(style_id)?;
        to_js(&outlines(&style, &gids))
    }
}

impl MidadEngine {
    fn style(&self, id: &str) -> Result<Arc<Style>, JsError> {
        self.styles
            .get(id)
            .cloned()
            .ok_or_else(|| JsError::new(&format!("style '{id}' is not loaded")))
    }
}

/// One open document.
#[wasm_bindgen]
pub struct MidadEditor {
    inner: Editor,
}

#[wasm_bindgen]
impl MidadEditor {
    #[wasm_bindgen(js_name = styleId)]
    pub fn style_id(&self) -> String {
        self.inner.style().id().to_string()
    }

    /// The composed scene (recomputed only after a change).
    pub fn scene(&mut self) -> Result<JsValue, JsError> {
        let scene = self.inner.scene().map_err(js_err)?;
        to_js(scene)
    }

    /// The document as a plain object (text, options, overrides, kashidas, layout).
    pub fn document(&self) -> Result<JsValue, JsError> {
        to_js(self.inner.document())
    }

    #[wasm_bindgen(js_name = toJson)]
    pub fn to_json(&self) -> String {
        self.inner.to_json()
    }

    pub fn outlines(&self, gids: Vec<u16>) -> Result<JsValue, JsError> {
        to_js(&outlines(self.inner.style(), &gids))
    }

    // ------------------------------------------------------------ editing

    #[wasm_bindgen(js_name = setText)]
    pub fn set_text(&mut self, text: &str) {
        self.inner.set_text(text);
    }

    pub fn alternates(&mut self, cluster: u32, index: u16) -> Result<JsValue, JsError> {
        let list = self
            .inner
            .alternates(GlyphKey::new(cluster, index))
            .map_err(js_err)?;
        to_js(&list)
    }

    #[wasm_bindgen(js_name = setAlternate)]
    pub fn set_alternate(
        &mut self,
        cluster: u32,
        index: u16,
        gid: Option<u16>,
    ) -> Result<(), JsError> {
        self.inner
            .set_alternate(GlyphKey::new(cluster, index), gid)
            .map_err(js_err)
    }

    #[wasm_bindgen(js_name = cycleAlternate)]
    pub fn cycle_alternate(&mut self, cluster: u32, index: u16, step: i32) -> Result<(), JsError> {
        self.inner
            .cycle_alternate(GlyphKey::new(cluster, index), step)
            .map_err(js_err)
    }

    #[wasm_bindgen(js_name = setOffset)]
    pub fn set_offset(&mut self, cluster: u32, index: u16, dx: f32, dy: f32) {
        self.inner.set_offset(GlyphKey::new(cluster, index), dx, dy);
    }

    #[wasm_bindgen(js_name = moveBy)]
    pub fn move_by(&mut self, cluster: u32, index: u16, ddx: f32, ddy: f32) {
        self.inner.move_by(GlyphKey::new(cluster, index), ddx, ddy);
    }

    #[wasm_bindgen(js_name = setScale)]
    pub fn set_scale(&mut self, cluster: u32, index: u16, scale: f32) {
        self.inner.set_scale(GlyphKey::new(cluster, index), scale);
    }

    #[wasm_bindgen(js_name = setRotation)]
    pub fn set_rotation(&mut self, cluster: u32, index: u16, degrees: f32) {
        self.inner
            .set_rotation(GlyphKey::new(cluster, index), degrees);
    }

    #[wasm_bindgen(js_name = resetGlyph)]
    pub fn reset_glyph(&mut self, cluster: u32, index: u16) {
        self.inner.reset_glyph(GlyphKey::new(cluster, index));
    }

    #[wasm_bindgen(js_name = resetAll)]
    pub fn reset_all(&mut self) {
        self.inner.reset_all();
    }

    /// `length` in font units; `undefined` removes the kashida.
    #[wasm_bindgen(js_name = setKashida)]
    pub fn set_kashida(&mut self, after: u32, length: Option<f32>) -> Result<(), JsError> {
        self.inner.set_kashida(after, length).map_err(js_err)
    }

    #[wasm_bindgen(js_name = setOption)]
    pub fn set_option(&mut self, tag: &str, enabled: bool) -> Result<(), JsError> {
        self.inner.set_option(tag, enabled).map_err(js_err)
    }

    /// `"right" | "center" | "left"`.
    #[wasm_bindgen(js_name = setAlign)]
    pub fn set_align(&mut self, align: &str) -> Result<(), JsError> {
        let align = match align {
            "right" => Align::Right,
            "center" => Align::Center,
            "left" => Align::Left,
            other => return Err(JsError::new(&format!("unknown alignment '{other}'"))),
        };
        self.inner.set_align(align);
        Ok(())
    }

    #[wasm_bindgen(js_name = setLineSpacing)]
    pub fn set_line_spacing(&mut self, spacing: f32) {
        self.inner.set_line_spacing(spacing);
    }

    // ------------------------------------------------------------ history

    #[wasm_bindgen(js_name = beginGesture)]
    pub fn begin_gesture(&mut self) {
        self.inner.begin_gesture();
    }

    #[wasm_bindgen(js_name = endGesture)]
    pub fn end_gesture(&mut self) {
        self.inner.end_gesture();
    }

    pub fn undo(&mut self) -> bool {
        self.inner.undo()
    }

    pub fn redo(&mut self) -> bool {
        self.inner.redo()
    }

    #[wasm_bindgen(js_name = canUndo)]
    pub fn can_undo(&self) -> bool {
        self.inner.can_undo()
    }

    #[wasm_bindgen(js_name = canRedo)]
    pub fn can_redo(&self) -> bool {
        self.inner.can_redo()
    }

    // ------------------------------------------------------------- export

    /// Standalone SVG. `options`: `{ padding?, fill?, background?, height?, title? }`.
    #[wasm_bindgen(js_name = exportSvg)]
    pub fn export_svg(&mut self, options: JsValue) -> Result<String, JsError> {
        let options: SvgOptions = if options.is_undefined() || options.is_null() {
            SvgOptions::default()
        } else {
            serde_wasm_bindgen::from_value(options).map_err(js_err)?
        };
        self.inner.export_svg(&options).map_err(js_err)
    }
}
