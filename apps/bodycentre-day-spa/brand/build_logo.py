"""
Rebuilds the BodyCentre logo as clean, flat vectors from their chrome raster.

The original (brand/logo-original.png, from bodycentredayspa.com) is a beveled
chrome render with glow, which traces badly. So the same design is rebuilt from
parts, in the original's pixel coordinates: a fitted ring, B and C set in Cinzel
(a Trajan-style face like the original's), the C thinned and cut where it
crosses the B, hand-drawn leaves and stem, and the wordmark with each Cinzel
glyph centered on the matching original glyph.

Outputs: public/brand/logo.svg, mark.svg, logo.png, and public/favicon.png,
apple-touch-icon.png, icon-512.png, og-default.png.

Run: uv run --with fonttools python3 brand/build_logo.py   (needs rsvg-convert)
     add --overlay to write brand/.work/overlay.svg over the original for alignment
"""

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


# Geometry measured on the original (1254 x 911).
CX, CY, R = 622, 410, 346
B = fit("B", (378, 186, 652, 505))
C = fit("C", (498, 338, 838, 692))
LETTERS = [(53, 147), (177, 279), (308, 407), (424, 521), (537, 637), (670, 746), (777, 877), (899, 984), (1012, 1104), (1122, 1197)]
WORDMARK = word("BodyCentre", 115, 888, [(a + b) / 2 for a, b in LETTERS])
STEM = "M 742 676 C 790 660 812 620 806 575 C 803 548 812 532 830 522"
LEAF1 = "M 788 588 C 728 560 716 470 746 396 C 790 445 808 520 788 588 Z"
VEIN1 = "M 786 578 C 770 530 760 472 750 414"
LEAF2 = "M 832 600 C 836 560 866 532 916 535 C 904 580 876 606 832 600 Z"
VEIN2 = "M 838 594 C 860 575 885 556 908 540"


def svg(view_box, wordmark=True, overlay=False):
    x, y, w, h = view_box
    under = f'<image href="{(HERE / "logo-original.png").resolve().as_uri()}" width="1254" height="911" opacity="0.45"/>' if overlay else ""
    text = f'<path d="{WORDMARK}"/>' if wordmark else ""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {w} {h}" role="img" aria-label="BodyCentre">
{under}<defs>
<mask id="bc-thin" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="911"><path d="{C}" fill="#fff" stroke="#000" stroke-width="16"/></mask>
<mask id="bc-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="911"><rect width="1254" height="911" fill="#fff"/><path d="{C}" stroke="#000" stroke-width="18"/></mask>
<mask id="bc-veins" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="911"><rect width="1254" height="911" fill="#fff"/><g fill="none" stroke="#000" stroke-linecap="round"><path d="{VEIN1}" stroke-width="5"/><path d="{VEIN2}" stroke-width="4"/></g></mask>
</defs>
<g fill="{INK}">
<circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="{INK}" stroke-width="5"/>
<path d="{B}" mask="url(#bc-cut)"/>
<path d="{C}" mask="url(#bc-thin)"/>
<path d="{STEM}" fill="none" stroke="{INK}" stroke-width="7" stroke-linecap="round"/>
<g mask="url(#bc-veins)"><path d="{LEAF1}"/><path d="{LEAF2}"/></g>
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
