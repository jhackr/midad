#!/usr/bin/env node
// Smoke test of the built WebAssembly engine, run in Node by CI after
// `npm run build:wasm`. It exercises the same calls the web editor makes.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = join(root, 'apps/web/src/engine/pkg');
const wasm = await import(pathToFileURL(join(pkg, 'midad_wasm.js')).href);
wasm.initSync({ module: readFileSync(join(pkg, 'midad_wasm_bg.wasm')) });

const engine = new wasm.MidadEngine();
const style = engine.loadStyle(
  readFileSync(join(root, 'styles/naskh-amiri/style.toml'), 'utf8'),
  readFileSync(join(root, 'styles/naskh-amiri/dist/MidadNaskh-Regular.ttf')),
);
assert.equal(style.id, 'naskh-amiri');
assert.ok(style.nuqta > 0);

const editor = engine.createEditor('naskh-amiri', 'بسم الله الرحمن الرحيم');
let scene = editor.scene();
assert.equal(scene.lines.length, 1);
assert.ok(scene.glyphs.length >= 18);

const alternates = editor.alternates(2, 0);
assert.ok(alternates.length > 2, 'final meem offers alternates');
editor.setAlternate(2, 0, alternates[1].gid);
editor.setKashida(0, 600);
assert.throws(() => editor.setKashida(5, 300), /not allowed/);

scene = editor.scene();
assert.ok(scene.glyphs.some((g) => g.kashida === 0));
assert.equal(scene.warnings.length, 0);

const doc = editor.document();
assert.equal(doc.kashidas['0'], 600);

const reopened = engine.openDocument(editor.toJson());
assert.deepEqual(
  reopened.scene().glyphs.map((g) => g.gid),
  scene.glyphs.map((g) => g.gid),
);

const outlines = engine.glyphOutlines('naskh-amiri', Uint16Array.from([scene.glyphs[0].gid]));
assert.ok(outlines[0].path.startsWith('M'));
assert.ok(editor.exportSvg({ height: 200 }).startsWith('<svg'));
assert.ok(editor.undo() && editor.canRedo());

console.log(`✓ wasm engine ${wasm.MidadEngine.version()}: ${scene.glyphs.length} glyphs, ${alternates.length} shapes for meem`);
