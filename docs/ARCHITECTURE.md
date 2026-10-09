# Architecture

Midad is an Arabic calligraphy editor built around one idea: **the shaper is
the single source of truth**. A document never stores glyph positions. It
stores the text plus a short list of the calligrapher's decisions
(alternate shapes, offsets, kashida lengths), and every frame is recomputed
from those by a real OpenType shaper. That is what lets a document survive
text edits, style updates and different front-ends.

```
                ┌──────────────────────────── styles/<id>/ ───────────────────────────┐
                │ source/*.ttf ──► tools/midad_style (Python) ──► dist/*.ttf (+ salt) │
                │ style.toml  ─────────────────────────────────────────┐              │
                └──────────────────────────────────────────────────────┼──────────────┘
                                                                       ▼
 ┌──────────────────────── crates/midad-core (Rust) ─────────────────────────────────┐
 │  Style  = Manifest + FontData (harfrust shaper, skrifa outlines, alternates map) │
 │  Document (text + overrides) ──► compose() ──► Scene (positioned glyphs)          │
 │  Editor  = Document + History + validation   │   svg::scene_to_svg()              │
 └───────────────┬──────────────────────────────┴────────────────────────────────────┘
                 │                         │
    crates/midad-wasm (wasm-bindgen)   crates/midad-cli (clap)
                 │
     apps/web (React + Vite) ──────► apps/desktop (Tauri: same web app in a native window)
```

## Repository layout

| Path | What lives there |
|---|---|
| `crates/midad-core` | The engine. No I/O, no platform code; compiles to native and to WebAssembly. |
| `crates/midad-wasm` | `MidadEngine` / `MidadEditor` classes exported to JavaScript. |
| `crates/midad-cli` | `midad` command: render to SVG, inspect styles and alternates, dump scenes. |
| `apps/web` | The editor UI (React 19 + TypeScript + Vite). Runs the engine in WebAssembly. |
| `apps/desktop` | Tauri 2 shell around `apps/web` (native dialogs, file writes, installers). |
| `styles/` | Style packages: `style.toml`, the source font, the compiled font in `dist/`. |
| `tools/midad_style` | Python style compiler + font inspector (fontTools). |
| `scripts/` | `build-wasm.mjs`, `sync-styles.mjs` (copies styles into the web app), `smoke-wasm.mjs`. |
| `docs/` | This documentation. `docs/ar/` holds the Arabic guides. |

## The engine (`midad-core`)

### Modules

| Module | Responsibility |
|---|---|
| `manifest` | `style.toml` schema (serde). Unknown keys are ignored so the Python compiler can have its own. |
| `font` | `FontData`: shaping handle, metrics, GDEF mark classes, alternates table, outline cache. |
| `shape` | Thin wrapper over HarfRust. Owns the **cluster numbering** convention (below). |
| `kashida` | Calligraphic rules for elongation (`[kashida]` in the manifest). |
| `text` | Arabic helpers: marks, words, stripping diacritics. |
| `compose` | The pipeline: document + style → `Scene`. |
| `scene` | Output types (what renderers draw). |
| `document` | The document model, `.midad` serialisation, override remapping on text edits. |
| `history` | Undo/redo by snapshots; *gestures* group a drag into one step. |
| `editor` | The API every front-end uses: edits, validation, lazy recomposition, export. |
| `svg` | Standalone SVG export (plain paths, no font dependency). |
| `geometry` | `Rect`, `Affine` (SVG matrix order). |

### Libraries

* **HarfRust** (`harfrust`) — the official Rust port of HarfBuzz, maintained by
  the HarfBuzz project, pure Rust, compiles to WebAssembly without C.
* **Skrifa / read-fonts** (Google *fontations*) — outlines, metrics and table
  parsing. HarfRust is built on the same `read-fonts`, so the font bytes are
  parsed by one stack.
* `unicode-bidi` for mixed Arabic/Latin/digit lines, `serde` + `toml` +
  `serde_json` for data.

### Cluster numbering

The engine passes its own cluster values to the shaper:

* character *i* of the document → cluster `2·i`
* a tatweel inserted for a kashida after character *i* → cluster `2·i + 1`

Clusters stay monotonic (HarfBuzz requires it), and every output glyph is
traceable to a real character (even) or an elongation (odd). Never feed the
shaper byte offsets or reuse a cluster value; `shape.rs` is the only place
that builds buffers.

### Glyph keys

Overrides are addressed by `GlyphKey { cluster, index }`:
`cluster` = char index of the first character of the glyph's cluster,
`index` = position of the glyph inside that cluster in **logical** order
(0 = the base letter, then marks). For RTL runs the shaper returns glyphs in
visual order, so `assign_keys` walks them backwards.

### Composition pipeline (`compose.rs`)

For each line (split on `\n`), the line is split into directional runs with
the Unicode Bidirectional Algorithm (paragraph direction RTL). For each run:

1. **Plain shaping** — find where a kashida is possible. HarfBuzz marks
   glyphs with `SAFE_TO_INSERT_TATWEEL` when a tatweel can go before them
   without breaking the joins; the style rules (`kashida.rs`) then filter
   those positions.
2. **Insert tatweels** for the kashidas the document asks for (only at
   allowed positions, at most `max_per_word` per word).
