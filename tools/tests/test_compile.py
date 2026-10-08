"""Tests for the style compiler, run against the real naskh-amiri package."""

import shutil
from pathlib import Path

import pytest
from fontTools.ttLib import TTFont

from midad_style.compile import compile_style, is_up_to_date
from midad_style.gsub_graph import build_variant_graph

ROOT = Path(__file__).resolve().parents[2]
AMIRI = ROOT / "styles" / "naskh-amiri"


@pytest.fixture()
def style_copy(tmp_path: Path) -> Path:
    target = tmp_path / "naskh-amiri"
    shutil.copytree(AMIRI / "source", target / "source")
    shutil.copy(AMIRI / "style.toml", target / "style.toml")
    return target


def _salt_alternates(font: TTFont) -> dict[str, list[str]]:
    gsub = font["GSUB"].table
    result: dict[str, list[str]] = {}
    for rec in gsub.FeatureList.FeatureRecord:
        if rec.FeatureTag != "salt":
            continue
        for idx in rec.Feature.LookupListIndex:
            lookup = gsub.LookupList.Lookup[idx]
            # fontTools may wrap a large lookup in an Extension (type 7) on save.
            for st in lookup.SubTable:
                if lookup.LookupType == 7:
                    assert st.ExtensionLookupType == 3
                    st = st.ExtSubTable
                else:
                    assert lookup.LookupType == 3
                result.update(st.alternates)
    return result


def test_compile_adds_alternates_feature(style_copy: Path):
    report = compile_style(style_copy)
    font = TTFont(report.output)
    alternates = _salt_alternates(font)
    assert len(alternates) > 1000
    assert report.alternates["glyphs_with_alternates"] == len(alternates)
    # Registered for Arabic in every language system.
    gsub = font["GSUB"].table
    salt_index = next(
        i for i, r in enumerate(gsub.FeatureList.FeatureRecord) if r.FeatureTag == "salt"
    )
    arab = next(s for s in gsub.ScriptList.ScriptRecord if s.ScriptTag == "arab")
    assert salt_index in arab.Script.DefaultLangSys.FeatureIndex
    for lsr in arab.Script.LangSysRecord:
        assert salt_index in lsr.LangSys.FeatureIndex


def test_feature_list_stays_sorted(style_copy: Path):
    font = TTFont(compile_style(style_copy).output)
    tags = [r.FeatureTag for r in font["GSUB"].table.FeatureList.FeatureRecord]
    assert tags == sorted(tags)


def test_font_is_renamed(style_copy: Path):
    font = TTFont(compile_style(style_copy).output)
    assert font["name"].getDebugName(1) == "Midad Naskh"
    # The OFL license text and the original copyright stay in the font.
    assert "Open Font License" in font["name"].getDebugName(13)
    assert "Amiri" in font["name"].getDebugName(0)


def test_build_is_deterministic(style_copy: Path):
    first = compile_style(style_copy).output.read_bytes()
    second = compile_style(style_copy).output.read_bytes()
    assert first == second


def test_staleness_check(style_copy: Path):
    ok, _ = is_up_to_date(style_copy)
    assert not ok, "nothing built yet"
    compile_style(style_copy)
    ok, reason = is_up_to_date(style_copy)
    assert ok, reason
    manifest = style_copy / "style.toml"
    manifest.write_text(manifest.read_text(encoding="utf-8") + "\n# edit\n", encoding="utf-8")
    ok, reason = is_up_to_date(style_copy)
    assert not ok and "style.toml" in reason


def test_variants_keep_joining_position():
    font = TTFont(AMIRI / "source" / "Amiri-Regular.ttf")
    graph = build_variant_graph(font, ["rlig", "calt", "liga", "ccmp"])
    for glyph, alts in list(graph.alternates.items())[:500]:
        for alt in alts:
            assert graph.joining[alt] == graph.joining[glyph]
            assert graph.families[alt] == graph.families[glyph]


def test_committed_dist_is_current():
    ok, reason = is_up_to_date(AMIRI)
    assert ok, f"run `python -m midad_style compile styles/naskh-amiri`: {reason}"
