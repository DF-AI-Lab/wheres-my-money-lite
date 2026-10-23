"""v0.33 (Darren, 23 Oct): a privacy page, so Google lets the Drive sign-in be published for everyone (friends too).
It says plainly where the data lives and what the app can see in Google Drive. Fake data only."""
import re
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent / "docs" / "demo"


def test_privacy_page_says_what_google_needs_to_know():
    html = (DOCS / "privacy.html").read_text()
    text = re.sub(r"<[^>]+>", " ", html).lower()
    assert "<title>" in html and "privacy" in text
    for words in ["this browser", "no account", "google drive", "drive.file", "scrambled", "passcode",
                  "no ads", "remove", "myaccount.google.com/permissions", "github.com/df-ai-lab/wheres-my-money-lite"]:
        assert words in text, words
    assert not re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text)          # no email address on a public page


def test_privacy_page_looks_like_the_app_and_fits_a_phone(page, base):
    page.goto(base.replace("index.html", "privacy.html"))
    assert page.locator("h1").inner_text().strip()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    assert page.locator('a[href="./"]').count() >= 1                  # a way back to the app
    assert not page.errors


def test_drive_view_links_to_the_privacy_page(page, base):
    page.goto(base + "?today=2024-11-08&view=drive")
    link = page.locator('#drive a[href="privacy.html"]')
    assert link.count() == 1 and link.is_visible()


def test_privacy_page_works_offline_too():
    assert "'privacy.html'" in (DOCS / "sw.js").read_text()


def test_privacy_page_is_readable_in_dark_mode(browser, base):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark")
    pg = ctx.new_page()
    pg.goto(base.replace("index.html", "privacy.html"))
    bg = pg.evaluate("getComputedStyle(document.body).backgroundColor")
    fg = pg.evaluate("getComputedStyle(document.querySelector('.pp h2 + p')).color")
    lum = lambda c: sum(int(x) for x in c[c.index('(') + 1:c.index(')')].split(',')[:3]) / 3
    assert lum(bg) < 60 and lum(fg) > 180, (bg, fg)                   # dark page, light words
    ctx.close()
