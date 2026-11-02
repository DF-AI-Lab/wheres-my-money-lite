"""Go B step 6 (PLAN.md): the lock + the scrambled backup file. v0.61 (on purpose): the lock is 🛂 PASSPORT ID now
(passport/ui.js screens over the app in #wmmlock #passport): passcode, 5 tries, backup codes, fingerprint, Lock now, 5 minutes.
A real browser at phone width. Fake data only. Fixtures: page (set up + unlocked), locked (set up), fresh (new person)."""
import json

from conftest import DEMO, PIN, PP_CODES, stored, post, open_scrambled, sheet

TODAY = "?today=2024-11-08"


def lock_rec(page):
    """v0.61: WMM's key record (lite_key_v1); the old lite_lock_v1 is gone once Passport is in."""
    raw = page.evaluate("localStorage.getItem('lite_key_v1')")
    return json.loads(raw) if raw else None


def passport(page):
    raw = page.evaluate("localStorage.getItem('passport-v2')")
    return json.loads(raw)["passports"]["fake.person@example.com"] if raw else None


def step(page, words=None):
    """The Passport screen's text (waits for it to show, and for words if given)."""
    page.wait_for_selector("#wmmlock:not([hidden]) #passport .ps-screen")
    if words:
        page.wait_for_function("w => (document.querySelector('#passport .ps-screen') || {}).innerText.includes(w)", arg=words, timeout=15000)
    return page.locator("#passport .ps-screen").inner_text()


def app_shown(page):
    return page.locator("#wmmlock").is_hidden() and page.locator(".wrap").is_visible()


def type_pin(page, pin):
    page.wait_for_selector("#passport #pc:not([disabled])")
    page.fill("#passport #pc", pin)
    page.click("#passport #go")


def unlock(page, pin=PIN):
    type_pin(page, pin)
    page.wait_for_selector("#wmmlock", state="hidden")


def test_the_demo_has_no_lock(fresh, base):
    fresh.goto(base + DEMO)
    assert fresh.locator("#wmmlock").is_hidden() and fresh.locator(".wrap").is_visible()
    assert lock_rec(fresh) is None


# ---------- opening the app ----------

def test_opening_asks_for_the_passcode(locked, base):
    locked.goto(base + TODAY)
    assert "Your passcode" in step(locked)
    assert locked.locator(".wrap").is_hidden()
    type_pin(locked, "000000")
    assert "Wrong passcode" in step(locked, "Wrong passcode")
    unlock(locked)
    assert app_shown(locked)
    assert not locked.errors


def test_five_wrong_tries_lock_it_for_a_while(locked, base):
    locked.goto(base + TODAY)
    for n in range(5):
        type_pin(locked, "000000")
        if n < 4:
            step(locked, "Wrong passcode")
    assert "Locked" in step(locked, "Locked")
    assert locked.locator("#passport #pc").is_disabled()            # even the right one waits
    assert passport(locked)["lockUntil"] > 0


def test_it_locks_again_after_5_minutes_without_use(locked, base):
    locked.goto(base + TODAY)
    unlock(locked)
    locked.evaluate("sessionStorage.setItem('lite_unlock', String(Date.now() - 6 * 60 * 1000))")
    locked.reload()
    assert "Your passcode" in step(locked)


def test_coming_back_after_5_minutes_locks_without_a_reload(locked, base):
    locked.goto(base + TODAY)
    unlock(locked)
    locked.evaluate("""() => { sessionStorage.setItem('lite_unlock', String(Date.now() - 6 * 60 * 1000));
        document.dispatchEvent(new Event('visibilitychange')); }""")
    assert "Your passcode" in step(locked)


def test_lock_now_in_settings(page, base):
    page.goto(base + TODAY)
    assert app_shown(page)
    page.click("#setbtn")
    page.click("#locknow")
    assert "Your passcode" in step(page)


# ---------- forgot passcode: a backup code, then a new passcode (the hidden key stays the same) ----------

def test_forgot_passcode_use_a_backup_code_then_choose_a_new_one(locked, base):
    locked.goto(base + TODAY)
    step(locked)
    locked.click("#passport #fg")
    step(locked, "Use a backup code")
    locked.fill("#passport #bc", "0000-0000")
    locked.click("#passport #go")
    step(locked, "didn't work")
    locked.fill("#passport #bc", PP_CODES[2])
    locked.click("#passport #go")
    step(locked, "Make a new passcode")
    locked.fill("#passport #pc", "246813"); locked.fill("#passport #pc2", "246813")
    locked.click("#passport #go")
    locked.wait_for_selector("#wmmlock", state="hidden")
    assert passport(locked)["backup"][2]["used"] is True
    rec = lock_rec(locked)
    locked.click("#setbtn"); locked.click("#locknow")
    type_pin(locked, PIN)                                           # the old passcode is gone
    step(locked, "Wrong passcode")
    unlock(locked, "246813")
    assert app_shown(locked)
    assert lock_rec(locked) == rec                                  # same hidden key: WMM's backups still open


