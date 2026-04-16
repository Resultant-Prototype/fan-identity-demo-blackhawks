# tools/generate.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json, argparse
from pathlib import Path
from lib import geometry_baseball, geometry_football
from lib.svg_builder import (build_zone_polygon, build_gate_circle,
                              build_gate_label, build_north_indicator)


# ── Path resolution ────────────────────────────────────────────

def resolve_path_entry(entry, anchors: dict):
    """Resolve one path entry to [x, y].
    entry is a string anchor name, {"anchor": "...", "offset_pct": N}, or {"x": N, "y": N}.
    """
    if isinstance(entry, str):
        if entry not in anchors:
            raise ValueError(f"unknown anchor '{entry}' — available: {sorted(anchors)}")
        return list(anchors[entry])
    # absolute coordinate passthrough
    if "x" in entry and "y" in entry:
        return [entry["x"], entry["y"]]
    # offset_pct object
    name = entry["anchor"]
    pct  = entry["offset_pct"]
    if name not in anchors:
        raise ValueError(f"unknown anchor '{name}' — available: {sorted(anchors)}")
    cx, cy = anchors["center"]
    ax, ay = anchors[name]
    return [cx + (ax - cx) * pct, cy + (ay - cy) * pct]


def resolve_zone_path(path_list: list, anchors: dict) -> list:
    return [resolve_path_entry(entry, anchors) for entry in path_list]


# ── Validation ─────────────────────────────────────────────────

def validate_alignment(zones: list, gates: list, gate_weights: dict):
    """Warn (non-fatal) on weight key mismatches or wrong array lengths."""
    zone_names = {z["data_zone"] for z in zones}
    gate_count = len(gates)
    for name in zone_names:
        if name not in gate_weights:
            print(f"WARNING: gate_by_zone_weights missing key '{name}'", file=sys.stderr)
    for name, weights in gate_weights.items():
        if len(weights) != gate_count:
            print(
                f"WARNING: gate_by_zone_weights['{name}'] has {len(weights)} values "
                f"but there are {gate_count} gates",
                file=sys.stderr,
            )


# ── SVG assembly ───────────────────────────────────────────────

GEOMETRY_MODULES = {
    'baseball': geometry_baseball,
    'football': geometry_football,
}


def generate_svg(venue: dict) -> str:
    """Build the complete SVG string from a venue dict."""
    svg_cfg = venue['svg']
    sport   = svg_cfg['sport_geometry']

    geo = GEOMETRY_MODULES.get(sport)
    if geo is None:
        raise ValueError(f"Unsupported sport_geometry '{sport}'. "
                         f"Supported: {list(GEOMETRY_MODULES)}")

    anchors = geo.build_anchor_table(svg_cfg['anchors'])

    # Sort zones back → front (ascending layer)
    zones = sorted(svg_cfg['zones'], key=lambda z: z['layer'])

    zone_polygons = []
    for zone in zones:
        coords = resolve_zone_path(zone['path'], anchors)
        zone_polygons.append(
            build_zone_polygon(zone['data_zone'], coords, zone['fill'],
                               zone.get('suite_level', False))
        )

    field_overlay = geo.build_field_overlay(anchors)

    gate_circles = []
    gate_labels  = []
    for gate in svg_cfg['gates']:
        # Use the gate's own fill field — the researcher sets it correctly.
        # is_premium is a data attribute only (read by demo JS), not a render override.
        fill = gate['fill']
        gate_circles.append(
            build_gate_circle(gate['data_gate'], gate['cx'], gate['cy'], fill)
        )
        gate_labels.append(
            build_gate_label(gate['name'], gate['cx'], gate['cy'],
                             gate['label_side'], fill)
        )

    vb = svg_cfg.get('viewbox', '0 0 900 800')
    # Arrow marker for north indicator
    defs = (
        '  <defs>\n'
        '    <marker id="svg-arrow" viewBox="0 0 10 10" refX="5" refY="0"\n'
        '            markerWidth="4" markerHeight="4" orient="auto-start-reverse">\n'
        '      <path d="M 0 10 L 5 0 L 10 10 Z" fill="#999"/>\n'
        '    </marker>\n'
        '  </defs>'
    )

    north = build_north_indicator(858, 75)

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg"',
        f'     viewBox="{vb}"',
        f'     style="display:block;width:100%;height:auto">',
        '',
        defs,
        '',
        '  <!-- SECTION ZONES -->',
    ]
    lines += zone_polygons
    lines += ['', '  <!-- FIELD OVERLAY -->', field_overlay]
    lines += ['', '  <!-- GATE MARKERS -->',
              '  <g class="gate-markers"',
              '     font-family="\'Lexend Deca\',system-ui,sans-serif"',
              '     font-size="9.5" font-weight="700">']
    lines += gate_circles
    lines += gate_labels
    lines += ['  </g>', '', north, '', '</svg>']
    return '\n'.join(lines)


