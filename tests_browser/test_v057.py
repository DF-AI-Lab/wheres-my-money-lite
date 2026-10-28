"""v0.57 (Darren, 28 Oct): the PC's browser storage was wiped and Lite acted like a brand new person ("Choose a
passcode"). A wiped device must ask WHO YOU ARE: Welcome -> 'Sign in with Google' (your Gmail = your username) -> the
app finds your newest Drive copy -> your passcode (or a backup code) opens it -> your money, your passcode and your
codes are back on this device. 'I'm new here' = the old first-passcode step. Nothing is written over the Drive copy
until the money is back. Demo: ?lock=1 tries it as a wiped device (own keys, never live's). Fake data only."""
import json

from conftest import _context, _page, post, stored, PIN, CODES
from test_gob6 import step, app_shown, unlock, lock_rec
from test_v045 import Drive, device, connect, spends, TODAY, CONFIG
from test_v040 import EMAIL
from test_livedemo import site  # noqa: F401  (the whole Pages site: live at /, demo at /demo/)

NAME = "wheres-my-money-backup Nov 2024.json"


def wiped(browser, d):
    """A device with nothing saved (no lock, no money, no Drive keys), the same Google Drive."""
    ctx = _context(browser, seed_lock=False, unlocked=False)
    ctx.add_init_script(CONFIG + "window.LITE_DRIVE_WAIT = 300; window.LITE_SYNC_EVERY = 400;")
    pg = _page(ctx)
    d.attach(pg)
    return ctx, pg


def phone_with_copy(browser, base, d, spend="PhoneSpend"):
    """Darren's phone: set up (PIN / CODES), one spend, its scrambled copy saved to Drive."""
    ctx, pg = device(browser, d)
    pg.goto(base + TODAY)
    post(pg, 'form[action="/add"]', {"amount": "7.50", "name": spend})
    connect(pg, base)
    pg.locator("#drivesave").dispatch_event("click")
    pg.wait_for_selector("#driveok:not([hidden])")
    assert d.newest() and "scrambled" in d.newest()["text"]
    return pg


def sign_in(pg, base):
    pg.goto(base + TODAY)
    assert step(pg) == "welcome"
    pg.click("#signin")


# ---------- 1. a wiped device asks who you are ----------

def test_a_wiped_device_shows_welcome_not_choose_a_passcode(browser, base):
    d = Drive()
    ctx, pg = wiped(browser, d)
    pg.goto(base + TODAY)
    assert step(pg) == "welcome"
    assert pg.locator(".wrap").is_hidden()                             # no money behind it
    assert pg.locator("#signin").is_visible() and "Google" in pg.locator("#signin").inner_text()
    assert pg.locator("#imnew").is_visible()
    assert not pg.locator("#pinform").is_visible()
    assert not pg.errors
    d.close()


def test_im_new_goes_to_choose_a_passcode(fresh, base):
    fresh.goto(base + TODAY)
    assert step(fresh) == "welcome"
    fresh.click("#imnew")
    assert step(fresh) == "newpin"
    assert fresh.locator("#myname").is_visible()
    assert not fresh.errors


# ---------- 2. sign in, passcode, money back ----------

def test_sign_in_and_passcode_bring_everything_back(browser, base):
    d = Drive()
    phone_with_copy(browser, base, d)
    ctx, pg = wiped(browser, d)
    sign_in(pg, base)
    pg.wait_for_selector('#lock[data-step="restore"]')
    assert EMAIL in pg.locator("#restoreinfo").inner_text()            # which Google account it looked in
    assert "8 Nov 2024" in pg.locator("#restoreinfo").inner_text()     # the date of the copy
    pg.fill("#rpin", "999999")                                          # wrong: nothing changes
    pg.click("#restoreform button[type=submit]")
    pg.wait_for_selector("#lockerr:not([hidden])")
    assert "didn't open" in pg.locator("#lockerr").inner_text()
    assert lock_rec(pg) is None and not (stored(pg) or {}).get("spends")
    pg.fill("#rname", "Sam")
    pg.fill("#rpin", PIN)
    with pg.expect_navigation():
        pg.click("#restoreform button[type=submit]")
    pg.wait_for_load_state()
    assert app_shown(pg)                                                 # straight in, no second passcode
    assert spends(pg) == ["PhoneSpend"]
    assert pg.evaluate("localStorage.getItem('lite_name')") == "Sam"
    assert pg.evaluate("localStorage.getItem('lite_drive_on')") == "1"
    assert pg.evaluate("localStorage.getItem('lite_drive_email')") == EMAIL
    assert json.loads(pg.evaluate("localStorage.getItem('lite_drive_file')"))["id"] == d.newest()["id"]
    assert not pg.evaluate("localStorage.getItem('lite_drive_dirty')")  # nothing to send back
    pg.click("#setbtn"); pg.click("#locknow")                            # the SAME passcode works on this device now
    assert step(pg) == "unlock"
    unlock(pg, PIN)
    assert app_shown(pg)
    assert not pg.errors
    d.close()


def test_a_backup_code_opens_it_too(browser, base):
    d = Drive()
    phone_with_copy(browser, base, d)
    ctx, pg = wiped(browser, d)
    sign_in(pg, base)
    pg.wait_for_selector('#lock[data-step="restore"]')
    pg.fill("#rpin", CODES[2].upper())
    with pg.expect_navigation():
        pg.click("#restoreform button[type=submit]")
    pg.wait_for_load_state()
    assert app_shown(pg) and spends(pg) == ["PhoneSpend"]
    pg.click("#setbtn"); pg.click("#locknow")
    unlock(pg, PIN)                                                      # the passcode came across as well
    assert app_shown(pg)
    assert not pg.errors
    d.close()


