# tools/lib/svg_builder.py

def build_zone_polygon(data_zone: str, coords: list, fill: str, suite_level: bool) -> str:
    points = ' '.join(f"{round(x, 1)},{round(y, 1)}" for x, y in coords)
    suite_attr = ' data-suite="true"' if suite_level else ''
    return (
        f'  <polygon class="section-zone" data-zone="{data_zone}"{suite_attr}\n'
        f'           fill="{fill}" stroke="white" stroke-width="1"\n'
        f'           points="{points}"/>'
    )


def build_gate_circle(data_gate: str, cx: float, cy: float, fill: str, r: int = 16) -> str:
    return (
        f'    <circle class="gate-marker" data-gate="{data_gate}"\n'
        f'            cx="{round(cx, 1)}" cy="{round(cy, 1)}" r="{r}"\n'
        f'            fill="{fill}" stroke="white" stroke-width="2.5"/>'
    )


def build_gate_label(name: str, cx: float, cy: float, label_side: str, fill: str) -> str:
    """Return one or two <text> elements for a gate label.
    Splits name on the last space if it has multiple words."""
    SIDE = {
        'top':    (0,  -12, 'middle', -1),   # (dx, base_dy, anchor, line_dir)
        'bottom': (0,  +26, 'middle', +1),
        'left':   (-25, +3, 'end',    +1),
        'right':  (+25, +3, 'start',  +1),
    }
    dx, base_dy, anchor, ldir = SIDE.get(label_side, (0, -12, 'middle', -1))
    parts = name.rsplit(' ', 1) if ' ' in name else [name]
    # For top/left labels, render last word first (closer to circle)
    if label_side in ('top',):
        parts = list(reversed(parts))
    lines = []
    for i, part in enumerate(parts):
        y = cy + base_dy + ldir * i * 11
        lines.append(f'    <text x="{cx + dx}" y="{round(y, 1)}" fill="{fill}" text-anchor="{anchor}">{part}</text>')
    return '\n'.join(lines)


def build_north_indicator(x: float, y: float) -> str:
    return (
        f'  <g transform="translate({x},{y})"\n'
        f'     font-family="\'Lexend Deca\',system-ui,sans-serif"\n'
        f'     font-size="11" fill="#999" text-anchor="middle">\n'
        f'    <text x="0" y="0">N</text>\n'
        f'    <line x1="0" y1="5" x2="0" y2="26"\n'
        f'          stroke="#999" stroke-width="1.5"\n'
        f'          marker-end="url(#svg-arrow)"/>\n'
        f'  </g>'
    )
