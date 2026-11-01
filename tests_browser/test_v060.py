"""v0.60 (Darren, 1 Nov): the Orbit INBOX. Orbit Agent writes one job file per change into the app's Google Drive:
wmm-job-YYYYMMDD-HHMMSS-xxxx.json. When the app opens (after the unlock, once Drive has a token) it reads them, applies
them oldest first (by name), deletes each file, skips a job id it has done already, and shows 'Added by Orbit: £5.10
Tesco'. Every Drive save also writes wmm-summary.json: NOT scrambled, totals only, so Claude can answer questions.
One fake Drive, fake data only."""
import json

from conftest import _context, _page, LOCK
from test_v045 import Drive, device, connect, spends, CONFIG, TODAY
from test_gob6 import unlock

N = [0]


def put_job(d, name, body):
    """Orbit drops a job file into the Drive."""
    N[0] += 1
    d.files["job%d" % N[0]] = {"name": name, "mimeType": "application/json", "text": json.dumps(body),
                               "parents": [], "modifiedTime": d.tick()}


def jobs_left(d):
    return sorted(f["name"] for f in d.files.values() if f["name"].startswith("wmm-job-"))


def spend(id_, amount, name, **more):
    return dict({"v": 1, "id": id_, "kind": "add_spend", "made": "2024-11-08T09:00:00Z", "from": "Orbit",
                 "amount": amount, "name": name}, **more)


def state(pg):
    return json.loads(pg.evaluate("localStorage.getItem('lite_state_v1')"))


def open_app(pg, base):
    """A visit with a Drive token already (connected this hour)."""
    pg.goto(base + TODAY)
    pg.wait_for_load_state()


