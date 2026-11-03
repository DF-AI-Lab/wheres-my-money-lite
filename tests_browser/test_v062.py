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
