#!/usr/bin/env node
// Build the WebAssembly engine and its JS bindings into apps/web/src/engine/pkg.
// Plain Node (no bash) so `npm run build:wasm` behaves the same on Windows,
// macOS, Linux and CI.
//
// Requirements:
//   rustup target add wasm32-unknown-unknown       (rust-toolchain.toml does it)
//   cargo install wasm-bindgen-cli --version <same as crates/midad-wasm/Cargo.toml>
//   optional: wasm-opt (binaryen) for a ~20% smaller file

import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join('apps', 'web', 'src', 'engine', 'pkg');
const profile = process.env.PROFILE || 'wasm';

// Run a command from the repo root with its output streamed; stop on failure.
function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') {
    console.error(`✖ ${cmd} not found on PATH (see the requirements at the top of scripts/build-wasm.mjs)`);
    process.exit(1);
  }
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function has(cmd) {
  return !spawnSync(cmd, ['--version'], { stdio: 'ignore' }).error;
}

run('cargo', ['build', '-p', 'midad-wasm', '--target', 'wasm32-unknown-unknown', '--profile', profile]);
run('wasm-bindgen', [
  join('target', 'wasm32-unknown-unknown', profile, 'midad_wasm.wasm'),
  '--out-dir', out, '--target', 'web', '--typescript',
]);

const wasm = join(out, 'midad_wasm_bg.wasm');
if (has('wasm-opt')) {
  run('wasm-opt', ['-Os', '--enable-bulk-memory', '--enable-nontrapping-float-to-int', wasm, '-o', wasm]);
}

const { size } = statSync(join(root, wasm));
console.log(`wasm: ${wasm} (${(size / 1024 / 1024).toFixed(1)} MB)`);
