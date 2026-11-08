"""v0.62 (Darren, 3 Nov): the demo's REAL passport (?lock=google) must save and come back. Sign out must not take the
Google Drive permission back (no 'tick the Drive box' every sign-in)."""
import json

from conftest import _context, _page, post, PIN
from test_v045 import TODAY, CONFIG
from test_v061 import PDrive, screen, type_passcode, shown
from test_livedemo import site  # noqa: F401

DEMO_NAME = "wheres-my-money-demo-backup Nov 2024.json"


def demo_spends(pg):
    raw = pg.evaluate("sessionStorage.getItem('lite_demo_v1')")
    return [s["name"] for s in json.loads(raw)["spends"]] if raw else None


def new_person(pg, site):  # noqa: F811
    pg.goto(site + "demo/" + TODAY + "&lock=google")
    screen(pg, "Continue with Google")
    pg.click("#passport #g")
    screen(pg)
    pg.fill("#passport #nm", "Sam Test")
    pg.fill("#passport #pc", PIN)
    pg.fill("#passport #pc2", PIN)
    pg.click("#passport button[type=submit]")
    pg.wait_for_selector("#passport .ps-codes")
    pg.click("#passport #ok")
    pg.wait_for_selector("#wmmlock", state="hidden", timeout=15000)


def sign_out(pg):
    pg.evaluate("() => { const o = google.accounts.oauth2; o.revoke = () => { window.__revoked = (window.__revoked || 0) + 1; }; }")
    pg.click("#setbtn")
    pg.click("#passportbtn")
    screen(pg)
    pg.click("#passport #out")
    screen(pg, "Continue with Google")


def test_demo_real_passport_saves_and_comes_back_after_sign_out(browser, site):  # noqa: F811
    d = PDrive()
    ctx = _context(browser, seed_lock=False, unlocked=False, passport=False)
    ctx.add_init_script(CONFIG + "window.LITE_DRIVE_WAIT = 300;")
    pg = _page(ctx)
    d.attach(pg)
    new_person(pg, site)
    assert shown(pg)
    post(pg, 'form[action="/add"]', {"amount": "12.34", "name": "MyDemoSpend"})
    assert "MyDemoSpend" in demo_spends(pg)
    sign_out(pg)
    assert [f for f in d.files.values() if f["name"].startswith("wheres-my-money-demo-backup")], [f["name"] for f in d.files.values()]        # it reached Drive
    assert pg.evaluate("window.__revoked || 0") == 0                                                    # the Drive permission stays
    pg.click("#passport #g")                                                # sign in again
    screen(pg, "Welcome back")
    pg.click("#passport #go")
    type_passcode(pg)
    pg.wait_for_selector("#wmmlock", state="hidden", timeout=15000)
    pg.wait_for_load_state()
    pg.wait_for_function("() => (sessionStorage.getItem('lite_demo_v1') || '').includes('MyDemoSpend')", timeout=15000)
    assert shown(pg)
    assert not pg.errors
    d.close()


# ---------- v0.63 (Darren, 3 Nov, mock https://claude.ai/artifact/Si9fuCGNRNq8DzxoNjfiYH): Passport settings on ONE screen ----------

def test_passport_settings_fit_one_phone_screen(browser, base):
    ctx = _context(browser)
    pg = _page(ctx)
    pg.goto(base + TODAY)
    pg.click("#setbtn")
    pg.click("#passportbtn")
    screen(pg, "Your passport")
    home = pg.locator("#passport #back")
    assert home.inner_text().strip() == "‹ Home"                             # no big 'Back to Where's My Money?' button
    assert "Back to" not in pg.locator("#passport").inner_text()
    box = lambda s: pg.locator("#passport " + s).bounding_box()
    assert box("#back")["y"] < box(".ps-card")["y"]                          # Home at the top
    assert abs(box("#lock")["y"] - box("#out")["y"]) < 2                     # Lock now + Sign out on one line
    assert abs(box("#cpw")["y"] - box("#nb")["y"]) < 2                       # passcode + codes on one line
    card = pg.locator("#passport .ps-card").inner_text()
    assert "Fingerprint" in card and (pg.locator("#passport #fpt[role=switch]").count() == 1 or "Not on this device" in card)
    last = pg.locator("#passport .ps-set .ps-small").bounding_box()
    assert last["y"] + last["height"] <= 844                                 # all on one screen (390 x 844)
    assert pg.evaluate("document.getElementById('wmmlock').scrollHeight <= document.getElementById('wmmlock').clientHeight + 1")
    home.click()
    pg.wait_for_selector("#wmmlock", state="hidden")
    assert not pg.errors
    ctx.close()
