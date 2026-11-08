"""v0.52 (Darren, 25 Oct, mock https://claude.ai/artifact/1zmePagXQfUQeVn8QTFX5S): pots in Bills count down
(spent / amount, blue under, red over, a bar), Settings + bell squared up (bell under Settings, version beside it),
a thin menu scroll bar with no side scroll, and an ⓘ by Google Drive (no Google account? make one)."""
import json
from conftest import DEMO, _context, _page


def _money(t):
    return float(t.replace("£", "").replace(",", ""))


def test_pot_rows_show_spent_of_amount(page, base):
    page.goto(base + DEMO)
    shop = page.locator('tr.potbill[data-pot="Shopping"]')
    spent = _money(shop.locator(".potspent").inner_text())
    assert shop.locator("button.link").inner_text() == "£400.00"        # tap the amount = change the pot (as before)
    assert "/" in shop.locator("td.bamt").inner_text()
    sub = shop.locator(".bsub").inner_text()
    left = 400 - spent
    assert sub.startswith("Pots · ") and (f"£{left:,.2f} left" in sub if left >= 0 else "over" in sub), sub
    w = shop.locator(".potbar i").evaluate("e => e.style.width")
    assert w.endswith("%")
    assert page.locator('tr.potbill[data-pot="Going out"] .potspent').count() == 0   # no amount yet = just 'Add'


def test_pot_over_goes_red(page, base):
    page.goto(base + DEMO)
    page.evaluate("""() => { const k = 'lite_demo_v1'; const s = JSON.parse(sessionStorage.getItem(k));
        s.pots.find(p => p.key === 'Fuel').amount = 1; sessionStorage.setItem(k, JSON.stringify(s)); }""")
    page.reload()
    fuel = page.locator('tr.potbill[data-pot="Fuel"]')                  # £60 spent of £1
    assert "over" in (fuel.get_attribute("class") or "")
    assert "£59.00 over" in fuel.locator(".bsub").inner_text()
    red = fuel.locator(".potspent").evaluate("e => getComputedStyle(e).color")
    blue = page.locator('tr.potbill[data-pot="Shopping"] .potspent').evaluate("e => getComputedStyle(e).color")
    assert red != blue


def test_bell_sits_under_settings_squared(page, base):
    page.set_viewport_size({"width": 390, "height": 800})
    page.goto(base + DEMO)
    s = page.locator("#setbtn").bounding_box()
    b = page.locator("#bellbtn").bounding_box()
    v = page.locator(".appver").bounding_box()
    assert b["y"] >= s["y"] + s["height"] + 6                     # under Settings, with space
    assert abs(b["x"] - s["x"]) <= 8                              # bell lines up with the left of Settings
    assert abs((v["x"] + v["width"]) - (s["x"] + s["width"])) <= 8  # version lines up with the right
    assert page.locator("#setbtn svg").count() == 1 and page.locator("#bellbtn svg").count() == 1


def test_menu_has_no_side_scroll(page, base):
    page.set_viewport_size({"width": 390, "height": 500})
    page.goto(base + DEMO)
    page.click("#setbtn")
    m = page.locator("#setmenu")
    assert m.evaluate("e => getComputedStyle(e).overflowX") == "hidden"
    assert m.evaluate("e => e.scrollWidth <= e.clientWidth + 1")


def test_drive_info_and_email_own_line(browser, base):
    ctx = _context(browser)
    ctx.add_init_script("localStorage.setItem('lite_drive_on', '1'); localStorage.setItem('lite_drive_email', 'fake.person@example.com');")
    page = _page(ctx)
    page.set_viewport_size({"width": 390, "height": 800})
    page.goto(base + "?today=2024-11-08")
    page.click("#setbtn")
    if not page.locator("#setmenu").is_visible():                  # the test browser has no Google: the 1st tap can be eaten
        page.click("#setbtn")
    info = page.locator("#driveinfo")
    assert info.is_visible() and info.get_attribute("aria-expanded") == "false"
    assert not page.locator("#drivenote").is_visible()
    info.click()
    note = page.locator("#drivenote")
    assert note.is_visible() and "accounts.google.com/signup" in note.locator("a").get_attribute("href")
    assert info.get_attribute("aria-expanded") == "true"
    assert page.locator("#setmenu").is_visible()                    # the ⓘ does not open the Drive page
    email = page.locator("#drivelink .sub .mail")
    assert email.inner_text() == "fake.person@example.com"
    assert email.evaluate("e => getComputedStyle(e).display") == "block"   # its own line
    ctx.close()


def test_demo_hides_drive_info(page, base):
    page.goto(base + DEMO)
    page.click("#setbtn")
    if page.locator("#drivelink").is_hidden():
        assert page.locator("#driveinfo").is_hidden()
