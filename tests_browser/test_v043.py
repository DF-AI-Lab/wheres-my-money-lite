"""v0.43 (Darren, 25 Oct, Lock 1 mock): the lock screen says 'Hi <name> 👋' so it feels like your own app, not a
random door. The first name is typed with the first passcode (optional), kept on this phone only. Fake names only."""
from conftest import PIN, _context, _page
from test_gob6 import step, unlock

TODAY = "?today=2024-11-08"


# v0.61 (on purpose): the lock is 🛂 Passport now: it greets with the passport's name ('Welcome back, Sam').
# The name on the Account page is this phone's own (default: the passport's first name).

def test_the_lock_greets_with_the_passport_name(locked, base):
    locked.goto(base + TODAY)
    assert "Welcome back, Sam" in step(locked)
    unlock(locked)


def test_a_name_is_not_html(browser, base):
    ctx = _context(browser)
    ctx.add_init_script("localStorage.setItem('lite_name', '<b>Al</b>');")
    pg = _page(ctx)
    pg.goto(base + TODAY); pg.click("#setbtn")
    assert pg.locator("#acclink .sub").inner_text() == "<b>Al</b>"
    assert pg.locator("#acclink b").count() == 0
    ctx.close()


# ---------- 👤 Account page (mock B) ----------
from test_v040 import google, EMAIL  # noqa: E402


def test_account_line_in_the_menu(browser, base):
    ctx = _context(browser)
    pg = _page(ctx)
    pg.goto(base + TODAY); pg.click("#setbtn")
    assert pg.locator("#acclink .sub").inner_text() == "Sam"           # v0.61: the passport's first name
    ctx.add_init_script("localStorage.setItem('lite_name', 'Sam'); localStorage.setItem('lite_drive_on', '1');"
                        "localStorage.setItem('lite_drive_email', 'fake.person@example.com');")
    pg.goto(base + TODAY); pg.click("#setbtn")
    assert pg.locator("#acclink .sub").inner_text() == "Sam · fake.person@example.com"
    ctx.close()


def test_account_page_saves_the_name_for_the_lock(page, base):
    page.goto(base + TODAY + "&view=account")
    assert page.locator("#account").is_visible()
    assert page.locator("#accstate").inner_text().strip() == "Off"
    page.fill("#accname", " Robin ")
    page.click("#nameform button[type=submit]")
    assert page.locator("#nameok").is_visible()
    assert page.evaluate("localStorage.getItem('lite_name')") == "Robin"
    page.goto(base + TODAY); page.click("#setbtn")
    assert page.locator("#acclink .sub").inner_text() == "Robin"
    assert not page.errors


def test_account_drive_on_shows_gmail_and_turn_off(browser, base):
    ctx = _context(browser)
    ctx.add_init_script("if (!sessionStorage.getItem('t1')) { sessionStorage.setItem('t1', '1'); localStorage.setItem('lite_drive_on', '1');"
                        "localStorage.setItem('lite_drive_email', 'fake.person@example.com'); }")
    pg = _page(ctx)
    google(pg)                                                       # a fake Google (no real sign-in popup)
    pg.goto(base + TODAY + "&view=account")
    st = pg.locator("#accstate").inner_text()
    assert "On" in st and "fake.person@example.com" in st, st
    assert pg.locator("#accswitch").is_hidden() and pg.locator("#accconnect").is_hidden()   # v0.61: Passport's Sign out instead
    assert "Sign out" in pg.locator("#acchint").inner_text()
    pg.click("#accoff")
    assert pg.locator("#accstate").inner_text().strip() == "Off"
    assert pg.evaluate("[localStorage.getItem('lite_drive_on'), localStorage.getItem('lite_drive_email')]") == [None, None]
    assert pg.locator("#accconnect").is_visible()
    ctx.close()


def test_another_google_account_than_before_gets_fresh_files_on_the_first_passport_unlock(browser, base):
    """v0.61 (on purpose): no 'Use another Google account' button; the passport's Google account is the Drive account.
    WMM's old Drive account was another one: its file ids are dropped and the money goes to the passport's Drive."""
    ctx = _context(browser, unlocked=False)
    ctx.add_init_script("if (!sessionStorage.getItem('t2')) { sessionStorage.setItem('t2', '1'); localStorage.setItem('lite_drive_on', '1');"
                        "localStorage.removeItem('lite_drive_ppseen');"
                        "localStorage.setItem('lite_state_v1', JSON.stringify({v: 3, pay: 100, left: 0, bills: [], pots: [], spends: [], history: [], cards: []}));"
                        "localStorage.setItem('lite_drive_email', 'old.person@example.com');"
                        "localStorage.setItem('lite_drive_file', JSON.stringify({name: 'x', id: 'OLD'})); }")
    pg = _page(ctx)
    google(pg)
    pg.goto(base + TODAY)
    unlock(pg)
    assert pg.evaluate("localStorage.getItem('lite_drive_email')") == EMAIL
    assert pg.evaluate("localStorage.getItem('lite_drive_file')") is None
    assert pg.evaluate("!!localStorage.getItem('lite_drive_dirty')")
    assert pg.evaluate("localStorage.getItem('lite_drive_restore')") is None     # money here: nothing to get back
    assert not pg.errors
    ctx.close()
