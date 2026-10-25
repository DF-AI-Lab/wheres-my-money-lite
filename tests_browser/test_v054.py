"""v0.54 (Darren, 25 Oct): '🔁 Keep my devices in step' shows to everyone with Drive on, but greyed out and
'In development'. Only a device opened once with ?beta=sync can tick it. Fake data only."""
from test_v045 import Drive, device, connect, TODAY


def test_everyone_sees_it_greyed_out(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    box = pg.locator("#syncbox")
    assert box.is_visible() and "locked" in box.get_attribute("class")
    assert pg.locator("#synctoggle").is_disabled()
    assert "In development" in box.locator(".beta").inner_text()
    assert float(pg.locator("#syncbox .syncrow").evaluate("e => getComputedStyle(e).opacity")) < 1
    pg.locator("#syncbox .syncrow").click(force=True)
    assert not pg.locator("#synctoggle").is_checked()
    assert pg.evaluate("localStorage.getItem('lite_drive_sync')") is None
    assert not pg.errors
    d.close()


def test_beta_device_can_use_it(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    pg.goto(base + TODAY + "&beta=sync&view=drive")
    box = pg.locator("#syncbox")
    assert "locked" not in box.get_attribute("class")
    assert box.locator(".beta").inner_text() == "TEST"
    assert pg.locator("#synctoggle").is_enabled()
    assert not pg.errors
    d.close()
