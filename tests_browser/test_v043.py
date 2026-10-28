"""v0.43 (Darren, 25 Oct, Lock 1 mock): the lock screen says 'Hi <name> 👋' so it feels like your own app, not a
random door. The first name is typed with the first passcode (optional), kept on this phone only. Fake names only."""
from conftest import PIN, _context, _page
from test_gob6 import step, unlock

TODAY = "?today=2024-11-08"


def test_name_typed_with_the_first_passcode_then_hi_on_the_lock(fresh, base):
    pg = fresh
    pg.goto(base + TODAY)
    pg.click("#imnew")                                              # v0.57: Welcome first
    assert step(pg) == "newpin"
    assert pg.locator("#myname").is_visible()
    pg.fill("#myname", "  Sam ")
    pg.fill("#pinform #pin", PIN); pg.fill("#pinform #again", PIN)
    pg.click("#pinform button[type=submit]")
    pg.wait_for_selector('#lock[data-step="codes"]')
    pg.click("#codesdone")
    pg.click("#driveskip")                                         # v0.58: the Drive step comes next
    assert pg.evaluate("localStorage.getItem('lite_name')") == "Sam"
    pg.click("#setbtn"); pg.click("#locknow")
    assert step(pg) == "unlock"
    assert pg.locator("#lockhi").inner_text().strip() == "Hi Sam 👋"
    assert "Where's My Money?" in pg.locator("#locktag").inner_text()
    assert not pg.errors


def test_no_name_keeps_the_old_title(locked, base):
    locked.goto(base + TODAY)
    assert step(locked) == "unlock"
    assert locked.locator("#lockhi").inner_text().strip() == "Where's My Money?"
    assert "Payday to payday" in locked.locator("#locktag").inner_text()


def test_saved_name_greets_and_is_not_html(browser, base):
    ctx = _context(browser, unlocked=False)
    ctx.add_init_script("localStorage.setItem('lite_name', '<b>Al</b>');")
    pg = _page(ctx)
    pg.goto(base + TODAY)
    assert pg.locator("#lockhi").inner_text().strip() == "Hi <b>Al</b> 👋"
    assert pg.locator("#lockhi b").count() == 0
    unlock(pg)
    ctx.close()


def test_forgot_passcode_reset_has_no_name_box(locked, base):
    from conftest import CODES
    locked.goto(base + TODAY)
    locked.click("#forgot")
    locked.fill("#bcode", CODES[0])
    locked.click("#codeform button[type=submit]")
    locked.wait_for_selector('#lock[data-step="newpin"]')
    assert locked.locator("#myname").is_hidden()


# ---------- 👤 Account page (mock B) ----------
from test_v040 import google, EMAIL  # noqa: E402


def test_account_line_in_the_menu(browser, base):
    ctx = _context(browser)
    pg = _page(ctx)
    pg.goto(base + TODAY); pg.click("#setbtn")
    assert pg.locator("#acclink .sub").inner_text() == "Add your name"
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
    page.goto(base + TODAY); page.click("#setbtn"); page.click("#locknow")
    assert page.locator("#lockhi").inner_text().strip() == "Hi Robin 👋"
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
    assert pg.locator("#accswitch").is_visible() and pg.locator("#accconnect").is_hidden()
    pg.click("#accoff")
    assert pg.locator("#accstate").inner_text().strip() == "Off"
    assert pg.evaluate("[localStorage.getItem('lite_drive_on'), localStorage.getItem('lite_drive_email')]") == [None, None]
    assert pg.locator("#accconnect").is_visible()
    ctx.close()


def test_use_another_google_account_asks_which_and_starts_fresh_files(browser, base):
    ctx = _context(browser)
    ctx.add_init_script("if (!sessionStorage.getItem('t2')) { sessionStorage.setItem('t2', '1'); localStorage.setItem('lite_drive_on', '1');"
                        "localStorage.setItem('lite_drive_email', 'old.person@example.com');"
                        "localStorage.setItem('lite_drive_file', JSON.stringify({name: 'x', id: 'OLD'})); localStorage.setItem('lite_drive_folder', 'OLDDIR'); }")
    pg = _page(ctx)
    google(pg)
    pg.goto(base + TODAY + "&view=account")
    pg.click("#accswitch")
    pg.wait_for_function("localStorage.getItem('lite_drive_email') === '%s'" % EMAIL)
    assert pg.evaluate("window.__asks.map(a => a.prompt)")[-1] == "select_account"   # (the first tap also does the quiet reconnect)
    assert pg.evaluate("[localStorage.getItem('lite_drive_file'), localStorage.getItem('lite_drive_folder')]") == [None, None]
    assert pg.evaluate("!!localStorage.getItem('lite_drive_dirty')")
    assert EMAIL in pg.locator("#accstate").inner_text()
    assert not pg.errors
    ctx.close()
