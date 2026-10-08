# Changelog

All notable changes are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com) and versions follow
[Semantic Versioning](https://semver.org).

## [Unreleased]

## [0.1.0] — 2026-10-08

First public foundation.

### Added
- `midad-core` engine: HarfRust shaping with bidi runs, alternates applied
  inside the shaper, kashida with style rules, per-letter offset / scale /
  rotation, multi-line layout and alignment, undo/redo with gestures,
  `.midad` documents (format 1), SVG export.
- `midad-wasm` bindings and the web editor (Arabic and English UI): letter
  shapes picker, kashida handles, dot ladder, pan/zoom, autosave, SVG/PNG export.
- `midad` CLI: `info`, `render`, `alternates`, `scene`.
- Style compiler (`tools/midad_style`) and the `naskh-amiri` style.
- Tauri desktop shell, CI, GitHub Pages deployment, desktop release workflow.