# ── VENUES.md registry ─────────────────────────────────────────

def update_venues_registry(registry_path: Path, venue: dict,
                            json_file: str, svg_file: str, date: str):
    """Append or update (match on json_file name) a row in VENUES.md."""
    team_name = venue['team']['name']
    sport = venue['sport'].upper()
    venue_name = venue['venue']['name']
    row = f"| {team_name} | {sport} | {venue_name} | {json_file} | {svg_file} | {date} |"

    if not registry_path.exists():
        registry_path.write_text(
            "# Venue Registry\n\n"
            "| Team | Sport | Venue | JSON | SVG | Generated |\n"
            "|------|-------|-------|------|-----|-----------|\n"
            + row + "\n"
        )
        return

    lines = registry_path.read_text().splitlines(keepends=True)
    updated = False
    new_lines = []
    for line in lines:
        if f"| {json_file} |" in line:
            new_lines.append(row + "\n")
            updated = True
        else:
            new_lines.append(line)
    if not updated:
        # Append (ensure trailing newline before row)
        if new_lines and not new_lines[-1].endswith('\n'):
            new_lines[-1] += '\n'
        new_lines.append(row + "\n")
    registry_path.write_text(''.join(new_lines))


# ── CLI ────────────────────────────────────────────────────────

def _slug_from_name(name: str) -> str:
    return name.lower().replace(' ', '-')


def main():
    parser = argparse.ArgumentParser(description='Generate stadium SVG from venue JSON')
    parser.add_argument('venue_json', help='Path to [slug]-venue.json')
    parser.add_argument('--dry-run', action='store_true',
                        help='Validate + print summary; do not write files')
    args = parser.parse_args()

    venue_path = Path(args.venue_json)
    if not venue_path.exists():
        print(f"ERROR: {venue_path} not found", file=sys.stderr)
        sys.exit(1)

    venue = json.loads(venue_path.read_text())
    slug  = venue['team']['slug']

    # Validate
    validate_alignment(venue['svg']['zones'], venue['svg']['gates'],
                       venue['svg'].get('gate_by_zone_weights', {}))

    if args.dry_run:
        z = len(venue['svg']['zones'])
        g = len(venue['svg']['gates'])
        a = len(venue['svg']['anchors'])
        print(f"DRY RUN: would render {z} zones, {g} gates, {a} base anchors")
        print(f"  sport_geometry: {venue['svg']['sport_geometry']}")
        print(f"  output: {slug}-stadium.svg")
        sys.exit(0)

    svg_str = generate_svg(venue)

    out_dir = venue_path.parent
    svg_path = out_dir / f"{slug}-stadium.svg"
    svg_path.write_text(svg_str)
    print(f"✓ Written: {svg_path}")

    # Update registry
    registry_path = Path(__file__).parent / 'VENUES.md'
    from datetime import date as _date
    today = _date.today().isoformat()
    update_venues_registry(registry_path, venue,
                           f"{slug}-venue.json", f"{slug}-stadium.svg", today)
    print(f"✓ Registry updated: tools/VENUES.md")
    print(json.dumps({"status": "ok", "svg": str(svg_path), "slug": slug}))


if __name__ == '__main__':
    main()
