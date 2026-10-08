# Roadmap

Each milestone ends with something a calligrapher can use. Items are sized
to become GitHub issues; the labels in brackets suggest who picks them up:
**[engine]** Rust, **[web]** front-end, **[type]** fonts/Python,
**[ops]** CI/release, **[design]** UX.

## M0 — Foundation ✅ (this hand-over)

* Engine: shaping (HarfRust), bidi, alternates through the shaper, kashida
  with style rules, per-glyph offset/scale/rotation, multi-line, alignment,
  undo/redo with gestures, `.midad` JSON, SVG export.
* Style compiler deriving alternates for Amiri; `naskh-amiri` package.
* Web editor (Arabic/English), WebAssembly build, CLI.
* Tauri shell, CI, GitHub Pages deploy, desktop release workflow.

## M1 — A dependable editor (≈ 4–6 weeks)

* [type] Curate Amiri alternates: review every letter, `exclude` shapes that
  break out of context; add a `midad specimen` sheet (all letters × shapes)
  to make the review fast. **Highest-impact item for users.**
* [engine] Structured error codes instead of English strings (`Error::Rule`
  → `{ code, params }`) so the UI translates every message.
* [engine][web] Select several letters (a word, a range) and move/scale them together.
* [web] Edit marks (harakat) explicitly: toggle "marks follow letter", pick and nudge a mark.
* [web] Copy SVG to clipboard; PDF export (vector) via `svg2pdf` in Rust or the browser print path.
* [web] Starter phrases (بسملة، أسماء، تهاني) and an empty-state that invites typing.
* [web] Accessibility pass: keyboard-only flow, screen-reader labels for letters, contrast check.
* [ops] Playwright end-to-end tests; SVG snapshot tests for reference phrases.
* [ops] `wasm-opt` in CI and a size budget (today 1.8 MB / 620 KB gzip).

## M2 — Desktop and files (≈ 3–4 weeks)

* [ops] Signed installers (Windows code signing, macOS notarisation), auto-update (`tauri-plugin-updater`).
* [engine] File association for `.midad`; recent files; autosave to disk in the desktop app.
* [engine] Native batch export from the desktop (call `midad-core` directly through Tauri commands).
* [web] Export presets: transparent PNG at 1×/2×/4×, SVG with outlines merged per word.

## M3 — Real calligraphy (≈ 8–12 weeks, research-heavy)

* [engine] **Curved kashida.** Today an elongation is a horizontally scaled
  tatweel. Calligraphic madd is a curve whose thickness follows the pen.
  Options: (a) parametric kashida glyph drawn by the engine between the
  exit/entry anchors of the two letters; (b) a variable-font axis for
  elongated letter forms. Prototype both on Naskh.
* [engine][type] **Stacking (تركيب).** Rules that place letter groups above
  each other (essential for Thuluth and Diwani): anchor-based placement
  described in `style.toml` (`[[stacking]] sequence = "لم" …`), applied after
  shaping; manual offsets stay possible on top.
* [type] Second style: **Ruqaa** (Aref Ruqaa, OFL) to validate that the compiler and rules generalise.
* [type] Build styles from **named sources** (UFO / Glyphs) so documents can
  reference glyph names → `.midad` format 2 with a migration.
* [engine] Per-letter size rules (e.g. larger final forms) as style data.

## M4 — Calligraphers as contributors

* [type][design] Authoring guide with video for calligraphers (drawing →
  UFO → pull request), in Arabic first.
* [type] First original style drawn by a calligrapher for Midad (OFL).
* [web] Style gallery inside the editor with credits per style.

## M5 — Reach

* [engine] Publish `midad-core` on crates.io and `@midad/engine` (wasm) on npm.
* [web] Figma plugin built on the same wasm engine.
* [design] Templates (names, greetings, logos) as `.midad` files.
* Optional hosted service (accounts, cloud documents, sharing) in a separate
  repository; the editor stays fully usable offline and without an account.

## Known limitations (today)

| Limitation | Where it is tracked |
|---|---|
| Some Amiri alternates are contextual forms that look wrong in other contexts | M1 curation |
| Kashida is a straight, scaled tatweel (Amiri's own curved kashida appears only in some contexts) | M3 curved kashida |
| No automatic stacking; vertical arrangements are manual offsets | M3 stacking |
| One chosen alternate per cluster (ligature) | M3 |
| Alternates stored by glyph id | M3 named sources / format 2 |
| Paragraph direction is always RTL | fine for Arabic; revisit if Latin-only pieces matter |
| Desktop shell not yet built on a real machine by the team | first task of M2 |
