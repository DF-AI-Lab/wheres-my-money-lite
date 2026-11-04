"""v0.64 (Darren, 4 Nov, mock https://claude.ai/artifact/5jrk4Euv1xNFioJpeZaWjD):
1) The payday box = This month: Pay, Left from last month (as set on payday), Left so far (live); 'Start a new month'
   opens the form. The hint no longer calls this month's spare "last month's".
2) No device ever writes over a Drive copy another device saved since it last looked: it asks first.
3) 📱 Your devices: one Main holds the real money; another device joins with a code and copies it; its changes go to
   the Main as requests with tick boxes; the Main says yes; the linked device then copies the Main again.
Two browsers, one fake Drive. Fake data only."""
import json

from conftest import post, sheet, DEMO
from test_v045 import Drive, device, connect, spends, wait_spend, TODAY


# ---------- 1. the New month box ----------

def test_this_month_box_shows_pay_left_and_left_so_far(page, base):
    page.goto(base + DEMO)
    page.click("#quicktab")
    s = page.evaluate("Lite.state()")
    money = lambda x: "£{:,.2f}".format(x)
    assert page.locator("#nm-pay").inner_text().strip() == money(s["pay"])
    assert page.locator("#nm-left").inner_text().strip() == money(s["left"])        # as set on payday, not the live spare
    sofar = page.evaluate("Money.monthEndSpare(Lite.state())")
    assert page.locator("#nm-sofar").inner_text().strip() == money(sofar)
    assert page.locator("#nmform").is_hidden() and page.locator("#qpay").is_hidden()   # nothing to tap by mistake
    page.click("#nmstart")
    assert page.locator("#qpay").is_visible() and page.locator("#nmstart").is_hidden()
    hint = page.locator("#lefthint").inner_text()
    assert "Last month's spare" not in hint and "The app thinks" in hint
    assert not page.errors


def test_tapping_left_in_the_statement_opens_the_form(page, base):
    page.goto(base + DEMO)
    tap = page.locator('.tap[data-edit="qleft"]')
    if tap.count():
        tap.first.click()
        assert page.locator("#qleft").is_visible()


# ---------- 2. never write over another device's save ----------

def _two(browser, base, d):
    pctx, phone = device(browser, d)
    cctx, pc = device(browser, d)
    for pg in (phone, pc):
        connect(pg, base)
    return phone, pc


def save_now(pg):
    pg.locator("#drivesave").dispatch_event("click")


def test_the_pc_cannot_write_over_the_phones_newer_save(browser, base):
    d = Drive()
    phone, pc = _two(browser, base, d)
    save_now(pc)
    pc.wait_for_selector("#driveok:not([hidden])")
    phone.goto(base + TODAY)
    post(phone, 'form[action="/add"]', {"amount": "9", "name": "PhoneOnly"})
    phone.goto(base + TODAY + "&view=drive")
    save_now(phone)                                                        # the phone never saw the PC's copy: it asks too
    phone.locator(".litesheet").last.wait_for(state="visible")
    phone.locator(".litesheet button.alt").click()                         # 📱 keep this device's
    phone.wait_for_selector("#driveok:not([hidden])")
    before = d.newest()["text"]
    pc.goto(base + TODAY)
    post(pc, 'form[action="/add"]', {"amount": "1", "name": "PcChange"})
    pc.goto(base + TODAY + "&view=drive")
    save_now(pc)
    pc.locator(".litesheet").last.wait_for(state="visible")
    assert "Another device saved too" in pc.locator(".litesheet").last.inner_text()
    assert d.newest()["text"] == before                                    # nothing written over yet
    pc.locator(".litesheet button.cancel").click()                         # Not now
    pc.wait_for_selector("#driveerr:not([hidden])")
    assert d.newest()["text"] == before
    assert not pc.errors
    d.close()


def test_keep_this_device_puts_the_other_copy_in_safety_copies(browser, base):
    d = Drive()
    phone, pc = _two(browser, base, d)
    save_now(phone)
    phone.wait_for_selector("#driveok:not([hidden])")
    pc.goto(base + TODAY)
    post(pc, 'form[action="/add"]', {"amount": "1", "name": "PcWins"})
    pc.goto(base + TODAY + "&view=drive")
    save_now(pc)
    pc.locator(".litesheet").last.wait_for(state="visible")
    pc.locator(".litesheet button.alt").click()                            # 📱 This device's
    pc.wait_for_selector("#driveok:not([hidden])")
    names = [f["name"] for f in d.files.values()]
    assert any(n.startswith("wmm-lite-safety other device") for n in names)
    assert not pc.errors
    d.close()


# ---------- 3. 📱 Your devices: Main + linked ----------

def make_main(pg, base):
    pg.goto(base + TODAY + "&view=devices")
    pg.click("#devmain")
    sheet(pg, True)
    pg.wait_for_selector("#devok:not([hidden])")


