#!/usr/bin/env node
// Copy every style package's runtime files (style.toml + compiled font) into
// apps/web/public/styles/<id>/ and write apps/web/public/styles/index.json.
// Runs automatically before `npm run dev` / `npm run build` in apps/web.
//
// Only what the engine needs at runtime is copied: the source fonts and the
// Python tooling stay out of the web bundle.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stylesDir = join(root, 'styles');
const outDir = join(root, 'apps', 'web', 'public', 'styles');

// Tiny reader for the two keys we need; the engine parses the full TOML.
function readKey(toml, section, key) {
  const block = toml.split(/^\[/m).find((b) => b.startsWith(`${section}]`));
  const match = block?.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, 'm'));
  return match?.[1];
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const entries = [];
for (const name of readdirSync(stylesDir).sort()) {
  const manifestPath = join(stylesDir, name, 'style.toml');
  if (!existsSync(manifestPath)) continue;
  const toml = readFileSync(manifestPath, 'utf8');
  const id = readKey(toml, 'style', 'id');
  const compiled = readKey(toml, 'font', 'compiled');
  const fontPath = join(stylesDir, name, compiled ?? '');
  if (!id || !compiled || !existsSync(fontPath)) {
    console.warn(`⚠ skipping ${name}: missing id, font.compiled or ${compiled} (run the style compiler)`);
    continue;
  }
  const target = join(outDir, id);
  mkdirSync(join(target, dirname(compiled)), { recursive: true });
  copyFileSync(manifestPath, join(target, 'style.toml'));
  copyFileSync(fontPath, join(target, compiled));
  entries.push({ id, manifest: `${id}/style.toml`, font: `${id}/${compiled}` });
}

writeFileSync(join(outDir, 'index.json'), JSON.stringify({ styles: entries }, null, 2) + '\n');
console.log(`styles: ${entries.map((e) => e.id).join(', ') || 'none'} → apps/web/public/styles`);
