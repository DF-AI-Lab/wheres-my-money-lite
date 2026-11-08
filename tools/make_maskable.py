"""Make docs/icon-maskable-512.png from docs/icon-512.png (run: python3 tools/make_maskable.py).
Android may crop a maskable icon to a circle, so the icon is shrunk to 80% and centred on a full square of its own
background teal: nothing important sits outside the safe zone."""
from pathlib import Path
from PIL import Image

DOCS = Path(__file__).resolve().parent.parent / "docs" / "demo"
icon = Image.open(DOCS / "icon-512.png").convert("RGBA")
teal = icon.getpixel((20, 256))                     # background teal, left edge, middle (15, 110, 92)
small = icon.resize((410, 410), Image.LANCZOS)      # 80% of 512
out = Image.new("RGBA", (512, 512), teal)
out.alpha_composite(small, ((512 - 410) // 2, (512 - 410) // 2))
out.save(DOCS / "icon-maskable-512.png")
