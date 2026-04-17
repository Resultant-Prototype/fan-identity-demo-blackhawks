#!/usr/bin/env python3
"""
tools/from_seating_chart.py
Convert a raw ticketing-platform seating chart SVG into a simplified
zone-colored stadium SVG for the fan-identity demo.

Usage:
    python3 tools/from_seating_chart.py <source.svg> [slug]

Example:
    python3 tools/from_seating_chart.py ~/Downloads/highmark.svg buffalo-bills

The script:
  1. Parses every <polygon id="spoly_*"> element from the source SVG.
  2. Classifies each section into a zone by its numeric ID (100s, 200s, 300s)
     or special names (GL*, RZ*, west_end_suites).
  3. Scales all coordinates to fit the 900×800 viewBox.
  4. Draws a colored field overlay (rectangle with rounded corners).
  5. Writes <slug>-stadium.svg in the current directory.

You still need to update the venue JSON (anchors, zones, gates) separately,
or use the scaffold output from scaffold_config.py.
"""

import xml.etree.ElementTree as ET
import json, math, sys, re
from pathlib import Path


# ── Helpers ────────────────────────────────────────────────────

def parse_points(pts_str: str) -> list[tuple[float, float]]:
    """Parse SVG points string into list of (x, y) tuples."""
    pts = []
    tokens = re.findall(r'[-\d.]+,[-\d.]+', pts_str)
    for t in tokens:
        x, y = t.split(',')
        pts.append((float(x), float(y)))
    return pts


def format_points(pts: list[tuple[float, float]]) -> str:
    return ' '.join(f"{x:.1f},{y:.1f}" for x, y in pts)


# ── Zone classification ─────────────────────────────────────────

ZONE_COLORS = {
    '300 Level Upper':             '#7B9EC1',   # light blue-gray
    '200 Level Club / Mezzanine':  '#1A5FA0',   # medium Bills blue
    '100 Level Lower Bowl':        '#00338D',   # Bills royal blue
    'Suites':                      '#9B2335',   # dark red (premium)
}

ZONE_LAYER = {
    '300 Level Upper':             1,
    '200 Level Club / Mezzanine':  2,
    'Suites':                      3,
    '100 Level Lower Bowl':        4,
}


def classify_section(sid: str) -> str:
    if sid == 'west_end_suites':
        return '100 Level Lower Bowl'
    if sid.startswith('GL') or sid.startswith('RZ'):
        return 'Suites'
    try:
        n = int(sid)
        if 100 <= n <= 199:
            return '100 Level Lower Bowl'
        if 200 <= n <= 299:
            return '200 Level Club / Mezzanine'
        if 300 <= n <= 399:
            return '300 Level Upper'
    except ValueError:
        pass
    return '300 Level Upper'


# ── Main ───────────────────────────────────────────────────────

