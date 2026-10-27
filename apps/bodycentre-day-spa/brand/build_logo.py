"""
Rebuilds the BodyCentre logo as clean, flat vectors from their chrome raster.

The original (brand/logo-original.png, from bodycentredayspa.com) is a beveled
chrome render with glow, which traces badly. So the same design is rebuilt in
the original's pixel coordinates: a fitted ring; the B set in Cinzel (a
Trajan-style face like the original's); the C drawn from scratch as one
variable-width stroke with a diagonal, engraved stress that runs behind the B
and turns into the vine; two constructed leaves with a midrib; and the
wordmark with each Cinzel glyph centered on the matching original glyph.

Outputs: public/brand/logo.svg, mark.svg, logo.png, and public/favicon.png,
apple-touch-icon.png, icon-512.png, og-default.png.

Run: uv run --with fonttools python3 brand/build_logo.py   (needs rsvg-convert)
     add --overlay to write brand/.work/overlay.svg over the original for alignment
"""

import math
import subprocess
import sys
import urllib.request
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = Path(__file__).parent
SITE = HERE.parent
WORK = HERE / ".work"
FONT = WORK / "Cinzel.ttf"
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf"
INK = "#28364a"  # --brand-slate
WEIGHT = 500

WORK.mkdir(exist_ok=True)
if not FONT.exists():
    urllib.request.urlretrieve(FONT_URL, FONT)
font = instancer.instantiateVariableFont(TTFont(FONT), {"wght": WEIGHT})
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()


def bounds(ch):
    pen = BoundsPen(glyphs)
    glyphs[cmap[ord(ch)]].draw(pen)
    return pen.bounds


def draw(ch, transform):
    pen = SVGPathPen(glyphs)
    glyphs[cmap[ord(ch)]].draw(TransformPen(pen, transform))
    return pen.getCommands()


def fit(ch, box):
    """Glyph scaled so its ink fills box (x0, y0, x1, y1), y down."""
    xmin, ymin, xmax, ymax = bounds(ch)
    x0, y0, x1, y1 = box
    sx, sy = (x1 - x0) / (xmax - xmin), (y1 - y0) / (ymax - ymin)
    return draw(ch, (sx, 0, 0, -sy, x0 - xmin * sx, y1 + ymin * sy))


def word(text, cap_height, baseline, centers):
    s = cap_height / bounds("B")[3]
    parts = []
    for ch, center in zip(text, centers):
        xmin, _, xmax, _ = bounds(ch)
        parts.append(draw(ch, (s, 0, 0, -s, center - (xmin + xmax) / 2 * s, baseline)))
    return " ".join(parts)


def pt(x, y):
    return f"{x:.1f} {y:.1f}"


def outline(center, widths):
    """Closed outline of a variable-width stroke along a sampled centerline."""
    left, right = [], []
    for k, (x, y) in enumerate(center):
        ax, ay = center[max(k - 1, 0)]
        bx, by = center[min(k + 1, len(center) - 1)]
        dx, dy = bx - ax, by - ay
        m = math.hypot(dx, dy) or 1
        nx, ny, w = -dy / m, dx / m, widths[k] / 2
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    return "M " + " L ".join(pt(*q) for q in left + right[::-1]) + " Z"


def c_with_vine():
    """The C and its vine as one stroke: an arc thickest at lower left, then a tapering curve."""
    cx, cy, rm = 668, 515, 164
    start, end = 360 - 48, 62  # top terminal, then around the left to the lower right
    center, widths = [], []
    for k in range(161):
        a = start + (end - start) * k / 160
        center.append((cx + rm * math.cos(math.radians(a)), cy + rm * math.sin(math.radians(a))))
        stress = ((1 + math.cos(math.radians(a - 150))) / 2) ** 1.6
        flare = 1 + 0.9 * max(0.0, 1 - k / 10) ** 2
        widths.append((13 + 30 * stress) * flare)
    tx, ty = math.sin(math.radians(end)), -math.cos(math.radians(end))
    p0 = center[-1]
    p1, p2, p3 = (p0[0] + tx * 70, p0[1] + ty * 70), (868, 566), (870, 478)
    w0 = widths[-1]
    for k in range(1, 61):
        t = k / 60
        center.append(tuple((1 - t) ** 3 * p0[i] + 3 * (1 - t) ** 2 * t * p1[i] + 3 * (1 - t) * t * t * p2[i] + t**3 * p3[i] for i in (0, 1)))
        widths.append(w0 + (5 - w0) * t**0.8)
    return outline(center, widths)


