# tools/lib/geometry_baseball.py
import math

REQUIRED_ANCHORS = {'center', 'home_plate', 'cf_wall', 'lf_corner', 'rf_corner',
                    'left_foul_ext', 'right_foul_ext'}


def _midpoint(a, b):
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]


def build_anchor_table(base_anchors: dict) -> dict:
    missing = REQUIRED_ANCHORS - set(base_anchors.keys())
    if missing:
        raise ValueError(f"Missing required baseball anchors: {sorted(missing)}")
    table = dict(base_anchors)
    table['lf_wall'] = _midpoint(base_anchors['lf_corner'], base_anchors['cf_wall'])
    table['rf_wall'] = _midpoint(base_anchors['rf_corner'], base_anchors['cf_wall'])
    return table


def build_field_overlay(anchors: dict) -> str:
    """Return SVG string for the baseball playing field overlay.
    Painted on top of all zone polygons."""
    hp  = anchors['home_plate']
    cf  = anchors['cf_wall']
    lf  = anchors['lf_corner']
    rf  = anchors['rf_corner']
    lfw = anchors['lf_wall']
    rfw = anchors['rf_wall']
    cx, cy = anchors['center']

    # Unit vector home_plate → cf_wall
    dx, dy = cf[0] - hp[0], cf[1] - hp[1]
    dist = math.hypot(dx, dy)
    ux, uy = dx / dist, dy / dist
    px, py = -uy, ux  # perpendicular (right of forward)

    # 90px base unit for diamond schematic
    u = 90
    b2x, b2y = hp[0] + ux*u*2,         hp[1] + uy*u*2
    b1x, b1y = hp[0] + ux*u + px*u,    hp[1] + uy*u + py*u
    b3x, b3y = hp[0] + ux*u - px*u,    hp[1] + uy*u - py*u

    # Infield dirt ellipse center: 1.1 base-units toward CF
    dcx, dcy = round(hp[0] + ux*u*1.1, 1), round(hp[1] + uy*u*1.1, 1)
    # Pitcher's mound: 0.9 base-units toward CF
    pmx, pmy = round(hp[0] + ux*u*0.9, 1), round(hp[1] + uy*u*0.9, 1)

    lfe = anchors['left_foul_ext']
    rfe = anchors['right_foul_ext']

    parts = []

    # Warning track (outer playing field triangle with Q curves)
    parts.append(
        f'  <path class="warning-track" fill="#c8a878" stroke="none"\n'
        f'        d="M {hp[0]} {hp[1]}\n'
        f'           L {lf[0]} {lf[1]}\n'
        f'           Q {lfw[0]} {lfw[1]} {cf[0]} {cf[1]}\n'
        f'           Q {rfw[0]} {rfw[1]} {rf[0]} {rf[1]}\n'
        f'           Z"/>'
    )

    # Grass (inset ~3.5% toward center)
    def _inset(pt, pct=0.035):
        return [round(pt[0] + (cx - pt[0]) * pct, 1),
                round(pt[1] + (cy - pt[1]) * pct, 1)]

    lf_i, rf_i = _inset(lf), _inset(rf)
    cf_i = _inset(cf)
    hp_i = _inset(hp, 0.01)
    lfw_i, rfw_i = _inset(lfw), _inset(rfw)

    parts.append(
        f'  <path class="playing-field" fill="#2d6e3e" stroke="none"\n'
        f'        d="M {hp_i[0]} {hp_i[1]}\n'
        f'           L {lf_i[0]} {lf_i[1]}\n'
        f'           Q {lfw_i[0]} {lfw_i[1]} {cf_i[0]} {cf_i[1]}\n'
        f'           Q {rfw_i[0]} {rfw_i[1]} {rf_i[0]} {rf_i[1]}\n'
        f'           Z"/>'
    )

    # Infield dirt
    parts.append(
        f'  <ellipse class="infield-dirt" fill="#c8a06a" stroke="none"\n'
        f'           cx="{dcx}" cy="{dcy}" rx="108" ry="90"/>'
    )

    # Pitcher's mound
    parts.append(
        f'  <ellipse fill="#b89060" cx="{pmx}" cy="{pmy}" rx="13" ry="11"/>'
    )

    # Base paths (diamond)
    b2r, b1r, b3r = (round(b2x,1), round(b2y,1)), (round(b1x,1), round(b1y,1)), (round(b3x,1), round(b3y,1))
    hp_r = (round(hp[0],1), round(hp[1],1))
    parts.append(
        f'  <polygon fill="none" stroke="#a87848" stroke-width="2"\n'
        f'           points="{hp_r[0]},{hp_r[1]} {b1r[0]},{b1r[1]} {b2r[0]},{b2r[1]} {b3r[0]},{b3r[1]}"/>'
    )

    # Bases (small rotated squares)
    for bx, by, label in [(b2r[0], b2r[1], '2B'), (b1r[0], b1r[1], '1B'), (b3r[0], b3r[1], '3B')]:
        parts.append(
            f'  <!-- {label} -->\n'
            f'  <rect fill="white" x="{bx-5}" y="{by-5}" width="10" height="10"\n'
            f'        transform="rotate(45 {bx} {by})"/>'
        )

    # Home plate
    parts.append(
        f'  <polygon class="home-plate" fill="white"\n'
        f'           points="{hp[0]},{hp[1]} {hp[0]-9},{hp[1]-10} {hp[0]-9},{hp[1]-20} '
        f'{hp[0]+9},{hp[1]-20} {hp[0]+9},{hp[1]-10}"/>'
    )

    # Foul lines
    parts.append(
        f'  <line class="foul-line" stroke="white" stroke-width="1.5" stroke-opacity="0.6"\n'
        f'        x1="{hp[0]}" y1="{hp[1]}" x2="{lfe[0]}" y2="{lfe[1]}"/>'
    )
    parts.append(
        f'  <line class="foul-line" stroke="white" stroke-width="1.5" stroke-opacity="0.6"\n'
        f'        x1="{hp[0]}" y1="{hp[1]}" x2="{rfe[0]}" y2="{rfe[1]}"/>'
    )

    return '\n'.join(parts)
