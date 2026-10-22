"""Go B step 6 (PLAN.md): the lock (passcode + fingerprint), 10 backup codes and the scrambled backup file.
A real browser at phone width. Fake data only. Fixtures: page (set up + unlocked), locked (set up), fresh (new person)."""
import json

from conftest import DEMO, PIN, CODES, LOCK, stored, post, open_scrambled, sheet

TODAY = "?today=2024-11-08"


def lock_rec(page):
    raw = page.evaluate("localStorage.getItem('lite_lock_v1')")
    return json.loads(raw) if raw else None


def step(page):
    page.wait_for_selector("#lock:not([hidden])")
    return page.get_attribute("#lock", "data-step")


def app_shown(page):
    return page.locator("#lock").is_hidden() and page.locator(".wrap").is_visible()


def type_pin(page, pin, form="#unlockform"):
    page.fill(f"{form} #pin", pin)
    page.click(f"{form} button[type=submit]")


def unlock(page, pin=PIN):
    type_pin(page, pin)
    page.wait_for_selector("#lock", state="hidden")


# ---------- first open: choose a passcode, get 10 codes ----------

def test_a_new_person_chooses_a_passcode_and_gets_10_backup_codes(fresh, base):
    pg = fresh
    pg.goto(base + TODAY)
    assert step(pg) == "newpin"
    assert pg.locator(".wrap").is_hidden()                         # nothing of the money shows behind it
    for pin, again, words in (("111111", "111111", "too easy"), ("135790", "135791", "not the same"),
                              ("1357", "1357", "6 numbers")):
        pg.fill("#pinform #pin", pin); pg.fill("#pinform #again", again)
        pg.click("#pinform button[type=submit]")
        assert words in pg.locator("#lockerr").inner_text()
        assert step(pg) == "newpin"
    pg.fill("#pinform #pin", PIN); pg.fill("#pinform #again", PIN)
    pg.click("#pinform button[type=submit]")
    pg.wait_for_selector('#lock[data-step="codes"]')
    codes = pg.locator("#lock ul.codes li").all_inner_texts()
    assert len(codes) == 10 and len(set(codes)) == 10
    rec = lock_rec(pg)
    assert rec and len(rec["codes"]) == 10 and PIN not in json.dumps(rec)
    pg.click("#codesdone")
    pg.wait_for_selector("#lock", state="hidden")
    assert app_shown(pg)
    pg.reload()                                                     # a reload in the same tab stays unlocked
    assert app_shown(pg)
    assert not pg.errors


def test_the_demo_has_no_lock(fresh, base):
    fresh.goto(base + DEMO)
    assert fresh.locator("#lock").is_hidden() and fresh.locator(".wrap").is_visible()
    assert lock_rec(fresh) is None


# ---------- opening the app ----------

def test_opening_asks_for_the_passcode(locked, base):
    locked.goto(base + TODAY)
    assert step(locked) == "unlock"
    assert locked.locator(".wrap").is_hidden()
    type_pin(locked, "000000")
    assert "Wrong passcode" in locked.locator("#lockerr").inner_text()
    assert step(locked) == "unlock"
    unlock(locked)
    assert app_shown(locked)
    assert not locked.errors


def test_five_wrong_tries_lock_it_for_15_minutes(locked, base):
    locked.goto(base + TODAY)
    for _ in range(5):
        type_pin(locked, "000000")
        locked.wait_for_timeout(100)
    assert "Too many tries" in locked.locator("#lockerr").inner_text()
    type_pin(locked, PIN)                                           # even the right one waits
    locked.wait_for_timeout(300)
    assert step(locked) == "unlock" and "Too many tries" in locked.locator("#lockerr").inner_text()
    assert lock_rec(locked)["fails"]["until"] > 0


def test_it_locks_again_after_5_minutes_without_use(locked, base):
    locked.goto(base + TODAY)
    unlock(locked)
    locked.evaluate("sessionStorage.setItem('lite_unlock', String(Date.now() - 6 * 60 * 1000))")
    locked.reload()
    assert step(locked) == "unlock"


def test_coming_back_after_5_minutes_locks_without_a_reload(locked, base):
    locked.goto(base + TODAY)
    unlock(locked)
    locked.evaluate("""() => { sessionStorage.setItem('lite_unlock', String(Date.now() - 6 * 60 * 1000));
        document.dispatchEvent(new Event('visibilitychange')); }""")
    assert step(locked) == "unlock"


def test_lock_now_in_settings(page, base):
    page.goto(base + TODAY)
    assert app_shown(page)
    page.click("#setbtn")
    page.click("#locknow")
    assert step(page) == "unlock"


