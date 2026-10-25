"""v0.56 (Darren, 25 Oct): Drive was the only copy, and one save or load could write over it. Now: before the first
save of a day writes over the Drive copy, that copy is kept as the day's SAFETY COPY (folder 'Safety copies', one file a
day, never written again, the last 30 kept). The Drive tab lists them (Load / ⬇️, Download all); Load has ↩️ Undo;
Save + Load sit under 'More options'. Fake Drive, fake data only."""
import json

from conftest import post, sheet, PIN
from test_v045 import Drive, device, connect, spends, TODAY

SAFE = "wmm-lite-safety "
FOLDER = "application/vnd.google-apps.folder"


def safety(d):
    return sorted((dict(f, id=i) for i, f in d.files.items() if f["name"].startswith(SAFE)), key=lambda f: f["name"])


def save(pg):
    pg.locator("#driveok").evaluate("e => e.hidden = true")
    pg.locator("#drivesave").dispatch_event("click")
    pg.wait_for_selector("#driveok:not([hidden])")


def test_save_and_load_are_tucked_under_more(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    assert pg.locator("#drivemore").is_visible()
    assert not pg.locator("#drivesave").is_visible() and not pg.locator("#driveload").is_visible()
    pg.click("#drivemore summary")
    assert pg.locator("#drivesave").is_visible() and pg.locator("#driveload").is_visible()
    assert pg.locator("#safebox").is_visible()
    assert not pg.errors
    d.close()


def test_one_safety_copy_a_day_never_written_over(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    save(pg)                                                           # the first copy ever: nothing to keep yet
    assert safety(d) == []
    first = d.newest()["text"]
    post(pg, 'form[action="/add"]', {"amount": "3", "name": "Later"})
    pg.goto(base + TODAY + "&view=drive")
    save(pg)                                                           # writes over it: the old one is kept first
    s = safety(d)
    assert [f["name"] for f in s] == [SAFE + "2024-11-08.json"]
    assert s[0]["text"] == first
    folder = d.files[s[0]["parents"][0]]
    assert folder["name"] == "Safety copies" and folder["mimeType"] == FOLDER
    post(pg, 'form[action="/add"]', {"amount": "4", "name": "Later2"})
    pg.goto(base + TODAY + "&view=drive")
    save(pg)
    assert len(safety(d)) == 1 and safety(d)[0]["text"] == first      # the day's copy is never written again
    assert d.newest()["text"] != first
    assert not pg.errors
    d.close()


def test_a_new_day_adds_one_and_keeps_30(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    save(pg)
    for n in range(31):                                                # 31 older days already there
        d.files["old%d" % n] = {"name": SAFE + "2024-09-%02d.json" % (n + 1) if n < 30 else SAFE + "2024-08-31.json",
                                "mimeType": "application/json", "text": "{}", "parents": [], "modifiedTime": d.tick()}
    save(pg)
    names = [f["name"] for f in safety(d)]
    assert len(names) == 30
    assert names[-1] == SAFE + "2024-11-08.json"
    assert SAFE + "2024-08-31.json" not in names and SAFE + "2024-09-01.json" not in names and SAFE + "2024-09-02.json" in names
    assert not pg.errors
    d.close()


def test_load_an_older_copy_then_undo(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    pg.goto(base + TODAY)
    post(pg, 'form[action="/add"]', {"amount": "5", "name": "OldDay"})
    connect(pg, base)
    save(pg)
    post(pg, 'form[action="/remove"]', {"id": "1"})
    post(pg, 'form[action="/add"]', {"amount": "6", "name": "Today"})
    pg.goto(base + TODAY + "&view=drive")
    save(pg)                                                           # the morning copy (OldDay) is the safety copy
    pg.goto(base + TODAY + "&view=drive")
    rows = pg.locator("#safelist .saferow")
    rows.first.wait_for()
    assert rows.count() == 1 and "8 Nov 2024" in rows.first.inner_text()
    rows.first.locator(".safeload").click()
    sheet(pg, PIN)                                                     # it is scrambled: the passcode
    with pg.expect_navigation():
        sheet(pg)                                                      # Replace
    pg.wait_for_load_state()
    assert spends(pg) == ["OldDay"]
    toast = pg.locator(".synctoast")
    assert "loaded" in toast.inner_text()
    with pg.expect_navigation():
        toast.locator(".syncundo").click()
    pg.wait_for_load_state()
    assert spends(pg) == ["Today"]
    assert not pg.errors
    d.close()


def test_download_all_safety_copies(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    save(pg)
    d.files["old1"] = {"name": SAFE + "2024-11-01.json", "mimeType": "application/json", "text": '{"a": 1}', "parents": [], "modifiedTime": d.tick()}
    save(pg)
    pg.goto(base + TODAY + "&view=drive")
    pg.wait_for_selector("#safeall:not([hidden])")
    with pg.expect_download() as dl:
        pg.click("#safeall")
    got = json.loads(open(dl.value.path()).read())
    assert dl.value.suggested_filename.endswith(".json")
    assert [c["day"] for c in got["copies"]] == ["2024-11-08", "2024-11-01"]
    assert got["copies"][1]["file"] == {"a": 1}
    assert not pg.errors
    d.close()
