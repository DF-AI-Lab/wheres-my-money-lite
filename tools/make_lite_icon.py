"""Make the home-screen icons with a mint LITE tag (v0.29, mock B), so the installed Lite app is easy to tell from the
old v3 app: docs/demo/lite-192.png, lite-512.png, lite-maskable-512.png (run: python3 tools/make_lite_icon.py).
The page header keeps the plain icon-192.png."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DOCS = Path(__file__).resolve().parent.parent / "docs" / "demo"
MINT, DARK = (63, 208, 164, 255), (15, 60, 50, 255)
FONTS = ["/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]


def font(n):
    for f in FONTS:
        try:
            return ImageFont.truetype(f, n)
        except OSError:
            pass
    raise SystemExit("no bold font found")


def tag(src, out, box):
    im = Image.open(DOCS / src).convert("RGBA").resize((512, 512), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = box
    d.rounded_rectangle(box, (y1 - y0) // 2, fill=MINT)
    d.text(((x0 + x1) / 2, (y0 + y1) / 2 + 1), "LITE", font=font(round((y1 - y0) * 0.7)), fill=DARK, anchor="mm")
    return im


plain = tag("icon-512.png", "lite-512.png", (146, 372, 366, 432))
plain.save(DOCS / "lite-512.png")
plain.resize((192, 192), Image.LANCZOS).save(DOCS / "lite-192.png")
tag("icon-maskable-512.png", "lite-maskable-512.png", (166, 350, 346, 400)).save(DOCS / "lite-maskable-512.png")
print("made lite-192.png, lite-512.png, lite-maskable-512.png")
