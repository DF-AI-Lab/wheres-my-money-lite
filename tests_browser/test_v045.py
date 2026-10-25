"""v0.45 (Darren, 25 Oct): 🔁 keep the phone and the PC in step through the same Google Drive copy (TEST, hidden).
Only shows after ?beta=sync. A change goes to Drive in ~5 s; an open app checks Drive every 30 s (and when it comes back
into view) and loads a newer copy by itself (↩️ Undo). Changes on both = it asks. A save never writes over a newer copy.
A device with another lock links once with the other device's passcode. Two browsers + one fake Drive. Fake data only."""
import json

from conftest import _context, _page, post, sheet, make_lock, LOCK, PIN
from test_gob9 import GSI
from test_v040 import HINT_GSI, EMAIL

TODAY = "?today=2024-11-08"
CONFIG = "window.LITE_CONFIG = {googleClientId: 'test-client.apps.googleusercontent.com'};"


class Drive:
    """One Google Drive both browsers see: files keep their text; every upload moves modifiedTime on."""
    def __init__(self):
        self.files, self.n, self.t = {}, 0, 0

    def tick(self):
        self.t += 1
        return "2024-11-08T10:%02d:%02d.000Z" % (self.t // 60, self.t % 60)

    def newest(self):
        live = [dict(f, id=i) for i, f in self.files.items() if f["mimeType"] != "application/vnd.google-apps.folder"]
        return sorted(live, key=lambda f: f["modifiedTime"], reverse=True)[0] if live else None

    def state(self):
        return json.loads(self.newest()["text"])

    def attach(self, page):
        page.route(GSI + "*", lambda r: r.fulfill(status=200, content_type="text/javascript", body=HINT_GSI))
        page.route("https://www.googleapis.com/**", self.api)

    def api(self, route):
        req, url = route.request, route.request.url
        ok = lambda body: route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
        if "/drive/v3/about" in url:
            return ok({"user": {"emailAddress": EMAIL}})
        if req.method == "GET" and "alt=media" in url:
            fid = url.split("/files/")[1].split("?")[0]
            return route.fulfill(status=200, content_type="application/json", body=self.files[fid]["text"])
        if req.method == "GET":
            files = sorted(([dict(f, id=i) for i, f in self.files.items()]), key=lambda f: f["modifiedTime"], reverse=True)
            return ok({"files": [{k: f[k] for k in ("id", "name", "mimeType", "modifiedTime")} for f in files]})
        if req.method in ("POST", "PATCH"):
            body = req.post_data
            if "upload/" in url:
                parts = body.split("\r\n\r\n")
                meta, text = json.loads(parts[1].split("\r\n--")[0]), parts[2].split("\r\n--")[0]
            else:
                meta, text = json.loads(body), ""
            if req.method == "POST":
                self.n += 1
                fid = "f%d" % self.n
                self.files[fid] = {"name": meta["name"], "mimeType": meta.get("mimeType", "")}
            else:
                fid = url.split("/files/")[1].split("?")[0]
            self.files[fid].update(text=text, modifiedTime=self.tick())
            return ok({"id": fid, "trashed": False, "modifiedTime": self.files[fid]["modifiedTime"]})
        if req.method == "DELETE":
            self.files.pop(url.split("/files/")[1].split("?")[0], None)
            return route.fulfill(status=204, body="")
        return route.fulfill(status=404, body="")


def device(browser, drive, lock=None, wait=300, every=400):
    """A phone or a PC: its own browser storage, the same Drive. lock = another lock record (another passcode)."""
    ctx = _context(browser, seed_lock=lock is None)
    if lock is not None:
        ctx.add_init_script("if (!localStorage.getItem('lite_lock_v1')) localStorage.setItem('lite_lock_v1', %s);"
                            % json.dumps(json.dumps(lock)))
    ctx.add_init_script(CONFIG + "window.LITE_DRIVE_WAIT = %d; window.LITE_SYNC_EVERY = %d;" % (wait, every))
    pg = _page(ctx)
    drive.attach(pg)
    return ctx, pg


def connect(pg, base):
    pg.goto(base + TODAY + "&view=drive")
    pg.click("#driveconnect")
    pg.wait_for_selector("#drivesave:not([hidden])")


def sync_on(pg, base):
    pg.goto(base + TODAY + "&beta=sync&view=drive")
    if pg.locator("#driveconnect").is_visible():
        pg.click("#driveconnect")
        pg.wait_for_selector("#drivesave:not([hidden])")
    pg.check("#synctoggle")


def spends(pg):
    return [s["name"] for s in json.loads(pg.evaluate("localStorage.getItem('lite_state_v1')"))["spends"]]


def wait_spend(pg, name, present=True):
    pg.wait_for_function("([n, p]) => (JSON.parse(localStorage.getItem('lite_state_v1')).spends || [])"
                         ".some(s => s.name === n) === p", arg=[name, present], timeout=8000)


# ---------- hidden until Darren says ----------

def test_sync_is_hidden_without_the_beta_link(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    connect(pg, base)
    assert pg.locator("#syncbox").is_hidden()
    pg.goto(base + TODAY + "&beta=sync&view=drive")
    assert pg.locator("#syncbox").is_visible()
    pg.goto(base + TODAY + "&view=drive")                                # remembered on this device
    assert pg.locator("#syncbox").is_visible()
    pg.goto(base + TODAY + "&beta=off&view=drive")
    assert pg.locator("#syncbox").is_hidden()
    assert not pg.errors
    ctx.close()


# ---------- the first device sends its copy ----------

def test_turning_on_with_an_empty_drive_sends_this_copy(browser, base):
    d = Drive()
    ctx, pg = device(browser, d)
    sync_on(pg, base)
    pg.wait_for_function("localStorage.getItem('lite_drive_synced')")
    assert d.newest() and pg.evaluate("localStorage.getItem('lite_drive_sync')") == "1"
    assert pg.evaluate("localStorage.getItem('lite_drive_synced')") == d.newest()["id"] + "@" + d.newest()["modifiedTime"]
    ctx.close()


# ---------- phone -> PC by itself ----------

def test_a_change_on_the_phone_shows_on_the_pc_with_undo(browser, base):
    d = Drive()
    pctx, phone = device(browser, d)
    cctx, pc = device(browser, d)
    sync_on(phone, base)
    phone.wait_for_function("localStorage.getItem('lite_drive_synced')")
    sync_on(pc, base)                                                    # same copy: nothing to ask
    pc.wait_for_function("localStorage.getItem('lite_drive_synced')")
    assert not pc.locator(".litesheet").count()
    pc.goto(base + TODAY)
    phone.goto(base + TODAY)
    post(phone, 'form[action="/add"]', {"amount": "3", "name": "FromPhone"})
    phone.wait_for_function("!localStorage.getItem('lite_drive_dirty')", timeout=8000)   # sent in a moment
    wait_spend(pc, "FromPhone")                                          # the PC picked it up and reloaded
    pc.wait_for_selector(".synctoast")
    assert "other device" in pc.locator(".synctoast").inner_text()
    pc.click(".synctoast .syncundo")                                     # ↩️ Undo
    wait_spend(pc, "FromPhone", present=False)
    assert not phone.errors and not pc.errors
    pctx.close(); cctx.close()


# ---------- both changed: ask, never overwrite ----------

def _both_changed(browser, base, d):
    pctx, phone = device(browser, d)
    cctx, pc = device(browser, d, wait=600000, every=600000)            # the PC: its change waits, no checks on a timer
    sync_on(phone, base)
    phone.wait_for_function("localStorage.getItem('lite_drive_synced')")
    sync_on(pc, base)
    pc.wait_for_function("localStorage.getItem('lite_drive_synced')")
    pc.goto(base + TODAY)
    post(pc, 'form[action="/add"]', {"amount": "4", "name": "FromPC"})  # not sent yet (the PC was offline)
    phone.goto(base + TODAY)
    post(phone, 'form[action="/add"]', {"amount": "3", "name": "FromPhone"})
    phone.wait_for_function("!localStorage.getItem('lite_drive_dirty')", timeout=8000)
    phones = d.newest()["text"]
    pc.goto(base + TODAY + "&view=drive")
    pc.click("#drivesave")                                               # the PC tries to save over it
    pc.wait_for_selector(".litesheet")
    assert "both devices" in pc.locator(".litesheet h3").inner_text()
    assert d.newest()["text"] == phones                                  # still the phone's copy
    return pctx, phone, cctx, pc


def test_both_changed_keep_this_device(browser, base):
    d = Drive()
    pctx, phone, cctx, pc = _both_changed(browser, base, d)
    before = d.newest()["modifiedTime"]
    pc.click(".litesheet button.alt")                                    # 📱 Keep this device's copy
    pc.wait_for_function("!localStorage.getItem('lite_drive_dirty')", timeout=8000)
    assert d.newest()["modifiedTime"] > before
    assert "FromPC" in spends(pc) and "FromPhone" not in spends(pc)
    wait_spend(phone, "FromPC")                                          # and the phone follows
    pctx.close(); cctx.close()


def test_both_changed_use_the_other_device(browser, base):
    d = Drive()
    pctx, phone, cctx, pc = _both_changed(browser, base, d)
    with pc.expect_navigation():
        pc.click(".litesheet button.ok")                                 # ☁️ Use the other device's copy
    pc.wait_for_load_state()
    assert "FromPhone" in spends(pc) and "FromPC" not in spends(pc)
    assert not pc.evaluate("localStorage.getItem('lite_drive_dirty')")
    pctx.close(); cctx.close()


def test_not_now_leaves_both_alone(browser, base):
    d = Drive()
    pctx, phone, cctx, pc = _both_changed(browser, base, d)
    text = d.newest()["text"]
    sheet(pc, None)                                                      # Not now
    pc.wait_for_timeout(500)
    assert d.newest()["text"] == text and "FromPC" in spends(pc)
    pctx.close(); cctx.close()


# ---------- a PC with another passcode links once ----------

def test_a_device_with_another_passcode_links_once(browser, base):
    d = Drive()
    pctx, phone = device(browser, d)
    other = make_lock(pin="246802", codes=["zzzz-2222"] * 10)
    cctx, pc = device(browser, d, lock=other)
    phone.goto(base + TODAY)
    post(phone, 'form[action="/add"]', {"amount": "3", "name": "PhoneOnly"})
    sync_on(phone, base)
    phone.wait_for_function("localStorage.getItem('lite_drive_synced')")
    sync_on(pc, base)
    sheet(pc, PIN)                                                       # 🔗 the phone's passcode, once
    sheet(pc)                                                            # Linked: same passcode + codes now
    with pc.expect_navigation():
        sheet(pc)                                                        # start with the copy in Drive
    pc.wait_for_load_state()
    assert "PhoneOnly" in spends(pc)
    rec = json.loads(pc.evaluate("localStorage.getItem('lite_lock_v1')"))
    assert rec["mb"] == LOCK["mb"]                                       # the same key as the phone
    pctx.close(); cctx.close()


def test_turning_off_stops_following(browser, base):
    d = Drive()
    pctx, phone = device(browser, d)
    cctx, pc = device(browser, d)
    sync_on(phone, base)
    phone.wait_for_function("localStorage.getItem('lite_drive_synced')")
    sync_on(pc, base)
    pc.wait_for_function("localStorage.getItem('lite_drive_synced')")
    pc.uncheck("#synctoggle")
    pc.goto(base + TODAY)
    phone.goto(base + TODAY)
    post(phone, 'form[action="/add"]', {"amount": "3", "name": "NotFollowed"})
    phone.wait_for_function("!localStorage.getItem('lite_drive_dirty')", timeout=8000)
    pc.wait_for_timeout(1500)
    assert "NotFollowed" not in spends(pc)
    pctx.close(); cctx.close()
