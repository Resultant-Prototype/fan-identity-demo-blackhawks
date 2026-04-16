# tools/tests/test_svg_builder.py
from lib.svg_builder import build_zone_polygon, build_gate_circle, build_gate_label, build_north_indicator

def test_zone_polygon_attributes():
    coords = [[100, 200], [300, 200], [300, 400], [100, 400]]
    result = build_zone_polygon("Upper Deck", coords, "#b8cce4", suite_level=False)
    assert 'class="section-zone"' in result
    assert 'data-zone="Upper Deck"' in result
    assert 'fill="#b8cce4"' in result
    assert "100,200 300,200 300,400 100,400" in result
    assert 'data-suite' not in result

def test_zone_polygon_suite_level():
    coords = [[0, 0], [100, 0], [100, 100]]
    result = build_zone_polygon("Club Level", coords, "#1a3f6f", suite_level=True)
    assert 'data-suite="true"' in result

def test_gate_circle_standard():
    result = build_gate_circle("Gate 1", 450, 75, "#E31837")
    assert 'class="gate-marker"' in result
    assert 'data-gate="Gate 1"' in result
    assert 'cx="450"' in result
    assert 'cy="75"' in result
    assert 'fill="#E31837"' in result

def test_gate_label_top():
    result = build_gate_label("North Entry", 450, 75, "top", "#003087")
    assert "North" in result
    assert "Entry" in result
    assert 'text-anchor="middle"' in result
    # Label should be above the circle (lower y than cy=75)
    import re
    ys = [float(m) for m in re.findall(r'y="([\d.]+)"', result)]
    assert len(ys) == 2, "expected two text elements"
    assert all(y < 75 for y in ys)

def test_gate_label_left():
    result = build_gate_label("VIP Entry", 108, 360, "left", "#c41e3a")
    assert 'text-anchor="end"' in result

def test_gate_label_right():
    result = build_gate_label("East Gate", 800, 400, "right", "#003087")
    assert 'text-anchor="start"' in result

def test_north_indicator_contains_n():
    result = build_north_indicator(858, 75)
    assert ">N<" in result
    assert "marker-end" in result

def test_gate_label_left_multiword_order():
    result = build_gate_label("VIP Entry", 108, 360, "left", "#c41e3a")
    # "VIP" should appear before (higher up, lower y) than "Entry"
    import re
    matches = re.findall(r'<text[^>]*y="([\d.]+)"[^>]*>(\w+)</text>', result)
    assert len(matches) == 2
    ys = [(float(y), word) for y, word in matches]
    ys.sort(key=lambda t: t[0])  # sort by y ascending
    assert ys[0][1] == "VIP", f"Expected 'VIP' first (lower y), got {ys[0][1]}"
    assert ys[1][1] == "Entry", f"Expected 'Entry' second (higher y), got {ys[1][1]}"
