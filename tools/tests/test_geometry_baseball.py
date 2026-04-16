# tools/tests/test_geometry_baseball.py
import pytest
from lib.geometry_baseball import build_anchor_table, build_field_overlay

RANGERS_BASE = {
    "center":         [450, 490],
    "home_plate":     [450, 574],
    "cf_wall":        [450,  56],
    "lf_corner":      [140, 182],
    "rf_corner":      [746, 200],
    "left_foul_ext":  [108, 312],
    "right_foul_ext": [778, 325],
}

def test_base_anchors_passthrough():
    table = build_anchor_table(RANGERS_BASE)
    assert table["home_plate"] == [450, 574]
    assert table["cf_wall"]    == [450,  56]

def test_derived_lf_wall():
    table = build_anchor_table(RANGERS_BASE)
    expected = [(140 + 450) / 2, (182 + 56) / 2]
    assert table["lf_wall"] == pytest.approx(expected)

def test_derived_rf_wall():
    table = build_anchor_table(RANGERS_BASE)
    expected = [(746 + 450) / 2, (200 + 56) / 2]
    assert table["rf_wall"] == pytest.approx(expected)

def test_missing_required_anchor_raises():
    bad = dict(RANGERS_BASE)
    del bad["home_plate"]
    with pytest.raises(ValueError, match="home_plate"):
        build_anchor_table(bad)

def test_field_overlay_contains_required_classes():
    table = build_anchor_table(RANGERS_BASE)
    svg = build_field_overlay(table)
    assert 'class="warning-track"' in svg
    assert 'class="playing-field"' in svg
    assert 'class="infield-dirt"' in svg

def test_field_overlay_contains_bases():
    table = build_anchor_table(RANGERS_BASE)
    svg = build_field_overlay(table)
    assert 'class="home-plate"' in svg or "Home plate" in svg or "home_plate" in svg.lower()

def test_field_overlay_contains_foul_lines():
    table = build_anchor_table(RANGERS_BASE)
    svg = build_field_overlay(table)
    assert 'class="foul-line"' in svg or "foul" in svg.lower()
