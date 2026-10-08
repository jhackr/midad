# Development guide

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Rust | stable ≥ 1.85 (`rust-toolchain.toml` pins `stable` + the wasm target) | engine, CLI, desktop |
| `wasm-bindgen-cli` | **exactly** the `wasm-bindgen` version in `crates/midad-wasm/Cargo.toml` (0.2.129) | JS bindings |
| Node.js | ≥ 20 (CI uses 22) | web app |
| Python | ≥ 3.11 | style compiler (only when changing styles) |
| `wasm-opt` (binaryen) | optional | ~20 % smaller wasm |
| Tauri prerequisites | see tauri.app/start/prerequisites | desktop app only |

```bash
cargo install wasm-bindgen-cli --version 0.2.129 --locked
npm ci
pip install -e "tools[test]"     # optional
```

## Everyday commands

```bash
npm run build:wasm        # Rust → apps/web/src/engine/pkg (rerun after engine changes)
npm run dev               # web editor on http://localhost:5173 (syncs styles first)
npm run desktop:dev       # same editor in the Tauri window

cargo test --workspace    # engine unit + integration tests
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all
npm run typecheck && npm test
node scripts/smoke-wasm.mjs           # the built wasm, end to end, in Node
pytest tools/tests                    # style compiler
python -m midad_style check styles/*  # committed fonts up to date?
```

CLI for quick checks:

```bash
cargo run -p midad-cli -- render -s styles/naskh-amiri -t "بسم الله الرحمن الرحيم" -o /tmp/b.svg --height 300
cargo run -p midad-cli -- scene  -s styles/naskh-amiri -t "بسم" | less
```

## Where to make a change

| I want to… | Touch |
|---|---|
| change how text is laid out | `crates/midad-core/src/compose.rs` (+ test in `tests/naskh_amiri.rs`) |
| add an edit operation | `document.rs` (data) → `editor.rs` (method + validation) → `midad-wasm/src/lib.rs` → `apps/web/src/engine/engine.ts` → UI |
| change what the UI receives | `scene.rs` **and** `apps/web/src/engine/types.ts` |
| add a calligraphic rule | `manifest.rs` (schema) → `kashida.rs` or `compose.rs` → `docs/STYLE_FORMAT.md` |
| change alternates derivation | `tools/midad_style/gsub_graph.py` → recompile styles → `pytest tools/tests` |
| add UI text | `apps/web/src/i18n.ts` (both languages) |

## Testing strategy

* **Unit tests** next to the code (`#[cfg(test)]`) for pure logic: geometry,
  document remapping, history, kashida rules, manifest parsing, bidi runs.
* **Integration tests** (`crates/midad-core/tests/naskh_amiri.rs`) against the
  real style: these pin the behaviour the editor depends on (alternates
  change exactly one glyph, kashida stretches the line, rules refuse, undo,
  JSON round trip, digits stay LTR…).
* **Wasm smoke test** (`scripts/smoke-wasm.mjs`) catches serialisation issues
  at the JS boundary (e.g. map keys) that Rust tests cannot see.
* **Web unit tests** (Vitest) for viewport/units helpers.
* Planned: Playwright end-to-end tests of the editor and SVG snapshot tests
  of reference phrases (see ROADMAP).

## Releasing

1. Update `CHANGELOG.md`, bump versions (`Cargo.toml` workspace,
   `apps/*/package.json`, `apps/desktop/src-tauri/tauri.conf.json`).
2. Tag `vX.Y.Z` and push the tag. `desktop.yml` builds installers for
   Windows, macOS (Intel + Apple silicon) and Linux into a **draft** release.
3. Code signing (Windows) and notarisation (macOS) need secrets — see the
   Tauri docs; until configured, installers are unsigned.
4. `main` is deployed to GitHub Pages automatically (`pages.yml`). Enable
   Pages → "GitHub Actions" in the repository settings once.

## Troubleshooting

* **`it looks like the Rust project used to create this wasm file was linked against version X of wasm-bindgen`** —
  the CLI version differs from the crate. Install the exact version.
* **Blank editor, "The engine could not start"** — `apps/web/src/engine/pkg`
  is missing: run `npm run build:wasm`.
* **`compile the style first`** in tests — `styles/*/dist` is missing or was
  deleted: `python -m midad_style compile styles/naskh-amiri`.
* **Desktop build fails on Linux** — install `libwebkit2gtk-4.1-dev
  librsvg2-dev libappindicator3-dev patchelf`.
