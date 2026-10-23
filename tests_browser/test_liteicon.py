"""v0.29 (Darren, 22 Oct, mock B): the installed Lite app looks different from the old v3 app (same lens icon, same name
before): its home-screen icons carry a mint LITE tag and it is called "My Money Lite". The page header keeps the plain icon."""
import json
import re
from pathlib import Path

from PIL import Image

DOCS = Path(__file__).resolve().parent.parent / "docs" / "demo"
MINT = (63, 208, 164)


def _manifest():
    return json.loads((DOCS / "manifest.json").read_text())


def test_home_screen_name_says_lite():
    assert _manifest()["short_name"] == "My Money Lite"


def test_home_screen_icons_are_the_lite_ones():
    icons = [i["src"] for i in _manifest()["icons"]]
    assert icons == ["lite-192.png", "lite-512.png", "lite-maskable-512.png"]
    html = (DOCS / "index.html").read_text()
    assert '<link rel="apple-touch-icon" href="lite-192.png">' in html
    sw = (DOCS / "sw.js").read_text()
    for f in icons:
        assert f"'{f}'" in sw, f                                   # kept offline too


def _mint_rows(f):
    im = Image.open(DOCS / f).convert("RGB")
    s = im.width / 512
    return [y for y in range(im.height) if sum(1 for x in range(im.width)
            if all(abs(a - b) < 20 for a, b in zip(im.getpixel((x, y)), MINT))) > 40 * s]


def test_each_icon_has_the_tag_near_the_bottom():
    for f in ["lite-192.png", "lite-512.png", "lite-maskable-512.png"]:
        im = Image.open(DOCS / f)
        rows = _mint_rows(f)
        assert [y for y in rows if y > im.height * 0.65], f        # a wide mint tag low down


def test_maskable_tag_sits_in_the_safe_circle():
    im = Image.open(DOCS / "lite-maskable-512.png").convert("RGB")
    px = im.load()
    for y in range(512):
        for x in range(512):
            if all(abs(a - b) < 20 for a, b in zip(px[x, y], MINT)) and y > 300:
                assert (x - 256) ** 2 + (y - 256) ** 2 <= 205 ** 2, (x, y)   # Android may crop to this circle


def test_header_shows_the_lite_icon():
    # v0.31 (Darren, 23 Oct): the page header shows the Lite icon too, not the plain v3 lens
    html = (DOCS / "index.html").read_text()
    assert re.search(r'class="brand"[^>]*><img src="lite-192.png"', html)
    assert 'lite-192.png' in (DOCS / "sw.js").read_text()        # kept offline too
