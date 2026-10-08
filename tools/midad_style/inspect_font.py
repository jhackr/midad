"""Print what a font offers to Midad: features, stylistic-set names, variant stats."""

from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path

from fontTools.ttLib import TTFont

from .gsub_graph import build_variant_graph


def _lookup_type(lookup) -> int:
    if lookup.LookupType in (7, 9):  # extension (GSUB 7 / GPOS 9)
        return lookup.SubTable[0].ExtensionLookupType
    return lookup.LookupType


def inspect(path: Path) -> str:
    font = TTFont(path)
    out: list[str] = []
    name = font["name"]
    out.append(f"{name.getDebugName(4)} — {name.getDebugName(5)}")
    out.append(
        f"glyphs: {len(font.getGlyphOrder())}   unitsPerEm: {font['head'].unitsPerEm}   "
        f"glyph names: {'yes' if font['post'].formatType == 2.0 else 'no'}"
    )
    for table_tag in ("GSUB", "GPOS"):
        if table_tag not in font:
            continue
        table = font[table_tag].table
        out.append(f"\n{table_tag} features")
        lookups_by_tag: dict[str, set[int]] = defaultdict(set)
        ui_names: dict[str, str] = {}
        for rec in table.FeatureList.FeatureRecord:
            lookups_by_tag[rec.FeatureTag].update(rec.Feature.LookupListIndex)
            params = rec.Feature.FeatureParams
            if params is not None and hasattr(params, "UINameID"):
                ui_names[rec.FeatureTag] = name.getDebugName(params.UINameID) or ""
        for tag in sorted(lookups_by_tag):
            types = Counter(_lookup_type(table.LookupList.Lookup[i]) for i in lookups_by_tag[tag])
            label = f"  — {ui_names[tag]}" if tag in ui_names else ""
            out.append(f"  {tag}: {len(lookups_by_tag[tag])} lookups {dict(types)}{label}")

    if "GSUB" in font:
        graph = build_variant_graph(font, ["rlig", "calt", "liga", "ccmp"])
        out.append(f"\nvariant graph (rlig+calt+liga+ccmp): {graph.stats()}")
        out.append(f"joining signatures: {dict(Counter(graph.joining.values()))}")
    return "\n".join(out)
