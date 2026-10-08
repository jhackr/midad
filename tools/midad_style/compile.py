"""Compile a style package: source font + style.toml  ->  dist/ font for the engine.

What the compiler adds to the font
----------------------------------
* A GSUB lookup of type 3 (Alternate Substitution) registered under the
  feature named in ``[alternates] feature`` (``salt`` by default), for every
  script and language system.  Each glyph maps to its calligraphic variants
  (see :mod:`midad_style.gsub_graph`).

  The lookup is appended at the *end* of the lookup list, so the shaper runs
  it after every contextual rule of the font.  The engine selects variant N
  for a single letter by enabling the feature with value N on that letter's
  cluster range only — a standard HarfBuzz feature range.  Because the
  substitution happens inside the shaper, GPOS (marks, kerning, cursive
  attachment) is computed for the new glyph, which a post-shaping glyph swap
  could not do.

* New family names (OFL: a modified font should not pretend to be the
  original).  Copyright and license entries are kept.

The build is deterministic (no timestamp recalculation), so CI can check
that the committed ``dist/`` matches ``source/`` + ``style.toml``.
"""

from __future__ import annotations

import hashlib
import json
import tomllib
from dataclasses import dataclass
from pathlib import Path

from fontTools.otlLib.builder import buildAlternateSubstSubtable, buildLookup
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables as ot

from .gsub_graph import build_variant_graph

COMPILER_VERSION = "0.1.0"


@dataclass
class BuildReport:
    output: Path
    alternates: dict
    source_sha256: str
    manifest_sha256: str

    def as_dict(self) -> dict:
        return {
            "compiler": COMPILER_VERSION,
            "output": self.output.name,
            "source_sha256": self.source_sha256,
            "manifest_sha256": self.manifest_sha256,
            "alternates": self.alternates,
        }


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_manifest(style_dir: Path) -> dict:
    with open(style_dir / "style.toml", "rb") as fh:
        return tomllib.load(fh)


def _apply_corrections(graph, font: TTFont, alt_cfg: dict) -> dict[str, list[str]]:
    order = font.getGlyphOrder()
    alternates = {g: list(v) for g, v in graph.alternates.items()}
    excluded = {order[i] for i in alt_cfg.get("exclude", [])}
    for g in list(alternates):
        if g in excluded:
            del alternates[g]
            continue
        alternates[g] = [a for a in alternates[g] if a not in excluded]
    for key, extra in alt_cfg.get("extra", {}).items():
        g = order[int(key)]
        current = alternates.setdefault(g, [])
        for i in extra:
            name = order[int(i)]
            if name != g and name not in current:
                current.append(name)
    return {g: v for g, v in alternates.items() if v}


def _register_feature(gsub, tag: str, lookup_index: int) -> None:
    """Add ``tag`` -> [lookup_index] and enable it in every LangSys."""
    feature = ot.Feature()
    feature.FeatureParams = None
    feature.LookupListIndex = [lookup_index]
    feature.LookupCount = 1
    record = ot.FeatureRecord()
    record.FeatureTag = tag
    record.Feature = feature

    records = gsub.FeatureList.FeatureRecord
    records.append(record)
    # Keep FeatureRecords sorted by tag (the spec requires it) and remap the
    # indices LangSys tables refer to.
    order = sorted(range(len(records)), key=lambda i: records[i].FeatureTag)
    remap = {old: new for new, old in enumerate(order)}
    gsub.FeatureList.FeatureRecord = [records[i] for i in order]
    gsub.FeatureList.FeatureCount = len(records)
    new_index = remap[len(records) - 1]

    def patch(langsys):
        if langsys is None:
            return
        indices = [remap[i] for i in langsys.FeatureIndex]
        indices.append(new_index)
        langsys.FeatureIndex = sorted(indices)
        langsys.FeatureCount = len(indices)
        if langsys.ReqFeatureIndex != 0xFFFF:
            langsys.ReqFeatureIndex = remap[langsys.ReqFeatureIndex]

    for script in gsub.ScriptList.ScriptRecord:
        patch(script.Script.DefaultLangSys)
        for lsr in script.Script.LangSysRecord:
            patch(lsr.LangSys)