def main():
    list_sections = '--list-sections' in sys.argv
    args = [a for a in sys.argv[1:] if a != '--list-sections']

    # Parse --config flag
    config_path = None
    filtered = []
    i = 0
    while i < len(args):
        if args[i] == '--config' and i + 1 < len(args):
            config_path = args[i + 1]
            i += 2
        else:
            filtered.append(args[i])
            i += 1
    remaining = filtered

    if len(remaining) < 1:
        print("Usage: python3 tools/from_seating_chart.py <source.svg> [slug] [--config venue.json] [--list-sections]")
        sys.exit(1)

    src_path = Path(remaining[0])
    if not src_path.exists():
        print(f"ERROR: {src_path} not found", file=sys.stderr)
        sys.exit(1)

    slug = remaining[1] if len(remaining) > 1 else src_path.stem

    # ── Load venue config (when --config provided) ─────────────
    venue = None
    section_zone_map = {}   # sid_str → zone_name
    zone_fills = {}         # zone_name → fill color
    config_gates = []       # [(name, cx, cy, fill, side), ...]

    if config_path:
        with open(config_path) as f:
            venue = json.load(f)

        svg_cfg = venue.get('svg', {})

        # Build section_id → zone_name from section_ids patterns (e.g. "101-136")
        for zone in svg_cfg.get('zones', []):
            zname = zone['name']
            zone_fills[zname] = zone.get('fill', '#7B9EC1')
            for pat in zone.get('section_ids', []):
                if re.match(r'^\d+-\d+$', pat):
                    lo, hi = pat.split('-')
                    for n in range(int(lo), int(hi) + 1):
                        section_zone_map[str(n)] = zname
                else:
                    section_zone_map[pat] = zname

        # Build gate list from config (positions already in 900×800 space)
        SVG_CX, SVG_CY = 450, 400
        for g in svg_cfg.get('gates', []):
            gx, gy = float(g['cx']), float(g['cy'])
            dx, dy = gx - SVG_CX, gy - SVG_CY
            if abs(dx) > abs(dy):
                side = 'right' if dx > 0 else 'left'
            else:
                side = 'bottom' if dy > 0 else 'top'
            config_gates.append((g['name'], gx, gy, g.get('fill', '#888888'), side))

    # ── Parse source SVG ──────────────────────────────────────
    src = src_path.read_text()
    # Strip namespaces for ElementTree compatibility.
    # Remove xlink:href entirely (some SVGs have both href and xlink:href;
    # renaming xlink:href→href would create duplicate attributes).
    src = src.replace(' xmlns="http://www.w3.org/2000/svg"', '')
    src = src.replace(' xmlns:xlink="http://www.w3.org/1999/xlink"', '')
    src = re.sub(r'\s+xlink:href="[^"]*"', '', src)

    root = ET.fromstring(src)

    sections = []  # (zone, sid, [(x,y), ...])
    x_all, y_all = [], []

    for poly in root.iter('polygon'):
        id_ = poly.get('id', '')
        if not id_.startswith('spoly_'):
            continue
        sid = id_[6:]
        pts_str = poly.get('points', '').strip()
        if not pts_str:
            continue
        pts = parse_points(pts_str)
        if not pts:
            continue
        zone = section_zone_map.get(sid) or classify_section(sid)
        sections.append((zone, sid, pts))
        x_all.extend(p[0] for p in pts)
        y_all.extend(p[1] for p in pts)

    if not sections:
        print("ERROR: no spoly_* polygons found. Check that the source SVG uses id='spoly_NNN' on section polygons.", file=sys.stderr)
        sys.exit(1)

    if list_sections:
        numeric_ids = []
        named_ids   = []
        for _, sid, _ in sections:
            try:
                numeric_ids.append(int(sid))
            except ValueError:
                named_ids.append(sid)
        numeric_ids.sort()
        print(f"Numeric ({len(numeric_ids)}): {json.dumps(numeric_ids)}")
        print(f"Named   ({len(named_ids)}): {json.dumps(named_ids)}")
        sys.exit(0)

    print(f"Found {len(sections)} section polygons", file=sys.stderr)

    # ── Coordinate transform ──────────────────────────────────
    VW, VH = 900, 800
    MARGIN = 30

    x_min, x_max = min(x_all), max(x_all)
    y_min, y_max = min(y_all), max(y_all)
    native_w = x_max - x_min
    native_h = y_max - y_min

    avail_w = VW - 2 * MARGIN
    avail_h = VH - 2 * MARGIN
    scale = min(avail_w / native_w, avail_h / native_h)

    scaled_w = native_w * scale
    scaled_h = native_h * scale
    x_off = MARGIN + (avail_w - scaled_w) / 2
    y_off = MARGIN + (avail_h - scaled_h) / 2

    def tx(x, y):
        return (x - x_min) * scale + x_off, (y - y_min) * scale + y_off

    def tx_pts(pts):
        return [tx(x, y) for x, y in pts]

    print(f"Scale: {scale:.4f}  offset: ({x_off:.1f}, {y_off:.1f})", file=sys.stderr)
    print(f"Native bounds: x=[{x_min:.0f},{x_max:.0f}] y=[{y_min:.0f},{y_max:.0f}]", file=sys.stderr)

    # ── Sort zones back→front ─────────────────────────────────
    # Use venue config layer order when available, else fall back to ZONE_LAYER
    if venue:
        zone_layer_cfg = {z['name']: z.get('layer', 99)
                          for z in venue.get('svg', {}).get('zones', [])}
        sections.sort(key=lambda s: zone_layer_cfg.get(s[0], 99))
    else:
        sections.sort(key=lambda s: ZONE_LAYER.get(s[0], 99))

    # ── Field overlay ─────────────────────────────────────────
    # The field is the gap between the innermost sections.
    # "Layer 3" sections in config == field-level; fall back to "100 Level Lower Bowl".
    if venue:
        max_layer = max((z.get('layer', 1) for z in venue.get('svg', {}).get('zones', [])), default=1)
        inner_zone_names = {z['name'] for z in venue.get('svg', {}).get('zones', [])
                            if z.get('layer', 1) == max_layer}
        inner_sections = [(sid, pts) for zone, sid, pts in sections
                          if zone in inner_zone_names]
    else:
        inner_sections = [(sid, pts) for zone, sid, pts in sections
                          if zone == '100 Level Lower Bowl' and sid != 'west_end_suites']

    # Field boundary: find the bounding box of the innermost edge of lower bowl.
    # Simple heuristic: use the 20th/80th percentile of x/y across 100-level coords.
    xs_100 = sorted(x for _, pts in inner_sections for x, y in pts)
    ys_100 = sorted(y for _, pts in inner_sections for x, y in pts)

    pct = 0.18   # inner ~18% boundary estimate
    n = len(xs_100)
    field_x1_n = xs_100[int(n * pct)]
    field_x2_n = xs_100[int(n * (1 - pct))]
    field_y1_n = ys_100[int(n * pct)]
    field_y2_n = ys_100[int(n * (1 - pct))]

    fx1, fy1 = tx(field_x1_n, field_y1_n)
    fx2, fy2 = tx(field_x2_n, field_y2_n)
    fw, fh = fx2 - fx1, fy2 - fy1
    corner_r = round(min(fw, fh) * 0.12, 1)
    ez_depth = round(fw * 0.11, 1)   # end zone ~10% of field length each side
    mid_x = (fx1 + fx2) / 2

    print(f"Field (transformed): x=[{fx1:.1f},{fx2:.1f}] y=[{fy1:.1f},{fy2:.1f}]  ratio={fw/fh:.2f}:1", file=sys.stderr)

    # ── Gate ring ─────────────────────────────────────────────
    gcx = x_off + scaled_w / 2
    gcy = y_off + scaled_h / 2
    g_rx = scaled_w / 2 + 20
    g_ry = scaled_h / 2 + 20

    # Default gate layout (clockwise from top); caller can edit the JSON directly
    gates = [
        ('Gate N',  270, '#888888', 'top'),
        ('Gate NE', 315, '#888888', 'right'),
        ('Gate E',    0, '#888888', 'right'),
        ('Gate SE',  45, '#888888', 'bottom'),
        ('Gate S',   90, '#888888', 'bottom'),
        ('Gate SW', 135, '#888888', 'bottom'),
        ('Gate W',  180, '#888888', 'left'),
        ('Gate NW', 225, '#888888', 'left'),
    ]

    def gate_pos(deg):
        a = math.radians(deg)
        return gcx + g_rx * math.cos(a), gcy + g_ry * math.sin(a)

    LABEL_OFF = {'top': (0, -26, 'middle'), 'bottom': (0, 26, 'middle'),
                 'left': (-26, 4, 'end'), 'right': (26, 4, 'start')}

    # ── Build SVG ─────────────────────────────────────────────
    lines = [
        '<svg xmlns="http://www.w3.org/2000/svg"',
        '     viewBox="0 0 900 800"',
        '     style="display:block;width:100%;height:auto">',
        '',
        '  <defs>',
        '    <marker id="svg-arrow" viewBox="0 0 10 10" refX="5" refY="0"',
        '            markerWidth="4" markerHeight="4" orient="auto-start-reverse">',
        '      <path d="M 0 10 L 5 0 L 10 10 Z" fill="#999"/>',
        '    </marker>',
        f'    <clipPath id="field-clip">',
        f'      <rect x="{fx1:.1f}" y="{fy1:.1f}" width="{fw:.1f}" height="{fh:.1f}"',
        f'            rx="{corner_r}" ry="{corner_r}"/>',
        '    </clipPath>',
        '  </defs>',
        '',
        '  <!-- SECTION ZONES -->',
    ]

    for zone, sid, pts in sections:
        fill = zone_fills.get(zone) or ZONE_COLORS.get(zone, '#7B9EC1')
        tpts = format_points(tx_pts(pts))
        lines.append(
            f'  <polygon class="section-zone" data-zone="{zone}" data-sid="{sid}"\n'
            f'           fill="{fill}" stroke="white" stroke-width="0.5" stroke-opacity="0.4"\n'
            f'           points="{tpts}"/>'
        )

    lines += ['', '  <!-- FIELD OVERLAY -->']
    # Main grass
    lines.append(
        f'  <rect class="football-field" fill="#2d6e3e" stroke="none"\n'
        f'        x="{fx1:.1f}" y="{fy1:.1f}" width="{fw:.1f}" height="{fh:.1f}"'
        f' rx="{corner_r}" ry="{corner_r}"/>'
    )
    # West end zone
    lines.append(
        f'  <rect class="end-zone" fill="#1a5c30" stroke="none" clip-path="url(#field-clip)"\n'
        f'        x="{fx1:.1f}" y="{fy1:.1f}" width="{ez_depth:.1f}" height="{fh:.1f}"/>'
    )
    # East end zone
    lines.append(
        f'  <rect class="end-zone" fill="#1a5c30" stroke="none" clip-path="url(#field-clip)"\n'
        f'        x="{fx2-ez_depth:.1f}" y="{fy1:.1f}" width="{ez_depth:.1f}" height="{fh:.1f}"/>'
    )
    # Midfield
    lines.append(
        f'  <line stroke="white" stroke-width="1.5" stroke-opacity="0.5"\n'
        f'        x1="{mid_x:.1f}" y1="{fy1:.1f}" x2="{mid_x:.1f}" y2="{fy2:.1f}"/>'
    )
    for frac in [0.25, 0.375, 0.625, 0.75]:
        lx = round(fx1 + fw * frac, 1)
        lines.append(
            f'  <line stroke="white" stroke-width="0.75" stroke-opacity="0.3"\n'
            f'        x1="{lx}" y1="{fy1:.1f}" x2="{lx}" y2="{fy2:.1f}"/>'
        )

    gate_src = config_gates if config_gates else [
        (name, *gate_pos(angle), fill, side)
        for name, angle, fill, side in gates
    ]
    comment = '<!-- GATE MARKERS -->' if config_gates else '<!-- GATE MARKERS (generic — pass --config to use real names) -->'
    lines += ['', f'  {comment}',
              '  <g class="gate-markers"',
              '     font-family="\'Lexend Deca\',system-ui,sans-serif"',
              '     font-size="9" font-weight="700">']

    for name, gx, gy, fill, side in gate_src:
        dx, dy, anchor = LABEL_OFF[side]
        lines.append(
            f'    <circle class="gate-marker" data-gate="{name}"\n'
            f'            cx="{gx:.1f}" cy="{gy:.1f}" r="13"\n'
            f'            fill="{fill}" stroke="white" stroke-width="2"/>'
        )
        lines.append(
            f'    <text x="{gx+dx:.1f}" y="{gy+dy:.1f}" fill="{fill}" text-anchor="{anchor}">{name}</text>'
        )

    lines += ['  </g>', '']

    # North indicator
    lines += [
        f'  <g transform="translate(858,35)"',
        '     font-family="\'Lexend Deca\',system-ui,sans-serif"',
        '     font-size="11" fill="#999" text-anchor="middle">',
        '    <text x="0" y="0">N</text>',
        '    <line x1="0" y1="5" x2="0" y2="26"',
        '          stroke="#999" stroke-width="1.5"',
        '          marker-end="url(#svg-arrow)"/>',
        '  </g>',
        '',
        '</svg>',
    ]

    out = Path(f"{slug}-stadium.svg")
    out.write_text('\n'.join(lines))
    print(f"✓ Written: {out}")
    print(f"  Zones: {len(set(z for z,_,_ in sections))}  Sections: {len(sections)}")
    if not config_gates:
        print("  Gate labels default to cardinal directions — pass --config <venue.json> to use real names.")


if __name__ == '__main__':
    main()