def invite(pg):
    pg.click("#devinvite")
    pg.wait_for_function("/\\d{3} \\d{3}/.test(document.getElementById('devnum').textContent)")
    return pg.locator("#devnum").inner_text().replace(" ", "")


def join(pg, base, code):
    pg.goto(base + TODAY + "&view=devices")
    pg.fill("#devjoin", code)
    with pg.expect_navigation():
        pg.click("#devjoinform button[type=submit]")
    pg.wait_for_load_state()


def linked_pair(browser, base, d):
    phone, pc = _two(browser, base, d)
    phone.goto(base + TODAY)
    post(phone, 'form[action="/add"]', {"amount": "5", "name": "PhoneMoney"})
    make_main(phone, base)
    code = invite(phone)
    join(pc, base, code)
    phone.locator(".litesheet").last.wait_for(state="visible")            # ✅ Linked
    assert "Linked" in phone.locator(".litesheet").last.inner_text()
    sheet(phone, True)
    return phone, pc


def test_a_device_joins_the_main_and_copies_its_money(browser, base):
    d = Drive()
    phone, pc = linked_pair(browser, base, d)
    assert "PhoneMoney" in spends(pc)
    assert pc.evaluate("localStorage.getItem('lite_drive_role')") == "linked"
    assert phone.evaluate("localStorage.getItem('lite_drive_role')") == "main"
    note = json.loads([f for f in d.files.values() if f["name"] == "wmm-lite-devices.json"][0]["text"])
    assert note["main"] == phone.evaluate("LiteDevices.id()") and len(note["devices"]) == 2
    phone.goto(base + TODAY + "&view=devices")
    assert "MAIN" in phone.locator("#devlist").inner_text()
    assert not phone.errors and not pc.errors
    d.close()


def test_a_linked_change_waits_for_the_main_to_say_yes(browser, base):
    d = Drive()
    phone, pc = linked_pair(browser, base, d)
    phone.goto(base + TODAY)
    pc.goto(base + TODAY)
    backup = d.newest()["text"]
    post(pc, 'form[action="/add"]', {"amount": "12.50", "name": "Tesco"})
    assert "Tesco" in spends(pc)                                           # shows on the PC at once
    pc.wait_for_selector("#devwait")
    pc.wait_for_function("Object.values(JSON.parse(localStorage.getItem('lite_drive_outbox') || '[]')).every(x => x.sent)")
    assert d.newest()["text"] == backup                                    # the PC never writes the Main's copy
    assert any(f["name"].startswith("wmm-lite-req-") for f in d.files.values())
    phone.locator("#approve").wait_for(state="visible", timeout=10000)
    text = phone.locator("#approve").inner_text()
    assert "1 change" in text and "Tesco" in text and "£12.50" in text
    with phone.expect_navigation():
        phone.click("#apyes")
    phone.wait_for_load_state()
    assert "Tesco" in spends(phone)
    assert not any(f["name"].startswith("wmm-lite-req-") for f in d.files.values())
    pc.wait_for_function("!localStorage.getItem('lite_drive_outbox')", timeout=10000)
    wait_spend(pc, "Tesco")
    assert not phone.errors and not pc.errors
    d.close()


def test_an_unticked_change_is_dropped(browser, base):
    d = Drive()
    phone, pc = linked_pair(browser, base, d)
    phone.goto(base + TODAY)
    pc.goto(base + TODAY)
    post(pc, 'form[action="/add"]', {"amount": "3.20", "name": "Coffee"})
    phone.locator("#approve").wait_for(state="visible", timeout=10000)
    phone.locator("#approve .aprow input").uncheck()
    assert "Drop them all" in phone.locator("#apyes").inner_text()
    with phone.expect_navigation():
        phone.click("#apyes")
    phone.wait_for_load_state()
    assert "Coffee" not in spends(phone)
    pc.wait_for_function("!localStorage.getItem('lite_drive_outbox')", timeout=10000)
    wait_spend(pc, "Coffee", present=False)                                # the PC copies the Main again
    d.close()


def test_settings_says_which_device_is_the_main(browser, base):
    d = Drive()
    phone, pc = linked_pair(browser, base, d)
    phone.goto(base + TODAY)
    phone.click("#setbtn")
    assert "Main" in phone.locator("#devlink").inner_text()
    pc.goto(base + TODAY)
    pc.click("#setbtn")
    assert "Linked to your" in pc.locator("#devlink").inner_text()
    d.close()


# ---------- v0.65: Pay can be changed without a new month ----------

def test_pay_can_be_changed_any_time(page, base):
    page.goto(base + DEMO)
    page.click("#quicktab")
    page.click("#nmpayedit")
    page.locator(".litesheet input").last.fill("2750")
    with page.expect_navigation():
        page.locator(".litesheet button.ok").last.click()
    page.wait_for_load_state()
    assert page.evaluate("Lite.state().pay") == 2750
    page.click("#quicktab")
    assert page.locator("#nm-pay").inner_text().strip() == "£2,750.00"
    assert not page.errors