def _rename(font: TTFont, family: str) -> None:
    name = font["name"]
    subfamily = name.getDebugName(2) or "Regular"
    full = f"{family} {subfamily}" if subfamily != "Regular" else family
    ps = (family + "-" + subfamily).replace(" ", "")
    for rec in list(name.names):
        if rec.nameID in (16, 17, 21, 22):
            name.removeNames(nameID=rec.nameID)
    for rec in name.names:
        if rec.platformID != 3 or rec.langID != 0x409:
            continue
        if rec.nameID == 1:
            rec.string = family
        elif rec.nameID == 3:
            rec.string = f"{ps};midad-{COMPILER_VERSION}"
        elif rec.nameID == 4:
            rec.string = full
        elif rec.nameID == 6:
            rec.string = ps
    # Drop localized family names that still carry the original name.
    for rec in list(name.names):
        if rec.nameID in (1, 4, 6) and rec.langID != 0x409:
            name.names.remove(rec)


def compile_style(style_dir: Path, *, check_only: bool = False) -> BuildReport:
    style_dir = Path(style_dir)
    manifest = load_manifest(style_dir)
    font_cfg = manifest["font"]
    alt_cfg = manifest.get("alternates", {})
    source = style_dir / font_cfg["source"]
    output = style_dir / font_cfg["compiled"]

    font = TTFont(source, recalcTimestamp=False)
    tag = alt_cfg.get("feature", "salt")
    gsub = font["GSUB"].table
    if any(r.FeatureTag == tag for r in gsub.FeatureList.FeatureRecord):
        raise SystemExit(
            f"{source.name} already has a '{tag}' feature; pick another tag in "
            "[alternates] feature (e.g. a private tag such as 'MDAL')"
        )

    graph = build_variant_graph(
        font,
        edge_features=alt_cfg.get("edge_features", ["rlig", "calt", "liga"]),
        max_alternates=int(alt_cfg.get("max_per_glyph", 32)),
    )
    alternates = _apply_corrections(graph, font, alt_cfg)

    subtable = buildAlternateSubstSubtable(alternates)
    lookup = buildLookup([subtable], flags=0)
    gsub.LookupList.Lookup.append(lookup)
    gsub.LookupList.LookupCount = len(gsub.LookupList.Lookup)
    _register_feature(gsub, tag, len(gsub.LookupList.Lookup) - 1)

    if family := font_cfg.get("family_name"):
        _rename(font, family)

    sizes = [len(v) for v in alternates.values()]
    report = BuildReport(
        output=output,
        alternates={
            "feature": tag,
            "glyphs_with_alternates": len(alternates),
            "max_per_glyph": max(sizes, default=0),
            "total_entries": sum(sizes),
            "families": graph.stats()["families"],
        },
        source_sha256=_sha256(source),
        manifest_sha256=_sha256(style_dir / "style.toml"),
    )
    if check_only:
        return report

    output.parent.mkdir(parents=True, exist_ok=True)
    font.save(output)
    (output.parent / "build-info.json").write_text(
        json.dumps(report.as_dict(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return report


def is_up_to_date(style_dir: Path) -> tuple[bool, str]:
    """True when dist/build-info.json matches the current source font and manifest."""
    style_dir = Path(style_dir)
    manifest = load_manifest(style_dir)
    output = style_dir / manifest["font"]["compiled"]
    info_path = output.parent / "build-info.json"
    if not output.exists() or not info_path.exists():
        return False, "dist/ is missing — run the compiler"
    info = json.loads(info_path.read_text(encoding="utf-8"))
    if info.get("source_sha256") != _sha256(style_dir / manifest["font"]["source"]):
        return False, "source font changed since the last build"
    if info.get("manifest_sha256") != _sha256(style_dir / "style.toml"):
        return False, "style.toml changed since the last build"
    if info.get("compiler") != COMPILER_VERSION:
        return False, "compiler version changed since the last build"
    return True, "up to date"