def test_the_newest_copy_is_the_one_loaded(browser, base):
    d = Drive()
    phone_with_copy(browser, base, d, spend="Older")
    old = d.newest()
    d.files[old["id"]]["name"] = "wheres-my-money-backup Oct 2024.json"
    phone_with_copy(browser, base, d, spend="Newer")
    ctx, pg = wiped(browser, d)
    sign_in(pg, base)
    pg.wait_for_selector('#lock[data-step="restore"]')
    pg.fill("#rpin", PIN)
    with pg.expect_navigation():
        pg.click("#restoreform button[type=submit]")
    pg.wait_for_load_state()
    assert spends(pg) == ["Newer"]
    assert not pg.errors
    d.close()


# ---------- 3. safe: nothing is written over the Drive copy ----------

def test_no_copy_in_this_google_account(browser, base):
    d = Drive()
    ctx, pg = wiped(browser, d)
    sign_in(pg, base)
    pg.wait_for_selector("#lockerr:not([hidden])")
    assert "No copy" in pg.locator("#lockerr").inner_text() and EMAIL in pg.locator("#lockerr").inner_text()
    assert step(pg) == "welcome"                                         # sign in with another account, or I'm new
    assert not pg.evaluate("localStorage.getItem('lite_drive_on')")      # not left connected to the wrong account
    assert not pg.errors
    d.close()


def test_start_new_instead_turns_drive_off_so_the_copy_is_safe(browser, base):
    d = Drive()
    phone_with_copy(browser, base, d)
    before = d.newest()["text"]
    ctx, pg = wiped(browser, d)
    sign_in(pg, base)
    pg.wait_for_selector('#lock[data-step="restore"]')
    pg.click("#restorenew")
    assert step(pg) == "newpin"
    assert not pg.evaluate("localStorage.getItem('lite_drive_on')")
    assert not pg.evaluate("localStorage.getItem('lite_drive_file')")
    pg.fill("#pinform #pin", PIN); pg.fill("#pinform #again", PIN)
    pg.click("#pinform button[type=submit]")
    pg.wait_for_selector('#lock[data-step="codes"]')
    pg.click("#codesdone")
    pg.click("#driveskip")                                         # v0.58: the Drive step comes next
    post(pg, 'form[action="/add"]', {"amount": "1", "name": "NewThing"})
    pg.wait_for_timeout(800)                                             # longer than the Drive wait
    assert d.newest()["text"] == before                                  # the phone's copy is untouched
    assert not pg.errors
    d.close()


def test_another_google_account(browser, base):
    d = Drive()
    phone_with_copy(browser, base, d)
    ctx, pg = wiped(browser, d)
    sign_in(pg, base)
    pg.wait_for_selector('#lock[data-step="restore"]')
    pg.click("#restoreother")
    pg.wait_for_function("window.__asks && window.__asks.length >= 2")
    assert pg.evaluate("window.__asks[window.__asks.length - 1].prompt") == "select_account"
    pg.wait_for_selector('#lock[data-step="restore"]')
    assert not pg.errors
    d.close()


def test_an_unscrambled_copy_loads_then_asks_for_a_new_passcode(browser, base):
    """A copy saved before the lock (plain file): no passcode can open it, so the money comes back and you pick one."""
    d = Drive()
    ctx0, a = device(browser, d)
    a.goto(base + TODAY)
    post(a, 'form[action="/add"]', {"amount": "2", "name": "PlainSpend"})
    plain = {"app": "wheres-my-money-lite", "version": "0.56", "saved": "2024-11-08", "state": stored(a)}
    d.files["p1"] = {"name": NAME, "mimeType": "application/json", "parents": [], "text": json.dumps(plain), "modifiedTime": d.tick()}
    ctx, pg = wiped(browser, d)
    sign_in(pg, base)
    pg.wait_for_selector('#lock[data-step="newpin"]')
    assert "found" in pg.locator("#lock").inner_text().lower()
    pg.fill("#pinform #pin", PIN); pg.fill("#pinform #again", PIN)
    pg.click("#pinform button[type=submit]")
    pg.wait_for_selector('#lock[data-step="codes"]')
    with pg.expect_navigation():
        pg.click("#codesdone")                                           # Drive is on already (the copy came from it)
    pg.wait_for_load_state()
    assert app_shown(pg) and spends(pg) == ["PlainSpend"]
    assert lock_rec(pg)
    assert not pg.errors
    d.close()


# ---------- 4. the demo: ?lock=1 tries it as a wiped device, never touching live ----------

def test_demo_lock_1_shows_welcome_with_its_own_keys(browser, site):  # noqa: F811
    ctx = _context(browser)                                              # live is set up and unlocked in this browser
    pg = _page(ctx)
    pg.goto(site + "demo/index.html" + TODAY)
    assert pg.locator("#lock").is_hidden()                               # the demo still has no lock by itself
    live_lock = pg.evaluate("localStorage.getItem('lite_lock_v1')")
    pg.goto(site + "demo/index.html" + TODAY + "&lock=1")
    assert step(pg) == "welcome"
    pg.click("#imnew")
    assert step(pg) == "newpin"
    pg.fill("#pinform #pin", PIN); pg.fill("#pinform #again", PIN)
    pg.click("#pinform button[type=submit]")
    pg.wait_for_selector('#lock[data-step="codes"]')
    pg.click("#codesdone")
    pg.click("#driveskip")                                         # v0.58: the Drive step comes next
    assert app_shown(pg)
    assert pg.evaluate("localStorage.getItem('lite_demo_lock_v1')")
    assert pg.evaluate("localStorage.getItem('lite_lock_v1')") == live_lock   # live's lock untouched
    pg.goto(site + "demo/index.html" + TODAY + "&lock=0")
    assert pg.locator("#lock").is_hidden()
    assert not pg.errors
    ctx.close()
