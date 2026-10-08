"""Build the glyph-variant graph of a font from its GSUB table.

The goal is to answer one question for every glyph the shaper can output:
"which other glyphs are calligraphic variants of this one, and connect to
their neighbours the same way?"  Those become the alternates a user can pick
in the editor.

How it works
------------
1. Collect the GSUB lookups that belong to the features listed in
   ``edge_features`` (plus every lookup they call from contextual rules).
2. Every single (type 1), alternate (type 3) and positional multiple (type 2)
   substitution ``A -> B`` is an edge between two variants of the same letter.
   Connected components of that graph are *families* (all shapes of one
   letter or ligature).
3. Families mix joining positions (isolated, initial, medial, final).
   Swapping an initial shape for a final one would break the joins, so each
   family is split by a *joining signature* read from the outline itself:
   does the glyph carry ink at its right edge (connects to the previous
   letter) and/or at its left edge (connects to the next letter), inside the
   baseline band where the tatweel stroke sits?
4. ``alternates[g]`` = the other members of g's (family, signature, mark?)
   group.

The signature is a heuristic.  It is right for the vast majority of Naskh
glyphs, and a calligrapher can always correct a group by hand in
``style.toml`` (``[alternates] exclude`` / ``extra``).
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

POSITIONAL_FEATURES = ("isol", "init", "medi", "fina")
GDEF_MARK = 3
TATWEEL = 0x0640

# Unicode blocks whose nominal glyphs mark a family as "Arabic letters".
ARABIC_RANGES = [
    (0x0620, 0x06FF),
    (0x0750, 0x077F),
    (0x0870, 0x08FF),
]


@dataclass
class VariantGraph:
    glyph_order: list[str]
    families: dict[str, int] = field(default_factory=dict)
    joining: dict[str, str] = field(default_factory=dict)
    alternates: dict[str, list[str]] = field(default_factory=dict)

    def stats(self) -> dict[str, int]:
        sizes = [len(v) for v in self.alternates.values()]
        return {
            "families": len(set(self.families.values())),
            "glyphs_with_alternates": len(self.alternates),
            "max_alternates": max(sizes, default=0),
            "total_alternate_entries": sum(sizes),
        }


# --------------------------------------------------------------------------
# GSUB traversal
# --------------------------------------------------------------------------


def _subtables(lookup):
    for st in lookup.SubTable:
        if lookup.LookupType == 7:
            yield st.ExtensionLookupType, st.ExtSubTable
        else:
            yield lookup.LookupType, st


def _nested_lookup_indices(lookup_type: int, st) -> list[int]:
    """Lookup indices called from a contextual (type 5) or chained (type 6) subtable."""
    if lookup_type not in (5, 6):
        return []
    records = []
    if st.Format == 3:
        records.extend(st.SubstLookupRecord or [])
    else:
        if lookup_type == 5:
            sets = st.SubRuleSet if st.Format == 1 else st.SubClassSet
            rule_attr = "SubRule" if st.Format == 1 else "SubClassRule"
        else:
            sets = st.ChainSubRuleSet if st.Format == 1 else st.ChainSubClassSet
            rule_attr = "ChainSubRule" if st.Format == 1 else "ChainSubClassRule"
        for rule_set in sets or []:
            if rule_set is None:
                continue
            for rule in getattr(rule_set, rule_attr, None) or []:
                records.extend(rule.SubstLookupRecord or [])
    return [r.LookupListIndex for r in records]


def reachable_lookups(gsub, tags: set[str]) -> set[int]:
    """Lookup indices used by ``tags``, including lookups called from contextual rules."""
    lookups = gsub.LookupList.Lookup
    seen: set[int] = set()
    queue = deque()
    for rec in gsub.FeatureList.FeatureRecord:
        if rec.FeatureTag in tags:
            queue.extend(rec.Feature.LookupListIndex)
    while queue:
        idx = queue.popleft()
        if idx in seen:
            continue
        seen.add(idx)
        for lt, st in _subtables(lookups[idx]):
            queue.extend(_nested_lookup_indices(lt, st))
    return seen


# --------------------------------------------------------------------------
# Joining signature
# --------------------------------------------------------------------------


class JoiningClassifier:
    """Reads from the outline whether a glyph connects on its right/left edge."""

    def __init__(self, font: TTFont, edge_tolerance: float = 5.0):
        self.glyphset = font.getGlyphSet()
        self.hmtx = font["hmtx"]
        self.tol = edge_tolerance
        upem = font["head"].unitsPerEm
        tatweel = (font.getBestCmap() or {}).get(TATWEEL)
        lo, hi = -0.01 * upem, 0.1 * upem
        if tatweel:
            pts = self._points(tatweel)
            if pts:
                ys = [p[1] for p in pts]
                lo, hi = min(ys), max(ys)
        margin = 0.01 * upem
        self.band = (lo - margin, hi + margin)

    def _points(self, glyph: str):
        pen = DecomposingRecordingPen(self.glyphset)
        self.glyphset[glyph].draw(pen)
        return [pt for _op, args in pen.value for pt in args]

    def signature(self, glyph: str) -> str:
        advance, _lsb = self.hmtx[glyph]
        lo, hi = self.band
        band = [p for p in self._points(glyph) if lo <= p[1] <= hi]
        left = any(p[0] <= self.tol for p in band)
        right = any(p[0] >= advance - self.tol for p in band)
        return {
            (False, False): "isol",
            (True, False): "init",
            (True, True): "medi",
            (False, True): "fina",
        }[(left, right)]


# --------------------------------------------------------------------------
# Graph
# --------------------------------------------------------------------------


def build_variant_graph(
    font: TTFont,
    edge_features: list[str],
    max_alternates: int = 32,
) -> VariantGraph:
    order = font.getGlyphOrder()
    gid = {name: i for i, name in enumerate(order)}
    gsub = font["GSUB"].table
    gdef_classes = {}
    if "GDEF" in font and font["GDEF"].table.GlyphClassDef:
        gdef_classes = font["GDEF"].table.GlyphClassDef.classDefs

    def is_mark(g: str) -> bool:
        return gdef_classes.get(g) == GDEF_MARK

    parent: dict[str, str] = {}

    def find(x: str) -> str:
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: str, b: str) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            keep, drop = sorted((ra, rb), key=gid.get)
            parent[drop] = keep

    lookups = gsub.LookupList.Lookup
    for idx in reachable_lookups(gsub, set(edge_features) | set(POSITIONAL_FEATURES)):
        for lt, st in _subtables(lookups[idx]):
            if lt == 1:
                for a, b in st.mapping.items():
                    union(a, b)
            elif lt == 2:
                for a, seq in st.mapping.items():
                    base = next((g for g in seq if not is_mark(g)), None)
                    if base:
                        union(a, base)
            elif lt == 3:
                for a, alts in st.alternates.items():
                    for b in alts:
                        union(a, b)

    # Only keep families that contain an Arabic letter from the cmap.
    arabic_roots = set()
    for cp, g in (font.getBestCmap() or {}).items():
        if any(lo <= cp <= hi for lo, hi in ARABIC_RANGES) and g in parent:
            arabic_roots.add(find(g))

    classifier = JoiningClassifier(font)
    groups: dict[tuple, list[str]] = defaultdict(list)
    family_ids: dict[str, int] = {}
    graph = VariantGraph(glyph_order=order)
    for g in list(parent):
        root = find(g)
        if root not in arabic_roots:
            continue
        sig = "mark" if is_mark(g) else classifier.signature(g)
        family_ids.setdefault(root, len(family_ids))
        graph.families[g] = family_ids[root]
        graph.joining[g] = sig
        groups[(root, sig)].append(g)

    for members in groups.values():
        members.sort(key=gid.get)
        for g in members:
            others = [m for m in members if m != g][:max_alternates]
            if others:
                graph.alternates[g] = others
    return graph
