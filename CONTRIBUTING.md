# Contributing to Midad

Thank you for helping. Midad welcomes two kinds of contributors:

* **Developers** — engine (Rust), editor (TypeScript/React), tooling (Python, CI).
* **Calligraphers and type designers** — letter shapes, styles, rules.
  Start with the Arabic guide: [docs/ar/CALLIGRAPHERS.md](docs/ar/CALLIGRAPHERS.md).

## Before you start

1. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (15 minutes) and set up
   your machine with [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
2. For anything larger than a bug fix, open an issue first so the design can
   be agreed before code is written.

## Workflow

* Branch from `main`: `feat/kashida-curves`, `fix/stale-alternate`, `style/ruqaa`.
* Small pull requests (under ~400 changed lines when possible), one topic each.
* Commit messages follow [Conventional Commits](https://www.conventionalcommits.org):
  `feat(engine): …`, `fix(web): …`, `docs: …`, `style(naskh-amiri): …`, `ci: …`.
* Every PR must pass CI: `cargo fmt`, `clippy -D warnings`, tests, the wasm
  smoke test, typecheck, and `midad_style check`.
* Rendering changes need a before/after screenshot or SVG in the PR.
* One approving review is required; changes to `compose.rs`, `document.rs`
  or the file format need a review from an engine maintainer.

## Code guidelines

**Rust**: keep `midad-core` free of I/O and platform code. Prefer small pure
functions with unit tests; add an integration test in
`crates/midad-core/tests/` for behaviour the editor relies on. Document
public items. No `unwrap()` on data that comes from a document or a font.

**TypeScript**: the wasm editor is the source of truth — do not duplicate
document state in React. Keep `src/engine/types.ts` in sync with the Rust
structs. Every UI string goes through `src/i18n.ts` in both languages.

**Python**: the compiler must stay deterministic (CI compares hashes).

## Licensing of contributions

Code is dual-licensed **MIT OR Apache-2.0**. By submitting a pull request you
agree that your contribution is licensed under the same terms
("inbound = outbound"); no CLA is required. Fonts and drawings are accepted
only under the **SIL Open Font License 1.1**.

## Conduct

Be kind and specific. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
