"""v0.48 (Darren, 25 Oct): tap the little cloud after 'Lite' = save to Google Drive now. Fake Google, fake data only."""
from test_v038 import backups, TODAY
from test_v040 import google


def sign(page):
    return page.locator(".demohead .tagline .savesign")


def test_tap_cloud_saves_now(page, base):
    d = google(page)
    from test_v038 import connect
    connect(page, base)
    page.goto(base + TODAY)
    assert len(backups(d)) == 0 and not d.get("patches")
    sign(page).click()
    page.wait_for_function("localStorage.getItem('lite_drive_last')")
    assert len(backups(d)) == 1
    assert page.evaluate("scrollY") == 0 and "?today=" in page.url      # no 'back to the top' link jump


def test_tap_cloud_with_no_token_reconnects_then_saves(page, base):
    d = google(page)
    from test_v038 import connect
    connect(page, base)
    page.evaluate("sessionStorage.removeItem('lite_drive_token')")      # a new visit: the hour is up
    page.goto(base + TODAY)
    sign(page).click()
    page.wait_for_function("localStorage.getItem('lite_drive_last')")
    assert len(backups(d)) == 1
    asks = page.evaluate("window.__asks")
    assert asks and all(a["prompt"] == "" for a in asks)               # the quiet way, no account picker


def test_cloud_is_a_button_with_a_tap_label(page, base):
    google(page)
    from test_v038 import connect
    connect(page, base)
    page.goto(base + TODAY)
    s = sign(page)
    assert s.get_attribute("role") == "button"
    assert "tap to save" in (s.get_attribute("title") or "").lower()
    s.focus()
    page.keyboard.press("Enter")
    page.wait_for_function("localStorage.getItem('lite_drive_last')")
