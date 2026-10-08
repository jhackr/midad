# Style packages

A *style* is one calligraphic hand (Naskh, Ruqaa, Thuluth…) packaged for
Midad. Each lives in its own folder under `styles/`:

```
styles/naskh-amiri/
├── style.toml               # manifest — read by the compiler AND the engine
├── OFL.txt                  # license of the font (SIL Open Font License 1.1)
├── source/
│   └── Amiri-Regular.ttf    # input of the compiler (never loaded at runtime)
└── dist/
    ├── MidadNaskh-Regular.ttf   # compiled font, loaded by the engine
    └── build-info.json          # hashes + stats written by the compiler
```

`dist/` is committed so that working on the editor never requires Python.
CI fails if it is stale (`python -m midad_style check styles/*`).

## Workflow

```bash
pip install -e tools
python -m midad_style inspect styles/naskh-amiri/source/Amiri-Regular.ttf   # what does the font offer?
# edit styles/naskh-amiri/style.toml
python -m midad_style compile styles/naskh-amiri
npm run dev            # sync-styles.mjs copies the package into the web app
```

Check a style from the command line, without the UI:

```bash
cargo run -p midad-cli -- info -s styles/naskh-amiri
cargo run -p midad-cli -- alternates -s styles/naskh-amiri -t "بسم الله" --at 2
cargo run -p midad-cli -- render -s styles/naskh-amiri -t "بسم الله" -o out.svg
```

## `style.toml` reference

### `[style]`

| Key | Type | Meaning |
|---|---|---|
| `id` | string | Stable identifier, used in `.midad` documents. Never change it after release. |
| `version` | semver string | Bump when glyphs or rules change. |
| `name` | `{ ar, en, … }` | Display name. |
| `description` | `{ ar, en, … }` | One sentence. |
| `license` | SPDX id | `OFL-1.1` for fonts. |
| `credits` | string | Designers, sources. Shown in the editor. |
| `upstream` | URL (optional) | Where the original font lives. |

### `[font]`

| Key | Meaning |
|---|---|
| `source` | Font the compiler reads (relative path). |
| `compiled` | Font the engine loads (relative path). |
| `family_name` | Family name written into the compiled font. Required by the OFL spirit: a modified font must not pose as the original. |

### `[metrics]`

| Key | Meaning |
|---|---|
| `nuqta` | Size of one rhombic pen dot in font units. The editor shows offsets and kashida lengths in dots and draws the dot ladder. Measure the alef height and divide by `alef_dots`. |
| `alef_dots` | Height of the alef in dots (5 for Naskh, 7 for Thuluth…). |

### `[shaping]`

| Key | Default | Meaning |
|---|---|---|
| `script` | `arab` | OpenType or ISO 15924 script tag. |
| `language` | none | BCP 47 language (`ar`, `ur`, `fa`) if the font has language-specific forms. |
| `features` | `[]` | Extra features for the whole text, HarfBuzz syntax: `"ss05"`, `"-liga"`, `"cv01=2"`. |

### `[alternates]`

| Key | Used by | Meaning |
|---|---|---|
| `feature` | compiler + engine | GSUB feature holding the alternates (type-3 lookups). Default `salt`. If the source font already has that feature, choose a private tag such as `MDAL`. |
| `edge_features` | compiler | Features whose substitutions mean "variant of the same letter". Usually `rlig`, `calt`, `liga` plus the stylistic sets that swap letter shapes. |
| `max_per_glyph` | compiler | Cap on alternates per glyph (keeps the picker usable). |
| `exclude` | compiler | Glyph ids never offered as alternates (shapes that look wrong out of context). |
| `extra` | compiler | `{ "gid" = [gid, …] }` — alternates added by hand. |

> Amiri ships without glyph names, so corrections use glyph ids. Run
> `midad alternates … --at <char>` to see the ids of a letter's shapes.

### `[[options]]`

User-toggleable features (usually stylistic sets) shown as check boxes.

```toml
[[options]]
tag = "ss07"
label = { ar = "كشيدة مستقيمة (بدون تقويس)", en = "Straight kashida (no curves)" }
default = false
```

`midad_style inspect` prints each stylistic set with the name the font
gives it — copy the meaning from there, never guess it.

### `[kashida]`

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Allow elongation at all (also requires a tatweel glyph in the font). |
| `max_length` | `1500` | Longest elongation, font units. |
| `max_per_word` | `2` | Elongations per word (0 = unlimited). |
| `exclude_words` | `[]` | Words (compared without diacritics) never elongated, e.g. `الله`. |
| `never_before` | `[]` | Letters a kashida never precedes (e.g. alef). |
| `never_after` | `[]` | Letters a kashida never follows. |

The shaper already prevents impossible positions (after a non-joining
letter, inside a ligature). These rules express calligraphic convention on
top of that.

## Adding a new style

1. Create `styles/<id>/` with `source/<font>.ttf`, `OFL.txt` and a
   `style.toml` (copy `naskh-amiri` and edit).
2. `python -m midad_style inspect` the font; fill `[[options]]` from the
   stylistic-set names it prints; choose `edge_features`.
3. Measure the alef and set `[metrics]`.
4. Compile, then review every letter's shapes in the editor. Add broken
   shapes to `exclude`.
5. Add a short integration test in `crates/midad-core/tests/` if the style
   has special rules.
6. Open a pull request with screenshots (see `CONTRIBUTING.md`).

A candidate second style is **Aref Ruqaa** (OFL) — it exercises a hand with
very different joins and few ligatures, which is a good test of the
compiler's assumptions.

## Licensing

Every font in `styles/` must be under the **SIL Open Font License 1.1**. A
compiled font is a *Modified Version* under the OFL: it keeps the original
copyright and license, and gets its own family name (`family_name`). Do not
use a *Reserved Font Name* of the original. Drawings contributed by
calligraphers are accepted only under the OFL.
