#!/usr/bin/env bash
# Build the WebAssembly engine and its JS bindings into apps/web/src/engine/pkg.
#
# Requirements:
#   rustup target add wasm32-unknown-unknown       (rust-toolchain.toml does it)
#   cargo install wasm-bindgen-cli --version <same as crates/midad-wasm/Cargo.toml>
#   optional: wasm-opt (binaryen) for a ~20% smaller file
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=apps/web/src/engine/pkg
PROFILE=${PROFILE:-wasm}

cargo build -p midad-wasm --target wasm32-unknown-unknown --profile "$PROFILE"
wasm-bindgen "target/wasm32-unknown-unknown/$PROFILE/midad_wasm.wasm" \
  --out-dir "$OUT" --target web --typescript

if command -v wasm-opt >/dev/null 2>&1; then
  wasm-opt -Os --enable-bulk-memory --enable-nontrapping-float-to-int \
    "$OUT/midad_wasm_bg.wasm" -o "$OUT/midad_wasm_bg.wasm"
fi

ls -lh "$OUT"/*.wasm
