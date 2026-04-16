# tools/tests/test_generate.py
# Note: sys.path is set by conftest.py — no per-file insert needed
import pytest
import json, tempfile
from pathlib import Path
from generate import resolve_path_entry, resolve_zone_path, validate_alignment

ANCHORS = {
    "center":    [450, 490],
    "cf_wall":   [450,  56],
    "lf_corner": [140, 182],
}

# ── resolve_path_entry ──────────────────────────────────────────

def test_resolve_string_anchor():
    result = resolve_path_entry("cf_wall", ANCHORS)
    assert result == [450, 56]

def test_resolve_string_anchor_unknown_raises():
    with pytest.raises(ValueError, match="unknown anchor 'bad_anchor'"):
        resolve_path_entry("bad_anchor", ANCHORS)

def test_resolve_offset_pct_half():
    # 50% from center [450,490] toward cf_wall [450,56]
    # x: 450 + (450-450)*0.5 = 450
    # y: 490 + (56-490)*0.5 = 490 - 217 = 273
    result = resolve_path_entry({"anchor": "cf_wall", "offset_pct": 0.5}, ANCHORS)
    assert result == pytest.approx([450, 273])

def test_resolve_offset_pct_full():
    result = resolve_path_entry({"anchor": "cf_wall", "offset_pct": 1.0}, ANCHORS)
    assert result == pytest.approx([450, 56])

def test_resolve_offset_pct_zero():
    result = resolve_path_entry({"anchor": "cf_wall", "offset_pct": 0.0}, ANCHORS)
    assert result == pytest.approx([450, 490])  # = center

def test_resolve_offset_pct_unknown_anchor_raises():
    with pytest.raises(ValueError, match="unknown anchor 'bad'"):
        resolve_path_entry({"anchor": "bad", "offset_pct": 0.5}, ANCHORS)

# ── resolve_zone_path ──────────────────────────────────────────

def test_resolve_zone_path_strings():
    path = ["cf_wall", "lf_corner"]
    result = resolve_zone_path(path, ANCHORS)
    assert result == [[450, 56], [140, 182]]

def test_resolve_zone_path_mixed():
    path = ["cf_wall", {"anchor": "cf_wall", "offset_pct": 0.5}]
    result = resolve_zone_path(path, ANCHORS)
    assert result[0] == [450, 56]
    assert result[1] == pytest.approx([450, 273])

# ── validate_alignment ─────────────────────────────────────────

def test_validate_alignment_passes():
    zones  = [{"data_zone": "A"}, {"data_zone": "B"}]
    gates  = [{"data_gate": "G1"}, {"data_gate": "G2"}]
    weights = {"A": [10, 90], "B": [80, 20]}
    # Should not raise
    validate_alignment(zones, gates, weights)

def test_validate_alignment_missing_weight_key_warns(capsys):
    zones  = [{"data_zone": "A"}, {"data_zone": "B"}]
    gates  = [{"data_gate": "G1"}]
    weights = {"A": [100]}   # B missing from weights
    validate_alignment(zones, gates, weights)
    captured = capsys.readouterr()
    assert "WARNING" in captured.out or "WARNING" in captured.err

def test_validate_alignment_wrong_weight_length_warns(capsys):
    zones  = [{"data_zone": "A"}]
    gates  = [{"data_gate": "G1"}, {"data_gate": "G2"}]
    weights = {"A": [100]}  # length 1, but 2 gates
    validate_alignment(zones, gates, weights)
    captured = capsys.readouterr()
    assert "WARNING" in captured.out or "WARNING" in captured.err


# ── Task 6: SVG assembly + VENUES.md ──────────────────────────

from generate import generate_svg, update_venues_registry