def test_new_backup_codes_in_passport_settings(page, base):
    page.goto(base + TODAY)
    page.click("#setbtn")
    page.click("#passportbtn")
    step(page, "Make new backup codes")
    page.click("#passport #nb")
    step(page, "needs your passcode")                               # after a reload the hidden key is closed
    page.fill("#passport #pc", PIN)
    page.click("#passport #go")
    page.wait_for_selector("#passport .ps-codes")
    new = page.locator("#passport .ps-codes code").all_inner_texts()
    assert len(new) == 10 and not set(new) & set(PP_CODES)


# ---------- the scrambled backup file (v0.61: v2, the passport passcode opens it) ----------

def test_the_backup_file_is_scrambled_and_opens_with_the_passcode(page, base, tmp_path):
    page.goto(base + TODAY)
    post(page, 'form[action="/add"]', {"amount": "5", "name": "Before"})
    page.click("#setbtn")
    with page.expect_download() as dl:
        page.click("#savebackup")
    path = tmp_path / dl.value.suggested_filename
    dl.value.save_as(path)
    text = path.read_text()
    assert "Before" not in text                                     # scrambled: no plain data in the file
    data = json.loads(text)
    assert data["app"] == "wheres-my-money-lite" and "state" not in data and "scrambled" in data
    assert open_scrambled(data, PIN)["spends"][0]["name"] == "Before"
    assert open_scrambled(data, "000000") is None

    post(page, 'form[action="/remove"]', {"id": "1"})
    assert stored(page)["spends"] == []
    page.click("#setbtn")
    page.set_input_files("#loadfile", str(path))
    sheet(page, "000000")                                           # wrong first: nothing changes
    page.locator(".litesheet").last.wait_for(state="visible")
    assert "didn't open" in page.locator(".litesheet").last.inner_text()
    sheet(page)
    assert stored(page)["spends"] == []
    page.set_input_files("#loadfile", str(path))
    sheet(page, PIN)
    with page.expect_navigation():
        sheet(page)                                                 # "Load this backup?"
    page.wait_for_load_state()
    assert [x["name"] for x in stored(page)["spends"]] == ["Before"]


def test_an_old_plain_backup_still_loads(page, base, tmp_path):
    page.goto(base + TODAY)
    s = stored(page)
    s["spends"] = [{"id": 1, "date": "2024-11-01", "amount": 3, "name": "OldFile", "cat": "Unsorted"}]
    path = tmp_path / "old.json"
    path.write_text(json.dumps({"app": "wheres-my-money-lite", "version": "0.09", "saved": "2024-11-01", "state": s}))
    page.click("#setbtn")
    page.set_input_files("#loadfile", str(path))
    with page.expect_navigation():
        sheet(page)
    page.wait_for_load_state()
    assert [x["name"] for x in stored(page)["spends"]] == ["OldFile"]


# ---------- fingerprint (Passport's passkey on this phone), with Chromium's virtual authenticator ----------

def _virtual_finger(pg):
    cdp = pg.context.new_cdp_session(pg)
    cdp.send("WebAuthn.enable")
    cdp.send("WebAuthn.addVirtualAuthenticator", {"options": {
        "protocol": "ctap2", "transport": "internal", "hasResidentKey": True, "hasUserVerification": True,
        "isUserVerified": True, "automaticPresenceSimulation": True}})
    return cdp


def _finger_on(pg, url):
    _virtual_finger(pg)
    pg.goto(url + TODAY)
    unlock(pg)
    pg.click("#setbtn")
    pg.click("#passportbtn")
    step(pg, "Turn fingerprint on")
    pg.click("#passport #fpt")
    step(pg, "Turn fingerprint off")
    assert passport(pg)["fingerprints"].get("wmm")


def test_fingerprint_on_then_it_unlocks_by_itself_and_still_saves(locked, base, tmp_path):
    url = base.replace("127.0.0.1", "localhost")                   # WebAuthn refuses IP addresses
    _finger_on(locked, url)
    locked.click("#passport #back")
    locked.wait_for_selector("#wmmlock", state="hidden")
    locked.reload()                                                 # a new visit: the hidden key is closed
    locked.click("#setbtn")
    locked.click("#locknow")                                        # the lock asks for the finger at once
    locked.wait_for_selector("#wmmlock", state="hidden", timeout=8000)
    assert app_shown(locked)
    assert not locked.evaluate("sessionStorage.getItem('lite_tab_key')")    # a fingerprint opens no key
    post(locked, 'form[action="/add"]', {"amount": "2", "name": "ByFinger"})
    locked.click("#setbtn")
    with locked.expect_download() as dl:                           # saving needs no key: the public key locks it
        locked.click("#savebackup")
    path = tmp_path / "f.json"
    dl.value.save_as(path)
    assert open_scrambled(json.loads(path.read_text()), PIN)["spends"][0]["name"] == "ByFinger"
    assert not locked.errors


def test_fingerprint_can_be_turned_off(locked, base):
    url = base.replace("127.0.0.1", "localhost")
    _finger_on(locked, url)
    locked.click("#passport #fpt")
    step(locked, "Turn fingerprint on")
    assert not passport(locked)["fingerprints"].get("wmm")