3. **Pass A** — shape with global features. These are the *default* glyphs
   (what the shaper picks by itself), remembered per key.
4. **Alternates → features** — for every chosen alternate, find its position
   *N* in the default glyph's alternates list and enable the alternates
   feature (`salt`) with value *N* on that cluster only.
5. **Pass B** — reshape with those features (skipped when there are none).
6. **Pen positions** — accumulate advances; elongation glyphs are scaled
   horizontally to the requested length.

Then `finish()` aligns lines, applies user transforms (offset, scale and
rotation around the glyph centre; marks follow their base letter's offset)
and computes bounds and kashida handle positions.

**Why alternates go through the shaper.** Swapping glyph ids after shaping
would leave harakat, kerning and cursive attachment computed for the old
glyph. Selecting the alternate *inside* the shaper (a feature value on one
cluster, exactly like `salt=3` in CSS/HarfBuzz) keeps all GPOS positioning
correct for the glyph that is displayed.

**Shaping cost.** Each run is shaped two to three times. On the Basmala a
full composition takes ~70 µs natively and < 1 ms in WebAssembly, so the
editor simply recomposes on every edit.

### Coordinates

* Font units, **y up** (the font's own system). Renderers flip y once.
* The text block is anchored at its **right edge**: x = 0 is where the
  first line starts and the composition extends to negative x. Stretching a
  join pushes the end of the line leftwards and never moves its start —
  which is also why a kashida handle follows the pointer exactly.
* First baseline at y = 0, following lines below (negative y).
* `PlacedGlyph.transform` is the full glyph→scene matrix in SVG order
  `[a b c d e f]`.

### Errors and warnings

* Edits the style refuses return `Error::Rule(message)` (e.g. kashida in an
  excluded word). The UI shows them; the document is unchanged.
* Overrides that stop applying after a text edit are **not** errors: the
  composition succeeds and lists a `Warning` (`stale_alternate`,
  `kashida_not_allowed`, `kashida_limit`, `conflicting_alternates`).

## Style packages and the compiler

A style package is a folder with `style.toml`, the source font and the
compiled font (see [STYLE_FORMAT.md](STYLE_FORMAT.md)). The compiler adds a
GSUB **type 3 (alternate substitution)** lookup under the feature named in
`[alternates] feature` (`salt` by default). The engine then only needs
standard OpenType: any font that already ships alternates in a type-3
feature works without compilation.

For fonts like Amiri, whose variety lives in contextual rules rather than in
an alternates feature, the compiler derives the alternates:

1. Collect single / multiple / alternate substitutions reachable from the
   features in `edge_features` (including lookups called by contextual
   rules). Each `A → B` is an edge; connected components are *families*
   (every shape of one letter).
2. Split families by **joining signature** read from the outline: ink at the
   right edge (connects to the previous letter) and/or the left edge
   (connects to the next), inside the baseline band where the tatweel sits.
   An initial shape is never offered in place of a final one.
3. Write `alternates[g]` = the other members of g's (family, signature) group.

The compiled font is renamed (OFL), the build is deterministic, and
`build-info.json` records hashes so CI can detect a stale `dist/`.

## Front-ends

### Web (`apps/web`)

* `src/engine/engine.ts` — loads the wasm module and the styles listed in
  `public/styles/index.json`, keeps a per-style outline cache. Outlines are
  never sent with scenes; the UI asks only for glyph ids it has not seen.
* `src/engine/useMidad.ts` — the wasm `Editor` is the source of truth; React
  keeps a revision counter and re-reads `scene()`/`document()` after each
  edit. Autosaves the document to `localStorage`.
* `src/components/Sheet.tsx` — SVG drawing sheet: selection, letter drag
  (one undo step per drag), kashida handles, pan/zoom. Pointer positions are
  mapped to scene units through the flipped group's screen matrix.
* `src/components/Panel.tsx` — text, letter shapes, kashida, offset (in
  calligraphic **dots**), size, slant, style options, layout.
* `src/lib/platform.ts` — save/open through downloads on the web, native
  dialogs + Rust commands in the desktop app.
* `src/i18n.ts` — Arabic (reference) and English strings; the layout mirrors
  with `dir`.

Lengths shown to users are in **nuqat** (rhombic pen dots), the unit
calligraphers measure with; `[metrics] nuqta` in the manifest gives its size
in font units.

### Desktop (`apps/desktop`)

Tauri 2 loads the built web app. The engine still runs as WebAssembly in the
WebView, so web and desktop behave identically. The Rust side adds two
commands (`write_file`, `read_text_file`) used with the dialog plugin. The
CSP allows `wasm-unsafe-eval` and nothing remote.

## Invariants worth protecting

1. `midad-core` has no I/O and no platform dependencies.
2. Only `shape.rs` creates shaping buffers; only `compose.rs` decides glyph positions.
3. A `Document` never contains positions computed by the engine.
4. Every edit goes through `Editor`, which records history before mutating.
5. `apps/web/src/engine/types.ts` mirrors `scene.rs`, `document.rs` and
   `StyleSummary` — change them together.
6. `crates/midad-wasm` pins `wasm-bindgen` to the exact CLI version used in CI.