RANGERS_VENUE = {
    "schema_version": "1.0",
    "sport": "mlb",
    "team": {"name": "Texas Rangers", "short_name": "Rangers", "slug": "texas-rangers", "stm_label": "Rangers Nation Member"},
    "identity": {"primary_hex": "#003087", "secondary_hex": "#C4A141",
                 "ticketing_vendor": "SeatGeek", "scan_vendor": "SeatGeek", "fnb_vendor": "Delaware North"},
    "venue": {"name": "Globe Life Field", "capacity": 40518},
    "svg": {
        "viewbox": "0 0 900 800",
        "sport_geometry": "baseball",
        "anchors": {
            "center":         [450, 490],
            "home_plate":     [450, 574],
            "cf_wall":        [450,  56],
            "lf_corner":      [140, 182],
            "rf_corner":      [746, 200],
            "left_foul_ext":  [108, 312],
            "right_foul_ext": [778, 325],
        },
        "zones": [
            {"name": "Upper Level", "data_zone": "Upper Level", "layer": 1,
             "fill": "#b8cce4", "suite_level": False,
             "path": ["lf_corner", "cf_wall", "rf_corner", "right_foul_ext", "left_foul_ext"]},
            {"name": "Field Level", "data_zone": "Field Level", "layer": 2,
             "fill": "#6a9ab8", "suite_level": False,
             "path": [
                 {"anchor": "lf_corner", "offset_pct": 0.55},
                 {"anchor": "cf_wall",   "offset_pct": 0.6},
                 {"anchor": "rf_corner", "offset_pct": 0.55},
                 {"anchor": "right_foul_ext", "offset_pct": 0.55},
                 {"anchor": "left_foul_ext",  "offset_pct": 0.55},
             ]},
        ],
        "gates": [
            {"name": "TXU Energy North Entry", "data_gate": "TXU Energy North Entry",
             "cx": 450, "cy": 66, "label_side": "top", "fill": "#003087", "is_premium": False},
            {"name": "VIP Entry North", "data_gate": "VIP Entry North",
             "cx": 108, "cy": 360, "label_side": "left", "fill": "#c41e3a", "is_premium": True},
        ],
        "gate_by_zone_weights": {
            "Upper Level": [60, 40],
            "Field Level": [40, 60],
        }
    }
}

def test_generate_svg_zone_count():
    svg = generate_svg(RANGERS_VENUE)
    assert svg.count('class="section-zone"') == 2

def test_generate_svg_gate_count():
    svg = generate_svg(RANGERS_VENUE)
    assert svg.count('class="gate-marker"') == 2

def test_generate_svg_data_zone_values():
    svg = generate_svg(RANGERS_VENUE)
    assert 'data-zone="Upper Level"' in svg
    assert 'data-zone="Field Level"' in svg

def test_generate_svg_data_gate_values():
    svg = generate_svg(RANGERS_VENUE)
    assert 'data-gate="TXU Energy North Entry"' in svg
    assert 'data-gate="VIP Entry North"' in svg

def test_generate_svg_has_field_overlay():
    svg = generate_svg(RANGERS_VENUE)
    assert 'class="playing-field"' in svg

def test_generate_svg_no_weights_in_svg():
    svg = generate_svg(RANGERS_VENUE)
    # gate_by_zone_weights should not appear in SVG
    assert "gate_by_zone_weights" not in svg
    assert "gateBySectionWeights" not in svg

def test_generate_svg_viewbox():
    svg = generate_svg(RANGERS_VENUE)
    assert 'viewBox="0 0 900 800"' in svg

def test_venues_md_append_new_row(tmp_path):
    reg = tmp_path / "VENUES.md"
    reg.write_text(
        "# Venue Registry\n\n"
        "| Team | Sport | Venue | JSON | SVG | Generated |\n"
        "|------|-------|-------|------|-----|-----------|\n"
    )
    update_venues_registry(reg, RANGERS_VENUE, "texas-rangers-venue.json",
                           "texas-rangers-stadium.svg", "2026-04-16")
    content = reg.read_text()
    assert "Texas Rangers" in content
    assert "2026-04-16" in content
    assert content.count("Texas Rangers") == 1

def test_venues_md_update_existing_row(tmp_path):
    reg = tmp_path / "VENUES.md"
    reg.write_text(
        "# Venue Registry\n\n"
        "| Team | Sport | Venue | JSON | SVG | Generated |\n"
        "|------|-------|-------|------|-----|-----------|\n"
        "| Texas Rangers | MLB | Globe Life Field | texas-rangers-venue.json | texas-rangers-stadium.svg | 2025-01-01 |\n"
    )
    update_venues_registry(reg, RANGERS_VENUE, "texas-rangers-venue.json",
                           "texas-rangers-stadium.svg", "2026-04-16")
    content = reg.read_text()
    assert content.count("Texas Rangers") == 1   # not duplicated
    assert "2026-04-16" in content               # date updated
    assert "2025-01-01" not in content           # old date replaced