def wait_no_jobs(d, pg, timeout=8000):
    for _ in range(timeout // 100):
        if not jobs_left(d):
            return
        pg.wait_for_timeout(100)
    raise AssertionError("job files still there: %s" % jobs_left(d))


def test_jobs_are_added_oldest_first_then_deleted_with_a_note(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    put_job(d, "wmm-job-20241108-091500-bb22.json", spend("j2", 2, "Costa"))
    put_job(d, "wmm-job-20241108-090000-aa11.json", spend("j1", 5.1, "Tesco"))
    open_app(pg, base)
    wait_no_jobs(d, pg)
    pg.wait_for_function("(JSON.parse(localStorage.getItem('lite_state_v1')).spends || []).some(s => s.name === 'Costa')")
    names = spends(pg)
    assert names[-2:] == ["Tesco", "Costa"]                             # oldest file first
    st = state(pg)
    assert [x["job"] for x in st["spends"] if x.get("job")] == ["j1", "j2"]
    assert set(st["jobsDone"]) >= {"j1", "j2"}
    note = pg.locator(".jobtoast")
    note.wait_for()
    assert "Added by Orbit: £5.10 Tesco" in note.inner_text()
    assert "Added by Orbit: £2.00 Costa" in note.inner_text()
    assert pg.locator("tr", has_text="Tesco").count() >= 1             # on the page too (after the reload)
    assert not pg.errors
    d.close()


def test_upcoming_maybe_bill_card_and_paid_off(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    put_job(d, "wmm-job-20241108-090001-a001.json", spend("u1", 150, "Hairdressers", date="2024-11-25", upcoming=True))
    put_job(d, "wmm-job-20241108-090002-a002.json", spend("m1", 350, "Xmas present", upcoming=True))
    put_job(d, "wmm-job-20241108-090003-a003.json", {"v": 1, "id": "b1", "kind": "add_bill", "made": "x", "from": "Orbit",
                                                     "amount": 9.95, "name": "Apple TV", "day": 10})
    put_job(d, "wmm-job-20241108-090004-a004.json", {"v": 1, "id": "c1", "kind": "card_spend", "made": "x", "from": "Orbit",
                                                     "amount": 50, "name": "Fuel"})
    put_job(d, "wmm-job-20241108-090005-a005.json", {"v": 1, "id": "p1", "kind": "card_paid_off", "made": "x", "from": "Orbit",
                                                     "amount": 100})
    open_app(pg, base)
    wait_no_jobs(d, pg)
    pg.wait_for_function("(JSON.parse(localStorage.getItem('lite_state_v1')).jobsDone || []).includes('p1')")
    st = state(pg)
    hair = next(x for x in st["spends"] if x["name"] == "Hairdressers")
    assert hair["upcoming"] and hair["date"] == "2024-11-25" and not hair.get("nodate")
    xmas = next(x for x in st["spends"] if x["name"] == "Xmas present")
    assert xmas["upcoming"] and xmas["nodate"]
    tv = next(b for b in st["bills"] if b["name"] == "Apple TV")
    assert tv["amount"] == 9.95 and tv["due"] == 10 and tv["job"] == "b1"
    items = st["cards"][0]["items"]
    assert any(i["amount"] == 50 and i["job"] == "c1" for i in items)
    assert any(i["amount"] == -100 and i["job"] == "p1" for i in items)
    assert not pg.errors
    d.close()


def test_remove_spend_undoes_and_a_done_job_is_never_added_twice(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    put_job(d, "wmm-job-20241108-090000-aa11.json", spend("j1", 5.1, "Tesco"))
    open_app(pg, base)
    wait_no_jobs(d, pg)
    pg.wait_for_function("(JSON.parse(localStorage.getItem('lite_state_v1')).jobsDone || []).includes('j1')")
    n = len(spends(pg))
    put_job(d, "wmm-job-20241108-100000-cc33.json", spend("j1", 5.1, "Tesco"))   # the same job again (Orbit retried)
    open_app(pg, base)
    wait_no_jobs(d, pg)
    pg.wait_for_timeout(500)
    assert len(spends(pg)) == n                                          # no double
    put_job(d, "wmm-job-20241108-110000-dd44.json", {"v": 1, "id": "r1", "kind": "remove_spend", "made": "x",
                                                     "from": "Orbit", "target": "j1"})
    open_app(pg, base)
    wait_no_jobs(d, pg)
    pg.wait_for_function("!(JSON.parse(localStorage.getItem('lite_state_v1')).spends || []).some(s => s.job === 'j1')")
    assert len(spends(pg)) == n - 1
    pg.locator(".jobtoast").wait_for()
    assert "Removed by Orbit: £5.10 Tesco" in pg.locator(".jobtoast").inner_text()
    assert not pg.errors
    d.close()


def test_an_unknown_job_is_left_in_drive(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    put_job(d, "wmm-job-20241108-090000-zz00.json", {"v": 2, "id": "new1", "kind": "add_rocket", "amount": 5})
    put_job(d, "wmm-job-20241108-090100-zz01.json", spend("j9", 1.5, "Greggs"))
    open_app(pg, base)
    pg.wait_for_function("(JSON.parse(localStorage.getItem('lite_state_v1')).jobsDone || []).includes('j9')")
    pg.wait_for_timeout(500)
    assert jobs_left(d) == ["wmm-job-20241108-090000-zz00.json"]
    assert not pg.errors
    d.close()


def test_jobs_wait_for_the_unlock(browser, base):
    d = Drive()
    ctx = _context(browser, unlocked=False)
    ctx.add_init_script(CONFIG + "window.LITE_DRIVE_WAIT = 300;"
                        "localStorage.setItem('lite_drive_on', '1');"
                        "sessionStorage.setItem('lite_drive_token', JSON.stringify({t: 'tok123', exp: Date.now() + 3600000}));")
    pg = _page(ctx)
    d.attach(pg)
    put_job(d, "wmm-job-20241108-090000-aa11.json", spend("j1", 5.1, "Tesco"))
    pg.goto(base + TODAY)
    pg.wait_for_selector("#lock", state="visible")
    pg.wait_for_timeout(1200)
    assert jobs_left(d) == ["wmm-job-20241108-090000-aa11.json"]       # locked: nothing read, nothing changed
    unlock(pg)
    wait_no_jobs(d, pg)
    pg.wait_for_function("(JSON.parse(localStorage.getItem('lite_state_v1') || '{}').spends || []).some(s => s.job === 'j1')")
    assert not pg.errors
    d.close()


def test_the_quiet_reconnect_on_the_first_tap_reads_the_jobs(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    pg.evaluate("sessionStorage.removeItem('lite_drive_token')")           # a new visit: no token yet
    put_job(d, "wmm-job-20241108-090000-aa11.json", spend("j1", 5.1, "Tesco"))
    open_app(pg, base)
    pg.wait_for_timeout(800)
    assert jobs_left(d)                                                  # no token, no Drive
    pg.mouse.click(5, 400)                                               # the first tap = the quiet reconnect
    wait_no_jobs(d, pg)
    pg.wait_for_function("(JSON.parse(localStorage.getItem('lite_state_v1')).jobsDone || []).includes('j1')")
    assert not pg.errors
    d.close()


def test_every_save_writes_a_plain_summary_file(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    pg.locator("#drivesave").dispatch_event("click")
    pg.wait_for_selector("#driveok:not([hidden])")
    summ = [f for f in d.files.values() if f["name"] == "wmm-summary.json"]
    assert len(summ) == 1
    s = json.loads(summ[0]["text"])                                      # plain JSON: no passcode needed
    assert "scrambled" not in s
    assert sorted(s) == ["bills", "card", "pots", "spare", "spent", "to_come_out", "updated"]
    assert all(set(b) == {"name", "amount", "day", "paid"} for b in s["bills"]) and s["bills"]
    assert isinstance(s["spare"], (int, float)) and s["card"]["free"] >= 0
    assert all(set(p) == {"name", "budget", "used"} for p in s["pots"])
    assert "Costa" not in summ[0]["text"]                                # totals only, no spend names
    folder = summ[0]["parents"]
    backup = d.newest()
    assert folder == backup["parents"]                                   # same folder as the backups
    pg.locator("#driveok").evaluate("e => e.hidden = true")
    pg.locator("#drivesave").dispatch_event("click")                     # a 2nd save writes over it: still one file
    pg.wait_for_selector("#driveok:not([hidden])")
    assert len([f for f in d.files.values() if f["name"] == "wmm-summary.json"]) == 1
    assert not pg.errors
    d.close()
