"""v0.58 (Darren, 28 Oct): a new person is pushed to turn on Google Drive. Straight after the first passcode and the
backup codes: '☁️ Keep your money safe' -> Connect Google Drive (a link to make a Google account with your own email),
or Skip for now (with a warning). While Drive is off the 🔔 bell says 'Not backed up'. A Google account that already
holds a copy is not used (it would be written over). Fake data only."""
from conftest import _context, _page, post, sheet, PIN, DEMO
from test_gob6 import step, app_shown
from test_v045 import Drive, TODAY
from test_v057 import wiped, phone_with_copy


def new_person(pg, base):
    pg.goto(base + TODAY)
    pg.click("#imnew")
    pg.fill("#pinform #pin", PIN); pg.fill("#pinform #again", PIN)
    pg.click("#pinform button[type=submit]")
    pg.wait_for_selector('#lock[data-step="codes"]')
    pg.click("#codesdone")


def bell_kinds(pg):
    pg.click("#bellbtn")
    return pg.eval_on_selector_all("#bellmenu .remind", "els => els.map(e => e.dataset.kind)")


def test_after_the_codes_comes_keep_your_money_safe(browser, base):
    d = Drive()
    ctx, pg = wiped(browser, d)
    new_person(pg, base)
    assert step(pg) == "drive"
    assert not app_shown(pg)
    assert pg.locator("#drivego").is_visible()
    link = pg.locator('#lock [data-for="drive"] a[href*="accounts.google.com/signup"]')
    assert link.is_visible() and "own email" in link.inner_text()
    assert "loses everything" in pg.locator('#lock [data-for="drive"]').inner_text()
    assert not pg.errors
    d.close()


def test_connect_turns_drive_on_and_sends_the_first_copy(browser, base):
    d = Drive()
    ctx, pg = wiped(browser, d)
    new_person(pg, base)
    with pg.expect_navigation():
        pg.click("#drivego")
    pg.wait_for_load_state()
    assert app_shown(pg)
    assert pg.evaluate("localStorage.getItem('lite_drive_on')") == "1"
    pg.locator("body").click(position={"x": 5, "y": 5})               # the quiet reconnect after the reload
    pg.wait_for_function("() => true")
    for _ in range(40):
        if d.newest():
            break
        pg.wait_for_timeout(100)
    assert d.newest() and "scrambled" in d.newest()["text"]
    assert "drive" not in bell_kinds(pg)
    assert not pg.errors
    d.close()


def test_skip_goes_in_and_the_bell_says_not_backed_up(browser, base):
    d = Drive()
    ctx, pg = wiped(browser, d)
    new_person(pg, base)
    pg.click("#driveskip")
    assert app_shown(pg)
    assert not pg.evaluate("localStorage.getItem('lite_drive_on')")
    assert "drive" in bell_kinds(pg)
    row = pg.locator('#bellmenu .remind[data-kind="drive"]')
    assert "Not backed up" in row.inner_text()
    row.locator(".remgo").click()
    pg.wait_for_url("**view=drive*")
    assert not pg.errors
    d.close()


def test_a_google_account_with_a_copy_is_not_written_over(browser, base):
    d = Drive()
    phone_with_copy(browser, base, d)
    before = d.newest()["text"]
    ctx, pg = wiped(browser, d)
    new_person(pg, base)
    pg.click("#drivego")
    pg.wait_for_selector("#lockerr:not([hidden])")
    assert "already a copy" in pg.locator("#lockerr").inner_text()
    assert step(pg) == "drive"
    assert not pg.evaluate("localStorage.getItem('lite_drive_on')")
    pg.click("#driveskip")
    post(pg, 'form[action="/add"]', {"amount": "1", "name": "NewThing"})
    pg.wait_for_timeout(800)
    assert d.newest()["text"] == before
    assert not pg.errors
    d.close()


def test_new_backup_codes_from_settings_do_not_ask_about_drive(page, base):
    page.goto(base + TODAY)
    page.click("#setbtn"); page.click("#newcodes")
    sheet(page, True)
    page.wait_for_selector('#lock[data-step="codes"]')
    page.click("#codesdone")
    assert app_shown(page)


def test_the_demo_has_no_drive_nag(browser, base):
    ctx = _context(browser, seed_lock=False, unlocked=False)
    pg = _page(ctx)
    pg.goto(base + DEMO)
    pg.click("#bellbtn")
    assert pg.locator('#bellmenu .remind[data-kind="drive"]').count() == 0
    ctx.close()
