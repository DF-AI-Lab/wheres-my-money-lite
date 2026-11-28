"""v0.78 (Darren, 28 Nov): Passport v0.4.1 security levels. Passport settings → 'Ask for passcode': Open | 7 days | Every time.
WMM's default = Every time (theme.json "security": "locked", as before: 5-minute idle lock). 7 days / Open = no idle lock.
A real browser at phone width. Fake data only."""
from conftest import _page
from test_gob6 import step, app_shown, unlock

TODAY = "?today=2024-11-08"


def pick(page, level):
    """Settings → Your passport → Ask for passcode → level, then back home."""
    page.click("#setbtn"); page.click("#passportbtn")
    page.click(f'#passport [data-lv="{level}"]')
    page.wait_for_selector(f'#passport [data-lv="{level}"][aria-checked="true"]')
    page.click("#passport #back")
    page.wait_for_selector("#wmmlock", state="hidden")


def new_tab(page, base):
    tab = _page(page.context)
    tab.goto(base + TODAY)
    tab.wait_for_timeout(600)
    return tab


def test_default_is_every_time(locked, base):
    locked.goto(base + TODAY)
    unlock(locked)
    assert locked.evaluate("Passport.level('wmm')") == "locked"
    assert "your passcode" in step(new_tab(locked, base))                       # a new tab asks again


def test_seven_days_stays_unlocked_in_a_new_tab(locked, base):
    locked.goto(base + TODAY)
    unlock(locked)
    pick(locked, "remember")
    tab = new_tab(locked, base)
    assert app_shown(tab)                                                        # no passcode
    assert not tab.errors


def test_seven_days_has_no_5_minute_idle_lock(locked, base):
    locked.goto(base + TODAY)
    unlock(locked)
    pick(locked, "remember")
    locked.evaluate("""() => { sessionStorage.setItem('lite_unlock', String(Date.now() - 6 * 60 * 1000));
        document.dispatchEvent(new Event('visibilitychange')); }""")
    locked.reload()
    locked.wait_for_timeout(600)
    assert app_shown(locked)


def test_seven_days_ends_after_lock_now(locked, base):
    locked.goto(base + TODAY)
    unlock(locked)
    pick(locked, "remember")
    locked.click("#setbtn"); locked.click("#locknow")
    assert "your passcode" in step(new_tab(locked, base))


def test_seven_days_run_out(locked, base):
    locked.goto(base + TODAY)
    unlock(locked)
    pick(locked, "remember")
    locked.evaluate("""() => { const k = 'passport-remember-wmm', t = JSON.parse(localStorage.getItem(k));
        t.exp = Date.now() - 1000; localStorage.setItem(k, JSON.stringify(t)); }""")
    assert "your passcode" in step(new_tab(locked, base))


def test_open_needs_no_passcode(locked, base):
    locked.goto(base + TODAY)
    unlock(locked)
    pick(locked, "open")
    assert app_shown(new_tab(locked, base))
