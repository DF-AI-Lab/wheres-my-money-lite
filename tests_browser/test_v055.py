"""v0.55 (Darren, 25 Oct, mock https://claude.ai/artifact/XvEVsgGDZzfsVTLCdSFroq): the Drive tab holds it all.
'⬇️ Download from Drive' (the newest Drive copy as a file) and '🔗 Paired devices': the device showing the code / QR
is the one sharing; the other device opens the QR link (?pair=CODE) or types the code, picks which money to keep (the
sharing one first), then both stay in step. Greyed out 'In development' without ?beta=sync. Two browsers, one fake
Drive. Fake data only."""
import json
import re

from conftest import post, sheet
from test_v045 import Drive, device, connect, spends, wait_spend, TODAY


def beta(pg, base):
    pg.goto(base + TODAY + "&beta=sync&view=drive")
    if pg.locator("#driveconnect").is_visible():
        pg.click("#driveconnect")
        pg.wait_for_selector("#drivesave:not([hidden])", state="attached")


def share(pg):
    """Tap Pair a device: the code screen. Returns the 6 digits."""
    pg.click("#pairgo")
    pg.wait_for_selector("#pairscreen:not([hidden])")
    pg.wait_for_function("/\\d{3} \\d{3}/.test(document.getElementById('pairnum').textContent)")
    return pg.locator("#pairnum").inner_text().replace(" ", "")


def test_download_from_drive(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    pg.locator("#drivesave").dispatch_event("click")
    pg.wait_for_selector("#driveok:not([hidden])")
    assert pg.locator("#drivedl").is_visible()
    with pg.expect_download() as dl:
        pg.click("#drivedl")
    f = dl.value
    newest = d.newest()
    assert f.suggested_filename == newest["name"]
    assert open(f.path()).read() == newest["text"]
    assert "Downloaded" in pg.locator("#driveok").inner_text()
    assert not pg.errors
    d.close()


def test_pairing_is_greyed_out_for_everyone_else(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    box = pg.locator("#pairbox")
    assert box.is_visible() and "locked" in box.get_attribute("class")
    assert pg.locator("#pairgo").is_disabled()
    assert "In development" in box.locator(".beta").inner_text()
    assert pg.locator("#paircodeform").is_hidden()
    assert pg.locator("#syncbox").count() == 0                         # the old tick box is gone
    pg.goto(base + TODAY + "&beta=sync&view=drive")
    assert "locked" not in pg.locator("#pairbox").get_attribute("class")
    assert pg.locator("#pairgo").is_enabled() and pg.locator("#paircodeform").is_visible()
    assert not pg.errors
    d.close()


def test_scan_the_code_and_keep_the_sharing_device_money(browser, base):
    d = Drive()
    pctx, phone = device(browser, d)
    cctx, pc = device(browser, d)
    beta(phone, base)
    post(phone, 'form[action="/add"]', {"amount": "4", "name": "PhoneOnly"})
    phone.goto(base + TODAY + "&view=drive")
    code = share(phone)
    assert phone.locator("#pairqr svg").count() == 1                  # a real QR code
    assert phone.locator("#driveset > #driveconnect").is_hidden()
    pc.goto(base + TODAY + "&pair=" + code)                           # what the camera opens
    pc.wait_for_selector("#pairjoin:not([hidden])")
    assert "view=drive" in pc.url
    pc.click("#pairjoingo")
    box = pc.locator(".litesheet").last
    box.wait_for(state="visible")
    assert "keep" in box.inner_text()
    with pc.expect_event("load"):                                    # (not the address tidy-up: a real reload)
        sheet(pc)                                                     # the sharing device's money (first button)
    pc.wait_for_load_state()
    assert "PhoneOnly" in spends(pc)
    assert "pair=" not in pc.url
    assert pc.evaluate("localStorage.getItem('lite_drive_sync')") == "1"
    phone.wait_for_selector("#pairscreen", state="hidden", timeout=8000)
    assert phone.evaluate("localStorage.getItem('lite_drive_sync')") == "1"
    assert len(json.loads(phone.evaluate("localStorage.getItem('lite_drive_paired')"))) == 1
    assert phone.locator("#pairlist .pairrow").count() == 2           # this device + the PC
    assert not [f for f in d.files.values() if "pair" in f["name"]]   # the pair note is tidied away
    post(phone, 'form[action="/add"]', {"amount": "2", "name": "AfterPair"})   # and now they follow each other
    pc.goto(base + TODAY)
    wait_spend(pc, "AfterPair")
    assert not phone.errors and not pc.errors
    d.close()


def test_typed_code_and_keep_this_device_money(browser, base):
    d = Drive()
    pctx, phone = device(browser, d)
    cctx, pc = device(browser, d)
    beta(phone, base)
    code = share(phone)
    beta(pc, base)
    post(pc, 'form[action="/add"]', {"amount": "6", "name": "PcOnly"})
    pc.goto(base + TODAY + "&view=drive")
    pc.fill("#paircode", code[:3] + " " + code[3:])
    pc.click("#paircodeform button")
    box = pc.locator(".litesheet").last
    box.wait_for(state="visible")
    box.locator("button.alt").click()                                 # keep this device's money
    pc.wait_for_function("!localStorage.getItem('lite_drive_dirty') && localStorage.getItem('lite_drive_sync') === '1'", timeout=8000)
    phone.wait_for_selector("#pairscreen", state="hidden", timeout=8000)
    phone.goto(base + TODAY)
    wait_spend(phone, "PcOnly")
    assert not phone.errors and not pc.errors
    d.close()


def test_wrong_code_says_so(browser, base):
    d = Drive()
    pctx, phone = device(browser, d)
    cctx, pc = device(browser, d)
    beta(phone, base)
    code = share(phone)
    wrong = "%06d" % ((int(code) + 1) % 1000000)
    pc.goto(base + TODAY + "&pair=" + wrong)
    pc.wait_for_selector("#pairjoin:not([hidden])")
    pc.click("#pairjoingo")
    pc.wait_for_selector("#driveerr:not([hidden])")
    assert "match" in pc.locator("#driveerr").inner_text()
    assert pc.evaluate("localStorage.getItem('lite_drive_sync')") is None
    phone.click("#paircancel")
    assert phone.locator("#pairscreen").is_hidden()
    phone.wait_for_timeout(600)
    assert not [f for f in d.files.values() if "pair" in f["name"]]
    d.close()


def test_unpair(browser, base):
    d = Drive()
    pctx, phone = device(browser, d)
    cctx, pc = device(browser, d)
    beta(phone, base)
    code = share(phone)
    pc.goto(base + TODAY + "&pair=" + code)
    pc.click("#pairjoingo")
    pc.wait_for_function("localStorage.getItem('lite_drive_sync') === '1'", timeout=8000)
    pc.goto(base + TODAY + "&view=drive")
    rows = pc.locator("#pairlist .pairrow")
    assert rows.count() == 2 and re.search("In step", rows.nth(1).inner_text())
    rows.nth(1).locator("button.unpair").click()
    sheet(pc)
    pc.wait_for_function("!localStorage.getItem('lite_drive_sync')")
    assert pc.locator("#pairlist .pairrow").count() == 1
    assert not pc.errors
    d.close()
