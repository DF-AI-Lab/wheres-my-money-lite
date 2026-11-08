"""v0.40 (Darren, 24 Oct): Drive fixes + the save sign (mock A). Fake Google only, fake data only.
1) 'last saved' in UK time (not UTC)  2) the Gmail is remembered and given to Google (login_hint)
3) a save 1 minute after the last change  4) a change not sent goes after the next visit's quiet reconnect
5) a little cloud after 'Lite': saved = tick, saving = arrow, waiting = amber dot."""
import json

import pytest

from conftest import post, _context, _page
from test_v037 import hide
from test_v038 import drive, connect, backups, TODAY, GSI

EMAIL = "fake.person@example.com"
HINT_GSI = """window.__asks = []; window.google = {accounts: {oauth2: {initTokenClient: cfg => ({requestAccessToken: o => {
    window.__asks.push({prompt: (o && o.prompt) === undefined ? 'full' : o.prompt, hint: (o && o.login_hint) || cfg.login_hint || ''});
    setTimeout(() => cfg.callback({access_token: 'tok123', expires_in: 3600}), 10); }})}}};"""


def google(page, wait=60000):
    """drive() plus: the sign-in records the login_hint, about = the fake Gmail, the 1-minute wait shortened."""
    d = drive(page)
    page.route(GSI + "*", lambda r: r.fulfill(status=200, content_type="text/javascript", body=HINT_GSI))
    page.route("https://www.googleapis.com/drive/v3/about*", lambda r: r.fulfill(
        status=200, content_type="application/json", body=json.dumps({"user": {"emailAddress": EMAIL}})))
    page.add_init_script("window.LITE_DRIVE_WAIT = %d;" % wait)
    return d


@pytest.fixture
def london(browser):
    ctx = _context(browser, timezone_id="Europe/London")
    yield _page(ctx)
    ctx.close()


# ---------- 1. the time ----------

def test_last_saved_shows_uk_time(london, base):
    page = london
    google(page)
    connect(page, base)
    page.evaluate("localStorage.setItem('lite_drive_last', '2024-10-24T18:19:00.000Z')")   # summer time: 19:19 in the UK
    page.reload()
    assert "19:19" in page.locator("#drivelast").inner_text()
    page.evaluate("localStorage.setItem('lite_drive_last', '2024-11-08T18:19:00.000Z')")   # winter: the same as UTC
    page.reload()
    assert "18:19" in page.locator("#drivelast").inner_text()


# ---------- 2. the Gmail ----------

def test_remembers_the_gmail_and_gives_it_to_google(page, base):
    google(page)
    connect(page, base)
    page.wait_for_function("localStorage.getItem('lite_drive_email')")
    assert page.evaluate("localStorage.getItem('lite_drive_email')") == EMAIL
    page.evaluate("sessionStorage.removeItem('lite_drive_token')")      # a new visit
    page.goto(base + TODAY)
    page.mouse.click(5, 400)
    page.wait_for_function("sessionStorage.getItem('lite_drive_token')")
    asks = page.evaluate("window.__asks")
    assert asks == [{"prompt": "", "hint": EMAIL}]                      # quiet, and Google knows which account


# ---------- 3. one minute after a change ----------

def test_saves_a_minute_after_the_last_change(page, base):
    d = google(page, wait=400)
    connect(page, base)
    page.goto(base + TODAY)
    post(page, 'form[action="/add"]', {"amount": "3", "name": "Soon"})
    page.wait_for_timeout(1500)                                         # no hide: a PC window left open
    assert len(backups(d)) == 1
    assert not page.evaluate("localStorage.getItem('lite_drive_dirty')")


def test_no_save_before_the_minute(page, base):
    d = google(page)
    connect(page, base)
    page.goto(base + TODAY)
    post(page, 'form[action="/add"]', {"amount": "3", "name": "Wait"})
    page.wait_for_timeout(800)
    assert backups(d) == []


# ---------- 4. a change not sent goes next visit ----------

def test_a_change_not_sent_goes_after_the_quiet_reconnect(page, base):
    d = google(page)
    connect(page, base)
    page.goto(base + TODAY)
    post(page, 'form[action="/add"]', {"amount": "3", "name": "Later"})
    page.evaluate("sessionStorage.removeItem('lite_drive_token')")      # the app closed before it was sent
    page.goto(base + TODAY)
    assert backups(d) == []
    page.mouse.click(5, 400)                                            # the next visit's first tap
    page.wait_for_timeout(1200)
    assert len(backups(d)) == 1
    assert not page.evaluate("localStorage.getItem('lite_drive_dirty')")


# ---------- 5. the save sign ----------

def sign(page):
    return page.locator(".demohead .tagline .savesign")


def test_no_sign_without_drive(page, base):
    page.goto(base + TODAY)
    assert sign(page).count() == 1 and sign(page).is_hidden()


def test_sign_saved_waiting_saving(page, base):
    d = google(page)
    connect(page, base)
    page.goto(base + TODAY)
    s = sign(page)
    assert s.is_visible() and "saved" in s.get_attribute("class")      # nothing changed: Drive has the latest
    post(page, 'form[action="/add"]', {"amount": "3", "name": "Sign"})
    assert "wait" in s.get_attribute("class")                           # a change not sent yet = amber dot
    page.evaluate("""() => { window.__seen = []; const el = document.querySelector('.savesign');
        new MutationObserver(() => window.__seen.push(el.className)).observe(el, {attributes: true}); }""")
    hide(page)
    page.wait_for_timeout(600)
    seen = page.evaluate("window.__seen")
    assert any("saving" in c for c in seen), seen                       # the arrow while it goes up
    assert "saved" in s.get_attribute("class") and "wait" not in s.get_attribute("class")
    assert len(backups(d)) == 1
    assert "Drive" in s.get_attribute("aria-label")


def test_sign_still_with_reduced_motion(page, base):
    google(page)
    connect(page, base)
    page.emulate_media(reduced_motion="reduce")
    page.goto(base + TODAY)
    page.evaluate("document.querySelector('.savesign').className = 'savesign saving'")
    dur = page.evaluate("getComputedStyle(document.querySelector('.savesign .arr')).animationDuration")
    assert dur in ("0s", "1e-05s") or float(dur.rstrip("s")) < 0.01
