# The `.midad` document format

A `.midad` file is UTF-8 JSON written by `Document::to_json`
(`crates/midad-core/src/document.rs`). It stores the text and the
calligrapher's decisions — never glyph positions.

```json
{
  "format": 1,
  "style": { "id": "naskh-amiri", "version": "0.1.0" },
  "text": "بسم الله الرحمن الرحيم",
  "options": ["ss07"],
  "glyphs": [
    { "cluster": 2, "index": 0, "alternate": 1854 },
    { "cluster": 7, "index": 0, "dx": 12, "dy": 140, "scale": 1.25, "rotate": -8 }
  ],
  "kashidas": { "0": 600 },
  "layout": { "align": "right", "line_spacing": 1.0 }
}
```

| Field | Meaning |
|---|---|
| `format` | Format version. The engine refuses files with a higher number. |
| `style.id`, `style.version` | Style the document was made with. Opening requires a loaded style with the same id. |
| `text` | The text, `\n` between lines. |
| `options` | Tags of the style options switched on. |
| `glyphs[]` | Overrides. `cluster` = char index (Unicode scalar values, not bytes, not UTF-16 units) of the first character of the glyph's cluster; `index` = glyph position inside the cluster in logical order (0 = base letter). Omitted fields mean "unchanged": `alternate` (glyph id), `dx`/`dy` (font units, y up), `scale` (1 = unchanged), `rotate` (degrees, counter-clockwise). |
| `kashidas` | Char index → elongation length in font units. The tatweel goes between char *i* and *i + 1*. Keys are strings because JSON object keys must be. |
| `layout.align` | `right`, `center` or `left`. |
| `layout.line_spacing` | Multiplier of the font's natural line height. |

## Robustness rules

* Overrides that no longer fit (the letter at that position changed shape
  class after an edit, a kashida position became impossible) are **ignored
  with a warning**, never an error. A document always opens.
* When the text changes inside the editor, keys are remapped: overrides
  before the edit stay, overrides after it shift, overrides inside the
  replaced span are dropped.

## Versioning policy

* Adding an optional field: no version bump (old engines ignore it, new
  engines default it).
* Changing the meaning of a field or the key scheme: bump `format`, and add
  a migration in `Document::from_json` that upgrades older files in memory.

### Known limitation, planned for format 2

`alternate` stores a **glyph id**. If a style is recompiled with a
different glyph order, alternates in old documents may point to other
shapes (they are validated, so the worst case is a stale-alternate warning,
not a crash). Format 2 should store a stable glyph *name* once styles are
built from named sources (UFO / Glyphs).
