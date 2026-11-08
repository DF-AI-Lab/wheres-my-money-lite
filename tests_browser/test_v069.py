"""v0.69 (Darren, 8 Nov): Claude read yesterday's money. The phone saves as the app closes and freezes it after the first
send, and the Claude summary (wmm-summary.json) went AFTER the backup, so it never went. Now it goes with the backup, and a
summary that never reached Drive (or an install from before v0.69) is sent on the next open. Fake Drive, fake data only."""
import json

from test_v045 import Drive, device, connect, TODAY


def summaries(d):
    return [f for f in d.files.values() if f["name"] == "wmm-summary.json"]


def wait_summary(d, pg, timeout=8000):
    for _ in range(timeout // 100):
        if summaries(d):
            return summaries(d)
        pg.wait_for_timeout(100)
    raise AssertionError("no summary in Drive")


def test_a_save_marks_the_summary_sent(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    for _ in range(2):                                                   # 1st = new month file, 2nd = the summary WITH the backup
        pg.locator("#driveok").evaluate("e => e.hidden = true")
        pg.locator("#drivesave").dispatch_event("click")
        pg.wait_for_selector("#driveok:not([hidden])")
    assert len(summaries(d)) == 1
    assert pg.evaluate("localStorage.getItem('lite_drive_sumdue')") == "0"
    assert summaries(d)[0]["parents"] == d.newest()["parents"]           # still next to the backups
    assert not pg.errors
    d.close()


def test_a_summary_that_never_went_is_sent_on_the_next_open(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    pg.locator("#drivesave").dispatch_event("click")
    pg.wait_for_selector("#driveok:not([hidden])")
    for k in [k for k, f in d.files.items() if f["name"] == "wmm-summary.json"]:
        del d.files[k]                                                   # as if the phone froze before it went
    pg.evaluate("localStorage.removeItem('lite_drive_sumdue'); localStorage.removeItem('lite_drive_summary')")   # = before v0.69
    pg.goto(base + TODAY)
    s = json.loads(wait_summary(d, pg)[0]["text"])
    assert "added" in s and isinstance(s["spare"], (int, float))
    assert pg.evaluate("localStorage.getItem('lite_drive_sumdue')") == "0"
    assert not pg.errors
    d.close()


def test_no_summary_while_the_money_is_still_coming_back(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    pg.locator("#drivesave").dispatch_event("click")
    pg.wait_for_selector("#driveok:not([hidden])")                      # nothing still on its way
    for k in [k for k, f in d.files.items() if f["name"] == "wmm-summary.json"]:
        del d.files[k]
    pg.evaluate("localStorage.setItem('lite_drive_restore', 'need'); localStorage.removeItem('lite_drive_sumdue')")
    pg.goto(base + TODAY)
    pg.wait_for_timeout(1500)
    assert not summaries(d)                                              # never a blank summary over the real one
    d.close()