# ---------- forgot passcode: a backup code, then a new passcode ----------

def test_forgot_passcode_use_a_backup_code_then_choose_a_new_one(locked, base):
    locked.goto(base + TODAY)
    locked.click("#forgot")
    assert step(locked) == "forgot"
    locked.fill("#codeform #bcode", "zzzz-zzzz")
    locked.click("#codeform button[type=submit]")
    assert "not right" in locked.locator("#lockerr").inner_text().lower()
    locked.fill("#codeform #bcode", CODES[2].upper().replace("-", " "))
    locked.click("#codeform button[type=submit]")
    locked.wait_for_selector('#lock[data-step="newpin"]')
    locked.fill("#pinform #pin", "246813"); locked.fill("#pinform #again", "246813")
    locked.click("#pinform button[type=submit]")
    locked.wait_for_selector("#lock", state="hidden")
    rec = lock_rec(locked)
    assert rec["codes"][2]["used"] is True
    locked.evaluate("sessionStorage.removeItem('lite_unlock')")
    locked.reload()
    type_pin(locked, PIN)                                           # the old passcode is gone
    assert "Wrong passcode" in locked.locator("#lockerr").inner_text()
    unlock(locked, "246813")
    assert app_shown(locked)


def test_new_backup_codes_in_settings(page, base):
    page.goto(base + TODAY)
    page.click("#setbtn")
    page.click("#newcodes")
    sheet(page)                                                     # "Make 10 new backup codes? The old ones stop working." 
    page.wait_for_selector('#lock[data-step="codes"]')
    new = page.locator("#lock ul.codes li").all_inner_texts()
    assert len(new) == 10 and not set(new) & set(CODES)
    page.click("#codesdone")
    page.wait_for_selector("#lock", state="hidden")
    assert lock_rec(page)["codes"] != LOCK["codes"]


# ---------- the scrambled backup file ----------

def test_the_backup_file_is_scrambled_and_opens_with_the_passcode_or_a_code(page, base, tmp_path):
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
    assert open_scrambled(data, CODES[5])["spends"][0]["name"] == "Before"
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
    sheet(page, CODES[7])                                           # a backup code opens it too
    with page.expect_navigation():
        sheet(page)                                                 # "Load this backup?" 
    page.wait_for_load_state()
    assert [x["name"] for x in stored(page)["spends"]] == ["Before"]
    assert lock_rec(page)["codes"][7]["used"] is False              # opening a file does not use up a code


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


# ---------- fingerprint (a passkey on this phone), with Chromium's virtual authenticator ----------

def _virtual_finger(pg):
    cdp = pg.context.new_cdp_session(pg)
    cdp.send("WebAuthn.enable")
    cdp.send("WebAuthn.addVirtualAuthenticator", {"options": {
        "protocol": "ctap2", "transport": "internal", "hasResidentKey": True, "hasUserVerification": True,
        "isUserVerified": True, "automaticPresenceSimulation": True}})
    return cdp


def test_fingerprint_on_then_it_unlocks_by_itself(locked, base):
    url = base.replace("127.0.0.1", "localhost")                   # WebAuthn refuses IP addresses
    _virtual_finger(locked)
    locked.goto(url + TODAY)
    assert step(locked) == "unlock"
    assert locked.locator("#fp").is_hidden()                       # no fingerprint set up yet
    unlock(locked)
    locked.click("#setbtn")
    locked.click("#fingerprint")
    assert step(locked) == "passkey"
    locked.click("#fpadd")
    locked.wait_for_selector("#fpok:not([hidden])")
    assert len(lock_rec(locked)["passkeys"]) == 1
    locked.click("#lockback")
    locked.wait_for_selector("#lock", state="hidden")
    locked.click("#setbtn")
    locked.click("#locknow")                                        # the unlock screen asks for the finger at once
    locked.wait_for_selector("#lock", state="hidden", timeout=5000)
    assert app_shown(locked)
    assert not locked.errors


def test_fingerprint_can_be_turned_off(locked, base):
    url = base.replace("127.0.0.1", "localhost")
    _virtual_finger(locked)
    locked.goto(url + TODAY)
    unlock(locked)
    locked.click("#setbtn"); locked.click("#fingerprint")
    locked.click("#fpadd")
    locked.wait_for_selector("#fpok:not([hidden])")
    locked.click("#fpoff")
    sheet(locked)
    locked.wait_for_timeout(300)
    assert lock_rec(locked)["passkeys"] == []