def leaf(base, tip, half_width, bend):
    """An almond leaf from base to tip, and its midrib."""
    (bx, by), (tx, ty) = base, tip
    dx, dy = tx - bx, ty - by
    length = math.hypot(dx, dy)
    nx, ny = -dy / length, dx / length

    def at(t, offset):
        o = offset + bend * length * 4 * t * (1 - t)
        return (bx + dx * t + nx * o, by + dy * t + ny * o)

    body = f"M {pt(bx, by)} C {pt(*at(0.22, half_width * 1.4))} {pt(*at(0.74, half_width))} {pt(tx, ty)} C {pt(*at(0.74, -half_width))} {pt(*at(0.22, -half_width * 1.4))} {pt(bx, by)} Z"
    rib = f"M {pt(*at(0.06, 0))} C {pt(*at(0.4, 0))} {pt(*at(0.7, 0))} {pt(*at(0.9, 0))}"
    return body, rib


# Geometry in the original's coordinates (1254 x 911).
CX, CY, R = 622, 410, 346
B = fit("B", (380, 190, 620, 500))
C = c_with_vine()
LEAVES = [leaf((870, 482), (836, 338), 46, 0.07), leaf((852, 584), (936, 522), 31, -0.08)]
LETTERS = [(53, 147), (177, 279), (308, 407), (424, 521), (537, 637), (670, 746), (777, 877), (899, 984), (1012, 1104), (1122, 1197)]
WORDMARK = word("BodyCentre", 115, 888, [(a + b) / 2 for a, b in LETTERS])


def svg(view_box, wordmark=True, overlay=False):
    x, y, w, h = view_box
    under = f'<image href="{(HERE / "logo-original.png").resolve().as_uri()}" width="1254" height="911" opacity="0.45"/>' if overlay else ""
    text = f'<path d="{WORDMARK}"/>' if wordmark else ""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {w} {h}" role="img" aria-label="BodyCentre">
{under}<defs>
<mask id="bc-behind" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="911"><rect width="1254" height="911" fill="#fff"/><path d="{B}" stroke="#000" stroke-width="16" stroke-linejoin="round"/></mask>
<mask id="bc-ribs" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="911"><rect width="1254" height="911" fill="#fff"/><g fill="none" stroke="#000" stroke-width="3" stroke-linecap="round">{"".join(f'<path d="{rib}"/>' for _, rib in LEAVES)}</g></mask>
</defs>
<g fill="{INK}">
<circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="{INK}" stroke-width="5"/>
<path d="{B}"/>
<path d="{C}" mask="url(#bc-behind)"/>
<path d="{" ".join(body for body, _ in LEAVES)}" mask="url(#bc-ribs)"/>
{text}</g>
</svg>
"""


LOGO_BOX = (45, 55, 1165, 845)
MARK_BOX = (CX - R - 6, CY - R - 6, 2 * R + 12, 2 * R + 12)
brand = SITE / "public" / "brand"
if "--overlay" in sys.argv:
    (WORK / "overlay.svg").write_text(svg((0, 0, 1254, 911), overlay=True))
(brand / "logo.svg").write_text(svg(LOGO_BOX))
(brand / "mark.svg").write_text(svg(MARK_BOX, wordmark=False))
subprocess.run(["rsvg-convert", "-b", "white", "-w", "640", str(brand / "logo.svg"), "-o", str(brand / "logo.png")], check=True)
for name, size, scale in (("favicon.png", 64, 0.92), ("apple-touch-icon.png", 180, 0.8), ("icon-512.png", 512, 0.8)):
    subprocess.run(["rsvg-convert", "-b", "white", "-w", str(int(size * scale)), str(brand / "mark.svg"), "-o", str(WORK / name)], check=True)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(WORK / name), "-vf", f"pad={size}:{size}:(ow-iw)/2:(oh-ih)/2:white", str(SITE / "public" / name)], check=True)
subprocess.run(["rsvg-convert", "-b", "#fbf8f4", "-h", "460", str(brand / "logo.svg"), "-o", str(WORK / "og-logo.png")], check=True)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=0xfbf8f4:s=1200x630", "-i", str(WORK / "og-logo.png"), "-filter_complex", "overlay=(W-w)/2:(H-h)/2", "-frames:v", "1", str(SITE / "public" / "og-default.png")], check=True)
